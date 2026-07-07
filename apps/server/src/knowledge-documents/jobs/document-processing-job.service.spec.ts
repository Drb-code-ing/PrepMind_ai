import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { DocumentProcessingJobService } from './document-processing-job.service';
import { processKnowledgeDocumentJobPayloadSchema } from './process-document.job';

describe('DocumentProcessingJobService', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const queue = { add: jest.fn() };
  const prisma = {
    $transaction: jest.fn(),
    document: { findFirst: jest.fn(), updateMany: jest.fn() },
    backgroundJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const processing = {
    processDocument: jest.fn(),
    toResponse: jest.fn(),
  };
  const config = { get: jest.fn() };
  const eventBus = { publish: jest.fn() };
  const outbox = { enqueue: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    config.get.mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        KNOWLEDGE_PROCESSING_MODE: 'queue',
        KNOWLEDGE_PROCESSING_ATTEMPTS: 3,
        KNOWLEDGE_PROCESSING_JOB_TIMEOUT_MS: 120000,
        KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: 2,
      };
      return values[key];
    });
    queue.add.mockResolvedValue({ id: 'job_1' });
    outbox.enqueue.mockResolvedValue({ id: 'evt_1', status: 'PENDING' });
  });

  afterEach(() => jest.useRealTimers());

  it('creates a background job and enqueues it after a processing claim', async () => {
    const document = documentRow();
    const job = jobRow();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          document: {
            findFirst: jest.fn().mockResolvedValue(document),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          backgroundJob: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(job),
          },
        }),
    );
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      status: 'PROCESSING',
    });

    const result = await createService().enqueueOrRun('user_1', 'doc_1', {
      force: false,
    });

    expect(queue.add).toHaveBeenCalledWith(
      'process-document',
      expect.objectContaining({
        backgroundJobId: 'job_1',
        userId: 'user_1',
        documentId: 'doc_1',
        snapshot: {
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
        },
      }),
      expect.objectContaining({
        jobId: 'job_1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 3000 },
      }),
    );
    expect(result.processing?.backgroundJobId).toBe('job_1');
    expect(outbox.enqueue).toHaveBeenCalledWith({
      type: 'knowledge.document.processing.requested',
      aggregateType: 'KnowledgeDocument',
      aggregateId: 'doc_1',
      idempotencyKey:
        'knowledge-document-processing-requested:user_1:doc_1:job_1',
      payload: {
        userId: 'user_1',
        documentId: 'doc_1',
        backgroundJobId: 'job_1',
        force: false,
      },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'knowledge.document.processing.requested',
        documentId: 'doc_1',
        backgroundJobId: 'job_1',
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('rejects extra keys inside the snapshot payload', () => {
    expect(() =>
      processKnowledgeDocumentJobPayloadSchema.parse({
        backgroundJobId: 'job_1',
        userId: 'user_1',
        documentId: 'doc_1',
        force: false,
        snapshot: {
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
          leakedText: 'full document text',
        },
        requestedAt: '2026-06-29T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('does not fail the enqueue response when outbox enqueue fails', async () => {
    const document = documentRow();
    const job = jobRow();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          document: {
            findFirst: jest.fn().mockResolvedValue(document),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          backgroundJob: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(job),
          },
        }),
    );
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      status: 'PROCESSING',
    });
    outbox.enqueue.mockRejectedValue(new Error('outbox unavailable'));

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).resolves.toMatchObject({
      processing: { backgroundJobId: 'job_1' },
    });

    expect(queue.add).toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('does not fail the enqueue response when event publication fails', async () => {
    const document = documentRow();
    const job = jobRow();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          document: {
            findFirst: jest.fn().mockResolvedValue(document),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          backgroundJob: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(job),
          },
        }),
    );
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      status: 'PROCESSING',
    });
    eventBus.publish.mockImplementation(() => {
      throw new Error('subscriber failed');
    });

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).resolves.toMatchObject({
      processing: { backgroundJobId: 'job_1' },
    });
  });

  it('falls back to inline processing when mode is inline', async () => {
    config.get.mockImplementation((key: string) =>
      key === 'KNOWLEDGE_PROCESSING_MODE' ? 'inline' : 3,
    );
    processing.processDocument.mockResolvedValue({
      id: 'doc_1',
      status: 'DONE',
    });

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).resolves.toEqual({ id: 'doc_1', status: 'DONE' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns the existing active job when the document is already processing', async () => {
    prisma.$transaction.mockImplementation(() => {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    });
    prisma.backgroundJob.findFirst.mockResolvedValue(jobRow());
    prisma.document.findFirst.mockResolvedValue({
      ...documentRow(),
      status: 'PROCESSING',
    });
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      status: 'PROCESSING',
    });

    const result = await createService().enqueueOrRun('user_1', 'doc_1', {
      force: false,
    });

    expect(result.processing?.backgroundJobId).toBe('job_1');
  });

  it('marks the job and document failed when enqueue fails after the claim transaction commits', async () => {
    const document = documentRow();
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          document: {
            findFirst: jest.fn().mockResolvedValue(document),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          backgroundJob: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(jobRow()),
          },
        }),
    );
    queue.add.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      createService().enqueueOrRun('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PROCESSING_QUEUE_FAILED',
    });

    const backgroundJobUpdate = firstMockArg<UpdateManyCall>(
      prisma.backgroundJob.updateMany,
    );
    expect(backgroundJobUpdate.where).toMatchObject({
      id: 'job_1',
      userId: 'user_1',
    });
    expect(backgroundJobUpdate.data).toMatchObject({
      status: 'FAILED',
      errorCode: 'ENQUEUE_FAILED',
    });

    const documentUpdate = firstMockArg<UpdateManyCall>(
      prisma.document.updateMany,
    );
    expect(documentUpdate.where).toMatchObject({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    });
    expect(documentUpdate.data).toMatchObject({ status: 'FAILED' });
  });

  function createService() {
    return new DocumentProcessingJobService(
      prisma as never,
      queue as never,
      processing as never,
      config as never,
      eventBus as never,
      outbox as never,
    );
  }

  type UpdateManyCall = {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  };

  function firstMockArg<T>(mock: jest.Mock): T {
    const calls = mock.mock.calls as unknown[][];
    return calls[0]?.[0] as T;
  }

  function documentRow() {
    return {
      id: 'doc_1',
      userId: 'user_1',
      name: 'notes.txt',
      type: 'TXT',
      size: 128,
      mimeType: 'text/plain',
      storageKey: 'users/user_1/knowledge/notes.txt',
      status: 'PENDING',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:abc',
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      _count: { chunks: 0 },
    };
  }

  function jobRow() {
    return {
      id: 'job_1',
      status: 'QUEUED',
      requestedAt: now,
    };
  }
});
