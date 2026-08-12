# Phase 6.9.8 SR5 next-lineage C2 tag contract

Date: 2026-08-12

Branch: `drb/phase-6-9-8-sr5-next-lineage-tag-contract`

Authority: `zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_tag_parity`

Quality authority: `none`

## Purpose

C2 freezes the post-merge v3 annotated-tag contract without modifying the D0/C1 admission rule that requires the tag to be absent. The verifier dynamically reads the tag object ID and recomputes the source bundle from the peeled commit. It does not embed either value in the `packages/agent` tree, avoiding a source-bundle fixed-point and pre-creation tag-object circularity.

The canonical tag message binds the next lineage, source-manifest SHA, final whole-tree source-bundle SHA, sealed v2 tag object/peeled commit, and zero-provider counters. The verifier requires clean `main == upstream == origin/main`, local and remote raw tag-object parity, annotated `tag` kind, target/peeled commit equality, exact message equality, unchanged v2 receipt, and an empty v3 evidence namespace.

## Pre-tag verification

- focused tag contract: `21/21`, `31 expect()` calls
- Agent full: `1575/1575`, `25319 expect()` calls, `198 files`
- typecheck passed
- zero-provider boundary: Provider, credential, formal evidence, and business writes are all `0`
- no `.env`, proxy, adapter, Docker/API/browser, Trace, BackgroundJob, or Outbox access

Fault coverage includes feature branch, dirty tree, upstream/origin drift, lightweight tag, local/remote tag mismatch, absent remote tag, peeled/target/message drift, invalid bundle, foreign v3 evidence, sealed-v2 identity drift, forged/relabeled/hostile capability, hostile observation, and environment/network-access detection.

## Closeout order

1. Commit and push the feature branch.
2. Merge with `--no-ff` into `main` and push `main`.
3. Compute the final source bundle from that immutable merge commit.
4. Create the v3 annotated tag with the canonical message and target exactly that commit.
5. Push the tag, then verify local/remote raw tag object, peeled commit, canonical message, source bundle, and zero-provider counters.

No documentation commit may move `main` beyond the approved tag after step 4. Final identities remain in the immutable annotated tag and verifier output. C2 is not controlled-Live authorization, model quality, product acceptance, P95/SLA, or blog authority.
