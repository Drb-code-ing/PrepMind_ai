import { randomUUID } from 'node:crypto';

import { BackgroundJobsService } from '../src/background-jobs/background-jobs.service';
import { PrismaService } from '../src/database/prisma.service';

describe('BackgroundJob scope persistence (e2e)', () => {
  let prisma: PrismaService;
  let backgroundJobs: BackgroundJobsService;
  const userIds: string[] = [];
  const backgroundJobIds: string[] = [];
  const exportIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';

    prisma = new PrismaService();
    await prisma.$connect();
    backgroundJobs = new BackgroundJobsService(prisma);
  });

  afterAll(async () => {
    if (exportIds.length > 0) {
      await prisma.operatorAuditExport.deleteMany({
        where: { id: { in: exportIds } },
      });
    }
    if (backgroundJobIds.length > 0) {
      await prisma.backgroundJob.deleteMany({
        where: { id: { in: backgroundJobIds } },
      });
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('deletes ACCOUNT jobs when their owning user is deleted', async () => {
    const user = await createTestUser('account-cascade');
    const job = await prisma.backgroundJob.create({
      data: {
        userId: user.id,
        scope: 'ACCOUNT',
        queueName: 'knowledge-document-processing',
        jobName: 'process-document',
        resourceType: 'KNOWLEDGE_DOCUMENT',
        resourceId: `doc_${randomUUID()}`,
      },
    });
    backgroundJobIds.push(job.id);

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.backgroundJob.findUnique({ where: { id: job.id } }),
    ).resolves.toBeNull();
  });

  it('rejects an ACCOUNT job without a user at the database boundary', async () => {
    const jobId = `invalid_account_${randomUUID()}`;
    backgroundJobIds.push(jobId);

    await expect(
      prisma.backgroundJob.create({
        data: {
          id: jobId,
          userId: null,
          scope: 'ACCOUNT',
          queueName: 'knowledge-document-processing',
          jobName: 'process-document',
          resourceType: 'KNOWLEDGE_DOCUMENT',
          resourceId: `doc_${randomUUID()}`,
        },
      }),
    ).rejects.toThrow('BackgroundJob_scope_user_check');
  });

  it('rejects a SYSTEM job with a user at the database boundary', async () => {
    const user = await createTestUser('invalid-system-owner');
    const jobId = `invalid_system_${randomUUID()}`;
    backgroundJobIds.push(jobId);

    await expect(
      prisma.backgroundJob.create({
        data: {
          id: jobId,
          userId: user.id,
          scope: 'SYSTEM',
          queueName: 'operator-audit-export',
          jobName: 'generate-operator-audit-export',
          resourceType: 'OPERATOR_AUDIT_EXPORT',
          resourceId: `export_resource_${randomUUID()}`,
        },
      }),
    ).rejects.toThrow('BackgroundJob_scope_user_check');
  });

  it('preserves SYSTEM jobs and exports while nulling the deleted requester', async () => {
    const user = await createTestUser('system-survival');
    const job = await prisma.backgroundJob.create({
      data: {
        userId: null,
        scope: 'SYSTEM',
        queueName: 'operator-audit-export',
        jobName: 'generate-operator-audit-export',
        resourceType: 'OPERATOR_AUDIT_EXPORT',
        resourceId: `export_resource_${randomUUID()}`,
      },
    });
    backgroundJobIds.push(job.id);

    const auditExport = await prisma.operatorAuditExport.create({
      data: {
        requestedByUserId: user.id,
        clientRequestId: randomUUID(),
        requestHash: `sha256:${'a'.repeat(64)}`,
        backgroundJobId: job.id,
        startAt: new Date('2026-07-01T00:00:00.000Z'),
        endAt: new Date('2026-07-10T00:00:00.000Z'),
        snapshotAt: new Date('2026-07-10T00:00:00.000Z'),
        reason: 'scope survival e2e',
      },
    });
    exportIds.push(auditExport.id);

    await prisma.user.delete({ where: { id: user.id } });

    await expect(
      prisma.backgroundJob.findUnique({ where: { id: job.id } }),
    ).resolves.toEqual(
      expect.objectContaining({ scope: 'SYSTEM', userId: null }),
    );
    await expect(
      prisma.operatorAuditExport.findUnique({ where: { id: auditExport.id } }),
    ).resolves.toEqual(
      expect.objectContaining({
        requestedByUserId: null,
        backgroundJobId: job.id,
      }),
    );
  });

  it('does not expose a SYSTEM job through account service queries', async () => {
    const user = await createTestUser('account-isolation');
    const job = await prisma.backgroundJob.create({
      data: {
        userId: null,
        scope: 'SYSTEM',
        queueName: 'operator-audit-export',
        jobName: 'generate-operator-audit-export',
        resourceType: 'OPERATOR_AUDIT_EXPORT',
        resourceId: `export_resource_${randomUUID()}`,
      },
    });
    backgroundJobIds.push(job.id);

    await expect(backgroundJobs.getById(user.id, job.id)).rejects.toThrow(
      'Background job not found',
    );
    await expect(backgroundJobs.list(user.id, { limit: 20 })).resolves.toEqual({
      items: [],
    });
    await expect(backgroundJobs.getSummary(user.id)).resolves.toEqual(
      expect.objectContaining({ activeCount: 0, totalRecentCount: 0 }),
    );
  });

  async function createTestUser(label: string) {
    const user = await prisma.user.create({
      data: {
        email: `background-scope-${label}-${randomUUID()}@example.com`,
        passwordHash: 'not-used-in-e2e',
      },
    });
    userIds.push(user.id);
    return user;
  }
});
