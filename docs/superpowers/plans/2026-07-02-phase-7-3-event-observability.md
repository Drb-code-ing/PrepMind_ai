# Phase 7.3 Event Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small production-oriented observability slice for Phase 7 background jobs: safer in-process events, a typed job summary API, frontend summary helpers, and interview-ready documentation.

**Architecture:** Keep `InProcessEventBus` as a non-persistent process-local bus, but make publish resilient to handler failures. Add a read-only `GET /background-jobs/summary` endpoint backed by `BackgroundJobsService.getSummary(userId)`, then consume it from the web app through typed API/hook/view helpers.

**Tech Stack:** TypeScript, Zod, Bun test, NestJS 11, Prisma, PostgreSQL, Next.js 16, TanStack Query.

---

## File Map

- Modify `packages/types/src/api/background-job.ts`: add summary schema and type.
- Modify `packages/types/tests/background-job.test.mts`: cover summary schema parsing.
- Modify `apps/server/src/events/event-bus.ts`: make `publish()` isolate handler failures and return a typed publish result.
- Modify `apps/server/src/events/event-bus.spec.ts`: cover handler failure isolation.
- Modify `apps/server/src/background-jobs/background-jobs.service.ts`: add `getSummary(userId)`.
- Modify `apps/server/src/background-jobs/background-jobs.service.spec.ts`: cover summary counts and latest job.
- Modify `apps/server/src/background-jobs/background-jobs.controller.ts`: add `GET /background-jobs/summary` before `GET /:id`.
- Modify `apps/web/src/lib/background-job-api.ts`: add `getSummary()`.
- Modify `apps/web/src/lib/background-job-api.test.mts`: cover summary API parsing.
- Modify `apps/web/src/hooks/use-background-jobs.ts`: add `useBackgroundJobSummary()`.
- Create `apps/web/src/lib/background-job-view.ts`: add summary text/tone helper.
- Create `apps/web/src/lib/background-job-view.test.mts`: cover active, failed, stale, and quiet states.
- Modify `apps/web/src/app/(main)/knowledge/page.tsx`: show a small background job summary band.
- Modify `AGENTS.md`, `docs/data-flow.md`, `docs/roadmap.md`, and `docs/ai-behavior-acceptance.md`: record Phase 7.3.
- Create `docs/blogs/phase-7-event-observability.md`: write after implementation and verification.

## Task 1: Design and Execution Documents

- [ ] **Step 1: Write design and implementation plan**

Create:

- `docs/superpowers/specs/2026-07-02-phase-7-3-event-observability-design.md`
- `docs/superpowers/plans/2026-07-02-phase-7-3-event-observability.md`

- [ ] **Step 2: Self-review docs**

Run:

```powershell
$pattern = ('T' + 'BD') + '|' + ('TO' + 'DO') + '|' + ('implement ' + 'later') + '|' + ('fill in ' + 'details')
rg -n $pattern docs/superpowers/specs/2026-07-02-phase-7-3-event-observability-design.md docs/superpowers/plans/2026-07-02-phase-7-3-event-observability.md
```

Expected: no matches.

- [ ] **Step 3: Commit docs**

```powershell
git add docs/superpowers/specs/2026-07-02-phase-7-3-event-observability-design.md docs/superpowers/plans/2026-07-02-phase-7-3-event-observability.md
git commit -m "docs: plan phase 7 event observability"
```

## Task 2: EventBus Failure Isolation

- [ ] **Step 1: Write failing EventBus test**

Add a test to `apps/server/src/events/event-bus.spec.ts`:

```ts
it('continues publishing when one subscriber throws', () => {
  const bus = new InProcessEventBus();
  const received: string[] = [];

  bus.subscribe('knowledge.document.processing.failed', () => {
    throw new Error('subscriber failed');
  });
  bus.subscribe('knowledge.document.processing.failed', (event) => {
    received.push(event.documentId);
  });

  const result = bus.publish({
    type: 'knowledge.document.processing.failed',
    userId: 'user_1',
    documentId: 'doc_1',
    backgroundJobId: 'job_1',
    errorCode: 'PARSE_FAILED',
    retryable: false,
    finishedAt: '2026-07-02T00:00:00.000Z',
  });

  expect(received).toEqual(['doc_1']);
  expect(result).toEqual({ delivered: 1, failed: 1 });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
bun --filter @repo/server test -- event-bus
```

Expected: fail because `publish()` currently returns `void` and throws from the first failed handler.

- [ ] **Step 3: Implement minimal EventBus publish result**

Update `publish(event)` to catch handler errors and return `{ delivered, failed }`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
bun --filter @repo/server test -- event-bus
git add apps/server/src/events/event-bus.ts apps/server/src/events/event-bus.spec.ts
git commit -m "feat(server): isolate event bus handlers"
```

## Task 3: Background Job Summary Contract and Server API

- [ ] **Step 1: Write failing type tests**

In `packages/types/tests/background-job.test.mts`, add a test that parses:

```ts
backgroundJobSummaryResponseSchema.parse({
  activeCount: 1,
  failedCount: 2,
  staleSkippedCount: 1,
  succeededCount: 3,
  totalRecentCount: 7,
  latestJob: null,
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
bun --cwd packages/types test background-job
```

Expected: fail because `backgroundJobSummaryResponseSchema` is not exported.

- [ ] **Step 3: Add schema and type**

Add `backgroundJobSummaryResponseSchema` and `BackgroundJobSummaryResponse` to `packages/types/src/api/background-job.ts`.

- [ ] **Step 4: Add failing server service/controller tests**

In `apps/server/src/background-jobs/background-jobs.service.spec.ts`, add a test for `getSummary('user_1')` that verifies active, failed, stale, succeeded, total, and latest job are mapped from mocked `findMany()` results.

In a controller-level test if available, or service-level coverage plus a route declaration check if not, verify `summary` is handled before `:id`.

- [ ] **Step 5: Verify RED**

Run:

```powershell
bun --filter @repo/server test -- background-jobs
```

Expected: fail because `getSummary()` and controller route do not exist.

- [ ] **Step 6: Implement service and controller**

Add:

```ts
@Get('summary')
summary(@CurrentUser() user: AuthenticatedUser) {
  return this.service.getSummary(user.id);
}
```

Add `getSummary(userId)` in `BackgroundJobsService`, using `findMany({ where: { userId }, orderBy, take: 50, select })`.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```powershell
bun --cwd packages/types test background-job
bun --filter @repo/server test -- background-jobs
git add packages/types/src/api/background-job.ts packages/types/tests/background-job.test.mts apps/server/src/background-jobs/background-jobs.service.ts apps/server/src/background-jobs/background-jobs.service.spec.ts apps/server/src/background-jobs/background-jobs.controller.ts
git commit -m "feat(server): add background job summary"
```

## Task 4: Web Background Job Summary Client and View Helper

- [ ] **Step 1: Write failing web tests**

Add tests for:

- `backgroundJobApi.getSummary()` calls `/background-jobs/summary`.
- `getBackgroundJobSummaryView()` returns active, failed, stale, and quiet states.

- [ ] **Step 2: Verify RED**

Run:

```powershell
bun --filter @repo/web test -- background-job
```

Expected: fail because summary client/view helper does not exist.

- [ ] **Step 3: Implement web client, hook, and helper**

Add `getSummary()` to `background-job-api.ts`, `useBackgroundJobSummary()` to `use-background-jobs.ts`, and `background-job-view.ts`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
bun --filter @repo/web test -- background-job
git add apps/web/src/lib/background-job-api.ts apps/web/src/lib/background-job-api.test.mts apps/web/src/hooks/use-background-jobs.ts apps/web/src/lib/background-job-view.ts apps/web/src/lib/background-job-view.test.mts
git commit -m "feat(web): add background job summary view"
```

## Task 5: Knowledge Page Integration

- [ ] **Step 1: Write failing knowledge view/page test**

Extend `apps/web/src/lib/knowledge-view.test.mts` or page-adjacent helper tests to assert the summary view can be shown without altering document polling behavior.

- [ ] **Step 2: Verify RED**

Run:

```powershell
bun --filter @repo/web test -- knowledge-view
```

Expected: fail until the helper/page integration exists.

- [ ] **Step 3: Implement `/knowledge` summary band**

Use `useBackgroundJobSummary()` and `getBackgroundJobSummaryView()` in the page. Poll summary only while active jobs exist or processing documents are present.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
bun --filter @repo/web test -- knowledge-view
git add apps/web/src/app/(main)/knowledge/page.tsx apps/web/src/lib/knowledge-view.test.mts
git commit -m "feat(web): show background job summary"
```

## Task 6: Documentation and Interview Blog

- [ ] **Step 1: Update project docs**

Update `AGENTS.md`, `docs/data-flow.md`, `docs/roadmap.md`, and `docs/ai-behavior-acceptance.md` with Phase 7.3 status and acceptance notes.

- [ ] **Step 2: Write detailed blog**

Create `docs/blogs/phase-7-event-observability.md` covering:

- why synchronous long tasks are fragile;
- why queue alone is not enough without observable state;
- how in-process EventBus differs from persistent outbox;
- how summary API helps UI and debugging;
- what problems appeared during implementation and how they were solved;
- interview talking points.

- [ ] **Step 3: Verify docs and commit**

Run:

```powershell
rg -n "Phase 7.3|EventBus|background job summary|后台任务摘要" AGENTS.md docs
git add AGENTS.md docs/data-flow.md docs/roadmap.md docs/ai-behavior-acceptance.md docs/blogs/phase-7-event-observability.md
git commit -m "docs: document phase 7 event observability"
```

## Task 7: Final Verification

- [ ] **Step 1: Run focused checks**

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/types test
bun --filter @repo/server test -- event-bus background-jobs
bun --filter @repo/web test -- background-job knowledge-view
```

- [ ] **Step 2: Run broader build checks**

```powershell
bun --filter @repo/server build
bun --filter @repo/web build
git diff --check
git status --short --branch
```

- [ ] **Step 3: Final commit if verification changes docs**

Only commit if verification caused intentional documentation or metadata changes.
