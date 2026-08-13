# Phase 6.9.8 SR5 D3 runtime source binding contract

Date: 2026-08-12

Branch: `drb/phase-6-9-8-sr5-next-lineage-runtime-source-binding`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_runtime_source_binding_contract`

Quality authority: `none`

## Problem

D1 correctly froze the immutable v3 checkpoint, but D1 and D2 were added after v3. Hard-coding a future final commit, bundle SHA, or annotated-tag object inside the covered `packages/agent` tree would create a fixed-point loop: changing the constant changes the tree it tries to identify.

## Decision

D3 introduces a separate v4 runtime-source contract with stable code-defined values only:

- lineage and `main` branch;
- future v4 annotated tag name/ref;
- source-object scope and source-manifest SHA;
- sealed v2 predecessor identity;
- exact DeepSeek/Qwen data-boundary and one-shot authorization vocabulary.

The values that can exist only after final merge are supplied by a future Git verifier as a runtime receipt: HEAD/upstream/origin, source bundle, tag object, remote tag object, peeled commit, and target commit. D3 strictly validates parity and binds the authorization object byte-for-byte to those dynamic values.

D3 deliberately does not issue Git authority or an executable capability. Its output fixes `gitAuthorityIssued=false`, `runnerInvocationAllowed=false`, and `providerDispatchAllowed=false`. A later verifier must own Git inspection and capability issuance after the complete runner source is merged and tagged.

## Validation

- focused: `19/19`, `30 expect()` calls
- Agent full: `1627/1627`, `25415 expect()` calls, `201 files`
- typecheck, lint, Prettier, and `git diff --check` passed
- rejects branch/HEAD/upstream/origin, dirty-tree, manifest, annotated-tag kind/ref/object, remote object, peeled/target, evidence namespace, and extra-field drift
- rejects authorization commit/bundle/tag-object mismatch, old/wrong confirmations, extra fields, hostile input, and executable authorization argv
- production module contains no hard-coded v3 commit, v3 bundle SHA, or v3 tag object ID

Credential reads, Provider calls, formal evidence, and business writes are all `0`. No `.env`, proxy probe, adapter, runner, reservation, marker, journal, artifact, Docker/API/browser, Trace, BackgroundJob, or Outbox was accessed.

D3 does not consume user acceptance and does not create the v4 tag. Runner/durability and the final Git verifier must be completed before the one final source tag and any fresh authorization.

## Superseded final-tag checkpoint

The v4 tag was later created and passed D5 Git inspection, but a tagged-source replay exposed a lifecycle-dependent test and passed
`21/22`. v4 remains immutable and receives no authorization. The current final runtime-source contract is v5; see
`phase-6-9-8-retriever-final-response-schema-recovery-sr5-v4-post-tag-test-recovery-zero-provider.md`.

## Git closeout

- feature commit: `0943c4e4`
- merge commit: `d553e545b33ca283b951b3c871e34c96dcf3d178`
- at the implementation-merge checkpoint, `main == origin/main == d553e545b33ca283b951b3c871e34c96dcf3d178`
- merged-main focused `19/19`, Agent full `1627/1627`, typecheck, and lint passed again
- no v4 tag, Git authority capability, authorization receipt, formal evidence, or Provider call was created
