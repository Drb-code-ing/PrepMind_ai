# Phase 7.18 Admin Outbox Ops Productization Design

## Goal

Phase 7.18 upgrades the desktop Admin Console Outbox Ops page from a basic diagnostic tool into a clearer operator workflow.

After this phase, an admin should be able to answer four questions from the UI before touching `requeue`:

1. What state is this outbox event in?
2. Why did it fail, based on the safe error code and preview?
3. Is it safe to requeue now, or should code/config/data be fixed first?
4. After requeue, where can I verify the operation and recovery signal?

This phase is intentionally about productizing the existing safe operation boundary, not expanding the backend power surface.

## Why This Matters

Phase 7.10 added safe backend Outbox Ops APIs. Phase 7.14 added admin-only access and operator audit logs. Phase 7.16 and 7.17 moved these capabilities into a standalone admin console and Docker service.

The current admin page can list events, show a detail panel, and requeue a selected `FAILED` or `DEAD` event. That proves the backend chain works, but the operator experience is still thin:

- the list does not strongly guide the admin toward failed/dead events;
- the detail panel does not clearly separate event identity, lifecycle, retry status, error diagnosis, and action area;
- after a requeue, the admin sees a notice but still has to know where to check the audit record and readiness recovery;
- handler-missing and invalid-payload cases need stronger "do not blindly requeue" framing;
- the page works, but it does not yet feel like a small enterprise operations console.

The product goal is to reduce accidental retries and make the page teach the correct mental model: requeue returns an event to the state machine; it does not directly execute the handler, edit payload, delete data, or force success.

## Current State

The current `apps/admin/src/app/outbox/page.tsx` implements:

- status and event type filters;
- a 30-row event list;
- a right-side detail panel;
- detail fetch through `GET /outbox-events/:id`;
- requeue through `POST /outbox-events/:id/requeue`;
- a reason textarea and explicit confirmation checkbox;
- basic guidance through `getOutboxErrorGuidance()`;
- query invalidation after a successful requeue.

The backend boundary already exists:

- `GET /outbox-events`;
- `GET /outbox-events/:id`;
- `POST /outbox-events/:id/requeue`;
- feature gate -> JWT -> `OperatorGuard`;
- safe DTO only, no payload, aggregate id, user content, prompt, chunk, model answer, API key, token, or cookie;
- `FAILED / DEAD -> PENDING` only;
- operator audit write on requeue success/failure.

## Recommended Scope

Phase 7.18 should focus on three operator-experience improvements.

### 1. Outbox Event Detail Structure

Replace the current single stacked detail panel with clearer sections:

- **Lifecycle**: status, attempts, max attempts, updated time, next run time, processed time when available.
- **Identity**: event id, event type, payload hash.
- **Diagnosis**: last error code, sanitized error preview, risk guidance.
- **Action**: reason textarea, confirmation checklist, requeue button.
- **Aftercare**: links or prompts to check audit logs and worker readiness after the action.

This should make the page readable under pressure. The operator should not need to infer which values are state-machine fields and which values are diagnostic metadata.

### 2. Requeue Decision Guidance

Strengthen `getOutboxErrorGuidance()` and related view helpers so the UI can communicate:

- `OUTBOX_HANDLER_NOT_FOUND` or "no handler" means code/registry must be fixed before requeue.
- invalid payload or invalid metadata means the producer or payload contract must be fixed before requeue.
- transient dependency or timeout-like errors can be requeued after dependency recovery.
- unknown errors require checking logs/readiness before requeue.
- already `PENDING`, `PROCESSING`, or `SUCCEEDED` events are read-only in this UI.

The UI should not block all risky cases automatically unless the backend says `canRequeue=false`; the backend remains the source of truth. The frontend should make the risk visible and require explicit confirmation for the operation that is already supported.

### 3. Post-Requeue Verification Path

After a successful requeue, the admin should see a clear next step:

- the event has moved back to `PENDING`;
- requeue does not immediately execute the handler;
- worker dispatcher must claim it in a later tick;
- the operator can check Worker Readiness for backlog/dead-event recovery;
- the operator can check Operator Audit for the `OUTBOX_REQUEUE / SUCCEEDED` record.

If this can be done safely with existing routes, provide buttons or links to:

- `/worker`;
- `/audit` filtered to `OUTBOX_REQUEUE` when the current filter model supports it.

If deep links would require new query contracts, defer deep linking and show clear text guidance only.

## Alternatives Considered

### Add Batch Requeue

Batch requeue would look powerful, but it increases blast radius. It makes sense only after single-event guidance, audit visibility, and recovery checks are mature.

Decision: out of scope for Phase 7.18.

### Add Payload Viewer or Payload Editor

Showing payload would help debugging, but it conflicts with the current safety boundary. Payload can contain sensitive or indirectly identifying business context.

Decision: out of scope. Keep payload hidden. Continue exposing only safe metadata and payload hash.

### Add Backend Requeue Policy Engine

The backend could classify errors and hard-block risky requeue cases such as handler missing. This may be useful later, but the current backend contract already safely limits state transitions and audits all attempts.

Decision: Phase 7.18 can improve UI guidance first. Backend policy changes require a separate design because they change operation semantics.

### Build Prometheus or Metrics First

Metrics matter, but the admin currently has a more immediate gap: single-event diagnosis and safe operator action. Metrics should follow once the core operation workflow is understandable.

Decision: defer broader metrics to a later worker observability phase.

## Detailed Requirements

### UI Requirements

- Keep the page desktop-first and admin-console dense; avoid marketing-style cards or oversized empty panels.
- Preserve a two-region layout: event list on the left, selected detail/action on the right or in a responsive detail panel.
- Make status filters scannable and reduce friction for the common `FAILED` / `DEAD` workflow.
- Avoid native `<select>` if the current admin visual system has a custom filter pattern available or if native controls look visually inconsistent.
- Keep text concise but explanatory. This is an operator tool; labels should say what to do, not merely decorate the page.
- Ensure action controls remain disabled unless the current detail is requeueable, the backend says `canRequeue=true`, and the operator has confirmed the checklist.
- Keep touch targets at least 44px where buttons are interactive.

### State and Data Requirements

- Continue using existing Outbox Ops APIs.
- Do not introduce new backend API fields unless implementation proves the current DTO cannot support the required UI.
- Continue using TanStack Query with current access token flow.
- After requeue success, invalidate the list, selected detail, audit-related data if already cached, and readiness-related data if already cached.
- Do not store payload, full errors, user content, prompt, RAG chunks, model answers, API keys, access tokens, refresh tokens, or cookies in the frontend state beyond existing access-token auth store behavior.

### Safety Requirements

- The frontend must not bypass `OperatorGuard` or assume hidden navigation is sufficient security.
- The frontend must not offer delete, force success, skip, direct dispatch, payload edit, or batch requeue.
- Requeue reason should remain trimmed and length-limited.
- Error preview display must use existing sanitized backend fields only.
- Guidance text should explicitly say when requeue is not a code fix.

### Accessibility Requirements

- Status filters, event rows, detail sections, confirmation checkbox, and requeue button must be keyboard accessible.
- If custom filter controls are added, they need listbox/button semantics similar to the learning-side custom filter work.
- Selected row state should be visible without relying only on color.
- Error/risk guidance should include text labels, not color-only meaning.

## Proposed Component Boundaries

Keep the first implementation local to `apps/admin` unless duplication becomes real.

Suggested extraction:

- `OutboxStatusFilter`: status choice UI.
- `OutboxEventList`: event list and selected-row rendering.
- `OutboxEventDetailPanel`: detail layout and action area composition.
- `OutboxGuidanceBox`: risk guidance and sanitized error preview.
- `OutboxAftercare`: post-requeue next steps.
- `outbox-view.ts`: pure helpers for status tone, requeue eligibility, reason normalization, error guidance, and aftercare messaging.

The first implementation can still live in `page.tsx` if extracting components would create churn, but pure decision logic should remain in `outbox-view.ts` with tests.

## Testing Strategy

Use focused tests before UI implementation.

### Pure Helper Tests

Extend `apps/admin/src/lib/outbox-view.test.mts` to cover:

- handler missing guidance;
- invalid payload guidance;
- transient/dependency guidance;
- unknown error guidance;
- post-requeue aftercare text;
- requeueable vs read-only statuses.

### API Client Tests

Only add API client tests if new query params or deep-link behavior are introduced. Otherwise existing `outbox-api.ts` usage is enough.

### UI Contract Tests

If the page structure changes meaningfully, add a lightweight static or pure-render-oriented test that protects:

- the page still includes reason input and explicit confirmation;
- the page does not introduce payload display labels;
- the page does not introduce batch requeue, delete, force success, skip, direct dispatch, or payload edit controls.

### Manual Browser Acceptance

With Docker or local dev stack running:

1. Open `http://localhost:3100/outbox` or `http://127.0.0.1:3100/outbox`.
2. Log in as an ADMIN user.
3. Select a `FAILED` or `DEAD` event if available.
4. Confirm detail sections are readable and do not expose payload.
5. Confirm risky errors show clear "fix first" guidance.
6. Requeue only a safe known test event.
7. Confirm the page resets confirmation state, refreshes event status, and shows next steps.
8. Open audit and worker readiness to verify follow-up paths.

## Acceptance Criteria

Phase 7.18 implementation is complete when:

1. Outbox Ops detail view separates lifecycle, identity, diagnosis, action, and aftercare.
2. The page explains requeue state-machine behavior in the action or aftercare area.
3. Handler-missing and invalid-payload cases strongly warn the operator to fix code/data first.
4. Requeue remains limited to existing backend-safe `FAILED / DEAD -> PENDING` behavior.
5. The UI does not expose payload or add dangerous operations.
6. Existing admin auth, `OperatorGuard`, and audit behavior remain unchanged.
7. Tests cover helper guidance and any new UI contract logic.
8. Browser acceptance verifies the admin can inspect, decide, requeue a safe test event, and find audit/readiness follow-up.

## Verification Plan

Minimum verification for implementation:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
bun --filter @repo/admin lint
bun --filter @repo/admin build
```

If backend contracts or API behavior change, also run:

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server test -- outbox-ops operator-audit worker-readiness --runInBand
bun --filter @repo/server build
```

If Docker browser acceptance is required:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

When the repository is under a non-ASCII Windows path and Docker build fails with the known gRPC header issue, use the documented `subst P:` workaround from `docs/dev-start.md`.

## Out of Scope

- batch requeue;
- payload viewing or payload editing;
- deleting outbox events;
- force success, skip, or direct dispatch;
- changing backend role model or adding a new operator role;
- changing production feature-gate defaults;
- new Prometheus metrics;
- new retention policies;
- audit export.

These can become later phases once the single-event operator workflow is stable.
