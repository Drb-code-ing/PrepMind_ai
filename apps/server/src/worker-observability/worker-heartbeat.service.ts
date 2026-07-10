import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import {
  createWorkerHeartbeatKey,
  WORKER_HEARTBEAT_QUEUE_NAMES,
} from './worker-observability.constants';

type RedisLike = {
  set: (
    key: string,
    value: string,
    mode: 'EX',
    ttlSeconds: number,
  ) => Promise<unknown>;
  del: (key: string) => Promise<unknown>;
};

type WorkerHeartbeatOptions = {
  role: ServerEnv['SERVER_ROLE'];
  heartbeatIntervalMs: number;
  heartbeatTtlSeconds: number;
  prefix: string;
  workerId?: string;
  now?: () => Date;
  logger?: Pick<Logger, 'log' | 'warn'>;
};

@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly role: ServerEnv['SERVER_ROLE'];
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTtlSeconds: number;
  private readonly prefix: string;
  private readonly workerId: string;
  private readonly startedAt: string;
  private readonly now: () => Date;
  private readonly logger: Pick<Logger, 'log' | 'warn'>;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)
    private readonly queue: Queue,
    optionsOrConfig: WorkerHeartbeatOptions | ConfigService<ServerEnv, true>,
  ) {
    const options =
      optionsOrConfig instanceof ConfigService
        ? {
            role: optionsOrConfig.get('SERVER_ROLE', { infer: true }),
            heartbeatIntervalMs: optionsOrConfig.get(
              'WORKER_HEARTBEAT_INTERVAL_MS',
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
    this.heartbeatIntervalMs = options.heartbeatIntervalMs;
    this.heartbeatTtlSeconds = options.heartbeatTtlSeconds;
    this.prefix = options.prefix;
    this.workerId = options.workerId ?? `worker-${randomUUID().slice(0, 12)}`;
    this.now = options.now ?? (() => new Date());
    this.startedAt = this.now().toISOString();
    this.logger = options.logger ?? new Logger(WorkerHeartbeatService.name);
  }

  async onModuleInit() {
    if (this.role === 'api') return;

    await this.writeHeartbeat();
    this.timer = setInterval(() => {
      void this.writeHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.role === 'api') return;

    const redis = await this.getRedis();
    await redis.del(createWorkerHeartbeatKey(this.prefix, this.workerId));
  }

  private async writeHeartbeat() {
    try {
      const redis = await this.getRedis();
      await redis.set(
        createWorkerHeartbeatKey(this.prefix, this.workerId),
        JSON.stringify({
          workerId: this.workerId,
          serverRole: this.role === 'both' ? 'both' : 'worker',
          queues: WORKER_HEARTBEAT_QUEUE_NAMES,
          startedAt: this.startedAt,
          lastSeenAt: this.now().toISOString(),
        }),
        'EX',
        this.heartbeatTtlSeconds,
      );
    } catch {
      this.logger.warn('Worker heartbeat write failed.');
    }
  }

  private async getRedis() {
    return (await this.queue.client) as unknown as RedisLike;
  }
}
