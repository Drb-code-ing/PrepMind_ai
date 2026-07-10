import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import type { OperatorAuditExportCreateRequest } from '@repo/types/api/operator-audit-export';

import { AppError } from '../src/common/errors/app-error';
import { PrismaService } from '../src/database/prisma.service';
import { OperatorAuditService } from '../src/operator-audit/operator-audit.service';
import { OPERATOR_AUDIT_RETENTION_LOCK } from '../src/operator-audit-exports/operator-audit-export.constants';
import { OperatorAuditExportRequestService } from '../src/operator-audit-exports/operator-audit-export-request.service';
import { OutboxService } from '../src/outbox/outbox.service';

type RecordedConcurrencyError = {
  code: string;
  target: unknown;
};

type InteractiveTransactionRunner = (
  callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
) => Promise<unknown>;

describe('Operator audit export request concurrency (e2e)', () => {
  let prisma: PrismaService;
  let blockerPrisma: PrismaService;
  let currentUserId: string | null;
  let recordedConcurrencyErrors: RecordedConcurrencyError[];

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';
    prisma = new PrismaService();
    blockerPrisma = new PrismaService();
    await Promise.all([prisma.$connect(), blockerPrisma.$connect()]);
  });

  beforeEach(() => {
    currentUserId = null;
    recordedConcurrencyErrors = [];
  });

  afterEach(async () => {
    if (currentUserId) await cleanupUserFacts(currentUserId);
  });

  afterAll(async () => {
    await Promise.all([prisma.$disconnect(), blockerPrisma.$disconnect()]);
  });

  it('deduplicates concurrent same-hash requests into one complete fact set', async () => {
    const user = await createTestUser('same-hash');
    const reason = `concurrency-same-${randomUUID()}`;
    const input = createInput(reason);
    const service = createService(10);

    const results = await runBehindRetentionBlocker([
      () => service.create(user.id, input),
      () => service.create(user.id, input),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const fulfilled = fulfilledValues(results);
    expect(fulfilled).toHaveLength(2);
    expect(new Set(fulfilled.map((value) => value.id)).size).toBe(1);
    await expectFactCounts(user.id, reason, 1);
    expectOnlyPrismaSerializationFailures();
  });

  it('creates two complete fact sets for concurrent distinct requests when capacity is available', async () => {
    const user = await createTestUser('distinct');
    const reason = `concurrency-distinct-${randomUUID()}`;
    const service = createService(10);

    const results = await runBehindRetentionBlocker([
      () => service.create(user.id, createInput(reason)),
      () =>
        service.create(
          user.id,
          createInput(reason, { clientRequestId: randomUUID() }),
        ),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const fulfilled = fulfilledValues(results);
    expect(new Set(fulfilled.map((value) => value.id)).size).toBe(2);
    await expectFactCounts(user.id, reason, 2);
    expectOnlyPrismaSerializationFailures();
  });

  it('admits exactly one concurrent request when active capacity has one slot left', async () => {
    const user = await createTestUser('quota');
    await createActiveExport(user.id);
    const reason = `concurrency-quota-${randomUUID()}`;
    const service = createService(2);

    const results = await runBehindRetentionBlocker([
      () => service.create(user.id, createInput(reason)),
      () =>
        service.create(
          user.id,
          createInput(reason, { clientRequestId: randomUUID() }),
        ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    if (rejected?.status === 'rejected') {
      expect(rejected.reason).toBeInstanceOf(AppError);
      expect(rejected.reason).toMatchObject({
        code: 'OPERATOR_AUDIT_EXPORT_LIMIT_REACHED',
        statusCode: 429,
      });
    }
    await expectFactCounts(user.id, reason, 1);
    await expect(
      prisma.operatorAuditExport.count({
        where: {
          requestedByUserId: user.id,
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
      }),
    ).resolves.toBe(2);
    expectOnlyPrismaSerializationFailures();
  });

  function createService(activeLimit: number) {
    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, number | string> = {
          OPERATOR_AUDIT_RETENTION_DAYS: 180,
          OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS: 31,
          OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT: activeLimit,
          OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT: 100,
          OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT: 100,
          OPERATOR_AUDIT_FINGERPRINT_SECRET:
            'e2e-operator-audit-fingerprint-secret',
        };
        return values[key];
      }),
    };
    const instrumentedPrisma = createInstrumentedPrisma();
    const outbox = new OutboxService(prisma);
    const audit = new OperatorAuditService(prisma, config as never, {
      warn: jest.fn(),
    });

    return new OperatorAuditExportRequestService(
      instrumentedPrisma,
      config as never,
      outbox,
      audit,
    );
  }

  function createInstrumentedPrisma() {
    const runTransaction = prisma.$transaction.bind(
      prisma,
    ) as InteractiveTransactionRunner;
    return {
      $transaction: async (
        callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
      ) => {
        try {
          return await runTransaction(callback, options);
        } catch (error) {
          recordConcurrencyError(error);
          throw error;
        }
      },
    } as PrismaService;
  }

  function recordConcurrencyError(error: unknown) {
    const code = readErrorCode(error);
    if (!code || !['P2034', 'P2002', '40001'].includes(code)) return;
    recordedConcurrencyErrors.push({
      code,
      target:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.meta?.target
          : undefined,
    });
  }

  async function runBehindRetentionBlocker(
    tasks: Array<() => Promise<unknown>>,
  ) {
    const blocker = await startRetentionBlocker();
    const pending = tasks.map((task) => task());
    let waitFailure: Error | undefined;
    try {
      await waitForAdvisoryWaiters(blocker.pid, tasks.length);
    } catch (error) {
      waitFailure =
        error instanceof Error
          ? error
          : new Error('Failed while waiting for advisory lock contention');
    } finally {
      blocker.release();
      await blocker.done;
    }

    const results = await Promise.allSettled(pending);
    if (waitFailure) throw waitFailure;
    return results;
  }

  async function startRetentionBlocker() {
    const acquired = deferred<number>();
    const released = deferred<void>();
    const done = blockerPrisma.$transaction(async (transaction) => {
      const [backend] = await transaction.$queryRaw<Array<{ pid: number }>>`
        SELECT pg_backend_pid()::int AS pid
      `;
      if (!backend) throw new Error('Missing blocker backend pid');
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0)
        )
      `;
      acquired.resolve(backend.pid);
      await released.promise;
    });
    void done.catch((error: unknown) => acquired.reject(error));

    return {
      pid: await acquired.promise,
      release: () => released.resolve(),
      done,
    };
  }

  async function waitForAdvisoryWaiters(
    blockerPid: number,
    expectedCount: number,
  ) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const [row] = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM pg_locks waiting
        JOIN pg_locks held
          ON held.pid = ${blockerPid}
         AND held.locktype = 'advisory'
         AND held.granted
         AND waiting.locktype = held.locktype
         AND waiting.database IS NOT DISTINCT FROM held.database
         AND waiting.classid IS NOT DISTINCT FROM held.classid
         AND waiting.objid IS NOT DISTINCT FROM held.objid
         AND waiting.objsubid IS NOT DISTINCT FROM held.objsubid
        JOIN pg_stat_activity activity ON activity.pid = waiting.pid
        WHERE NOT waiting.granted
          AND waiting.pid <> held.pid
          AND activity.wait_event_type = 'Lock'
          AND activity.wait_event = 'advisory'
      `;
      if ((row?.count ?? 0) >= expectedCount) return;
      await waitForNextPoll();
    }

    throw new Error(
      `Timed out waiting for ${expectedCount} advisory lock waiters`,
    );
  }

  async function expectFactCounts(
    userId: string,
    reason: string,
    expectedCount: number,
  ) {
    const exports = await prisma.operatorAuditExport.findMany({
      where: { requestedByUserId: userId, reason },
      select: { id: true },
    });
    const exportIds = exports.map((value) => value.id);
    expect(exports).toHaveLength(expectedCount);
    await expect(
      prisma.backgroundJob.count({
        where: {
          scope: 'SYSTEM',
          userId: null,
          resourceType: 'OPERATOR_AUDIT_EXPORT',
          resourceId: { in: exportIds },
        },
      }),
    ).resolves.toBe(expectedCount);
    await expect(
      prisma.outboxEvent.count({
        where: {
          type: 'operator.audit.export.requested',
          aggregateId: { in: exportIds },
        },
      }),
    ).resolves.toBe(expectedCount);
    await expect(
      prisma.operatorAuditLog.count({
        where: {
          actorUserId: userId,
          action: 'AUDIT_EXPORT_REQUEST',
          targetType: 'OperatorAuditExport',
          targetId: { in: exportIds },
        },
      }),
    ).resolves.toBe(expectedCount);
  }

  async function createTestUser(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `audit-export-concurrency-${label}-${randomUUID()}@example.com`,
        passwordHash: 'not-used-in-e2e',
        role: 'ADMIN',
      },
    });
    currentUserId = user.id;
    return user;
  }

  async function createActiveExport(userId: string) {
    const exportId = randomUUID();
    const backgroundJobId = randomUUID();
    const now = new Date();
    await prisma.$transaction([
      prisma.backgroundJob.create({
        data: {
          id: backgroundJobId,
          userId: null,
          scope: 'SYSTEM',
          queueName: 'operator-audit-export',
          jobName: 'generate-operator-audit-export',
          status: 'QUEUED',
          resourceType: 'OPERATOR_AUDIT_EXPORT',
          resourceId: exportId,
          maxAttempts: 3,
        },
      }),
      prisma.operatorAuditExport.create({
        data: {
          id: exportId,
          requestedByUserId: userId,
          clientRequestId: randomUUID(),
          requestHash: `sha256:${'a'.repeat(64)}`,
          backgroundJobId,
          status: 'QUEUED',
          startAt: new Date(now.getTime() - 86_400_000),
          endAt: new Date(now.getTime() - 60_000),
          snapshotAt: now,
          reason: `quota-seed-${randomUUID()}`,
        },
      }),
    ]);
  }

  async function cleanupUserFacts(userId: string) {
    const exports = await prisma.operatorAuditExport.findMany({
      where: { requestedByUserId: userId },
      select: { id: true },
    });
    const exportIds = exports.map((value) => value.id);
    if (exportIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: {
          type: 'operator.audit.export.requested',
          aggregateId: { in: exportIds },
        },
      });
      await prisma.operatorAuditLog.deleteMany({
        where: {
          actorUserId: userId,
          action: 'AUDIT_EXPORT_REQUEST',
          targetId: { in: exportIds },
        },
      });
      await prisma.operatorAuditExport.deleteMany({
        where: { id: { in: exportIds } },
      });
      await prisma.backgroundJob.deleteMany({
        where: {
          scope: 'SYSTEM',
          resourceType: 'OPERATOR_AUDIT_EXPORT',
          resourceId: { in: exportIds },
        },
      });
    }
    await prisma.user.deleteMany({ where: { id: userId } });
    currentUserId = null;
  }

  function createInput(
    reason: string,
    overrides: Partial<OperatorAuditExportCreateRequest> = {},
  ): OperatorAuditExportCreateRequest {
    const endAt = new Date(Date.now() - 60_000);
    return {
      clientRequestId: randomUUID(),
      startAt: new Date(endAt.getTime() - 86_400_000).toISOString(),
      endAt: endAt.toISOString(),
      reason,
      ...overrides,
    };
  }

  function fulfilledValues(
    results: Array<PromiseSettledResult<unknown>>,
  ): Array<{ id: string }> {
    return results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value as { id: string }] : [],
    );
  }

  function expectOnlyPrismaSerializationFailures() {
    expect(recordedConcurrencyErrors.length).toBeGreaterThanOrEqual(1);
    expect(recordedConcurrencyErrors).toEqual(
      expect.arrayContaining([
        {
          code: 'P2034',
          target: undefined,
        },
      ]),
    );
    expect(
      recordedConcurrencyErrors.every(
        (value) => value.code === 'P2034' && value.target === undefined,
      ),
    ).toBe(true);
  }

  function readErrorCode(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code;
    }
    if (typeof error !== 'object' || error === null) return undefined;
    const value = error as { code?: unknown };
    return typeof value.code === 'string' ? value.code : undefined;
  }

  function waitForNextPoll() {
    return new Promise<void>((resolve) => setTimeout(resolve, 25));
  }

  function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }
});
