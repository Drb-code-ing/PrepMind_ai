import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { WorkerHeartbeatResponse } from '@repo/types/api/worker-observability';
import { workerHeartbeatResponseSchema } from '@repo/types/api/worker-observability';
import type {
  WorkerReadinessCheckStatus,
  WorkerReadinessResponse,
} from '@repo/types/api/worker-readiness';

import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxMetricsService } from '../outbox/outbox-metrics.service';
import { PrismaService } from '../database/prisma.service';
import {
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_STATE,
} from '../operator-audit-exports/operator-audit-export.constants';

type QueueCounts = WorkerReadinessResponse['checks']['queue']['counts'];

type RedisLike = {
  keys: (pattern: string) => Promise<string[]>;
  mget: (...keys: string[]) => Promise<Array<string | null>>;
};

type WorkerReadinessOptions = {
  role: ServerEnv['SERVER_ROLE'];
  knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  prefix: string;
  logger?: Pick<Logger, 'warn'>;
  exportEnabled: boolean;
  maintenanceEnabled: boolean;
};

type QueueSnapshot =
  | {
      ok: true;
      counts: QueueCounts;
      isPaused: boolean;
    }
  | {
      ok: false;
      counts: QueueCounts;
      isPaused: boolean;
    };

type HeartbeatSnapshot =
  | {
      ok: true;
      heartbeats: WorkerHeartbeatResponse[];
    }
  | {
      ok: false;
      heartbeats: [];
    };

@Injectable()
export class WorkerReadinessService {
  private readonly role: ServerEnv['SERVER_ROLE'];
  private readonly knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  private readonly prefix: string;
  private readonly logger: Pick<Logger, 'warn'>;
  private readonly exportEnabled: boolean;
  private readonly maintenanceEnabled: boolean;

  constructor(
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)
    private readonly queue: Queue,
    @InjectQueue(OPERATOR_AUDIT_EXPORT_QUEUE)
    private readonly auditExportQueue: Queue,
    @InjectQueue(OPERATOR_AUDIT_MAINTENANCE_QUEUE)
    private readonly auditMaintenanceQueue: Queue,
    private readonly outbox: OutboxMetricsService,
    private readonly prisma: PrismaService,
    optionsOrConfig: WorkerReadinessOptions | ConfigService<ServerEnv, true>,
  ) {
    const options =
      optionsOrConfig instanceof ConfigService
        ? {
            role: optionsOrConfig.get('SERVER_ROLE', { infer: true }),
            knowledgeProcessingMode: optionsOrConfig.get(
              'KNOWLEDGE_PROCESSING_MODE',
              { infer: true },
            ),
            prefix: optionsOrConfig.get('BULLMQ_PREFIX', { infer: true }),
            exportEnabled: optionsOrConfig.get(
              'OPERATOR_AUDIT_EXPORT_ENABLED',
              { infer: true },
            ),
            maintenanceEnabled: optionsOrConfig.get(
              'OPERATOR_AUDIT_MAINTENANCE_ENABLED',
              { infer: true },
            ),
          }
        : optionsOrConfig;

    this.role = options.role;
    this.knowledgeProcessingMode = options.knowledgeProcessingMode;
    this.prefix = options.prefix;
    this.exportEnabled = options.exportEnabled;
    this.maintenanceEnabled = options.maintenanceEnabled;
    this.logger = options.logger ?? new Logger(WorkerReadinessService.name);
  }

  async getReadiness(now = new Date()): Promise<WorkerReadinessResponse> {
    const [
      queueSnapshot,
      auditExportSnapshot,
      auditMaintenanceSnapshot,
      heartbeatSnapshot,
      outboxSnapshot,
      maintenanceCheck,
    ] = await Promise.all([
      this.getQueueSnapshot(this.queue, 'knowledge'),
      this.getQueueSnapshot(this.auditExportQueue, 'audit export'),
      this.getQueueSnapshot(this.auditMaintenanceQueue, 'audit maintenance'),
      this.getHeartbeatSnapshot(),
      this.getOutboxSnapshot(now),
      this.getAuditMaintenanceCheck(now),
    ]);

    const hasBacklog = hasQueueBacklog(queueSnapshot.counts);
    const queuePaused =
      queueSnapshot.isPaused || queueSnapshot.counts.paused > 0;
    const redisCheck = this.resolveRedisCheck(queueSnapshot, heartbeatSnapshot);
    const queueCheck = this.resolveQueueCheck(
      queueSnapshot,
      queuePaused,
      hasBacklog,
    );
    const workersCheck = this.resolveWorkersCheck(
      heartbeatSnapshot,
      hasBacklog,
    );
    const outboxCheck = outboxSnapshot.check;
    const auditExportCheck = this.toAuditQueueCheck(
      auditExportSnapshot,
      this.exportEnabled,
      'Audit export',
    );
    const auditMaintenanceQueueCheck = this.toAuditQueueCheck(
      auditMaintenanceSnapshot,
      this.maintenanceEnabled,
      'Audit maintenance',
    );
    const checks = {
      redis: redisCheck,
      queue: {
        ...queueCheck,
        counts: queueSnapshot.counts,
        isPaused: queuePaused,
        hasBacklog,
      },
      auditExportQueue: auditExportCheck,
      auditMaintenanceQueue: auditMaintenanceQueueCheck,
      auditMaintenance: maintenanceCheck,
      workers: {
        ...workersCheck,
        onlineCount: heartbeatSnapshot.heartbeats.length,
        latestHeartbeatAt: getLatestHeartbeatAt(heartbeatSnapshot.heartbeats),
      },
      outbox: outboxCheck,
    };
    const issues = [
      checks.redis,
      checks.queue,
      checks.workers,
      checks.outbox,
      ...(this.exportEnabled ? [checks.auditExportQueue] : []),
      ...(this.maintenanceEnabled
        ? [checks.auditMaintenanceQueue, checks.auditMaintenance]
        : []),
    ]
      .filter((check) => check.status !== 'pass')
      .map((check) => check.message);
    const status = resolveOverallStatus([
      checks.redis.status,
      checks.queue.status,
      checks.workers.status,
      checks.outbox.status,
      ...(this.exportEnabled ? [checks.auditExportQueue.status] : []),
      ...(this.maintenanceEnabled
        ? [checks.auditMaintenanceQueue.status, checks.auditMaintenance.status]
        : []),
    ]);

    return {
      ready: status === 'ready',
      status,
      checkedAt: now.toISOString(),
      server: {
        role: this.role,
        knowledgeProcessingMode: this.knowledgeProcessingMode,
      },
      checks,
      issues,
    };
  }

  private async getQueueSnapshot(
    queue: Queue,
    label: string,
  ): Promise<QueueSnapshot> {
    try {
      const [counts, isPaused] = await Promise.all([
        queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
        queue.isPaused(),
      ]);

      return {
        ok: true,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
        isPaused,
      };
    } catch {
      this.logger.warn(`Worker readiness ${label} queue check failed.`);
      return { ok: false, counts: emptyQueueCounts(), isPaused: false };
    }
  }

  private toAuditQueueCheck(
    snapshot: QueueSnapshot,
    enabled: boolean,
    label: string,
  ): WorkerReadinessResponse['checks']['auditExportQueue'] {
    const isPaused = snapshot.isPaused || snapshot.counts.paused > 0;
    const hasBacklog = hasQueueBacklog(snapshot.counts);
    let status: WorkerReadinessCheckStatus = 'pass';
    let message = `${label} queue is readable.`;
    if (!snapshot.ok) {
      status = enabled ? 'fail' : 'warn';
      message = `${label} queue is not readable.`;
    } else if (isPaused) {
      status = enabled ? 'fail' : 'warn';
      message = `${label} queue is paused.`;
    } else if (snapshot.counts.failed > 0) {
      status = 'warn';
      message = `${label} queue has failed jobs.`;
    }
    return { status, message, counts: snapshot.counts, isPaused, hasBacklog };
  }

  private async getAuditMaintenanceCheck(
    now: Date,
  ): Promise<WorkerReadinessResponse['checks']['auditMaintenance']> {
    if (!this.maintenanceEnabled) {
      return {
        status: 'warn',
        message: 'Audit maintenance is disabled.',
        enabled: false,
        lastSucceededAt: null,
        overdue: false,
      };
    }
    try {
      const state = await this.prisma.operatorAuditMaintenanceState.findUnique({
        where: { name: OPERATOR_AUDIT_MAINTENANCE_STATE },
        select: { lastSucceededAt: true },
      });
      const lastSucceededAt = state?.lastSucceededAt ?? null;
      const overdue =
        !lastSucceededAt ||
        now.getTime() - lastSucceededAt.getTime() > 2 * 3_600_000;
      return {
        status: overdue ? 'fail' : 'pass',
        message: overdue
          ? 'Audit maintenance has not succeeded within two hours.'
          : 'Audit maintenance is current.',
        enabled: true,
        lastSucceededAt: lastSucceededAt?.toISOString() ?? null,
        overdue,
      };
    } catch {
      this.logger.warn(
        'Worker readiness audit maintenance state check failed.',
      );
      return {
        status: 'fail',
        message: 'Audit maintenance state is not readable.',
        enabled: true,
        lastSucceededAt: null,
        overdue: true,
      };
    }
  }

  private async getHeartbeatSnapshot(): Promise<HeartbeatSnapshot> {
    try {
      const redis = (await this.queue.client) as unknown as RedisLike;
      const keys = await redis.keys(`${this.prefix}:worker-heartbeat:*`);
      if (!keys.length) {
        return { ok: true, heartbeats: [] };
      }

      const values = await redis.mget(...keys);
      return {
        ok: true,
        heartbeats: values
          .map((value) => parseHeartbeat(value))
          .filter(
            (heartbeat): heartbeat is WorkerHeartbeatResponse => !!heartbeat,
          ),
      };
    } catch {
      this.logger.warn('Worker readiness heartbeat check failed.');
      return { ok: false, heartbeats: [] };
    }
  }

  private async getOutboxSnapshot(now: Date): Promise<{
    check: WorkerReadinessResponse['checks']['outbox'];
  }> {
    try {
      const summary = await this.outbox.getSummary(now);
      if (summary.counts.dead > 0) {
        return {
          check: {
            status: 'fail',
            message: 'Dead outbox events require operator attention.',
            deadCount: summary.counts.dead,
            hasBacklog: summary.hasBacklog,
            oldestPendingAgeMs: summary.oldestPendingAgeMs,
          },
        };
      }

      if (summary.hasBacklog) {
        return {
          check: {
            status: 'warn',
            message: 'Outbox has pending or processing events.',
            deadCount: summary.counts.dead,
            hasBacklog: true,
            oldestPendingAgeMs: summary.oldestPendingAgeMs,
          },
        };
      }

      return {
        check: {
          status: 'pass',
          message: 'No dead outbox events.',
          deadCount: 0,
          hasBacklog: false,
          oldestPendingAgeMs: summary.oldestPendingAgeMs,
        },
      };
    } catch {
      this.logger.warn('Worker readiness outbox check failed.');
      return {
        check: {
          status: 'fail',
          message: 'Outbox summary is not readable.',
          deadCount: 0,
          hasBacklog: false,
          oldestPendingAgeMs: null,
        },
      };
    }
  }

  private resolveRedisCheck(
    queueSnapshot: QueueSnapshot,
    heartbeatSnapshot: HeartbeatSnapshot,
  ): WorkerReadinessResponse['checks']['redis'] {
    if (queueSnapshot.ok && heartbeatSnapshot.ok) {
      return { status: 'pass', message: 'Redis is reachable.' };
    }

    return {
      status: this.knowledgeProcessingMode === 'queue' ? 'fail' : 'warn',
      message: 'Redis or BullMQ check failed.',
    };
  }

  private resolveQueueCheck(
    queueSnapshot: QueueSnapshot,
    queuePaused: boolean,
    hasBacklog: boolean,
  ): Pick<WorkerReadinessResponse['checks']['queue'], 'status' | 'message'> {
    if (!queueSnapshot.ok) {
      return {
        status: this.knowledgeProcessingMode === 'queue' ? 'fail' : 'warn',
        message: 'Queue is not readable.',
      };
    }

    if (queuePaused) {
      return {
        status: this.knowledgeProcessingMode === 'queue' ? 'fail' : 'warn',
        message: 'Queue is paused.',
      };
    }

    if (queueSnapshot.counts.failed > 0) {
      return { status: 'warn', message: 'Queue has failed jobs.' };
    }

    if (this.knowledgeProcessingMode === 'inline' && hasBacklog) {
      return {
        status: 'warn',
        message: 'Inline mode has queued jobs that may require cleanup.',
      };
    }

    return { status: 'pass', message: 'Queue is readable.' };
  }

  private resolveWorkersCheck(
    heartbeatSnapshot: HeartbeatSnapshot,
    hasBacklog: boolean,
  ): Pick<WorkerReadinessResponse['checks']['workers'], 'status' | 'message'> {
    if (!heartbeatSnapshot.ok) {
      return {
        status: this.knowledgeProcessingMode === 'queue' ? 'fail' : 'warn',
        message: 'Worker heartbeat check failed.',
      };
    }

    if (this.knowledgeProcessingMode === 'inline') {
      return {
        status: 'pass',
        message: 'Inline mode does not require worker heartbeat.',
      };
    }

    if (heartbeatSnapshot.heartbeats.length > 0) {
      return {
        status: 'pass',
        message: 'At least one worker heartbeat is online.',
      };
    }

    if (hasBacklog) {
      return {
        status: 'fail',
        message: 'Queue backlog exists but no worker heartbeat is online.',
      };
    }

    return {
      status: 'warn',
      message: 'Queue mode has no worker heartbeat online.',
    };
  }
}

function resolveOverallStatus(
  statuses: WorkerReadinessCheckStatus[],
): WorkerReadinessResponse['status'] {
  if (statuses.includes('fail')) return 'not_ready';
  if (statuses.includes('warn')) return 'degraded';
  return 'ready';
}

function parseHeartbeat(value: string | null): WorkerHeartbeatResponse | null {
  if (!value) return null;

  try {
    const parsed = workerHeartbeatResponseSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function getLatestHeartbeatAt(heartbeats: WorkerHeartbeatResponse[]) {
  const latest = [...heartbeats].sort(
    (left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt),
  )[0];

  return latest?.lastSeenAt ?? null;
}

function hasQueueBacklog(counts: QueueCounts) {
  return counts.waiting + counts.active + counts.delayed + counts.paused > 0;
}

function emptyQueueCounts(): QueueCounts {
  return {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: 0,
  };
}
