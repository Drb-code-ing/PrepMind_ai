import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../database/prisma.service';
import { EVENT_BUS } from '../../events/events.module';
import type { InProcessEventBus } from '../../events/event-bus';
import { BackgroundJobsService } from '../../background-jobs/background-jobs.service';
import { DocumentProcessingService } from '../document-processing.service';
import {
  PROCESS_KNOWLEDGE_DOCUMENT_QUEUE,
  processKnowledgeDocumentJobPayloadSchema,
  type ProcessKnowledgeDocumentJobPayload,
} from './process-document.job';

type StaleReason =
  | 'document_missing'
  | 'snapshot_changed'
  | 'status_not_processing'
  | 'job_not_active';

@Processor(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE, {
  concurrency: Number(process.env.KNOWLEDGE_PROCESSING_CONCURRENCY || 2),
  lockDuration: Number(process.env.KNOWLEDGE_PROCESSING_LOCK_DURATION_MS || 60000),
  limiter: {
    max: Number(process.env.KNOWLEDGE_PROCESSING_GLOBAL_RATE_LIMIT || 30),
    duration: 60000,
  },
})
export class DocumentProcessingProcessor extends WorkerHost {
  constructor(
    private readonly backgroundJobs: BackgroundJobsService,
    private readonly processingService: DocumentProcessingService,
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS)
    private readonly eventBus: InProcessEventBus,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const startedAt = Date.now();
    const payload = processKnowledgeDocumentJobPayloadSchema.parse(job.data);
    const active = await this.backgroundJobs.markActive({
      id: payload.backgroundJobId,
      userId: payload.userId,
      resourceType: 'KNOWLEDGE_DOCUMENT',
      resourceId: payload.documentId,
      attempt: job.attemptsMade + 1,
    });

    if (!active) {
      return;
    }

    const document = await this.prisma.document.findFirst({
      where: { id: payload.documentId, userId: payload.userId },
    });

    if (!document) {
      await this.markStaleSkipped(payload, 'document_missing');
      return;
    }

    if (document.status !== 'PROCESSING') {
      await this.markStaleSkipped(payload, 'status_not_processing');
      return;
    }

    if (
      document.storageKey !== payload.snapshot.storageKey ||
      document.contentHash !== payload.snapshot.contentHash
    ) {
      await this.markStaleSkipped(payload, 'snapshot_changed');
      return;
    }

    try {
      const result = await this.processingService.runProcessingPipeline({
        userId: payload.userId,
        documentId: payload.documentId,
        expectedDocument: payload.snapshot,
      });
      const durationMs = Date.now() - startedAt;

      await this.backgroundJobs.markSucceeded({
        id: payload.backgroundJobId,
        userId: payload.userId,
        resultSummary: {
          documentId: payload.documentId,
          chunkCount: result.chunkCount,
          durationMs,
        },
      });
      this.publishBestEffort({
        type: 'knowledge.document.processing.succeeded',
        userId: payload.userId,
        documentId: payload.documentId,
        backgroundJobId: payload.backgroundJobId,
        chunkCount: result.chunkCount,
        durationMs,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      const action = await this.handleProcessingFailure(job, payload, error);
      if (action === 'retry') {
        throw error;
      }
    }
  }

  private async handleProcessingFailure(
    job: Job<unknown>,
    payload: ProcessKnowledgeDocumentJobPayload,
    error: unknown,
  ): Promise<'retry' | 'complete'> {
    if (isPipelineSnapshotConflict(error)) {
      await this.markStaleSkipped(payload, 'snapshot_changed');
      return 'complete';
    }

    if (isRetryableError(error) && job.attemptsMade + 1 < this.maxAttempts(job)) {
      await this.backgroundJobs.markRetryableFailure({
        id: payload.backgroundJobId,
        userId: payload.userId,
        errorCode: errorCodeFor(error, 'RETRYABLE_ERROR'),
        error,
        attempt: job.attemptsMade + 1,
      });
      return 'retry';
    }

    if (error instanceof AppError && !isRetryableError(error)) {
      await this.markFinalFailure(payload, error.code, error, false);
      return 'complete';
    }

    await this.markFinalFailure(payload, 'RETRY_EXHAUSTED', error, true);
    return 'retry';
  }

  private async markFinalFailure(
    payload: ProcessKnowledgeDocumentJobPayload,
    errorCode: string,
    error: unknown,
    retryable: boolean,
  ) {
    await this.backgroundJobs.markFailed({
      id: payload.backgroundJobId,
      userId: payload.userId,
      errorCode,
      error,
    });
    await this.processingService.markFailedForSnapshot({
      userId: payload.userId,
      documentId: payload.documentId,
      expectedDocument: payload.snapshot,
      error,
    });
    this.publishBestEffort({
      type: 'knowledge.document.processing.failed',
      userId: payload.userId,
      documentId: payload.documentId,
      backgroundJobId: payload.backgroundJobId,
      errorCode,
      retryable,
      finishedAt: new Date().toISOString(),
    });
  }

  private async markStaleSkipped(
    payload: ProcessKnowledgeDocumentJobPayload,
    reason: StaleReason,
  ) {
    await this.backgroundJobs.markStaleSkipped({
      id: payload.backgroundJobId,
      userId: payload.userId,
      reason,
    });
    this.publishBestEffort({
      type: 'knowledge.document.processing.stale_skipped',
      userId: payload.userId,
      documentId: payload.documentId,
      backgroundJobId: payload.backgroundJobId,
      reason,
      skippedAt: new Date().toISOString(),
    });
  }

  private maxAttempts(job: Job<unknown>) {
    return typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
  }

  private publishBestEffort(event: Parameters<InProcessEventBus['publish']>[0]) {
    try {
      this.eventBus.publish(event);
    } catch {
      // Observability failures must not alter durable job state.
    }
  }
}

function isRetryableError(error: unknown) {
  if (!(error instanceof AppError)) return true;
  return error.statusCode >= 500;
}

function isPipelineSnapshotConflict(error: unknown) {
  return (
    error instanceof AppError && error.code === 'KNOWLEDGE_DOCUMENT_PROCESSING'
  );
}

function errorCodeFor(error: unknown, fallback: string) {
  return error instanceof AppError ? error.code : fallback;
}
