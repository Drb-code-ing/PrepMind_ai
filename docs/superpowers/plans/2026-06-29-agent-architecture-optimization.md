# Agent Architecture Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 6 multi-agent system from "deterministic policy + route-aware Chat" into a more measurable, safer, and more extensible agent architecture without prematurely giving LLMs uncontrolled autonomy.

**Architecture:** Keep the current workflow-first boundary: `@repo/agent` still owns typed state, deterministic routing, policy nodes, evals, and graph descriptors; `/api/chat` remains the only live model call path; server APIs own data writes behind `JwtAuthGuard`; risky actions continue through human approval. Add state compression, step/loop guards, stronger eval coverage, tool-result contracts, RAG conflict weighting, and Phase 7 background execution points in small commits.

**Tech Stack:** TypeScript, Zod, Bun test, Next.js 16 API routes, NestJS 11, Prisma, PostgreSQL + pgvector, BullMQ planned, LangGraph-compatible graph descriptor, Vercel AI SDK.

---

## Why This Plan Exists

The current Phase 6.8 result is intentionally conservative:

- `RouterAgent` decides route metadata.
- `TutorAgent` decides tutoring strategy prompt.
- `KnowledgeVerifierAgent` checks retrieved chunks deterministically.
- `WrongQuestionOrganizerAgent`, `ReviewAgent`, `PlannerAgent`, `MemoryAgent`, `KnowledgeDedupAgent`, and `KnowledgeOrganizerAgent` produce scoped suggestions.
- Real model calls still only happen in `/api/chat`, protected by `AI_PROVIDER_MODE=live` and `AI_ENABLE_LIVE_CALLS=true`.

That is a good production boundary for an early AI learning product. It avoids the common failure mode of "Agent" becoming an opaque loop that writes data, calls tools, and burns tokens without user control.

But it also means the current system is closer to a typed workflow with agent-style policies than to a fully autonomous ReAct agent. The next optimization should not be "make everything autonomous"; it should be "add the missing control plane pieces that make autonomy safe later."

## Concept Mapping

| Concept from notes | Current PrepMind state | Gap | Recommended direction |
| --- | --- | --- | --- |
| LLM + Planning + Memory + Tools | LLM is only `/api/chat`; planning is deterministic `PlannerAgent`; memory is user-confirmed; tools are mostly API boundaries | No unified tool execution contract yet | Keep writes behind APIs, add typed tool-result envelope and action proposal lifecycle |
| Traditional chain vs Agent | Current Chat path is mostly route-aware workflow | No dynamic multi-step reasoning loop | Add bounded LangGraph loop only for narrow tasks, with max steps and trace |
| ReAct short-term memory | Recent chat window and active OCR context exist | No summary buffer or semantic truncation | Add `summaryBuffer` and context policy metadata first; do not introduce LLM summarization inside `@repo/agent` yet |
| Long-term memory | `UserMemoryCandidate` / `UserMemory` exists | Not injected into Chat yet | Add opt-in memory retrieval with visible prompt budget and trace |
| Multi-agent collaboration | Agents are split by domain | Mostly independent policy calls, not true collaboration | Add orchestrator-worker only for background jobs and eval review loops |
| Infinite loop protection | No autonomous loop, so risk is low | Future loop needs hard guard | Add `maxSteps`, deadline, transition history, repeated-state detection |
| Workflow vs Agent | Current design correctly favors workflow reliability | Open-ended tasks still rely on normal Chat advice | Introduce autonomous loops only where benefit is measurable |
| Orchestrator-worker | Router + page-level APIs approximate orchestration | No worker run contract | Define worker input/output schemas before adding workers |
| Reflexion | Live acceptance is manual; fixed eval exists | No critic/reflection step after generation | Add evaluator/critic for test and smoke, not user-facing auto-retry first |
| State schema | `AgentState` exists | It stores recent messages but not compression policy or loop metadata | Extend state schema conservatively |
| Tool reliability | Zod contracts exist across APIs | Tool calls/actions are not unified as a contract | Add `AgentToolResult` and retryable validation error shape |
| LangGraph nodes/edges | Graph descriptor exists | Descriptor is not executable graph and currently misses `KnowledgeOrganizerAgent` | First align descriptor/evals; later add real graph executor |
| Metrics | Trace + cost estimate exists | No success-rate/tool-accuracy dashboard yet | Add eval summary and trace fields for steps/tool outcomes |
| RAG conflict | Verifier handles simple suspicious/conflict signals | No source authority/freshness weighting | Add typed document metadata first, then use it in verifier guidance before changing retrieval ranking |
| ACL isolation | User-scoped queries are in place | Chunk-level ACL metadata not explicit | Keep user filter now; add ACL metadata before shared/team knowledge |
| High-frequency updates | Upload/process is synchronous API driven | No queue mode or cache invalidation event yet | Phase 7 should start with knowledge processing queue mode behind a feature flag, then expand to broader events |

## Optimization Priorities

### P0: Close Current Architecture Consistency Gaps

These are small but important because they affect interview credibility and future maintenance.

- `packages/agent/src/graph/index.ts` lists `KnowledgeDedupAgent` but not `KnowledgeOrganizerAgent`.
- The fixed eval set still uses the `phase-6-7` name and does not cover `KnowledgeDedupAgent / KnowledgeOrganizerAgent`, even though those two policies already have their own focused tests.
- `README.md` and `docs/roadmap.md` have been synced to point at this plan; future Task 1 should only edit them if they drift again.

### P1: Add Agent State Control Plane

Before adding autonomous loops, make state explicit:

- context policy: what was kept, summarized, or dropped.
- summary buffer: a schema and budget hook for compressed old conversation facts. The first implementation should record metadata only or accept a precomputed summary; it should not call a live model from `@repo/agent`.
- loop guard: `maxSteps`, `deadlineAt`, `visitedTransitions`, `repeatCount`.
- human approval flag: whether this run is allowed to propose writes.

### P2: Harden Tool and Action Reliability

The repo already has `ActionProposal`, but it should become the standard bridge for risky tool execution:

- typed `AgentToolResult` envelope.
- validation-error feedback for retry.
- no direct write from agent policy.
- user approval before merge/delete/replace/create-plan memory changes.

### P3: Improve RAG Conflict and Freshness Handling

Current RAG is user-isolated and verifier-aware, but conflict handling is still shallow:

- add typed document authority/freshness metadata with defaults and backfill.
- use source metadata in verifier guidance before changing retrieval ranking.
- make verifier conflict reasons more structured.
- expose source trace clearly to the user.

### P4: Prepare Long-Running Knowledge Work for Phase 7 Queues

Document parsing, embedding, and knowledge re-indexing are the first BullMQ candidates. Trace aggregation and memory candidate generation can be handled by separate Phase 7 plans after the queue boundary is proven:

- jobs can retry safely.
- processing mode can be switched with a feature flag.
- UI can show status without blocking upload/chat.

### P5: Add Reflexion-Style Evaluation

Use critic/reflection first in tests and acceptance, not as uncontrolled user-facing self-retry:

- fixed eval checks deterministic policies.
- live smoke checks output quality.
- critic agent or rubric checks whether route/prompt/citation behavior satisfied constraints.
- failing reflection becomes regression case.

---

## File Map

### P0 Consistency

- Modify `packages/agent/src/graph/index.ts`: include `KnowledgeOrganizerAgent` in `nodes` and `thresholdNodes`.
- Modify `packages/agent/src/evals/phase-6-7-cases.ts`: add knowledge dedup and organizer eval cases or rename to a Phase 6 full eval file.
- Modify `packages/agent/src/evals/run-phase-6-7-evals.ts`: execute new eval case kinds.
- Modify `packages/agent/tests/graph.test.ts`: assert graph descriptor includes `KnowledgeOrganizerAgent`.
- Modify `packages/agent/tests/phase-6-7-eval.test.ts`: assert new eval cases pass.
- Verify `README.md` and `docs/roadmap.md`: keep links to this plan if they are already present.

### P1 State Control Plane

- Modify `packages/types/src/api/agent.ts`: extend `agentStateSchema`.
- Modify `packages/agent/src/state.ts`: initialize new state fields.
- Create `packages/agent/src/control-plane.ts`: loop guard and transition helpers.
- Create `packages/agent/tests/control-plane.test.ts`: max step, deadline, and repeated transition tests.
- Modify `apps/web/src/lib/chat-context.ts`: support optional precomputed summary buffer input.
- Modify `apps/web/src/lib/ai-usage-guard.ts`: report context policy metadata.
- Modify `apps/web/src/lib/agent-trace-payload.ts`: include context policy in trace summary.

### P2 Tool Reliability

- Create `packages/types/src/api/agent-tool.ts`: tool result and validation error schemas.
- Modify `packages/types/src/api/index.ts`: export tool schemas.
- Create `packages/agent/src/tools/tool-result.ts`: helper constructors.
- Create `packages/agent/tests/tool-result.test.ts`: result envelope tests.
- Modify future write-oriented agent APIs to return proposals before writes; do not retrofit all existing APIs in one commit.

### P3 RAG Conflict and Freshness

- Modify `packages/database/prisma/schema.prisma`: add optional document authority/freshness metadata.
- Create Prisma migration under `packages/database/prisma/migrations`.
- Modify `packages/types/src/api/knowledge.ts`: expose optional metadata.
- Modify `apps/server/src/knowledge/*`: persist and return metadata.
- Modify `packages/agent/src/nodes/knowledge-verifier.ts`: structured conflict/freshness result.
- Modify `apps/web/src/lib/chat-rag-context.ts`: include weighted source guidance.
- Add tests across `@repo/agent`, `@repo/server`, and `@repo/web`.

### P4 Queue Preparation

- Create `apps/server/src/jobs/jobs.module.ts`: BullMQ module.
- Create `apps/server/src/knowledge/jobs/process-document.job.ts`: typed job payload.
- Create `apps/server/src/knowledge/jobs/process-document.processor.ts`: async document processing.
- Modify `apps/server/src/knowledge/knowledge.service.ts`: enqueue processing job instead of doing long work inline after a feature flag.
- Add e2e tests with fake queue or inline test adapter.

### P5 Reflexion Evaluation

- Create `packages/agent/src/evals/critic-rubric.ts`: deterministic rubric for route, citation, and safety checks.
- Create `packages/agent/tests/critic-rubric.test.ts`: critic tests.
- Create `docs/acceptance/phase-6-reflexion-smoke-template.md`: repeatable live acceptance template.
- Modify `docs/ai-behavior-acceptance.md`: require critic/rubric notes for prompt-changing work.

---

## Task 1: Align Graph Descriptor and Fixed Eval Coverage

**Why:** Before adding new architecture, make the current architecture describe itself accurately. This is the cheapest credibility win.

**Files:**
- Modify: `packages/agent/src/graph/index.ts`
- Modify: `packages/agent/src/evals/phase-6-7-cases.ts`
- Modify: `packages/agent/src/evals/run-phase-6-7-evals.ts`
- Modify: `packages/agent/tests/graph.test.ts`
- Modify: `packages/agent/tests/phase-6-7-eval.test.ts`
- Modify: `README.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Add graph descriptor regression**

Update `packages/agent/tests/graph.test.ts` with an assertion equivalent to:

```ts
expect(graph.nodes).toContain('KnowledgeOrganizerAgent');
expect(graph.thresholdNodes).toContain('KnowledgeOrganizerAgent');
```

Run:

```powershell
bun --filter @repo/agent test -- graph
```

Expected before implementation: fail because `KnowledgeOrganizerAgent` is missing from the descriptor.

- [ ] **Step 2: Update graph descriptor**

Update `packages/agent/src/graph/index.ts` so both arrays include `KnowledgeOrganizerAgent`:

```ts
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
  'KnowledgeOrganizerAgent',
],
thresholdNodes: [
  'WrongQuestionOrganizerAgent',
  'ReviewAgent',
  'PlannerAgent',
  'MemoryAgent',
  'KnowledgeDedupAgent',
  'KnowledgeOrganizerAgent',
],
```

- [ ] **Step 3: Add knowledge eval cases**

Add two eval kinds in `packages/agent/src/evals/phase-6-7-cases.ts`:

```ts
| {
    kind: 'knowledge_dedup';
    name: string;
    expectedKind: 'exact_duplicate' | 'possible_revision' | 'complementary' | 'insufficient_signal';
  }
| {
    kind: 'knowledge_organizer';
    name: string;
    expectedCollectionName: string;
  };
```

Add cases:

```ts
{
  kind: 'knowledge_dedup',
  name: 'detects possible revision documents',
  expectedKind: 'possible_revision',
},
{
  kind: 'knowledge_organizer',
  name: 'groups math knowledge documents',
  expectedCollectionName: '数学资料',
},
```

- [ ] **Step 4: Execute new eval cases**

In `packages/agent/src/evals/run-phase-6-7-evals.ts`, import:

```ts
import { analyzeKnowledgeDedup } from '../nodes/knowledge-dedup.ts';
import { organizeKnowledgeDocuments } from '../nodes/knowledge-organizer.ts';
```

Add handlers:

```ts
if (testCase.kind === 'knowledge_dedup') {
  const result = analyzeKnowledgeDedup({
    now: '2026-06-29T00:00:00.000Z',
    documents: [
      knowledgeDocument('doc_1', '链式法则 v1.pdf', 'sha256:old', ['链式法则 导数']),
      knowledgeDocument('doc_2', '链式法则 v2.pdf', 'sha256:new', ['链式法则 导数 新版']),
    ],
  });

  return {
    name: testCase.name,
    passed: result.items.some((item) => item.kind === testCase.expectedKind),
    detail: `items=${result.items.map((item) => item.kind).join(',')}`,
  };
}

if (testCase.kind === 'knowledge_organizer') {
  const result = organizeKnowledgeDocuments({
    now: '2026-06-29T00:00:00.000Z',
    documents: [
      knowledgeDocument('doc_1', '高等数学 导数讲义.pdf', 'sha256:a', ['导数 极限 函数']),
      knowledgeDocument('doc_2', '高等数学 导数练习.pdf', 'sha256:b', ['导数应用题']),
    ],
  });

  return {
    name: testCase.name,
    passed: result.collections.some(
      (collection) => collection.name === testCase.expectedCollectionName,
    ),
    detail: `collections=${result.collections.map((collection) => collection.name).join(',')}`,
  };
}
```

Add helper:

```ts
function knowledgeDocument(
  id: string,
  name: string,
  contentHash: string,
  chunkSummaries: string[],
) {
  return {
    id,
    name,
    type: 'PDF' as const,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash,
    chunkCount: chunkSummaries.length,
    processedAt: '2026-06-29T00:00:00.000Z',
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    chunkSummaries,
  };
}
```

- [ ] **Step 5: Sync top-level docs**

Verify `README.md` keeps this next-step list:

```markdown
1. Phase 7：BullMQ 后台任务、事件总线和生产化工程增强。
2. Agent 架构优化：按 `docs/superpowers/plans/2026-06-29-agent-architecture-optimization.md` 补齐状态压缩、工具可靠性、RAG 冲突处理和 Reflexion 验收。
```

Verify `docs/roadmap.md` keeps this sentence under Phase 6:

```markdown
- 后续 Agent 架构优化执行文档见 `docs/superpowers/plans/2026-06-29-agent-architecture-optimization.md`，重点是状态控制面、工具可靠性、RAG 冲突处理和 Reflexion 验收，而不是立刻放开全自主写操作。
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
bun --filter @repo/agent test -- graph evals knowledge
git diff --check
```

Commit:

```powershell
git add packages/agent/src/graph/index.ts packages/agent/src/evals/phase-6-7-cases.ts packages/agent/src/evals/run-phase-6-7-evals.ts packages/agent/tests/graph.test.ts packages/agent/tests/phase-6-7-eval.test.ts README.md docs/roadmap.md
git commit -m "chore(agent): align graph descriptor and eval coverage"
```

---

## Task 2: Add Agent State Control Plane

**Why:** ReAct, LangGraph loops, and multi-agent collaboration all fail if state grows without rules. Add state compression and loop metadata before adding loops.

**Files:**
- Modify: `packages/types/src/api/agent.ts`
- Modify: `packages/agent/src/state.ts`
- Create: `packages/agent/src/control-plane.ts`
- Create: `packages/agent/tests/control-plane.test.ts`
- Modify: `apps/web/src/lib/chat-context.ts`
- Modify: `apps/web/src/lib/ai-usage-guard.ts`
- Modify: `apps/web/src/lib/agent-trace-payload.ts`

- [ ] **Step 1: Add failing control-plane tests**

Create `packages/agent/tests/control-plane.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import {
  createAgentLoopControl,
  recordAgentTransition,
  shouldStopAgentLoop,
} from '../src/control-plane';

describe('agent control plane', () => {
  it('stops when max steps is reached', () => {
    const control = createAgentLoopControl({
      maxSteps: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
    });

    const first = recordAgentTransition(control, 'RouterAgent', 'TutorAgent');
    const second = recordAgentTransition(first, 'TutorAgent', 'FinalResponseAgent');

    expect(shouldStopAgentLoop(second, '2026-06-29T00:00:01.000Z')).toEqual({
      stop: true,
      reason: 'max_steps',
    });
  });

  it('stops repeated transitions', () => {
    const control = createAgentLoopControl({
      maxSteps: 10,
      maxRepeatedTransition: 2,
      startedAt: '2026-06-29T00:00:00.000Z',
    });

    const first = recordAgentTransition(control, 'RetrieverAgent', 'KnowledgeVerifierAgent');
    const second = recordAgentTransition(first, 'RetrieverAgent', 'KnowledgeVerifierAgent');

    expect(shouldStopAgentLoop(second, '2026-06-29T00:00:01.000Z')).toEqual({
      stop: true,
      reason: 'repeated_transition',
    });
  });

  it('stops after deadline', () => {
    const control = createAgentLoopControl({
      maxSteps: 10,
      startedAt: '2026-06-29T00:00:00.000Z',
      deadlineAt: '2026-06-29T00:00:02.000Z',
    });

    expect(shouldStopAgentLoop(control, '2026-06-29T00:00:03.000Z')).toEqual({
      stop: true,
      reason: 'deadline',
    });
  });
});
```

Run:

```powershell
bun --filter @repo/agent test -- control-plane
```

Expected before implementation: fail because `control-plane.ts` does not exist.

- [ ] **Step 2: Extend shared Agent state schema**

Add to `packages/types/src/api/agent.ts`:

```ts
export const agentContextPolicySchema = z.object({
  recentMessageCount: z.number().int().min(0),
  summaryIncluded: z.boolean(),
  droppedMessageCount: z.number().int().min(0),
  estimatedTokenCount: z.number().int().min(0),
});

export const agentLoopControlSchema = z.object({
  stepCount: z.number().int().min(0),
  maxSteps: z.number().int().min(1).max(20),
  maxRepeatedTransition: z.number().int().min(1).max(5),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime().optional(),
  transitions: z.array(z.string()),
});
```

Extend `agentStateSchema`:

```ts
chatContext: z
  .object({
    recentMessages: z.array(agentMessageSchema),
    summaryBuffer: z.string().optional(),
    activeStudyContext: z.string().optional(),
    contextPolicy: agentContextPolicySchema.optional(),
  })
  .optional(),
loopControl: agentLoopControlSchema.optional(),
```

Export inferred types if useful:

```ts
export type AgentContextPolicy = z.infer<typeof agentContextPolicySchema>;
export type AgentLoopControl = z.infer<typeof agentLoopControlSchema>;
```

- [ ] **Step 3: Implement loop guard helpers**

Create `packages/agent/src/control-plane.ts`:

```ts
import type { AgentLoopControl } from '@repo/types/api/agent';

export type CreateAgentLoopControlInput = {
  maxSteps: number;
  maxRepeatedTransition?: number;
  startedAt: string;
  deadlineAt?: string;
};

export type AgentLoopStopReason = 'none' | 'max_steps' | 'deadline' | 'repeated_transition';

export function createAgentLoopControl(
  input: CreateAgentLoopControlInput,
): AgentLoopControl {
  return {
    stepCount: 0,
    maxSteps: input.maxSteps,
    maxRepeatedTransition: input.maxRepeatedTransition ?? 2,
    startedAt: input.startedAt,
    deadlineAt: input.deadlineAt,
    transitions: [],
  };
}

export function recordAgentTransition(
  control: AgentLoopControl,
  from: string,
  to: string,
): AgentLoopControl {
  return {
    ...control,
    stepCount: control.stepCount + 1,
    transitions: [...control.transitions, `${from}->${to}`],
  };
}

export function shouldStopAgentLoop(
  control: AgentLoopControl,
  now: string,
): { stop: boolean; reason: AgentLoopStopReason } {
  if (control.stepCount >= control.maxSteps) {
    return { stop: true, reason: 'max_steps' };
  }

  if (control.deadlineAt && new Date(now).getTime() > new Date(control.deadlineAt).getTime()) {
    return { stop: true, reason: 'deadline' };
  }

  const counts = new Map<string, number>();
  for (const transition of control.transitions) {
    const count = (counts.get(transition) ?? 0) + 1;
    if (count >= control.maxRepeatedTransition) {
      return { stop: true, reason: 'repeated_transition' };
    }
    counts.set(transition, count);
  }

  return { stop: false, reason: 'none' };
}
```

- [ ] **Step 4: Initialize state and expose summary buffer metadata**

Update `packages/agent/src/state.ts` to initialize `loopControl` for runtime-created states:

```ts
loopControl: {
  stepCount: 0,
  maxSteps: 6,
  maxRepeatedTransition: 2,
  startedAt: new Date().toISOString(),
  transitions: [],
},
```

If deterministic tests need stable time, add an optional `startedAt` to `CreateAgentStateInput`.

Do not call a model to summarize old messages in this task. The only allowed summary inputs are an already computed `summaryBuffer` from the caller or metadata that says no summary was included.

- [ ] **Step 5: Add context policy metadata to Chat budget**

Extend `ChatRequestBudget` in `apps/web/src/lib/ai-usage-guard.ts`:

```ts
contextPolicy: {
  recentMessageCount: number;
  summaryIncluded: boolean;
  droppedMessageCount: number;
  estimatedTokenCount: number;
};
```

After `modelMessages` is built:

```ts
const normalizedMessageCount = input.messages.filter((message) => message.content.trim()).length;
const contextPolicy = {
  recentMessageCount: modelMessages.length,
  summaryIncluded: false,
  droppedMessageCount: Math.max(0, normalizedMessageCount - modelMessages.length),
  estimatedTokenCount: estimatedInputTokens,
};
```

Return `contextPolicy`.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
bun --filter @repo/agent test -- control-plane graph
bun --filter @repo/web test -- chat-context ai-usage-guard agent-trace-payload
bun --cwd packages/types typecheck
git diff --check
```

Commit:

```powershell
git add packages/types/src/api/agent.ts packages/agent/src/state.ts packages/agent/src/control-plane.ts packages/agent/tests/control-plane.test.ts apps/web/src/lib/chat-context.ts apps/web/src/lib/ai-usage-guard.ts apps/web/src/lib/agent-trace-payload.ts
git commit -m "feat(agent): add state control plane metadata"
```

---

## Task 3: Standardize Tool Result and Human Approval Boundary

**Why:** The user's notes correctly call out JSON mode, strong typing, validation retry, and human confirmation. PrepMind should formalize this before adding real tool execution.

**Files:**
- Create: `packages/types/src/api/agent-tool.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Create: `packages/types/tests/agent-tool.test.mts`
- Create: `packages/agent/src/tools/tool-result.ts`
- Create: `packages/agent/tests/tool-result.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/types/tests/agent-tool.test.mts`:

```ts
import { describe, expect, it } from 'bun:test';

import { agentToolResultSchema } from '../src/api/agent-tool';

describe('agent tool result schema', () => {
  it('parses successful tool results', () => {
    expect(
      agentToolResultSchema.parse({
        ok: true,
        toolName: 'knowledge.search',
        data: { hitCount: 2 },
        retryable: false,
      }),
    ).toEqual({
      ok: true,
      toolName: 'knowledge.search',
      data: { hitCount: 2 },
      retryable: false,
    });
  });

  it('parses validation failures for model retry feedback', () => {
    const parsed = agentToolResultSchema.parse({
      ok: false,
      toolName: 'knowledge.search',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must be <= 10',
        issues: [{ path: 'limit', message: 'Expected number <= 10' }],
      },
      retryable: true,
    });

    expect(parsed.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Implement shared tool result schema**

Create `packages/types/src/api/agent-tool.ts`:

```ts
import { z } from 'zod';

export const agentToolErrorSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ]),
  message: z.string().min(1),
  issues: z
    .array(
      z.object({
        path: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .optional(),
});

export const agentToolResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    toolName: z.string().min(1),
    data: z.record(z.unknown()),
    retryable: z.boolean(),
  }),
  z.object({
    ok: z.literal(false),
    toolName: z.string().min(1),
    error: agentToolErrorSchema,
    retryable: z.boolean(),
  }),
]);

export type AgentToolError = z.infer<typeof agentToolErrorSchema>;
export type AgentToolResult = z.infer<typeof agentToolResultSchema>;
```

Export it from `packages/types/src/api/index.ts` and `packages/types/package.json`.

- [ ] **Step 3: Add helper constructors**

Create `packages/agent/src/tools/tool-result.ts`:

```ts
import type { AgentToolResult } from '@repo/types/api/agent-tool';

export function createToolSuccess(
  toolName: string,
  data: Record<string, unknown>,
): AgentToolResult {
  return {
    ok: true,
    toolName,
    data,
    retryable: false,
  };
}

export function createToolFailure(input: {
  toolName: string;
  code: AgentToolResult extends { ok: false; error: infer E }
    ? E extends { code: infer C }
      ? C
      : never
    : never;
  message: string;
  retryable: boolean;
  issues?: Array<{ path: string; message: string }>;
}): AgentToolResult {
  return {
    ok: false,
    toolName: input.toolName,
    error: {
      code: input.code,
      message: input.message,
      issues: input.issues,
    },
    retryable: input.retryable,
  };
}
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --cwd packages/types test agent-tool
bun --filter @repo/agent test -- tool-result
bun --cwd packages/types typecheck
git diff --check
```

Commit:

```powershell
git add packages/types/src/api/agent-tool.ts packages/types/src/api/index.ts packages/types/package.json packages/types/tests/agent-tool.test.mts packages/agent/src/tools/tool-result.ts packages/agent/tests/tool-result.test.ts
git commit -m "feat(agent): add typed tool result envelope"
```

---

## Task 4: Add RAG Source Freshness Metadata and Conflict Guidance

**Why:** The current verifier can flag suspicious or conflicting chunks, but it does not know whether a document is authoritative, outdated, or user-marked as low confidence. This task should add metadata and guidance first; retrieval ranking changes should come later after real embedding quality is verified.

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_document_source_metadata/migration.sql`
- Modify: `packages/types/src/api/knowledge.ts`
- Modify: `apps/server/src/knowledge/knowledge.service.ts`
- Modify: `packages/agent/src/nodes/knowledge-verifier.ts`
- Modify: `packages/agent/tests/knowledge-verifier.test.ts`
- Modify: `apps/web/src/lib/chat-rag-context.ts`
- Modify: `apps/web/src/lib/chat-rag-context.test.mts`

- [ ] **Step 1: Add metadata fields**

Add optional fields to `Document`:

```prisma
sourceAuthority String @default("unknown")
sourcePublishedAt DateTime?
sourceExpiresAt DateTime?
userTrustLevel String @default("normal")
```

Use values:

- `sourceAuthority`: use a controlled value such as `official`, `teacher`, `self_note`, `unknown`.
- `userTrustLevel`: `low`, `normal`, `high`.

Backfill existing rows to `sourceAuthority='unknown'` and `userTrustLevel='normal'`.

Add indexes:

```prisma
@@index([userId, sourcePublishedAt])
@@index([userId, userTrustLevel])
```

- [ ] **Step 2: Update knowledge response contract**

In `packages/types/src/api/knowledge.ts`, expose optional document metadata in list/detail/search hit metadata:

```ts
sourceAuthority: z.string().nullable().optional(),
sourcePublishedAt: z.string().datetime().nullable().optional(),
sourceExpiresAt: z.string().datetime().nullable().optional(),
userTrustLevel: z.enum(['low', 'normal', 'high']).optional(),
```

- [ ] **Step 3: Extend verifier input and policy**

Extend `KnowledgeVerifierChunk`:

```ts
metadata?: {
  sourceAuthority?: string | null;
  sourcePublishedAt?: string | null;
  sourceExpiresAt?: string | null;
  userTrustLevel?: 'low' | 'normal' | 'high';
};
```

Add policy:

- expired chunks increase `suspiciousSignals`.
- `userTrustLevel=low` prevents `trusted` unless there is another high-score normal/high source.
- conflicting answer markers should include document titles in `conflictSignals`.

- [ ] **Step 4: Update prompt and citation guidance**

In `apps/web/src/lib/chat-rag-context.ts`, when verifier returns freshness or conflict signals:

```text
资料新鲜度提示：部分资料可能已过期或可信度较低，请以题目条件、教材定义和更权威资料为准。
```

Do not expose internal IDs or full chunk content.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --filter @repo/agent test -- knowledge-verifier
bun --filter @repo/server test -- knowledge
bun --filter @repo/web test -- chat-rag-context
bun --cwd packages/types typecheck
bun --cwd packages/database test
git diff --check
```

Commit:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/types/src/api/knowledge.ts apps/server/src/knowledge packages/agent/src/nodes/knowledge-verifier.ts packages/agent/tests/knowledge-verifier.test.ts apps/web/src/lib/chat-rag-context.ts apps/web/src/lib/chat-rag-context.test.mts
git commit -m "feat(rag): add source freshness conflict weighting"
```

---

## Task 5: Prepare Knowledge Processing Queue Mode

**Why:** High-frequency knowledge updates should not depend on synchronous request lifetimes. Start with one bounded queue path for document processing; broader event bus work should get its own Phase 7 plan.

**Files:**
- Create: `apps/server/src/jobs/jobs.module.ts`
- Create: `apps/server/src/knowledge/jobs/process-document.job.ts`
- Create: `apps/server/src/knowledge/jobs/process-document.processor.ts`
- Modify: `apps/server/src/knowledge/knowledge.module.ts`
- Modify: `apps/server/src/knowledge/knowledge.service.ts`
- Create: `apps/server/src/knowledge/jobs/process-document.processor.spec.ts`
- Modify: `docs/data-flow.md`

- [ ] **Step 1: Define document processing job payload**

Create `apps/server/src/knowledge/jobs/process-document.job.ts`:

```ts
export const PROCESS_DOCUMENT_QUEUE = 'knowledge-document-processing';

export type ProcessDocumentJob = {
  documentId: string;
  userId: string;
  force?: boolean;
  requestedAt: string;
};
```

- [ ] **Step 2: Add processor tests**

Create `apps/server/src/knowledge/jobs/process-document.processor.spec.ts` to assert:

- processor receives `documentId` and `userId`.
- processor calls the existing document processing service method.
- processor does not process a document for a mismatched user.
- retryable failures are thrown so BullMQ can retry.

- [ ] **Step 3: Add jobs module behind a feature flag**

Use a conservative flag:

```text
KNOWLEDGE_PROCESSING_MODE=inline | queue
```

Default to `inline` until queues are stable.

- [ ] **Step 4: Update data-flow docs**

In `docs/data-flow.md`, split document processing flow into:

- current inline mode.
- Phase 7 queue mode behind `KNOWLEDGE_PROCESSING_MODE=queue`.
- query invalidation after upload, replace, process completion, and delete.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
bun --filter @repo/server test -- knowledge process-document
bun --filter @repo/server build
git diff --check
```

Commit:

```powershell
git add apps/server/src/jobs apps/server/src/knowledge docs/data-flow.md
git commit -m "feat(server): prepare queued knowledge processing"
```

---

## Task 6: Add Reflexion-Style Critic for Acceptance

**Why:** Reflexion should first improve evaluation discipline. Let a critic/rubric catch bad routes, weak citations, unsafe claims, or missing fallback behavior before we let agents self-retry in production.

**Files:**
- Create: `packages/agent/src/evals/critic-rubric.ts`
- Create: `packages/agent/tests/critic-rubric.test.ts`
- Modify: `docs/ai-behavior-acceptance.md`
- Create: `docs/acceptance/phase-6-reflexion-smoke-template.md`

- [ ] **Step 1: Add critic rubric tests**

Create tests for:

- RAG answer with citations and verifier notice passes.
- RAG answer claiming unsupported source truth fails.
- Tutor answer giving only final answer for a hint request fails.
- Study plan route claiming it wrote tasks fails.

- [ ] **Step 2: Implement deterministic rubric**

Create `critic-rubric.ts` with:

```ts
export type CriticRubricInput = {
  route: 'chat' | 'tutor' | 'rag_answer' | 'study_plan' | 'review_analysis' | 'wrong_question_organize';
  userPrompt: string;
  assistantText: string;
  verifierStatus?: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'skipped';
  tutorIntent?: string;
  ragHitCount?: number;
};

export type CriticRubricResult = {
  passed: boolean;
  failures: string[];
};
```

Rules:

- `rag_answer` with `ragHitCount > 0` should include `参考资料`.
- `suspicious` or `conflict` should include `核对` or `谨慎`.
- `socratic_hint` should not contain only a final answer marker.
- advisory routes must not say "已创建", "已写入", "已保存", or "已经安排".

- [ ] **Step 3: Update acceptance docs**

In `docs/ai-behavior-acceptance.md`, add:

```markdown
## 8. Reflexion / Critic 验收要求

当改动 RouterAgent、TutorAgent prompt、RAG prompt、KnowledgeVerifierAgent 或 `/api/chat` 输出行为时，除了 mock 单测和 live smoke，还要记录 critic/rubric 结论。critic 不替代人工判断，但它必须能发现明显错误：错误 route、RAG 有命中但无引用、可疑资料无核对提示、提示请求直接给最终答案、advisory route 谎称已写库。
```

- [ ] **Step 4: Verify and commit**

Run:

```powershell
bun --filter @repo/agent test -- critic-rubric
git diff --check
```

Commit:

```powershell
git add packages/agent/src/evals/critic-rubric.ts packages/agent/tests/critic-rubric.test.ts docs/ai-behavior-acceptance.md docs/acceptance/phase-6-reflexion-smoke-template.md
git commit -m "test(agent): add reflexion critic rubric"
```

---

## Implementation Order

1. Task 1 first. It is small and fixes current consistency debt.
2. Task 2 second. It adds state and loop safety before any autonomous behavior.
3. Task 3 third. It gives future tools a typed contract and protects risky writes.
4. Task 6 can run before Task 4/5 if the immediate goal is better interview/acceptance material.
5. Task 4 and Task 5 are larger and should be treated as Phase 7 work because they touch database schema and background execution.

## Acceptance Checklist

- [ ] Graph descriptor names every completed Phase 6.8 agent.
- [ ] Fixed eval set covers Router, Tutor, Verifier, WrongQuestionOrganizer, Review, Planner, Memory, KnowledgeDedup, and KnowledgeOrganizer.
- [ ] Agent state records context compression policy and loop guard metadata.
- [ ] Future tool execution has a typed success/failure envelope.
- [ ] Risky write actions remain behind human approval.
- [ ] RAG verifier can reason about conflict, suspicious content, freshness, and user trust level.
- [ ] Queue mode is introduced behind a feature flag, with inline mode still default until stable.
- [ ] Prompt or live-output changes include mock tests, focused live smoke, and critic/rubric notes.

## Interview Framing

Use this language when explaining the design:

- "我们没有一上来放开全自主 Agent，因为学习产品里有错题、复习计划、资料删除和长期记忆，误写成本高。所以 Phase 6 先做 workflow-first 的多 Agent：每个 Agent 都有清晰输入输出、只读建议或人审确认。"
- "真正 Agent 化之前，我优先补控制面：State Schema、上下文压缩、max steps、trace、eval、tool result envelope。这样后面引入 ReAct loop 时，不会变成不可控黑盒。"
- "`/api/chat` 仍是唯一真实模型调用路径。Agent 只给 route、prompt strategy、verifier guidance 和 trace 元数据；RAG 超预算时可以丢弃知识片段，但短 Agent prompt 仍保留。"
- "Trace 只存脱敏后的 input preview、step summary、route、token 和成本估算，不存完整 prompt、完整回答、完整 RAG chunk 或密钥。这样面试官问安全边界时能讲清楚。"
- "RAG 不是绝对真理。用户上传的笔记可能错，所以我加了 KnowledgeVerifierAgent，后续还会先加 source freshness、authority 和 conflict guidance，再考虑影响检索排序。"
- "Reflexion 我不会直接用于生产自我重试，而是先用于验收：让 critic/rubric 检查 route、引用、核对提示和是否越权写库，失败就沉淀成回归用例。"
- "Phase 7 的 BullMQ 和事件总线不是炫技，是为文档解析、embedding、索引更新、trace 聚合这种长任务提供可靠重试和状态可见性。"

## Not To Do Yet

- Do not let `@repo/agent` call live models directly.
- Do not let agents write Document, Chunk, ReviewTask, UserMemory, or organizer data without an API boundary and human approval.
- Do not inject all `UserMemory` into every Chat request.
- Do not pass full history, full prompt, full answer, full RAG chunks, or secrets into Agent Trace.
- Do not replace deterministic evals with subjective live checks.
- Do not treat fake embedding as proof of semantic retrieval quality.
