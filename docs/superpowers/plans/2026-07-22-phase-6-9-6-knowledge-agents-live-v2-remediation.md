# Phase 6.9.6 Knowledge Agents Controlled-Live V2 Remediation Plan

**Goal:** Remediate the single immutable V1 controlled-Live quality failure without rewriting its evidence, weakening any safety gate, or replaying the provider run under the same prompt version.

**Authority:** V1 run `35cef6a3-97ee-4cb3-accb-ff8fa6bd59cd` is final for `knowledge-agents-v1`. Its evidence and `.tmp/phase-6-9-6-controlled-live.marker` must remain byte-for-byte intact. A V2 Live run may happen only after the V2 static/Mock checkpoint, a new explicit authorization, and a version-specific one-shot marker.

**Unchanged boundaries:** Keep dataset `phase-6.9-knowledge-agents-v1`, deterministic baseline `0.2322452551`, Qwen shortlist, projection safety, strict schemas, local ID/fact/permission authority, read-only behavior, pricing, budgets, timeouts, quality thresholds, Docker data-safety rules, and exact cleanup rules unchanged.

## V1 evidence verdict

| Area | Result | Verdict |
| --- | ---: | --- |
| Dataset / calls | 72 cases, 24 zero-call, 48 runtime, 24 paired | Correct |
| Safety | critical / permission / mutation / broader fallback = 0 | Correct |
| Latency | endpoint P95 `2068.2995ms` | Pass |
| Usage / cost | 48 verified, `0.092604 CNY` | Pass |
| Dedup | macro-F1 `0.6807692308`, revision recall `0` | Fail |
| Organizer | subject `0.75`, tag micro-F1 `0.6197183099`, collection F1 `1` | Fail |
| Overall | `quality_gate_failed` | Immutable V1 authority |

Observed failure groups:

1. `dedup-runtime-07..11`, `13`, and `16` returned a parseable relation but were not applied. V1 evidence does not retain the exact bounded validation reason, so it is not valid to claim the precise provider evidence-code array. Source inspection proves that V1 did not tell the model the relation-specific evidence-code matrix.
2. `dedup-runtime-12` was a genuine revision-versus-duplicate semantic miss. The eval projection also flattened every document to `relativeTime=same_time`, discarding the dataset's local timestamp signal.
3. Organizer collection pairs were correct for all cases. Subject misses and generic/split extra topic labels caused the quality failure. The V1 prompt omitted explicit subject boundaries and precision rules. The evaluator also scored every raw topic label even though the local merger applies at most the first topic label after subject/resource labels.

## Execution invariants

- Work on `codex/phase-6-9-6-knowledge-agents`; do not create a worktree or child branch.
- One focused task, one commit. The main agent owns all edits and final verification; subagents are read-only evidence gatherers.
- Do not delete, rename, rewrite, or regenerate the V1 marker/evidence. Do not run another V1 Live command.
- Do not change the fixed dataset, baseline, gate thresholds, price, token/call budgets, timeouts, owner isolation, write permissions, or fallback behavior to make metrics pass.
- V2 reports must remain sanitized: no prompt, filename, summary, chunk, provider body/header/response, raw error, credential, or API key.
- Do not start Docker product acceptance until a newly authorized V2 Live report passes every fixed gate.
- Never prune Docker, run `down -v`, reset databases/volumes, flush Redis, or wipe MinIO.

## Task R1: Dedup V2 semantic contract

**Files:**

- Modify `packages/agent/src/model-candidates/knowledge-dedup-model-candidate.ts`
- Modify `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Modify `packages/agent/tests/knowledge-dedup-model-candidate.test.ts`
- Modify `packages/agent/tests/phase-6-9-knowledge-agent-paired-runner.test.ts`

- [ ] Add RED tests proving the request describes every relation-specific evidence-code rule and never exposes local IDs/hashes.
- [ ] Add RED tests proving a high-semantic-overlap duplicate decision plus authoritative local version/time evidence is rebuilt as `possible_revision`, while the same decision without local evidence remains `semantic_duplicate`.
- [ ] Add RED tests proving the eval projection preserves `older/newer/same_time` from canonical timestamps instead of flattening all cases to `same_time`.
- [ ] Implement the minimum prompt, local-merger, and eval-projection changes. Do not loosen the Zod or dynamic evidence validator.
- [ ] Run focused candidate/contract/paired tests and commit.

## Task R2: Organizer V2 precision contract

**Files:**

- Modify `packages/agent/src/model-candidates/knowledge-organizer-model-candidate.ts`
- Modify `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Modify `packages/agent/tests/knowledge-organizer-model-candidate.test.ts`
- Modify `packages/agent/tests/phase-6-9-knowledge-agent-paired-runner.test.ts`

- [ ] Add RED tests for explicit subject boundaries: general computer science is `computer`; named non-computing disciplines are `major`; interdisciplinary/general topics without an exam-discipline signal are `other`.
- [ ] Add RED tests requiring precise source-grounded topic phrases, discouraging generic teaching/resource labels, and preserving a combined safe label when punctuation separates one topic phrase.
- [ ] Align eval semantics with the local merger's actual topic-label cap; never hide a subject or collection error.
- [ ] Implement prompt/policy changes without injecting dataset answers or weakening label/schema safety.
- [ ] Run focused candidate/contract/paired tests and commit.

## Task R3: V2 evidence diagnostics and one-shot boundary

**Files:**

- Modify `packages/agent/src/evals/phase-6-9-knowledge-agent-paired-contract.ts`
- Modify `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Modify `packages/agent/scripts/phase-6-9-6-knowledge-agent-cli.ts`
- Modify matching CLI/contract/runner/validator tests

- [ ] Keep V1 reports valid and immutable while making new reports identify `knowledge-agents-v2`.
- [ ] Add only bounded diagnostics needed to distinguish raw schema validity, dynamic validation/candidate disposition, and applied-result semantics. Reject sensitive or free-form diagnostics.
- [ ] Use a V2-specific `wx` marker; an existing V1 marker must remain untouched and must not block a separately authorized V2 run.
- [ ] Prove a V2 marker blocks a second V2 attempt and that V1 evidence still validates.
- [ ] Run focused CLI/validator/contract tests and commit.

## Task R4: Static/Mock checkpoint and documentation

**Files:**

- Modify `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`
- Modify `AGENTS.md`, `README.md`, `DEVLOG.md`, `docs/roadmap.md`
- Modify this plan

- [ ] Run focused Agent tests, full Agent/types tests, affected typecheck/lint, V2 Mock, evidence validator, and `git diff --check`.
- [ ] Confirm no provider call, no new Live marker/evidence, both product gates false, Docker volumes untouched, and V1 evidence still validates.
- [ ] Record actual hashes/counts/results and commit the V2 static/Mock checkpoint.
- [ ] Stop and request one fresh V2 controlled-Live authorization.

## Task R5: Single V2 controlled-Live

- [ ] Recheck clean branch, V1/V2 evidence bundle, provider retention acceptance, credential isolation, Docker volumes, and default-off gates.
- [ ] Execute exactly one authorized `knowledge-agents-v2` branch Live run.
- [ ] Validate the immutable report. If any fixed gate fails, preserve it, keep product gates false, and create a new versioned diagnosis; never replay V2.
- [ ] Only if every fixed gate passes, proceed to the existing Task 13 Docker API, visible browser, precise cleanup, documentation, branch commit, `--no-ff` main merge, main default-off replay, and remote push.

## Completion boundary

Passing V2 and the remaining Task 13 product acceptance completes only Phase 6.9.6 KnowledgeDedup/Organizer semantic agents. It does not complete the rest of Phase 6.9, executable LangGraph, Tutor/WrongQuestionOrganizer/Memory/Retriever/FinalResponse/Tool Orchestrator work, Phase 6.10 layered memory, Phase 8, Phase 9, or either interview blog.
