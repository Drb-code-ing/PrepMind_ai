# Phase 6.9.5 V19 Product-Acceptance Design

## Trigger

V18 was a root-absent preflight stop. The product argv was correct and no
resource was created, but Node-runner preflight parity with the direct Bun host
was not proven. V18 cannot be rerun.

## V19 boundary

V19 owns its confirmation, schemas, public/recovery/execution/browser roots,
owner, ledger, host, CLI, diagnostics and Bun authority helper. It preserves
the V18 strict parser and single-separator normalization, repository-root CWD,
source/bridge/resolver allowlists, default-off receipt, immutable V10 authority
and all older-lineage sentinels.

## Read-only preflight gate

`preflight:review-planner:v19:product` uses the exact V19 Node runner and
product confirmation, constructs the root-bound default composition, and calls
only `ports.preflight`. It does not acquire an owner or create any product
resource. It reports only `ready` or fixed `default_off` metadata. This gate
must pass while V19 roots are absent before its one-shot product command may
run.

## Promotion

V19 starts default-off. Product and recovery commands have not run. A separate
explicit authorization is required for the V19 product command after the
read-only preflight succeeds; only branch `passed` authorizes main replay,
merge and push.
