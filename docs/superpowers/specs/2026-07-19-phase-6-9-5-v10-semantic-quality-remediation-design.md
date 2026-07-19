# Phase 6.9.5 V10 Semantic Quality Remediation Design

## Context and Decision

V9 is immutable. Its controlled-Live completed the provider, schema, budget, cost, latency, and zero-call checks, but failed the quality gate: `23` provider attempts, `22` runtime admissions, `26` verified zero-call cases, `48` strict successes, quality `30/48`, semantic `4/22`, and two critical failures. The durable result is `finalized / invalid_attempted / closed / quality_gate_failed`; it has no success seal and cannot enter product acceptance.

The failure does not prove that DeepSeek V4 Pro is unusable. The V9 prompt did not define the diagnoses, strategies, selection precedence, or planner full-permutation rule that the local evaluator required. The evaluator also treated `diagnosis` and `strategy` as hard semantic gates even though production only applies selected weak-point indexes and block order. The synthetic planner fixtures expected hidden permutations that were not derivable from their visible input.

V10 takes the smallest corrective path: retain the real model, provider, budgets, permissions, deterministic merger, and default-off product gates; make the model-visible contract and the evaluation contract describe the same behavior. V1--V9 evidence and markers stay immutable and V9 is never retried.

## Options Considered

1. Relax the V9 quality threshold or count label-only mismatches as success. Rejected: it would hide a contract mismatch and would not prove useful model behavior.
2. Keep the current schema but add definitions for every label. Rejected: `diagnosis` and `strategy` remain non-authoritative output fields and would continue to create false negatives.
3. Use model output only for production-effective decisions, define visible deterministic selection rules, and evaluate fixtures derived from that contract. Selected: it preserves real LLM judgment while keeping facts, writes, and final content local.

## V10 Contract

The Review candidate returns only `focusIndexes`; the Planner candidate returns only `blockOrder`. The existing local deterministic agents still own priority, strategy wording, facts, minutes, links, task creation, and all persistence. Model success remains a read-only reordering/selection overlay, never an authority to invent data.

The prompt is a direct sanitized JSON object, not a JSON string nested inside another JSON string. It contains numbered options and a short policy:

- Review: prefer high-priority weak points; among equal priorities prefer lower confidence; preserve source order for remaining ties; return one to three unique indexes.
- Planner: return every supplied block exactly once; blocks whose visible reason is overdue come first; otherwise preserve the supplied deterministic order; ties preserve source order.

The runtime fixtures expose the evidence required by these rules. Each expected choice is generated from visible priority, confidence, block reason, and source index. The fixture policy oracle rejects an expected value that cannot be derived from the same visible input, preventing hidden ordinal labels. Mock coverage must derive the decision from the fixture-visible policy instead of returning `fixture.expected`.

The safe aggregate records only lane totals and dimensions: `review.focusIndexes`, `planner.blockOrder`, plus strict, quality, and critical counts. A strict Zod contract rejects unknown top-level and nested fields, raw case entries, prompt, snapshot, model output, URL, credential, raw error, and per-case timing/usage. It is the only serializable V10 evidence projection.

## V10 One-Shot and Admission

V10 is an independent durable lineage with a new profile id, confirmation string, eval gate, evidence directory, once marker, strict contract, stage manifest, and success seal. It snapshots V1--V9 before reservation and remains fail-closed on any drift. It retains the V9 model identity, JSON-object non-thinking transport, `4500ms` timeout, 1 canary plus 22 paired admissions, 26 zero-call cases, and CNY `1.00` hard cap.

Product acceptance reads only a committed V10 success. The existing Review-only, default-off restore, Planner-only, default-off restore, Docker, headed browser, trace, cleanup, main replay, and push sequence stays unchanged. A V10 failure is terminal for V10 and does not permit Docker, browser, main merge, or product gate enablement.

## Acceptance Criteria

1. Prompt-contract tests prove both model requests receive a direct structured payload, visible indexes, the exact selection/order policy, and the Planner full-permutation instruction.
2. Fixture-policy tests prove every runtime expected decision from the visible fixture data; no runtime expected answer is a hidden ordinal.
3. The evaluator marks quality only from production-effective `focusIndexes` and `blockOrder`, retains all safety/strict/zero-call checks, and publishes safe lane aggregates protected by strict unknown-key and forbidden-key tests.
4. V1--V9 evidence is byte-stable before and after V10 work; V10 starts with no evidence/once marker and uses one controlled-Live command only after all offline gates and independent review pass. The command enables only the V10 eval gate in its own process, explicitly keeps V8/V9 and Review/Planner product gates false, and never writes a gate into `.env`.
5. Phase 6.9.5 is complete only after V10 committed success, branch Docker/headed-browser product acceptance, default-off recovery and exact cleanup, `--no-ff` main merge, main evidence/product replay, current docs, and `origin/main` SHA parity.
