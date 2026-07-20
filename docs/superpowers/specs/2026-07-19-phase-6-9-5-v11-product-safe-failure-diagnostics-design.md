# Phase 6.9.5 V11 Product-Acceptance Safe Failure Diagnostics Design

## Context and Decision

The V10 controlled-Live semantic-quality lineage is immutable and passed. Its subsequent branch product-acceptance lineage is separately immutable and terminal `recovery_only`: it claimed the first Review API slot but did not publish a result. The prior runner deliberately collapses activation, fact reads, trace baseline, HTTP dispatch, response validation, trace polling, trace canonicalization, and ledger persistence into one public `operation_failed` code. The recovery terminal proves recovery made no new provider call; it cannot reconstruct the original request.

V10 must not be reset, completed, extended, or retried. The selected remedy is a new V11 **product-acceptance-only** lineage. V11 reuses the committed V10 controlled-Live authority and its model/quality/cost precondition; it does not create a new paired evaluation, model schema, prompt, or controlled-Live evidence.

## Options Considered

1. Retry or append V10. Rejected: a claimed slot without a result is permanently indeterminate, and mutation would defeat the one-shot ledger boundary.
2. Persist raw exceptions, HTTP payloads, or provider diagnostics. Rejected: those can contain prompts, facts, credentials, cookies, tokens, raw errors, or provider data.
3. Add a V11 profile with durable, fixed failure checkpoints. Selected: it identifies the component boundary without exposing contents and keeps prior evidence immutable.

## V11 Evidence and Permission Boundary

V11 receives a new immutable profile identity, confirmation literals, public ledger root, recovery root, browser profile root, local owner lock, and strict public schemas. It remains protected by the existing global runtime owner lease because every product profile and both `branch` and `main` environments control the same Docker `server`, port `3001`, database, and process-scoped gates.

V11 product preflight reads only the committed V10 controlled-Live success authority. It rejects V10 branch `recovery_only`, V8 history, unknown profiles, evidence drift, gate-on defaults, dirty Git state, or missing V10 authority before reservation, fixture creation, Docker, browser, or provider behavior.

Normal runtime remains mock/default-off. The root `.env` remains credential input only; V11 never writes any gate to it. The final V11 branch product command may activate one component at a time in a temporary server process, and it must restore mock/default-off before the counterpart component, cleanup, or any visible non-acceptance browser window.

## Safe Diagnostic Contract

V11 creates append-only private checkpoint leaves in its recovery journal. A checkpoint contains only:

- a strict schema version;
- `component`: `review` or `planner`;
- `slot`: `api` or `browser`;
- a fixed checkpoint enum; and
- conservative `providerCallState`: `not_started` or `indeterminate`.

The initial V11 enum covers:

```text
review_api_activate
review_api_facts_before
review_api_trace_baseline
review_api_dispatch
review_api_observation
review_api_trace_wait
review_api_trace_canonicalize
review_api_slot_record
review_browser_trace_baseline
review_browser_launch
review_browser_dispatch
review_browser_observation
review_browser_default_off
review_browser_trace_wait
review_browser_trace_canonicalize
review_browser_slot_record
planner_api_activate
planner_api_facts_before
planner_api_trace_baseline
planner_api_dispatch
planner_api_observation
planner_api_trace_wait
planner_api_trace_canonicalize
planner_api_slot_record
planner_browser_trace_baseline
planner_browser_launch
planner_browser_dispatch
planner_browser_observation
planner_browser_default_off
planner_browser_trace_wait
planner_browser_trace_canonicalize
planner_browser_slot_record
```

`providerCallState` starts as `not_started`; it changes to `indeterminate` immediately before any API or browser request is allowed to reach the suggestions endpoint. It never changes back, and no diagnostic path claims zero provider calls after dispatch begins.

For an ordinary caught V11 operation failure, the runner writes exactly one strict public `.failure.json` projection with `{ environment, component, slot, checkpoint, terminal: 'operation_failed', providerCallState }`. It contains no free text. A hard crash is recovered from the last private checkpoint; its recovery terminal projects the same safe fields. Readers reject unknown leaves, unknown enum values, inconsistent checkpoint order, a V8/V10 identity, conflicting success/recovery/failure terminals, or a failure record that claims `not_started` after a dispatch checkpoint.

## Runner and Composition Changes

The product runner exposes an explicit V11 diagnostic port. Before every dangerous awaited boundary it durably appends the matching checkpoint. The runner must split the current combined dispatch operation so `api_trace_baseline` is separate from `api_dispatch`; browser trace baselining is likewise invoked before the headed browser operation. Trace polling and trace canonicalization receive independent checkpoints.

The port is synchronous from the runner's perspective: if a checkpoint cannot be durably written, the runner aborts before the next external action. On failure it records the terminal projection before the existing default-off/cleanup path. V8 and V10 retain their current exact leaf sets and generic terminal behavior; only canonical V11 uses these additional leaves and records.

## Tests and Acceptance

TDD first proves each fake failure boundary produces exactly one expected V11 checkpoint and public failure projection. Tests must cover activation, facts, API baseline, API dispatch, observation validation, trace wait, trace canonicalization, slot record, browser launch/dispatch, default-off, hostile checkpoint input, cross-lineage identity injection, crash recovery, and global lease contention. Assertions verify that no prompt, response, raw error, URL, header, token, credential, user fact, or usage field enters either private checkpoint or public projection.

Only after focused/full static gates plus independent contract/operations reviews pass may one new V11 branch product acceptance run. On success it performs Review API -> headed `/plan` -> default-off -> Planner API -> headed `/today` -> default-off -> exact cleanup. On any new terminal failure, V11 is recovered and closed without a retry. On success, commit branch evidence, merge `--no-ff` to `main`, run the separate four-request main replay using V11 authority, retain a normal browser window, update documents, push `origin/main`, and prove SHA parity.
