# Phase 7.7 Worker Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a lightweight worker observability loop so `/knowledge` can show whether the knowledge-document-processing queue has backlog, recent failures, and a recently online worker.

**Architecture:** Add a shared `@repo/types` contract, a NestJS `WorkerObservabilityModule` that combines BullMQ queue counts, Redis-backed worker heartbeat, and existing `BackgroundJobsService.getSummary()`, then surface the summary through a protected and environment-gated API plus a small `/knowledge` status strip. Worker heartbeat uses the existing BullMQ Redis connection through the injected queue, avoiding a new Redis dependency. Because queue counts and heartbeat are system-level observability signals, `WORKER_OBSERVABILITY_ENABLED` defaults to enabled outside production and disabled in production.

**Tech Stack:** TypeScript, Zod, NestJS 11, BullMQ, Redis via BullMQ queue client, TanStack Query, Next.js 16, Bun workspace.

---

## File Map

- Create: `packages/types/src/api/worker-observability.ts`
  - Zod schema and exported types for worker / queue summary.
- Modify: `packages/types/src/api/index.ts`
  - Re-export the new worker observability contract.
- Create: `packages/types/tests/worker-observability.test.mts`
  - Contract tests for healthy, attention, degraded, and idle summaries.
- Modify: `apps/server/src/config/env.ts`
  - Add `WORKER_HEARTBEAT_INTERVAL_MS`, `WORKER_HEARTBEAT_TTL_SECONDS`, and `WORKER_OBSERVABILITY_ENABLED`.
- Create: `apps/server/src/worker-observability/worker-observability.constants.ts`
  - Queue names, heartbeat key helpers, and defaults used by server tests and service code.
- Create: `apps/server/src/worker-observability/worker-heartbeat.service.ts`
  - Writes Redis heartbeat only in `worker` / `both` roles.
- Create: `apps/server/src/worker-observability/worker-observability.service.ts`
  - Builds summary from queue counts, heartbeat, env, and BackgroundJob summary.
- Create: `apps/server/src/worker-observability/worker-observability.controller.ts`
  - Exposes `GET /worker-observability/summary` behind `JwtAuthGuard` and `WORKER_OBSERVABILITY_ENABLED`.
- Create: `apps/server/src/worker-observability/worker-observability.module.ts`
  - Wires queue, heartbeat service, summary service, controller, and `BackgroundJobsModule`.
- Create: `apps/server/src/worker-observability/worker-heartbeat.service.spec.ts`
  - Unit tests for role-gated heartbeat writes.
- Create: `apps/server/src/worker-observability/worker-observability.service.spec.ts`
  - Unit tests for summary signal rules.
- Create: `apps/server/src/worker-observability/worker-observability.controller.spec.ts`
  - Controller wiring and guard metadata tests.
- Modify: `apps/server/src/app.module.ts`
  - Import `WorkerObservabilityModule`.
- Modify: `apps/server/src/config/swagger.spec.ts`
  - Ensure `/worker-observability/summary` appears in OpenAPI and has no sensitive examples.
- Create: `apps/web/src/lib/worker-observability-api.ts`
  - Client wrapper and schema parse for summary API.
- Create: `apps/web/src/lib/worker-observability-view.ts`
  - UI helper functions for status tone, labels, and compact counts.
- Create: `apps/web/src/lib/worker-observability-api.test.mts`
  - Client contract and path tests.
- Create: `apps/web/src/lib/worker-observability-view.test.mts`
  - Helper tests for healthy / attention / degraded / idle / unavailable states.
- Create: `apps/web/src/hooks/use-worker-observability.ts`
  - TanStack Query hook with user access token gating.
- Modify: `apps/web/src/app/(main)/knowledge/page.tsx`
  - Render a small worker health strip near the existing background job summary.
- Modify: `AGENTS.md`
  - Add Phase 7.7 state and worker observability boundaries.
- Modify: `DEVLOG.md`
  - Record Phase 7.7 milestone and verification.
- Modify: `docs/data-flow.md`
  - Document heartbeat + queue counts + BackgroundJob summary data flow.
- Modify: `docs/dev-start.md`
  - Document local API / worker split and health strip verification.
- Modify: `docs/roadmap.md`
  - Mark Phase 7.7 complete after implementation.
- Create: `docs/blogs/phase-7-worker-observability.md`
  - Interview-oriented learning blog.

## Task 1: Shared Contract

**Files:**
- Create: `packages/types/src/api/worker-observability.ts`
- Modify: `packages/types/src/api/index.ts`
- Create: `packages/types/tests/worker-observability.test.mts`

- [x] **Step 1: Write the failing contract test**

Create `packages/types/tests/worker-observability.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  workerObservabilitySummaryResponseSchema,
  type WorkerObservabilitySummaryResponse,
} from '../src/api/worker-observability';

const baseSummary: WorkerObservabilitySummaryResponse = {
  server: {
    role: 'api',
    knowledgeProcessingMode: 'queue',
  },
  queue: {
    name: 'knowledge-document-processing',
    counts: {
      waiting: 2,
      active: 0,
      delayed: 0,
      completed: 4,
      failed: 0,
      paused: 0,
    },
    isPaused: false,
    hasBacklog: true,
  },
  workers: {
    heartbeatTtlSeconds: 45,
    onlineCount: 0,
    latestHeartbeat: null,
  },
  backgroundJobs: {
    activeCount: 2,
    failedCount: 0,
    staleSkippedCount: 0,
    succeededCount: 4,
    totalRecentCount: 6,
    latestJob: null,
  },
  signals: {
    status: 'attention',
    hasWorkerHeartbeat: false,
    queueModeWithoutWorker: true,
    queueBacklogWithoutWorker: true,
    hasRecentFailures: false,
    message: '已有待处理任务，但暂未检测到 worker 在线。',
  },
};

const parsed = workerObservabilitySummaryResponseSchema.parse(baseSummary);
assert.equal(parsed.signals.status, 'attention');
assert.equal(parsed.queue.counts.waiting, 2);

const healthy = workerObservabilitySummaryResponseSchema.parse({
  ...baseSummary,
  workers: {
    heartbeatTtlSeconds: 45,
    onlineCount: 1,
    latestHeartbeat: {
      workerId: 'worker-1',
      serverRole: 'worker',
      queues: ['knowledge-document-processing'],
      startedAt: '2026-07-05T10:00:00.000Z',
      lastSeenAt: '2026-07-05T10:00:15.000Z',
    },
  },
  signals: {
    ...baseSummary.signals,
    status: 'healthy',
    hasWorkerHeartbeat: true,
    queueModeWithoutWorker: false,
    queueBacklogWithoutWorker: false,
    message: '后台处理正常，worker 最近在线。',
  },
});

assert.equal(healthy.workers.onlineCount, 1);
```

- [x] **Step 2: Run the contract test to verify it fails**

Run:

```powershell
bun packages/types/tests/worker-observability.test.mts
```

Expected: FAIL because `../src/api/worker-observability` does not exist.

- [x] **Step 3: Implement the schema**

Create `packages/types/src/api/worker-observability.ts`:

```ts
import { z } from 'zod';

import { backgroundJobSummaryResponseSchema } from './background-job';

export const workerObservabilityServerRoleSchema = z.enum(['api', 'worker', 'both']);
export const workerObservabilityProcessingModeSchema = z.enum(['inline', 'queue']);
export const workerObservabilityStatusSchema = z.enum([
  'healthy',
  'degraded',
  'attention',
  'idle',
]);

export const workerHeartbeatResponseSchema = z.object({
  workerId: z.string().min(1),
  serverRole: z.enum(['worker', 'both']),
  queues: z.array(z.string().min(1)),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const workerObservabilityQueueCountsSchema = z.object({
  waiting: z.number().int().min(0),
  active: z.number().int().min(0),
  delayed: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  paused: z.number().int().min(0),
});

export const workerObservabilitySummaryResponseSchema = z.object({
  server: z.object({
    role: workerObservabilityServerRoleSchema,
    knowledgeProcessingMode: workerObservabilityProcessingModeSchema,
  }),
  queue: z.object({
    name: z.literal('knowledge-document-processing'),
    counts: workerObservabilityQueueCountsSchema,
    isPaused: z.boolean(),
    hasBacklog: z.boolean(),
  }),
  workers: z.object({
    heartbeatTtlSeconds: z.number().int().min(1),
    onlineCount: z.number().int().min(0),
    latestHeartbeat: workerHeartbeatResponseSchema.nullable(),
  }),
  backgroundJobs: backgroundJobSummaryResponseSchema,
  signals: z.object({
    status: workerObservabilityStatusSchema,
    hasWorkerHeartbeat: z.boolean(),
    queueModeWithoutWorker: z.boolean(),
    queueBacklogWithoutWorker: z.boolean(),
    hasRecentFailures: z.boolean(),
    message: z.string().min(1),
  }),
});

export type WorkerHeartbeatResponse = z.infer<typeof workerHeartbeatResponseSchema>;
export type WorkerObservabilitySummaryResponse = z.infer<
  typeof workerObservabilitySummaryResponseSchema
>;
export type WorkerObservabilityStatus = z.infer<typeof workerObservabilityStatusSchema>;
```

Update `packages/types/src/api/index.ts`:

```ts
export * from './worker-observability';
```

- [x] **Step 4: Run contract verification**

Run:

```powershell
bun packages/types/tests/worker-observability.test.mts
bun --cwd packages/types typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add packages/types/src/api/worker-observability.ts packages/types/src/api/index.ts packages/types/tests/worker-observability.test.mts
git commit -m "feat(types): add worker observability contract"
```

## Task 2: Server Heartbeat And Summary

**Files:**
- Modify: `apps/server/src/config/env.ts`
- Create: `apps/server/src/worker-observability/worker-observability.constants.ts`
- Create: `apps/server/src/worker-observability/worker-heartbeat.service.ts`
- Create: `apps/server/src/worker-observability/worker-observability.service.ts`
- Create: `apps/server/src/worker-observability/worker-heartbeat.service.spec.ts`
- Create: `apps/server/src/worker-observability/worker-observability.service.spec.ts`

- [x] **Step 1: Write heartbeat failing tests**

Create `apps/server/src/worker-observability/worker-heartbeat.service.spec.ts`:

```ts
import { WorkerHeartbeatService } from './worker-heartbeat.service';

describe('WorkerHeartbeatService', () => {
  const redis = {
    set: jest.fn(),
    del: jest.fn(),
  };
  const queue = {
    client: Promise.resolve(redis),
  };
  const logger = {
    warn: jest.fn(),
    log: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    redis.set.mockReset();
    redis.del.mockReset();
    logger.warn.mockReset();
    logger.log.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not write heartbeat for api role', async () => {
    const service = new WorkerHeartbeatService(queue as never, {
      role: 'api',
      heartbeatIntervalMs: 15_000,
      heartbeatTtlSeconds: 45,
      prefix: 'prepmind',
      now: () => new Date('2026-07-05T10:00:00.000Z'),
      workerId: 'api-1',
      logger,
    });

    await service.onModuleInit();

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('writes a ttl heartbeat for worker role', async () => {
    const service = new WorkerHeartbeatService(queue as never, {
      role: 'worker',
      heartbeatIntervalMs: 15_000,
      heartbeatTtlSeconds: 45,
      prefix: 'prepmind',
      now: () => new Date('2026-07-05T10:00:00.000Z'),
      workerId: 'worker-1',
      logger,
    });

    await service.onModuleInit();

    expect(redis.set).toHaveBeenCalledWith(
      'prepmind:worker-heartbeat:worker-1',
      expect.stringContaining('"serverRole":"worker"'),
      'EX',
      45,
    );
  });
});
```

- [x] **Step 2: Run heartbeat tests to verify failure**

Run:

```powershell
bun --filter @repo/server test -- worker-heartbeat
```

Expected: FAIL because `WorkerHeartbeatService` does not exist.

- [x] **Step 3: Implement heartbeat constants and service**

Create `apps/server/src/worker-observability/worker-observability.constants.ts`:

```ts
export const DOCUMENT_PROCESSING_QUEUE_NAME = PROCESS_KNOWLEDGE_DOCUMENT_QUEUE;
export const WORKER_HEARTBEAT_QUEUE_NAMES = [DOCUMENT_PROCESSING_QUEUE_NAME] as const;

export function createWorkerHeartbeatKey(prefix: string, workerId: string) {
  return `${prefix}:worker-heartbeat:${workerId}`;
}
```

Create `apps/server/src/worker-observability/worker-heartbeat.service.ts`:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/document-processing-job.service';
import {
  createWorkerHeartbeatKey,
  WORKER_HEARTBEAT_QUEUE_NAMES,
} from './worker-observability.constants';

type RedisLike = {
  set: (key: string, value: string, mode: 'EX', ttlSeconds: number) => Promise<unknown>;
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
    @InjectQueue(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE) private readonly queue: Queue,
    optionsOrConfig: WorkerHeartbeatOptions | ConfigService<ServerEnv, true>,
  ) {
    const options =
      optionsOrConfig instanceof ConfigService
        ? {
            role: optionsOrConfig.get('SERVER_ROLE', { infer: true }),
            heartbeatIntervalMs: optionsOrConfig.get('WORKER_HEARTBEAT_INTERVAL_MS', {
              infer: true,
            }),
            heartbeatTtlSeconds: optionsOrConfig.get('WORKER_HEARTBEAT_TTL_SECONDS', {
              infer: true,
            }),
            prefix: optionsOrConfig.get('BULLMQ_PREFIX', { infer: true }),
          }
        : optionsOrConfig;

    this.role = options.role;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs;
    this.heartbeatTtlSeconds = options.heartbeatTtlSeconds;
    this.prefix = options.prefix;
    this.workerId =
      options.workerId ?? `${os.hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
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
    if (this.timer) clearInterval(this.timer);
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
    } catch (error) {
      this.logger.warn(
        `Worker heartbeat write failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async getRedis() {
    return (await this.queue.client) as unknown as RedisLike;
  }
}
```

- [x] **Step 4: Write summary signal failing tests**

Create `apps/server/src/worker-observability/worker-observability.service.spec.ts`:

```ts
import { WorkerObservabilityService } from './worker-observability.service';

describe('WorkerObservabilityService', () => {
  it('reports attention when queue has backlog without heartbeat', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: { waiting: 2, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 },
      heartbeats: [],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('attention');
    expect(result.signals.queueBacklogWithoutWorker).toBe(true);
  });

  it('reports healthy when queue mode has a recent heartbeat and no failures', async () => {
    const service = createService({
      role: 'api',
      mode: 'queue',
      counts: { waiting: 0, active: 1, delayed: 0, completed: 2, failed: 0, paused: 0 },
      heartbeats: [
        {
          workerId: 'worker-1',
          serverRole: 'worker',
          queues: ['knowledge-document-processing'],
          startedAt: '2026-07-05T10:00:00.000Z',
          lastSeenAt: '2026-07-05T10:00:15.000Z',
        },
      ],
    });

    const result = await service.getSummary('user-1');

    expect(result.signals.status).toBe('healthy');
    expect(result.workers.onlineCount).toBe(1);
  });
});
```

Use helper fakes for queue, heartbeat repository, config, and `BackgroundJobsService.getSummary()`.

- [x] **Step 5: Implement summary service**

Create `apps/server/src/worker-observability/worker-observability.service.ts` with:

- `getSummary(userId: string)`.
- `queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused')`.
- `queue.isPaused()`.
- heartbeat loading from Redis keys `${prefix}:worker-heartbeat:*`.
- `BackgroundJobsService.getSummary(userId)`.
- signal priority: attention -> degraded -> healthy -> idle.

- [x] **Step 6: Add env vars**

Modify `apps/server/src/config/env.ts`:

```ts
WORKER_HEARTBEAT_INTERVAL_MS: z.coerce
  .number()
  .int()
  .min(1_000)
  .max(300_000)
  .default(15_000),
WORKER_HEARTBEAT_TTL_SECONDS: z.coerce
  .number()
  .int()
  .min(5)
  .max(600)
  .default(45),
```

- [x] **Step 7: Run server service tests**

Run:

```powershell
bun --filter @repo/server test -- worker-heartbeat worker-observability.service
```

Expected: PASS.

- [x] **Step 8: Commit**

```powershell
git add apps/server/src/config/env.ts apps/server/src/worker-observability
git commit -m "feat(server): add worker heartbeat and queue summary"
```

## Task 3: Server API And OpenAPI Coverage

**Files:**
- Create: `apps/server/src/worker-observability/worker-observability.controller.ts`
- Create: `apps/server/src/worker-observability/worker-observability.module.ts`
- Create: `apps/server/src/worker-observability/worker-observability.controller.spec.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `apps/server/src/config/swagger.spec.ts`

- [x] **Step 1: Write controller failing test**

Create `apps/server/src/worker-observability/worker-observability.controller.spec.ts`:

```ts
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkerObservabilityController } from './worker-observability.controller';

describe('WorkerObservabilityController', () => {
  it('uses JwtAuthGuard on the controller', () => {
    const guards = Reflect.getMetadata('__guards__', WorkerObservabilityController) ?? [];
    expect(guards).toContain(JwtAuthGuard);
  });

  it('returns service summary for current user', async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ signals: { status: 'idle' } }),
    };
    const controller = new WorkerObservabilityController(service as never);

    await expect(controller.summary({ userId: 'user-1' } as never)).resolves.toEqual({
      signals: { status: 'idle' },
    });
    expect(service.getSummary).toHaveBeenCalledWith('user-1');
  });
});
```

- [x] **Step 2: Run controller test to verify failure**

Run:

```powershell
bun --filter @repo/server test -- worker-observability.controller
```

Expected: FAIL because controller does not exist.

- [x] **Step 3: Implement controller and module**

Create controller with:

```ts
@ApiTags('Worker Observability')
@UseGuards(JwtAuthGuard)
@Controller('worker-observability')
export class WorkerObservabilityController {
  constructor(private readonly service: WorkerObservabilityService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.userId);
  }
}
```

Create module importing `JobsModule`, `BackgroundJobsModule`, and `BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE })`.

Modify `apps/server/src/app.module.ts` to import `WorkerObservabilityModule`.

- [x] **Step 4: Extend Swagger test**

Update `apps/server/src/config/swagger.spec.ts` controller list and required operation list to include:

```ts
['get', '/worker-observability/summary']
```

- [x] **Step 5: Run API tests**

Run:

```powershell
bun --filter @repo/server test -- worker-observability swagger
```

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add apps/server/src/app.module.ts apps/server/src/worker-observability apps/server/src/config/swagger.spec.ts
git commit -m "feat(server): expose worker observability summary"
```

## Task 4: Web API, Hook, And View Helpers

**Files:**
- Create: `apps/web/src/lib/worker-observability-api.ts`
- Create: `apps/web/src/lib/worker-observability-view.ts`
- Create: `apps/web/src/lib/worker-observability-api.test.mts`
- Create: `apps/web/src/lib/worker-observability-view.test.mts`
- Create: `apps/web/src/hooks/use-worker-observability.ts`

- [x] **Step 1: Write failing web API test**

Create `apps/web/src/lib/worker-observability-api.test.mts`:

```ts
import assert from 'node:assert/strict';

import { createWorkerObservabilityApi } from './worker-observability-api';

const api = createWorkerObservabilityApi({
  get: async (path, options) => {
    assert.equal(path, '/worker-observability/summary');
    assert.equal(options?.accessToken, 'token-1');
    return {
      server: { role: 'api', knowledgeProcessingMode: 'queue' },
      queue: {
        name: 'knowledge-document-processing',
        counts: { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, paused: 0 },
        isPaused: false,
        hasBacklog: false,
      },
      workers: { heartbeatTtlSeconds: 45, onlineCount: 0, latestHeartbeat: null },
      backgroundJobs: {
        activeCount: 0,
        failedCount: 0,
        staleSkippedCount: 0,
        succeededCount: 0,
        totalRecentCount: 0,
        latestJob: null,
      },
      signals: {
        status: 'idle',
        hasWorkerHeartbeat: false,
        queueModeWithoutWorker: true,
        queueBacklogWithoutWorker: false,
        hasRecentFailures: false,
        message: '后台处理空闲。',
      },
    };
  },
});

const result = await api.getSummary('token-1');
assert.equal(result.signals.status, 'idle');
```

- [x] **Step 2: Run web API test to verify failure**

Run:

```powershell
bun apps/web/src/lib/worker-observability-api.test.mts
```

Expected: FAIL because API file does not exist.

- [x] **Step 3: Implement web API**

Create `apps/web/src/lib/worker-observability-api.ts`:

```ts
import {
  workerObservabilitySummaryResponseSchema,
  type WorkerObservabilitySummaryResponse,
} from '@repo/types/api/worker-observability';

import { apiClient } from './api-client.ts';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createWorkerObservabilityApi(client: ApiClient) {
  return {
    async getSummary(accessToken: string): Promise<WorkerObservabilitySummaryResponse> {
      return workerObservabilitySummaryResponseSchema.parse(
        await client.get<unknown>('/worker-observability/summary', { accessToken }),
      );
    },
  };
}

export const workerObservabilityApi = createWorkerObservabilityApi(apiClient);
```

- [x] **Step 4: Write view helper tests**

Create `apps/web/src/lib/worker-observability-view.test.mts` asserting:

- `healthy` maps to `worker 在线`.
- `attention` maps to warning tone.
- `degraded` maps to danger tone.
- missing summary maps to `后台健康状态暂不可用`.

- [x] **Step 5: Implement view helper and hook**

Create `apps/web/src/lib/worker-observability-view.ts` with `getWorkerObservabilityTone()`, `getWorkerObservabilityWorkerLabel()`, and `getWorkerObservabilityUnavailableMessage()`.

Create `apps/web/src/hooks/use-worker-observability.ts` with:

```ts
export const workerObservabilityQueryKeys = {
  all: ['worker-observability'] as const,
  summary: () => [...workerObservabilityQueryKeys.all, 'summary'] as const,
};
```

and a `useWorkerObservabilitySummary()` query gated by `sessionHydrated && !!accessToken`.

- [x] **Step 6: Run web helper tests**

Run:

```powershell
bun apps/web/src/lib/worker-observability-api.test.mts
bun apps/web/src/lib/worker-observability-view.test.mts
```

Expected: PASS.

- [x] **Step 7: Commit**

```powershell
git add apps/web/src/lib/worker-observability-api.ts apps/web/src/lib/worker-observability-view.ts apps/web/src/lib/worker-observability-api.test.mts apps/web/src/lib/worker-observability-view.test.mts apps/web/src/hooks/use-worker-observability.ts
git commit -m "feat(web): add worker observability client"
```

## Task 5: Knowledge Page Integration

**Files:**
- Modify: `apps/web/src/app/(main)/knowledge/page.tsx`
- Modify: `apps/web/src/lib/knowledge-view.test.mts` or create `apps/web/src/lib/worker-observability-ui-integration.test.mts`

- [x] **Step 1: Write failing UI helper integration test**

Create `apps/web/src/lib/worker-observability-ui-integration.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  getWorkerObservabilityTone,
  getWorkerObservabilityWorkerLabel,
} from './worker-observability-view';

assert.equal(getWorkerObservabilityTone('attention'), 'warning');
assert.equal(
  getWorkerObservabilityWorkerLabel({
    onlineCount: 0,
    latestHeartbeat: null,
    heartbeatTtlSeconds: 45,
  }),
  '暂未检测到 worker',
);
```

- [x] **Step 2: Run the integration helper test**

Run:

```powershell
bun apps/web/src/lib/worker-observability-ui-integration.test.mts
```

Expected: PASS if Task 4 helpers are present; FAIL if labels need adjustment.

- [x] **Step 3: Integrate into page**

Modify `apps/web/src/app/(main)/knowledge/page.tsx`:

- Import `useWorkerObservabilitySummary`.
- Import view helpers.
- Call `const workerObservabilityQuery = useWorkerObservabilitySummary({ refetchInterval })`.
- Add `<WorkerObservabilityStrip />` near `KnowledgeSummaryCard`.
- Keep the strip compact and mobile-safe.

Component behavior:

- Loading: show `后台健康状态检查中` with neutral tone.
- Error: show `后台健康状态暂不可用`.
- Data: show `signals.message`, worker label, and counts for waiting / active / failed.

- [x] **Step 4: Run web tests**

Run:

```powershell
bun --filter @repo/web test -- worker-observability knowledge-view
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add apps/web/src/app/(main)/knowledge/page.tsx apps/web/src/lib/worker-observability-ui-integration.test.mts
git commit -m "feat(web): show worker observability on knowledge page"
```

## Task 6: Docs, Blog, Verification, Merge

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/roadmap.md`
- Create: `docs/blogs/phase-7-worker-observability.md`

- [x] **Step 1: Update docs**

Document:

- Phase 7.7 completion.
- `GET /worker-observability/summary`.
- Redis heartbeat and TTL.
- Queue counts are system-level; BackgroundJob summary is account-level.
- `WORKER_OBSERVABILITY_ENABLED` defaults to disabled in production.
- No live model smoke needed.

- [x] **Step 2: Write interview blog**

Create `docs/blogs/phase-7-worker-observability.md` with sections:

- “为什么 BackgroundJob 不等于 worker 在线”
- “Redis heartbeat 解决了什么问题”
- “Queue counts、heartbeat、BackgroundJob 三类信号怎么互补”
- “为什么 worker-only 仍然不做 HTTP health”
- “面试怎么讲”

- [x] **Step 3: Run final verification**

Run:

```powershell
bun --cwd packages/types typecheck
bun packages/types/tests/worker-observability.test.mts
bun --filter @repo/server test -- worker-observability
bun --filter @repo/web test -- worker-observability knowledge
bun --filter @repo/server build
bun --filter @repo/web build
docker compose -f docker/docker-compose.dev.yml --profile worker config
git diff --check
```

Expected: all pass. Docker Compose may print the existing `version is obsolete` warning; it is acceptable if exit code is 0.

- [x] **Step 4: Commit docs**

```powershell
git add AGENTS.md DEVLOG.md docs/data-flow.md docs/dev-start.md docs/roadmap.md docs/blogs/phase-7-worker-observability.md
git commit -m "docs: explain phase 7 worker observability"
```

- [x] **Step 5: Merge and push**

Run:

```powershell
git switch main
git merge --no-ff codex/phase-7-worker-observability -m "merge: phase 7 worker observability"
bun --filter @repo/server test -- worker-observability
bun --filter @repo/server build
git push origin main
git branch -d codex/phase-7-worker-observability
```

Expected: merge succeeds, focused verification passes on `main`, and `origin/main` receives Phase 7.7.
