# Phase 6.9.5 V12 Product-Acceptance Offline Checkpoint

Date: 2026-07-20

## Scope

V12 is a new, isolated product-acceptance lineage for the existing
ReviewAgent and PlannerAgent candidate. It has its own confirmation literals,
public/recovery/execution/browser namespaces, four-slot durable ledger,
attempt binding, V8 execution adapter, and recovery composition. The default
host is now real: read-only preflight precedes reservation, and only a
reserved V12 attempt can create synthetic resources and enter the V8
Docker/API/browser/Trace mechanics. The injectable fake ports remain tests,
not runtime evidence.

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
  matching public/private attempt evidence, a `failure.json` bound to the
  latest journal checkpoint, and a fail-closed recovery reader. A recovery
  terminal is attempt-bound, mutually exclusive with success, written once
  only after restore plus cleanup, and makes a second recovery block.
- Native V11 public/recovery-root SHA sentinel regression remains unchanged;
  V12 never writes or reads the V11 reserve/open/read APIs.
- The private execution manifest persists only V12 synthetic selectors, the
  exact V12 browser profile path, and a SHA-256 `DATABASE_URL` fingerprint; it
  never stores the URL or credential. The fingerprint is captured before the
  reusable V8 host reads configuration, preventing a manifest/new-env vs.
  Prisma/old-env split. Product revalidates repository/evidence/default-off/
  database identity after acquiring its owner and before reserve.
  Recovery takes its own owner, rereads state, rejects DB-fingerprint drift
  before any write, then can restore mock/default-off, terminate only that
  profile, and delete only matching synthetic accounts, traces and fixtures.
  `review_api_setup / not_started` records a post-reservation setup failure
  before provider dispatch, so it cannot become an unrecoverable incomplete
  attempt.
- An activation failure before `liveContainerId` assignment now restores from
  the observed current server container. Headed product browser evidence has a
  30-second operator-visible hold before exact cleanup. These are offline
  control-flow guarantees, not Docker/browser execution evidence.
- Default product and recovery compositions now have real host wiring, but
  this checkpoint still contains no V12 Docker/API/browser/provider execution.
- `REVIEW_AGENT_MODEL_ENABLED` and `PLANNER_AGENT_MODEL_ENABLED` remain
  default-off. V12 has not enabled either normal application gate.

## Static Gates

- V11/V12 focused Server Jest: `9` suites / `72` tests passed.
- V12 native durable ledger: `8` tests passed / `26` assertions.
- `@repo/agent`: `409` tests passed; `@repo/ai`: `190` tests passed;
  `@repo/types`: `39` tests passed; their typechecks passed.
- `@repo/web`: `409` tests passed; lint passed; optimized production build
  passed with all `17` routes generated.
- Full Server Jest, executed with `--runInBand`: `125` suites / `1,540` tests
  passed; `3` suites / `30` tests were configured skips. The parallel Jest
  wrapper can report a forced worker-exit warning with an invalid `0/128`
  summary, so that output is explicitly not acceptance evidence. Server build
  and no-write TypeScript ESLint passed.
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

The refreshed, independent contract and operations reviews have no unresolved
P0/P1 finding. A fresh, separate user authorization is still required before
the current branch may execute this single command:

```powershell
bun --filter @repo/server accept:review-planner:v12:product -- --confirm-v12-review-planner-product-acceptance --environment=branch
```

If the product command reports `operation_failed`, stop the lineage; do not
retry the product command. Only a coherent `operation_failed` state explicitly
admitted by the V12 recovery preflight can request a separate one-time recovery
authorization:

```powershell
bun --filter @repo/server recover:review-planner:v12:product -- --confirm-v12-review-planner-product-acceptance-recovery-only --environment=branch
```

Only a branch `passed` result that includes default-off restoration and exact
cleanup receipts can permit a later main replay, merge, and push. A standalone
`recovered` terminal ends V12 permanently. Neither
command permits `docker compose down -v`, Docker prune, volume cleanup, or any
Docker-wide cleanup.
