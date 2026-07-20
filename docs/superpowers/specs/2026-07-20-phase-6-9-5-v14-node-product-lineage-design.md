# Phase 6.9.5 V14 Node-Executed Product-Acceptance Design

## Trigger

V13 consumed its branch command but Bun 1.3.14 crashed with a segmentation
fault shortly after writing the V13 public reservation. The process produced no
execution manifest, checkpoint, failure terminal, synthetic account, browser
profile, Docker activation, API request, or provider request. The normal server
was already restored as healthy `mock/default-off`.

V13 therefore is an interrupted, non-retryable reservation, not a product
result and not a recovery-admissible terminal. It remains immutable.

## V14 boundary

V14 is a new isolated lineage with separate confirmation, schemas, public
ledger, recovery/execution roots, browser profile and owner lock. Its native
ledger test writes immutable sentinels to V11, V12 and V13 roots and proves a
full V14 terminal does not modify any of them.

The business boundary is unchanged: only the owner-scoped Review/Planner
candidate may use the model; local code remains authoritative for facts, FSRS,
minutes, links, permissions, writes, schemas, budgets, timeouts and cleanup.

## Runtime choice

Bun remains the project package manager, test runner and Docker build runtime.
For the one V14 host command only, Bun first bundles the existing TypeScript
entrypoint as CommonJS in the same `apps/server/scripts` directory, with
`playwright-core` externalized. Node then executes that bundle. The same-folder
output preserves the existing `__dirname` repository-root calculation, while
moving the one-shot host lifecycle outside the observed Bun crash process.

The generated bundle is an exact temporary artifact: it is created only after
the V14 roots are verified absent, is executed once by Node, and is removed by
its exact verified path before post-run evidence review. A build failure stops
before the product CLI. No Docker-wide cleanup, volume deletion, prune, or
unscoped file deletion is permitted.

## Acceptance protocol

1. Pass V14 static/native/full-server tests, lint, server image build, Compose
   config, and a default-off container inspection.
2. Build the V14 product entrypoint into the verified same-directory CJS path.
3. Run the CJS bundle once with the V14 product confirmation under Node.
4. Inspect the durable result. A branch `passed` must include four slots,
   traces, visible Chrome evidence, default-off receipts, owner isolation and
   exact cleanup. Any other terminal stops V14; recovery is possible only if
   its own preflight admits the concrete terminal.
5. Only a branch pass permits main replay, merge and push.
