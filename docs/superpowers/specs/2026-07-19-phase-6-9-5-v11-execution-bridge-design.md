# Phase 6.9.5 V11 Product-Acceptance Execution Bridge Design

## Problem

V11 currently has a safe failure-diagnostics contract: a public reservation/failure projection, private attempt-bound checkpoints, and a runner diagnostics port. It intentionally does not own the successful product-acceptance records required by the existing four-request runner: slot claims/results, default-off receipts, screenshots, owner isolation, cleanup, acceptance aggregate, and success seal.

Therefore a V11 CLI that only preflights and then reports `runtime_not_configured` would be misleading: it could never produce a successful branch acceptance. Reusing V8/V10 runtime ledgers or recovery journals is prohibited because both product lineages are immutable terminal history.

## Decision

Add a V11-only execution bridge before adding any V11 CLI. It provides the full success path as a new, attempt-bound V11 ledger while retaining the V11 failure checkpoint contract. It reuses only code-level deterministic runner logic and existing default-off/cleanup adapters; it never reuses V8/V10 evidence roots, terminal records, resource selectors, owner locks, or attempt bindings.

V10 controlled-Live remains the sole semantic-quality authority. The bridge itself does not call a provider, Docker, browser, or runtime command during implementation. Those actions remain reserved for the single later V11 branch product command after all offline gates and reviews pass.

## Contract

The V11 public root gains strict V11-identity records for:

- manifest and slot claims/results;
- review/planner default-off receipts and screenshots;
- owner-isolation and exact-cleanup receipts;
- one safe acceptance aggregate and success seal; and
- one strict failure projection.

Failure and success terminals are mutually exclusive. Every reader verifies the same public reservation hash, private attempt binding, V11 execution manifest, profile identity, leaf allowlist, and global runtime lease provenance. A claimed-but-unfinished attempt remains fail-closed; neither recovery nor a later attempt can complete or reinterpret it.

The private V11 execution manifest is bound to the existing V11 opaque attempt id/hash and stores only the synthetic resource selectors needed for exact recovery: generated test-account identifiers, fixture identifiers, browser profile path, and executable path. It excludes passwords, access tokens, raw capability, provider key, prompt, response, user facts, raw errors, and browser cookies. It is created before resource creation and is strictly validated by recovery.

## Runner and Composition Bridge

The bridge exposes a V11 runner-ledger adapter that implements the runner mechanics locally but serializes all public records with V11 schema identities. The adapter owns slot order, trace hash/usage checks, screenshot hashes, default-off receipts, owner isolation, cleanup, acceptance aggregate, and success finalization. It uses the V11 profile and V11 attempt binding; no V8/V10 normalizer accepts V11 public records.

The default V11 composition creates, in order: canonical V11 preflight, V11 owner/global runtime lease, V11 attempt reservation, private execution manifest, synthetic resources, V11 checkpoint journal, V11 runner-ledger bridge, V11 diagnostics port, then the existing default runner dependencies. Failure paths publish only the strict V11 failure projection and run recovery/default-off/cleanup through exact V11 manifest selectors. Success paths publish only V11 acceptance/success leaves.

The existing V8/V10 composition and historical leaves remain byte-compatible. V11's use of the existing deterministic runner/dependency code is an implementation reuse, not evidence reuse.

## Tests and Gates

Tests precede implementation and cover:

1. strict V11 success records, success/failure mutual exclusion, unknown/cross-lineage identity rejection, attempt binding, and partial publish;
2. private execution manifest redaction and fresh recovery validation;
3. a fake composition bridge proving exact ordering, zero side effects on preflight/owner failure, and runner success/failure record routing;
4. V11 runner adapter integration with fake Trace/browser/default-off/cleanup dependencies; and
5. V8/V10 byte/read regressions plus global lease contention.

Only after offline tests, full relevant static gates, documentation, contract/security review, and operations review pass may the exact V11 CLI be added and a one-shot branch product command be considered. A failed V11 branch run is terminal and recovered once; it is never retried.
