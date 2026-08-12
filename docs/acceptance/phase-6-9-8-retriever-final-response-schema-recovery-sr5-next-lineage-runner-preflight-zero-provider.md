# Phase 6.9.8 SR5 next-lineage D2 runner preflight

Date: 2026-08-12

Branch: `drb/phase-6-9-8-sr5-next-lineage-runner-preflight`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_runner_preflight`

Quality authority: `none`

## Scope

D2 composes three already-bounded inputs without creating a Live entrypoint:

1. C2 annotated-tag parity capability;
2. D1 exact DeepSeek/Qwen boundary and one-shot authorization capability;
3. a strict zero-call proxy attestation.

The composition cross-checks branch, source commit, source manifest, source bundle, approved tag, and annotated tag object identity before issuing a module-owned single-use preflight capability. Direct proxy mode requires zero listener probes; loopback mode requires exactly one probe. Both require `providerCalls=0`.

## Fail-closed coverage

- forged, reused, relabeled, or hostile capabilities;
- C2/D1 source identity mismatch;
- unavailable or malformed proxy result, provider-call drift, probe-count drift, and extra fields;
- pre-abort and hostile input descriptors;
- executable, Live-shaped, and authorization-shaped argv.

The output fixes `runnerInvocationAllowed=false` and `providerDispatchAllowed=false`. It cannot be consumed by the historical Live runner.

## Zero-provider boundary

- focused: `13/13`, `29 expect()` calls
- Agent full: `1608/1608`, `25383 expect()` calls, `200 files`
- typecheck, lint, Prettier, and `git diff --check` passed
- credential reads, Provider calls, formal evidence, and business writes are all `0`
- no `.env`, Provider adapter, run id, reservation, marker, journal, report, artifact, recovery claim, Docker/API/browser, Trace, BackgroundJob, or Outbox access

D2 does not request or consume fresh user acceptance. Existing v3 remains an immutable predecessor checkpoint; it does not contain D1 or D2. A later executable source requires a new monotonic tag and separately refreshed authorization binding.
