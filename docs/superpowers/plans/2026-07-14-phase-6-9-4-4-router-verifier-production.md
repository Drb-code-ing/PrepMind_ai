# Phase 6.9.4.4 Router / Verifier Production Integration Implementation Plan

> **2026-07-15 路线说明：** 本计划只完成 Router / Verifier 子阶段，不代表整个 Agent 架构或记忆系统完成。Task 8 同步文档时必须链接 `docs/superpowers/specs/2026-07-15-phase-6-9-agent-architecture-completion-design.md`，明确先完成全部 Agent、再进入 Phase 6.10 记忆，以及两篇独立博客的占位。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the evaluated Router and Knowledge Verifier structured-model adapters into the production `/api/chat` path while preserving zero-call safety/high-confidence paths, a two-call request budget, restrictive fallbacks, and safe observability.

**Architecture:** The shared Agent package owns stable candidate exports and pure production eligibility policies. A Web server-only composition root creates independent Router/Verifier runtimes over one strict provider config; the Chat route passes an immutable budget from async Router execution into post-search Verifier execution, then records only fixed observation metadata and aggregate cost estimates.

**Tech Stack:** TypeScript, Bun workspace, Next.js 16 Route Handlers, Vercel AI SDK, `@repo/ai` ModelAgentRuntime, `@repo/agent`, Zod, Node test runner, Docker Compose, DeepSeek JSON structured output.

---

## File map

- `packages/agent/src/model-candidates/production.ts`: stable public barrel for Router/Verifier adapters, observations and policies.
- `packages/agent/src/model-candidates/production-eligibility.ts`: pure Router/Verifier eligibility decisions.
- `packages/agent/tests/production-model-candidates.test.ts`: public package contract.
- `packages/agent/tests/production-eligibility.test.ts`: 60 Router + 40 Verifier eligibility expectations and hostile inputs.
- `packages/agent/package.json`: `./model-candidates` export.
- `apps/web/src/lib/chat-model-agent-config.ts`: strict, secret-free environment resolution.
- `apps/web/src/lib/chat-model-agent-runtime.ts`: `server-only` Router/Verifier runtime bundle and request budget factory.
- `apps/web/src/lib/chat-model-agent-config.test.mts`: gates, provider matching and timeout bounds.
- `apps/web/src/lib/chat-model-agent-runtime.test.mts`: mode/provider/executor/runtime composition.
- `apps/web/src/lib/chat-agent-runtime.ts`: async production Router wrapper while preserving deterministic API.
- `apps/web/src/lib/chat-agent-runtime.test.mts`: Router zero-call, applied, timeout, abort and permission reconstruction.
- `apps/web/src/lib/chat-rag-context.ts`: async Verifier execution after search with remaining request budget.
- `apps/web/src/lib/chat-rag-context.test.mts`: Verifier safety/eligibility/applied/restrictive fallback.
- `apps/web/src/lib/chat-model-agent-observation.ts`: safe observation projection, headers and aggregate usage.
- `apps/web/src/lib/chat-model-agent-observation.test.mts`: hostile observation and secret canaries.
- `apps/web/src/lib/agent-trace-payload.ts`: Router/Verifier step metadata and candidate usage in estimate.
- `apps/web/src/lib/agent-trace-payload.test.mts`: Trace/cost/redaction contract.
- `apps/web/src/app/api/chat/route.ts`: request-scoped runtime/budget orchestration.
- `apps/web/package.json`, `bun.lock`: add the direct `@repo/ai` workspace dependency.
- `docker/docker-compose.dev.yml`, `docker/.env.example`: explicit Agent gates and timeout parity for Docker Web.
- `AGENTS.md`, `README.md`, `docs/dev-start.md`, `docs/roadmap.md`, `docs/ai-behavior-acceptance.md`: current production model boundary and progress.
- `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`: Mock/Live/Docker/browser evidence.

### Task 1: Publish the evaluated candidate contract

**Files:**
- Create: `packages/agent/src/model-candidates/production.ts`
- Create: `packages/agent/tests/production-model-candidates.test.ts`
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Write the failing public-export test**

```ts
import { describe, expect, test } from 'bun:test';
import {
  MODEL_CANDIDATE_DISPOSITIONS,
  runKnowledgeVerifierModelCandidate,
  runRouterModelCandidate,
} from '@repo/agent/model-candidates';

describe('production model candidate exports', () => {
  test('publishes only the evaluated adapters and safe dispositions', () => {
    expect(typeof runRouterModelCandidate).toBe('function');
    expect(typeof runKnowledgeVerifierModelCandidate).toBe('function');
    expect(MODEL_CANDIDATE_DISPOSITIONS).toContain('candidate_applied');
    expect(MODEL_CANDIDATE_DISPOSITIONS).toContain('safety_blocked');
  });
});
```

- [ ] **Step 2: Run RED**

```powershell
bun --cwd packages/agent test tests/production-model-candidates.test.ts
```

Expected: module resolution fails because `@repo/agent/model-candidates` is not exported.

- [ ] **Step 3: Add the narrow barrel and package subpath**

```ts
export {
  runRouterModelCandidate,
  type RouterModelCandidateEnvelope,
  type RouterModelCandidateInput,
} from './router-model-candidate.ts';
export {
  runKnowledgeVerifierModelCandidate,
  type KnowledgeVerifierModelCandidateEnvelope,
  type KnowledgeVerifierModelCandidateInput,
} from './knowledge-verifier-model-candidate.ts';
export {
  MODEL_CANDIDATE_DISPOSITIONS,
  type ModelCandidateDisposition,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';
```

Add to `packages/agent/package.json`:

```json
"./model-candidates": "./src/model-candidates/production.ts"
```

- [ ] **Step 4: Run GREEN and Agent gates**

```powershell
bun --cwd packages/agent test tests/production-model-candidates.test.ts
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add -- packages/agent/src/model-candidates/production.ts packages/agent/tests/production-model-candidates.test.ts packages/agent/package.json
git commit -m "feat(agent): publish production model candidates"
```

### Task 2: Derive production eligibility from semantic signals

**Files:**
- Create: `packages/agent/src/model-candidates/production-eligibility.ts`
- Create: `packages/agent/tests/production-eligibility.test.ts`
- Modify: `packages/agent/src/model-candidates/production.ts`

- [ ] **Step 1: Write Router 60-case and Verifier 40-case failing tests**

Use the canonical fixed set as an expectation oracle, but pass only runtime-available input into the policy:

```ts
for (const item of phase6941RouterCases) {
  const deterministic = routeAgentRequest(
    createInitialAgentState({
      runId: item.id,
      userId: 'eval_user',
      text: item.input.text,
      activeStudyContext: item.input.activeStudyContext,
    }),
  );
  expect(
    isRouterModelEligible({
      text: item.input.text,
      activeStudyContext: item.input.activeStudyContext,
      deterministic,
    }),
    item.id,
  ).toBe(item.candidateEligible);
}

for (const item of phase6941VerifierCases) {
  const deterministic = verifyKnowledgeChunks(item.input);
  expect(
    isKnowledgeVerifierModelEligible({
      query: item.input.query,
      chunks: item.input.chunks,
      deterministic,
    }),
    item.id,
  ).toBe(item.candidateEligible);
}
```

Add hostile getter/revoked proxy/credential/prompt-injection cases and assert `false` without propagating raw errors.

- [ ] **Step 2: Run RED**

```powershell
bun --cwd packages/agent test tests/production-eligibility.test.ts
```

Expected: imports fail because both policies are missing.

- [ ] **Step 3: Implement bounded, fail-closed policies**

Create exact input contracts and fixed reason codes:

```ts
export type ModelEligibilityDecision = {
  eligible: boolean;
  reason:
    | 'ambiguous_multi_intent'
    | 'contextual_reference'
    | 'semantic_conflict'
    | 'stale_or_uncertain'
    | 'high_confidence_local'
    | 'not_semantic_needed'
    | 'safety_blocked'
    | 'invalid_input';
};

export function decideRouterModelEligibility(input: unknown): ModelEligibilityDecision;
export function decideKnowledgeVerifierModelEligibility(
  input: unknown,
): ModelEligibilityDecision;
export const isRouterModelEligible = (input: unknown) =>
  decideRouterModelEligibility(input).eligible;
export const isKnowledgeVerifierModelEligible = (input: unknown) =>
  decideKnowledgeVerifierModelEligibility(input).eligible;
```

Router implementation must snapshot `text`, optional active context and deterministic result inside `try/catch`; reject credential/instruction/system-prompt material first. Normalize NFKC and classify fixed signals for material/RAG, tutor/explanation, review/weakness, study plan and wrong-question organization. Return eligible for two-or-more competing groups, short contextual references (`继续`, `为什么`, `那一步`, `第二步`, pronoun-like follow-ups), and explicit choice/mixed constructions such as `还是`, `后再`, `根据…计划`. Do not use confidence alone.

Verifier implementation must snapshot query/chunks inside `try/catch`; reject any high-risk/unsafe/prompt-injection/credential material. Use stable score+chunkId ordering and bounded excerpts. Return eligible only for safe multi-chunk numeric/definition/version/condition differences or fixed stale/uncertain/version-time signals. Single consistent support, obvious weak/off-topic evidence and empty input remain local.

- [ ] **Step 4: Run GREEN and confirm exact eligibility counts**

```powershell
bun --cwd packages/agent test tests/production-eligibility.test.ts
bun --cwd packages/agent test tests/router-model-candidate.test.ts tests/knowledge-verifier-model-candidate.test.ts
bun --cwd packages/agent typecheck
```

Expected: Router `16 eligible / 44 zero-call`; Verifier `12 eligible / 28 zero-call`; all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add -- packages/agent/src/model-candidates/production-eligibility.ts packages/agent/src/model-candidates/production.ts packages/agent/tests/production-eligibility.test.ts
git commit -m "feat(agent): define production model eligibility"
```

### Task 3: Build the Web server-only runtime bundle

**Files:**
- Create: `apps/web/src/lib/chat-model-agent-config.ts`
- Create: `apps/web/src/lib/chat-model-agent-config.test.mts`
- Create: `apps/web/src/lib/chat-model-agent-runtime.ts`
- Create: `apps/web/src/lib/chat-model-agent-runtime.test.mts`
- Modify: `apps/web/package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Add failing config and composition tests**

```ts
assert.deepEqual(resolveChatModelAgentConfig({}), {
  mode: 'mock',
  liveCallsEnabled: false,
  routerEnabled: false,
  verifierEnabled: false,
  routerTimeoutMs: 5000,
  verifierTimeoutMs: 4000,
  provider: 'mock',
  model: 'mock-agent-candidate',
  credentialSource: 'none',
  configured: true,
  disabledReason: 'agent_gates_disabled',
});

assert.equal(
  resolveChatModelAgentConfig({
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    ROUTER_MODEL_ENABLED: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    AI_MODEL: 'deepseek-v4-flash',
    DEEPSEEK_API_KEY: 'test-key',
  }).routerEnabled,
  true,
);
```

Also reject HTTP/credential-bearing base URLs, provider/key mismatch, ambiguous two-key custom hosts, timeouts outside `1000..10000`, and any value other than exact string `true` for live gates. Canary assertions must prove returned config/status never includes the key.

Runtime tests inject `createExecutor` and assert Router gets 5000ms, Verifier gets 4000ms, both use `json_object`, and `createBudget()` returns a fresh `{maxCalls:2,maxInputTokens:2400,maxOutputTokens:800}` budget.

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/web test -- chat-model-agent-config chat-model-agent-runtime
```

Expected: missing module failures.

- [ ] **Step 3: Implement strict config resolution and composition**

`chat-model-agent-config.ts` must return a discriminated safe result:

```ts
export type ChatModelAgentConfig = {
  mode: 'mock' | 'live';
  liveCallsEnabled: boolean;
  routerEnabled: boolean;
  verifierEnabled: boolean;
  routerTimeoutMs: number;
  verifierTimeoutMs: number;
  provider: 'mock' | 'deepseek' | 'openai';
  model: string;
  credentialSource: 'none' | 'deepseek' | 'openai';
  configured: boolean;
  disabledReason?:
    | 'mock_mode'
    | 'global_live_disabled'
    | 'agent_gates_disabled'
    | 'invalid_provider_config';
};
```

The safe resolver returns neither API key nor base URL. Match DeepSeek hosts only when a DeepSeek key is present, OpenAI hosts only when an OpenAI key is present, and classify credential-bearing/non-HTTPS URLs as `invalid_provider_config`. `chat-model-agent-runtime.ts` privately re-reads the validated URL and the single key selected by `credentialSource` only while creating the executor; it never re-exports them. Gates become effective only when `mode=live`, global live is true, the provider is valid, and the corresponding Agent flag is exact `true`.

`chat-model-agent-runtime.ts` starts with `import 'server-only'`, creates one JSON-object executor closure, then two runtimes:

```ts
return {
  routerRuntime: createModelAgentRuntime({
    mode: config.mode,
    provider: config.provider,
    model: config.model,
    liveCallsEnabled: config.liveCallsEnabled,
    timeoutMs: config.routerTimeoutMs,
    mockResponder: mockResponderFor('router_fallback'),
    executor,
  }),
  verifierRuntime: createModelAgentRuntime({
    mode: config.mode,
    provider: config.provider,
    model: config.model,
    liveCallsEnabled: config.liveCallsEnabled,
    timeoutMs: config.verifierTimeoutMs,
    mockResponder: mockResponderFor('knowledge_verification'),
    executor,
  }),
  routerEnabled: config.routerEnabled,
  verifierEnabled: config.verifierEnabled,
  createBudget: () =>
    createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 2400,
      maxOutputTokens: 800,
    }),
};
```

Use `structuredOutputMode: 'json_object'`; do not register strict-tool schemas.

- [ ] **Step 4: Install the direct workspace dependency and run GREEN**

```powershell
bun --cwd apps/web add @repo/ai@workspace:*
bun --filter @repo/web test -- chat-model-agent-config chat-model-agent-runtime
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: tests and build pass; browser/client bundle inspection contains no provider key literal or server-only factory import.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/chat-model-agent-config.ts apps/web/src/lib/chat-model-agent-config.test.mts apps/web/src/lib/chat-model-agent-runtime.ts apps/web/src/lib/chat-model-agent-runtime.test.mts apps/web/package.json bun.lock
git commit -m "feat(web): compose Router Verifier runtimes"
```

### Task 4: Add asynchronous production Router execution

**Files:**
- Modify: `apps/web/src/lib/chat-agent-runtime.ts`
- Modify: `apps/web/src/lib/chat-agent-runtime.test.mts`

- [ ] **Step 1: Write failing async Router tests**

Test these behaviors through a new `buildChatAgentExecution()` API:

```ts
const execution = await buildChatAgentExecution({
  messages: [{ role: 'user', content: '结合我的笔记讲一下这道题。' }],
  activeContext: null,
  runId: 'run_router_model',
  userId: 'user_1',
  model: {
    enabled: true,
    runtime: recordingRuntime({
      route: 'tutor',
      confidence: 0.91,
      reasonCode: 'ambiguous_intent_resolved',
    }),
    budget: createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 2400,
      maxOutputTokens: 800,
    }),
  },
});
assert.equal(execution.decision.route, 'tutor');
assert.equal(execution.routerObservation.attempted, true);
assert.equal(execution.routerObservation.disposition, 'candidate_applied');
assert.equal(execution.budget.usedCalls, 1);
```

Add high-confidence, safety, disabled-gate and hostile input tests whose runtime throws if invoked; all must have `attempted=false`. Add runtime timeout/schema/abort tests that retain deterministic route. Assert a model suggestion cannot set `requiresRag` or `requiresHumanApproval`; values come from the canonical route map.

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/web test -- chat-agent-runtime
```

Expected: `buildChatAgentExecution` is missing.

- [ ] **Step 3: Implement the async wrapper without breaking the sync API**

```ts
export type ChatAgentExecution = {
  decision: ChatAgentDecision;
  routerObservation: RouterModelCandidateEnvelope['observation'];
  budget: ModelAgentRunBudget;
};

export async function buildChatAgentExecution(
  input: BuildChatAgentExecutionInput,
): Promise<ChatAgentExecution> {
  const latestUserText = getLatestUserText(input.messages);
  const state = createChatAgentState(input, latestUserText);
  const deterministic = routeAgentRequest(state);
  const eligible =
    input.model.enabled &&
    isRouterModelEligible({
      text: latestUserText,
      activeStudyContext: input.activeContext?.questionText,
      deterministic,
    });
  const envelope = await runRouterModelCandidate({
    runId: input.runId,
    text: latestUserText,
    activeStudyContext: input.activeContext?.questionText,
    deterministic,
    candidateEligible: eligible,
    budget: input.model.budget,
    signal: input.signal,
    runtime: input.model.runtime,
  });
  return {
    decision: toDecision(envelope.result, false, tutorInput(input, latestUserText)),
    routerObservation: envelope.observation,
    budget: envelope.observation.budget,
  };
}
```

Any unexpected wrapper failure must return a local `chat` decision and a fixed unavailable observation without exposing the error. Preserve `buildChatAgentDecision()` and all existing deterministic tests.

- [ ] **Step 4: Run GREEN and Web gates**

```powershell
bun --filter @repo/web test -- chat-agent-runtime
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all existing and new tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/chat-agent-runtime.ts apps/web/src/lib/chat-agent-runtime.test.mts
git commit -m "feat(chat): route ambiguous requests with model"
```

### Task 5: Execute the Verifier model after safe RAG search

**Files:**
- Modify: `apps/web/src/lib/chat-rag-context.ts`
- Modify: `apps/web/src/lib/chat-rag-context.test.mts`

- [ ] **Step 1: Write failing Verifier production tests**

Extend `SearchKnowledgeForChatInput` with an optional model execution context and assert:

- a safe complex multi-chunk conflict invokes once and applies `conflict`;
- stale/uncertain evidence invokes once;
- prompt injection/high-risk/`safeForPrompt=false` invokes zero times and returns suspicious;
- consistent single-hit and obvious weak evidence invoke zero times;
- runtime timeout/schema/provider failure turns deterministic trusted into suspicious;
- Router-used budget enters Verifier and total `usedCalls` never exceeds 2;
- abort propagates and no raw query/chunk/error appears in result metadata.

Example applied assertion:

```ts
assert.equal(result.verifierResult?.status, 'conflict');
assert.equal(result.verifierObservation?.attempted, true);
assert.equal(result.verifierObservation?.disposition, 'candidate_applied');
assert.equal(result.modelBudget?.usedCalls, 2);
```

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/web test -- chat-rag-context
```

Expected: model execution fields are missing.

- [ ] **Step 3: Implement deterministic -> eligibility -> adapter ordering**

After response/schema validation and before returning the final search result:

```ts
const chunks = toVerifierChunks(parsed.data.hits);
const deterministic = verifyKnowledgeChunks({ query: request.query, chunks });
const eligible =
  Boolean(input.model?.enabled) &&
  isKnowledgeVerifierModelEligible({
    query: request.query,
    chunks,
    deterministic,
  });
const envelope = input.model
  ? await runKnowledgeVerifierModelCandidate({
      runId: input.model.runId,
      query: request.query,
      chunks,
      deterministic,
      candidateEligible: eligible,
      budget: input.model.budget,
      signal: input.model.signal,
      runtime: input.model.runtime,
    })
  : undefined;
```

Always run `selectRagHitsForPrompt()` locally. Return `modelBudget` and `verifierObservation` separately from hits/result. Empty/search-failure results must preserve the incoming budget and use no model call. Catch blocks may log only fixed status/category, never `error.message` from provider or retrieved content.

- [ ] **Step 4: Run GREEN and neighboring safety tests**

```powershell
bun --filter @repo/web test -- chat-rag-context rag-safety
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all tests pass; unsafe evidence remains absent from prompts/citations.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/chat-rag-context.ts apps/web/src/lib/chat-rag-context.test.mts
git commit -m "feat(chat): verify RAG evidence with model"
```

### Task 6: Orchestrate the shared request budget in `/api/chat`

**Files:**
- Modify: `apps/web/src/app/api/chat/route.ts`
- Create: `apps/web/src/lib/chat-model-agent-observation.ts`
- Create: `apps/web/src/lib/chat-model-agent-observation.test.mts`

- [ ] **Step 1: Write failing safe-observation and orchestration tests**

Test a projection that accepts unknown/hostile observations and returns only:

```ts
type SafeChatModelObservation = {
  attempted: boolean;
  disposition: ModelCandidateDisposition;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  errorCode?: string;
  providerFailureCategory?: string;
};
```

Use credential/query/chunk canaries in hostile getters and reason arrays; projected JSON and headers must contain none. Test aggregate usage sums Router + Verifier and clamps non-finite/negative values to zero.

Add a Route Handler integration test or extracted orchestration test proving the budget returned by Router is passed into `searchKnowledgeForChat()`, `req.signal` reaches both, and global/Agent gates false produce zero runtime calls.

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/web test -- chat-model-agent-observation
```

Expected: module/functions are missing.

- [ ] **Step 3: Implement safe projection and wire the route**

At request start:

```ts
const modelAgents = createChatModelAgentRuntimeBundle(process.env);
const agentBudget = modelAgents.createBudget();
const agentExecution = await buildChatAgentExecution({
  messages: normalizedMessages,
  activeContext: normalizedActiveContext,
  runId: traceRunId,
  userId: 'web-chat-user',
  signal: req.signal,
  model: {
    enabled: modelAgents.routerEnabled,
    runtime: modelAgents.routerRuntime,
    budget: agentBudget,
  },
});
```

Then pass `agentExecution.budget` to Verifier:

```ts
model: {
  enabled: modelAgents.verifierEnabled,
  runtime: modelAgents.verifierRuntime,
  budget: agentExecution.budget,
  runId: traceRunId,
  signal: req.signal,
}
```

Use `agentExecution.decision` everywhere the previous synchronous decision was used. Add fixed headers from safe projections only. Do not include observations in the response body.

- [ ] **Step 4: Run Web full tests/build**

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all exit 0; high-confidence/safety Mock paths remain zero-call.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/app/api/chat/route.ts apps/web/src/lib/chat-model-agent-observation.ts apps/web/src/lib/chat-model-agent-observation.test.mts
git commit -m "feat(chat): orchestrate production model agents"
```

### Task 7: Add candidate usage to Trace and estimated cost

**Files:**
- Modify: `apps/web/src/lib/agent-trace-payload.ts`
- Modify: `apps/web/src/lib/agent-trace-payload.test.mts`

- [ ] **Step 1: Write failing Trace/cost tests**

Pass safe Router/Verifier observations into `buildChatAgentTracePayload()` and assert:

```ts
assert.match(routerStep.outputSummary, /attempted=true/);
assert.match(routerStep.outputSummary, /disposition=candidate_applied/);
assert.match(verifierStep.outputSummary, /inputTokens=640 outputTokens=92/);
assert.equal(payload.inputTokenEstimate, finalEstimate + 640 + 811);
assert.equal(payload.outputTokenEstimate, finalMaxOutput + 92 + 104);
```

Add canaries in reason/error/provider values and assert prompt, query, chunk, key, base URL, raw error and stack never appear. Unavailable usage must add zero and set a fixed `usageUnavailable=true` step marker.

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/web test -- agent-trace-payload
```

Expected: payload input type has no candidate observations and totals exclude usage.

- [ ] **Step 3: Extend the Trace input with safe observations**

```ts
type CandidateTraceObservation = {
  attempted: boolean;
  disposition: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  usageUnavailable?: boolean;
  errorCode?: string;
  providerFailureCategory?: string;
};
```

Add actual Router/Verifier duration/token summaries to their steps. Aggregate candidate usage into the existing top-level estimate before calling `estimateAiCost()`. Continue labeling the dashboard value as estimated because final stream output remains a maximum estimate.

- [ ] **Step 4: Run GREEN and full Web gates**

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all pass and secret canaries are absent.

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/agent-trace-payload.ts apps/web/src/lib/agent-trace-payload.test.mts
git commit -m "feat(agent): observe model candidate usage"
```

### Task 8: Synchronize Docker configuration and operations docs

**Files:**
- Modify: `docker/docker-compose.dev.yml`
- Modify: `docker/.env.example`
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Write the failing Docker Web gate test**

Extend the static Compose test to require Web-visible server environment entries without printing values:

```ts
for (const entry of [
  'ROUTER_MODEL_ENABLED: ${ROUTER_MODEL_ENABLED:-false}',
  'KNOWLEDGE_VERIFIER_MODEL_ENABLED: ${KNOWLEDGE_VERIFIER_MODEL_ENABLED:-false}',
  'ROUTER_MODEL_TIMEOUT_MS: ${ROUTER_MODEL_TIMEOUT_MS:-5000}',
  'KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS: ${KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS:-4000}',
]) {
  expect(webService).toContain(entry);
}
```

Keep Web `env_file: ../.env` for existing Chat runtime, but explicit environment entries must document defaults and allow Compose overrides.

- [ ] **Step 2: Run RED**

```powershell
bun --filter @repo/server test -- --runInBand worker-readiness/docker-compose-readiness.spec.ts
```

Expected: four entries are missing.

- [ ] **Step 3: Add Docker entries and non-secret examples**

Add the four values to Web environment and `docker/.env.example`. Do not add keys to Client Components or image build args. `ROUTER_MODEL_ENABLED=false` / `KNOWLEDGE_VERIFIER_MODEL_ENABLED=false` remain safe defaults; controlled acceptance overrides both to true.

- [ ] **Step 4: Update current-state docs**

Document the exact production boundary, the two independent rollback gates, 5s/4s timeouts, two-call budget, JSON-object mode, zero-call scopes and safe Trace. Phase 6.9.4.4 remains “implementation in progress” until controlled Live and browser acceptance complete. Preserve Phase 6.9.4.3 as historical evidence, but do not describe Router as permanently deterministic. Link the Agent-first roadmap and do not imply that Memory, Orchestrator or all of Phase 6 is complete. Include the question for a future session:

```text
请继续 Phase 6.9.4.4 controlled Live、Docker 与可见浏览器验收，确认歧义 Router、semantic-needed Verifier、zero-call 和失败降级后再合并 main；不要提前进入记忆系统。
```

- [ ] **Step 5: Verify and commit**

```powershell
bun --filter @repo/server test -- --runInBand worker-readiness/docker-compose-readiness.spec.ts
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
git add -- docker/docker-compose.dev.yml docker/.env.example apps/server/src/worker-readiness/docker-compose-readiness.spec.ts AGENTS.md README.md docs/dev-start.md docs/roadmap.md docs/ai-behavior-acceptance.md
git commit -m "docs(agent): configure production model agents"
```

### Task 9: Run Mock, controlled Live, Docker and visible-browser acceptance

**Files:**
- Create: `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`
- Modify after acceptance: `AGENTS.md`
- Modify after acceptance: `docs/roadmap.md`

- [ ] **Step 1: Run complete branch gates**

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/agent lint
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
```

Expected: all exit 0; record exact counts.

- [ ] **Step 2: Prove Mock zero-call and fallbacks**

With Agent gates disabled, test 36 high-confidence Router, 8 Router safety, 28 Verifier local/safety cases and runtime-throw fixtures. Assert `attempted=false`, fixed dispositions, unchanged permissions, restrictive Verifier fallback, and no provider calls.

- [ ] **Step 3: Run controlled Live Agent calls**

Use the ignored root/Web env files without printing values:

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:ROUTER_MODEL_ENABLED='true'
$env:KNOWLEDGE_VERIFIER_MODEL_ENABLED='true'
```

Run at least three ambiguous Router cases (mixed notes+tutor, contextual short reference, mixed plan/review) and safe Verifier complex-conflict + stale/uncertain cases. Assert provider-reported usage, structured `candidate_applied`, Router <=5000ms, Verifier <=4000ms, request total calls <=2 and no retries. Then run timeout/schema/provider failure fixtures and assert final Chat continues.

- [ ] **Step 4: Run Docker full-stack acceptance**

```powershell
$env:KNOWLEDGE_PROCESSING_MODE='queue'
$env:ROUTER_MODEL_ENABLED='true'
$env:KNOWLEDGE_VERIFIER_MODEL_ENABLED='true'
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

If Docker Desktop Bake reproduces its known gRPC session error, use the documented non-destructive fallback: set `COMPOSE_BAKE=false`, build server/worker/web separately, then `up -d --no-build`. Do not clear cache, containers, volumes or data.

- [ ] **Step 5: Perform visible browser acceptance**

Open `http://127.0.0.1:3000` in a visible browser window and keep it open. Create a synthetic account and verify:

- a high-confidence message shows Router model attempted=false;
- an ambiguous follow-up shows attempted=true and model-applied route;
- a safe conflicting knowledge query shows Verifier attempted=true and conflict/reliability notice;
- a prompt-injection knowledge item shows Verifier attempted=false/safety-blocked;
- Trace view contains fixed disposition/duration/token fields and no prompt/chunk/key;
- provider failure fallback still returns a Chat response.

- [ ] **Step 6: Clean only acceptance data and write evidence**

Delete the exact synthetic account, document, Trace and associated jobs created after the recorded watermark. Verify count `1 -> 0`; preserve all earlier accounts and all Docker volumes. The acceptance document must include safe model/provider names, gates, counts, durations, usage, dispositions, zero-call/fallback evidence and browser observations, but no key/base URL/token/query/chunk/raw provider output.

- [ ] **Step 7: Mark current docs complete and commit**

```powershell
git add -- docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md AGENTS.md docs/roadmap.md
git commit -m "docs(agent): record Router Verifier production acceptance"
```

### Task 10: Final review, merge, main re-verification and push

**Files:**
- Modify only if review finds a tested issue: files listed above
- Modify for main evidence: `docs/acceptance/2026-07-14-phase-6-9-4-4-router-verifier-production.md`

- [ ] **Step 1: Run final branch review and gates**

Request full spec and quality review over `origin/main..HEAD`. Fix every Critical/Important with a failing regression test and separate commit. Re-run all Task 9 Step 1 gates and require a clean worktree.

- [ ] **Step 2: Merge from current main**

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff codex/phase-6-9-4-4-agent-production -m "merge: Phase 6.9.4.4 Router Verifier production"
```

- [ ] **Step 3: Re-run main static and real acceptance**

Repeat complete static gates, controlled Live calls and visible-browser/Docker smoke on merged `main`. Keep the browser window open. Add main SHA and safe results to the acceptance document in a separate commit.

- [ ] **Step 4: Push and verify SHA**

```powershell
git push origin main
$local = (git rev-parse HEAD).Trim()
$remote = ((git ls-remote origin refs/heads/main) -split '\s+')[0]
if ($local -ne $remote) { throw 'local and remote main SHA differ' }
git branch -d codex/phase-6-9-4-4-agent-production
```

Expected: local/remote main SHAs match, worktree is clean, Docker data remains intact, and the Phase 6.9.4.4 acceptance document contains both branch and main evidence.
