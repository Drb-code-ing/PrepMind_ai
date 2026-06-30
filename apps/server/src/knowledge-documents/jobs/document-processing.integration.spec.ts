import { DocumentProcessingJobService } from './document-processing-job.service';
import { DocumentProcessingProcessor } from './document-processing.processor';

describe('queued document processing integration', () => {
  const now = new Date('2026-06-29T00:00:00.000Z');
  const enqueued: Array<{
    name: string;
    payload: unknown;
    options: { jobId: string };
  }> = [];
  const queue = {
    add: jest.fn(
      async (name: string, payload: unknown, options: { jobId: string }) => {
        enqueued.push({ name, payload, options });
        return { id: options.jobId };
      },
    ),
  };
  const eventBus = { publish: jest.fn() };
  const processing = {
    toResponse: jest.fn(),
    processDocument: jest.fn(),
    runProcessingPipeline: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        KNOWLEDGE_PROCESSING_MODE: 'queue',
        KNOWLEDGE_PROCESSING_ATTEMPTS: 3,
        KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT: 2,
      };
      return values[key];
    }),
  };
  const backgroundJobs = {
    markActive: jest.fn(),
    markSucceeded: jest.fn(),
    markRetryableFailure: jest.fn(),
    markFailed: jest.fn(),
    markStaleSkipped: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(),
    backgroundJob: { findFirst: jest.fn(), updateMany: jest.fn() },
    document: { findFirst: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    enqueued.length = 0;
    jest.useFakeTimers().setSystemTime(now);
    processing.toResponse.mockReturnValue({
      id: 'doc_1',
      name: 'notes.txt',
      type: 'TXT',
      size: 128,
      mimeType: 'text/plain',
      status: 'PROCESSING',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:abc',
      chunkCount: 0,
      processedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    processing.runProcessingPipeline.mockResolvedValue({
      id: 'doc_1',
      status: 'DONE',
      chunkCount: 2,
    });
    backgroundJobs.markActive.mockResolvedValue({
      id: 'job_1',
      status: 'ACTIVE',
    });
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    });
  });

  afterEach(() => jest.useRealTimers());

  it('passes the producer payload to the processor and records success', async () => {
    prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          document: {
            findFirst: jest.fn().mockResolvedValue(documentRow()),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          backgroundJob: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue(jobRow()),
          },
        }),
    );

    const producer = new DocumentProcessingJobService(
      prisma as never,
      queue as never,
      processing as never,
      config as never,
      eventBus as never,
    );
    const processor = new DocumentProcessingProcessor(
      backgroundJobs as never,
      processing as never,
      prisma as never,
      eventBus as never,
    );

    const response = await producer.enqueueOrRun('user_1', 'doc_1', {
      force: false,
    });
    await processor.process({
      id: enqueued[0]?.options.jobId,
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: enqueued[0]?.payload,
    } as never);

    expect(response.processing?.backgroundJobId).toBe('job_1');
    expect(processing.runProcessingPipeline).toHaveBeenCalledWith({
      userId: 'user_1',
      documentId: 'doc_1',
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    });
    expect(backgroundJobs.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        resultSummary: expect.objectContaining({ chunkCount: 2 }),
      }),
    );
  });

  it('stale queued jobs do not write chunks when the document snapshot changed', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/new-notes.txt',
      contentHash: 'sha256:new',
    });

    const processor = new DocumentProcessingProcessor(
      backgroundJobs as never,
      processing as never,
      prisma as never,
      eventBus as never,
    );

    await processor.process({
      id: 'job_1',
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        backgroundJobId: 'job_1',
        userId: 'user_1',
        documentId: 'doc_1',
        force: false,
        snapshot: {
          storageKey: 'users/user_1/knowledge/notes.txt',
          contentHash: 'sha256:abc',
        },
        requestedAt: '2026-06-29T00:00:00.000Z',
      },
    } as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        reason: 'snapshot_changed',
      }),
    );
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
  });

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
