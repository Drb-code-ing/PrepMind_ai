# Phase 6.9.5 Review / Planner V10 Branch Product-Acceptance Recovery

Date: 2026-07-19

Status: terminal `recovery_only`; this branch product-acceptance lineage is closed and must not be retried, reset, extended, or used as evidence of product success.

## Attempt Boundary

The V10 controlled-Live semantic-quality evidence remains independently `complete / passed` and was not rerun or changed. This document covers only the subsequent, separate V10 **branch product-acceptance** attempt.

The branch runner durably reserved its V10 ledger and claimed `slot-01-review-api`. It did not durably publish a slot result, `acceptance.json`, screenshot, or success seal. Therefore the attempt is fail-closed: no later step may infer that the request was absent, successful, unsuccessful at the provider, or cost-free.

## Recovery Evidence

The fresh V10 public reader projects the branch ledger as `recovery_only`.

- The recovery terminal is V10-identity `failed / hard_crash_recovered`.
- Recovery itself recorded `providerInvocations=0`, `acceptanceRequests=0`, and `browserContinues=0`.
- Those counts describe the recovery process only. They do **not** reconstruct whether the original claimed API slot reached a provider.
- The recovery journal proved default-off restoration and exact cleanup of synthetic accounts, fixtures, traces, browser processes, and browser profiles.
- Docker finished in mock/default-off mode with both Review and Planner model gates disabled and provider credentials absent from the server container.

No Docker volume, container set, cache, database, Redis data, or MinIO data was cleared to perform this recovery.

## What Could and Could Not Be Diagnosed

The original runner persisted a slot marker before the combined API path, then collapsed failures from trace baseline, API dispatch, response parsing, trace polling/canonicalization, and slot-result persistence into the same public `operation_failed` code. The V10 ledger intentionally excludes raw errors and request/response content, so the terminal evidence cannot distinguish those boundaries after recovery.

This is an acceptance-control-plane observability gap, not evidence that the Review model failed its semantic-quality gate. The exact cause must not be guessed from the generic terminal code.

## Required Follow-up

Create a new isolated V11 product-acceptance lineage before any new product request. It must:

1. keep V10 controlled-Live and V10 branch recovery evidence immutable;
2. use new V11 public/recovery/browser/owner namespaces and a new confirmation;
3. persist only a fixed failure checkpoint enum plus component, slot, terminal state, and conservative provider-call state;
4. avoid prompt, response, raw error, URL, header, token, credential, user fact, or per-request usage persistence;
5. prove every checkpoint with Mock/fake dependency tests before one newly authorized V11 branch product run.

Until that work passes review, all production Review/Planner gates remain default-off. No main merge, replay, push, or Phase 6.9.5 completion is authorized by this recovery-only result.

## Questions for Later Review

- Why does a claimed slot without a result force terminal recovery rather than a retry?
- Why does `providerInvocations=0` in recovery not prove the original attempt made zero provider calls?
- Which safe checkpoints distinguish API baseline, dispatch, observation validation, trace polling, and slot persistence without leaking model or user data?
