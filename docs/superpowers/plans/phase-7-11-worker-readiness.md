# Phase 7.11 Worker Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe machine-readable Worker Readiness API and CLI command for Redis, BullMQ, worker heartbeat, and durable outbox health.

**Architecture:** Add a focused `WorkerReadinessModule` that reuses BullMQ queue primitives and `OutboxMetricsService`. Keep the readiness response payload-free and feature-gated, while the CLI command maps readiness status to deterministic exit codes.

**Tech Stack:** NestJS 11, TypeScript, Zod contracts in `@repo/types`, BullMQ, Prisma-backed Outbox metrics, Bun workspace scripts, Jest.

---

## File Structure

- Create `packages/types/src/api/worker-readiness.ts`
  - Zod schemas and exported TypeScript types for readiness response.
- Modify `packages/types/package.json`
  - Export `@repo/types/api/worker-readiness`.
- Modify `packages/types/src/api/index.ts` only if this repository convention requires root API re-export.
- Modify `apps/server/src/config/env.ts`
  - Add `WORKER_READINESS_ENABLED`, default enabled outside production and disabled in production.
- Modify `apps/server/src/config/env.spec.ts`
  - Cover default and explicit override behavior.
- Create `apps/server/src/worker-readiness/worker-readiness.service.ts`
  - Computes readiness from queue counts, queue pause state, worker heartbeat keys, outbox metrics, server role, and processing mode.
- Create `apps/server/src/worker-readiness/worker-readiness.service.spec.ts`
  - TDD coverage for inline/queue readiness matrix and failure handling.
- Create `apps/server/src/worker-readiness/worker-readiness.controller.ts`
  - Exposes `GET /worker-readiness` behind `WORKER_READINESS_ENABLED` and `JwtAuthGuard`.
- Create `apps/server/src/worker-readiness/worker-readiness.controller.spec.ts`
  - Verifies guard and feature gate behavior.
- Create `apps/server/src/worker-readiness/worker-readiness.module.ts`
  - Wires controller/service with `AuthModule`, BullMQ queue from existing jobs module, and `OutboxModule`.
- Modify `apps/server/src/app.module.ts`
  - Imports `WorkerReadinessModule`.
- Create `apps/server/scripts/worker-readiness.ts`
  - CLI readiness command that creates an application context, calls service, prints safe summary, and exits with `0 | 1 | 2`.
- Modify `apps/server/package.json`
  - Add `readiness:worker` script.
- Modify docs after implementation:
  - `AGENTS.md`
  - `DEVLOG.md`
  - `docs/ai-behavior-acceptance.md`

## Task 1: Contract And Env Gate

**Files:**
- Create: `packages/types/src/api/worker-readiness.ts`
- Modify: `packages/types/package.json`
- Modify: `apps/server/src/config/env.ts`
- Test: `apps/server/src/config/env.spec.ts`

- [ ] **Step 1: Write failing env tests**

Add these tests near the other feature-gate tests in `apps/server/src/config/env.spec.ts`:

```ts
  it('enables worker readiness by default outside production', () => {
    expect(parseEnv(requiredEnv).WORKER_READINESS_ENABLED).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
      }).WORKER_READINESS_ENABLED,
    ).toBe(true);
  });

  it('disables worker readiness by default in production', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);
  });

  it('allows explicit worker readiness enablement overrides', () => {
    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'production',
        WORKER_READINESS_ENABLED: 'true',
      }).WORKER_READINESS_ENABLED,
    ).toBe(true);

    expect(
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'development',
        WORKER_READINESS_ENABLED: 'false',
      }).WORKER_READINESS_ENABLED,
    ).toBe(false);
  });
```

- [ ] **Step 2: Run env tests and verify RED**

Run:

```powershell
bun --filter @repo/server test -- env
```

Expected: FAIL because `WORKER_READINESS_ENABLED` is not yet present on `ServerEnv`.

- [ ] **Step 3: Write contract tests by typechecking a new schema**

Create `packages/types/src/api/worker-readiness.ts`:

```ts
import { z } from 'zod';

export const workerReadinessStatusSchema = z.enum([
  'ready',
  'degraded',
  'not_ready',
]);

export const workerReadinessCheckStatusSchema = z.enum([
  'pass',
  'warn',
  'fail',
]);

export const workerReadinessQueueCountsSchema = z.object({
  waiting: z.number().int().min(0),
  active: z.number().int().min(0),
  delayed: z.number().int().min(0),
  failed: z.number().int().min(0),
  paused: z.number().int().min(0),
});

const checkBaseSchema = z.object({
  status: workerReadinessCheckStatusSchema,
  message: z.string().min(1),
});

export const workerReadinessResponseSchema = z
  .object({
    ready: z.boolean(),
    status: workerReadinessStatusSchema,
    checkedAt: z.string().datetime(),
    server: z.object({
      role: z.enum(['api', 'worker', 'both']),
      knowledgeProcessingMode: z.enum(['inline', 'queue']),
    }),
    checks: z.object({
      redis: checkBaseSchema,
      queue: checkBaseSchema.extend({
        counts: workerReadinessQueueCountsSchema,
        isPaused: z.boolean(),
        hasBacklog: z.boolean(),
      }),
      workers: checkBaseSchema.extend({
        onlineCount: z.number().int().min(0),
        latestHeartbeatAt: z.string().datetime().nullable(),
      }),
      outbox: checkBaseSchema.extend({
        deadCount: z.number().int().min(0),
        hasBacklog: z.boolean(),
        oldestPendingAgeMs: z.number().int().min(0).nullable(),
      }),
    }),
    issues: z.array(z.string().min(1)),
  })
  .strict();

export type WorkerReadinessStatus = z.infer<
  typeof workerReadinessStatusSchema
>;
export type WorkerReadinessCheckStatus = z.infer<
  typeof workerReadinessCheckStatusSchema
>;
export type WorkerReadinessResponse = z.infer<
  typeof workerReadinessResponseSchema
>;
```

Add this export to `packages/types/package.json`:

```json
"./api/worker-readiness": "./src/api/worker-readiness.ts"
```

- [ ] **Step 4: Implement env parsing**

In `apps/server/src/config/env.ts`, add `WORKER_READINESS_ENABLED` next to the other optional boolean feature gates in `envSchema`:

```ts
    WORKER_READINESS_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
```

Add it to the `ServerEnv` omission and reconstructed type:

```ts
  | 'WORKER_READINESS_ENABLED'
```

```ts
  WORKER_READINESS_ENABLED: boolean;
```

Add defaulting in `parseEnv()`:

```ts
    WORKER_READINESS_ENABLED:
      env.WORKER_READINESS_ENABLED ?? env.NODE_ENV !== 'production',
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- env
bun --cwd packages/types typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add packages/types/src/api/worker-readiness.ts packages/types/package.json apps/server/src/config/env.ts apps/server/src/config/env.spec.ts
git commit -m "feat(types): add worker readiness contract"
```

## Task 2: Worker Readiness Service

**Files:**
- Create: `apps/server/src/worker-readiness/worker-readiness.service.spec.ts`
- Create: `apps/server/src/worker-readiness/worker-readiness.service.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/worker-readiness/worker-readiness.service.spec.ts`:

```ts
import { WorkerReadinessService } from './worker-readiness.service';

type QueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  paused: number;
};

describe('WorkerReadinessService', () => {
  it('reports ready in queue mode when Redis, queue, heartbeat, and outbox are healthy', async () => {
    const service = createService({
      mode: 'queue',
      role: 'api',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T01:00:00.000Z',
          lastSeenAt: '2026-07-08T01:00:15.000Z',
        },
      ],
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.ready).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.checks.redis.status).toBe('pass');
    expect(result.checks.queue.status).toBe('pass');
    expect(result.checks.workers.status).toBe('pass');
    expect(result.checks.outbox.status).toBe('pass');
    expect(result.issues).toEqual([]);
  });

  it('reports not_ready when queue mode has backlog without worker heartbeat', async () => {
    const service = createService({
      mode: 'queue',
      role: 'api',
      counts: { waiting: 2, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [],
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.ready).toBe(false);
    expect(result.status).toBe('not_ready');
    expect(result.checks.workers.status).toBe('fail');
    expect(result.issues).toContain(
      'Queue backlog exists but no worker heartbeat is online.',
    );
  });

  it('reports degraded when queue mode is idle without worker heartbeat', async () => {
    const service = createService({
      mode: 'queue',
      role: 'api',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [],
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.ready).toBe(false);
    expect(result.status).toBe('degraded');
    expect(result.checks.workers.status).toBe('warn');
  });

  it('does not require worker heartbeat in inline mode', async () => {
    const service = createService({
      mode: 'inline',
      role: 'api',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [],
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.status).toBe('ready');
    expect(result.checks.workers.status).toBe('pass');
  });

  it('reports not_ready when queue is paused', async () => {
    const service = createService({
      mode: 'queue',
      role: 'both',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 1 },
      isPaused: true,
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'both',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T01:00:00.000Z',
          lastSeenAt: '2026-07-08T01:00:15.000Z',
        },
      ],
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.status).toBe('not_ready');
    expect(result.checks.queue.status).toBe('fail');
  });

  it('reports not_ready when outbox has dead events', async () => {
    const service = createService({
      mode: 'queue',
      role: 'worker',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-08T01:00:00.000Z',
          lastSeenAt: '2026-07-08T01:00:15.000Z',
        },
      ],
      outbox: {
        counts: {
          pending: 0,
          processing: 0,
          succeeded: 5,
          failed: 0,
          dead: 1,
          total: 6,
        },
        hasBacklog: false,
        oldestPendingAgeMs: null,
        recentErrors: [],
      },
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.status).toBe('not_ready');
    expect(result.checks.outbox.status).toBe('fail');
    expect(result.issues).toContain('Dead outbox events require operator action.');
  });

  it('reports not_ready when Redis or BullMQ checks throw in queue mode', async () => {
    const service = createService({
      mode: 'queue',
      role: 'api',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
      heartbeats: [],
      queueError: new Error('redis down'),
    });

    const result = await service.getReadiness(new Date('2026-07-08T01:01:00.000Z'));

    expect(result.status).toBe('not_ready');
    expect(result.checks.redis.status).toBe('fail');
    expect(result.checks.queue.status).toBe('fail');
  });
});

function createService(input: {
  role: 'api' | 'worker' | 'both';
  mode: 'inline' | 'queue';
  counts: QueueCounts;
  isPaused?: boolean;
  heartbeats: unknown[];
  queueError?: Error;
  outbox?: {
    counts: {
      pending: number;
      processing: number;
      succeeded: number;
      failed: number;
      dead: number;
      total: number;
    };
    hasBacklog: boolean;
    oldestPendingAgeMs: number | null;
    recentErrors: unknown[];
  };
}) {
  const redis = {
    keys: jest
      .fn()
      .mockResolvedValue(input.heartbeats.map((_, index) => `key-${index}`)),
    mget: jest.fn().mockResolvedValue(
      input.heartbeats.map((heartbeat) => JSON.stringify(heartbeat)),
    ),
  };
  const queue = {
    getJobCounts: jest.fn().mockImplementation(() => {
      if (input.queueError) throw input.queueError;
      return Promise.resolve(input.counts);
    }),
    isPaused: jest.fn().mockResolvedValue(input.isPaused ?? input.counts.paused > 0),
    client: input.queueError ? Promise.reject(input.queueError) : Promise.resolve(redis),
  };
  const outbox = {
    getSummary: jest.fn().mockResolvedValue(
      input.outbox ?? {
        counts: {
          pending: 0,
          processing: 0,
          succeeded: 0,
          failed: 0,
          dead: 0,
          total: 0,
        },
        hasBacklog: false,
        oldestPendingAgeMs: null,
        recentErrors: [],
      },
    ),
  };

  return new WorkerReadinessService(queue as never, outbox as never, {
    role: input.role,
    knowledgeProcessingMode: input.mode,
    heartbeatTtlSeconds: 45,
    prefix: 'prepmind',
  });
}
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness.service
```

Expected: FAIL because `worker-readiness.service.ts` does not exist.

- [ ] **Step 3: Implement minimal service**

Create `apps/server/src/worker-readiness/worker-readiness.service.ts` with:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';
import { workerHeartbeatResponseSchema } from '@repo/types/api/worker-observability';

import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxMetricsService } from '../outbox/outbox-metrics.service';

type QueueCounts = WorkerReadinessResponse['checks']['queue']['counts'];
type WorkerReadinessOptions = {
  role: ServerEnv['SERVER_ROLE'];
  knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  heartbeatTtlSeconds: number;
  prefix: string;
  logger?: Pick<Logger, 'warn'>;
};
type RedisLike = {
  keys: (pattern: string) => Promise<string[]>;
  mget: (...keys: string[]) => Promise<Array<string | null>>;
};

@Injectable()
export class WorkerReadinessService {
  private readonly role: ServerEnv['SERVER_ROLE'];
  private readonly knowledgeProcessingMode: ServerEnv['KNOWLEDGE_PROCESSING_MODE'];
  private readonly heartbeatTtlSeconds: number;
  private readonly prefix: string;
  private readonly logger: Pick<Logger, 'warn'>;

  constructor(
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE)
    private readonly queue: Queue,
    private readonly outbox: OutboxMetricsService,
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
    this.logger = options.logger ?? new Logger(WorkerReadinessService.name);
  }

  async getReadiness(now = new Date()): Promise<WorkerReadinessResponse> {
    const checkedAt = now.toISOString();
    const queueResult = await this.getQueueReadiness();
    const heartbeats = await this.getHeartbeats();
    const outboxResult = await this.getOutboxReadiness();

    const hasBacklog =
      queueResult.counts.waiting +
        queueResult.counts.active +
        queueResult.counts.delayed +
        queueResult.counts.paused >
      0;
    const hasHeartbeat = heartbeats.length > 0;
    const latestHeartbeatAt =
      heartbeats
        .map((heartbeat) => heartbeat.lastSeenAt)
        .sort()
        .reverse()[0] ?? null;

    const issues: string[] = [];
    const redisStatus = queueResult.redisReachable ? 'pass' : this.knowledgeProcessingMode === 'queue' ? 'fail' : 'warn';
    const queueStatus = resolveQueueStatus({
      mode: this.knowledgeProcessingMode,
      queueReadable: queueResult.queueReadable,
      isPaused: queueResult.isPaused,
    });
    const workersStatus = resolveWorkersStatus({
      mode: this.knowledgeProcessingMode,
      hasBacklog,
      hasHeartbeat,
    });
    const outboxStatus = outboxResult.deadCount > 0 || outboxResult.failed ? 'fail' : 'pass';

    if (!queueResult.redisReachable) issues.push('Redis or BullMQ is not reachable.');
    if (queueResult.isPaused) issues.push('Queue is paused.');
    if (this.knowledgeProcessingMode === 'queue' && hasBacklog && !hasHeartbeat) {
      issues.push('Queue backlog exists but no worker heartbeat is online.');
    }
    if (this.knowledgeProcessingMode === 'queue' && !hasBacklog && !hasHeartbeat) {
      issues.push('Queue mode has no online worker heartbeat.');
    }
    if (outboxResult.deadCount > 0) {
      issues.push('Dead outbox events require operator action.');
    }
    if (outboxResult.failed) {
      issues.push('Outbox metrics could not be read.');
    }

    const status = resolveOverallStatus([
      redisStatus,
      queueStatus,
      workersStatus,
      outboxStatus,
    ]);

    return {
      ready: status === 'ready',
      status,
      checkedAt,
      server: {
        role: this.role,
        knowledgeProcessingMode: this.knowledgeProcessingMode,
      },
      checks: {
        redis: {
          status: redisStatus,
          message: queueResult.redisReachable
            ? 'Redis is reachable.'
            : 'Redis or BullMQ is not reachable.',
        },
        queue: {
          status: queueStatus,
          message: queueResult.queueReadable
            ? queueResult.isPaused
              ? 'Queue is paused.'
              : 'Queue is readable.'
            : 'Queue counts could not be read.',
          counts: queueResult.counts,
          isPaused: queueResult.isPaused,
          hasBacklog,
        },
        workers: {
          status: workersStatus,
          message: getWorkersMessage(this.knowledgeProcessingMode, hasBacklog, hasHeartbeat),
          onlineCount: heartbeats.length,
          latestHeartbeatAt,
        },
        outbox: {
          status: outboxStatus,
          message:
            outboxResult.deadCount > 0
              ? 'Dead outbox events require operator action.'
              : outboxResult.failed
                ? 'Outbox metrics could not be read.'
                : 'No dead outbox events.',
          deadCount: outboxResult.deadCount,
          hasBacklog: outboxResult.hasBacklog,
          oldestPendingAgeMs: outboxResult.oldestPendingAgeMs,
        },
      },
      issues,
    };
  }

  private async getQueueReadiness() {
    try {
      const [counts, isPaused] = await Promise.all([
        this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'paused'),
        this.queue.isPaused(),
      ]);

      return {
        redisReachable: true,
        queueReadable: true,
        isPaused,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          paused: counts.paused ?? 0,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Worker readiness queue check failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return {
        redisReachable: false,
        queueReadable: false,
        isPaused: false,
        counts: emptyQueueCounts(),
      };
    }
  }

  private async getHeartbeats() {
    try {
      const redis = (await this.queue.client) as unknown as RedisLike;
      const keys = await redis.keys(`${this.prefix}:worker-heartbeat:*`);
      if (!keys.length) return [];
      const values = await redis.mget(...keys);
      return values
        .map((value) => {
          if (!value) return null;
          try {
            const parsed = workerHeartbeatResponseSchema.safeParse(JSON.parse(value));
            return parsed.success ? parsed.data : null;
          } catch {
            return null;
          }
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));
    } catch (error) {
      this.logger.warn(
        `Worker readiness heartbeat check failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  private async getOutboxReadiness() {
    try {
      const summary = await this.outbox.getSummary();
      return {
        failed: false,
        deadCount: summary.counts.dead,
        hasBacklog: summary.hasBacklog,
        oldestPendingAgeMs: summary.oldestPendingAgeMs,
      };
    } catch (error) {
      this.logger.warn(
        `Worker readiness outbox check failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return {
        failed: true,
        deadCount: 0,
        hasBacklog: false,
        oldestPendingAgeMs: null,
      };
    }
  }
}

function resolveQueueStatus(input: {
  mode: 'inline' | 'queue';
  queueReadable: boolean;
  isPaused: boolean;
}) {
  if (input.isPaused) return 'fail';
  if (!input.queueReadable) return input.mode === 'queue' ? 'fail' : 'warn';
  return 'pass';
}

function resolveWorkersStatus(input: {
  mode: 'inline' | 'queue';
  hasBacklog: boolean;
  hasHeartbeat: boolean;
}) {
  if (input.mode === 'inline') return 'pass';
  if (input.hasHeartbeat) return 'pass';
  return input.hasBacklog ? 'fail' : 'warn';
}

function resolveOverallStatus(
  statuses: Array<'pass' | 'warn' | 'fail'>,
): 'ready' | 'degraded' | 'not_ready' {
  if (statuses.includes('fail')) return 'not_ready';
  if (statuses.includes('warn')) return 'degraded';
  return 'ready';
}

function getWorkersMessage(
  mode: 'inline' | 'queue',
  hasBacklog: boolean,
  hasHeartbeat: boolean,
) {
  if (mode === 'inline') return 'Inline mode does not require worker heartbeat.';
  if (hasHeartbeat) return 'At least one worker heartbeat is online.';
  if (hasBacklog) return 'Queue backlog exists but no worker heartbeat is online.';
  return 'Queue mode has no online worker heartbeat.';
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
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness.service
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/worker-readiness/worker-readiness.service.ts apps/server/src/worker-readiness/worker-readiness.service.spec.ts
git commit -m "feat(server): add worker readiness service"
```

## Task 3: HTTP Endpoint And Module Wiring

**Files:**
- Create: `apps/server/src/worker-readiness/worker-readiness.controller.spec.ts`
- Create: `apps/server/src/worker-readiness/worker-readiness.controller.ts`
- Create: `apps/server/src/worker-readiness/worker-readiness.module.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write failing controller tests**

Create `apps/server/src/worker-readiness/worker-readiness.controller.spec.ts`:

```ts
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkerReadinessController } from './worker-readiness.controller';

describe('WorkerReadinessController', () => {
  it('uses JwtAuthGuard on the controller', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkerReadinessController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('returns readiness when the feature gate is enabled', async () => {
    const service = {
      getReadiness: jest.fn().mockResolvedValue({ status: 'ready', ready: true }),
    };
    const config = {
      get: jest.fn().mockReturnValue(true),
    };
    const controller = new WorkerReadinessController(
      service as never,
      config as never,
    );

    await expect(controller.readiness()).resolves.toEqual({
      status: 'ready',
      ready: true,
    });
    expect(service.getReadiness).toHaveBeenCalledTimes(1);
  });

  it('hides readiness when the feature gate is disabled', async () => {
    const service = {
      getReadiness: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const controller = new WorkerReadinessController(
      service as never,
      config as never,
    );

    await expect(controller.readiness()).rejects.toBeInstanceOf(NotFoundException);
    expect(service.getReadiness).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run controller tests and verify RED**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness.controller
```

Expected: FAIL because `worker-readiness.controller.ts` does not exist.

- [ ] **Step 3: Implement controller**

Create `apps/server/src/worker-readiness/worker-readiness.controller.ts`:

```ts
import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ServerEnv } from '../config/env';
import { WorkerReadinessService } from './worker-readiness.service';

@Controller('worker-readiness')
@UseGuards(JwtAuthGuard)
@ApiTags('Worker Readiness')
@ApiBearerAuth('access-token')
export class WorkerReadinessController {
  constructor(
    private readonly service: WorkerReadinessService,
    private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: '检查后台 worker readiness',
    description:
      '返回 Redis、BullMQ 队列、worker heartbeat 和 outbox 的安全 readiness 摘要。不会返回 payload、用户正文、prompt、RAG chunk、API key、token 或 cookie。',
  })
  @ApiOkResponse({
    description:
      'readiness 摘要会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  async readiness() {
    if (!this.config.get('WORKER_READINESS_ENABLED', { infer: true })) {
      throw new NotFoundException('Worker readiness is disabled');
    }

    return this.service.getReadiness();
  }
}
```

- [ ] **Step 4: Wire module**

Create `apps/server/src/worker-readiness/worker-readiness.module.ts`:

```ts
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkerReadinessController } from './worker-readiness.controller';
import { WorkerReadinessService } from './worker-readiness.service';

@Module({
  imports: [AuthModule, OutboxModule],
  controllers: [WorkerReadinessController],
  providers: [WorkerReadinessService],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessModule {}
```

Modify `apps/server/src/app.module.ts`:

```ts
import { WorkerReadinessModule } from './worker-readiness/worker-readiness.module';
```

Add `WorkerReadinessModule` after `WorkerObservabilityModule` in `imports`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/src/worker-readiness apps/server/src/app.module.ts
git commit -m "feat(server): expose worker readiness endpoint"
```

## Task 4: CLI Readiness Command

**Files:**
- Create: `apps/server/scripts/worker-readiness.ts`
- Modify: `apps/server/package.json`
- Test: `apps/server/src/worker-readiness/worker-readiness-cli.spec.ts`

- [ ] **Step 1: Write failing CLI mapping tests**

Create `apps/server/src/worker-readiness/worker-readiness-cli.spec.ts`:

```ts
import {
  formatWorkerReadiness,
  getWorkerReadinessExitCode,
} from '../../scripts/worker-readiness';

describe('worker readiness CLI helpers', () => {
  it('maps ready to exit code 0', () => {
    expect(getWorkerReadinessExitCode({ status: 'ready' })).toBe(0);
  });

  it('maps degraded and not_ready to exit code 1', () => {
    expect(getWorkerReadinessExitCode({ status: 'degraded' })).toBe(1);
    expect(getWorkerReadinessExitCode({ status: 'not_ready' })).toBe(1);
  });

  it('formats a safe human-readable summary', () => {
    const output = formatWorkerReadiness({
      ready: false,
      status: 'not_ready',
      checkedAt: '2026-07-08T01:00:00.000Z',
      server: { role: 'api', knowledgeProcessingMode: 'queue' },
      checks: {
        redis: { status: 'pass', message: 'Redis is reachable.' },
        queue: {
          status: 'pass',
          message: 'Queue is readable.',
          counts: { waiting: 2, active: 0, delayed: 0, failed: 0, paused: 0 },
          isPaused: false,
          hasBacklog: true,
        },
        workers: {
          status: 'fail',
          message: 'Queue backlog exists but no worker heartbeat is online.',
          onlineCount: 0,
          latestHeartbeatAt: null,
        },
        outbox: {
          status: 'pass',
          message: 'No dead outbox events.',
          deadCount: 0,
          hasBacklog: false,
          oldestPendingAgeMs: null,
        },
      },
      issues: ['Queue backlog exists but no worker heartbeat is online.'],
    });

    expect(output).toContain('Worker readiness: not_ready');
    expect(output).toContain('Workers: fail - Queue backlog exists but no worker heartbeat is online.');
    expect(output).not.toContain('accessToken');
    expect(output).not.toContain('payload');
  });
});
```

- [ ] **Step 2: Run CLI tests and verify RED**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness-cli
```

Expected: FAIL because `apps/server/scripts/worker-readiness.ts` does not exist.

- [ ] **Step 3: Implement CLI script**

Create `apps/server/scripts/worker-readiness.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

import { AppModule } from '../src/app.module';
import { WorkerReadinessService } from '../src/worker-readiness/worker-readiness.service';

export function getWorkerReadinessExitCode(
  readiness: Pick<WorkerReadinessResponse, 'status'>,
) {
  return readiness.status === 'ready' ? 0 : 1;
}

export function formatWorkerReadiness(readiness: WorkerReadinessResponse) {
  const lines = [
    `Worker readiness: ${readiness.status}`,
    '',
    `Checked at: ${readiness.checkedAt}`,
    `Server: role=${readiness.server.role}, mode=${readiness.server.knowledgeProcessingMode}`,
    `Redis: ${readiness.checks.redis.status} - ${readiness.checks.redis.message}`,
    `Queue: ${readiness.checks.queue.status} - ${readiness.checks.queue.message}`,
    `Workers: ${readiness.checks.workers.status} - ${readiness.checks.workers.message}`,
    `Outbox: ${readiness.checks.outbox.status} - ${readiness.checks.outbox.message}`,
  ];

  if (readiness.issues.length > 0) {
    lines.push('', 'Issues:');
    for (const issue of readiness.issues) {
      lines.push(`- ${issue}`);
    }
  }

  return lines.join('\n');
}

async function main() {
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    const service = app.get(WorkerReadinessService);
    const readiness = await service.getReadiness();
    console.log(formatWorkerReadiness(readiness));
    process.exitCode = getWorkerReadinessExitCode(readiness);
  } catch (error) {
    console.error(
      `Worker readiness check failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    process.exitCode = 2;
  } finally {
    await app?.close();
  }
}

if (require.main === module) {
  void main();
}
```

Modify `apps/server/package.json` scripts:

```json
"readiness:worker": "ts-node -r tsconfig-paths/register scripts/worker-readiness.ts"
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- worker-readiness-cli
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/scripts/worker-readiness.ts apps/server/package.json apps/server/src/worker-readiness/worker-readiness-cli.spec.ts
git commit -m "feat(server): add worker readiness cli"
```

## Task 5: Docs, Verification, And Review

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update docs**

Document:

```text
Phase 7.11 已完成：Worker Readiness、/worker-readiness、readiness:worker CLI、Redis / BullMQ / heartbeat / outbox readiness matrix。
```

Add usage:

```powershell
bun --filter @repo/server readiness:worker
```

Clarify:

```text
/health = HTTP liveness
/worker-observability/summary = 登录后给人看的详细观测摘要
/worker-readiness = 给部署、容器和本地 smoke 使用的机器可读 readiness
```

Add boundary:

```text
Phase 7.11 不改 Chat / RAG prompt / embedding / live model 行为，不需要 live 模型 smoke。
```

- [ ] **Step 2: Run focused verification**

Run:

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server test -- worker-readiness env
bun --filter @repo/server test -- worker-observability
bun --filter @repo/server build
git diff --check
```

Expected: all PASS.

- [ ] **Step 3: Commit docs**

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record worker readiness"
```

- [ ] **Step 4: Request code review**

Review range:

```powershell
git rev-parse f3b0bcb
git rev-parse HEAD
```

Ask reviewer to check:

```text
Phase 7.11 Worker Readiness implementation:
- contract and env gate
- readiness service status matrix
- HTTP endpoint auth/feature gate
- CLI exit code mapping
- no payload/token/API key leakage
- tests and docs
```

- [ ] **Step 5: Fix review findings and commit if needed**

If review finds important issues, fix with TDD when behavior changes. Commit with a focused message such as:

```powershell
git commit -m "fix(server): harden worker readiness checks"
```

## Self-Review

- Spec coverage: This plan covers the response contract, env gate, service matrix, HTTP endpoint, CLI command, docs, verification, and review.
- Scope control: The plan does not add a frontend page, Prometheus/Grafana, admin RBAC, new business background jobs, or model behavior changes.
- Type consistency: Status literals are `ready | degraded | not_ready` and check literals are `pass | warn | fail` throughout.
- Commit cadence: Each task ends with a focused commit, matching the project workflow.
