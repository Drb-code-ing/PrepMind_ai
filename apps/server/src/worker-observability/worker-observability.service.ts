import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type {
  WorkerHeartbeatResponse,
  WorkerObservabilitySummaryResponse,
} from '@repo/types/api/worker-observability';
import { workerHeartbeatResponseSchema } from '@repo/types/api/worker-observability';

import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxMetricsService } from '../outbox/outbox-metrics.service';
import { DOCUMENT_PROCESSING_QUEUE_NAME } from './worker-observability.constants';

type QueueCounts = WorkerObservabilitySummaryResponse['queue']['counts'];

type RedisLike = {
  keys: (pattern: string) => Promise<string[]>;
  mget: (...keys: string[]) => Promise<Array<string | null>>;
};

type WorkerObservabilityOptions = {
  role: ServerEnv['SERVER_ROLE'];
  knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  heartbeatTtlSeconds: number;
  prefix: string;
  logger?: Pick<Logger, 'warn'>;
};

@Injectable()
export class WorkerObservabilityService {
  private readonly role: ServerEnv['SERVER_ROLE'];
  private readonly knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  private readonly heartbeatTtlSeconds: number;
  private readonly prefix: string;
  private readonly logger: Pick<Logger, 'warn'>;

  constructor(
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)
    private readonly queue: Queue,
    private readonly backgroundJobs: BackgroundJobsService,
    private readonly outbox: OutboxMetricsService,
    optionsOrConfig:
      | WorkerObservabilityOptions
      | ConfigService<ServerEnv, true>,
  ) {
    const options =
      optionsOrConfig instanceof ConfigService
        ? {
            role: optionsOrConfig.get('SERVER_ROLE', { infer: true }),
            knowledgeProcessingMode: optionsOrConfig.get(
              'KNOWLEDGE_PROCESSING_MODE',
              { infer: true },
            ),
            heartbeatTtlSeconds: optionsOrConfig.get(
              'WORKER_HEARTBEAT_TTL_SECONDS',
              { infer: true },
            ),
            prefix: optionsOrConfig.get('BULLMQ_PREFIX', { infer: true }),
          }
        : optionsOrConfig;

    this.role = options.role;
    this.knowledgeProcessingMode = options.knowledgeProcessingMode;
    this.heartbeatTtlSeconds = options.heartbeatTtlSeconds;
    this.prefix = options.prefix;
    this.logger = options.logger ?? new Logger(WorkerObservabilityService.name);
  }

  async getSummary(
    userId: string,
  ): Promise<WorkerObservabilitySummaryResponse> {
    const [counts, isPaused, heartbeats, backgroundJobs, outbox] =
      await Promise.all([
        this.getQueueCounts(),
        this.queue.isPaused(),
        this.getHeartbeats(),
        this.backgroundJobs.getSummary(userId),
        this.outbox.getSummary(),
      ]);

    const hasBacklog =
      counts.waiting + counts.active + counts.delayed + counts.paused > 0;
    const queuePaused = isPaused || counts.paused > 0;
    const hasWorkerHeartbeat = heartbeats.length > 0;
    const queueModeWithoutWorker =
      this.knowledgeProcessingMode === 'queue' && !hasWorkerHeartbeat;
    const queueBacklogWithoutWorker = hasBacklog && !hasWorkerHeartbeat;
    const hasOutboxBacklog = outbox.hasBacklog;
    const hasDeadOutboxEvents = outbox.counts.dead > 0;
    const hasRecentFailures =
      backgroundJobs.failedCount > 0 ||
      counts.failed > 0 ||
      hasDeadOutboxEvents;
    const latestHeartbeat = sortHeartbeats(heartbeats)[0] ?? null;
    const status = resolveStatus({
      queueBacklogWithoutWorker,
      queuePaused,
      hasRecentFailures,
      hasDeadOutboxEvents,
      knowledgeProcessingMode: this.knowledgeProcessingMode,
      hasWorkerHeartbeat,
    });

    return {
      server: {
        role: this.role,
        knowledgeProcessingMode: this.knowledgeProcessingMode,
      },
      queue: {
        name: DOCUMENT_PROCESSING_QUEUE_NAME,
        counts,
        isPaused,
        hasBacklog,
      },
      workers: {
        heartbeatTtlSeconds: this.heartbeatTtlSeconds,
        onlineCount: heartbeats.length,
        latestHeartbeat,
      },
      backgroundJobs,
      outbox,
      signals: {
        status,
        hasWorkerHeartbeat,
        queueModeWithoutWorker,
        queueBacklogWithoutWorker,
        hasRecentFailures,
        hasOutboxBacklog,
        hasDeadOutboxEvents,
        message: getSignalMessage(status, this.knowledgeProcessingMode),
      },
    };
  }

  private async getQueueCounts(): Promise<QueueCounts> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
      'paused',
    );

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      paused: counts.paused ?? 0,
    };
  }

  private async getHeartbeats(): Promise<WorkerHeartbeatResponse[]> {
    try {
      const redis = (await this.queue.client) as unknown as RedisLike;
      const keys = await redis.keys(`${this.prefix}:worker-heartbeat:*`);
      if (!keys.length) return [];

      const values = await redis.mget(...keys);
      return values
        .map((value) => parseHeartbeat(value))
        .filter(
          (heartbeat): heartbeat is WorkerHeartbeatResponse => !!heartbeat,
        );
    } catch (error) {
      this.logger.warn(
        `Worker heartbeat read failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    }
  }
}

function resolveStatus(input: {
  queueBacklogWithoutWorker: boolean;
  queuePaused: boolean;
  hasRecentFailures: boolean;
  hasDeadOutboxEvents: boolean;
  knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  hasWorkerHeartbeat: boolean;
}): WorkerObservabilitySummaryResponse['signals']['status'] {
  if (input.queueBacklogWithoutWorker) return 'attention';
  if (input.queuePaused) return 'degraded';
  if (input.hasDeadOutboxEvents) return 'degraded';
  if (input.hasRecentFailures) return 'degraded';
  if (input.knowledgeProcessingMode === 'queue' && input.hasWorkerHeartbeat) {
    return 'healthy';
  }
  return 'idle';
}

function getSignalMessage(
  status: WorkerObservabilitySummaryResponse['signals']['status'],
  mode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'],
) {
  if (status === 'attention') {
    return '已有待处理任务，但暂未检测到 worker 在线。';
  }
  if (status === 'degraded') {
    return '最近有后台任务失败，请查看任务详情。';
  }
  if (status === 'healthy') {
    return '后台处理正常，worker 最近在线。';
  }
  if (mode === 'inline') {
    return '当前为同步处理模式，队列 worker 不参与处理。';
  }
  return '后台处理空闲。';
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

function sortHeartbeats(heartbeats: WorkerHeartbeatResponse[]) {
  return [...heartbeats].sort(
    (left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt),
  );
}
