# Phase 6.9.8 SR5 v9 evidence namespace recovery

Date: 2026-08-14

Branch: `drb/phase-6-9-8-sr5-v9-evidence-namespace`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_v9_namespace`

Quality authority: `none`

## Failure boundary

The authorized v8 entrypoint stopped at `source_admission_invalid` before credential projection or attempt reservation. Its terminal counters were `providerCalls=0`, `credentialReads=0`, `formalEvidence=0`, and `businessWrites=0`. It created no v8 marker, journal, report, artifact, recovery claim, Trace, BackgroundJob, Outbox, or business data.

FastCtx and CodeGraph traced the failure to the active formal-evidence regex and durability path family. Both still used the unversioned `...schema-recovery-sr5-live` prefix, so the immutable sealed v2 marker and report were interpreted as current evidence. This was a namespace-design defect, not a DeepSeek, Qwen, proxy, credential, schema-quality, or product failure.

## Recovery

v9 assigns the current marker, journal, report, temporary report, recovery claim, and dispatch lock to the isolated `...schema-recovery-sr5-live-v9` namespace. Source admission and durability share the same exported namespace constant. Historical unversioned v2 files remain readable as sealed evidence but are excluded from v9 admission. Current v9 leftovers still fail closed before a new reservation.

Focused zero-provider tests include a regression that creates legacy unversioned marker/report files and confirms the v9 scanner returns an empty current namespace. The existing leftover, tamper, replacement, run-binding, and first-dispatch tests remain active.

Verification on the feature branch passed:

- focused SR5 Live/runtime-source/final-verifier: `67/67` (`148 expect()`);
- Agent full: `1657/1657` (`25474 expect()`, `203 files`);
- Agent typecheck and lint: exit `0`;
- Prettier and `git diff --check`: exit `0`.

No `.env` or credential was read during this recovery. No Provider was called, and Docker, PostgreSQL, Redis, MinIO, API, browser, Trace, BackgroundJob, Outbox, and business data were not started, cleared, or modified.

## Stop gates

The feature was merged and pushed as `3ad7d7ce06c5b4a79132c1411522bf396e6f8987`. Focused and Agent-full replay passed on merged `main`; local/remote annotated tag object `b0abb9a5eea8d674e98c2fdc33f18eb1c95dc1ff` peeled to that commit. The final read-only Git verifier returned `ok=true`, source manifest `sha256:35890f5da943fe6b53a48a13926b89d813e682f3ae28566ee55821b108dbeb45`, and source bundle `sha256:47e424c4509dcc0e680fc29bd1b5586092f4ae600575c94480cd918ed3f201ec`.

Fresh v9 data-boundary acceptance and exact authorization were subsequently received. The production entrypoint stopped at `proxy_preflight_not_ready` before credentials or reservation, with all side-effect counters at zero. That terminal boundary is recorded separately in `phase-6-9-8-retriever-final-response-schema-recovery-sr5-v9-proxy-preflight-failure.md`; this zero-provider recovery document does not claim model or product authority.
