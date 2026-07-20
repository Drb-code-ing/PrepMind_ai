# Phase 6.9.5 V14 Closure and V15 Plan

Date: 2026-07-20

## V14 closure

V14's unique branch command returned its fixed `default_off` preflight result.
It did not create a V14 owner, ledger, execution manifest, checkpoint, Docker
mutation, browser profile, API request, provider request or synthetic resource.
All V14 public, recovery and execution roots remain absent; recovery is not
admissible and V14 must never be retried.

The ordinary Compose server was already safe (`mock`, live false, both product
gates false, empty credentials, empty capability and zero maximum requests),
but its unrelated Chat field was `AI_MODEL=deepseek-v4-flash`. The historical
receipt expected Pro and rejected this safe host.

## V15 plan

V15 repairs only that default-off receipt: Flash and Pro are the two explicit
safe model values, duplicate controlled environment keys are rejected, and all
other default-off controls remain exact. It creates a fresh V15-only lineage
with separate confirmation, ledger, recovery/execution paths and headed
browser profile. The V15 native ledger test verifies that V11--V14 roots stay
byte-identical after a complete V15 terminal.

Before diagnostics exist, a reservation may be deleted only after a strict
zero-resource proof. Any failure to establish that proof is fail-closed and
cannot create a second attempt. No V15 product, recovery, Docker, browser, API
or provider command has run while this document was written; the product gates
remain false.

## Next command

After final static/Docker default-off checks and independent review with no
open P0/P1, execute the already-authorized unique branch V15 command:

```powershell
bun --filter @repo/server accept:review-planner:v15:product -- --confirm-v15-review-planner-product-acceptance --environment=branch
```

If it does not return `passed`, do not retry. Recovery is considered only if
its own V15 preflight explicitly authorizes it. A branch `passed` is the sole
condition for merge, main replay and remote push.
