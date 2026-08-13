# Phase 6.9.8 SR5 D4 runtime runner/durability

Date: 2026-08-13

Branch: `drb/phase-6-9-8-sr5-runtime-runner-durability`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_runtime_runner_durability`

Quality authority: `none`

## Scope

D4 is the first production-shaped durability composition after D3, but it is not a production entrypoint. D3 remains record-only and
issues no execution capability. D4's explicitly test-only helper wraps a validated synthetic D3 record in a single-use capability and
creates a fixed-denominator durability bundle. D4 does not consume user acceptance, read credentials, create a Provider adapter, or
issue a runner/provider execution capability.

```text
D3 dynamic source binding capability
  -> one-shot reservation
  -> 8/8 zero-call guards
  -> 12/12 lanes reserved, 0 dispatch/response/usage
  -> canonical marker + 5-record hash-chain journal
  -> strict report + hard-link artifact
```

## Contracts

- `runnerInvocationAllowed=false` and `providerDispatchAllowed=false` are fixed in marker, report, and counters.
- The source capability and reservation are single-use. A second source consume, second reservation, or second run fails closed.
- The journal sequence is exactly `attempt_reserved -> guards_completed -> lanes_accounted -> run_terminal -> evidence_published`.
- Crash-only recovery may instead seal `attempt_reserved -> recovery_claimed -> run_terminal -> evidence_published`; it never resumes
  a guard/lane, refuses an active owner, and rejects a second seal.
- Marker/report/artifact bytes are canonical JSON with LF endings. The root artifact is a hard link to the report copy; validator
  recomputes marker/report/artifact hashes, journal hash chain, fixed counts, source identity, and link identity.
- The only runtime root is an OS temporary directory and is removed by tests. No formal namespace is touched.

## Validation

Focused D4 plus D3 regression passed `26/26` tests (`47 expect()` calls). The final Agent full passed `1634/1634` tests (`25433 expect()`
calls, `202 files`) with Bun `--timeout 30000`; typecheck, lint, Prettier, and `git diff --check` passed. The first full run under
Bun's default 5-second per-test limit timed out 8 historical fsync-heavy Phase 6.9.7 tests without assertion failures. The affected
6 files then passed `48/48` independently under the 30-second threshold, followed by the zero-failure extended full run. D4 covers
fixed denominator accounting, one-shot capability/reservation, crash-only seal without replay, active-owner/second-seal refusal,
canonical recovery-claim validation, tamper rejection without repair, hard-link publication, and rejection of Live/authorization-shaped argv.

Credential reads, Provider calls, formal evidence, business writes, Docker/API/browser access, Trace, BackgroundJob, and Outbox are
all `0`. This is not model-quality, semantic, product, or controlled-Live evidence.

## Git and next stop

The feature branch is intentionally kept separate until full validation and documentation parity are complete. After this task is
merged and revalidated on `main`, the only remaining SR5 engineering task is the final Git verifier that produces the dynamic source
receipt after complete-source merge/tagging. A new v4 tag, remote parity, fresh DeepSeek/Qwen boundary acceptance, and any controlled-
Live execution require separate future authorization. Historical v1/v2/v3 tags, authorizations, and sealed evidence are immutable.
