import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

import { AppModule } from '../src/app.module';
import { WorkerReadinessService } from '../src/worker-readiness/worker-readiness.service';

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

export async function main() {
  let app: INestApplicationContext | undefined;

  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    const readiness = await app.get(WorkerReadinessService).getReadiness();
    process.stdout.write(`${formatWorkerReadiness(readiness)}\n`);
    process.exitCode = getWorkerReadinessExitCode(readiness);
  } catch {
    process.stderr.write(
      'Worker readiness CLI failed: unexpected script/config failure.\n',
    );
    process.exitCode = 2;
  } finally {
    if (app) {
      try {
        await app.close();
      } catch {
        process.stderr.write('Worker readiness CLI cleanup failed.\n');
        process.exitCode = 2;
      }
    }
  }
}

if (require.main === module) {
  void main();
}
