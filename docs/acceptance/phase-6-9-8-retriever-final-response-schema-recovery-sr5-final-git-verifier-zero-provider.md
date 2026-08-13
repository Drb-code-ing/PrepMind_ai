# Phase 6.9.8 SR5 D5 final Git verifier

Date: 2026-08-13

Branch: `drb/phase-6-9-8-sr5-final-git-verifier`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_final_git_verifier`

Quality authority: `none`

## Scope

D5 adds a read-only, post-tag Git verifier for the future immutable v4 annotated tag
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v4-approved`. It derives the D3
runtime source receipt from Git; callers cannot supply commit, tag, manifest, or bundle identities.
The verifier never creates, moves, or pushes tags, requests or consumes authorization, reads `.env`,
calls DeepSeek/Qwen, invokes D4, or writes formal evidence/business data.

The verifier requires `main == upstream == origin/main == peeledCommit == targetCommit`, a clean tree,
annotated tag kind, local/remote tag-object parity, the exact tag message, the dynamic source-object bundle,
the sealed v2 predecessor identity, and an empty current-lineage evidence namespace. Any Git I/O, tag,
schema, path, object, or parity failure is fail-closed.

It may issue one module-private `git_verified` capability containing only the source receipt and
`gitAuthorityIssued=true`; `runnerInvocationAllowed=false`, `providerDispatchAllowed=false`,
`qualityAuthority=none`, and all credential/provider/evidence/business counters remain zero. The capability
is opaque and single-use. Synthetic fixtures exist only for contract tests.

## Validation

Focused D5 passed `22/22` tests (`38 expect()` calls), including parity drift, dirty/untracked state,
lightweight/malformed tag, local/remote object mismatch, peeled/target drift, source bundle drift,
current-lineage evidence, sealed predecessor movement, hostile accessors, capability forgery/reuse,
CLI rejection, and current pre-tag repository fail-closed behavior. Typecheck, Prettier, and
`git diff --check` passed. No `.env`, credential, Provider, Docker/API/browser, Trace, BackgroundJob,
Outbox, formal evidence, or business write was used.

## Ordering and next stop

D5 must be merged and pushed to `main`, then merged-main zero-provider validation must pass. Only a
later independent Git-operation task may create and push the final v4 annotated tag on that complete
source. A later read-only D5 invocation may then produce the dynamic receipt. Fresh DeepSeek/Qwen data
boundary acceptance and exact authorization remain separate; no controlled-Live is part of D5.
