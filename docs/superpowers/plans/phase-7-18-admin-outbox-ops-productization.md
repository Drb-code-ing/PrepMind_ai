# Phase 7.18 Admin Outbox Ops Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Admin Console Outbox Ops page so an admin can inspect a failed event, understand whether it is safe to requeue, perform the existing safe requeue action, and know where to verify audit/readiness recovery.

**Architecture:** Keep backend APIs unchanged and improve the admin frontend around the existing safe DTOs. Pure decision logic stays in `apps/admin/src/lib/outbox-view.ts` with node tests; page-level UI stays in `apps/admin/src/app/outbox/page.tsx` with a static contract test to prevent dangerous controls or payload exposure.

**Tech Stack:** Next.js admin app, React, TanStack Query, TypeScript, Node test runner, existing `@repo/types/api/outbox` contracts.

---

## File Map

- Modify `apps/admin/src/lib/outbox-view.ts`: pure helper functions for richer error guidance, readonly status explanation, requeue aftercare, and display sections.
- Modify `apps/admin/src/lib/outbox-view.test.mts`: TDD coverage for helper behavior.
- Create `apps/admin/src/lib/outbox-page-contract.test.mts`: static contract test that protects the page structure and safety boundary.
- Modify `apps/admin/src/app/outbox/page.tsx`: restructure the page into lifecycle, identity, diagnosis, action, and aftercare areas; keep existing API calls and permission assumptions.
- Update `DEVLOG.md`: record Phase 7.18 implementation, rationale, boundaries, and verification after code is complete.
- Update `docs/roadmap.md`: mark Phase 7.18 complete after implementation is verified.

## Task 1: Extend Outbox View Helper Tests

**Files:**
- Modify: `apps/admin/src/lib/outbox-view.test.mts`

- [ ] **Step 1: Write failing helper tests**

Add these imports:

```ts
import {
  getOutboxAftercare,
  getOutboxErrorGuidance,
  getOutboxReadOnlyReason,
  getOutboxStatusTone,
  isOutboxEventRequeueable,
  normalizeOutboxReason,
} from './outbox-view.ts';
```

Replace the existing import block if necessary so all imported helpers are listed once.

Append these tests to the file:

```ts
test('invalid payload errors warn operators to fix producer data before requeue', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: 'OUTBOX_INVALID_PAYLOAD',
    lastErrorPreview: 'Outbox event payload documentId must be a non-empty string',
  });

  assert.equal(guidance.tone, 'danger');
  assert.match(guidance.message, /payload|数据|契约/);
  assert.match(guidance.message, /先修复/);
});

test('transient dependency errors allow requeue after dependency recovery', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: 'REDIS_TIMEOUT',
    lastErrorPreview: 'Redis connection timeout while dispatching outbox batch',
  });

  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.message, /依赖|Redis|超时/);
  assert.match(guidance.message, /恢复/);
});

test('unknown errors ask operators to inspect logs and readiness before requeue', () => {
  const guidance = getOutboxErrorGuidance({
    lastErrorCode: null,
    lastErrorPreview: 'Unexpected dispatch failure',
  });

  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.message, /日志|readiness|Worker/i);
});

test('read-only status explains why requeue is unavailable', () => {
  assert.match(getOutboxReadOnlyReason('PENDING'), /等待 worker/);
  assert.match(getOutboxReadOnlyReason('PROCESSING'), /正在处理/);
  assert.match(getOutboxReadOnlyReason('SUCCEEDED'), /已经成功/);
  assert.equal(getOutboxReadOnlyReason('FAILED'), null);
  assert.equal(getOutboxReadOnlyReason('DEAD'), null);
});

test('aftercare explains requeue state-machine behavior and follow-up pages', () => {
  const aftercare = getOutboxAftercare({
    eventId: 'evt_123',
    status: 'PENDING',
    requeued: true,
  });

  assert.match(aftercare.title, /已重新入队/);
  assert.match(aftercare.message, /PENDING/);
  assert.match(aftercare.message, /不会立刻执行 handler/);
  assert.equal(aftercare.links.worker.href, '/worker');
  assert.equal(aftercare.links.audit.href, '/audit');
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/outbox-view.test.mts
```

Expected: FAIL because `getOutboxReadOnlyReason` and `getOutboxAftercare` do not exist, and the current guidance does not classify invalid payload / transient / unknown errors.

- [ ] **Step 3: Commit RED tests**

```powershell
git add apps/admin/src/lib/outbox-view.test.mts
git commit -m "test(admin): cover outbox ops decision guidance"
```

## Task 2: Implement Outbox View Helpers

**Files:**
- Modify: `apps/admin/src/lib/outbox-view.ts`

- [ ] **Step 1: Add helper types and functions**

Update `apps/admin/src/lib/outbox-view.ts` so it exports these functions in addition to the existing helpers:

```ts
export interface OutboxAftercareInput {
  eventId: string;
  status: OutboxEventStatus;
  requeued: boolean;
}

export function getOutboxReadOnlyReason(status: OutboxEventStatus) {
  if (status === 'PENDING') return '事件正在等待 worker claim，当前不需要重新入队。';
  if (status === 'PROCESSING') return '事件正在处理，避免和 worker 并发操作。';
  if (status === 'SUCCEEDED') return '事件已经成功处理，不能重新入队。';
  return null;
}

export function getOutboxAftercare(input: OutboxAftercareInput) {
  if (!input.requeued) {
    return {
      title: '重新入队后如何验证',
      message:
        'requeue 会把 FAILED / DEAD 事件放回 PENDING，等待 worker dispatcher 后续按状态机 claim；它不会立刻执行 handler，也不会修改 payload 或强制成功。',
      links: {
        worker: { href: '/worker', label: '查看 Worker Readiness' },
        audit: { href: '/audit', label: '查看操作审计' },
      },
    };
  }

  return {
    title: `已重新入队：${input.eventId}`,
    message:
      `当前事件已回到 ${input.status}。这不会立刻执行 handler；请等待 worker dispatcher 下一轮 claim，并在 Worker Readiness 和操作审计中确认恢复信号。`,
    links: {
      worker: { href: '/worker', label: '查看 Worker Readiness' },
      audit: { href: '/audit', label: '查看操作审计' },
    },
  };
}
```

- [ ] **Step 2: Strengthen `getOutboxErrorGuidance()`**

Replace the body of `getOutboxErrorGuidance()` with a classifier that preserves the existing handler-missing behavior and adds invalid-payload, transient, and unknown branches:

```ts
export function getOutboxErrorGuidance(input: OutboxErrorGuidanceInput): {
  tone: OutboxTone;
  message: string;
} {
  const code = input.lastErrorCode?.toUpperCase() ?? '';
  const preview = input.lastErrorPreview?.toLowerCase() ?? '';
  const isHandlerMissing =
    code.includes('HANDLER_NOT_FOUND') ||
    code.includes('NO_HANDLER') ||
    preview.includes('no outbox handler') ||
    preview.includes('handler not found') ||
    preview.includes('no handler');

  if (isHandlerMissing) {
    return {
      tone: 'danger',
      message: '这个事件缺少 handler，先修复代码或注册 handler，不要盲目重新入队。',
    };
  }

  const isInvalidPayload =
    code.includes('INVALID_PAYLOAD') ||
    code.includes('INVALID_METADATA') ||
    preview.includes('payload') ||
    preview.includes('metadata') ||
    preview.includes('must be');

  if (isInvalidPayload) {
    return {
      tone: 'danger',
      message: '这个事件的 payload / metadata 数据契约不合法，先修复事件生产方或数据来源，再考虑重新入队。',
    };
  }

  const isTransient =
    code.includes('TIMEOUT') ||
    code.includes('ECONNRESET') ||
    code.includes('ECONNREFUSED') ||
    code.includes('REDIS') ||
    code.includes('DATABASE') ||
    preview.includes('timeout') ||
    preview.includes('timed out') ||
    preview.includes('redis') ||
    preview.includes('database') ||
    preview.includes('connection');

  if (isTransient) {
    return {
      tone: 'warning',
      message: '看起来像依赖连接、Redis、数据库或超时类问题；请确认依赖已经恢复，再重新入队。',
    };
  }

  if (input.lastErrorCode || input.lastErrorPreview) {
    return {
      tone: 'warning',
      message: '错误类型不明确；重新入队前请先查看 worker 日志、Worker Readiness 和相关部署状态。',
    };
  }

  return {
    tone: 'neutral',
    message: '当前事件没有可见错误摘要，操作前请先确认业务上下文。',
  };
}
```

- [ ] **Step 3: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/outbox-view.test.mts
```

Expected: PASS.

- [ ] **Step 4: Commit helper implementation**

```powershell
git add apps/admin/src/lib/outbox-view.ts apps/admin/src/lib/outbox-view.test.mts
git commit -m "feat(admin): clarify outbox requeue guidance"
```

## Task 3: Add Outbox Page Safety Contract Test

**Files:**
- Create: `apps/admin/src/lib/outbox-page-contract.test.mts`

- [ ] **Step 1: Write failing page contract test**

Create `apps/admin/src/lib/outbox-page-contract.test.mts` with:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/admin/src/app/outbox/page.tsx'),
  'utf8',
);

test('outbox page exposes operator workflow sections without payload disclosure', () => {
  assert.match(pageSource, /生命周期/);
  assert.match(pageSource, /事件身份/);
  assert.match(pageSource, /诊断建议/);
  assert.match(pageSource, /重新入队操作/);
  assert.match(pageSource, /后续验证/);
  assert.match(pageSource, /getOutboxAftercare/);
  assert.doesNotMatch(pageSource, />\s*Payload\s*</i);
  assert.doesNotMatch(pageSource, /payload\s*内容|完整 payload|查看 payload/i);
});

test('outbox page keeps dangerous operations out of the UI', () => {
  assert.doesNotMatch(pageSource, /批量重新入队|批量 requeue/i);
  assert.doesNotMatch(pageSource, /删除事件|delete event/i);
  assert.doesNotMatch(pageSource, /强制成功|force success/i);
  assert.doesNotMatch(pageSource, /跳过事件|skip event/i);
  assert.doesNotMatch(pageSource, /直接执行 handler|dispatch now/i);
  assert.doesNotMatch(pageSource, /编辑 payload|edit payload/i);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/outbox-page-contract.test.mts
```

Expected: FAIL because the current page does not yet include the new section labels or `getOutboxAftercare`.

- [ ] **Step 3: Commit RED contract test**

```powershell
git add apps/admin/src/lib/outbox-page-contract.test.mts
git commit -m "test(admin): protect outbox ops safety contract"
```

## Task 4: Restructure Outbox Ops Page

**Files:**
- Modify: `apps/admin/src/app/outbox/page.tsx`

- [ ] **Step 1: Import new helpers**

Update the import from `@/lib/outbox-view` to include:

```ts
  getOutboxAftercare,
  getOutboxReadOnlyReason,
```

- [ ] **Step 2: Add post-requeue state**

Inside `OutboxOpsPanel()`, add state for the latest requeued event:

```ts
  const [lastRequeued, setLastRequeued] = useState<OutboxEventDetailResponse | null>(null);
```

In the list item click handler, clear it:

```ts
setLastRequeued(null);
```

In `onSuccess`, set it:

```ts
setLastRequeued(nextDetail);
```

- [ ] **Step 3: Compute readonly and aftercare values**

After `canRequeue`, add:

```ts
  const readOnlyReason = detail ? getOutboxReadOnlyReason(detail.status) : null;
  const aftercare = getOutboxAftercare({
    eventId: lastRequeued?.id ?? detail?.id ?? '',
    status: lastRequeued?.status ?? detail?.status ?? 'PENDING',
    requeued: Boolean(lastRequeued),
  });
```

- [ ] **Step 4: Replace the detail body with sectioned panels**

Replace the current selected-detail body inside the right `<aside>` with sections named exactly:

```tsx
<DetailSection title="生命周期">
  <div className="grid grid-cols-2 gap-3">
    <KeyValue label="状态" value={detail.status} />
    <KeyValue label="尝试次数" value={`${detail.attempts}/${detail.maxAttempts}`} />
    <KeyValue label="更新时间" value={formatOutboxTime(detail.updatedAt)} />
    <KeyValue label="下次运行" value={formatOutboxTime(detail.nextRunAt)} />
  </div>
</DetailSection>

<DetailSection title="事件身份">
  <KeyValue label="事件 ID" value={detail.id} />
  <KeyValue label="事件类型" value={detail.type} />
  {detailResponse ? <KeyValue label="Payload Hash" value={detailResponse.payloadHash} /> : null}
</DetailSection>

{detailResponse ? (
  <DetailSection title="诊断建议">
    <GuidanceBox detail={detailResponse} />
    {readOnlyReason ? (
      <p className="mt-3 rounded-md border border-[var(--admin-line)] bg-slate-50 px-3 py-2 text-xs leading-5 text-[var(--admin-muted)]">
        {readOnlyReason}
      </p>
    ) : null}
  </DetailSection>
) : null}

<DetailSection title="重新入队操作">
  <p className="text-xs leading-5 text-[var(--admin-muted)]">
    requeue 只会把 FAILED / DEAD 事件安全放回 PENDING，等待 worker dispatcher 后续 claim；它不会立刻执行 handler、不会编辑 payload、不会强制成功。
  </p>
  ...
</DetailSection>

<DetailSection title="后续验证">
  <AftercareBox aftercare={aftercare} />
</DetailSection>
```

Move the existing textarea, confirmation checkbox, button, and notice into the `重新入队操作` section. Keep the existing disabled behavior:

```tsx
disabled={!canRequeue || requeueMutation.isPending}
```

- [ ] **Step 5: Add small presentational helpers**

At the bottom of `page.tsx`, add:

```tsx
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--admin-line)] bg-white p-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function AftercareBox({
  aftercare,
}: {
  aftercare: ReturnType<typeof getOutboxAftercare>;
}) {
  return (
    <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
      <p className="font-semibold">{aftercare.title}</p>
      <p className="mt-1 leading-6">{aftercare.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={aftercare.links.worker.href}
          className="inline-flex min-h-10 items-center rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold"
        >
          {aftercare.links.worker.label}
        </a>
        <a
          href={aftercare.links.audit.href}
          className="inline-flex min-h-10 items-center rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold"
        >
          {aftercare.links.audit.label}
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify page contract GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/outbox-page-contract.test.mts apps/admin/src/lib/outbox-view.test.mts
```

Expected: PASS.

- [ ] **Step 7: Verify admin build-level checks**

Run:

```powershell
bun --filter @repo/admin lint
bun --filter @repo/admin build
```

Expected: both exit 0.

- [ ] **Step 8: Commit page implementation**

```powershell
git add apps/admin/src/app/outbox/page.tsx apps/admin/src/lib/outbox-view.ts apps/admin/src/lib/outbox-view.test.mts apps/admin/src/lib/outbox-page-contract.test.mts
git commit -m "feat(admin): productize outbox ops detail workflow"
```

## Task 5: Browser Acceptance

**Files:**
- No source changes expected unless the browser acceptance reveals a real defect.

- [ ] **Step 1: Ensure Docker stack is running**

If containers are already running with current code, rebuild `admin` only. If not, start full stack:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

If Docker fails under the non-ASCII workspace path, use:

```powershell
subst P: "E:\PrepMind_ai智能备考助手"
$env:COMPOSE_BAKE='false'
docker compose --project-name docker -f P:\docker\docker-compose.dev.yml --project-directory P:\ --profile worker up -d --build postgres redis minio server worker web admin
```

- [ ] **Step 2: Check container status**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

Expected: `admin`, `web`, and `server` are running; `worker` is healthy.

- [ ] **Step 3: Open browser acceptance path**

Open:

```text
http://localhost:3100/outbox
```

Verify:

- ADMIN user can see Outbox Ops.
- Selecting an event shows sections named `生命周期`, `事件身份`, `诊断建议`, `重新入队操作`, and `后续验证`.
- Detail view does not show payload content.
- `PENDING`, `PROCESSING`, and `SUCCEEDED` events show read-only guidance.
- `FAILED` or `DEAD` events require a reason/confirmation before requeue button is enabled.
- After safe requeue, the page shows aftercare text and links to `/worker` and `/audit`.

- [ ] **Step 4: Commit browser-only fixes if needed**

If browser acceptance reveals a source change:

```powershell
git add <changed-files>
git commit -m "fix(admin): polish outbox ops browser workflow"
```

If no source change is needed, skip this commit.

## Task 6: Documentation and Phase Status

**Files:**
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Update `DEVLOG.md`**

Add `Phase 7.18` to the phase table:

```md
| Phase 7.18 | 已完成 | Admin Outbox Ops 产品化、事件详情分区、requeue 后续验证 |
```

Add a recent record with:

- goal: productize Outbox Ops single-event workflow;
- why: admin needs to know failure reason, requeue safety, and follow-up verification;
- main content: lifecycle/identity/diagnosis/action/aftercare sections, stronger guidance, safety contract tests;
- boundaries: no batch requeue, no payload viewer/editor, no delete/force success/direct dispatch, no backend permission changes;
- verification: commands from Task 4 and browser acceptance from Task 5.

- [ ] **Step 2: Update `docs/roadmap.md`**

Change the current Phase 7 status line from `Phase 7.17.1 已完成` to `Phase 7.18 已完成`.

Add a `### Phase 7.18 — Admin Outbox Ops 产品化（已完成）` section after Phase 7.17.1 with:

```md
- Outbox Ops 详情视图按生命周期、事件身份、诊断建议、重新入队操作和后续验证分区。
- requeue 文案明确它只是 `FAILED / DEAD -> PENDING`，不会立刻执行 handler、不会编辑 payload、不会强制成功。
- handler missing、invalid payload、依赖超时和未知错误给出不同操作建议。
- 页面继续不暴露 payload，不提供批量 requeue、删除、force success、skip、direct dispatch 或 payload edit。
- 后端 `JwtAuthGuard + OperatorGuard`、feature gate 和 operator audit 边界保持不变。
```

- [ ] **Step 3: Verify docs**

Run:

```powershell
git diff --check
```

Expected: exit 0.

- [ ] **Step 4: Commit docs**

```powershell
git add DEVLOG.md docs/roadmap.md
git commit -m "docs: record phase 7.18 outbox ops productization"
```

## Task 7: Final Verification and Push

**Files:**
- No source changes expected.

- [ ] **Step 1: Run final focused verification**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
bun --filter @repo/admin lint
bun --filter @repo/admin build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 2: Confirm clean status**

Run:

```powershell
git status --short --branch
```

Expected: branch is clean and ahead only if commits are not pushed.

- [ ] **Step 3: Push branch**

Run:

```powershell
git push
```

Expected: current branch pushes to origin.
