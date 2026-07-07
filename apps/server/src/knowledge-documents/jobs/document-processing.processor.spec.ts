import { HttpStatus } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import { DocumentProcessingProcessor } from './document-processing.processor';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

describe('DocumentProcessingProcessor', () => {
  const job = {
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
  };
  const backgroundJobs = {
    markActive: jest.fn(),
    markSucceeded: jest.fn(),
    markRetryableFailure: jest.fn(),
    markFailed: jest.fn(),
    markStaleSkipped: jest.fn(),
  };
  const processing = {
    runProcessingPipeline: jest.fn(),
    markFailedForSnapshot: jest.fn(),
  };
  const eventBus = {
    publish: jest.fn(),
  };
  const prisma = {
    document: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:00:10.000Z'));
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
    processing.runProcessingPipeline.mockResolvedValue({
      id: 'doc_1',
      status: 'DONE',
      chunkCount: 2,
    });
    processing.markFailedForSnapshot.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('marks active, runs the processing pipeline, and marks succeeded', async () => {
    await createProcessor().process(job as never);

    expect(backgroundJobs.markActive).toHaveBeenCalledWith({
      id: 'job_1',
      userId: 'user_1',
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: 'doc_1',
      attempt: 1,
    });
    expect(processing.runProcessingPipeline).toHaveBeenCalledWith({
      userId: 'user_1',
      documentId: 'doc_1',
      expectedDocument: {
        storageKey: 'users/user_1/knowledge/notes.txt',
        contentHash: 'sha256:abc',
      },
    });
    expect(backgroundJobs.markSucceeded).toHaveBeenCalledWith(
      objectContaining({
        id: 'job_1',
        resultSummary: objectContaining({ chunkCount: 2 }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      objectContaining({
        type: 'knowledge.document.processing.succeeded',
        documentId: 'doc_1',
      }),
    );
  });

  it('stale skips when the document snapshot no longer matches', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'PROCESSING',
      storageKey: 'users/user_1/knowledge/new.txt',
      contentHash: 'sha256:new',
    });

    await createProcessor().process(job as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'snapshot_changed' }),
    );
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
  });

  it('stale skips when the document is missing', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await createProcessor().process(job as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'document_missing' }),
    );
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
  });

  it('stale skips when the document is no longer processing', async () => {
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc_1',
      userId: 'user_1',
      status: 'DONE',
      storageKey: 'users/user_1/knowledge/notes.txt',
      contentHash: 'sha256:abc',
    });

    await createProcessor().process(job as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'status_not_processing' }),
    );
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
  });

  it('exits without touching the document when the background job cannot be activated', async () => {
    backgroundJobs.markActive.mockResolvedValue(null);

    await createProcessor().process(job as never);

    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(processing.runProcessingPipeline).not.toHaveBeenCalled();
    expect(backgroundJobs.markStaleSkipped).not.toHaveBeenCalled();
  });

  it('rethrows retryable failures before attempts are exhausted', async () => {
    const failure = new Error('provider unavailable');
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(createProcessor().process(job as never)).rejects.toBe(failure);

    expect(backgroundJobs.markRetryableFailure).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job_1', errorCode: 'RETRYABLE_ERROR' }),
    );
    expect(backgroundJobs.markFailed).not.toHaveBeenCalled();
  });

  it('marks final failure when retry attempts are exhausted', async () => {
    const failure = new Error('provider unavailable');
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(
      createProcessor().process({
        ...job,
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as never),
    ).rejects.toBe(failure);

    expect(backgroundJobs.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job_1', errorCode: 'RETRY_EXHAUSTED' }),
    );
    expect(processing.markFailedForSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        documentId: 'doc_1',
        expectedDocument: job.data.snapshot,
      }),
    );
    expect(backgroundJobs.markRetryableFailure).not.toHaveBeenCalled();
  });

  it('retries provider AppError failures before attempts are exhausted', async () => {
    const failure = new AppError(
      'KNOWLEDGE_EMBEDDING_FAILED',
      'Embedding provider rejected the chunk batch',
      HttpStatus.BAD_GATEWAY,
    );
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(createProcessor().process(job as never)).rejects.toBe(failure);

    expect(backgroundJobs.markRetryableFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        errorCode: 'KNOWLEDGE_EMBEDDING_FAILED',
      }),
    );
    expect(backgroundJobs.markFailed).not.toHaveBeenCalled();
  });

  it('stale skips snapshot conflicts thrown during the pipeline', async () => {
    const failure = new AppError(
      'KNOWLEDGE_DOCUMENT_PROCESSING',
      'Knowledge document changed while processing',
      HttpStatus.CONFLICT,
    );
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await createProcessor().process(job as never);

    expect(backgroundJobs.markStaleSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'snapshot_changed' }),
    );
    expect(backgroundJobs.markFailed).not.toHaveBeenCalled();
  });

  it('marks non-retryable business failures immediately', async () => {
    const failure = new AppError(
      'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      '资料中没有可解析的文本',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
    processing.runProcessingPipeline.mockRejectedValue(failure);

    await expect(
      createProcessor().process(job as never),
    ).resolves.toBeUndefined();

    expect(backgroundJobs.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job_1',
        errorCode: 'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
      }),
    );
    expect(backgroundJobs.markRetryableFailure).not.toHaveBeenCalled();
  });

  function createProcessor() {
    return new DocumentProcessingProcessor(
      backgroundJobs as never,
      processing as never,
      prisma as never,
      eventBus as never,
    );
  }
});
