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

- [x] Add RED tests proving the request describes every relation-specific evidence-code rule and never exposes local IDs/hashes.
- [x] Add RED tests proving a high-semantic-overlap duplicate decision plus authoritative local version/time evidence is rebuilt as `possible_revision`, while the same decision without local evidence remains `semantic_duplicate`.
- [x] Add RED tests proving the eval projection preserves `older/newer/same_time` from canonical timestamps instead of flattening all cases to `same_time`.
- [x] Implement the minimum prompt, local-merger, and eval-projection changes. Do not loosen the Zod or dynamic evidence validator.
- [x] Run focused candidate/contract/paired tests and commit.

R1 evidence: the new tests first failed on all three missing behaviors. GREEN verification is `22/22` across the strict model contract, Dedup candidate, paired contract, and paired runner; Agent typecheck and lint both exit `0`.

## Task R2: Organizer V2 precision contract

**Files:**

- Modify `packages/agent/src/model-candidates/knowledge-organizer-model-candidate.ts`
- Modify `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Modify `packages/agent/tests/knowledge-organizer-model-candidate.test.ts`
- Modify `packages/agent/tests/phase-6-9-knowledge-agent-paired-runner.test.ts`

- [x] Add RED tests for explicit subject boundaries: general computer science is `computer`; named non-computing disciplines are `major`; interdisciplinary/general topics without an exam-discipline signal are `other`.
- [x] Add RED tests requiring precise source-grounded topic phrases, discouraging generic teaching/resource labels, and preserving a combined safe label when punctuation separates one topic phrase.
- [x] Align eval semantics with the local merger's actual topic-label cap; never hide a subject or collection error.
- [x] Implement prompt/policy changes without injecting dataset answers or weakening label/schema safety.
- [x] Run focused candidate/contract/paired tests and commit.

R2 evidence: RED reproduced missing prompt rules, four bounded subject-authority corrections, and raw extra-label scoring (`semanticScore=0.95`). GREEN is `20/20` across model contract, Organizer candidate, paired contract, and paired runner; Agent typecheck/lint both exit `0`.

## Task R3: V2 evidence diagnostics and one-shot boundary

**Files:**

- Modify `packages/agent/src/evals/phase-6-9-knowledge-agent-paired-contract.ts`
- Modify `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Modify `packages/agent/scripts/phase-6-9-6-knowledge-agent-cli.ts`
- Modify matching CLI/contract/runner/validator tests

- [x] Keep V1 reports valid and immutable while making new reports identify `knowledge-agents-v2`.
- [x] Add only bounded diagnostics needed to distinguish raw schema validity, dynamic validation/candidate disposition, and applied-result semantics. Reject sensitive or free-form diagnostics.
- [x] Use a V2-specific exclusive-create one-shot marker; an existing V1 marker must remain untouched and must not block a separately authorized V2 run.
- [x] Prove a V2 marker blocks a second V2 attempt and that V1 evidence still validates.
- [x] Run focused CLI/validator/contract tests and commit.

R3 evidence: V2 reports add only nullable `rawSchemaValid` and enum `candidateDisposition`; V1 requires those fields to remain absent. V2 uses `PHASE_6_9_6_V2_CONTROLLED_LIVE_APPROVED`, versioned Mock/Live filenames, and `.tmp/phase-6-9-6-knowledge-agents-v2-controlled-live.marker`. Focused CLI/contract/runner is `17/17`, Agent typecheck/lint exit `0`, and the two existing V1 reports still validate.

## Task R4: Static/Mock checkpoint and documentation

**Files:**

- Modify `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`
- Modify `AGENTS.md`, `README.md`, `DEVLOG.md`, `docs/roadmap.md`
- Modify this plan

- [x] Run focused Agent tests, full Agent/types tests, affected typecheck/lint, V2 Mock, evidence validator, and `git diff --check`.
- [x] Confirm no provider call, no new Live marker/evidence, both product gates false, Docker volumes untouched, and V1 evidence still validates.
- [x] Record actual hashes/counts/results and commit the V2 static/Mock checkpoint.
- [x] Stop and request one fresh V2 controlled-Live authorization.

R4 evidence: Knowledge focused is `117/117`; Agent full tests/typecheck/lint, Types `39/39` + typecheck, Server Knowledge `50/50` + build, and Web Knowledge `7/7` + lint all exit `0`. V2 Mock run `05516dae-e8d3-42df-ba6b-3ffd41e99db6` reports 72 cases, `24/24` zero-call, `48/48` runtime, all five semantic metrics `1`, P95 `286/348/348ms`, usage `14472/4185`, and estimated `0.068526 CNY`; Mock remains `quality_gate_failed` by the Live-only production rule. Validator returns `ok=true / evidenceCount=3`, and V2 Mock SHA-256 is `2dfa326018bba9912b8e8faf35b7fb9f2c41b33d7e655e4e5e8c8472ecc23958`. V1 evidence/marker hashes remain byte-identical; V2 Live evidence/marker are absent. Product gates resolve default-off, existing Docker services/volumes were only inspected, and no provider, product Docker/API, browser, or business-data operation occurred. R4 deliberately stops at the fresh V2 authorization boundary.

## Task R5: Single V2 controlled-Live

- [x] Align the standalone Live CLI with Task 11 credential isolation before consuming the marker: accept only `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`, reject generic-only configuration before marker/executor, and keep `.env` unchanged.
- [x] Recheck clean branch, V1/V2 evidence bundle, provider retention acceptance, credential isolation, Docker volumes, and default-off gates.
- [x] Execute exactly one authorized `knowledge-agents-v2` branch Live run.
- [x] Validate the immutable report. If any fixed gate fails, preserve it, keep product gates false, and create a new versioned diagnosis; never replay V2.
- [x] Only if every fixed gate passes, proceed to the existing Task 13 Docker API, visible browser, precise cleanup, documentation, branch commit, `--no-ff` main merge, main default-off replay, and remote push.

Authorized preflight correction evidence: the dedicated-credential test first produced `7 pass / 2 fail`; after changing the CLI from `DEEPSEEK_API_KEY` to `KNOWLEDGE_AGENT_DEEPSEEK_API_KEY`, focused is `9/9`, Agent full is `469/469`, and typecheck/lint/diff exit `0`. Generic-only input now returns `live_configuration_invalid` with no marker or executor invocation. V2 prompt/dataset/schema/budgets/pricing/timeouts/gates/evidence identity were unchanged; at that checkpoint no provider call had occurred and the one-shot authorization remained available. The subsequently consumed result is recorded below.

R5 final evidence: the only V2 run `10ae2f36-69f6-422c-a99f-6bf6b3aeb226` completed 72 cases with `24/24` zero-call, `48/48` runtime, semantic `0.9875`, cost `0.117498 CNY`, and `quality_gate_passed`. Evidence SHA-256 is `c0a6d06a94438dddedb24b78e271eb7b4df1bd6089949bd0b7692d8570c707ff`; marker SHA-256 is `0940cee101cc219b8a691e8eba6ddc9dc33197e2eec20048ac46d269ef8d7ac5`. Both are immutable and must never be rerun, removed, overwritten, regenerated, or combined with product evidence.

The pass allowed Task 13 to continue. R7 Docker/API run `38748577-f250-4a7a-ab17-8fd14a63b2a3` and visible-browser run `012bc3ce-486e-4dce-be32-d29c246f47cd` subsequently passed with precise cleanup and default-off restoration. This checkbox records that the workflow proceeded; the remaining `main` replay and push stay owned by Task 13 Step 7 and are not a second V2 Live run.

## Completion boundary

Passing V2 and the remaining Task 13 product acceptance completes only Phase 6.9.6 KnowledgeDedup/Organizer semantic agents. It does not complete the rest of Phase 6.9, executable LangGraph, Tutor/WrongQuestionOrganizer/Memory/Retriever/FinalResponse/Tool Orchestrator work, Phase 6.10 layered memory, Phase 8, Phase 9, or either interview blog.
