import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import type { ServerEnv } from '../config/env';
import { OutboxDispatcherService } from './outbox.dispatcher';

type OutboxDispatcherRunnerOptions = {
  role: ServerEnv['SERVER_ROLE'];
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
  lockTimeoutMs: number;
  workerId?: string;
  now?: () => Date;
  logger?: Pick<Logger, 'log' | 'warn' | 'debug'>;
};

@Injectable()
export class OutboxDispatcherRunnerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly role: ServerEnv['SERVER_ROLE'];
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly lockTimeoutMs: number;
  private readonly workerId: string;
  private readonly now: () => Date;
  private readonly logger: Pick<Logger, 'log' | 'warn' | 'debug'>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly dispatcher: OutboxDispatcherService,
    optionsOrConfig:
      | OutboxDispatcherRunnerOptions
      | ConfigService<ServerEnv, true>,
  ) {
    const options =
      optionsOrConfig instanceof ConfigService
        ? {
            role: optionsOrConfig.get('SERVER_ROLE', { infer: true }),
            enabled: optionsOrConfig.get('OUTBOX_DISPATCHER_ENABLED', {
              infer: true,
            }),
            intervalMs: optionsOrConfig.get('OUTBOX_DISPATCHER_INTERVAL_MS', {
              infer: true,
            }),
            batchSize: optionsOrConfig.get('OUTBOX_DISPATCHER_BATCH_SIZE', {
              infer: true,
            }),
            lockTimeoutMs: optionsOrConfig.get(
              'OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS',
              { infer: true },
            ),
          }
        : optionsOrConfig;

    this.role = options.role;
    this.enabled = options.enabled;
    this.intervalMs = options.intervalMs;
    this.batchSize = options.batchSize;
    this.lockTimeoutMs = options.lockTimeoutMs;
    this.workerId =
      options.workerId ?? `outbox-worker-${randomUUID().slice(0, 12)}`;
    this.now = options.now ?? (() => new Date());
    this.logger =
      options.logger ?? new Logger(OutboxDispatcherRunnerService.name);
  }

  onModuleInit() {
    if (!this.shouldRun()) return;

    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private shouldRun() {
    return this.enabled && this.role !== 'api';
  }

  private async tick() {
    if (this.running) {
      this.logger.debug(
        'Outbox dispatcher tick skipped because a previous tick is still running',
      );
      return;
    }

    this.running = true;
    try {
      await this.dispatcher.dispatchBatch({
        workerId: this.workerId,
        limit: this.batchSize,
        lockTimeoutMs: this.lockTimeoutMs,
        now: this.now(),
      });
    } catch (error) {
      this.logger.warn(
        `Outbox dispatcher tick failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
