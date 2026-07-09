import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';
import type { Queue } from 'bullmq';

import type { ServerEnv } from '../src/config/env';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { JobsModule } from '../src/jobs/jobs.module';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../src/knowledge-documents/jobs/process-document.job';
import { OutboxMetricsService } from '../src/outbox/outbox-metrics.service';
import { WorkerReadinessService } from '../src/worker-readiness/worker-readiness.service';

const DEFAULT_WORKER_READINESS_CLI_TIMEOUT_MS = 10_000;

type CliExitCode = 0 | 1 | 2;

type CliWritable = {
  write: (message: string) => unknown;
};

type RunWorkerReadinessCliOptions = {
  createApplicationContext?: (
    module: typeof WorkerReadinessCliModule,
  ) => Promise<INestApplicationContext>;
  stdout?: CliWritable;
  stderr?: CliWritable;
  timeoutMs?: number;
};

type MainOptions = {
  exitProcess?: boolean;
};

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JobsModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  providers: [
    OutboxMetricsService,
    {
      provide: WorkerReadinessService,
      inject: [
        getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        OutboxMetricsService,
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        outbox: OutboxMetricsService,
        config: ConfigService<ServerEnv, true>,
      ) => new WorkerReadinessService(queue, outbox, config),
    },
  ],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessCliModule {}

export function getWorkerReadinessExitCode(
  readiness: WorkerReadinessResponse,
): 0 | 1 {
  return readiness.status === 'ready' ? 0 : 1;
}

export function formatWorkerReadiness(readiness: WorkerReadinessResponse) {
  const counts = readiness.checks.queue.counts;
  const issues =
    readiness.issues.length > 0
      ? ['Issues:', ...readiness.issues.map((issue) => `- ${issue}`)]
      : ['Issues: none'];

  return [
    `Worker readiness: ${readiness.status}`,
    `Checked at: ${readiness.checkedAt}`,
    `Server: role=${readiness.server.role} mode=${readiness.server.knowledgeProcessingMode}`,
    `Redis: ${readiness.checks.redis.status} - ${readiness.checks.redis.message}`,
    [
      `Queue: ${readiness.checks.queue.status} - ${readiness.checks.queue.message}`,
      `counts(waiting=${counts.waiting} active=${counts.active} delayed=${counts.delayed} failed=${counts.failed} paused=${counts.paused})`,
      `paused=${readiness.checks.queue.isPaused}`,
      `backlog=${readiness.checks.queue.hasBacklog}`,
    ].join(' '),
    [
      `Workers: ${readiness.checks.workers.status} - ${readiness.checks.workers.message}`,
      `online=${readiness.checks.workers.onlineCount}`,
      `latest=${readiness.checks.workers.latestHeartbeatAt ?? 'none'}`,
    ].join(' '),
    [
      `Outbox: ${readiness.checks.outbox.status} - ${readiness.checks.outbox.message}`,
      `dead=${readiness.checks.outbox.deadCount}`,
      `backlog=${readiness.checks.outbox.hasBacklog}`,
      `oldestPendingAgeMs=${readiness.checks.outbox.oldestPendingAgeMs ?? 'none'}`,
    ].join(' '),
    ...issues,
  ].join('\n');
}

export async function withWorkerReadinessTimeout<T>(
  promise: Promise<T>,
  timeoutMs = DEFAULT_WORKER_READINESS_CLI_TIMEOUT_MS,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error('Worker readiness timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function runWorkerReadinessCli(
  options: RunWorkerReadinessCliOptions = {},
): Promise<CliExitCode> {
  const createApplicationContext =
    options.createApplicationContext ??
    ((module: typeof WorkerReadinessCliModule) =>
      NestFactory.createApplicationContext(module, { logger: false }));
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const timeoutMs = options.timeoutMs ?? getCliTimeoutMs();
  let app: INestApplicationContext | undefined;
  let exitCode: CliExitCode = 2;
  const restoreConsole = suppressDependencyConsoleErrors();

  try {
    app = await withWorkerReadinessTimeout(
      createApplicationContext(WorkerReadinessCliModule),
      timeoutMs,
    );
    const readiness = await withWorkerReadinessTimeout(
      app.get(WorkerReadinessService).getReadiness(),
      timeoutMs,
    );
    stdout.write(`${formatWorkerReadiness(readiness)}\n`);
    exitCode = getWorkerReadinessExitCode(readiness);
  } catch {
    stderr.write(
      'Worker readiness CLI failed: unexpected script/config/timeout failure.\n',
    );
    exitCode = 2;
  } finally {
    if (app) {
      try {
        await withWorkerReadinessTimeout(app.close(), timeoutMs);
      } catch {
        stderr.write('Worker readiness CLI cleanup failed.\n');
        exitCode = 2;
      }
    }
    restoreConsole();
  }

  return exitCode;
}

export async function main(options: MainOptions = {}) {
  const exitCode = await runWorkerReadinessCli();
  if (options.exitProcess ?? true) {
    process.exit(exitCode);
  }

  process.exitCode = exitCode;
}

if (require.main === module) {
  void main();
}

function getCliTimeoutMs() {
  const raw = process.env.WORKER_READINESS_CLI_TIMEOUT_MS;
  if (!raw) return DEFAULT_WORKER_READINESS_CLI_TIMEOUT_MS;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_WORKER_READINESS_CLI_TIMEOUT_MS;
}

function suppressDependencyConsoleErrors() {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => undefined;
  console.warn = () => undefined;

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}
