# Phase 7.9.3 Outbox Dispatcher Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled worker-only runtime loop for `OutboxDispatcherService`.

**Architecture:** Keep event claiming and handler execution inside the existing `OutboxDispatcherService`; add a thin lifecycle runner that decides when to call it. The runner is enabled by config, disabled in production by default, and never runs in `SERVER_ROLE=api`.

**Tech Stack:** NestJS 11 lifecycle hooks, ConfigService, Jest, Bun workspace, TypeScript strict.

---

## File Structure

- Modify `apps/server/src/config/env.ts`
  - Add `OUTBOX_DISPATCHER_ENABLED`, `OUTBOX_DISPATCHER_INTERVAL_MS`, `OUTBOX_DISPATCHER_BATCH_SIZE`, and `OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS`.
- Modify `apps/server/src/config/env.spec.ts`
  - Cover default enablement and explicit env overrides.
- Create `apps/server/src/outbox/outbox-dispatcher-runner.service.ts`
  - Implements the lifecycle runner.
- Create `apps/server/src/outbox/outbox-dispatcher-runner.service.spec.ts`
  - Tests role gating, config gating, dispatch args, reentrancy guard, error isolation, and destroy cleanup.
- Modify `apps/server/src/outbox/outbox.module.ts`
  - Register the runner using a factory.
- Modify docs after code is verified:
  - `AGENTS.md`
  - `DEVLOG.md`
  - `docs/ai-behavior-acceptance.md`

---

## Task 1: Add Outbox Dispatcher Env Config With TDD

**Files:**
- Modify: `apps/server/src/config/env.spec.ts`
- Modify: `apps/server/src/config/env.ts`

- [ ] **Step 1: Write failing env tests**

Add these tests to `apps/server/src/config/env.spec.ts`:

```ts
  it('enables outbox dispatcher by default outside production', () => {
    const env = parseEnv(baseEnv());

    expect(env.OUTBOX_DISPATCHER_ENABLED).toBe(true);
    expect(env.OUTBOX_DISPATCHER_INTERVAL_MS).toBe(5000);
    expect(env.OUTBOX_DISPATCHER_BATCH_SIZE).toBe(20);
    expect(env.OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS).toBe(300000);
  });

  it('disables outbox dispatcher by default in production', () => {
    const env = parseEnv(baseEnv({ NODE_ENV: 'production' }));

    expect(env.OUTBOX_DISPATCHER_ENABLED).toBe(false);
  });

  it('allows explicit outbox dispatcher enablement overrides', () => {
    expect(
      parseEnv(
        baseEnv({
          NODE_ENV: 'production',
          OUTBOX_DISPATCHER_ENABLED: 'true',
        }),
      ).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(true);

    expect(
      parseEnv(
        baseEnv({
          NODE_ENV: 'development',
          OUTBOX_DISPATCHER_ENABLED: 'false',
        }),
      ).OUTBOX_DISPATCHER_ENABLED,
    ).toBe(false);
  });

  it('parses outbox dispatcher numeric controls', () => {
    const env = parseEnv(
      baseEnv({
        OUTBOX_DISPATCHER_INTERVAL_MS: '1500',
        OUTBOX_DISPATCHER_BATCH_SIZE: '7',
        OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS: '45000',
      }),
    );

    expect(env.OUTBOX_DISPATCHER_INTERVAL_MS).toBe(1500);
    expect(env.OUTBOX_DISPATCHER_BATCH_SIZE).toBe(7);
    expect(env.OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS).toBe(45000);
  });
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- env
```

Expected: FAIL because the new env fields are not parsed yet.

- [ ] **Step 3: Implement env schema**

Modify `apps/server/src/config/env.ts`:

1. Add `OUTBOX_DISPATCHER_ENABLED` next to other optional booleans:

```ts
    OUTBOX_DISPATCHER_ENABLED: z.preprocess((value) => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'string' && value.trim().length === 0) {
        return undefined;
      }

      return value;
    }, booleanStringSchema.optional()),
```

2. Add numeric controls near worker settings:

```ts
    OUTBOX_DISPATCHER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(5_000),
    OUTBOX_DISPATCHER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
    OUTBOX_DISPATCHER_LOCK_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(300_000),
```

3. Update the exported `ServerEnv` type:

```ts
export type ServerEnv = Omit<
  ParsedServerEnv,
  | 'SWAGGER_ENABLED'
  | 'WORKER_OBSERVABILITY_ENABLED'
  | 'OUTBOX_DISPATCHER_ENABLED'
> & {
  SWAGGER_ENABLED: boolean;
  WORKER_OBSERVABILITY_ENABLED: boolean;
  OUTBOX_DISPATCHER_ENABLED: boolean;
};
```

4. Update `parseEnv()` return value:

```ts
    OUTBOX_DISPATCHER_ENABLED:
      env.OUTBOX_DISPATCHER_ENABLED ?? env.NODE_ENV !== 'production',
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- env
bun --cwd apps/server eslint src/config
```

Expected: env tests and config lint PASS.

- [ ] **Step 5: Commit env config**

Run:

```powershell
git add apps/server/src/config/env.ts apps/server/src/config/env.spec.ts
git commit -m "feat(server): add outbox dispatcher env controls"
```

Expected: commit succeeds.

---

## Task 2: Add OutboxDispatcherRunnerService With TDD

**Files:**
- Create: `apps/server/src/outbox/outbox-dispatcher-runner.service.spec.ts`
- Create: `apps/server/src/outbox/outbox-dispatcher-runner.service.ts`

- [ ] **Step 1: Write failing runner tests**

Create `apps/server/src/outbox/outbox-dispatcher-runner.service.spec.ts`:

```ts
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';

describe('OutboxDispatcherRunnerService', () => {
  const now = new Date('2026-07-07T02:00:00.000Z');
  const dispatcher = { dispatchBatch: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    dispatcher.dispatchBatch.mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not run in api role', async () => {
    const service = createService({ role: 'api', enabled: true });

    await service.onModuleInit();
    jest.advanceTimersByTime(5000);

    expect(dispatcher.dispatchBatch).not.toHaveBeenCalled();
  });

  it('does not run when disabled', async () => {
    const service = createService({ role: 'worker', enabled: false });

    await service.onModuleInit();
    jest.advanceTimersByTime(5000);

    expect(dispatcher.dispatchBatch).not.toHaveBeenCalled();
  });

  it('dispatches immediately and then on interval for worker role', async () => {
    const service = createService({ role: 'worker', enabled: true });

    await service.onModuleInit();
    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(2);
  });

  it('passes configured dispatch controls', async () => {
    const service = createService({
      role: 'both',
      enabled: true,
      workerId: 'outbox-worker-test',
      batchSize: 7,
      lockTimeoutMs: 45000,
    });

    await service.onModuleInit();

    expect(dispatcher.dispatchBatch).toHaveBeenCalledWith({
      workerId: 'outbox-worker-test',
      limit: 7,
      lockTimeoutMs: 45000,
      now,
    });
  });

  it('skips overlapping ticks while a dispatch is running', async () => {
    let resolveDispatch: (value: unknown) => void = () => undefined;
    dispatcher.dispatchBatch.mockReturnValue(
      new Promise((resolve) => {
        resolveDispatch = resolve;
      }),
    );
    const service = createService({ role: 'worker', enabled: true });

    const initPromise = service.onModuleInit();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'Outbox dispatcher tick skipped because a previous tick is still running',
    );

    resolveDispatch({ claimed: 0, succeeded: 0, failed: 0 });
    await initPromise;
  });

  it('logs dispatch failures without throwing', async () => {
    dispatcher.dispatchBatch.mockRejectedValue(new Error('dispatch failed'));
    const service = createService({ role: 'worker', enabled: true });

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      'Outbox dispatcher tick failed: dispatch failed',
    );
  });

  it('clears the timer on destroy', async () => {
    const service = createService({ role: 'worker', enabled: true });

    await service.onModuleInit();
    await service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(1);
  });

  function createService(
    overrides: Partial<{
      role: 'api' | 'worker' | 'both';
      enabled: boolean;
      intervalMs: number;
      batchSize: number;
      lockTimeoutMs: number;
      workerId: string;
    }> = {},
  ) {
    return new OutboxDispatcherRunnerService(dispatcher as never, {
      role: overrides.role ?? 'worker',
      enabled: overrides.enabled ?? true,
      intervalMs: overrides.intervalMs ?? 5000,
      batchSize: overrides.batchSize ?? 20,
      lockTimeoutMs: overrides.lockTimeoutMs ?? 300000,
      workerId: overrides.workerId ?? 'outbox-worker-1',
      now: () => now,
      logger,
    });
  }
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox-dispatcher-runner
```

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement runner service**

Create `apps/server/src/outbox/outbox-dispatcher-runner.service.ts`:

```ts
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

  async onModuleInit() {
    if (!this.shouldRun()) return;

    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  async onModuleDestroy() {
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
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox-dispatcher-runner
bun --cwd apps/server eslint src/outbox
```

Expected: runner tests and outbox lint PASS.

- [ ] **Step 5: Commit runner service**

Run:

```powershell
git add apps/server/src/outbox/outbox-dispatcher-runner.service.ts apps/server/src/outbox/outbox-dispatcher-runner.service.spec.ts
git commit -m "feat(server): add outbox dispatcher runner"
```

Expected: commit succeeds.

---

## Task 3: Register Runner In OutboxModule

**Files:**
- Modify: `apps/server/src/outbox/outbox.module.ts`

- [ ] **Step 1: Write failing module compile test**

Add this test to `apps/server/src/outbox/outbox.dispatcher.spec.ts` or a new module-level describe block:

```ts
import { ConfigService } from '@nestjs/config';
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';

// inside a describe block
it('registers the outbox dispatcher runner provider', async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [OutboxModule],
  }).compile();

  expect(moduleRef.get(OutboxDispatcherRunnerService)).toBeInstanceOf(
    OutboxDispatcherRunnerService,
  );
  expect(moduleRef.get(ConfigService)).toBeInstanceOf(ConfigService);
  await moduleRef.close();
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox.dispatcher
```

Expected: FAIL because `OutboxDispatcherRunnerService` is not registered.

- [ ] **Step 3: Register runner**

Modify `apps/server/src/outbox/outbox.module.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';
import type { ServerEnv } from '../config/env';
```

Add provider:

```ts
    {
      provide: OutboxDispatcherRunnerService,
      inject: [OutboxDispatcherService, ConfigService],
      useFactory: (
        dispatcher: OutboxDispatcherService,
        config: ConfigService<ServerEnv, true>,
      ) => new OutboxDispatcherRunnerService(dispatcher, config),
    },
```

Export is not required unless another module needs direct access. Keep it internal to `OutboxModule`.

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server build
```

Expected: outbox tests and server build PASS.

- [ ] **Step 5: Commit module registration**

Run:

```powershell
git add apps/server/src/outbox/outbox.module.ts apps/server/src/outbox/outbox.dispatcher.spec.ts
git commit -m "feat(server): register outbox dispatcher runner"
```

Expected: commit succeeds.

---

## Task 4: Document Phase 7.9.3

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update phase status**

Update phase tables in `AGENTS.md` and `DEVLOG.md`:

```markdown
| Phase 7.9.3 | 已完成 | Outbox Dispatcher worker-only 受控运行、生产默认关闭、防重入 tick |
```

- [ ] **Step 2: Add boundary notes**

Add concise notes:

- `OutboxDispatcherRunnerService` 在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时运行。
- 非 production 默认开启，production 默认关闭。
- runner 只调用 `OutboxDispatcherService.dispatchBatch()`，不读取 payload，不动态执行 handler。
- 本阶段不新增 HTTP API、前端 UI、Prometheus / Grafana 或 live 模型验收。

- [ ] **Step 3: Update AI behavior acceptance**

Append a section:

```markdown
## 19. Phase 7.9.3 Outbox Dispatcher Runner

Phase 7.9.3 只改变后台 outbox 消费方式，不改变 Chat、RAG prompt、模型路由、Tutor 输出、KnowledgeVerifierAgent guidance 或前端页面行为，因此不要求 live 模型 smoke。

- runner 只在 `SERVER_ROLE=worker | both` 且 `OUTBOX_DISPATCHER_ENABLED=true` 时运行。
- production 默认关闭，避免部署后未经确认消费历史事件。
- runner 只调用显式 dispatcher，不读取 payload、不绕过 handler registry。
- dispatcher tick 失败只能记录 warning，不得打断 worker 进程。
```

- [ ] **Step 4: Run document checks**

Run:

```powershell
rg "Phase 7.9.3|OUTBOX_DISPATCHER|OutboxDispatcherRunnerService" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
```

Expected: `rg` finds the new content and diff check passes.

- [ ] **Step 5: Commit docs**

Run:

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record outbox dispatcher runner"
```

Expected: commit succeeds.

---

## Task 5: Final Verification And Review

**Files:**
- No source edits expected unless verification or review finds a defect.

- [ ] **Step 1: Run targeted tests and lint**

Run:

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server test -- env
bun --cwd apps/server eslint src/outbox src/config
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 3: Run database typecheck**

Run:

```powershell
bun --cwd packages/database test
```

Expected: PASS.

- [ ] **Step 4: Run diff check**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Dispatch final review**

Use a review subagent to inspect `main...HEAD` with focus on:

- runner does not start in api role.
- production default is disabled.
- enabled worker/both roles call dispatcher with the configured controls.
- tick cannot overlap in one process.
- interval errors are swallowed and logged.
- module DI compiles.
- docs do not overstate metrics/frontend/live-model behavior.

Expected: APPROVED, or apply requested fixes with tests and commit.

---

## Self-Review

- Spec coverage: The plan covers env controls, lifecycle runner, module registration, docs, final verification, and review.
- Scope control: The plan does not add HTTP APIs, frontend UI, metrics dashboards, live model behavior, BullMQ repeatable jobs, or new outbox event types.
- TDD compliance: Tasks 1, 2, and 3 start with failing tests before production code changes.
