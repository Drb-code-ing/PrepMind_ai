# Phase 6.9.8 SR5 next-lineage D1 authorization contract

Date: 2026-08-12

Branch: `drb/phase-6-9-8-sr5-next-lineage-authorization-contract`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_authorization`

Quality authority: `none`

## Scope

D1 freezes the future DeepSeek/Qwen current-account data-boundary receipt and one-shot authorization vocabulary against the immutable v3 source checkpoint:

- tag: `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3-approved`
- tag object: `b450e8759ef252a83195f5e4763c198e0c82ac99`
- source/peeled commit: `69fb2c97946f5a8f9468064a7d12406b6584af6b`
- source manifest: `sha256:17c511ef7a1c71527add69cb3ba16857d4053a8618692d9db96e85be29bf3d82`
- source bundle: `sha256:b4bd64db17c1281441ac72f1a78c06c22fdf84aeb372fa6173b790a36e3611ca`

The contract stores only SHA-256 confirmation digests in its result and issues a module-owned single-use capability. It rejects old SR5 authorization strings, v4 placeholders, source-side or authorization-side identity drift, provider-order drift, extra fields, forged/hostile capabilities, hostile input accessors, and executable authorization argv.

## Zero-provider boundary

- focused: `20/20`, `32 expect()` calls
- Agent full: `1595/1595`, `25352 expect()` calls, `199 files`
- typecheck and lint passed
- `providerDispatchAllowed=false`
- Provider calls, credential reads, formal evidence, and business writes are all `0`
- no `.env`, proxy, credential, adapter, reservation, marker, journal, runner, Docker/API/browser, Trace, BackgroundJob, or Outbox access

No user data-boundary acceptance or Live authorization was requested or consumed in D1. The exact confirmation values are contract vocabulary, not approval.

## Source chronology

The v3 tag is an immutable source checkpoint created before D1. D1 must not move or overwrite it. Once D1 and any future runner are merged, that newer whole-tree source requires a new monotonic approved tag before any controlled-Live can execute. Therefore v3 remains source authority for the values frozen here, while future execution must bind a later tag that actually contains the execution entrypoint.

D1 does not unlock Provider calls, controlled-Live, product acceptance, P95/SLA, or blog completion.
