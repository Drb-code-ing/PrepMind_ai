# Phase 7.10 Outbox Ops Design

## Background

Phase 7.9 has given PrepMind AI a durable outbox foundation:

- `OutboxEvent` stores internal events in PostgreSQL.
- `OutboxService` supports enqueue, claim, success, retry, and dead-letter state transitions.
- `OutboxDispatcherService` consumes events through an explicit handler registry.
- `OutboxDispatcherRunnerService` can run the dispatcher inside worker / both roles.
- `OutboxMetricsService` exposes safe read-only summary data through Worker Observability.

The remaining gap is operational closure. When an outbox event becomes `DEAD`, or when a developer sees backlog in Worker Observability, the system can currently say "something is wrong", but it cannot safely answer the next two questions:

1. Which event failed, without exposing user content or payload?
2. Can I manually requeue a failed/dead event after fixing the root cause?

Phase 7.10 adds a small, safety-first Outbox Ops surface for local development and controlled diagnostics. It is not a general admin console.

## Goals

- Add protected, opt-in backend endpoints for sanitized outbox event list and detail.
- Add a safe manual requeue endpoint for `FAILED` and `DEAD` events.
- Keep payload, user content, prompt, chunk, API key, token, and cookie out of all responses.
- Keep production disabled by default until a real admin / operator role model exists.
- Reuse the existing outbox state machine instead of adding a second processing path.
- Keep the first slice backend-only and testable from API / Swagger / scripts.

## Non-Goals

- No frontend page in this phase.
- No delete, skip, force-success, payload edit, handler edit, or direct dispatch endpoint.
- No new role/permission system.
- No Prometheus / Grafana export.
- No migration of OCR, PDF, embedding, or other business events into outbox.
- No change to Chat, RAG prompts, live model calls, or `/api/chat`.
- No exposure of `OutboxEvent.payload`, full `lastError`, `aggregateId`, `userId`, document content, RAG chunk text, prompt text, model output, API key, access token, refresh token, or cookie.

## Proposed API

All endpoints live under `apps/server` and are guarded by `JwtAuthGuard` plus a new `OUTBOX_OPS_ENABLED` config gate.

Production default is disabled:

```text
OUTBOX_OPS_ENABLED = false when NODE_ENV=production
OUTBOX_OPS_ENABLED = true otherwise
```

### `GET /outbox-events`

Returns a paginated, sanitized list of outbox events.

Query parameters:

```ts
{
  status?: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';
  type?: string;
  limit?: number; // default 20, max 100
  cursor?: string; // event id from the previous page
}
```

Response item:

```ts
{
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';
  attempts: number;
  maxAttempts: number;
  nextRunAt: string | null;
  lockedAt: string | null;
  processedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  hasPayload: boolean;
  hasLastError: boolean;
  canRequeue: boolean;
}
```

Notes:

- `hasPayload` is only a boolean. It never returns payload content.
- `hasLastError` is only a boolean in list responses.
- `canRequeue` is true only for `FAILED` and `DEAD`.
- Ordering is newest updated first, with `id` as a stable tie breaker.
- Cursor paging avoids offset drift and keeps the API simple.

### `GET /outbox-events/:id`

Returns sanitized detail for a single event.

Response:

```ts
{
  id: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';
  attempts: number;
  maxAttempts: number;
  nextRunAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  processedAt: string | null;
  lastErrorCode: string | null;
  lastErrorPreview: string | null;
  createdAt: string;
  updatedAt: string;
  hasPayload: boolean;
  payloadHash: string | null;
  canRequeue: boolean;
}
```

Detail response rules:

- `lastErrorPreview` is already sanitized by `sanitizeJobError()` and truncated again before returning.
- `lockedBy` is allowed because it is an opaque worker id, not hostname/pid/user content.
- `payloadHash` is allowed because it cannot reconstruct payload content.
- `payload` is never returned.
- `aggregateId` is never returned.

### `POST /outbox-events/:id/requeue`

Manually moves a `FAILED` or `DEAD` event back to `PENDING`.

Request body:

```ts
{
  reason?: string; // optional, sanitized and length-limited if accepted
}
```

First version behavior:

- Only `FAILED` and `DEAD` can be requeued.
- `PENDING`, `PROCESSING`, and `SUCCEEDED` return conflict.
- Requeue clears `lockedAt`, `lockedBy`, and `processedAt`.
- Requeue sets `nextRunAt` to the current time.
- Requeue resets `attempts` to `0`, so the event receives a fresh retry budget after the operator has fixed the root cause.
- Requeue keeps `lastErrorCode` and sanitized `lastError` for diagnosis until a later successful dispatch clears them.
- The response returns the same sanitized detail DTO as `GET /outbox-events/:id`.

This is intentionally conservative: requeue does not execute the handler inline. The normal dispatcher still claims and processes the event.

## Service Design

Create:

```text
apps/server/src/outbox/outbox-ops.controller.ts
apps/server/src/outbox/outbox-ops.service.ts
apps/server/src/outbox/outbox-ops.service.spec.ts
apps/server/src/outbox/outbox-ops.controller.spec.ts
```

Modify:

```text
apps/server/src/outbox/outbox.module.ts
apps/server/src/config/env.ts
apps/server/src/config/env.spec.ts
packages/types/src/api/outbox.ts
packages/types/src/api/index.ts
AGENTS.md
DEVLOG.md
docs/ai-behavior-acceptance.md
```

### `OutboxOpsService`

Responsibilities:

- Read outbox events through Prisma.
- Map database rows to sanitized DTOs.
- Apply list filters and cursor paging.
- Requeue only `FAILED` / `DEAD` events with a conditional `updateMany`.
- Return `null` or throw stable application errors when an event does not exist or cannot be requeued.

The requeue update should be a compare-and-swap style transition:

```ts
where: {
  id,
  status: { in: ['FAILED', 'DEAD'] },
}
```

If `count !== 1`, the service reloads the row:

- Missing row -> not found.
- Existing but wrong status -> conflict.
- Still not updated due to race -> conflict.

### `OutboxOpsController`

Responsibilities:

- Apply `JwtAuthGuard`.
- Apply `OUTBOX_OPS_ENABLED` gate.
- Validate params/query/body with Zod contract from `@repo/types`.
- Return response envelope through the existing global interceptor.
- Add Swagger descriptions in Chinese for local debugging.

The controller should not map raw Prisma rows itself. All sanitization stays in `OutboxOpsService`.

## Config Gate

Add `OUTBOX_OPS_ENABLED` to server env parsing.

Default:

- `true` when `NODE_ENV !== 'production'`
- `false` when `NODE_ENV === 'production'`

If disabled, endpoints return `404` instead of `403`. This avoids advertising an operational surface in production by default.

## Data Contract

Add `packages/types/src/api/outbox.ts` with Zod schemas:

- `outboxEventStatusSchema`
- `outboxEventListQuerySchema`
- `outboxEventListItemSchema`
- `outboxEventDetailResponseSchema`
- `outboxEventListResponseSchema`
- `outboxEventRequeueRequestSchema`

The server controller uses these schemas. Future web code or scripts can reuse them without importing NestJS code.

## Security Boundaries

- No response includes `payload`.
- No response includes `aggregateId`.
- No response includes `userId`, document text, chunk text, prompt text, model output, API key, token, or cookie.
- List responses do not include `lastErrorPreview`; only detail can show sanitized preview.
- `lastErrorPreview` is length-limited and redacted again before return.
- Requeue cannot change payload, type, max attempts, idempotency key, or aggregate fields.
- Requeue cannot target `PROCESSING`, preventing operators from stealing a live worker lock.
- Requeue cannot target `SUCCEEDED`, preventing duplicate downstream effects.
- Production remains disabled by default.

## Error Handling

Use existing `AppError` style:

- `OUTBOX_OPS_DISABLED` -> 404
- `OUTBOX_EVENT_NOT_FOUND` -> 404
- `OUTBOX_EVENT_NOT_REQUEUEABLE` -> 409
- `OUTBOX_EVENT_REQUEUE_CONFLICT` -> 409
- `OUTBOX_EVENT_INVALID_QUERY` / existing validation path -> 400

Error responses still go through the global response envelope.

## Testing Strategy

### Unit tests

`OutboxOpsService`:

- Lists newest events with default limit.
- Applies status and type filters.
- Uses cursor paging without offset.
- Maps rows without payload / aggregate id.
- Detail returns sanitized last error preview and payload hash.
- Detail does not return raw payload.
- Requeues `FAILED` to `PENDING`.
- Requeues `DEAD` to `PENDING`.
- Requeue resets attempts and clears lock / processed fields.
- Requeue keeps last error metadata for diagnosis.
- Requeue rejects `PENDING`, `PROCESSING`, and `SUCCEEDED`.
- Requeue handles lost race by returning conflict.

`OutboxOpsController`:

- Requires auth.
- Returns 404 when `OUTBOX_OPS_ENABLED=false`.
- Validates list query.
- Calls service with current query params.
- Calls requeue with id and reason.

### Contract tests

`@repo/types`:

- Rejects list items with `payload`.
- Rejects list items with `aggregateId`.
- Rejects invalid status.
- Bounds `limit` to max 100.
- Allows empty requeue body.

## Verification Commands

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server test -- outbox-ops
bun --filter @repo/server test -- env
bun --cwd apps/server eslint src/outbox src/config
bun --filter @repo/server build
git diff --check
```

Before merge, run the wider gate:

```powershell
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test:e2e
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

## Acceptance Criteria

- A logged-in developer in non-production can list sanitized outbox events.
- A logged-in developer in non-production can inspect one sanitized outbox event.
- A logged-in developer in non-production can requeue `FAILED` and `DEAD` events.
- Requeue never executes a handler directly; normal dispatcher remains the only consumer.
- Production defaults to no exposed Outbox Ops endpoints.
- Responses never include payload, aggregate id, prompt, chunk, model output, API key, token, cookie, or user content.
- Tests prove invalid state transitions do not change the database.

## Future Work

- Add a small frontend diagnostics panel only after API boundaries prove stable.
- Add real admin/operator role checks before enabling this in production.
- Add an append-only outbox operation audit table if production manual operations become necessary.
- Add more business event types only after ops closure is tested with the existing knowledge document processing event.
