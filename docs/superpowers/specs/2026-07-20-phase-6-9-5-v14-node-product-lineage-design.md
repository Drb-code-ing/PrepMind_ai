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
For the one V14 host command only, Node runs a small CommonJS TypeScript runner
in `apps/server/scripts`. Its entry allowlist contains only the V14 product and
recovery scripts. It transpiles only code-defined relative TypeScript
dependencies whose canonical `realpath` remains inside either
`apps/server/scripts` or `apps/server/src/review-agent`, plus exactly two
workspace runtime bridges: `packages/database/src/index.ts` and the standalone
`packages/agent/src/review-planner-diagnostics.ts`; every other TypeScript load
is rejected. The evidence modules import the latter only through the new narrow
`@repo/agent/review-planner-diagnostics` public subpath, never through the
agent barrel. Node still compiles every approved module with its original
filename, so each module retains its own `__dirname` and the existing
repository-root calculation remains correct. No generated bundle or temporary
source artifact is created, and the one-shot host lifecycle is outside the
observed Bun crash process.

An invalid, inherited, unrecognised or unapproved entry/dependency, and every
runner bootstrap/load failure, produces only the fixed `default_off` preflight
projection before a V14 root is created. No Docker-wide cleanup, volume
deletion, prune, or unscoped file deletion is permitted.

## Acceptance protocol

1. Pass V14 static/native/full-server tests, lint, server image build, Compose
   config, and a default-off container inspection.
2. Verify the Node runner's fixed V14 product/recovery entry allowlist and its
   fail-closed invalid-entry path without creating V14 roots.
3. Run the V14 product entry exactly once with its product confirmation under
   Node.
4. Inspect the durable result. A branch `passed` must include four slots,
   traces, visible Chrome evidence, default-off receipts, owner isolation and
   exact cleanup. Any other terminal stops V14; recovery is possible only if
   its own preflight admits the concrete terminal.
5. Only a branch pass permits main replay, merge and push.
