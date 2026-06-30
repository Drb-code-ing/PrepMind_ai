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

  function createService() {
    return new BackgroundJobsService(prisma as never);
  }

  function jobRow(input: { status: string }) {
    return {
      id: 'job_1',
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
      updatedAt: now,
    };
  }
});
