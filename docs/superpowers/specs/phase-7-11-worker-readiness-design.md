# Phase 7.11 Worker Readiness Design

## Goal

Phase 7.11 adds a machine-readable worker readiness layer on top of the current
Worker Observability and Durable Outbox work. The goal is to let developers and
deployment scripts answer one direct question:

> Can the current backend setup safely process queued background work right now?

This phase is intentionally small. It does not add a new frontend page, does not
change Chat, RAG prompts, embedding behavior, or model calls, and does not
replace the existing `/worker-observability/summary` debugging endpoint.

## Why This Is Needed

Phase 7.6 split API and worker roles. Phase 7.7 added Redis heartbeat and queue
observability. Phase 7.9 added durable outbox, dispatcher, and summary metrics.
Phase 7.10 added safe Outbox Ops.

Those pieces are visible to humans, but they are not yet shaped as a deployment
readiness signal. In production-style systems, this gap matters:

- A queue can have backlog while no worker is online.
- Redis can be unreachable, so BullMQ and heartbeat checks become unreliable.
- Outbox can have `DEAD` events even if the HTTP API itself is alive.
- A container can answer `/health` while it is not actually ready to process
  background work.

`/health` should remain a simple API liveness check. Phase 7.11 adds a more
specific readiness check for background processing.

## Recommended Approach

I considered three directions:

1. **Add worker readiness API and CLI smoke script.**
   This is the recommended path. It reuses existing queue, heartbeat, and outbox
   services, adds one focused readiness contract, and provides a command that can
   be used locally or by deployment scripts.

2. **Expose Prometheus / Grafana metrics now.**
   This is useful later, but it adds more operational surface than we need today.
   It is better after readiness semantics are stable.

3. **Move more business jobs into BullMQ first.**
   OCR, PDF parsing, reminder scheduling, and batch embedding are valuable, but
   they increase business scope. Readiness should come first so later jobs have a
   reliable operational foundation.

Phase 7.11 should implement option 1.

## Public Surface

### HTTP readiness endpoint

Add:

```text
GET /worker-readiness
```

The endpoint returns a global system-level readiness summary. It is not scoped
to one user's data because worker readiness is a process/deployment concern.

Suggested response shape:

```json
{
  "ready": true,
  "status": "ready",
  "checkedAt": "2026-07-08T10:00:00.000Z",
  "server": {
    "role": "api",
    "knowledgeProcessingMode": "queue"
  },
  "checks": {
    "redis": {
      "status": "pass",
      "message": "Redis is reachable"
    },
    "queue": {
      "status": "pass",
      "message": "Queue is readable",
      "counts": {
        "waiting": 0,
        "active": 0,
        "delayed": 0,
        "failed": 0,
        "paused": 0
      }
    },
    "workers": {
      "status": "pass",
      "message": "At least one worker heartbeat is online",
      "onlineCount": 1
    },
    "outbox": {
      "status": "pass",
      "message": "No dead outbox events",
      "deadCount": 0,
      "hasBacklog": false
    }
  },
  "issues": []
}
```

The status values should be:

```text
ready
degraded
not_ready
```

Each individual check should use:

```text
pass
warn
fail
```

### CLI readiness command

Add a server script, for example:

```powershell
bun --filter @repo/server readiness:worker
```

The script should call the same readiness service logic or the local HTTP
endpoint and return useful process exit codes:

```text
0 = ready
1 = degraded or not_ready
2 = invalid configuration or unexpected script failure
```

The command should print a short human-readable summary without secrets,
payloads, prompts, RAG chunks, access tokens, cookies, API keys, or full outbox
payloads.

## Readiness Semantics

Readiness depends on the configured mode.

### Inline mode

When `KNOWLEDGE_PROCESSING_MODE=inline`, queue workers are not required for
knowledge document processing. Readiness should not fail just because no worker
heartbeat exists.

Expected behavior:

- Redis reachable: `pass` if BullMQ can be queried, `warn` if unavailable.
- Queue backlog: `warn` if backlog exists, because inline mode usually should
  not depend on queued document jobs.
- Worker heartbeat: `warn` or `pass` depending on role, but not a hard failure.
- Outbox dead events: `fail` if `DEAD` count is greater than zero.

### Queue mode

When `KNOWLEDGE_PROCESSING_MODE=queue`, worker availability becomes required.

Expected behavior:

- Redis unreachable: `fail`.
- Queue paused: `fail`.
- Backlog with no online worker heartbeat: `fail`.
- No backlog and no heartbeat: `warn`, because the system is idle but not fully
  prepared to consume future queue jobs.
- At least one heartbeat: `pass`.
- Outbox dead events: `fail`.

### Server roles

`SERVER_ROLE=api` should be allowed to expose the readiness endpoint, but it
cannot prove a local worker is running by itself. In queue mode it must rely on
Redis heartbeat from a worker process.

`SERVER_ROLE=worker` does not expose HTTP. For worker-only deployments, the CLI
command is the preferred readiness surface.

`SERVER_ROLE=both` can both expose HTTP and write worker heartbeat. It should be
ready in queue mode when Redis, queue, heartbeat, and outbox checks pass.

## Security And Privacy Boundaries

The readiness response must not return:

- Outbox payload
- `aggregateId`
- User document text
- Prompt text
- RAG chunk text
- Model output
- API key
- Access token
- Refresh token
- Cookie
- Raw `lastError`

The response may return:

- Counts
- Boolean flags
- Short fixed messages
- Outbox dead/backlog counts
- Queue counts
- Worker heartbeat count and last seen time

The HTTP endpoint should be controlled by a feature gate:

```text
WORKER_READINESS_ENABLED
```

Default:

- non-production: enabled
- production: disabled unless explicitly enabled

Because readiness exposes system-level operational signals, the endpoint should
not be treated as a general student-facing API. For this phase, it can follow the
same practical boundary as Worker Observability: `JwtAuthGuard` plus feature
gate. A later admin/operator permission model can tighten this further.

## Architecture

Add a focused `WorkerReadinessModule` in `apps/server/src/worker-readiness`.

Suggested units:

- `worker-readiness.service.ts`
  - Computes readiness from Redis/BullMQ queue checks, worker heartbeat, and
    outbox summary.
  - Contains pure status resolution helpers so tests can cover edge cases.

- `worker-readiness.controller.ts`
  - Exposes `GET /worker-readiness`.
  - Applies feature gate and `JwtAuthGuard`.

- `worker-readiness.constants.ts`
  - Holds queue name, status literals, and fixed messages if helpful.

- `scripts/worker-readiness.ts`
  - Runs readiness check for local or deployment smoke.
  - Prints concise output and exits with deterministic exit codes.

- `@repo/types/api/worker-readiness`
  - Defines Zod schemas and TypeScript response types.

The service should reuse existing queue and outbox primitives instead of
duplicating raw database queries where possible.

## Error Handling

Readiness should be conservative:

- If Redis or BullMQ throws, the Redis/queue check becomes `fail` in queue mode.
- If heartbeat parsing fails for one entry, ignore that malformed entry and keep
  evaluating other entries.
- If outbox metrics fail, mark outbox check as `fail` with a safe generic
  message.
- The readiness endpoint itself should still return a normal response when a
  check fails. Failed checks are represented in the response body.
- Feature-gate disabled should return 404, matching existing diagnostic endpoint
  behavior.

## Testing Plan

Use TDD during implementation.

Required focused tests:

- Contract tests for response schema.
- Service unit tests for inline mode and queue mode status resolution.
- Service tests for Redis/queue failure handling.
- Service tests for outbox dead events causing `not_ready`.
- Controller tests for feature gate disabled returning 404 before exposing
  diagnostics.
- CLI script tests or a lightweight smoke test for exit code mapping.

Suggested verification commands:

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server test -- worker-readiness
bun --filter @repo/server build
git diff --check
```

If the implementation touches shared Worker Observability helpers, also run:

```powershell
bun --filter @repo/server test -- worker-observability
```

## Documentation Updates

Update:

- `AGENTS.md`
- `DEVLOG.md`
- `docs/ai-behavior-acceptance.md`

Add a short usage section explaining:

- Difference between `/health`, `/worker-observability/summary`, and
  `/worker-readiness`.
- How to run the CLI readiness command.
- Why no live model smoke is required.

No blog is required immediately unless implementation uncovers meaningful
lessons worth turning into an interview article.

## Non-Goals

Phase 7.11 will not:

- Add a frontend page.
- Add Prometheus or Grafana.
- Add admin/operator RBAC.
- Add audit logs for readiness reads.
- Change BullMQ retry behavior.
- Change outbox dispatcher behavior.
- Add new business background jobs.
- Change Chat, RAG, Agent, embedding, or live model behavior.

## Acceptance Criteria

Phase 7.11 is complete when:

- `GET /worker-readiness` returns a safe readiness summary behind a feature gate
  and authentication.
- The service distinguishes inline mode from queue mode.
- Queue mode reports not-ready when backlog exists but no worker heartbeat is
  online.
- Dead outbox events make readiness fail.
- The CLI command exits with documented status codes.
- Tests cover the core readiness matrix.
- Docs explain how to use the readiness signal and how it differs from existing
  observability.
