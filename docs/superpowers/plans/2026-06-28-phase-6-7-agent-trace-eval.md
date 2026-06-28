# Phase 6.7 Agent Trace and Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 6.7 observability for the existing multi-agent system: fixed deterministic evals, sanitized Agent Trace persistence, estimated cost dashboard, and a user-visible trace UI.

**Architecture:** Keep policy logic in `@repo/agent`, API contracts in `@repo/types`, persistence and user isolation in NestJS/PostgreSQL, and Chat trace capture in the existing Next.js `/api/chat` route. Trace writes are best-effort and must not break streaming Chat. Cost values are estimates, not billing data.

**Tech Stack:** Bun workspaces, TypeScript strict, Zod, Prisma, NestJS 11, Next.js 16, React 19, TanStack Query, Tailwind 4.

---

## Commit Discipline

The user requires a commit after each completed step. Treat each task below as one commit boundary. Before each commit, run the task-specific verification command and inspect `git diff --check`.

Recommended commit messages:

1. `feat: add agent trace contract`
2. `test: add phase 6.7 agent eval set`
3. `feat: persist agent traces`
4. `feat: record chat agent traces`
5. `feat: add agent trace dashboard`
6. `docs: document phase 6.7 agent trace delivery`

## File Map

### Types

- Create `packages/types/src/api/agent-trace.ts`: Zod schemas for trace run, trace step, create request, list query, detail response, and summary response.
- Modify `packages/types/src/api/index.ts`: export agent trace contract.
- Modify `packages/types/package.json`: add `./api/agent-trace` subpath export.
- Create `packages/types/tests/agent-trace.test.mts`: schema behavior tests.
- Create `packages/types/tests/agent-trace-runtime-import.test.mts`: runtime import guard.

### Agent Eval

- Create `packages/agent/src/evals/phase-6-7-cases.ts`: deterministic eval cases and expected structured outcomes.
- Create `packages/agent/src/evals/run-phase-6-7-evals.ts`: eval runner helpers that call existing policy functions.
- Create `packages/agent/tests/phase-6-7-eval.test.ts`: fixed regression test suite.
- Modify `packages/agent/src/index.ts`: export eval helpers only if useful to tests; otherwise keep eval imports internal to tests.

### Database and Server

- Modify `packages/database/prisma/schema.prisma`: add `AgentTraceStatus`, `AgentTraceMode`, `AgentTraceRun`, `AgentTraceStep`, and `User` relations.
- Create `packages/database/prisma/migrations/20260628010000_add_agent_traces/migration.sql`: SQL migration.
- Create `apps/server/src/agent-traces/agent-traces.module.ts`
- Create `apps/server/src/agent-traces/agent-traces.controller.ts`
- Create `apps/server/src/agent-traces/agent-traces.service.ts`
- Create `apps/server/src/agent-traces/agent-traces.service.spec.ts`
- Create `apps/server/test/agent-traces.e2e-spec.ts`
- Modify `apps/server/src/app.module.ts`: import `AgentTracesModule`.

### Web Chat Capture

- Create `apps/web/src/lib/ai-cost-estimator.ts`
- Create `apps/web/src/lib/ai-cost-estimator.test.mts`
- Create `apps/web/src/lib/agent-trace-api.ts`
- Create `apps/web/src/lib/agent-trace-api.test.mts`
- Create `apps/web/src/lib/agent-trace-payload.ts`
- Create `apps/web/src/lib/agent-trace-payload.test.mts`
- Modify `apps/web/src/app/api/chat/route.ts`: build sanitized trace payload and post it best-effort.

### Web Dashboard

- Create `apps/web/src/lib/agent-trace-query-keys.ts`
- Create `apps/web/src/lib/agent-trace-query-keys.test.mts`
- Create `apps/web/src/lib/agent-trace-view.ts`
- Create `apps/web/src/lib/agent-trace-view.test.mts`
- Create `apps/web/src/hooks/use-agent-traces.ts`
- Create `apps/web/src/app/(main)/agent-trace/page.tsx`
- Modify `apps/web/src/app/(main)/profile/page.tsx`: add Agent Trace entry.

### Docs

- Modify `AGENTS.md`
- Modify `README.md`
- Modify `docs/data-flow.md`
- Modify `docs/roadmap.md`
- Modify `docs/ai-behavior-acceptance.md`
- Modify `DEVLOG.md`

---

## Task 1: Agent Trace Type Contract

**Files:**

- Create: `packages/types/src/api/agent-trace.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Create: `packages/types/tests/agent-trace.test.mts`
- Create: `packages/types/tests/agent-trace-runtime-import.test.mts`

- [ ] **Step 1: Write the failing schema test**

Create `packages/types/tests/agent-trace.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  agentTraceCreateRequestSchema,
  agentTraceDetailResponseSchema,
  agentTraceListQuerySchema,
  agentTraceModeSchema,
  agentTraceRunSchema,
  agentTraceSummaryQuerySchema,
  agentTraceSummaryResponseSchema,
  agentTraceStepSchema,
} from '../src/api/agent-trace.ts';

testEnums();
testQueryDefaults();
testRunAndStepPayloads();
testCreateRequestSanity();
testSummaryPayload();

function testEnums() {
  assert.equal(agentTraceModeSchema.parse('mock'), 'mock');
  assert.equal(agentTraceModeSchema.parse('live'), 'live');
  assert.throws(() => agentTraceModeSchema.parse('sandbox'));
}

function testQueryDefaults() {
  assert.deepEqual(agentTraceListQuerySchema.parse({}), { limit: 20 });
  assert.deepEqual(agentTraceListQuerySchema.parse({ limit: '5', mode: 'live' }), {
    limit: 5,
    mode: 'live',
  });
  assert.deepEqual(agentTraceSummaryQuerySchema.parse({}), { days: 7 });
  assert.throws(() => agentTraceListQuerySchema.parse({ limit: 0 }));
  assert.throws(() => agentTraceSummaryQuerySchema.parse({ days: 31 }));
}

function testRunAndStepPayloads() {
  const run = agentTraceRunSchema.parse({
    id: 'run_1',
    userId: 'user_1',
    conversationId: 'conversation_1',
    route: 'tutor',
    confidence: 0.86,
    status: 'completed',
    mode: 'mock',
    modelProvider: 'mock',
    modelName: 'mock-prepmind-chat',
    inputTokenEstimate: 120,
    outputTokenEstimate: 240,
    maxOutputTokens: 1200,
    pricingKnown: true,
    costEstimate: 0,
    ragHitCount: 0,
    verifierStatus: 'skipped',
    verifierChunkCount: 0,
    tutorIntent: 'socratic_hint',
    tutorDepth: 'guided',
    degraded: false,
    inputHash: 'hash_1',
    inputPreview: '这道题给我一点提示',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:01.000Z',
    totalDurationMs: 1000,
    createdAt: '2026-06-28T00:00:01.000Z',
    updatedAt: '2026-06-28T00:00:01.000Z',
  });

  const step = agentTraceStepSchema.parse({
    id: 'step_1',
    runId: run.id,
    node: 'RouterAgent',
    status: 'completed',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:00.010Z',
    durationMs: 10,
    inputSummary: '用户请求讲题提示',
    outputSummary: 'route=tutor confidence=0.86',
    errorMessage: null,
  });

  assert.equal(run.route, 'tutor');
  assert.equal(step.node, 'RouterAgent');
  assert.deepEqual(agentTraceDetailResponseSchema.parse({ run, steps: [step] }).steps, [step]);
}

function testCreateRequestSanity() {
  const parsed = agentTraceCreateRequestSchema.parse({
    runId: 'run_1',
    conversationId: null,
    route: 'rag_answer',
    confidence: 0.91,
    status: 'degraded',
    mode: 'live',
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: 0.0034,
    ragHitCount: 2,
    verifierStatus: 'suspicious',
    verifierChunkCount: 2,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:02.000Z',
    totalDurationMs: 2000,
    steps: [
      {
        node: 'RouterAgent',
        status: 'completed',
        startedAt: '2026-06-28T00:00:00.000Z',
        finishedAt: '2026-06-28T00:00:00.020Z',
        durationMs: 20,
        inputSummary: '资料型问题',
        outputSummary: 'route=rag_answer',
        errorMessage: null,
      },
    ],
  });

  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.verifierStatus, 'suspicious');
  assert.throws(() => agentTraceCreateRequestSchema.parse({ ...parsed, costEstimate: -1 }));
  assert.throws(() =>
    agentTraceCreateRequestSchema.parse({
      ...parsed,
      steps: [
        {
          ...parsed.steps[0]!,
          inputSummary: 'x'.repeat(161),
        },
      ],
    }),
  );
}

function testSummaryPayload() {
  const summary = agentTraceSummaryResponseSchema.parse({
    days: 7,
    totalRuns: 4,
    liveRuns: 1,
    mockRuns: 3,
    degradedRuns: 1,
    failedRuns: 0,
    totalInputTokens: 1000,
    totalOutputTokens: 2400,
    totalCostEstimate: 0.0042,
    lastRunAt: '2026-06-28T00:00:02.000Z',
    routeBreakdown: [{ route: 'tutor', count: 2 }],
    verifierBreakdown: [{ status: 'trusted', count: 1 }],
  });

  assert.equal(summary.totalRuns, 4);
  assert.equal(summary.routeBreakdown[0]?.route, 'tutor');
}
```

- [ ] **Step 2: Write the failing runtime import test**

Create `packages/types/tests/agent-trace-runtime-import.test.mts`:

```ts
const traceModule = await import('../src/api/agent-trace.ts');

if (typeof traceModule.agentTraceRunSchema?.parse !== 'function') {
  throw new Error('agentTraceRunSchema should be available at runtime');
}

if (typeof traceModule.agentTraceCreateRequestSchema?.parse !== 'function') {
  throw new Error('agentTraceCreateRequestSchema should be available at runtime');
}
```

- [ ] **Step 3: Run tests to confirm they fail**

Run:

```powershell
bun test packages/types/tests/agent-trace.test.mts packages/types/tests/agent-trace-runtime-import.test.mts
```

Expected: FAIL because `packages/types/src/api/agent-trace.ts` does not exist.

- [ ] **Step 4: Add the Agent Trace contract**

Create `packages/types/src/api/agent-trace.ts` with schemas matching the design doc:

```ts
import { z } from 'zod';

import { agentRouteSchema } from '@repo/types/api/agent';

export const agentTraceStatusSchema = z.enum(['completed', 'failed', 'degraded']);
export const agentTraceModeSchema = z.enum(['mock', 'live']);
export const agentTraceVerifierStatusSchema = z.enum([
  'trusted',
  'suspicious',
  'conflict',
  'insufficient',
  'skipped',
]);

export const agentTraceStepSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  node: z.string().min(1),
  status: agentTraceStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().min(0).nullable(),
  inputSummary: z.string().max(160),
  outputSummary: z.string().max(160),
  errorMessage: z.string().max(240).nullable(),
});

export const createAgentTraceStepRequestSchema = agentTraceStepSchema.omit({
  id: true,
  runId: true,
});

export const agentTraceRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).nullable(),
  route: agentRouteSchema.nullable(),
  confidence: z.number().min(0).max(1),
  status: agentTraceStatusSchema,
  mode: agentTraceModeSchema,
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  inputTokenEstimate: z.number().int().min(0),
  outputTokenEstimate: z.number().int().min(0),
  maxOutputTokens: z.number().int().min(0),
  pricingKnown: z.boolean(),
  costEstimate: z.number().min(0),
  ragHitCount: z.number().int().min(0),
  verifierStatus: agentTraceVerifierStatusSchema.optional(),
  verifierChunkCount: z.number().int().min(0),
  tutorIntent: z.string().min(1).optional(),
  tutorDepth: z.string().min(1).optional(),
  degraded: z.boolean(),
  inputHash: z.string().min(1).optional(),
  inputPreview: z.string().max(80).optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  totalDurationMs: z.number().int().min(0).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentTraceCreateRequestSchema = agentTraceRunSchema
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    runId: z.string().min(1).optional(),
    steps: z.array(createAgentTraceStepRequestSchema).max(20),
  });

export const agentTraceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  route: agentRouteSchema.optional(),
  mode: agentTraceModeSchema.optional(),
  status: agentTraceStatusSchema.optional(),
});

export const agentTraceSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const agentTraceListResponseSchema = z.object({
  runs: z.array(agentTraceRunSchema),
});

export const agentTraceDetailResponseSchema = z.object({
  run: agentTraceRunSchema,
  steps: z.array(agentTraceStepSchema),
});

export const agentTraceSummaryResponseSchema = z.object({
  days: z.number().int().min(1).max(30),
  totalRuns: z.number().int().min(0),
  liveRuns: z.number().int().min(0),
  mockRuns: z.number().int().min(0),
  degradedRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalCostEstimate: z.number().min(0),
  lastRunAt: z.string().datetime().nullable(),
  routeBreakdown: z.array(z.object({ route: agentRouteSchema, count: z.number().int().min(0) })),
  verifierBreakdown: z.array(
    z.object({ status: agentTraceVerifierStatusSchema, count: z.number().int().min(0) }),
  ),
});

export type AgentTraceStatus = z.infer<typeof agentTraceStatusSchema>;
export type AgentTraceMode = z.infer<typeof agentTraceModeSchema>;
export type AgentTraceRun = z.infer<typeof agentTraceRunSchema>;
export type AgentTraceStep = z.infer<typeof agentTraceStepSchema>;
export type AgentTraceCreateRequest = z.infer<typeof agentTraceCreateRequestSchema>;
export type AgentTraceListQuery = z.infer<typeof agentTraceListQuerySchema>;
export type AgentTraceSummaryQuery = z.infer<typeof agentTraceSummaryQuerySchema>;
export type AgentTraceListResponse = z.infer<typeof agentTraceListResponseSchema>;
export type AgentTraceDetailResponse = z.infer<typeof agentTraceDetailResponseSchema>;
export type AgentTraceSummaryResponse = z.infer<typeof agentTraceSummaryResponseSchema>;
```

Modify `packages/types/src/api/index.ts`:

```ts
export * from './agent-trace';
```

Modify `packages/types/package.json` exports:

```json
"./api/agent-trace": "./src/api/agent-trace.ts"
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun test packages/types/tests/agent-trace.test.mts packages/types/tests/agent-trace-runtime-import.test.mts
bun --cwd packages/types typecheck
git diff --check
git add packages/types/src/api/agent-trace.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/agent-trace.test.mts packages/types/tests/agent-trace-runtime-import.test.mts
git commit -m "feat: add agent trace contract"
```

Expected: tests and typecheck pass.

---

## Task 2: Fixed Phase 6.7 Agent Eval Set

**Files:**

- Create: `packages/agent/src/evals/phase-6-7-cases.ts`
- Create: `packages/agent/src/evals/run-phase-6-7-evals.ts`
- Create: `packages/agent/tests/phase-6-7-eval.test.ts`

- [ ] **Step 1: Create deterministic eval cases**

Create `packages/agent/src/evals/phase-6-7-cases.ts`:

```ts
import type { AgentRoute } from '@repo/types/api/agent';
import type { ReviewAgentInput } from '@repo/types/api/review-agent';

export type Phase67EvalCase =
  | {
      kind: 'router';
      name: string;
      input: string;
      expectedRoute: AgentRoute;
      requiresRag?: boolean;
    }
  | {
      kind: 'tutor';
      name: string;
      latestUserText: string;
      activeStudyContext?: string;
      expectedIntent: string;
    }
  | {
      kind: 'verifier';
      name: string;
      query: string;
      chunks: Array<{
        documentId: string;
        documentTitle: string;
        chunkId: string;
        content: string;
        score: number;
      }>;
      expectedStatus: string;
    }
  | {
      kind: 'organizer';
      name: string;
      wrongQuestion: {
        id: string;
        subject?: string;
        category?: string;
        knowledgePoints?: string[];
        errorType?: string;
        questionText?: string;
      };
      expectedSubjectKey: string;
      expectedDeckName: string;
    }
  | {
      kind: 'review';
      name: string;
      input: ReviewAgentInput;
      expectedPriority: string;
      expectedSignal: string;
    }
  | {
      kind: 'planner';
      name: string;
      expectedSignal: string;
      expectedCapacityNotice: boolean;
    }
  | {
      kind: 'memory';
      name: string;
      expectedType: string;
      explicitPreferenceText: string;
    };

export const phase67EvalCases: Phase67EvalCase[] = [
  {
    kind: 'router',
    name: 'routes normal greeting to chat',
    input: '你好，今天适合复习什么？',
    expectedRoute: 'chat',
  },
  {
    kind: 'router',
    name: 'routes solution question to tutor',
    input: '这道导数题为什么要先求单调区间？',
    expectedRoute: 'tutor',
  },
  {
    kind: 'router',
    name: 'routes document grounded question to rag',
    input: '根据我上传的线代讲义，解释矩阵秩的定义。',
    expectedRoute: 'rag_answer',
    requiresRag: true,
  },
  {
    kind: 'tutor',
    name: 'classifies hint request',
    latestUserText: '先别给答案，给我一点提示。',
    activeStudyContext: '已知函数 f(x)=x^2-2x，求最小值。',
    expectedIntent: 'socratic_hint',
  },
  {
    kind: 'tutor',
    name: 'classifies full solution request',
    latestUserText: '请给我完整解法和每一步原因。',
    expectedIntent: 'explain_solution',
  },
  {
    kind: 'verifier',
    name: 'trusts useful high-score retrieved chunks',
    query: '矩阵秩是什么？',
    chunks: [
      {
        documentId: 'doc_1',
        documentTitle: '线代讲义',
        chunkId: 'chunk_1',
        content: '矩阵的秩是矩阵行向量组或列向量组的最大线性无关组所含向量个数。',
        score: 0.91,
      },
    ],
    expectedStatus: 'trusted',
  },
  {
    kind: 'organizer',
    name: 'organizes math derivative wrong question',
    wrongQuestion: {
      id: 'wrong_eval_1',
      subject: '数学',
      category: '函数与导数',
      knowledgePoints: ['导数应用'],
      errorType: '审题错误',
      questionText: '已知函数单调性，求参数范围。',
    },
    expectedSubjectKey: '数学',
    expectedDeckName: '导数应用',
  },
  {
    kind: 'review',
    name: 'flags high review pressure',
    input: {
      now: '2026-06-28T00:00:00.000Z',
      weakKnowledgePoints: [
        {
          label: '导数应用',
          subject: '数学',
          deckName: '导数应用',
          wrongCount: 6,
          recentAgainCount: 3,
          averageDifficulty: 4.6,
          averageStability: 1.8,
        },
      ],
      cardSummary: {
        dueCount: 8,
        overdueCount: 5,
        highDifficultyCount: 4,
        lowStabilityCount: 5,
      },
      recentReviewSummary: {
        totalReviews: 12,
        againCount: 3,
        hardCount: 4,
        goodCount: 4,
        easyCount: 1,
      },
    },
    expectedPriority: 'high',
    expectedSignal: 'overdue',
  },
  {
    kind: 'planner',
    name: 'suggests capacity relief when plan is over capacity',
    expectedSignal: 'capacityOver',
    expectedCapacityNotice: true,
  },
  {
    kind: 'memory',
    name: 'extracts explanation preference',
    explicitPreferenceText: '以后讲题时请先给我提示，再给完整答案。',
    expectedType: 'EXPLANATION_PREFERENCE',
  },
];
```

- [ ] **Step 2: Write eval runner helpers**

Create `packages/agent/src/evals/run-phase-6-7-evals.ts`:

```ts
import { routeAgentRequest } from '../router';
import { createInitialAgentState } from '../state';
import { buildTutorStrategy } from '../nodes/tutor';
import { verifyKnowledgeChunks } from '../nodes/knowledge-verifier';
import { organizeWrongQuestion } from '../nodes/wrong-question-organizer';
import { analyzeReview } from '../nodes/review';
import { planStudy } from '../nodes/planner';
import { analyzeMemory } from '../nodes/memory';
import type { Phase67EvalCase } from './phase-6-7-cases';

export type Phase67EvalResult = {
  name: string;
  passed: boolean;
  detail: string;
};

export function runPhase67EvalCase(testCase: Phase67EvalCase): Phase67EvalResult {
  if (testCase.kind === 'router') {
    const result = routeAgentRequest(
      createInitialAgentState({
        runId: `eval_${slug(testCase.name)}`,
        userId: 'eval_user',
        text: testCase.input,
      }),
    );
    const routeMatches = result.name === testCase.expectedRoute;
    const ragMatches =
      typeof testCase.requiresRag === 'boolean'
        ? result.requiresRag === testCase.requiresRag
        : true;
    return {
      name: testCase.name,
      passed: routeMatches && ragMatches,
      detail: `route=${result.name} requiresRag=${result.requiresRag}`,
    };
  }

  if (testCase.kind === 'tutor') {
    const result = buildTutorStrategy({
      latestUserText: testCase.latestUserText,
      activeStudyContext: testCase.activeStudyContext,
    });
    return {
      name: testCase.name,
      passed: result.intent === testCase.expectedIntent,
      detail: `intent=${result.intent} depth=${result.depth}`,
    };
  }

  if (testCase.kind === 'verifier') {
    const result = verifyKnowledgeChunks({
      query: testCase.query,
      chunks: testCase.chunks,
    });
    return {
      name: testCase.name,
      passed: result.status === testCase.expectedStatus,
      detail: `status=${result.status} checked=${result.debug.checkedChunkCount}`,
    };
  }

  if (testCase.kind === 'organizer') {
    const result = organizeWrongQuestion({
      wrongQuestion: testCase.wrongQuestion,
    });
    return {
      name: testCase.name,
      passed:
        result.subjectKey === testCase.expectedSubjectKey &&
        result.deckName === testCase.expectedDeckName,
      detail: `subject=${result.subjectKey} deck=${result.deckName}`,
    };
  }

  if (testCase.kind === 'review') {
    const result = analyzeReview(testCase.input);
    return {
      name: testCase.name,
      passed:
        result.priority === testCase.expectedPriority &&
        result.signals.includes(testCase.expectedSignal),
      detail: `priority=${result.priority} signals=${result.signals.join(',')}`,
    };
  }

  if (testCase.kind === 'planner') {
    const result = planStudy(createPlannerOverCapacityInput());
    return {
      name: testCase.name,
      passed:
        result.signals.includes(testCase.expectedSignal) &&
        Boolean(result.capacityNotice) === testCase.expectedCapacityNotice,
      detail: `signals=${result.signals.join(',')} capacityNotice=${Boolean(result.capacityNotice)}`,
    };
  }

  const result = analyzeMemory({
    now: '2026-06-28T00:00:00.000Z',
    recentChatSignals: [
      {
        conversationId: 'conversation_eval_1',
        messageId: 'chat_eval_1',
        text: testCase.explicitPreferenceText,
        createdAt: '2026-06-28T00:00:00.000Z',
      },
    ],
    weakPointSignals: [],
    reviewSignals: {
      consecutiveActiveDays: 0,
      totalReviewsInWindow: 0,
    },
    existingMemories: [],
  });
  return {
    name: testCase.name,
    passed: result.candidates.some((candidate) => candidate.type === testCase.expectedType),
    detail: `candidates=${result.candidates.map((candidate) => candidate.type).join(',')}`,
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function createPlannerOverCapacityInput(): Parameters<typeof planStudy>[0] {
  const review = analyzeReview({
    now: '2026-06-28T00:00:00.000Z',
    weakKnowledgePoints: [],
    cardSummary: {
      dueCount: 0,
      overdueCount: 0,
      highDifficultyCount: 0,
      lowStabilityCount: 0,
    },
    recentReviewSummary: {
      totalReviews: 4,
      againCount: 0,
      hardCount: 0,
      goodCount: 4,
      easyCount: 0,
    },
  });

  return {
    review,
    plan: {
      startDate: '2026-06-28',
      endDate: '2026-07-04',
      generatedThroughDate: '2026-07-04',
      summary: {
        overdueCount: 0,
        todayDueCount: 0,
        upcomingDueCount: 42,
        estimatedTotalMinutes: 180,
        peakDay: {
          date: '2026-06-30',
          count: 18,
        },
        intensity: 'heavy',
        capacityStatus: 'over',
        dailyMinutes: 30,
        dailyCardLimit: 20,
      },
      days: [
        {
          date: '2026-06-30',
          label: '周二',
          dueCount: 18,
          overdueCount: 0,
          pendingCount: 18,
          completedCount: 0,
          skippedCount: 0,
          estimatedMinutes: 72,
          intensity: 'heavy',
          pressureScore: 72,
          capacityStatus: 'over',
          reasons: ['到期卡片较多'],
        },
      ],
      suggestion: {
        title: '未来复习压力偏高',
        description: '建议提前拆分高峰日任务。',
        actionLabel: '查看计划',
        actionHref: '/plan',
      },
    },
    preference: {
      dailyMinutes: 30,
      dailyCardLimit: 20,
      preferredReviewTime: '20:00',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      weekendMode: 'same',
      planWindowDays: 7,
      updatedAt: '2026-06-28T00:00:00.000Z',
    },
  };
}
```

- [ ] **Step 3: Write the eval regression test**

Create `packages/agent/tests/phase-6-7-eval.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { phase67EvalCases } from '../src/evals/phase-6-7-cases';
import { runPhase67EvalCase } from '../src/evals/run-phase-6-7-evals';

describe('Phase 6.7 fixed agent eval set', () => {
  for (const testCase of phase67EvalCases) {
    it(testCase.name, () => {
      const result = runPhase67EvalCase(testCase);
      expect(result.passed, result.detail).toBe(true);
    });
  }
});
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
git diff --check
git add packages/agent/src/evals packages/agent/tests/phase-6-7-eval.test.ts
git commit -m "test: add phase 6.7 agent eval set"
```

Expected: all `@repo/agent` tests and typecheck pass.

---

## Task 3: Database and Server Agent Trace API

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260628010000_add_agent_traces/migration.sql`
- Create: `apps/server/src/agent-traces/agent-traces.module.ts`
- Create: `apps/server/src/agent-traces/agent-traces.controller.ts`
- Create: `apps/server/src/agent-traces/agent-traces.service.ts`
- Create: `apps/server/src/agent-traces/agent-traces.service.spec.ts`
- Create: `apps/server/test/agent-traces.e2e-spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Add Prisma schema and migration**

Add to `User` in `packages/database/prisma/schema.prisma`:

```prisma
agentTraceRuns  AgentTraceRun[]
agentTraceSteps AgentTraceStep[]
```

Add enums and models from `docs/superpowers/specs/2026-06-28-phase-6-7-agent-trace-eval-design.md`.

Create `packages/database/prisma/migrations/20260628010000_add_agent_traces/migration.sql`:

```sql
CREATE TYPE "AgentTraceStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'DEGRADED');
CREATE TYPE "AgentTraceMode" AS ENUM ('MOCK', 'LIVE');

CREATE TABLE "AgentTraceRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT,
  "route" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "AgentTraceStatus" NOT NULL DEFAULT 'COMPLETED',
  "mode" "AgentTraceMode" NOT NULL,
  "modelProvider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "inputTokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "outputTokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "maxOutputTokens" INTEGER NOT NULL DEFAULT 0,
  "pricingKnown" BOOLEAN NOT NULL DEFAULT true,
  "costEstimate" DECIMAL(12, 6) NOT NULL DEFAULT 0,
  "ragHitCount" INTEGER NOT NULL DEFAULT 0,
  "verifierStatus" TEXT,
  "verifierChunkCount" INTEGER NOT NULL DEFAULT 0,
  "tutorIntent" TEXT,
  "tutorDepth" TEXT,
  "degraded" BOOLEAN NOT NULL DEFAULT false,
  "inputHash" TEXT,
  "inputPreview" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "totalDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentTraceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentTraceStep" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "node" TEXT NOT NULL,
  "status" "AgentTraceStatus" NOT NULL DEFAULT 'COMPLETED',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "inputSummary" TEXT NOT NULL,
  "outputSummary" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentTraceStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentTraceRun_id_userId_key" ON "AgentTraceRun"("id", "userId");
CREATE INDEX "AgentTraceRun_userId_createdAt_idx" ON "AgentTraceRun"("userId", "createdAt");
CREATE INDEX "AgentTraceRun_userId_route_createdAt_idx" ON "AgentTraceRun"("userId", "route", "createdAt");
CREATE INDEX "AgentTraceRun_userId_mode_createdAt_idx" ON "AgentTraceRun"("userId", "mode", "createdAt");
CREATE INDEX "AgentTraceStep_userId_runId_idx" ON "AgentTraceStep"("userId", "runId");
CREATE INDEX "AgentTraceStep_userId_node_createdAt_idx" ON "AgentTraceStep"("userId", "node", "createdAt");

ALTER TABLE "AgentTraceRun" ADD CONSTRAINT "AgentTraceRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTraceStep" ADD CONSTRAINT "AgentTraceStep_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTraceStep" ADD CONSTRAINT "AgentTraceStep_runId_userId_fkey"
  FOREIGN KEY ("runId", "userId") REFERENCES "AgentTraceRun"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 2: Write service tests first**

Create `apps/server/src/agent-traces/agent-traces.service.spec.ts` with tests for:

```ts
it('creates a trace run with sanitized preview and steps', async () => {});
it('upserts by runId for the same user and replaces steps', async () => {});
it('lists only current user traces', async () => {});
it('returns summary with route and verifier breakdown', async () => {});
it('rejects detail lookup for another user trace', async () => {});
```

Use the same Prisma mock pattern used by existing service specs in `apps/server/src/memory-agent/memory-agent.service.spec.ts`.

- [ ] **Step 3: Implement service and controller**

Create `apps/server/src/agent-traces/agent-traces.service.ts` with public methods:

```ts
createTrace(userId: string, input: AgentTraceCreateRequest): Promise<AgentTraceDetailResponse>
listTraces(userId: string, query: AgentTraceListQuery): Promise<AgentTraceListResponse>
getTrace(userId: string, id: string): Promise<AgentTraceDetailResponse>
getSummary(userId: string, query: AgentTraceSummaryQuery): Promise<AgentTraceSummaryResponse>
```

Required behavior:

- Map lowercase API status to uppercase Prisma enum.
- Map lowercase API mode to uppercase Prisma enum.
- Truncate `inputPreview` to 80 characters in service even if the client already did it.
- Sanitize and truncate `inputSummary` / `outputSummary` to 160 characters and `errorMessage` to 240 characters in service even if the client already did it.
- Strip obvious sensitive markers from summaries, including `DEEPSEEK_API_KEY=...`, `OPENAI_API_KEY=...`, `Authorization: Bearer ...`, and `Cookie: ...`.
- Convert Prisma Decimal `costEstimate` to number in response mapper and preserve `pricingKnown` in every run response.
- In `createTrace`, wrap run upsert and step replacement in `prisma.$transaction`.
- In `getTrace`, query by `{ id, userId }` and throw `NotFoundException` if missing.
- In `getSummary`, use `createdAt >= now - days` and aggregate in TypeScript after fetching selected rows.

Create `apps/server/src/agent-traces/agent-traces.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  agentTraceCreateRequestSchema,
  agentTraceListQuerySchema,
  agentTraceSummaryQuerySchema,
} from '@repo/types/api/agent-trace';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgentTracesService } from './agent-traces.service';

@Controller('agent-traces')
@UseGuards(JwtAuthGuard)
export class AgentTracesController {
  constructor(private readonly agentTracesService: AgentTracesService) {}

  @Post()
  createTrace(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.agentTracesService.createTrace(
      user.id,
      agentTraceCreateRequestSchema.parse(body),
    );
  }

  @Get()
  listTraces(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.listTraces(
      user.id,
      agentTraceListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.getSummary(
      user.id,
      agentTraceSummaryQuerySchema.parse(query),
    );
  }

  @Get(':id')
  getTrace(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentTracesService.getTrace(user.id, id);
  }
}
```

Create `apps/server/src/agent-traces/agent-traces.module.ts` and import it in `AppModule`.

- [ ] **Step 4: Add e2e coverage**

Create `apps/server/test/agent-traces.e2e-spec.ts`:

- Register/login user A.
- POST `/agent-traces` with one run and one step.
- GET `/agent-traces` and parse with `agentTraceListResponseSchema`.
- GET `/agent-traces/summary` and parse with `agentTraceSummaryResponseSchema`.
- GET `/agent-traces/:id` and parse with `agentTraceDetailResponseSchema`.
- Register/login user B and assert user B cannot GET user A run id.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --cwd packages/database test
bun --filter @repo/server test -- agent-traces.service.spec.ts
bun --filter @repo/server build
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server test:e2e -- agent-traces.e2e-spec.ts
git diff --check
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260628010000_add_agent_traces/migration.sql apps/server/src/agent-traces apps/server/test/agent-traces.e2e-spec.ts apps/server/src/app.module.ts
git commit -m "feat: persist agent traces"
```

Expected: database tests, server unit test, server build, and agent trace e2e pass.

---

## Task 4: Web Chat Trace Capture and Cost Estimation

**Files:**

- Create: `apps/web/src/lib/ai-cost-estimator.ts`
- Create: `apps/web/src/lib/ai-cost-estimator.test.mts`
- Create: `apps/web/src/lib/agent-trace-api.ts`
- Create: `apps/web/src/lib/agent-trace-api.test.mts`
- Create: `apps/web/src/lib/agent-trace-payload.ts`
- Create: `apps/web/src/lib/agent-trace-payload.test.mts`
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Add cost estimator tests and implementation**

Create `apps/web/src/lib/ai-cost-estimator.test.mts`:

```ts
import assert from 'node:assert/strict';

import { estimateAiCost, resolveModelPricing } from './ai-cost-estimator.ts';

assert.deepEqual(resolveModelPricing('mock-prepmind-chat'), {
  inputPerMillion: 0,
  outputPerMillion: 0,
  known: true,
});

assert.equal(resolveModelPricing('unknown-model').known, false);

assert.equal(
  estimateAiCost({
    model: 'mock-prepmind-chat',
    inputTokens: 1000,
    outputTokens: 2000,
  }).totalCostEstimate,
  0,
);
```

Create `apps/web/src/lib/ai-cost-estimator.ts`:

```ts
export type AiModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  known: boolean;
};

export type EstimateAiCostInput = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const MODEL_PRICING: Record<string, Omit<AiModelPricing, 'known'>> = {
  'mock-prepmind-chat': { inputPerMillion: 0, outputPerMillion: 0 },
};

export function resolveModelPricing(model: string): AiModelPricing {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return { inputPerMillion: 0, outputPerMillion: 0, known: false };
  }
  return { ...pricing, known: true };
}

export function estimateAiCost(input: EstimateAiCostInput) {
  const pricing = resolveModelPricing(input.model);
  const inputTokens = Math.max(0, Math.trunc(input.inputTokens));
  const outputTokens = Math.max(0, Math.trunc(input.outputTokens));
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    pricingKnown: pricing.known,
    inputCostEstimate: roundCost(inputCost),
    outputCostEstimate: roundCost(outputCost),
    totalCostEstimate: roundCost(inputCost + outputCost),
  };
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
```

- [ ] **Step 2: Add trace API client and payload builder**

Create `apps/web/src/lib/agent-trace-api.ts` with `createAgentTraceApi(client).createTrace(accessToken, body)` that validates `agentTraceCreateRequestSchema`.

Create `apps/web/src/lib/agent-trace-payload.ts` with:

```ts
export function createInputHash(text: string): string
export function createInputPreview(text: string): string
export function buildChatAgentTracePayload(input: BuildChatAgentTracePayloadInput): AgentTraceCreateRequest
```

Behavior:

- `createInputPreview` trims whitespace and returns at most 80 characters.
- Step summaries must be sanitized and capped at 160 characters; error summaries must be sanitized and capped at 240 characters.
- `createInputHash` uses `crypto.subtle.digest('SHA-256')` if available and falls back to a deterministic non-cryptographic hash for tests.
- `buildChatAgentTracePayload` includes RouterAgent step, optional TutorAgent step, optional KnowledgeVerifierAgent step, mode/model/token/cost/rag metadata, and `degraded=true` when agent decision or verifier failed degraded.

- [ ] **Step 3: Wire trace capture into `/api/chat`**

Modify `apps/web/src/app/api/chat/route.ts`:

- Generate one `runId` before `buildChatAgentDecision`.
- Pass that `runId` into `buildChatAgentDecision`.
- After `budget` is finalized, build trace payload.
- If `accessToken` is present, call `recordAgentTraceSafely(accessToken, payload)`.
- Add response header `x-prepmind-agent-trace-recorded` as `true` or `false`.
- Keep Chat response behavior unchanged when trace recording fails.

`recordAgentTraceSafely` should use a short timeout through `AbortController`, catch errors, log `console.warn('[AgentTrace]', error)`, and return false.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web build
git diff --check
git add apps/web/src/lib/ai-cost-estimator.ts apps/web/src/lib/ai-cost-estimator.test.mts apps/web/src/lib/agent-trace-api.ts apps/web/src/lib/agent-trace-api.test.mts apps/web/src/lib/agent-trace-payload.ts apps/web/src/lib/agent-trace-payload.test.mts apps/web/src/app/api/chat/route.ts
git commit -m "feat: record chat agent traces"
```

Expected: web tests and build pass.

---

## Task 5: Agent Trace Dashboard UI

**Files:**

- Create: `apps/web/src/lib/agent-trace-query-keys.ts`
- Create: `apps/web/src/lib/agent-trace-query-keys.test.mts`
- Create: `apps/web/src/lib/agent-trace-view.ts`
- Create: `apps/web/src/lib/agent-trace-view.test.mts`
- Create: `apps/web/src/hooks/use-agent-traces.ts`
- Create: `apps/web/src/app/(main)/agent-trace/page.tsx`
- Modify: `apps/web/src/app/(main)/profile/page.tsx`

- [ ] **Step 1: Add view model tests**

Create `apps/web/src/lib/agent-trace-view.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  formatAgentTraceCost,
  formatAgentTraceDuration,
  formatAgentTracePricingStatus,
  getAgentTraceModeLabel,
  getAgentTraceStatusLabel,
} from './agent-trace-view.ts';

assert.equal(getAgentTraceModeLabel('mock'), 'Mock');
assert.equal(getAgentTraceModeLabel('live'), 'Live');
assert.equal(getAgentTraceStatusLabel('completed'), '已完成');
assert.equal(getAgentTraceStatusLabel('degraded'), '已降级');
assert.equal(formatAgentTraceDuration(1234), '1.23s');
assert.equal(formatAgentTraceDuration(null), '未知');
assert.equal(formatAgentTraceCost(0), '0');
assert.equal(formatAgentTraceCost(0.004321), '0.004321');
assert.equal(formatAgentTracePricingStatus(true), '已配置单价');
assert.equal(formatAgentTracePricingStatus(false), '未配置单价');
```

Create `apps/web/src/lib/agent-trace-query-keys.test.mts` with stable key assertions for `list`, `summary`, and `detail`.

- [ ] **Step 2: Implement API hook**

Create `apps/web/src/hooks/use-agent-traces.ts` using existing auth/token patterns from `use-review-agent-suggestions.ts` and `use-memory-agent.ts`.

Expose:

```ts
useAgentTraceSummary(days: number)
useAgentTraceRuns(limit: number)
useAgentTraceDetail(runId: string | null)
```

All hooks should be disabled when no access token exists.

- [ ] **Step 3: Create `/agent-trace` page**

Create `apps/web/src/app/(main)/agent-trace/page.tsx`.

UI requirements:

- Sticky mobile header with back link to `/profile`.
- Summary band with four metrics: run count, live count, estimated cost, degraded/failed count.
- Recent run list with route, mode, status, model, token estimate, cost estimate, and timestamp.
- Unknown model pricing must show “未配置单价” next to the estimate, not a plain real-cost-looking `0`.
- Expand selected run inline to show steps.
- Empty state: “暂无 Agent Trace” and a link back to Chat.
- Error state: “Agent Trace 加载失败，请稍后重试”。
- Loading state uses fixed-height skeleton blocks to avoid layout jump.

- [ ] **Step 4: Add profile entry**

Modify `apps/web/src/app/(main)/profile/page.tsx`:

- Import a suitable lucide icon such as `Activity`.
- Add one tap target linking to `/agent-trace`.
- Label: `Agent 调试台`
- Supporting text: `查看路由、降级和估算成本`

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web build
git diff --check
git add apps/web/src/lib/agent-trace-query-keys.ts apps/web/src/lib/agent-trace-query-keys.test.mts apps/web/src/lib/agent-trace-view.ts apps/web/src/lib/agent-trace-view.test.mts apps/web/src/hooks/use-agent-traces.ts "apps/web/src/app/(main)/agent-trace/page.tsx" "apps/web/src/app/(main)/profile/page.tsx"
git commit -m "feat: add agent trace dashboard"
```

Expected: web tests and build pass. If Playwright smoke is available, open `/agent-trace` at desktop and 390px mobile after logging in and confirm no horizontal overflow.

---

## Task 6: Documentation, Full Verification, and Push-Ready State

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update docs**

After Tasks 1 through 5 are implemented and verified, update docs with these facts:

- Phase 6.7 is complete at that point: Agent Trace UI, estimated cost dashboard, and fixed deterministic eval set.
- Trace stores sanitized metadata only; it does not store full prompt, full response, full RAG chunk, or API keys.
- `/agent-traces` is an online account-level API and does not enter Dexie `mutationQueue`.
- `/api/chat` writes Trace best-effort when access token exists; failure does not break streaming.
- Cost dashboard is estimated and does not replace provider billing.
- Next phase remains Phase 7: BullMQ background tasks, event bus, and production engineering.

- [ ] **Step 2: Run final verification**

Run:

```powershell
bun test packages/types/tests/agent-trace.test.mts packages/types/tests/agent-trace-runtime-import.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/database test
bun --filter @repo/server test -- agent-traces.service.spec.ts
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web build
$env:DATABASE_URL='postgresql://prepmind:devpass@127.0.0.1:5433/prepmind'
$env:JWT_SECRET='dev-secret-change-me'
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server test:e2e
rg -n "Phase 6\\.7|Agent Trace|agent-traces|估算成本|fixed deterministic eval" AGENTS.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
```

Expected:

- All focused unit tests pass.
- Server and web builds pass.
- Full server e2e passes with Docker PostgreSQL.
- Documentation search finds Phase 6.7 references.
- `git diff --check` exits 0.

- [ ] **Step 3: Commit docs**

Run:

```powershell
git add AGENTS.md README.md docs/data-flow.md docs/roadmap.md docs/ai-behavior-acceptance.md DEVLOG.md
git commit -m "docs: document phase 6.7 agent trace delivery"
```

- [ ] **Step 4: Final status**

Run:

```powershell
git status --short --branch
git log --oneline -6
```

Expected: working tree clean and latest commits correspond to the task boundaries above.

---

## Self-Review Checklist

- Spec coverage: The plan implements fixed evals, trace persistence, chat trace capture, cost estimation, dashboard UI, and docs closeout.
- Scope control: Phase 6.7 does not implement BullMQ, EventBus, production metrics, admin audit, or LLM-as-judge.
- Privacy boundary: Trace does not save full prompt, full response, full RAG chunks, or API keys.
- Type consistency: API names use `agentTrace*`, server module uses `AgentTraces*`, route path is `/agent-traces`, page path is `/agent-trace`.
- Commit boundary: Each task has its own verification and commit command.
