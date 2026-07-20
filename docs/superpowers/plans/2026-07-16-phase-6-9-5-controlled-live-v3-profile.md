# Phase 6.9.5 controlled-Live v3 Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create one independently governed v3 controlled-Live profile that can retain a fixed structured-output stage only in v3 diagnostic evidence, then permit exactly one diagnostic, one fixed 48-case Live run, and Docker acceptance only when each preceding gate passes.

**Architecture:** Keep the v1/v2 safe-summary/evidence contracts immutable. Introduce a v3 profile descriptor and v3-only summary schema; the controlled factory maps a trusted private runtime-trace stage to that schema, while normal Agent candidate sanitization keeps stripping it. A v3 once lock protects one process; an incomplete diagnostic finalizes closed and never reaches the paired runner or Docker.

**Tech Stack:** Bun workspace, TypeScript, Zod, `@repo/ai` ModelAgentRuntime, `@repo/agent` fixed paired evaluator, NestJS 11, Jest, Windows HANDLE-relative evidence I/O, Docker Compose, Playwright.

---

## Fixed preconditions and invariants

- This plan is the only authorized continuation after v1/v2. Never invoke,
  delete, rename, overwrite, or re-use either historical profile, evidence, or
  once marker.
- Do not read/print/commit `.env`, provider credentials, base URL, prompt,
  user facts, model output, raw provider error, status, headers, cookies,
  stack, or full fixture. Never use destructive Docker/Redis/PostgreSQL/MinIO
  commands (`down -v`, prune, flush, reset, wipe).
- `REVIEW_AGENT_MODEL_ENABLED` and `PLANNER_AGENT_MODEL_ENABLED` are false by
  default and throughout all zero-network work. The v3 diagnostic is
  server-only and fact-free.
- `structuredOutputStage` is v3-controlled-diagnostic evidence only. It is
  never a production suggestion, Agent Trace, API DTO/header, browser status,
  paired report field, or a permission to retry.
- Every implementation task uses TDD: record the failing focused test, make it
  pass, run the stated focused verification, obtain specification and quality
  review, and commit before starting the next task. A P1/P2 requires a fix and
  repeat review; do not run any provider call while such a finding is open.

## File map

| Path | Responsibility |
| --- | --- |
| `packages/ai/src/model-agent-contract.ts` | Private trusted runtime trace stage enum; no user-facing transport. |
| `packages/ai/src/model-agent-runtime.ts` and `model-agent-provider-failure.ts` | Retain a stage only from the trusted provider boundary. |
| `packages/agent/src/model-candidates/model-candidate-runtime-result.ts` | Continue to strip stage from Review/Planner candidate results. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.ts` | Profile descriptors, strict v1/v2/v3 summary schemas, once reservation, native safe evidence I/O. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval.factory.ts` | V3 controlled diagnostic mapper and v3-only evaluator construction. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-cli.ts` | Exact v3 confirmation, reservation-before-executor, diagnostic/paired sequencing, safe CLI serialization. |
| `apps/server/src/review-agent/*controlled-live*.spec.ts` | Zero-network contract, evidence, factory, CLI, stage containment, and native-race regressions. |
| `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md` | Later append-only v3 evidence and product acceptance result; do not update it before a run. |

### Task 1: Freeze v1/v2 and add a v3-only contract

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.ts`
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-contract.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.spec.ts`

- [ ] **Step 1: Add failing schema/isolation tests.**

  Add cases which parse the existing v1/v2 safe summaries with an injected
  `structuredOutputStage` and expect rejection. Add a v3 case which accepts
  only the exact valid tuple and rejects every invalid cross-field combination:

  ```ts
  expect(() => v1SummarySchema.parse({ ...v1Summary, structuredOutputStage: 'provider_json_parse' })).toThrow();
  expect(() => v2SummarySchema.parse({ ...v2Summary, structuredOutputStage: 'provider_json_parse' })).toThrow();
  expect(v3SummarySchema.parse({
    status: 'invalid_attempted', gate: 'closed', providerAttemptCount: 1,
    usageKnown: false, diagnosticCode: 'structured_output',
    structuredOutputStage: 'provider_type_validation',
  })).toMatchObject({ structuredOutputStage: 'provider_type_validation' });
  expect(() => v3SummarySchema.parse({
    status: 'complete', gate: 'closed', providerAttemptCount: 1,
    usageKnown: false, diagnosticCode: 'structured_output',
    structuredOutputStage: 'provider_type_validation',
  })).toThrow();
  ```

  Use a temporary repository root containing v1/v2 fixtures. Hash the four
  historical evidence/marker files before and after `reserveV3(...)`; assert
  the hashes match and only the v3 directory obtains a v3 lock/evidence.

- [ ] **Step 2: Run the red tests.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-contract.spec.ts review-planner-controlled-live-eval-evidence.spec.ts --runInBand`

  Expected: the v3 schema/descriptor tests fail because no separate v3 profile
  contract or reservation exists; existing v1/v2 tests still pass.

- [ ] **Step 3: Implement profile descriptors and strict schemas.**

  Add immutable v1, v2, and v3 descriptors. The v3 descriptor must contain:

  ```ts
  id: 'phase-6.9.5-review-planner-controlled-live-v3'
  evidenceSchemaVersion: 'phase-6.9.5-review-planner-controlled-live-evidence-v3'
  evidenceDirectory: 'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3'
  onceLockLeaf: '.review-planner-controlled-live-v3.once'
  ```

  Parameterize reservation by a profile descriptor rather than modifying the
  v2 constants. Reconstruct each persisted JSON value from its matching strict
  summary schema. V3 accepts only `provider_json_parse`,
  `provider_type_validation`, and `provider_object_missing`, and only under
  the exact failed/closed/one-attempt/no-usage/structured-output tuple. Keep
  the existing Windows no-reparse directory handle and non-Windows parent
  binding for the v3 directory; never resolve a v3 filename through v1/v2.

- [ ] **Step 4: Run focused green verification.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-contract.spec.ts review-planner-controlled-live-eval-evidence.spec.ts --runInBand`

  Expected: focused tests pass; v1/v2 still reject the new field; a v3
  reservation cannot create, replace, or remove a historical file.

- [ ] **Step 5: Review and commit.**

  Ask independent specification and quality reviewers to inspect the contract,
  including the v1/v2 hash assertions and the cross-field schema. Resolve all
  P1/P2 findings, rerun Step 4, then commit:

  ```powershell
  git add apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.ts apps/server/src/review-agent/review-planner-controlled-live-eval-contract.spec.ts apps/server/src/review-agent/review-planner-controlled-live-eval-evidence.spec.ts
  git commit -m "feat(agent): add controlled live v3 evidence profile"
  ```

### Task 2: Map the private stage only into the v3 diagnostic

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval.factory.ts`
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval.factory.spec.ts`
- Modify: `packages/agent/tests/model-candidate-runtime-result.test.ts`
- Test: `packages/ai/tests/model-agent-runtime.test.ts`

- [ ] **Step 1: Write failing stage-mapping and containment tests.**

  Inject a genuine `ModelAgentRuntime` failure whose error/trace are both
  `PROVIDER_ERROR / structured_output` and whose trace stage is each allowed
  enum. Expect a v3 diagnostic to retain that same stage. Add negative cases
  for a local `SCHEMA_INVALID`, missing trace stage, timeout, mismatched error
  category, malformed stage, and a forged stage on a non-structured error;
  each must produce no stage. Preserve the production sanitizer assertion:

  ```ts
  expect(sanitizeReviewPlannerModelCandidate(runtimeFailureWithStage))
    .not.toHaveProperty('trace.structuredOutputStage');
  ```

- [ ] **Step 2: Run the red tests.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval.factory.spec.ts --runInBand; bun --filter @repo/agent test -- model-candidate-runtime-result.test.ts`

  Expected: only v3 mapping assertions fail because the current factory
  intentionally emits the generic v2 code.

- [ ] **Step 3: Implement the v3 mapper without widening production surfaces.**

  Create a v3-only function which consumes the runtime result internally. It
  may return `structuredOutputStage` only when the error/trace pair matches the
  trusted structured-output condition described in the design. Do not add the
  field to `ReviewPlannerDiagnosticCode`, `Phase695CaseEntry`, production
  candidate sanitizer output, `ModelObservation`, server DTOs, or Web state.
  Keep v1/v2 factory paths mapping all stages to generic `structured_output`.

- [ ] **Step 4: Run focused green verification.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval.factory.spec.ts --runInBand; bun --filter @repo/agent test -- model-candidate-runtime-result.test.ts; bun --filter @repo/ai test -- model-agent-runtime.test.ts`

  Expected: all allowed v3 stages map safely; all forged/local/non-matching
  cases have no stage; production candidate sanitization still removes it.

- [ ] **Step 5: Review and commit.**

  Obtain independent specification and quality review, repair any P1/P2, rerun
  Step 4, then commit:

  ```powershell
  git add apps/server/src/review-agent/review-planner-controlled-live-eval.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval.factory.spec.ts packages/agent/tests/model-candidate-runtime-result.test.ts packages/ai/tests/model-agent-runtime.test.ts
  git commit -m "feat(agent): expose v3 diagnostic output stage"
  ```

### Task 3: Make v3 a once-only CLI sequence

**Files:**
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-cli.ts`
- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-cli.spec.ts`
- Modify: `apps/server/scripts/review-planner-controlled-live-eval.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Write failing sequencing tests.**

  Test the exact command and state machine with injected evaluators and
  reservations:

  ```ts
  await expect(runV3(['--confirm-controlled-live-v3'], failingDiagnostic))
    .resolves.toMatchObject({ gate: 'closed', providerAttemptCount: 1,
      diagnosticCode: 'structured_output', structuredOutputStage: 'provider_json_parse' });
  expect(failingDiagnostic.runPairedEvaluation).not.toHaveBeenCalled();

  await expect(runV3(['--confirm-controlled-live-v3'], passingDiagnostic))
    .resolves.toMatchObject({ status: 'complete' });
  expect(passingDiagnostic.runPairedEvaluation).toHaveBeenCalledTimes(1);
  ```

  Also prove missing/extra/wrong confirmation argument, v3 preflight failure,
  existing v3 lock/evidence, reservation failure, finalization failure and a
  second invocation each make zero additional provider calls. Assert the v3
  CLI JSON contains only safe summary keys and rejects a stage in a complete
  result.

- [ ] **Step 2: Run the red tests.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-cli.spec.ts --runInBand`

  Expected: the v3 command/profile and sequence tests fail while legacy v1/v2
  tests remain unchanged.

- [ ] **Step 3: Implement reservation-before-executor and v3 sequencing.**

  Add a separate script/package command requiring exactly
  `--confirm-controlled-live-v3`. Validate v3 preflight, identity and the v3
  reservation before executor construction; then make one diagnostic call. A
  diagnostic failure finalizes the v3 evidence closed and returns immediately.
  Only a complete diagnostic with positive verified usage invokes the fixed
  48-case runner once in the same process. The finalizer opens only if the
  existing `phase695ReportSchema` reports `quality_gate_passed` and usage is
  verifiable. Preserve the original v1/v2 script behavior; do not make the v3
  argument select an old profile.

- [ ] **Step 4: Run focused green verification.**

  Run: `bun --filter @repo/server test -- review-planner-controlled-live-eval-cli.spec.ts review-planner-controlled-live-eval-evidence.spec.ts review-planner-controlled-live-eval.factory.spec.ts --runInBand; bun --filter @repo/server lint; bun --filter @repo/server build`

  Expected: v3 state machine tests pass, legacy profile tests pass, lint/build
  exit 0, and the test suite performs no provider request.

- [ ] **Step 5: Review and commit.**

  Complete independent specification and quality review. After all P1/P2 fixes
  and a fresh Step 4 run, commit:

  ```powershell
  git add apps/server/src/review-agent/review-planner-controlled-live-eval-cli.ts apps/server/src/review-agent/review-planner-controlled-live-eval-cli.spec.ts apps/server/scripts/review-planner-controlled-live-eval.ts apps/server/package.json
  git commit -m "feat(server): add controlled live v3 command"
  ```

### Task 4: Fresh no-network gate, Mock evidence, and independent approval

**Files:**
- Create: `docs/acceptance/phase-6-9-5-review-planner-v3-preflight.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/dev-start.md`

- [ ] **Step 1: Add a no-network regression suite and run it without provider variables.**

  Add a process-level test which invokes the v3 command with the controlled
  gate but missing credential/config and asserts `diagnostic_blocked`, zero
  attempts, no v3 evidence mutation, and no network call. Execute the complete
  fresh gate with provider variables unset:

  ```powershell
  Remove-Item Env:DEEPSEEK_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
  $env:AI_PROVIDER_MODE = 'mock'
  $env:AI_ENABLE_LIVE_CALLS = 'false'
  $env:REVIEW_AGENT_MODEL_ENABLED = 'false'
  $env:PLANNER_AGENT_MODEL_ENABLED = 'false'
  bun --filter @repo/agent test
  bun --filter @repo/ai test
  bun --filter @repo/server test
  bun --filter @repo/web test
  bun --filter @repo/server lint; bun --filter @repo/server build
  bun --filter @repo/web lint; bun --filter @repo/web build
  bun --cwd packages/types typecheck
  docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
  ```

  Expected: every command exits 0; the test command itself never loads a
  provider credential or makes a provider call.

- [ ] **Step 2: Produce a fresh non-committed Mock report and stage-containment audit.**

  Run:

  ```powershell
  $stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
  bun --filter @repo/agent eval:review-planner -- --mode mock --out ".tmp/phase-6-9-5-v3-mock-$stamp.json"
  rg -n "structuredOutputStage" packages/agent apps/server apps/web
  ```

  Expected: the report is 48 entries / 26 zero-call / 48 strict successes /
  `mock_quality_not_evidence`; the audit finds the stage only in `@repo/ai`,
  v3 controlled factory/evidence/tests, and never production Web/Trace/DTO
  code. Do not commit `.tmp` output.

- [ ] **Step 3: Document precise preflight and obtain independent approval.**

  In the new preflight document, record only commands, pass/fail counts, safe
  profile/lock names, v1/v2 integrity result, Mock counters, no-network status,
  and reviewer decisions. State explicitly that this is not a Live result. Ask
  independent specification and quality reviewers to inspect `main...HEAD`,
  the v3 exposure audit, v1/v2 immutability, once sequencing, and Docker env
  boundary. Any P1/P2 returns to the appropriate earlier task; do not arm v3.

- [ ] **Step 4: Commit only preflight documentation after approval.**

  ```powershell
  git add docs/acceptance/phase-6-9-5-review-planner-v3-preflight.md docs/acceptance-checklist.md docs/ai-behavior-acceptance.md docs/dev-start.md
  git commit -m "docs(agent): approve controlled live v3 preflight"
  ```

### Task 5: Execute exactly one v3 diagnostic and, only on success, one 48-case Live run

**Files:**
- Create at runtime only: `docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/`
- Modify after execution only: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`, `DEVLOG.md`, `AGENTS.md`, `docs/roadmap.md`, `docs/data-flow.md`

- [ ] **Step 1: Recheck authorization boundary immediately before the provider.**

  Confirm all Task 4 commands/reviews are fresh and approved, working tree is
  clean, there is no v3 lock/evidence, v1/v2 files match their preflight hashes,
  and both business gates are false. Load the user-authorized root `.env` only
  into the single child process; do not print it or copy it to a worktree.

- [ ] **Step 2: Run the single exact v3 command.**

  Run one time only:

  ```powershell
  & {
    $env:AI_PROVIDER_MODE = 'live'
    $env:AI_ENABLE_LIVE_CALLS = 'true'
    $env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED = 'true'
    $env:REVIEW_AGENT_MODEL_ENABLED = 'false'
    $env:PLANNER_AGENT_MODEL_ENABLED = 'false'
    bun --env-file=E:\PrepMind_ai智能备考助手\.env --filter @repo/server eval:review-planner:live:v3 -- --confirm-controlled-live-v3
  }
  ```

  Expected branch A: a non-complete diagnostic produces one v3 final safe
  evidence file, closed gate, and no 48-case/Docker/browser action. Expected
  branch B: a complete diagnostic with verified usage starts exactly one fixed
  48-case runner in this process.

- [ ] **Step 3: Apply the report gate without reinterpretation.**

  If branch B returns anything other than `quality_gate_passed`, finalize v3
  closed and stop. Continue only with the canonical complete report showing
  48 entries, 26 zero-call cases, strict rate `1`, semantic rate at least
  `0.9`, critical failures `0`, p95 no greater than `4500`, no budget breach,
  and verifiable usage/cost. Never re-run a failed v3 diagnostic/case/profile
  or add v1/v2 counters to the report.

- [ ] **Step 4: Record the terminal v3 result.**

  Append only safe status/counter/decision values, no raw stage context beyond
  the allowed static enum, and explicitly list skipped downstream steps on a
  closed result. Commit the documentation checkpoint before beginning Docker
  only when the result is open.

### Task 6: Docker/browser product acceptance only after v3 quality is open

**Files:**
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `DEVLOG.md`, `AGENTS.md`, `docs/roadmap.md`, `docs/data-flow.md`
- Evidence: safe screenshot/Trace references only; never provider content

- [ ] **Step 1: Start the supported Docker stack with server-only temporary gates.**

  Set the two Review/Planner gates only in the Docker server process, retain
  the established Web Chat/Router/Verifier provider allowlist, and start the
  specified services without deleting any Docker resource:

  ```powershell
  docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
  ```

  Verify the server receives the temporary gates while Web/worker do not receive
  them; do not expose a `NEXT_PUBLIC` credential or gate.

- [ ] **Step 2: Run authenticated API, Trace, and visible-browser checks.**

  Create one synthetic account; verify `/review-agent/suggestions` and `/plan`
  produce at least one safe `candidate_applied` observation/Trace and the
  browser renders only the approved model-applied state. Run one safety/failure
  sample and verify deterministic fallback renders normally without provider
  text. Leave the browser window open for the user after inspection.

- [ ] **Step 3: Restore default-off and precisely clean synthetic artifacts.**

  Restore both business gates to false, verify a default-off response, delete
  only the synthetic account and its associated traces, and verify their count
  is zero. Do not clear shared Redis, database, MinIO, Docker containers,
  images, caches, or volumes.

- [ ] **Step 4: Commit acceptance documentation only when all checks succeed.**

  Record Docker configuration, safe Trace disposition/usage-cost availability,
  browser observation, fallback, cleanup count, and default-off proof. Commit:

  ```powershell
  git add docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md DEVLOG.md AGENTS.md docs/roadmap.md docs/data-flow.md
  git commit -m "docs(acceptance): record review planner v3 live acceptance"
  ```

### Task 7: Branch review, main verification, push, and worktree cleanup

- [ ] **Step 1: Run a final independent review against `main...HEAD`.**

  Verify v1/v2 preservation, v3-only stage containment, default-off behavior,
  read-only model boundary, once-only evidence, all static gates, v3 quality
  evidence, Docker/browser evidence, and precise cleanup. Resolve every P1/P2
  before merge.

- [ ] **Step 2: Merge onto `main` and rerun the required main gates.**

  Merge with `--no-ff`, then run the approved Agent/AI/Server/Web static gates
  and Docker authenticated browser/Trace smoke on `main`; verify default-off
  again and synthetic data count zero. Do not claim a main verification based
  on branch output.

- [ ] **Step 3: Push only verified `main`, then remove the completed worktree.**

  ```powershell
  git -C E:\PrepMind_ai智能备考助手 push origin main
  git -C E:\PrepMind_ai智能备考助手 worktree remove E:\PrepMind_ai智能备考助手\.worktrees\phase-6-9-5-review-planner-live-diagnostics
  ```

  Run `git worktree list` before the removal and remove only this completed,
  merged, clean task worktree. Record the main merge SHA, main verification,
  push result, and cleanup result in the final handoff.

## Plan self-review

| Design requirement | Implementing task |
| --- | --- |
| v1/v2 terminal preservation and v3 independent lock/schema/evidence | Task 1 |
| private stage retained only in v3 controlled diagnostic | Task 2 |
| reservation-before-executor and one diagnostic then one 48-case sequence | Task 3 |
| fresh no-network gate, Mock proof, containment audit, two reviews | Task 4 |
| exact one v3 provider command and fixed quality decision | Task 5 |
| Docker/browser only after quality gate, default-off and targeted cleanup | Task 6 |
| main re-verification, push and worktree cleanup | Task 7 |

No task introduces a write-capable agent, changes the frozen dataset/rubric,
widens token/timeout caps, exposes raw diagnostics, or enters Phase 6.10.
