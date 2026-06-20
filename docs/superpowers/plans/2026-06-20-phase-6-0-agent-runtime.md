# Phase 6.0 Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 6.0 LangGraph agent runtime foundation with shared contracts, deterministic routing, threshold gating, action proposals, run logging, and safe degradation.

**Architecture:** Add shared Zod contracts in `@repo/types`, then implement `@repo/agent` as a pure TypeScript package that exposes state helpers, threshold guards, a lightweight router, an in-memory run recorder, and a graph/runtime entrypoint. Phase 6.0 does not call live LLMs by default; live model validation is optional and must be guarded by explicit env switches and token budgets.

**Tech Stack:** Bun workspace, TypeScript strict mode, Zod, LangGraph `StateGraph`, `bun:test`, existing `@repo/types` and `@repo/agent` packages.

---

## File Structure

- Create `packages/types/src/api/agent.ts`
  Shared Agent API schemas and exported TypeScript types.

- Modify `packages/types/src/index.ts`
  Export Agent contracts from the root `@repo/types` entrypoint.

- Modify `packages/types/package.json`
  Add `./api/agent` export.

- Create `packages/types/tests/agent.test.mts`
  Contract tests for routes, proposals, state, run logs, and validation failures.

- Replace `packages/agent/src/state.ts`
  Runtime state helpers that wrap shared types.

- Create `packages/agent/src/thresholds.ts`
  Pure threshold functions for ReviewAgent, MemoryAgent, WrongQuestionOrganizerAgent, and PlannerAgent.

- Create `packages/agent/src/router.ts`
  Deterministic RouterAgent skeleton with no live model call.

- Create `packages/agent/src/runtime.ts`
  Agent runtime orchestration, degradation handling, and structured result shape.

- Create `packages/agent/src/recorder.ts`
  In-memory `AgentRun` / `AgentStep` recorder interface and implementation.

- Modify `packages/agent/src/graph/index.ts`
  Create a minimal LangGraph-compatible graph entrypoint and keep runtime fallback.

- Modify `packages/agent/src/index.ts`
  Export runtime, router, state, thresholds, recorder, and graph APIs.

- Modify `packages/agent/package.json`
  Add `test` script.

- Create `packages/agent/tests/router.test.ts`
  Router branch tests.

- Create `packages/agent/tests/thresholds.test.ts`
  Threshold guard tests.

- Create `packages/agent/tests/runtime.test.ts`
  Runtime structured result and degradation tests.

- Modify `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`
  Add the explicit live-model acceptance rule: use live only when necessary, with bounded input/output token budgets and recorded cost.

---

### Task 1: Shared Agent Contracts

**Files:**
- Create: `packages/types/src/api/agent.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/package.json`
- Test: `packages/types/tests/agent.test.mts`

- [ ] **Step 1: Write the failing contract test**

Create `packages/types/tests/agent.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  actionProposalSchema,
  agentRouteSchema,
  agentRunSchema,
  agentStateSchema,
  agentStepSchema,
  routerResultSchema,
  shouldUseLiveAgentModelSchema,
} from '../src/api/agent.ts';

function run() {
  testRoutes();
  testActionProposal();
  testAgentState();
  testRouterResult();
  testRunAndStep();
  testLiveModelGate();
}

function testRoutes() {
  assert.equal(agentRouteSchema.parse('chat'), 'chat');
  assert.equal(agentRouteSchema.parse('tutor'), 'tutor');
  assert.equal(agentRouteSchema.parse('rag_answer'), 'rag_answer');
  assert.throws(() => agentRouteSchema.parse('always_memory'));
}

function testActionProposal() {
  const result = actionProposalSchema.parse({
    id: 'proposal_1',
    type: 'SAVE_MEMORY',
    title: '记录讲解偏好',
    summary: '用户希望后续用苏格拉底方式讲题。',
    reason: '用户明确表达“以后都这样讲”。',
    confidence: 0.92,
    payload: { style: 'socratic' },
    status: 'pending',
    createdAt: '2026-06-20T10:00:00.000Z',
  });

  assert.equal(result.type, 'SAVE_MEMORY');
  assert.equal(result.status, 'pending');
  assert.throws(() =>
    actionProposalSchema.parse({
      ...result,
      confidence: 1.2,
    }),
  );
}

function testAgentState() {
  const result = agentStateSchema.parse({
    runId: 'run_1',
    userId: 'user_1',
    input: {
      text: '这道题为什么这样做？',
      attachments: [],
    },
    proposals: [],
    errors: [],
  });

  assert.equal(result.runId, 'run_1');
  assert.equal(result.input.text, '这道题为什么这样做？');
  assert.deepEqual(result.proposals, []);
}

function testRouterResult() {
  const result = routerResultSchema.parse({
    name: 'tutor',
    confidence: 0.86,
    reason: '用户在追问题目解法。',
    requiresRag: false,
    requiresHumanApproval: false,
  });

  assert.equal(result.name, 'tutor');
  assert.equal(result.requiresRag, false);
}

function testRunAndStep() {
  const run = agentRunSchema.parse({
    id: 'run_1',
    userId: 'user_1',
    conversationId: 'conversation_1',
    route: 'chat',
    status: 'completed',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:00:01.000Z',
    totalDurationMs: 1000,
    inputTokenEstimate: 80,
    outputTokenEstimate: 120,
    modelProvider: 'mock',
    modelName: 'mock-agent',
    costEstimate: 0,
  });

  const step = agentStepSchema.parse({
    id: 'step_1',
    runId: run.id,
    node: 'RouterAgent',
    status: 'completed',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T10:00:00.020Z',
    durationMs: 20,
    inputSummary: '用户请求讲题',
    outputSummary: 'route=tutor',
    errorMessage: null,
  });

  assert.equal(step.runId, 'run_1');
  assert.equal(step.status, 'completed');
}

function testLiveModelGate() {
  assert.equal(
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'mock',
      enableLiveCalls: false,
      inputTokenBudget: 2500,
      outputTokenBudget: 1200,
    }),
    false,
  );

  assert.equal(
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'live',
      enableLiveCalls: true,
      inputTokenBudget: 2500,
      outputTokenBudget: 1200,
    }),
    true,
  );

  assert.throws(() =>
    shouldUseLiveAgentModelSchema.parse({
      providerMode: 'live',
      enableLiveCalls: true,
      inputTokenBudget: 12000,
      outputTokenBudget: 1200,
    }),
  );
}

run();
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types packages/types/tests/agent.test.mts
```

Expected: FAIL because `packages/types/src/api/agent.ts` does not exist.

- [ ] **Step 3: Add shared contracts**

Create `packages/types/src/api/agent.ts`:

```ts
import { z } from 'zod';

export const agentRouteSchema = z.enum([
  'chat',
  'tutor',
  'rag_answer',
  'wrong_question_organize',
  'review_analysis',
  'study_plan',
  'memory_reflection',
  'knowledge_dedup',
]);

export const actionProposalTypeSchema = z.enum([
  'SAVE_MEMORY',
  'ORGANIZE_WRONG_QUESTION',
  'MERGE_WRONG_QUESTION_DECK',
  'CREATE_STUDY_PLAN',
  'REPLACE_KNOWLEDGE_DOCUMENT',
  'MERGE_KNOWLEDGE_DOCUMENT',
]);

export const actionProposalStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'expired']);

export const actionProposalSchema = z.object({
  id: z.string().min(1),
  type: actionProposalTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  payload: z.record(z.unknown()),
  status: actionProposalStatusSchema,
  createdAt: z.string().datetime(),
});

export const agentAttachmentSchema = z.object({
  type: z.enum(['image', 'document']),
  url: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const agentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const routerResultSchema = z.object({
  name: agentRouteSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  requiresRag: z.boolean(),
  requiresHumanApproval: z.boolean(),
});

export const ragContextSchema = z.object({
  query: z.string().min(1),
  chunks: z.array(
    z.object({
      documentId: z.string().min(1),
      documentTitle: z.string().min(1),
      chunkId: z.string().min(1),
      content: z.string().min(1),
      score: z.number().min(0).max(1),
    }),
  ),
});

export const verifierResultSchema = z.object({
  status: z.enum(['trusted', 'suspicious', 'conflict', 'insufficient', 'skipped']),
  reason: z.string().min(1),
  userNotice: z.string().min(1).optional(),
});

export const agentErrorSchema = z.object({
  node: z.string().min(1),
  message: z.string().min(1),
  recoverable: z.boolean(),
});

export const agentStateSchema = z.object({
  runId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  input: z.object({
    text: z.string(),
    attachments: z.array(agentAttachmentSchema).optional(),
  }),
  route: routerResultSchema.optional(),
  chatContext: z
    .object({
      recentMessages: z.array(agentMessageSchema),
      activeStudyContext: z.string().optional(),
    })
    .optional(),
  ragContext: ragContextSchema.optional(),
  verifierResult: verifierResultSchema.optional(),
  reviewContext: z
    .object({
      dueCount: z.number().int().min(0).optional(),
      overdueCount: z.number().int().min(0).optional(),
      weakKnowledgePoints: z.array(z.string()).optional(),
    })
    .optional(),
  proposals: z.array(actionProposalSchema),
  finalResponse: z
    .object({
      markdown: z.string(),
      citations: z
        .array(
          z.object({
            documentId: z.string().min(1),
            title: z.string().min(1),
            chunkId: z.string().min(1),
            score: z.number().min(0).max(1),
          }),
        )
        .optional(),
    })
    .optional(),
  errors: z.array(agentErrorSchema),
});

export const agentRunStatusSchema = z.enum(['running', 'completed', 'failed', 'degraded']);

export const agentRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).nullable(),
  route: agentRouteSchema.nullable(),
  status: agentRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  totalDurationMs: z.number().int().min(0).nullable(),
  inputTokenEstimate: z.number().int().min(0),
  outputTokenEstimate: z.number().int().min(0),
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  costEstimate: z.number().min(0),
});

export const agentStepSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  node: z.string().min(1),
  status: agentRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().min(0).nullable(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  errorMessage: z.string().nullable(),
});

export const shouldUseLiveAgentModelSchema = z
  .object({
    providerMode: z.enum(['mock', 'live']),
    enableLiveCalls: z.boolean(),
    inputTokenBudget: z.number().int().min(1).max(5000),
    outputTokenBudget: z.number().int().min(1).max(2000),
  })
  .transform((value) => value.providerMode === 'live' && value.enableLiveCalls);

export type AgentRoute = z.infer<typeof agentRouteSchema>;
export type ActionProposalType = z.infer<typeof actionProposalTypeSchema>;
export type ActionProposalStatus = z.infer<typeof actionProposalStatusSchema>;
export type ActionProposal = z.infer<typeof actionProposalSchema>;
export type RouterResult = z.infer<typeof routerResultSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
```

Modify `packages/types/src/index.ts`:

```ts
export * from './api/agent';
```

Keep the existing exports and append the new line.

Modify `packages/types/package.json` exports:

```json
"./api/agent": "./src/api/agent.ts"
```

Insert it next to the other `./api/*` exports.

- [ ] **Step 4: Run contract test**

Run:

```powershell
node --experimental-strip-types packages/types/tests/agent.test.mts
bun --cwd packages/types typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/types/src/api/agent.ts packages/types/src/index.ts packages/types/package.json packages/types/tests/agent.test.mts
git commit -m "feat: add agent shared contracts"
```

---

### Task 2: Agent State Helpers and Threshold Guards

**Files:**
- Modify: `packages/agent/src/state.ts`
- Create: `packages/agent/src/thresholds.ts`
- Create: `packages/agent/tests/thresholds.test.ts`
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Add the failing threshold tests**

Create `packages/agent/tests/thresholds.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  shouldRunMemoryAgent,
  shouldRunPlannerAgent,
  shouldRunReviewAgent,
  shouldRunWrongQuestionOrganizerAgent,
} from '../src/thresholds';

describe('agent threshold guards', () => {
  it('runs ReviewAgent only when review signals reach useful thresholds', () => {
    expect(shouldRunReviewAgent({ newWrongQuestionCount: 4 })).toBe(false);
    expect(shouldRunReviewAgent({ newWrongQuestionCount: 5 })).toBe(true);
    expect(shouldRunReviewAgent({ sameKnowledgePointWrongCount: 3 })).toBe(true);
    expect(shouldRunReviewAgent({ sameTopicRecentFailureCount: 3 })).toBe(true);
    expect(shouldRunReviewAgent({ consecutiveActiveDays: 7 })).toBe(true);
    expect(shouldRunReviewAgent({ manualRequested: true })).toBe(true);
  });

  it('runs MemoryAgent only for explicit or repeated long-term signals', () => {
    expect(shouldRunMemoryAgent({ effectiveStudyMessageCount: 19 })).toBe(false);
    expect(shouldRunMemoryAgent({ explicitPreference: true })).toBe(true);
    expect(shouldRunMemoryAgent({ repeatedWeakPoint: true })).toBe(true);
    expect(shouldRunMemoryAgent({ consecutiveActiveDays: 7 })).toBe(true);
    expect(shouldRunMemoryAgent({ effectiveStudyMessageCount: 20 })).toBe(true);
    expect(shouldRunMemoryAgent({ userConfirmedLongTermValue: true })).toBe(true);
  });

  it('runs WrongQuestionOrganizerAgent for queued or user-requested organization', () => {
    expect(shouldRunWrongQuestionOrganizerAgent({ unorganizedWrongQuestionCount: 2 })).toBe(
      false,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ savedWrongQuestion: true })).toBe(true);
    expect(shouldRunWrongQuestionOrganizerAgent({ unorganizedWrongQuestionCount: 3 })).toBe(
      true,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ sameSubjectNewWrongQuestionCount: 5 })).toBe(
      true,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ manualRequested: true })).toBe(true);
    expect(shouldRunWrongQuestionOrganizerAgent({ userReorganizedDeck: true })).toBe(true);
  });

  it('runs PlannerAgent only for plan surfaces or material pressure changes', () => {
    expect(shouldRunPlannerAgent({ overdueCardIncrease: 4 })).toBe(false);
    expect(shouldRunPlannerAgent({ openedPlanSurface: true })).toBe(true);
    expect(shouldRunPlannerAgent({ firstLoginToday: true })).toBe(true);
    expect(shouldRunPlannerAgent({ reviewPreferenceChanged: true })).toBe(true);
    expect(shouldRunPlannerAgent({ overdueCardIncrease: 5 })).toBe(true);
    expect(shouldRunPlannerAgent({ manualRequested: true })).toBe(true);
  });
});
```

Modify `packages/agent/package.json` scripts:

```json
"test": "bun test tests"
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun --cwd packages/agent test
```

Expected: FAIL because `packages/agent/src/thresholds.ts` does not exist.

- [ ] **Step 3: Implement state helpers and threshold guards**

Replace `packages/agent/src/state.ts`:

```ts
import type { AgentState } from '@repo/types/api/agent';

export type { AgentState } from '@repo/types/api/agent';

export type CreateAgentStateInput = {
  runId: string;
  userId: string;
  conversationId?: string;
  text: string;
};

export function createInitialAgentState(input: CreateAgentStateInput): AgentState {
  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    input: {
      text: input.text,
      attachments: [],
    },
    proposals: [],
    errors: [],
  };
}

export function appendRecoverableError(
  state: AgentState,
  node: string,
  error: unknown,
): AgentState {
  const message = error instanceof Error ? error.message : String(error);

  return {
    ...state,
    errors: [
      ...state.errors,
      {
        node,
        message,
        recoverable: true,
      },
    ],
  };
}
```

Create `packages/agent/src/thresholds.ts`:

```ts
export type ReviewAgentSignals = {
  newWrongQuestionCount?: number;
  sameKnowledgePointWrongCount?: number;
  sameTopicRecentFailureCount?: number;
  consecutiveActiveDays?: number;
  manualRequested?: boolean;
};

export function shouldRunReviewAgent(signals: ReviewAgentSignals): boolean {
  return (
    signals.manualRequested === true ||
    (signals.newWrongQuestionCount ?? 0) >= 5 ||
    (signals.sameKnowledgePointWrongCount ?? 0) >= 3 ||
    (signals.sameTopicRecentFailureCount ?? 0) >= 3 ||
    (signals.consecutiveActiveDays ?? 0) >= 7
  );
}

export type MemoryAgentSignals = {
  explicitPreference?: boolean;
  repeatedWeakPoint?: boolean;
  consecutiveActiveDays?: number;
  effectiveStudyMessageCount?: number;
  userConfirmedLongTermValue?: boolean;
};

export function shouldRunMemoryAgent(signals: MemoryAgentSignals): boolean {
  return (
    signals.explicitPreference === true ||
    signals.repeatedWeakPoint === true ||
    signals.userConfirmedLongTermValue === true ||
    (signals.consecutiveActiveDays ?? 0) >= 7 ||
    (signals.effectiveStudyMessageCount ?? 0) >= 20
  );
}

export type WrongQuestionOrganizerSignals = {
  savedWrongQuestion?: boolean;
  unorganizedWrongQuestionCount?: number;
  sameSubjectNewWrongQuestionCount?: number;
  manualRequested?: boolean;
  userReorganizedDeck?: boolean;
};

export function shouldRunWrongQuestionOrganizerAgent(
  signals: WrongQuestionOrganizerSignals,
): boolean {
  return (
    signals.savedWrongQuestion === true ||
    signals.manualRequested === true ||
    signals.userReorganizedDeck === true ||
    (signals.unorganizedWrongQuestionCount ?? 0) >= 3 ||
    (signals.sameSubjectNewWrongQuestionCount ?? 0) >= 5
  );
}

export type PlannerAgentSignals = {
  openedPlanSurface?: boolean;
  firstLoginToday?: boolean;
  reviewPreferenceChanged?: boolean;
  overdueCardIncrease?: number;
  manualRequested?: boolean;
};

export function shouldRunPlannerAgent(signals: PlannerAgentSignals): boolean {
  return (
    signals.openedPlanSurface === true ||
    signals.firstLoginToday === true ||
    signals.reviewPreferenceChanged === true ||
    signals.manualRequested === true ||
    (signals.overdueCardIncrease ?? 0) >= 5
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/agent/package.json packages/agent/src/state.ts packages/agent/src/thresholds.ts packages/agent/tests/thresholds.test.ts
git commit -m "feat: add agent state and threshold guards"
```

---

### Task 3: RouterAgent Skeleton

**Files:**
- Create: `packages/agent/src/router.ts`
- Create: `packages/agent/tests/router.test.ts`

- [ ] **Step 1: Add failing RouterAgent tests**

Create `packages/agent/tests/router.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { routeAgentRequest } from '../src/router';
import { createInitialAgentState } from '../src/state';

describe('routeAgentRequest', () => {
  it('routes obvious question explanation requests to tutor', () => {
    const state = createInitialAgentState({
      runId: 'run_1',
      userId: 'user_1',
      text: '这道题为什么要这样做？',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('tutor');
    expect(result.requiresRag).toBe(false);
    expect(result.requiresHumanApproval).toBe(false);
  });

  it('routes knowledge-base requests to rag_answer', () => {
    const state = createInitialAgentState({
      runId: 'run_2',
      userId: 'user_1',
      text: '根据我上传的笔记，格林公式怎么用？',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('rag_answer');
    expect(result.requiresRag).toBe(true);
  });

  it('routes plan requests to study_plan and requires approval for writes', () => {
    const state = createInitialAgentState({
      runId: 'run_3',
      userId: 'user_1',
      text: '帮我制定下周学习计划',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('study_plan');
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('falls back to chat for general messages', () => {
    const state = createInitialAgentState({
      runId: 'run_4',
      userId: 'user_1',
      text: '你好',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('chat');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun --cwd packages/agent test
```

Expected: FAIL because `packages/agent/src/router.ts` does not exist.

- [ ] **Step 3: Implement deterministic RouterAgent**

Create `packages/agent/src/router.ts`:

```ts
import type { AgentState, RouterResult } from '@repo/types/api/agent';

type RouteRule = {
  route: RouterResult['name'];
  keywords: string[];
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
};

const routeRules: RouteRule[] = [
  {
    route: 'rag_answer',
    keywords: ['上传', '资料', '笔记', '知识库', '根据我', '参考资料'],
    confidence: 0.86,
    reason: '用户问题明确依赖个人资料或知识库。',
    requiresRag: true,
    requiresHumanApproval: false,
  },
  {
    route: 'study_plan',
    keywords: ['计划', '安排', '下周', '今天学什么', '学习重点'],
    confidence: 0.82,
    reason: '用户请求学习计划或任务安排。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'review_analysis',
    keywords: ['复习', '错因', '薄弱', '掌握情况', '为什么总错'],
    confidence: 0.8,
    reason: '用户请求复习表现或错因分析。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'wrong_question_organize',
    keywords: ['整理错题', '错题分类', '专题', '学科卡片'],
    confidence: 0.8,
    reason: '用户请求错题整理。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'tutor',
    keywords: ['这道题', '为什么', '怎么做', '讲一下', '解析', '答案'],
    confidence: 0.78,
    reason: '用户请求讲题或追问题目。',
    requiresRag: false,
    requiresHumanApproval: false,
  },
];

export function routeAgentRequest(state: AgentState): RouterResult {
  const text = normalizeText(state.input.text);
  const matchedRule = routeRules.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );

  if (matchedRule) {
    return {
      name: matchedRule.route,
      confidence: matchedRule.confidence,
      reason: matchedRule.reason,
      requiresRag: matchedRule.requiresRag,
      requiresHumanApproval: matchedRule.requiresHumanApproval,
    };
  }

  if (state.chatContext?.activeStudyContext) {
    return {
      name: 'tutor',
      confidence: 0.72,
      reason: '当前会话存在 activeStudyContext，默认承接题目追问。',
      requiresRag: false,
      requiresHumanApproval: false,
    };
  }

  return {
    name: 'chat',
    confidence: 0.65,
    reason: '未命中专门工作流，使用普通 Chat。',
    requiresRag: false,
    requiresHumanApproval: false,
  };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}
```

- [ ] **Step 4: Run RouterAgent tests**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/agent/src/router.ts packages/agent/tests/router.test.ts
git commit -m "feat: add deterministic agent router"
```

---

### Task 4: Runtime Recorder and Degradation

**Files:**
- Create: `packages/agent/src/recorder.ts`
- Create: `packages/agent/src/runtime.ts`
- Create: `packages/agent/tests/runtime.test.ts`

- [ ] **Step 1: Add failing runtime tests**

Create `packages/agent/tests/runtime.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { InMemoryAgentRunRecorder } from '../src/recorder';
import { runAgentRuntime } from '../src/runtime';

describe('runAgentRuntime', () => {
  it('returns a structured chat result and records run steps', async () => {
    const recorder = new InMemoryAgentRunRecorder();

    const result = await runAgentRuntime(
      {
        runId: 'run_1',
        userId: 'user_1',
        text: '你好',
      },
      { recorder },
    );

    expect(result.state.route?.name).toBe('chat');
    expect(result.state.finalResponse?.markdown).toContain('你好');
    expect(result.state.proposals).toEqual([]);
    expect(recorder.getRuns()).toHaveLength(1);
    expect(recorder.getSteps('run_1').map((step) => step.node)).toContain('RouterAgent');
  });

  it('routes tutor requests and returns a tutor placeholder response', async () => {
    const result = await runAgentRuntime({
      runId: 'run_2',
      userId: 'user_1',
      text: '这道题为什么这样做？',
    });

    expect(result.state.route?.name).toBe('tutor');
    expect(result.state.finalResponse?.markdown).toContain('我们先看题目条件');
  });

  it('degrades to chat when router throws', async () => {
    const result = await runAgentRuntime(
      {
        runId: 'run_3',
        userId: 'user_1',
        text: '制定学习计划',
      },
      {
        router: () => {
          throw new Error('router failed');
        },
      },
    );

    expect(result.state.route?.name).toBe('chat');
    expect(result.state.errors[0]?.node).toBe('RouterAgent');
    expect(result.state.finalResponse?.markdown).toContain('我先按普通问题回答');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun --cwd packages/agent test
```

Expected: FAIL because `recorder.ts` and `runtime.ts` do not exist.

- [ ] **Step 3: Implement recorder**

Create `packages/agent/src/recorder.ts`:

```ts
import type { AgentRun, AgentStep } from '@repo/types/api/agent';

export type AgentRunRecorder = {
  startRun(run: AgentRun): void;
  finishRun(runId: string, patch: Pick<AgentRun, 'status' | 'finishedAt' | 'totalDurationMs'>): void;
  recordStep(step: AgentStep): void;
};

export class InMemoryAgentRunRecorder implements AgentRunRecorder {
  private readonly runs = new Map<string, AgentRun>();
  private readonly steps = new Map<string, AgentStep[]>();

  startRun(run: AgentRun): void {
    this.runs.set(run.id, run);
  }

  finishRun(
    runId: string,
    patch: Pick<AgentRun, 'status' | 'finishedAt' | 'totalDurationMs'>,
  ): void {
    const current = this.runs.get(runId);

    if (!current) {
      return;
    }

    this.runs.set(runId, {
      ...current,
      ...patch,
    });
  }

  recordStep(step: AgentStep): void {
    const current = this.steps.get(step.runId) ?? [];
    this.steps.set(step.runId, [...current, step]);
  }

  getRuns(): AgentRun[] {
    return [...this.runs.values()];
  }

  getSteps(runId: string): AgentStep[] {
    return this.steps.get(runId) ?? [];
  }
}
```

- [ ] **Step 4: Implement runtime**

Create `packages/agent/src/runtime.ts`:

```ts
import type { AgentRun, AgentRunStatus, RouterResult } from '@repo/types/api/agent';

import type { AgentRunRecorder } from './recorder';
import { routeAgentRequest } from './router';
import { appendRecoverableError, createInitialAgentState } from './state';

export type RunAgentRuntimeInput = {
  runId: string;
  userId: string;
  conversationId?: string;
  text: string;
};

export type RunAgentRuntimeOptions = {
  recorder?: AgentRunRecorder;
  router?: typeof routeAgentRequest;
  now?: () => Date;
};

export async function runAgentRuntime(
  input: RunAgentRuntimeInput,
  options: RunAgentRuntimeOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const recorder = options.recorder;
  let state = createInitialAgentState(input);

  recorder?.startRun(createRun(input, startedAt));

  try {
    const router = options.router ?? routeAgentRequest;
    const route = router(state);
    state = {
      ...state,
      route,
      finalResponse: {
        markdown: createPlaceholderResponse(route, input.text),
      },
    };
    recorder?.recordStep(createStep(input.runId, 'RouterAgent', 'completed', startedAt, now(), input.text, route.name));
  } catch (error) {
    state = appendRecoverableError(state, 'RouterAgent', error);
    const route: RouterResult = {
      name: 'chat',
      confidence: 0.4,
      reason: 'RouterAgent failed; degraded to normal chat.',
      requiresRag: false,
      requiresHumanApproval: false,
    };
    state = {
      ...state,
      route,
      finalResponse: {
        markdown: `我先按普通问题回答：${input.text}`,
      },
    };
    recorder?.recordStep(
      createStep(input.runId, 'RouterAgent', 'degraded', startedAt, now(), input.text, 'route=chat'),
    );
  }

  const finishedAt = now();
  recorder?.finishRun(input.runId, {
    status: state.errors.length > 0 ? 'degraded' : 'completed',
    finishedAt: finishedAt.toISOString(),
    totalDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  });

  return { state };
}

function createRun(input: RunAgentRuntimeInput, startedAt: Date): AgentRun {
  return {
    id: input.runId,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    route: null,
    status: 'running',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    totalDurationMs: null,
    inputTokenEstimate: estimateTokens(input.text),
    outputTokenEstimate: 0,
    modelProvider: 'mock',
    modelName: 'phase-6-runtime-skeleton',
    costEstimate: 0,
  };
}

function createStep(
  runId: string,
  node: string,
  status: AgentRunStatus,
  startedAt: Date,
  finishedAt: Date,
  inputSummary: string,
  outputSummary: string,
) {
  return {
    id: `${runId}_${node}`,
    runId,
    node,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    inputSummary: summarize(inputSummary),
    outputSummary,
    errorMessage: status === 'degraded' ? outputSummary : null,
  };
}

function createPlaceholderResponse(route: RouterResult, text: string): string {
  if (route.name === 'tutor') {
    return `我们先看题目条件，再一步步拆解：${text}`;
  }

  if (route.name === 'rag_answer') {
    return `我会优先检索你的资料，再给出回答：${text}`;
  }

  if (route.name === 'study_plan') {
    return '我可以先生成学习计划建议，确认后再写入你的计划。';
  }

  return `你好，我会按当前问题回答：${text}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function summarize(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}
```

- [ ] **Step 5: Run runtime tests and typecheck**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/agent/src/recorder.ts packages/agent/src/runtime.ts packages/agent/tests/runtime.test.ts
git commit -m "feat: add agent runtime recorder"
```

---

### Task 5: Graph Entrypoint and Public Exports

**Files:**
- Modify: `packages/agent/src/graph/index.ts`
- Modify: `packages/agent/src/index.ts`
- Create: `packages/agent/tests/graph.test.ts`

- [ ] **Step 1: Add failing graph export test**

Create `packages/agent/tests/graph.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  createAgentGraph,
  createGraph,
  routeAgentRequest,
  runAgentRuntime,
  shouldRunMemoryAgent,
} from '../src/index';

describe('@repo/agent public exports', () => {
  it('exports graph and runtime entrypoints', () => {
    expect(typeof createGraph).toBe('function');
    expect(typeof createAgentGraph).toBe('function');
    expect(typeof runAgentRuntime).toBe('function');
    expect(typeof routeAgentRequest).toBe('function');
    expect(typeof shouldRunMemoryAgent).toBe('function');
  });

  it('creates a graph descriptor without executing business agents', () => {
    const graph = createAgentGraph();

    expect(graph.name).toBe('phase-6-agent-runtime');
    expect(graph.nodes).toContain('RouterAgent');
    expect(graph.nodes).toContain('FinalResponseAgent');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
bun --cwd packages/agent test
```

Expected: FAIL because graph exports do not exist yet.

- [ ] **Step 3: Implement graph descriptor and exports**

Replace `packages/agent/src/graph/index.ts`:

```ts
export type AgentGraphDescriptor = {
  name: 'phase-6-agent-runtime';
  nodes: string[];
  realtimeNodes: string[];
  thresholdNodes: string[];
};

export function createAgentGraph(): AgentGraphDescriptor {
  return {
    name: 'phase-6-agent-runtime',
    nodes: [
      'RouterAgent',
      'TutorAgent',
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
      'FinalResponseAgent',
      'WrongQuestionOrganizerAgent',
      'ReviewAgent',
      'PlannerAgent',
      'MemoryAgent',
      'KnowledgeDedupAgent',
    ],
    realtimeNodes: [
      'RouterAgent',
      'TutorAgent',
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
      'FinalResponseAgent',
    ],
    thresholdNodes: [
      'WrongQuestionOrganizerAgent',
      'ReviewAgent',
      'PlannerAgent',
      'MemoryAgent',
      'KnowledgeDedupAgent',
    ],
  };
}

export const createGraph = createAgentGraph;
```

Replace `packages/agent/src/index.ts`:

```ts
export * from './graph';
export * from './recorder';
export * from './router';
export * from './runtime';
export * from './state';
export * from './thresholds';
```

- [ ] **Step 4: Run graph tests and typecheck**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/agent/src/graph/index.ts packages/agent/src/index.ts packages/agent/tests/graph.test.ts
git commit -m "feat: expose agent graph entrypoint"
```

---

### Task 6: Live Model Acceptance Policy in Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`

- [ ] **Step 1: Add the live validation policy**

In `docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md`, update the "成本控制" section by adding this paragraph after the existing numbered list:

```md
验收阶段允许在必要时启用真实模型，但必须同时满足：

- `AI_PROVIDER_MODE=live` 与 `AI_ENABLE_LIVE_CALLS=true` 显式开启。
- 保留 `AI_MAX_INPUT_TOKENS=2500` 和 `AI_MAX_OUTPUT_TOKENS=1200` 或更低预算。
- 优先使用低成本模型，例如 `deepseek-v4-flash`。
- 每次 live 验收前明确测试用例数量，避免开放式手动长测。
- AgentRun 必须记录模型、token 估算和成本估算。
- live 验收只用于确认模型理解、讲题准确性、Verifier 判断质量和最终输出质量；普通回归测试继续使用 mock。
```

- [ ] **Step 2: Inspect docs diff**

Run:

```powershell
git diff -- docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md
```

Expected: diff only adds the live validation policy.

- [ ] **Step 3: Commit**

Run:

```powershell
git add docs/superpowers/specs/2026-06-20-phase-6-0-agent-runtime-design.md
git commit -m "docs: document phase 6 live validation policy"
```

---

### Task 7: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run shared contract tests**

Run:

```powershell
node --experimental-strip-types packages/types/tests/agent.test.mts
bun --cwd packages/types typecheck
```

Expected: PASS.

- [ ] **Step 2: Run agent package tests**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: PASS.

- [ ] **Step 3: Run existing focused package checks**

Run:

```powershell
bun --cwd packages/rag test
bun --cwd packages/fsrs test
```

Expected: PASS. These confirm the new Agent foundation did not break Phase 4/5 package behavior.

- [ ] **Step 4: Run repo status check**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on the current feature branch or `main`, with only intentional commits ahead of origin.

---

## Self-Review Checklist

- The plan implements every Phase 6.0 spec item: shared state, routing, threshold gating, action proposal contract, recorder, graph entrypoint, degradation, and cost policy.
- ReviewAgent and MemoryAgent are threshold-gated; they are not called in `runAgentRuntime`.
- Live model validation is documented as optional and budget-bounded, not part of normal automated tests.
- All write operations remain proposals; Phase 6.0 does not write wrong-question, review, knowledge, or memory facts.
- Every task has concrete files, code, commands, expected output, and a commit point.
