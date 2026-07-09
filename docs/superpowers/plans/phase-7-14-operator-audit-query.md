# Phase 7.14 Operator Audit Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, admin-only read API for operator audit logs so high-privilege diagnostic actions can be reviewed without exposing payloads, prompts, chunks, tokens, cookies, API keys, or raw client fingerprints.

**Architecture:** Keep audit querying in the existing `operator-audit` module. Add a typed API contract in `@repo/types`, a focused Nest service/controller pair, and register the controller behind a feature gate, `JwtAuthGuard`, and `OperatorGuard`. The first version is backend-only; no frontend page or export flow is included.

**Tech Stack:** NestJS 11, Prisma, Zod, `@repo/types`, Jest, TypeScript strict.

---

## Why This Matters

Operator/admin endpoints are production-risk tools, not normal product features. Permission answers "who can do this"; audit answers "who did what, when, why, and what happened after." Without a query API, logs exist only in PostgreSQL and developers must manually inspect the database during incidents. This phase closes that loop with a controlled, redacted API.

For interviews, this is a useful example of engineering maturity:

- High-risk operations are guarded by role checks.
- High-risk operations are recorded even when they fail.
- Audit records are searchable without exposing private payloads.
- Operator observability is intentionally separate from user-facing product UX.

## File Structure

- Create: `packages/types/src/api/operator-audit.ts`
  Defines Zod schemas and response types for audit list queries and redacted DTOs.
- Modify: `packages/types/src/api/index.ts`
  Exports the new operator audit contract.
- Create: `packages/types/tests/operator-audit.test.mts`
  Verifies query parsing, enum validation, default limits, and max limits.
- Modify: `apps/server/src/operator-audit/operator-audit.service.ts`
  Adds `list()` and row-to-DTO mapping while keeping write methods unchanged.
- Create: `apps/server/src/operator-audit/operator-audit.controller.ts`
  Adds `GET /operator-audit-logs` behind feature gate, JWT auth, and operator guard.
- Modify: `apps/server/src/operator-audit/operator-audit.module.ts`
  Registers the new controller.
- Create/modify tests in `apps/server/src/operator-audit/`
  Covers service list behavior, cursor pagination, DTO redaction, and guard order.
- Modify: `apps/server/src/config/env.ts`
  Adds `OPERATOR_AUDIT_ENABLED`, default enabled outside production and disabled in production.
- Modify docs: `AGENTS.md`, `DEVLOG.md`, `docs/data-flow.md`
  Records what was built, why it exists, safety boundaries, and verification evidence.

## Task 1: API Contract

- [ ] **Step 1: Write failing contract tests**

Create `packages/types/tests/operator-audit.test.mts` with tests for:

```ts
import { describe, expect, it } from 'bun:test';

import {
  operatorAuditLogListQuerySchema,
  operatorAuditLogListResponseSchema,
} from '../src/api/operator-audit';

describe('operator audit api contract', () => {
  it('parses empty list query with safe defaults', () => {
    expect(operatorAuditLogListQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('caps list query limit at 100', () => {
    expect(() =>
      operatorAuditLogListQuerySchema.parse({ limit: '101' }),
    ).toThrow();
  });

  it('validates redacted list response shape', () => {
    const parsed = operatorAuditLogListResponseSchema.parse({
      items: [
        {
          id: 'audit_1',
          actorUserId: 'user_admin',
          action: 'OUTBOX_REQUEUE',
          status: 'SUCCEEDED',
          targetType: 'OutboxEvent',
          targetId: 'evt_1',
          reason: 'fixed provider config',
          requestId: 'req_1',
          ipAddressHash: 'sha256:abc',
          userAgentHash: 'sha256:def',
          errorCode: null,
          errorPreview: null,
          createdAt: '2026-07-08T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    expect(parsed.items[0]?.action).toBe('OUTBOX_REQUEUE');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun test packages/types/tests/operator-audit.test.mts
```

Expected: fail because `../src/api/operator-audit` does not exist.

- [ ] **Step 3: Implement contract**

Add schemas for action/status enums, list query, list item, and list response. Export them through `packages/types/src/api/index.ts`.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun test packages/types/tests/operator-audit.test.mts
bun --cwd packages/types typecheck
```

Expected: both pass.

- [ ] **Step 5: Commit**

```powershell
git add packages/types/src/api/operator-audit.ts packages/types/src/api/index.ts packages/types/tests/operator-audit.test.mts
git commit -m "feat(types): add operator audit api contract"
```

## Task 2: Service Query

- [ ] **Step 1: Write failing service tests**

Extend or create `apps/server/src/operator-audit/operator-audit-query.service.spec.ts` to verify:

- `list({})` selects only redacted columns.
- `list({ status: 'FAILED', targetType: 'OutboxEvent' })` builds the expected Prisma where clause.
- pagination uses `createdAt desc, id desc` and returns `nextCursor`.
- DTO does not include `metadata`.

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- operator-audit-query.service --runInBand
```

Expected: fail because `list()` does not exist.

- [ ] **Step 3: Implement service list**

Add `list(query)` to `OperatorAuditService`, with a private `buildCursorWhere()` that mirrors Outbox Ops cursor semantics: cursor id resolves to `(createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)`.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- operator-audit.service operator-audit-query.service --runInBand
```

Expected: service tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/operator-audit packages/types
git commit -m "feat(server): list operator audit logs"
```

## Task 3: Controller And Feature Gate

- [ ] **Step 1: Write failing controller tests**

Add `apps/server/src/operator-audit/operator-audit.controller.spec.ts` to verify:

- guard order is `OperatorAuditEnabledGuard -> JwtAuthGuard -> OperatorGuard`;
- disabled feature gate throws 404 before auth;
- `GET /operator-audit-logs` parses query through the Zod contract and calls `service.list()`;
- route returns redacted DTOs only.

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
bun --filter @repo/server test -- operator-audit.controller --runInBand
```

Expected: fail because controller does not exist.

- [ ] **Step 3: Implement controller and env flag**

Add `OPERATOR_AUDIT_ENABLED` to `apps/server/src/config/env.ts`. Add `OperatorAuditEnabledGuard`, `OperatorAuditController`, and register it in `OperatorAuditModule`.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- operator-audit.controller operator-audit --runInBand
bun --cwd apps/server eslint src/operator-audit src/config/env.ts
bun --filter @repo/server build
```

Expected: tests, lint, and build pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/operator-audit apps/server/src/config/env.ts
git commit -m "feat(server): expose operator audit query api"
```

## Task 4: Docs And Devlog

- [ ] **Step 1: Update docs**

Update:

- `AGENTS.md`: mark Phase 7.14.5 complete and document `/operator-audit-logs`.
- `DEVLOG.md`: explain why audit query exists, what it returns, what it refuses to expose, and exact verification commands.
- `docs/data-flow.md`: add operator audit query to online-only operational data flows.

- [ ] **Step 2: Run docs verification**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Commit**

```powershell
git add AGENTS.md DEVLOG.md docs/data-flow.md docs/superpowers/plans/phase-7-14-operator-audit-query.md
git commit -m "docs: document operator audit query phase"
```

## Self-Review

- Scope is backend-only and intentionally excludes a frontend page, export flow, audit deletion, and audit payload inspection.
- The query API returns redacted audit rows and never returns raw metadata, outbox payload, aggregate id, prompt, chunk, model answer, API key, token, cookie, raw IP, or raw user-agent.
- Cursor pagination follows the existing Outbox Ops style to avoid losing rows with equal timestamps.
- `DEVLOG.md` is required for this phase because the feature is more about production reasoning than visible UI.
