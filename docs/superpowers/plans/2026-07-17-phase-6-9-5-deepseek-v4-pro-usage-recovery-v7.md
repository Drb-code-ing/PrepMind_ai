# DeepSeek V4 Pro usage recovery V7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the Review/Planner controlled-Live preview-versus-actual usage contract, add safe raw-usage diagnostics, and prepare a new immutable V7 offline acceptance lineage without making a provider call or enabling either production gate.

**Architecture:** Preserve the production-aligned OpenAI-compatible DeepSeek V4 Pro non-thinking executor and the local authoritative Review/Planner merger. Extend the cloned-response audit with a value-free usage shape, then reconcile that shape with `ModelAgentRuntime` telemetry in a V7-only factory whose canary accepts actual input above its preview while still enforcing output, aggregate reservation, attempt, timeout, and CNY limits. Add independent V7 evidence and CLI files that hash-protect V1--V6 before every capability boundary; all offline tests use injected fake executors and the real 48-case paired evaluator.

**Tech Stack:** Bun workspace, TypeScript, Vercel AI SDK, Zod, Jest, Bun native tests, `ModelAgentRuntime`, native Windows HANDLE-relative evidence I/O, Docker Compose static validation.

---

## Preconditions and stop rules

- Work only on `codex/phase-6-9-5-review-planner-live-diagnostics`; do not create a nested branch or worktree.
- V1--V6 are immutable terminal profiles. Do not execute, rename, regenerate, delete, or modify their evidence or once markers.
- Do not read, print, copy, or commit `.env`; do not echo credentials, full provider payloads, or a resolved Compose configuration.
- Tasks 1--7 are strictly offline. Do not run V7 controlled-Live, Docker services, or a browser. Do not run any command containing the V7 confirmation flag outside an injected fake CLI test.
- `REVIEW_AGENT_MODEL_ENABLED=false` and `PLANNER_AGENT_MODEL_ENABLED=false` remain the production defaults. This plan does not authorize gate changes.
- Never run `docker compose down -v` or delete Docker containers, volumes, images, build cache, MinIO, PostgreSQL, or Redis data.
- Every task follows RED -> observed expected failure -> minimal GREEN -> focused regression -> documentation -> one commit. A provider attempt, historical hash mismatch, reparse detection, unexpected write, or credential-bearing output stops the task.
- Offline completion proves engineering readiness only. It does not prove model quality, product availability, or grant V7 Live permission.

## File map

| File | Responsibility |
| --- | --- |
| `packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts` | Reduce the cloned raw response to reasoning metadata and a value-free `usageState`; never retain token values or content. |
| `packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts` | Fake-fetch coverage for `missing / invalid / positive` usage shapes and non-disclosure. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.ts` | V7 preflight, one canary, corrected actual-usage validation, safe diagnostics, 23-attempt accounting, aggregate reservation, and CNY cap. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts` | RED/GREEN regressions for 97-token input, raw/runtime reconciliation, caps, timeout/abort, and paired counters. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.ts` | V7 strict safe schema, independent marker, V1--V6 immutable snapshot, reservation, and no-overwrite finalization. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts` | Schema, lifecycle, no-content, immutable-tree, and concurrency tests. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts` | Windows native existing-only/no-reparse checks and byte-preservation races. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.ts` | Exact V7 confirmation and one-shot sequence: preflight -> snapshot -> reserve -> recheck -> canary -> paired -> terminal seal. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts` | Injected-only CLI tests; no real environment or network. |
| `apps/server/scripts/review-planner-controlled-live-eval-v7-deepseek-usage-parity.ts` | Thin V7 process entry point with fixed safe stdout/stderr. |
| `apps/server/package.json` | Explicit V7 command that is never run during offline implementation. |
| `apps/server/src/review-agent/review-planner-model-config.spec.ts` | Prove V7 preflight and production candidate resolve the same provider/model/base URL/mode while product gates remain closed. |
| `apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts` | Prove default-off production composition creates no executor and cannot receive V7 eval-only enablement. |
| `DEVLOG.md`, `AGENTS.md`, `docs/roadmap.md`, `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`, `docs/ai-behavior-acceptance.md`, `docs/acceptance-checklist.md`, `docs/data-flow.md` | Record only verified offline facts, remaining Live boundary, read-only permissions, and how to resume. |

## Frozen V7 identity

```ts
export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_CONFIRMATION =
  '--confirm-controlled-live-v7-deepseek-v4-pro-usage-parity' as const;
```

The V7 evidence directory is `docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity`, and its marker is `.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once`. The maximum future run remains one fact-free canary plus 22 paired runtime cases: 23 provider attempts, reserved input `42_996`, reserved output `9_712`, and a CNY `1.00` hard cap using the frozen non-cached price snapshot `3 CNY / million input` and `6 CNY / million output`.

## Task 1: Add a value-free raw usage audit

**Files:**

- Modify: `packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts`
- Modify: `packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing audit tests**

Add three fake provider responses and assert the callback receives exactly these projections:

```ts
expect(audits[0]).toEqual({
  reasoning: 'reported_zero',
  reasoningContentPresent: false,
  reportedReasoningTokens: 0,
  usageState: 'missing',
});
expect(audits[1]).toMatchObject({ usageState: 'invalid' });
expect(audits[2]).toMatchObject({ usageState: 'positive' });
```

Fixtures must cover absent `usage`, missing `prompt_tokens`, missing `completion_tokens`, zero, negative, fractional, unsafe integer, and positive safe integers. Serialize every audit and assert it does not contain the actual `prompt_tokens`, `completion_tokens`, response content sentinel, request body, URL, header, or credential sentinel.

- [ ] **Step 2: Run the focused test and observe RED**

```powershell
bun --cwd packages/ai test tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
```

Expected: FAIL because `DeepSeekV4ProNonThinkingAudit` has no `usageState`.

- [ ] **Step 3: Implement the minimal usage-shape reducer**

Add the exact public-safe enum to every audit union member:

```ts
export type DeepSeekV4ProUsageState = 'missing' | 'invalid' | 'positive';

function readUsageState(payload: unknown): DeepSeekV4ProUsageState {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.usage)) return 'missing';
  if (
    !hasOwn(payload.usage, 'prompt_tokens') ||
    !hasOwn(payload.usage, 'completion_tokens')
  ) return 'missing';
  return isPositiveSafeInteger(payload.usage.prompt_tokens) &&
    isPositiveSafeInteger(payload.usage.completion_tokens)
    ? 'positive'
    : 'invalid';
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
```

Compute `usageState` from the ephemeral cloned JSON, attach only the enum to the callback, and keep actual token numbers exclusively in the existing SDK -> `StructuredModelExecutor` -> `ModelAgentRuntime` result path.

- [ ] **Step 4: Run focused and package tests**

```powershell
bun --cwd packages/ai test tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
bun --cwd packages/ai test tests/model-agent-provider.test.ts
bun --filter @repo/ai test
```

Expected: all exit `0`; the transport still performs one fake delegate call and no network.

- [ ] **Step 5: Document and commit Task 1**

Record that the response audit now distinguishes raw usage shape without retaining values and that no provider request occurred.

```powershell
git add packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts DEVLOG.md
git commit -m "fix(agent): classify V4 Pro usage shape safely"
```

## Task 2: Build the corrected V7 evaluator

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write the 96/97 regression first**

Use an injected fake non-thinking executor and capture its config. The first test returns a valid strict object, audit `usageState: 'positive'`, and runtime usage `{ inputTokens: 97, outputTokens: 4 }` for a request whose preview is 96. Assert:

```ts
await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
  status: 'complete',
  canContinue: true,
  providerAttemptCount: 1,
  usageKnown: true,
});
expect(evaluator.value.readCanaryUsage()).toEqual({
  inputTokens: 97,
  outputTokens: 4,
});
```

Add boundary cases for input `96`, `97`, `42_996`, and `42_997`, plus output `1`, `32`, and `33`. The first four valid values must be accounted from actual telemetry; only input beyond full reservation or output beyond canary cap closes.

- [ ] **Step 2: Run the factory test and observe RED**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts
```

Expected: FAIL because the V7 factory does not exist.

- [ ] **Step 3: Add V7 contracts and the corrected validator**

The factory uses the frozen profile identity, `AI_PROVIDER_MODE=live`, `AI_ENABLE_LIVE_CALLS=true`, `REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED=true`, exact DeepSeek V4 Pro `/v1`, both product gates `false`, timeout `4_500`, max attempts `23`, and the existing `deepseek_v4_pro_nonthinking_json` executor. Define:

```ts
export type ReviewPlannerControlledLiveV7DiagnosticCode =
  | 'transport'
  | 'structured_output'
  | 'thinking_not_disabled'
  | 'provider_usage_missing'
  | 'provider_usage_invalid'
  | 'sdk_usage_lost'
  | 'output_limit_exceeded'
  | 'usage_reservation_exceeded';

function hasPositiveSafeCanaryUsage(usage: unknown): usage is {
  inputTokens: number;
  outputTokens: number;
} {
  return isPositiveSafeInteger(usage.inputTokens) &&
    usage.inputTokens <= V7_RESERVED_INPUT_TOKENS &&
    isPositiveSafeInteger(usage.outputTokens) &&
    usage.outputTokens <= V7_CANARY_MAX_OUTPUT_TOKENS;
}
```

The validator must never compare actual input with `V7_CANARY_ESTIMATED_INPUT_TOKENS`. Keep preview values in the immutable runtime request/budget only; never mutate or expand the budget after telemetry arrives.

- [ ] **Step 4: Add safe raw/runtime diagnostic reconciliation tests and implementation**

Cover these exact mappings:

```ts
raw positive + runtime success        -> continue
raw positive + runtime invalid_response -> sdk_usage_lost
raw missing                           -> provider_usage_missing
raw invalid                           -> provider_usage_invalid
reasoning violation                   -> thinking_not_disabled
valid output above 32                 -> output_limit_exceeded
aggregate above reservation           -> usage_reservation_exceeded
```

The frozen reservation's maximum CNY cost is `0.18726`, below the `1.00` cap. Test that preflight fixes this invariant; do not invent an unreachable `cost_limit_exceeded` terminal state. Also cover timeout, abort, schema invalid, one fetch per attempt, zero retry, attempt 24 rejection, hostile callback data, and a fake executor throwing a credential-bearing error. The returned diagnostic may contain only the fixed code, status, booleans, and attempt count.

- [ ] **Step 5: Prove 23-attempt paired accounting**

Run the real `runPhase695ReviewPlannerPaired` with an injected strict fake executor. Assert `48 caseEntries / 26 zeroCallCases / 22 runtimeInvocations / 48 strictSuccesses / 48 qualityPasses / 0 criticalFailures`, `zeroCallVerified=true`, and exactly `1 + 22 = 23` executor calls. Sum provider-reported canary and paired input/output usage, then require aggregate values to stay within frozen reservations and cost cap before returning `kind: 'report'`.

- [ ] **Step 6: Run the focused server regression and commit Task 2**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts
bun --filter @repo/agent test
```

Expected: all exit `0`, no network, and product gates remain `false` in every fixture.

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts DEVLOG.md
git commit -m "fix(agent): correct V7 usage parity accounting"
```

## Task 3: Add independent immutable V7 evidence

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing strict-schema tests**

Define discriminated `reserved / attempted / finalized` records. Failure summaries contain no token or cost fields. Only a complete finalized summary may contain:

```ts
{
  state: 'finalized',
  status: 'complete',
  gate: 'eligible_for_separate_product_acceptance',
  providerAttemptCount: 23,
  usageKnown: true,
  aggregateInputTokens: z.number().int().positive().max(42_996),
  aggregateOutputTokens: z.number().int().positive().max(9_712),
  observedCostCny: z.number().positive().max(1),
  priceProfileId: 'deepseek-v4-pro-cny-noncached-2026-07-17-v7',
  caseEntries: 48,
  zeroCallCases: 26,
  runtimeInvocations: 22,
  strictSuccesses: 48,
  qualityPasses: 48,
  criticalFailures: 0,
}
```

Reject unknown properties and serialized sentinels for prompt, response, token detail, key, URL, header, stack, and raw error.

- [ ] **Step 2: Run Jest evidence tests and observe RED**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts
```

Expected: FAIL because the V7 evidence module does not exist.

- [ ] **Step 3: Implement the V1--V6 immutable manifest**

Copy no V6 writable capability. V7 gets a new trusted handle and snapshots all historical directories and markers with existing-only/no-reparse native reads. Pin the currently sealed V6 hashes:

```text
V6 marker SHA-256 = AC04EA11C4E416E44BD870C158A6BFF0D65DB297262AB6610790CF355525EC31
V6 JSON SHA-256   = 4FB435824785AF4B2601B83787B22A4B98DE1AC47D222F2566E351960BFD1AFB
```

Verify the snapshot before reservation, before marking attempted, before any future provider boundary, and before finalization. Reject missing/extra/changed files, changed marker bytes, symlink/junction/reparse entries, outside-root paths, duplicate marker creation, and concurrent finalizers.

- [ ] **Step 4: Add native Windows lifecycle tests**

Use a temporary root containing copied fixture bytes. Prove existing-only reads, no-overwrite marker creation, reparse rejection, exact byte preservation after failed reserve/finalize, concurrent reservation single winner, and finalized record immutability.

```powershell
bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts
```

Expected: exit `0`; tests operate only under temporary directories.

- [ ] **Step 5: Run evidence regressions and commit Task 3**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts
bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts
```

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts DEVLOG.md
git commit -m "feat(agent): add immutable V7 usage evidence"
```

## Task 4: Add the one-shot V7 CLI without invoking it

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v7-deepseek-usage-parity.ts`
- Modify: `apps/server/package.json`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write injected dependency tests for exact ordering**

The only accepted argument is `--confirm-controlled-live-v7-deepseek-v4-pro-usage-parity`. With injected fakes, assert the exact successful order:

```text
validatePreflight
snapshotHistoricalEvidence
reserveEvidence
verifyHistoricalEvidence
markAttempted
verifyHistoricalEvidence
createEvaluator
runDiagnostic
runPairedEvaluation
verifyHistoricalEvidence
finalizeEvidence
```

Every failure path must finalize or return a fixed closed summary as allowed by the reserved capability, then stop before later stages. A failed canary must never call `runPairedEvaluation`.

- [ ] **Step 2: Run the CLI test and observe RED**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts
```

Expected: FAIL because the CLI module does not exist.

- [ ] **Step 3: Implement dependency-injected orchestration**

Expose `runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(input, overrides)` for tests. Production defaults use the V7 factory/evidence functions, but the test suite passes all dependencies explicitly. Validate `argv.length === 1`, exact confirmation, preflight, historical integrity, reservation, and the 23-attempt/cost/quality summary before allowing the complete schema.

The thin process entry must print only the serialized safe summary. It catches all errors into a fixed non-sensitive failure line and sets a non-zero exit code; it never prints `error.message`, `cause`, stack, env, prompt, response, URL, headers, or token values from failed runs.

- [ ] **Step 4: Add the explicit package script and fake-only regression**

Add exactly:

```json
"eval:review-planner:live:v7:deepseek-usage-parity": "bun scripts/review-planner-controlled-live-eval-v7-deepseek-usage-parity.ts"
```

Do not execute this package script. Run only the dependency-injected spec:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts
```

- [ ] **Step 5: Commit Task 4**

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts apps/server/scripts/review-planner-controlled-live-eval-v7-deepseek-usage-parity.ts apps/server/package.json DEVLOG.md
git commit -m "feat(agent): add one-shot V7 usage CLI"
```

## Task 5: Prove Mock and production-composition parity

**Files:**

- Modify: `apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-model-config.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Add failing parity assertions**

Resolve V7 preflight and the existing production Review/Planner candidate from the same sanitized env. Assert provider `deepseek`, model `deepseek-v4-pro`, base URL `https://api.deepseek.com/v1`, structured mode `deepseek_v4_pro_nonthinking_json`, timeout, schema, and local merger boundary match. Assert the V7-only enable flag is not accepted by production composition and serialized public config contains neither credential nor base URL.

- [ ] **Step 2: Run focused tests and observe RED**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
```

Expected: the new parity assertions fail until the V7 factory exposes a sanitized preflight identity helper.

- [ ] **Step 3: Add a sanitized parity helper and 48-case Mock acceptance**

Expose only:

```ts
{
  provider: 'deepseek',
  model: 'deepseek-v4-pro',
  baseUrlIdentity: 'deepseek-v1',
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
  timeoutMs: 4500,
  schemaId: 'review-model-candidate-v1',
}
```

Do not expose the actual URL or credential through API responses or Trace. Run the 48 canonical cases through the V7 evaluator with the strict fake executor and require `26` verified zero-call, `22` runtime, `48` strict, `48` quality pass, and `0` critical failures. This is labeled `mock_quality_not_live_evidence` in docs and tests.

- [ ] **Step 4: Prove default-off gates and read-only permission boundaries**

Assert both production gates absent/false produce deterministic suggestions and zero executor construction. Assert Web/worker configuration does not receive a V7 eval gate, and the model output still cannot change owner-scoped facts, FSRS values, minutes, links, persisted records, or write permissions.

- [ ] **Step 5: Run parity regressions and commit Task 5**

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
bun --filter @repo/agent test
```

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts apps/server/src/review-agent/review-planner-model-config.spec.ts apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts DEVLOG.md
git commit -m "test(agent): verify V7 composition parity"
```

## Task 6: Run offline gates and synchronize authoritative docs

**Files:**

- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/data-flow.md`

- [ ] **Step 1: Run the focused V7 gate**

```powershell
bun --cwd packages/ai test tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts
```

Expected: all exit `0`; record exact test counts from output.

- [ ] **Step 2: Run the complete offline engineering gate**

```powershell
bun --filter @repo/ai test
bun --filter @repo/ai typecheck
bun --filter @repo/ai lint
bun --filter @repo/agent test
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
```

Expected: every command exits `0`. Compose is static validation only; do not run `up`, `build`, `down`, or inspect the rendered configuration.

- [ ] **Step 3: Update docs with observed facts only**

Record exact counts and commands, the 97-token regression result, value-free raw usage states, 23-attempt fake accounting, V1--V6 immutable hashes, default-off gates, and read-only permissions. State explicitly:

```text
V7 offline engineering ready; controlled-Live not run and not authorized.
Review/Planner product path remains deterministic because both model gates are false.
V7 success would still require separate Live authorization, then Docker/API/visible-browser/Trace acceptance, main merge re-verification, and remote push.
```

Do not claim provider quality, cost, latency, Docker, browser, production enablement, Phase 6.9.5 completion, or Phase 6 completion.

- [ ] **Step 4: Re-run document checks and commit Task 6**

```powershell
rg -n "V7|usage parity|controlled-Live|REVIEW_AGENT_MODEL_ENABLED|PLANNER_AGENT_MODEL_ENABLED" AGENTS.md DEVLOG.md docs/roadmap.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md docs/data-flow.md
git diff --check
```

```powershell
git add AGENTS.md DEVLOG.md docs/roadmap.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md docs/data-flow.md
git commit -m "docs(agent): record V7 offline acceptance"
```

## Task 7: Complete two independent offline reviews and stop

**Files:**

- Modify only if a review finds a defect: files already listed in Tasks 1--6
- Modify: `DEVLOG.md`
- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`

- [ ] **Step 1: First review — contract and security**

Review the branch diff against the V7 design and this plan. Check preview/actual separation, raw/runtime mapping, immutable budget, output/aggregate/cost limits, one-fetch/no-retry behavior, credential and content non-disclosure, V1--V6 byte protection, marker races, read-only permissions, and default-off product gates. Any defect gets a failing regression before the fix and a dedicated commit.

- [ ] **Step 2: Second review — acceptance and operational boundary**

Independently trace the only future execution path from exact confirmation to terminal seal. Confirm no other script, environment default, Docker service, Web process, worker process, or product API can invoke V7. Confirm `mock_quality_not_live_evidence` cannot be interpreted as provider evidence and failed evidence has no token/cost values.

- [ ] **Step 3: Run the final focused evidence after review**

```powershell
bun --filter @repo/ai test
bun --filter @repo/agent test
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory.spec.ts review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.spec.ts review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli.spec.ts review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
bun test apps/server/src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence.native.bun.test.ts
git diff --check
git status --short
```

Expected: tests exit `0`, diff check exits `0`, and status contains only the deliberate review-document changes before commit.

- [ ] **Step 4: Record the authorization boundary and commit**

The handoff must say that V7 Live has not run; V6 remains immutable; the next allowed action is only to request a fresh user authorization for the single V7 command. It must also say that even a future complete V7 report does not automatically enable product gates or finish Phase 6.9.5.

```powershell
git add DEVLOG.md docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md
git commit -m "docs(agent): seal V7 offline review boundary"
```

## Completion boundary

After Task 7, stop. Do not execute `eval:review-planner:live:v7:deepseek-usage-parity`, do not create V7 evidence or marker in the real repository through the CLI, do not start Docker or a browser, do not enable Review/Planner model gates, do not merge to `main`, and do not push. Report the fresh offline verification evidence and request a separate explicit authorization for the unique V7 controlled-Live attempt.
