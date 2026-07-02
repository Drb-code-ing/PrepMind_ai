import { Injectable, NotFoundException } from '@nestjs/common';
import { BackgroundJobStatus as PrismaBackgroundJobStatus, Prisma } from '@prisma/client';
import type {
  BackgroundJobListQuery,
  BackgroundJobListResponse,
  BackgroundJobResourceType,
  BackgroundJobResponse,
  BackgroundJobSummaryResponse,
} from '@repo/types/api/background-job';

import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

const backgroundJobSelect = {
  id: true,
  queueName: true,
  jobName: true,
  status: true,
  resourceType: true,
  resourceId: true,
  attempt: true,
  maxAttempts: true,
  progress: true,
  payloadPreview: true,
  resultSummary: true,
  errorCode: true,
  errorMessage: true,
  requestedAt: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BackgroundJobSelect;

type BackgroundJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof backgroundJobSelect;
}>;

type JsonRecord = Prisma.InputJsonObject;

@Injectable()
export class BackgroundJobsService {
  constructor(private readonly prisma: PrismaService) {}

  async createQueuedJob(input: {
    userId: string;
    queueName: string;
    jobName: string;
    resourceType: BackgroundJobResourceType;
    resourceId: string;
    idempotencyKey?: string | null;
    dedupeKey?: string | null;
    maxAttempts: number;
    payloadHash?: string | null;
    payloadPreview?: JsonRecord | null;
  }): Promise<BackgroundJobResponse> {
    const job = await this.prisma.backgroundJob.create({
      data: {
        userId: input.userId,
        queueName: input.queueName,
        jobName: input.jobName,
        status: PrismaBackgroundJobStatus.QUEUED,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        idempotencyKey: input.idempotencyKey ?? null,
        dedupeKey: input.dedupeKey ?? null,
        maxAttempts: input.maxAttempts,
        payloadHash: input.payloadHash ?? null,
        payloadPreview: input.payloadPreview ?? Prisma.JsonNull,
      },
    });

    return toResponse(job);
  }

  async findActiveForResource(
    userId: string,
    resourceType: BackgroundJobResourceType,
    resourceId: string,
  ): Promise<BackgroundJobResponse | null> {
    const job = await this.prisma.backgroundJob.findFirst({
      where: {
        userId,
        resourceType,
        resourceId,
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: backgroundJobSelect,
    });

    return job ? toResponse(job) : null;
  }

  async markActive(input: {
    id: string;
    userId: string;
    resourceType: BackgroundJobResourceType;
    resourceId: string;
    attempt: number;
  }): Promise<BackgroundJobResponse | null> {
    const now = new Date();
    const result = await this.prisma.backgroundJob.updateMany({
      where: {
        id: input.id,
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: {
        status: PrismaBackgroundJobStatus.ACTIVE,
        attempt: input.attempt,
        startedAt: now,
        progress: 0,
        updatedAt: now,
      },
    });

    if (result.count !== 1) return null;
    return this.findById(input.userId, input.id);
  }

  async markSucceeded(input: {
    id: string;
    userId: string;
    resultSummary?: JsonRecord | null;
  }): Promise<BackgroundJobResponse | null> {
    return this.finishJob({
      id: input.id,
      userId: input.userId,
      status: PrismaBackgroundJobStatus.SUCCEEDED,
      progress: 100,
      resultSummary: input.resultSummary ?? null,
      errorCode: null,
      errorMessage: null,
    });
  }

  async markRetryableFailure(input: {
    id: string;
    userId: string;
    errorCode: string;
    error: unknown;
    attempt?: number;
  }): Promise<BackgroundJobResponse | null> {
    const now = new Date();
    const result = await this.prisma.backgroundJob.updateMany({
      where: {
        id: input.id,
        userId: input.userId,
        status: PrismaBackgroundJobStatus.ACTIVE,
      },
      data: {
        status: PrismaBackgroundJobStatus.QUEUED,
        attempt: input.attempt,
        errorCode: input.errorCode,
        errorMessage: sanitizeJobError(input.error),
        updatedAt: now,
      },
    });

    if (result.count !== 1) return null;
    return this.findById(input.userId, input.id);
  }

  async markFailed(input: {
    id: string;
    userId: string;
    errorCode: string;
    error: unknown;
  }): Promise<BackgroundJobResponse | null> {
    return this.finishJob({
      id: input.id,
      userId: input.userId,
      status: PrismaBackgroundJobStatus.FAILED,
      errorCode: input.errorCode,
      errorMessage: sanitizeJobError(input.error),
    });
  }

  async markStaleSkipped(input: {
    id: string;
    userId: string;
    reason: string;
  }): Promise<BackgroundJobResponse | null> {
    return this.finishJob({
      id: input.id,
      userId: input.userId,
      status: PrismaBackgroundJobStatus.STALE_SKIPPED,
      errorCode: input.reason,
      errorMessage: input.reason,
    });
  }

  async getById(userId: string, id: string): Promise<BackgroundJobResponse> {
    const job = await this.findById(userId, id);
    if (!job) {
      throw new NotFoundException('Background job not found');
    }

    return job;
  }

  async list(
    userId: string,
    query: BackgroundJobListQuery,
  ): Promise<BackgroundJobListResponse> {
    const where: Prisma.BackgroundJobWhereInput = { userId };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.status) where.status = query.status;

    const jobs = await this.prisma.backgroundJob.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: backgroundJobSelect,
    });

    return {
      items: jobs.map(toResponse),
    };
  }

  async getSummary(userId: string): Promise<BackgroundJobSummaryResponse> {
    const jobs = await this.prisma.backgroundJob.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: backgroundJobSelect,
    });
    const items = jobs.map(toResponse);

    return {
      activeCount: items.filter((job) => job.status === 'QUEUED' || job.status === 'ACTIVE')
        .length,
      failedCount: items.filter((job) => job.status === 'FAILED').length,
      staleSkippedCount: items.filter((job) => job.status === 'STALE_SKIPPED').length,
      succeededCount: items.filter((job) => job.status === 'SUCCEEDED').length,
      totalRecentCount: items.length,
      latestJob: items[0] ?? null,
    };
  }

  private async finishJob(input: {
    id: string;
    userId: string;
    status: PrismaBackgroundJobStatus;
    progress?: number;
    resultSummary?: JsonRecord | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) {
    const now = new Date();
    const result = await this.prisma.backgroundJob.updateMany({
      where: {
        id: input.id,
        userId: input.userId,
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data: {
        status: input.status,
        progress: input.progress,
        resultSummary:
          input.resultSummary === undefined
            ? undefined
            : input.resultSummary ?? Prisma.JsonNull,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        finishedAt: now,
        updatedAt: now,
      },
    });

    if (result.count !== 1) return null;
    return this.findById(input.userId, input.id);
  }

  private async findById(userId: string, id: string) {
    const job = await this.prisma.backgroundJob.findFirst({
      where: { id, userId },
      select: backgroundJobSelect,
    });

    return job ? toResponse(job) : null;
  }
}

function toResponse(job: BackgroundJobRecord): BackgroundJobResponse {
  return {
    id: job.id,
    queueName: job.queueName,
    jobName: job.jobName,
    status: job.status,
    resourceType: job.resourceType as BackgroundJobResourceType,
    resourceId: job.resourceId,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    progress: job.progress,
    payloadPreview: toJsonRecord(job.payloadPreview),
    resultSummary: toJsonRecord(job.resultSummary),
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    requestedAt: job.requestedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function toJsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
