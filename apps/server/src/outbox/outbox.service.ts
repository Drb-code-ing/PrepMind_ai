import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type JsonRecord = Prisma.InputJsonObject;

export type EnqueueOutboxEventInput = {
  type: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  idempotencyKey?: string | null;
  payload: JsonRecord;
  payloadHash?: string | null;
  maxAttempts?: number;
  nextRunAt?: Date;
};

export type ClaimOutboxEventsInput = {
  workerId: string;
  limit: number;
  now?: Date;
  lockTimeoutMs?: number;
};

export type MarkOutboxFailedInput = {
  id: string;
  workerId: string;
  errorCode: string;
  error: unknown;
  now?: Date;
};

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueOutboxEventInput) {
    try {
      return await this.createWithClient(this.prisma, input);
    } catch (error) {
      if (isUniqueConstraintError(error) && input.idempotencyKey) {
        const existing = await this.prisma.outboxEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing) return existing;
      }

      throw error;
    }
  }

  async enqueueInTransaction(
    transaction: Prisma.TransactionClient,
    input: EnqueueOutboxEventInput,
  ) {
    return this.createWithClient(transaction, input);
  }

  async claimPending(input: ClaimOutboxEventsInput) {
    const now = input.now ?? new Date();
    const lockExpiredBefore = new Date(
      now.getTime() - (input.lockTimeoutMs ?? 5 * 60_000),
    );
    const claimableWhere = {
      OR: [
        { status: 'PENDING' as const, nextRunAt: { lte: now } },
        {
          status: 'PROCESSING' as const,
          lockedAt: { lt: lockExpiredBefore },
        },
      ],
    };
    const candidates = await this.prisma.outboxEvent.findMany({
      where: claimableWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: input.limit,
    });

    const claimedIds: string[] = [];
    for (const event of candidates) {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          id: event.id,
          OR: claimableWhere.OR,
        },
        data: {
          status: 'PROCESSING',
          lockedBy: input.workerId,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (result.count === 1) {
        claimedIds.push(event.id);
      }
    }

    if (claimedIds.length === 0) return [];
    return this.prisma.outboxEvent.findMany({
      where: { id: { in: claimedIds } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async markSucceeded(id: string, workerId: string) {
    const now = new Date();
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, status: 'PROCESSING', lockedBy: workerId },
      data: {
        status: 'SUCCEEDED',
        lockedAt: null,
        lockedBy: null,
        processedAt: now,
        lastErrorCode: null,
        lastError: null,
      },
    });

    if (result.count !== 1) return null;
    return this.findById(id);
  }

  async markFailedOrRetry(input: MarkOutboxFailedInput) {
    const now = input.now ?? new Date();
    const event = await this.prisma.outboxEvent.findFirst({
      where: {
        id: input.id,
        status: 'PROCESSING',
        lockedBy: input.workerId,
      },
    });

    if (!event) return null;

    const exhausted = event.attempts >= event.maxAttempts;
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id: input.id, status: 'PROCESSING', lockedBy: input.workerId },
      data: exhausted
        ? {
            status: 'DEAD',
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: input.errorCode,
            lastError: sanitizeJobError(input.error),
            processedAt: now,
          }
        : {
            status: 'PENDING',
            lockedAt: null,
            lockedBy: null,
            lastErrorCode: input.errorCode,
            lastError: sanitizeJobError(input.error),
            nextRunAt: new Date(now.getTime() + retryDelayMs(event.attempts)),
          },
    });

    if (result.count !== 1) return null;
    return this.findById(input.id);
  }

  private findById(id: string) {
    return this.prisma.outboxEvent.findFirst({ where: { id } });
  }

  private createWithClient(
    client: Prisma.TransactionClient | PrismaService,
    input: EnqueueOutboxEventInput,
  ) {
    return client.outboxEvent.create({
      data: {
        type: input.type,
        status: 'PENDING',
        aggregateType: input.aggregateType ?? null,
        aggregateId: input.aggregateId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        payload: input.payload,
        payloadHash: input.payloadHash ?? null,
        maxAttempts: input.maxAttempts ?? 5,
        nextRunAt: input.nextRunAt,
      },
    });
  }
}

function retryDelayMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
