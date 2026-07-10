import { randomUUID } from 'node:crypto';

import { DelayedError, Queue, QueueEvents, Worker } from 'bullmq';

const integrationRequested =
  process.env.OPERATOR_AUDIT_EXPORT_DELAY_INTEGRATION === 'true' ||
  process.argv.some((value) =>
    value.includes('operator-audit-export-delay.integration'),
  );
const describeWithRedis = integrationRequested ? describe : describe.skip;

describeWithRedis('operator audit export BullMQ delayed contract', () => {
  jest.setTimeout(15_000);

  it('moves a busy delivery to delayed without consuming an attempt', async () => {
    const queueName = `operator-audit-export-delay-spec-${randomUUID()}`;
    const connection = redisConnection(
      process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    );
    const queue = new Queue(queueName, { connection });
    const events = new QueueEvents(queueName, { connection });
    let deliveries = 0;
    const worker = new Worker(
      queueName,
      async (job) => {
        deliveries += 1;
        if (deliveries === 1) {
          if (!job.token) throw new Error('BullMQ worker token is missing');
          await job.moveToDelayed(Date.now() + 250, job.token);
          throw new DelayedError();
        }
      },
      { connection },
    );

    try {
      await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
      const job = await queue.add(
        'delay-contract',
        { safe: true },
        {
          attempts: 2,
        },
      );

      await waitFor(async () => (await job.getState()) === 'delayed');
      const delayed = await queue.getJob(job.id!);
      expect(delayed?.attemptsMade).toBe(0);

      await job.waitUntilFinished(events, 5_000);
      const completed = await queue.getJob(job.id!);
      expect(await completed?.getState()).toBe('completed');
      // The successful second delivery is counted only when it completes.
      expect(completed?.attemptsMade).toBe(1);
      expect(deliveries).toBe(2);
    } finally {
      await worker.close();
      await events.close();
      await queue.obliterate({ force: true }).catch(() => undefined);
      await queue.close();
    }
  });
});

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
