# Phase 6.9.5 V12 Closure and V13 Acceptance Plan

Date: 2026-07-20

## V12 terminal facts

- The only V12 branch product command terminated as `operation_failed` at
  `review / api / review_api_trace_canonicalize`.
- The durable failure record stores the attempt SHA-256 and
  `providerCallState=indeterminate`; it contains no prompt, provider output,
  credential, raw error, user fact, or token/cost detail.
- V12 recovery was separately executed and returned `recovered`. Post-recovery
  checks found `mock/default-off`, both Review/Planner model gates false, no
  DeepSeek key in the server container, zero V12 synthetic users/traces, and
  no V12 browser profile.
- V12 is permanently closed. Its product command must never be retried and its
  evidence must not be edited or removed.

## Why V12 failed

The persisted Agent Trace represents the complete orchestration, including
local deterministic steps. The API observation represents only the live
candidate step. The V12 adapter incorrectly required their durations to be
equal. This was a strict acceptance-adapter defect, not a pricing issue and
not evidence that the model candidate produced an invalid suggestion.

## V13 preparation verified offline

- V13 has independent confirmation, schema, public/recovery/execution/browser
  namespaces and a one-shot product/recovery control plane.
- A real DTO regression proves candidate-step duration projection.
- V13 is explicitly accepted by the shared four-slot runner and its complete
  diagnostic checkpoint whitelist is tested.
- V13 durable-ledger tests prove V11 and V12 sentinels remain byte-identical.
- No V13 Docker, browser, API, provider, synthetic account, or product command
  has run at this document's revision. Normal product gates remain false.

## Next acceptance command

After the final static/image gates, execute only:

```powershell
bun --filter @repo/server accept:review-planner:v13:product -- --confirm-v13-review-planner-product-acceptance --environment=branch
```

The command is one-shot. A branch pass is required before main replay, merge,
and push. It does not authorize Docker-wide cleanup, volume deletion, prune, or
any mutation outside the V13 exact resource selectors.

## Review prompts

- Why is the candidate-step duration the correlation key, while the aggregate
  run duration remains useful for product observability?
- Why does an `operation_failed` terminal require a new lineage rather than a
  retry after an adapter fix?
- Which V13 receipts prove that live activation did not leave normal product
  gates enabled?
