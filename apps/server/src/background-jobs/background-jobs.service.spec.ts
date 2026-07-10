import { BackgroundJobsService } from './background-jobs.service';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

type BackgroundJobFindCall = {
  where: Record<string, unknown>;
  select: Record<string, boolean>;
};

type BackgroundJobUpdateCall = {
  where: Record<string, unknown>;
};

describe('BackgroundJobsService', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const prisma = {
    backgroundJob: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a queued sanitized job for the current user', async () => {
    prisma.backgroundJob.create.mockResolvedValue(jobRow({ status: 'QUEUED' }));

    const result = await createService().createQueuedJob({
      userId: 'user_1',
      queueName: 'knowledge-document-processing',
      jobName: 'process-document',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      idempotencyKey: 'knowledge-process:user_1:doc_1:key',
      dedupeKey: 'knowledge-process-active:user_1:doc_1',
      maxAttempts: 3,
      payloadPreview: { documentId: 'doc_1', force: false },
    });

    expect(prisma.backgroundJob.create).toHaveBeenCalledWith({
      data: objectContaining({
        userId: 'user_1',
        scope: 'ACCOUNT',
        status: 'QUEUED',
        payloadPreview: { documentId: 'doc_1', force: false },
      }),
    });
    expect(result.status).toBe('QUEUED');
  });

  it('marks a job active only when it belongs to the same user and resource', async () => {
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.backgroundJob.findFirst.mockResolvedValue(
      jobRow({ status: 'ACTIVE' }),
    );

    const result = await createService().markActive({
      id: 'job_1',
      userId: 'user_1',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      attempt: 1,
    });

    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'job_1',
        userId: 'user_1',
        scope: 'ACCOUNT',
        resourceType: 'KNOWLEDGE_DOCUMENT',
        resourceId: 'doc_1',
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: objectContaining({
        status: 'ACTIVE',
        attempt: 1,
        startedAt: now,
      }),
    });
    expect(result?.status).toBe('ACTIVE');
  });

  it('lists only current user jobs with resource filters', async () => {
    prisma.backgroundJob.findMany.mockResolvedValue([
      jobRow({ status: 'SUCCEEDED' }),
    ]);

    const result = await createService().list('user_1', {
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      limit: 10,
    });

    expect(prisma.backgroundJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user_1',
          scope: 'ACCOUNT',
          resourceType: 'KNOWLEDGE_DOCUMENT',
          resourceId: 'doc_1',
        },
        take: 10,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('summarizes recent jobs for the current user', async () => {
    prisma.backgroundJob.count.mockResolvedValueOnce(2);
    prisma.backgroundJob.findMany.mockResolvedValue([
      jobRow({
        id: 'job_active',
        status: 'ACTIVE',
        updatedAt: new Date('2026-06-29T00:00:05.000Z'),
      }),
      jobRow({
        id: 'job_queued',
        status: 'QUEUED',
        updatedAt: new Date('2026-06-29T00:00:04.000Z'),
      }),
      jobRow({
        id: 'job_failed',
        status: 'FAILED',
        updatedAt: new Date('2026-06-29T00:00:03.000Z'),
      }),
      jobRow({
        id: 'job_stale',
        status: 'STALE_SKIPPED',
        updatedAt: new Date('2026-06-29T00:00:02.000Z'),
      }),
      jobRow({
        id: 'job_succeeded',
        status: 'SUCCEEDED',
        updatedAt: new Date('2026-06-29T00:00:01.000Z'),
      }),
    ]);

    const result = await createService().getSummary('user_1');

    expect(prisma.backgroundJob.count).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 'user_1',
        scope: 'ACCOUNT',
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
    });
    expect(prisma.backgroundJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1', scope: 'ACCOUNT' },
        take: 50,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        activeCount: 2,
        failedCount: 1,
        staleSkippedCount: 1,
        succeededCount: 1,
        totalRecentCount: 5,
      }),
    );
    expect(result.latestJob?.id).toBe('job_active');
  });

  it('uses ACCOUNT scope when finding active jobs', async () => {
    prisma.backgroundJob.findFirst.mockResolvedValue(null);

    await createService().findActiveForResource(
      'user_1',
      'KNOWLEDGE_DOCUMENT',
      'doc_1',
    );

    const findCall = firstMockArg<BackgroundJobFindCall>(
      prisma.backgroundJob.findFirst,
    );
    expect(findCall.where).toMatchObject({
      userId: 'user_1',
      scope: 'ACCOUNT',
    });
  });

  it('uses ACCOUNT scope for retry updates and the follow-up lookup', async () => {
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.backgroundJob.findFirst.mockResolvedValue(
      jobRow({ status: 'QUEUED' }),
    );

    await createService().markRetryableFailure({
      id: 'job_1',
      userId: 'user_1',
      errorCode: 'DEPENDENCY_UNAVAILABLE',
      error: new Error('redis unavailable'),
    });

    const updateCall = firstMockArg<BackgroundJobUpdateCall>(
      prisma.backgroundJob.updateMany,
    );
    const findCall = firstMockArg<BackgroundJobFindCall>(
      prisma.backgroundJob.findFirst,
    );
    expect(updateCall.where).toMatchObject({ scope: 'ACCOUNT' });
    expect(findCall.where).toEqual({
      id: 'job_1',
      userId: 'user_1',
      scope: 'ACCOUNT',
    });
  });

  it('uses ACCOUNT scope for terminal updates', async () => {
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 0 });

    await createService().markFailed({
      id: 'job_1',
      userId: 'user_1',
      errorCode: 'PROCESSING_FAILED',
      error: new Error('failed'),
    });

    const updateCall = firstMockArg<BackgroundJobUpdateCall>(
      prisma.backgroundJob.updateMany,
    );
    expect(updateCall.where).toMatchObject({ scope: 'ACCOUNT' });
  });

  it('cannot expose a SYSTEM job through an account detail lookup', async () => {
    prisma.backgroundJob.findFirst.mockResolvedValue(null);

    await expect(
      createService().getById('user_1', 'system_job'),
    ).rejects.toThrow('Background job not found');

    const findCall = firstMockArg<BackgroundJobFindCall>(
      prisma.backgroundJob.findFirst,
    );
    expect(findCall.where).toEqual({
      id: 'system_job',
      userId: 'user_1',
      scope: 'ACCOUNT',
    });
    expect(findCall.select).toMatchObject({ id: true });
  });

  function createService() {
    return new BackgroundJobsService(prisma as never);
  }

  function firstMockArg<T>(mock: jest.Mock): T {
    const calls = mock.mock.calls as unknown[][];
    const firstArgument = calls[0]?.[0];
    if (firstArgument === undefined) {
      throw new Error('Expected mock to receive an argument');
    }

    return firstArgument as T;
  }

  function jobRow(input: { status: string; id?: string; updatedAt?: Date }) {
    return {
      id: input.id ?? 'job_1',
      userId: 'user_1',
      queueName: 'knowledge-document-processing',
      jobName: 'process-document',
      bullJobId: 'job_1',
      status: input.status,
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      idempotencyKey: 'idem',
      dedupeKey: 'dedupe',
      attempt: 1,
      maxAttempts: 3,
      progress: 0,
      payloadHash: null,
      payloadPreview: { documentId: 'doc_1' },
      resultSummary: null,
      errorCode: null,
      errorMessage: null,
      requestedAt: now,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    };
  }
});
