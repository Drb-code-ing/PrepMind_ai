# Phase 6.9.5 V12 Product-Acceptance Offline Checkpoint

Date: 2026-07-20

## Scope

V12 is a new, isolated product-acceptance lineage for the existing
ReviewAgent and PlannerAgent candidate. It has its own confirmation literals,
public/recovery/execution/browser namespaces, four-slot durable ledger,
attempt binding, V8 execution adapter, and recovery composition. The host
boundary is intentionally an injectable fake facade: the unconfigured default
returns `blocked`, and a fake-ready port proves the V12-only composition
contract without touching V11.

This is an offline checkpoint, not a product-acceptance success. V10
controlled-Live remains the only semantic-quality authority:
`complete / passed`, `23/22` provider-attempt/paired-admission, `48/48`
strict/quality, critical `0`, P95 `1465ms`, usage `5764/232`, and CNY
`0.018684/1.00`. V11 remains immutable `operation_failed / recovery-only`
history with `review_api_activate / not_started`; it is neither a V12 input nor
a product retry permit.

## Offline Evidence

- V12 rejects V11 identity, confirmation, profile, and roots. Invalid
  confirmation/preflight reaches no owner, Docker, browser, API, or provider
  boundary.
- The V12 durable record has one reservation, four deterministic slots,
  matching public/private attempt evidence, and a fail-closed recovery reader.
  Earliest recovery is admitted only when reservation/manifest/binding match
  and the checkpoint is genuinely absent; malformed, unknown, or mismatched
  terminal state remains blocked.
- Native V11 public/recovery-root SHA sentinel regression remains unchanged;
  V12 never writes or reads the V11 reserve/open/read APIs.
- Default composition stays blocked without an injected host boundary. The
  host-recovery composition only projects an injected `operation_failed`
  reader plus a ready preflight; it is an offline fake-boundary contract, not a
  Docker/API/browser lifecycle integration.
- `REVIEW_AGENT_MODEL_ENABLED` and `PLANNER_AGENT_MODEL_ENABLED` remain
  default-off. V12 has not enabled either normal application gate.

## Static Gates

- V11/V12 focused Server Jest: `7` suites / `22` tests passed.
- V12 native durable ledger: `6` passed / `20` assertions.
- `@repo/agent`: `409` tests passed; `@repo/ai`: `190` tests passed;
  `@repo/types`: `39` tests passed; their typechecks passed.
- `@repo/web`: `409` tests passed; lint passed; optimized production build
  passed with all `17` routes generated.
- Full Server Jest: `124` suites / `1,526` tests passed; `3` suites / `30`
  tests were configured skips. Server build and no-write TypeScript ESLint
  passed.
- `docker compose --env-file .env -f docker/docker-compose.dev.yml config
  --quiet` passed. It only parsed configuration; it did not start, stop,
  recreate, or delete Docker resources.
- `git diff --check` passed. Windows emitted only the ordinary future LF-to-CRLF
  working-copy notice for the touched TypeScript spec.

## Planned Runtime Ceiling (Not Execution Evidence)

Because V12 reuses the V8 four-slot engine, a future branch or main product
acceptance is limited to four requests, with a `4500ms` agent timeout. Each
environment is reserved to at most `7800/1760` input/output tokens and CNY
`0.03396000`; branch plus main is at most `15600/3520` tokens and CNY
`0.06792000`, below the shared CNY `0.10000000` hard cap. These are planned
admission limits only: no V12 request, provider usage, cost, timeout, or
acceptance result has been observed at this checkpoint.

## Explicit Non-Evidence

No V12 product CLI, recovery CLI, Docker lifecycle, browser, product API,
provider, user account, trace, or synthetic product data was run or created by
this checkpoint. The V12 public branch/main evidence roots and all branch/main
recovery and execution roots were verified absent before runtime.

Therefore this record does not prove real-model semantic quality, product API
availability, container health, headed-browser behavior, provider usage/cost,
default-off restoration after runtime, or exact synthetic cleanup after runtime.
It must not be used to enable the two product gates.

## Next Runtime Step

The next actions are two separate, independent reviews: one contract review
and one operations review. Only after both have no unresolved P0/P1 finding
and one fresh, separate user authorization may the current branch execute this
single command:

```powershell
bun --filter @repo/server accept:review-planner:v12:product -- --confirm-v12-review-planner-product-acceptance --environment=branch
```

If it reports `operation_failed_recovered`, stop the lineage; do not retry the
product command. Only `recovery_required`, or a crash state explicitly admitted
by the V12 recovery preflight, can request a separate one-time recovery
authorization:

```powershell
bun --filter @repo/server recover:review-planner:v12:product -- --confirm-v12-review-planner-product-acceptance-recovery-only --environment=branch
```

Only a branch `passed` result that includes default-off restoration and exact
cleanup receipts can permit a later main replay, merge, and push. Neither
command permits `docker compose down -v`, Docker prune, volume cleanup, or any
Docker-wide cleanup.
