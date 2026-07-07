import { HttpStatus, Injectable } from '@nestjs/common';
import type { OutboxEventStatus, Prisma } from '@prisma/client';
import type {
  OutboxEventDetailResponse,
  OutboxEventListQuery,
  OutboxEventListResponse,
} from '@repo/types/api/outbox';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type OutboxOpsRow = {
  id: string;
  type: string;
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  processedAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload: Prisma.JsonValue;
  payloadHash: string | null;
};

const outboxOpsSelect = {
  id: true,
  type: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  nextRunAt: true,
  lockedAt: true,
  lockedBy: true,
  processedAt: true,
  lastErrorCode: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  payload: true,
  payloadHash: true,
  aggregateId: false,
} satisfies Prisma.OutboxEventSelect;

@Injectable()
export class OutboxOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: OutboxEventListQuery): Promise<OutboxEventListResponse> {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.outboxEvent.findMany({
      where: await this.buildListWhere(query),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: outboxOpsSelect,
    });

    const visibleRows = rows.slice(0, limit);

    return {
      items: visibleRows.map((row) => this.toListItem(row)),
      nextCursor:
        rows.length > limit
          ? (visibleRows[visibleRows.length - 1]?.id ?? null)
          : null,
    };
  }

  async getDetail(id: string): Promise<OutboxEventDetailResponse> {
    const row = await this.prisma.outboxEvent.findFirst({
      where: { id },
      select: outboxOpsSelect,
    });

    if (!row) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_FOUND',
        'Outbox event not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toDetail(row);
  }

  async requeue(
    id: string,
    now = new Date(),
  ): Promise<OutboxEventDetailResponse> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, status: { in: ['FAILED', 'DEAD'] } },
      data: {
        status: 'PENDING',
        attempts: 0,
        lockedAt: null,
        lockedBy: null,
        processedAt: null,
        nextRunAt: now,
      },
    });

    if (result.count === 1) {
      return this.getDetail(id);
    }

    const existing = await this.prisma.outboxEvent.findFirst({
      where: { id },
      select: outboxOpsSelect,
    });

    if (!existing) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_FOUND',
        'Outbox event not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!isRequeueable(existing.status)) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_REQUEUEABLE',
        'Only failed or dead outbox events can be requeued',
        HttpStatus.CONFLICT,
      );
    }

    throw new AppError(
      'OUTBOX_EVENT_REQUEUE_CONFLICT',
      'Outbox event changed while requeueing',
      HttpStatus.CONFLICT,
    );
  }

  private async buildListWhere(
    query: OutboxEventListQuery,
  ): Promise<Prisma.OutboxEventWhereInput> {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(await this.buildCursorWhere(query.cursor)),
    };
  }

  private async buildCursorWhere(
    cursor?: string,
  ): Promise<Prisma.OutboxEventWhereInput> {
    if (!cursor) {
      return {};
    }

    const cursorRow = await this.prisma.outboxEvent.findFirst({
      where: { id: cursor },
      select: { id: true, updatedAt: true },
    });

    if (!cursorRow) {
      return {
        AND: [{ id: cursor }, { id: { not: cursor } }],
      };
    }

    return {
      OR: [
        { updatedAt: { lt: cursorRow.updatedAt } },
        { updatedAt: cursorRow.updatedAt, id: { lt: cursorRow.id } },
      ],
    };
  }

  private toListItem(row: OutboxOpsRow) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextRunAt: toIso(row.nextRunAt),
      lockedAt: toIso(row.lockedAt),
      processedAt: toIso(row.processedAt),
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      hasPayload: row.payload !== null && row.payload !== undefined,
      hasLastError: Boolean(row.lastError),
      canRequeue: isRequeueable(row.status),
    };
  }

  private toDetail(row: OutboxOpsRow): OutboxEventDetailResponse {
    return {
      ...this.toListItem(row),
      lockedBy: row.lockedBy,
      lastErrorPreview: row.lastError
        ? sanitizeJobError(row.lastError).slice(0, 300)
        : null,
      payloadHash: row.payloadHash,
    };
  }
}

function isRequeueable(status: OutboxEventStatus) {
  return status === 'FAILED' || status === 'DEAD';
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}
