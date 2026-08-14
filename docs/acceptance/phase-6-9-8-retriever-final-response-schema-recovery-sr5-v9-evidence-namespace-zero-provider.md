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

The v8 authorization is not reusable. After the feature branch is committed and pushed, merged with `--no-ff` into `main`, pushed, and replayed on merged `main`, a new immutable v9 annotated tag must pass local/remote/source parity. Only then may fresh V9 DeepSeek/Qwen data-boundary acceptance and exact one-shot authorization be requested.
