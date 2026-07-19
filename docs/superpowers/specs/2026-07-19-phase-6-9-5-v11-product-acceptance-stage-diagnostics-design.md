# Phase 6.9.5 V11 Product-Acceptance Stage Diagnostics Design

## Context

The V10 controlled-Live is immutable and passed its quality, latency, usage, budget, and cost gates. Its first branch product-acceptance lineage is also immutable: recovery completed with zero new recovery calls and zero synthetic residue, but the public evidence can only prove that the `review-api` slot was claimed before the process stopped. It cannot safely distinguish API dispatch, response validation, trace retrieval, or a process interruption.

The old directory must not be reset, extended, or reused. A new product-acceptance lineage is therefore required before the V10 product path can be attempted again.

## Decision

Create a V11 product-acceptance profile that reads the committed V10 controlled-Live success but owns a new public ledger, recovery directory, confirmation strings, browser profile, and runtime-owner lease. Add a finite, safe checkpoint enum that is durable before each external or validation boundary. Recovery publishes only the last checkpoint enum with its already-safe terminal record.

The enum contains no request body, response, URL, token, account identifier, fixture data, raw error, stack, or provider-call count. A checkpoint means only that execution had reached that boundary; it never claims that an HTTP dispatch or a model call completed. The existing exact admission cap, no-retry rule, recovery-only rule, default-off restoration, and zero-residue cleanup rule remain unchanged.

## Checkpoints

The runner records one monotonically advancing checkpoint before each boundary:

- `activate_component`, `facts_before`
- `api_dispatch`, `api_response_validate`, `api_trace_read`, `api_result_record`
- `browser_run`, `browser_response_validate`, `default_off_restore`, `browser_trace_read`, `browser_result_record`
- `facts_after`, `facts_consistency`, `owner_isolation`, `cleanup`, `finalize_success`

The public ledger writes a strict `checkpoint` record that binds `slot` and `stage` without values from the request. A successful ledger retains its expected completed checkpoint sequence and seals it into the success hash. A recovery-only terminal copies only the latest valid checkpoint; a missing or malformed checkpoint remains fail-closed as `evidence_io` rather than inventing a cause.

## Tests and Safety Criteria

1. Fake-dependency runner tests force each API boundary to fail and prove the exact safe stage is recorded, the original error is normalized, cleanup/default-off behavior is unchanged, and the failure record contains no secret-shaped data.
2. Native ledger/recovery tests prove V11 accepts only monotonic known checkpoints, rejects unknown, out-of-order, duplicate, and sensitive-key records, and exposes the last checkpoint only through the safe recovery terminal.
3. V8 and V10 profiles, manifests, recovery terminals, and readers remain byte-compatible. V10's existing recovery-only evidence is read-only.
4. The new lineage cannot be run by this task: no Docker, browser, Live provider, `.env`, product gate, or V11 evidence directory is changed. It may move to a separately authorized product run only after offline gates and review pass.
