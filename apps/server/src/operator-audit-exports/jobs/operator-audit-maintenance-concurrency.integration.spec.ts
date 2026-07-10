import { randomUUID } from 'node:crypto';

import { Queue, Worker } from 'bullmq';

import { OperatorAuditMaintenanceQueueConcurrencyService } from '../operator-audit-exports.module';

const integrationRequested =
  process.env.OPERATOR_AUDIT_MAINTENANCE_CONCURRENCY_INTEGRATION === 'true' ||
  process.argv.some((value) =>
    value.includes('operator-audit-maintenance-concurrency.integration'),
  );
const describeWithRedis = integrationRequested ? describe : describe.skip;

describeWithRedis(
  'operator audit maintenance BullMQ global concurrency',
  () => {
    jest.setTimeout(15_000);

    it('keeps the second job waiting across two worker replicas', async () => {
      const queueName = `operator-audit-maintenance-concurrency-spec-${randomUUID()}`;
      const connection = redisConnection(
        process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      );
      const queue = new Queue(queueName, { connection });
      let active = 0;
      let maxActive = 0;
      let secondStarted = false;
      let markFirstStarted!: () => void;
      const firstStarted = new Promise<void>((resolve) => {
        markFirstStarted = resolve;
      });
      let releaseJobs!: () => void;
      const release = new Promise<void>((resolve) => {
        releaseJobs = resolve;
      });
      const processor = async (job: { name: string }) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (job.name === 'first') markFirstStarted();
        else secondStarted = true;
        try {
          await release;
        } finally {
          active -= 1;
        }
      };
      const workers = [
        new Worker(queueName, processor, { connection, concurrency: 1 }),
        new Worker(queueName, processor, { connection, concurrency: 1 }),
      ];

      try {
        await Promise.all(workers.map((worker) => worker.waitUntilReady()));
        await new OperatorAuditMaintenanceQueueConcurrencyService(
          queue,
        ).onApplicationBootstrap();
        await queue.add('first', { schemaVersion: 1 });
        await firstStarted;
        await queue.add('second', { schemaVersion: 1 });

        await waitFor(async () => {
          if (secondStarted) {
            throw new Error('Second maintenance job started concurrently');
          }
          const counts = await queue.getJobCounts('active', 'waiting');
          return counts.active === 1 && counts.waiting === 1;
        });
        expect(maxActive).toBe(1);
        expect(secondStarted).toBe(false);

        releaseJobs();
        await waitFor(async () => {
          const counts = await queue.getJobCounts('completed');
          return counts.completed === 2;
        });
        expect(maxActive).toBe(1);
      } finally {
        releaseJobs();
        await Promise.all(workers.map((worker) => worker.close()));
        await queue.removeGlobalConcurrency().catch(() => undefined);
        await queue.obliterate({ force: true }).catch(() => undefined);
        await queue.close();
      }
    });
  },
);

function redisConnection(value: string) {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.pathname.length > 1 ? { db: Number(url.pathname.slice(1)) } : {}),
    maxRetriesPerRequest: null,
  };
}

async function waitFor(predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for BullMQ state');
}
