import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { BackgroundJobStatus } from '@repo/types/api/background-job';
import type { KnowledgeDocumentProcessResponse } from '@repo/types/api/knowledge';

import { AppError } from '../../common/errors/app-error';
import type { ServerEnv } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { EVENT_BUS } from '../../events/events.module';
import type { InProcessEventBus } from '../../events/event-bus';
import { sanitizeJobError } from '../../jobs/job-error-sanitizer';
import { OutboxService } from '../../outbox/outbox.service';
import { DocumentProcessingService } from '../document-processing.service';
import {
  PROCESS_KNOWLEDGE_DOCUMENT_JOB,
  PROCESS_KNOWLEDGE_DOCUMENT_QUEUE,
  processKnowledgeDocumentJobPayloadSchema,
} from './process-document.job';

type ProcessingDocumentRecord = Prisma.DocumentGetPayload<{
  include: { _count: { select: { chunks: true } } };
}>;

type QueuedClaim = {
  document: ProcessingDocumentRecord;
  job: { id: string; status: string; requestedAt: Date };
};

const documentInclude = {
  _count: { select: { chunks: true } },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentProcessingJobService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)
    private readonly queue: Queue,
    private readonly processingService: DocumentProcessingService,
    private readonly configService: ConfigService<ServerEnv, true>,
    @Inject(EVENT_BUS)
    private readonly eventBus: InProcessEventBus,
    private readonly outboxService: OutboxService,
  ) {}

  async enqueueOrRun(
    userId: string,
    documentId: string,
    input: { force: boolean },
  ): Promise<KnowledgeDocumentProcessResponse> {
    const mode = this.configService.get('KNOWLEDGE_PROCESSING_MODE', {
      infer: true,
    });

    if (mode === 'inline') {
      return this.processingService.processDocument(userId, documentId, input);
    }

    let claim: QueuedClaim;
    try {
      claim = await this.claimAndCreateJob(userId, documentId, input);
    } catch (error) {
      if (isProcessingConflict(error)) {
        const existingJob = await this.findActiveJob(userId, documentId);
        if (existingJob) {
          const document = await this.findProcessingDocument(
            userId,
            documentId,
          );
          return this.withProcessingMetadata(document, existingJob);
        }
      }

      throw error;
    }

    const payload = processKnowledgeDocumentJobPayloadSchema.parse({
      backgroundJobId: claim.job.id,
      userId,
      documentId,
      force: input.force,
      snapshot: {
        storageKey: claim.document.storageKey,
        contentHash: claim.document.contentHash,
      },
      requestedAt: claim.job.requestedAt.toISOString(),
    });

    try {
      await this.queue.add(PROCESS_KNOWLEDGE_DOCUMENT_JOB, payload, {
        jobId: claim.job.id,
        attempts: this.configService.get('KNOWLEDGE_PROCESSING_ATTEMPTS', {
          infer: true,
        }),
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 3000 },
      });
    } catch (error) {
      await this.markEnqueueFailed(claim, error);
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING_QUEUE_FAILED',
        '资料处理任务排队失败，请稍后重试',
        503,
      );
    }

    try {
      await this.outboxService.enqueue({
        type: 'knowledge.document.processing.requested',
        aggregateType: 'KnowledgeDocument',
        aggregateId: claim.document.id,
        idempotencyKey: `knowledge-document-processing-requested:${userId}:${claim.document.id}:${claim.job.id}`,
        payload: {
          userId,
          documentId: claim.document.id,
          backgroundJobId: claim.job.id,
          force: input.force,
        },
      });
    } catch {
      // Queue state is already durable; outbox observer failures must not fail the request.
    }

    try {
      this.eventBus.publish({
        type: 'knowledge.document.processing.requested',
        userId,
        documentId,
        backgroundJobId: claim.job.id,
        contentHash: claim.document.contentHash,
        storageKey: claim.document.storageKey,
        requestedAt: claim.job.requestedAt.toISOString(),
      });
    } catch {
      // Queue state is already durable; observer failures must not fail the request.
    }

    return this.withProcessingMetadata(claim.document, claim.job);
  }

  private async claimAndCreateJob(
    userId: string,
    documentId: string,
    input: { force: boolean },
  ): Promise<QueuedClaim> {
    return this.prisma.$transaction(
      async (transaction) => {
        const document = await transaction.document.findFirst({
          where: { id: documentId, userId },
          include: documentInclude,
        });

        if (!document) {
          throw new AppError('KNOWLEDGE_DOCUMENT_NOT_FOUND', '资料不存在', 404);
        }

        if (document.status === 'PROCESSING') {
          throw new AppError(
            'KNOWLEDGE_DOCUMENT_PROCESSING',
            '资料正在处理中',
            409,
          );
        }

        if (document.status === 'DONE' && !input.force) {
          throw new AppError(
            'KNOWLEDGE_DOCUMENT_ALREADY_DONE',
            '资料已经处理完成',
            409,
          );
        }

        const activeLimit = this.configService.get(
          'KNOWLEDGE_PROCESSING_PER_USER_ACTIVE_LIMIT',
          { infer: true },
        );
        const activeCount = await transaction.backgroundJob.count({
          where: {
            userId,
            resourceType: 'KNOWLEDGE_DOCUMENT',
            status: { in: ['QUEUED', 'ACTIVE'] },
          },
        });
        if (activeCount >= activeLimit) {
          throw new AppError(
            'KNOWLEDGE_DOCUMENT_PROCESSING_LIMIT_REACHED',
            '资料处理任务较多，请稍后再试',
            429,
          );
        }

        const statuses = input.force
          ? (['PENDING', 'FAILED', 'DONE'] as const)
          : (['PENDING', 'FAILED'] as const);
        const result = await transaction.document.updateMany({
          where: {
            id: document.id,
            userId,
            status: { in: [...statuses] },
            storageKey: document.storageKey,
            contentHash: document.contentHash,
          },
          data: { status: 'PROCESSING', errorMessage: null },
        });

        if (result.count !== 1) {
          throw new AppError(
            'KNOWLEDGE_DOCUMENT_PROCESSING',
            '资料正在处理中',
            409,
          );
        }

        const job = await transaction.backgroundJob.create({
          data: {
            userId,
            queueName: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE,
            jobName: PROCESS_KNOWLEDGE_DOCUMENT_JOB,
            status: 'QUEUED',
            resourceType: 'KNOWLEDGE_DOCUMENT',
            resourceId: document.id,
            dedupeKey: `knowledge-process-active:${userId}:${document.id}`,
            maxAttempts: this.configService.get(
              'KNOWLEDGE_PROCESSING_ATTEMPTS',
              {
                infer: true,
              },
            ),
            payloadPreview: {
              documentId: document.id,
              force: input.force,
              contentHash: document.contentHash,
            },
          },
        });

        return {
          document: {
            ...document,
            status: 'PROCESSING',
            errorMessage: null,
          },
          job,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async findActiveJob(userId: string, documentId: string) {
    return this.prisma.backgroundJob.findFirst({
      where: {
        userId,
        resourceType: 'KNOWLEDGE_DOCUMENT',
        resourceId: documentId,
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  private async findProcessingDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
      include: documentInclude,
    });

    if (!document) {
      throw new AppError('KNOWLEDGE_DOCUMENT_NOT_FOUND', '资料不存在', 404);
    }

    return document;
  }

  private async markEnqueueFailed(claim: QueuedClaim, error: unknown) {
    const now = new Date();
    await this.prisma.backgroundJob.updateMany({
      where: {
        id: claim.job.id,
        userId: claim.document.userId,
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: {
        status: 'FAILED',
        errorCode: 'ENQUEUE_FAILED',
        errorMessage: sanitizeJobError(error),
        finishedAt: now,
      },
    });

    await this.prisma.document.updateMany({
      where: {
        id: claim.document.id,
        userId: claim.document.userId,
        status: 'PROCESSING',
        storageKey: claim.document.storageKey,
        contentHash: claim.document.contentHash,
      },
      data: {
        status: 'FAILED',
        errorMessage: '资料处理任务排队失败，请稍后重试',
      },
    });
  }

  private withProcessingMetadata(
    document: ProcessingDocumentRecord,
    job: { id: string; status: string; requestedAt: Date },
  ): KnowledgeDocumentProcessResponse {
    return {
      ...this.processingService.toResponse(document),
      processing: {
        mode: 'queue',
        backgroundJobId: job.id,
        status: toBackgroundJobStatus(job.status),
        queuedAt: job.requestedAt.toISOString(),
      },
    };
  }
}

function isProcessingConflict(error: unknown) {
  return (
    error instanceof AppError && error.code === 'KNOWLEDGE_DOCUMENT_PROCESSING'
  );
}

function toBackgroundJobStatus(status: string): BackgroundJobStatus {
  return status as BackgroundJobStatus;
}
