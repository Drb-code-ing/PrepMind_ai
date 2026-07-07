# Phase 7.9.4 Outbox Summary / Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe outbox summary metrics to the existing Worker Observability response.

**Architecture:** Add a focused `OutboxMetricsService` in `apps/server/src/outbox`, export it from `OutboxModule`, and inject it into `WorkerObservabilityService`. Keep the summary read-only, system-level, and payload-free.

**Tech Stack:** NestJS 11, Prisma, Zod contracts in `@repo/types`, Jest, Bun workspace, TypeScript strict.

---

## File Structure

- Modify `packages/types/src/api/worker-observability.ts`
  - Add outbox counts, recent error summary, and new signal flags.
- Create `apps/server/src/outbox/outbox-metrics.service.ts`
  - Computes safe outbox summary from Prisma.
- Create `apps/server/src/outbox/outbox-metrics.service.spec.ts`
  - Tests counts, oldest pending age, recent error redaction.
- Modify `apps/server/src/outbox/outbox.module.ts`
  - Provide and export `OutboxMetricsService`.
- Modify `apps/server/src/worker-observability/worker-observability.service.ts`
  - Include outbox summary and update health signals.
- Modify `apps/server/src/worker-observability/worker-observability.service.spec.ts`
  - Update helpers and add outbox-specific assertions.
- Modify `apps/server/src/worker-observability/worker-observability.module.ts`
  - Import `OutboxModule` and inject `OutboxMetricsService`.
- Modify docs after verification:
  - `AGENTS.md`
  - `DEVLOG.md`
  - `docs/ai-behavior-acceptance.md`

---

## Task 1: Extend Worker Observability Contract

**Files:**
- Modify: `packages/types/src/api/worker-observability.ts`

- [ ] **Step 1: Update Zod schema**

Add these schemas before `workerObservabilitySummaryResponseSchema`:

```ts
export const workerObservabilityOutboxStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'FAILED',
  'DEAD',
]);

export const workerObservabilityOutboxCountsSchema = z.object({
  pending: z.number().int().min(0),
  processing: z.number().int().min(0),
  succeeded: z.number().int().min(0),
  failed: z.number().int().min(0),
  dead: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const workerObservabilityOutboxRecentErrorSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: workerObservabilityOutboxStatusSchema,
  lastErrorCode: z.string().min(1).nullable(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  updatedAt: z.string().datetime(),
});

export const workerObservabilityOutboxSummarySchema = z.object({
  counts: workerObservabilityOutboxCountsSchema,
  hasBacklog: z.boolean(),
  oldestPendingAgeMs: z.number().int().min(0).nullable(),
  recentErrors: z.array(workerObservabilityOutboxRecentErrorSchema),
});
```

Add `outbox` and new signals:

```ts
  outbox: workerObservabilityOutboxSummarySchema,
```

```ts
    hasOutboxBacklog: z.boolean(),
    hasDeadOutboxEvents: z.boolean(),
```

Add exported types:

```ts
export type WorkerObservabilityOutboxSummary = z.infer<
  typeof workerObservabilityOutboxSummarySchema
>;
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit contract**

Run:

```powershell
git add packages/types/src/api/worker-observability.ts
git commit -m "feat(types): add outbox observability summary"
```

Expected: commit succeeds.

---

## Task 2: Add OutboxMetricsService With TDD

**Files:**
- Create: `apps/server/src/outbox/outbox-metrics.service.spec.ts`
- Create: `apps/server/src/outbox/outbox-metrics.service.ts`

- [ ] **Step 1: Write failing metrics tests**

Create `apps/server/src/outbox/outbox-metrics.service.spec.ts`:

```ts
import { OutboxMetricsService } from './outbox-metrics.service';

describe('OutboxMetricsService', () => {
  const now = new Date('2026-07-07T03:00:00.000Z');
  const prisma = {
    outboxEvent: {
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.outboxEvent.groupBy.mockResolvedValue([]);
    prisma.outboxEvent.findFirst.mockResolvedValue(null);
    prisma.outboxEvent.findMany.mockResolvedValue([]);
  });

  it('summarizes outbox counts and backlog', async () => {
    prisma.outboxEvent.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'PROCESSING', _count: { _all: 1 } },
      { status: 'SUCCEEDED', _count: { _all: 5 } },
      { status: 'DEAD', _count: { _all: 1 } },
    ]);

    const result = await createService().getSummary(now);

    expect(result.counts).toEqual({
      pending: 2,
      processing: 1,
      succeeded: 5,
      failed: 0,
      dead: 1,
      total: 9,
    });
    expect(result.hasBacklog).toBe(true);
  });

  it('computes oldest pending age in milliseconds', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue({
      id: 'evt_old',
      createdAt: new Date('2026-07-07T02:59:30.000Z'),
    });

    const result = await createService().getSummary(now);

    expect(result.oldestPendingAgeMs).toBe(30000);
  });

  it('returns null oldest pending age when no pending event exists', async () => {
    const result = await createService().getSummary(now);

    expect(result.oldestPendingAgeMs).toBeNull();
  });

  it('returns only safe recent error fields', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'evt_1',
        type: 'knowledge.document.processing.requested',
        status: 'DEAD',
        lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
        lastError: 'secret should not leave service',
        aggregateId: 'doc_secret',
        payload: { prompt: 'do not leak' },
        attempts: 5,
        maxAttempts: 5,
        updatedAt: new Date('2026-07-07T03:00:00.000Z'),
      },
    ]);

    const result = await createService().getSummary(now);

    expect(result.recentErrors).toEqual([
      {
        id: 'evt_1',
        type: 'knowledge.document.processing.requested',
        status: 'DEAD',
        lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
        attempts: 5,
        maxAttempts: 5,
        updatedAt: '2026-07-07T03:00:00.000Z',
      },
    ]);
    expect(JSON.stringify(result.recentErrors)).not.toContain('secret');
    expect(JSON.stringify(result.recentErrors)).not.toContain('doc_secret');
    expect(JSON.stringify(result.recentErrors)).not.toContain('prompt');
  });

  function createService() {
    return new OutboxMetricsService(prisma as never);
  }
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- outbox-metrics
```

Expected: FAIL because `outbox-metrics.service` does not exist.

- [ ] **Step 3: Implement metrics service**

Create `apps/server/src/outbox/outbox-metrics.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { OutboxEventStatus } from '@prisma/client';
import type { WorkerObservabilityOutboxSummary } from '@repo/types/api/worker-observability';

import { PrismaService } from '../database/prisma.service';

const outboxStatuses = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'DEAD',
] as const satisfies OutboxEventStatus[];

@Injectable()
export class OutboxMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(now = new Date()): Promise<WorkerObservabilityOutboxSummary> {
    const [groupedCounts, oldestPending, recentErrors] = await Promise.all([
      this.prisma.outboxEvent.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.outboxEvent.findFirst({
        where: { status: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, createdAt: true },
      }),
      this.prisma.outboxEvent.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING', 'FAILED', 'DEAD'] },
          OR: [
            { lastErrorCode: { not: null } },
            { lastError: { not: null } },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          lastErrorCode: true,
          attempts: true,
          maxAttempts: true,
          updatedAt: true,
        },
      }),
    ]);

    const counts = createEmptyCounts();
    for (const row of groupedCounts) {
      counts[toCountKey(row.status)] = row._count._all;
    }
    counts.total = outboxStatuses.reduce(
      (total, status) => total + counts[toCountKey(status)],
      0,
    );

    return {
      counts,
      hasBacklog: counts.pending + counts.processing > 0,
      oldestPendingAgeMs: oldestPending
        ? Math.max(0, now.getTime() - oldestPending.createdAt.getTime())
        : null,
      recentErrors: recentErrors.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        lastErrorCode: event.lastErrorCode,
        attempts: event.attempts,
        maxAttempts: event.maxAttempts,
        updatedAt: event.updatedAt.toISOString(),
      })),
    };
  }
}

function createEmptyCounts(): WorkerObservabilityOutboxSummary['counts'] {
  return {
    pending: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    total: 0,
  };
}

function toCountKey(
  status: OutboxEventStatus,
): keyof Omit<WorkerObservabilityOutboxSummary['counts'], 'total'> {
  return status.toLowerCase() as keyof Omit<
    WorkerObservabilityOutboxSummary['counts'],
    'total'
  >;
}
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- outbox-metrics
bun --cwd apps/server eslint src/outbox
```

Expected: tests and outbox lint PASS.

- [ ] **Step 5: Commit metrics service**

Run:

```powershell
git add apps/server/src/outbox/outbox-metrics.service.ts apps/server/src/outbox/outbox-metrics.service.spec.ts
git commit -m "feat(server): add outbox metrics service"
```

Expected: commit succeeds.

---

## Task 3: Wire Outbox Summary Into Worker Observability

**Files:**
- Modify: `apps/server/src/outbox/outbox.module.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.service.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.service.spec.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.module.ts`

- [ ] **Step 1: Write failing worker observability tests**

Update `apps/server/src/worker-observability/worker-observability.service.spec.ts`:

1. Add an `outbox` mock to `createService()` with default summary:

```ts
const outbox = {
  getSummary: jest.fn().mockResolvedValue(
    input.outbox ?? createOutboxSummary(),
  ),
};
```

2. Pass it into `WorkerObservabilityService`:

```ts
return new WorkerObservabilityService(
  queue as never,
  backgroundJobs as never,
  outbox as never,
  {
    role: input.role,
    knowledgeProcessingMode: input.mode,
    heartbeatTtlSeconds: 45,
    prefix: 'prepmind',
  },
);
```

3. Add helper:

```ts
function createOutboxSummary() {
  return {
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
  };
}
```

4. Add tests:

```ts
it('includes outbox summary in the worker observability response', async () => {
  const service = createService({
    role: 'worker',
    mode: 'queue',
    counts: emptyQueueCounts(),
    heartbeats: [],
    outbox: {
      ...createOutboxSummary(),
      counts: {
        pending: 2,
        processing: 1,
        succeeded: 5,
        failed: 0,
        dead: 0,
        total: 8,
      },
      hasBacklog: true,
      oldestPendingAgeMs: 120000,
    },
  });

  const result = await service.getSummary('user-1');

  expect(result.outbox.hasBacklog).toBe(true);
  expect(result.outbox.oldestPendingAgeMs).toBe(120000);
  expect(result.signals.hasOutboxBacklog).toBe(true);
});

it('reports degraded when outbox has dead events', async () => {
  const service = createService({
    role: 'worker',
    mode: 'queue',
    counts: emptyQueueCounts(),
    heartbeats: [validHeartbeat()],
    outbox: {
      ...createOutboxSummary(),
      counts: {
        pending: 0,
        processing: 0,
        succeeded: 1,
        failed: 0,
        dead: 1,
        total: 2,
      },
      recentErrors: [
        {
          id: 'evt_1',
          type: 'knowledge.document.processing.requested',
          status: 'DEAD',
          lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
          attempts: 5,
          maxAttempts: 5,
          updatedAt: '2026-07-07T03:00:00.000Z',
        },
      ],
    },
  });

  const result = await service.getSummary('user-1');

  expect(result.signals.status).toBe('degraded');
  expect(result.signals.hasDeadOutboxEvents).toBe(true);
  expect(result.signals.hasRecentFailures).toBe(true);
});
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- worker-observability
```

Expected: FAIL because service constructor and response contract do not include outbox yet.

- [ ] **Step 3: Update services and modules**

Implement these changes:

- `OutboxModule` imports and exports `OutboxMetricsService`.
- `WorkerObservabilityModule` imports `OutboxModule` and injects `OutboxMetricsService`.
- `WorkerObservabilityService` constructor accepts `OutboxMetricsService`.
- `getSummary()` includes `this.outbox.getSummary()` in `Promise.all`.
- `hasRecentFailures` includes `outbox.counts.dead > 0`.
- signals include `hasOutboxBacklog` and `hasDeadOutboxEvents`.

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- worker-observability
bun --filter @repo/server test -- outbox
bun --filter @repo/server build
```

Expected: tests and build PASS.

- [ ] **Step 5: Commit integration**

Run:

```powershell
git add packages/types/src/api/worker-observability.ts apps/server/src/outbox/outbox.module.ts apps/server/src/worker-observability/worker-observability.service.ts apps/server/src/worker-observability/worker-observability.service.spec.ts apps/server/src/worker-observability/worker-observability.module.ts
git commit -m "feat(server): expose outbox metrics in worker observability"
```

Expected: commit succeeds.

---

## Task 4: Document Phase 7.9.4

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update phase status**

Add:

```markdown
| Phase 7.9.4 | 已完成 | Outbox Summary / Metrics、worker observability 安全只读指标 |
```

- [ ] **Step 2: Add boundary notes**

Document:

- Outbox summary is system-level and read-only.
- It returns counts, backlog, oldest pending age, and sanitized recent error metadata.
- It does not return payload, lastError body, aggregateId, prompt, chunks, API keys, tokens, cookies, or user content.
- It is exposed only through existing worker observability endpoint and guard.
- No frontend UI, no admin action, no Prometheus/Grafana yet.

- [ ] **Step 3: Commit docs**

Run:

```powershell
rg "Phase 7.9.4|Outbox Summary|outbox summary|OutboxMetricsService" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record outbox summary metrics"
```

Expected: docs committed.

---

## Task 5: Final Verification And Review

**Files:**
- No source edits expected unless verification or review finds a defect.

- [ ] **Step 1: Run targeted verification**

Run:

```powershell
bun --filter @repo/server test -- outbox
bun --filter @repo/server test -- worker-observability
bun --cwd packages/types typecheck
bun --cwd apps/server eslint src/outbox src/worker-observability
bun --filter @repo/server build
bun --cwd packages/database test
git diff --check
```

Expected: all PASS.

- [ ] **Step 2: Dispatch final review**

Ask subagent to review `main...HEAD`, focused on:

- summary does not expose payload / lastError body / aggregateId / user content.
- outbox counts and backlog are correct.
- worker observability status handles dead outbox events.
- module DI compiles.
- docs do not claim frontend, admin API, Prometheus/Grafana, or live-model changes.

Expected: APPROVED, or fix requested issues with tests and commit.

---

## Self-Review

- Spec coverage: The plan covers contract, metrics service, Worker Observability integration, docs, verification, and review.
- Scope control: The plan does not add frontend UI, new HTTP API, admin actions, Prometheus/Grafana, new outbox event types, or live model behavior.
- TDD compliance: Metrics service and Worker Observability integration start with failing tests before production code changes.
