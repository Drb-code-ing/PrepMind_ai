import { BackgroundJobsService } from './background-jobs.service';

describe('BackgroundJobsService', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const prisma = {
    backgroundJob: {
      create: jest.fn(),
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
      data: expect.objectContaining({
        userId: 'user_1',
        status: 'QUEUED',
        payloadPreview: { documentId: 'doc_1', force: false },
      }),
    });
    expect(result.status).toBe('QUEUED');
  });

  it('marks a job active only when it belongs to the same user and resource', async () => {
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
    prisma.backgroundJob.findFirst.mockResolvedValue(jobRow({ status: 'ACTIVE' }));

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
        resourceType: 'KNOWLEDGE_DOCUMENT',
        resourceId: 'doc_1',
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: expect.objectContaining({
        status: 'ACTIVE',
        attempt: 1,
        startedAt: now,
      }),
    });
    expect(result?.status).toBe('ACTIVE');
  });

  it('lists only current user jobs with resource filters', async () => {
    prisma.backgroundJob.findMany.mockResolvedValue([jobRow({ status: 'SUCCEEDED' })]);

    const result = await createService().list('user_1', {
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      limit: 10,
    });

    expect(prisma.backgroundJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user_1',
          resourceType: 'KNOWLEDGE_DOCUMENT',
          resourceId: 'doc_1',
        },
        take: 10,
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('summarizes recent jobs for the current user', async () => {
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

    expect(prisma.backgroundJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1' },
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

  function createService() {
    return new BackgroundJobsService(prisma as never);
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
