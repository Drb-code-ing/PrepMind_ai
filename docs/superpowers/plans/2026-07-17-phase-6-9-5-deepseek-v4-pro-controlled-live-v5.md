# DeepSeek V4 Pro controlled-Live v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove or safely close one independent DeepSeek V4 Pro, JSON-object controlled-Live path for the read-only ReviewAgent and PlannerAgent, then perform product and main-branch acceptance only if the quality gates pass.

**Architecture:** V5 uses the exact production OpenAI-compatible JSON executor instead of the historical V4 direct-fetch adapter. A dedicated, default-off factory constrains the model, host, timeout, budget, price profile, and canary. A separate native evidence writer and CLI retain only safe aggregates and prove V1--V4 hashes are unchanged. Existing deterministic merging, permissions, and fallback remain untouched.

**Tech Stack:** Bun monorepo, NestJS, Vercel AI SDK, Zod, Jest, native Windows handle-relative evidence I/O, Docker Compose, Playwright browser acceptance.

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.factory.ts` | Exact DeepSeek V4 Pro config, production JSON executor, canary, frozen paired runner, CNY budget maths. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.ts` | V5-only schema, once marker, native evidence reservation, historical V1--V4 hash snapshots. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli.ts` | Exact confirmation, preflight, evidence lifecycle, canary/paired ordering, safe final summary. |
| `apps/server/scripts/review-planner-controlled-live-eval-v5-deepseek.ts` | Thin CLI entry point; no config echoing. |
| Matching `*.spec.ts` and `*.native.bun.test.ts` | Red/green coverage for config, transport, usage, budget, evidence, and CLI closure. |
| `apps/server/package.json` | Bounded `eval:review-planner:live:v5:deepseek` script. |
| `AGENTS.md`, `DEVLOG.md`, `docs/roadmap.md`, `docs/ai-behavior-acceptance.md`, `docs/acceptance-checklist.md` | Current phase status, runbook, authority boundaries, and evidence links. |
| `docs/acceptance/...` | Final implementation/live/Docker/browser/main evidence only after each fact exists. |

### Task 1: Create the DeepSeek V4 Pro V5 factory and CNY cap

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts`
- Test: `packages/ai/tests/model-agent-provider.test.ts`

- [ ] **Step 1: Write failing factory tests**

Add a frozen synthetic environment with exactly:

```ts
const v5Env = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'test-private-key',
};
```

Assert the factory gives `createOpenAICompatibleStructuredExecutor` only
`{ provider: 'deepseek', model: 'deepseek-v4-pro', structuredOutputMode:
'json_object' }`, with no strict-tool profile/tools; V5 rejects every changed
gate/model/host before executor construction. Assert a valid canary has one
attempt and positive usage; `{ inputTokens: 0, outputTokens: 0 }`, fractional,
negative, or missing usage closes it. Assert the non-cached reservation is
`42996` input / `9712` output and CNY `0.18726`, below CNY `1`.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts
```

Expected: FAIL because the V5 factory does not exist.

- [ ] **Step 3: Implement the bounded factory**

Implement a closed profile with these invariants:

```ts
const V5_MODEL = 'deepseek-v4-pro' as const;
const V5_BASE_URL = 'https://api.deepseek.com/v1' as const;
const V5_TIMEOUT_MS = 4_500;
const V5_CNY_CAP = 1;
const V5_NON_CACHED_INPUT_CNY_PER_MILLION = 3;
const V5_OUTPUT_CNY_PER_MILLION = 6;
```

Resolve only the existing server-only DeepSeek config, bind it exactly to the
constants above, require both business gates to be explicitly `false`, and
wrap the standard executor with an attempt counter. Reuse the canonical Review
candidate canary and `runPhase695ReviewPlannerPaired`; never include prompt or
private config in returned diagnostics. Use positive safe-integer provider
usage as a hard condition, and calculate CNY from provider usage conservatively
as non-cached input. Do not update USD-only Agent Trace pricing.

- [ ] **Step 4: Run focused tests and shared AI regression tests**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts
bun --filter @repo/ai test
```

Expected: both exit 0; no network request is made.

- [ ] **Step 5: Document and commit Task 1**

Add a DEVLOG entry stating only that offline factory and CNY cap are complete,
then commit the factory, tests, and DEVLOG:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts DEVLOG.md
git commit -m "feat(agent): add DeepSeek V4 Pro V5 controlled evaluator"
```

### Task 2: Create V5-only native evidence and historical integrity checks

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.native.bun.test.ts`

- [ ] **Step 1: Write failing evidence tests**

Test a V5 descriptor with the exact id, directory, and once marker from the
design. Test that each final safe summary is strict and contains only status,
gate, attempts, usage flag, price profile id, `currency: 'CNY'`, token totals,
CNY estimate/cap, quality counters, and a bounded diagnostic code. Test V1--V4
marker/evidence bytes are SHA-256-identical before and after a V5 lifecycle;
test a changed historical file, reparse point, added file, duplicate V5 marker,
and a writer failure all fail closed without provider construction.

- [ ] **Step 2: Run the new focused test and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v5-deepseek.evidence.spec.ts
```

Expected: FAIL because V5 evidence module is absent.

- [ ] **Step 3: Implement native V5 evidence**

Follow the V4 handle-relative `openWindowsNoReparseDirectory` pattern but use
only V5 constants. Add a static V1--V4 directory/marker manifest and a
deterministic SHA-256 snapshot function. Capture/verify it before reserve,
before the provider boundary, and after finalization. The V5 writer may create
only `docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro`.
Forbid sensitive text with the existing evidence deny-list and never return a
raw file path outside the V5 root.

- [ ] **Step 4: Run focused/native evidence tests**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v5-deepseek.evidence.spec.ts
Push-Location apps/server
bun test src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.native.bun.test.ts
Pop-Location
```

Expected: exit 0, including byte-preservation/race coverage on Windows.

- [ ] **Step 5: Document and commit Task 2**

Update DEVLOG with the V5 isolation guarantee and commit only this task:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.spec.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.evidence.native.bun.test.ts DEVLOG.md
git commit -m "feat(agent): isolate DeepSeek V4 Pro V5 evidence"
```

### Task 3: Create the once-only V5 CLI and no-network Mock proof

**Files:**
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v5-deepseek.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Write failing CLI tests**

Use fakes to show an invalid confirmation, failed preflight, historical hash
mismatch, failed reservation, canary failure, invalid/zero usage, or a second
attempt returns a closed summary and performs zero additional calls. Assert the
only accepted argument is:

```text
--confirm-controlled-live-v5-deepseek-v4-pro
```

Assert a successful fake canary can run exactly 22 eligible cases, preserves
all 26 zero-call entries, fails when P95 exceeds 4500 ms or CNY cost exceeds
the cap, and serializes neither the test credential nor raw candidate content.

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v5-deepseek.cli.spec.ts
```

Expected: FAIL because the V5 CLI is absent.

- [ ] **Step 3: Implement the CLI and script**

Require preflight before V5 evidence reservation; reserve evidence before
constructing the evaluator or crossing the provider boundary. Mark attempted,
run one canary, then run the paired evaluator only on the exact complete tuple
`attempts=1`, `usageKnown=true`, and unchanged history. Finalize with a
strictly parsed safe summary, otherwise close with a bounded diagnostic code.
The `package.json` script must be:

```json
"eval:review-planner:live:v5:deepseek": "bun scripts/review-planner-controlled-live-eval-v5-deepseek.ts"
```

- [ ] **Step 4: Run V5 no-network and Mock checks**

Run focused tests, then generate an ignored Mock report with the normal
`runPhase695ReviewPlannerPaired({ mode: 'mock' })` route. Verify exactly 48
entries, 26 `zeroCallVerified`, 22 runtime invocations, 48 strict successes,
zero critical failures, and `mock_quality_not_evidence`.

- [ ] **Step 5: Document and commit Task 3**

Update DEVLOG, `AGENTS.md`, and the acceptance checklist to state V5 is
offline/Mock-ready but not Live-proven. Commit:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli.spec.ts apps/server/scripts/review-planner-controlled-live-eval-v5-deepseek.ts apps/server/package.json AGENTS.md DEVLOG.md docs/acceptance-checklist.md
git commit -m "feat(agent): add once-only DeepSeek V4 Pro V5 CLI"
```

### Task 4: Complete static validation, independent review, and exactly one Live run

**Files:**
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run complete offline validation**

Run the scoped Server/Agent/AI tests, typecheck, Server lint, Web test/lint/build,
`docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet`, and `git diff --check`. Review source diffs against the design and inspect the safe evidence schema/content deny-list.

- [ ] **Step 2: Complete an independent code review**

Review from the last Task 3 commit through `HEAD`; resolve every blocker or
important item, test the fix, update DEVLOG, and commit the repair separately.

- [ ] **Step 3: Run the single V5 controlled-Live command**

Check only boolean configuration presence and the absence of a V5 marker; do
not print `.env`. In an explicit process environment run the exact command:

```powershell
bun --filter @repo/server eval:review-planner:live:v5:deepseek -- --confirm-controlled-live-v5-deepseek-v4-pro
```

The result is immutable. If the final summary is not `complete/open` with all
design gates, record it, keep business gates false, and stop this phase as
terminal. Do not retry, edit V1--V5 evidence, or substitute a provider.

- [ ] **Step 4: Record only observed evidence and commit**

Write the actual safe result, attempt count, quality/cost status, and evidence
path; do not write prompt, candidate, key, base URL, raw error, or invented
cost. Commit documentation/evidence.

### Task 5: Product acceptance, main merge, revalidation, and push (only on V5 pass)

**Files:**
- Modify: `docs/acceptance/2026-07-17-phase-6-9-5-review-planner-production.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`

- [ ] **Step 1: Docker server-only temporary gate**

Start/retain the existing Compose stack without `down`, volume/cache deletion,
or service cleanup. Pass live flags, `deepseek-v4-pro`, and both Review/Planner
business gates only to the temporary server container. Assert the web and
worker do not receive a new credential/config surface.

- [ ] **Step 2: Authenticated API and visible browser acceptance**

Create one synthetic test account, verify authenticated Review/Planner
suggestions use `candidate_applied` or a documented restrictive fallback, then
open the browser visibly on `/plan` and `/today`. Preserve the browser window
after the user-visible test. Record safe status, latency, and token metadata
only; no prompt/candidate/credential/raw response.

- [ ] **Step 3: Restore and clean narrowly**

Restore both business gates to false, delete only the synthetic account and
its test Agent Traces, confirm counts are zero, and leave Docker services,
volumes, images, cache, and unrelated data intact. Commit the observed product
acceptance evidence and all synchronized documentation.

- [ ] **Step 4: Merge `main`, re-run key verification, and push**

From the normal checkout, update `main`, merge this branch with `--no-ff`, and
run the Server tests, Agent/AI tests, typecheck, web test/lint/build, Compose
config, Docker API health, and an authenticated visible browser smoke on the
merged commit. Then push `main` to `origin`. Do not remove the branch until
the merged verification and push succeed.
