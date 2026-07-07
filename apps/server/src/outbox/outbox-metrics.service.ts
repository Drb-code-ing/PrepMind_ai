import { Injectable } from '@nestjs/common';
import type { OutboxEventStatus } from '@prisma/client';
import type { WorkerObservabilityOutboxSummary } from '@repo/types/api/worker-observability';

import { PrismaService } from '../database/prisma.service';

const outboxStatuses = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'DEAD',
] as const satisfies OutboxEventStatus[];

@Injectable()
export class OutboxMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    now = new Date(),
  ): Promise<WorkerObservabilityOutboxSummary> {
    const [groupedCounts, oldestPending, recentErrors] = await Promise.all([
      this.prisma.outboxEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, createdAt: true },
      }),
      this.prisma.outboxEvent.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING', 'FAILED', 'DEAD'] },
          OR: [{ lastErrorCode: { not: null } }, { lastError: { not: null } }],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          lastErrorCode: true,
          attempts: true,
          maxAttempts: true,
          updatedAt: true,
        },
      }),
    ]);

    const counts = createEmptyCounts();
    for (const row of groupedCounts) {
      counts[toCountKey(row.status)] = row._count._all;
    }
    counts.total = outboxStatuses.reduce(
      (total, status) => total + counts[toCountKey(status)],
      0,
    );

    return {
      counts,
      hasBacklog: counts.pending + counts.processing > 0,
      oldestPendingAgeMs: oldestPending
        ? Math.max(0, now.getTime() - oldestPending.createdAt.getTime())
        : null,
      recentErrors: recentErrors.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        lastErrorCode: event.lastErrorCode,
        attempts: event.attempts,
        maxAttempts: event.maxAttempts,
        updatedAt: event.updatedAt.toISOString(),
      })),
    };
  }
}

function createEmptyCounts(): WorkerObservabilityOutboxSummary['counts'] {
  return {
    pending: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    total: 0,
  };
}

function toCountKey(
  status: OutboxEventStatus,
): keyof Omit<WorkerObservabilityOutboxSummary['counts'], 'total'> {
  return status.toLowerCase() as keyof Omit<
    WorkerObservabilityOutboxSummary['counts'],
    'total'
  >;
}
