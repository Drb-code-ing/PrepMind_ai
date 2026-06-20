# Phase 6.1 Router Tutor Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route `/api/chat` through the Phase 6 Agent router and apply Tutor-style prompt behavior while preserving the current streaming, RAG, OCR context, token budget, and mock/live cost guard behavior.

**Architecture:** Add a small web-side adapter around `@repo/agent` that returns route metadata and prompt additions. The existing Next.js chat API remains responsible for RAG search, budget trimming, mock/live streaming, and citation output. Phase 6.1 does not execute ReviewAgent, PlannerAgent, MemoryAgent, WrongQuestionOrganizerAgent, or any write action.

**Tech Stack:** Next.js API Route, TypeScript, Bun workspace, `@repo/agent`, existing chat context/RAG helpers, Node test runner for web lib tests, Bun tests for agent package.

---

## File Structure

- Modify `apps/web/package.json`
  Add `@repo/agent` workspace dependency so the web app can import the Agent router through the package boundary.

- Create `apps/web/src/lib/chat-agent-runtime.ts`
  Web-side adapter that builds a small Agent state, calls `routeAgentRequest`, returns `ChatAgentDecision`, prompt additions, and debug headers.

- Create `apps/web/src/lib/chat-agent-runtime.test.mts`
  Tests route decisions, prompt additions, prompt composition, and router degradation.

- Modify `apps/web/src/lib/ai-usage-guard.ts`
  Extend `createMockChatText` with optional `agentRoute` and route-visible mock hints.

- Modify `apps/web/src/lib/ai-usage-guard.test.mts`
  Verify Tutor route appears in mock output while markdown/math checks remain intact.

- Modify `apps/web/src/app/api/chat/route.ts`
  Call the web-side adapter, compose Agent prompt + RAG prompt, add Agent headers, and pass the route into mock output.

---

### Task 1: Web Chat Agent Adapter

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/chat-agent-runtime.ts`
- Create: `apps/web/src/lib/chat-agent-runtime.test.mts`

- [ ] **Step 1: Write the failing adapter test**

Create `apps/web/src/lib/chat-agent-runtime.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatAgentDecision,
  combineChatAdditionalPrompts,
} from './chat-agent-runtime.ts';
import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

const activeContext: ActiveStudyContext = {
  type: 'ocr-question',
  questionText: '求函数 f(x)=x^2 的导数。',
  questionType: 'calculation',
  subject: '高等数学',
};

test('routes OCR follow-up requests to tutor and builds tutor prompt', () => {
  const messages: ChatContextMessage[] = [
    { role: 'user', content: '为什么这一步可以这样做？' },
  ];

  const decision = buildChatAgentDecision({
    messages,
    activeContext,
    runId: 'run_1',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.requiresRag, false);
  assert.match(decision.promptAddition, /苏格拉底/);
  assert.equal(decision.debugHeaders['x-prepmind-agent-route'], 'tutor');
  assert.equal(decision.debugHeaders['x-prepmind-agent-rag-required'], 'false');
});

test('routes knowledge-base requests to rag_answer without replacing RAG search', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: '根据我上传的笔记，格林公式怎么用？' }],
    activeContext: null,
    runId: 'run_2',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'rag_answer');
  assert.equal(decision.requiresRag, true);
  assert.match(decision.promptAddition, /用户资料/);
});

test('keeps general messages on chat route', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: '你好' }],
    activeContext: null,
    runId: 'run_3',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'chat');
  assert.equal(decision.promptAddition, '');
});

test('degrades to chat when router throws', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: '帮我讲题' }],
    activeContext: null,
    runId: 'run_4',
    userId: 'user_1',
    router: () => {
      throw new Error('router failed');
    },
  });

  assert.equal(decision.route, 'chat');
  assert.equal(decision.degraded, true);
  assert.equal(decision.debugHeaders['x-prepmind-agent-degraded'], 'true');
});

test('combines agent prompt before knowledge prompt and preserves agent prompt alone', () => {
  assert.equal(combineChatAdditionalPrompts('', ''), '');
  assert.equal(combineChatAdditionalPrompts('agent prompt', ''), 'agent prompt');
  assert.equal(combineChatAdditionalPrompts('', 'knowledge prompt'), 'knowledge prompt');
  assert.equal(
    combineChatAdditionalPrompts('agent prompt', 'knowledge prompt'),
    'agent prompt\n\n---\n\nknowledge prompt',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-agent-runtime.test.mts
```

Expected: FAIL because `apps/web/src/lib/chat-agent-runtime.ts` does not exist.

- [ ] **Step 3: Add `@repo/agent` dependency**

Modify `apps/web/package.json` dependencies and add:

```json
"@repo/agent": "*"
```

Place it near the existing `@repo/types` dependency.

- [ ] **Step 4: Implement the web-side adapter**

Create `apps/web/src/lib/chat-agent-runtime.ts`:

```ts
import {
  routeAgentRequest,
  type AgentState,
} from '@repo/agent';
import type { AgentRoute, RouterResult } from '@repo/types/api/agent';

import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

export type ChatAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
  promptAddition: string;
  debugHeaders: Record<string, string>;
  degraded: boolean;
};

export type BuildChatAgentDecisionInput = {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  runId: string;
  userId: string;
  conversationId?: string;
  router?: (state: AgentState) => RouterResult;
};

export function buildChatAgentDecision(
  input: BuildChatAgentDecisionInput,
): ChatAgentDecision {
  try {
    const state = createChatAgentState(input);
    const route = (input.router ?? routeAgentRequest)(state);

    return toDecision(route, false);
  } catch {
    return toDecision(
      {
        name: 'chat',
        confidence: 0.4,
        reason: 'RouterAgent failed; degraded to normal chat.',
        requiresRag: false,
        requiresHumanApproval: false,
      },
      true,
    );
  }
}

export function combineChatAdditionalPrompts(
  agentPrompt: string,
  knowledgePrompt: string,
) {
  const sections = [agentPrompt.trim(), knowledgePrompt.trim()].filter(Boolean);
  return sections.join('\n\n---\n\n');
}

function createChatAgentState(input: BuildChatAgentDecisionInput): AgentState {
  const latestUserText = getLatestUserText(input.messages);

  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    input: {
      text: latestUserText,
      attachments: [],
    },
    chatContext: {
      recentMessages: input.messages,
      activeStudyContext: input.activeContext?.questionText,
    },
    proposals: [],
    errors: [],
  };
}

function getLatestUserText(messages: ChatContextMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim() ?? ''
  );
}

function toDecision(route: RouterResult, degraded: boolean): ChatAgentDecision {
  const debugHeaders: Record<string, string> = {
    'x-prepmind-agent-route': route.name,
    'x-prepmind-agent-confidence': route.confidence.toFixed(2),
    'x-prepmind-agent-rag-required': String(route.requiresRag),
  };

  if (degraded) {
    debugHeaders['x-prepmind-agent-degraded'] = 'true';
  }

  return {
    route: route.name,
    confidence: route.confidence,
    reason: route.reason,
    requiresRag: route.requiresRag,
    requiresHumanApproval: route.requiresHumanApproval,
    promptAddition: buildRoutePromptAddition(route.name),
    debugHeaders,
    degraded,
  };
}

function buildRoutePromptAddition(route: AgentRoute) {
  if (route === 'tutor') {
    return [
      '当前请求已由 RouterAgent 判断为 TutorAgent 讲题路线。',
      '请优先使用苏格拉底式讲解：先点明已知条件和目标，再逐步引导推理。',
      '如果用户是在追问“为什么”或“这一步怎么来”，先解释关键依据，不要只给最终答案。',
      '如果用户明确要求答案，可以给出答案，但必须附上清晰推理。',
    ].join('\n');
  }

  if (route === 'rag_answer') {
    return [
      '当前请求已由 RouterAgent 判断为知识库增强问答路线。',
      '用户资料只能作为参考证据，不代表一定正确。',
      '如果没有检索命中，仍应基于通用知识正常回答，不要伪造引用。',
    ].join('\n');
  }

  if (
    route === 'study_plan' ||
    route === 'review_analysis' ||
    route === 'wrong_question_organize'
  ) {
    return [
      '当前请求涉及计划、复习分析或错题整理。',
      'Phase 6.1 只允许给出普通建议，不要写入数据，不要声称已经创建计划或整理错题。',
    ].join('\n');
  }

  return '';
}
```

- [ ] **Step 5: Run adapter test and web typecheck**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-agent-runtime.test.mts
bun --filter @repo/web test
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/web/package.json apps/web/src/lib/chat-agent-runtime.ts apps/web/src/lib/chat-agent-runtime.test.mts
git commit -m "feat: add chat agent runtime adapter"
```

---

### Task 2: Route-Aware Mock Output

**Files:**
- Modify: `apps/web/src/lib/ai-usage-guard.ts`
- Modify: `apps/web/src/lib/ai-usage-guard.test.mts`

- [ ] **Step 1: Add failing mock route test**

In `apps/web/src/lib/ai-usage-guard.test.mts`, append:

```ts
test('shows tutor route in mock output without breaking markdown and math checks', () => {
  const text = createMockChatText({
    hasActiveContext: true,
    latestUserText: '为什么这一步可以这样做？',
    agentRoute: 'tutor',
  });

  assert.match(text, /TutorAgent/);
  assert.match(text, /为什么这一步可以这样做/);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
```

Expected: FAIL because `createMockChatText` does not accept or render `agentRoute`.

- [ ] **Step 3: Extend mock output**

Modify `apps/web/src/lib/ai-usage-guard.ts`.

Add import:

```ts
import type { AgentRoute } from '@repo/types/api/agent';
```

Update `createMockChatText` input type:

```ts
export function createMockChatText(input: {
  hasActiveContext: boolean;
  latestUserText?: string;
  agentRoute?: AgentRoute;
}) {
```

Inside `createMockChatText`, after `contextLine`, add:

```ts
  const routeLine = formatMockAgentRoute(input.agentRoute);
```

In the returned template, place `${routeLine}` after `${contextLine}` with a blank line:

```ts
${contextLine}

${routeLine}

1. ...
```

Add helper:

```ts
function formatMockAgentRoute(route?: AgentRoute) {
  if (route === 'tutor') {
    return 'Agent 路由：TutorAgent 讲题路线。mock 模式只展示路由效果，不调用真实模型。';
  }

  if (route === 'rag_answer') {
    return 'Agent 路由：RAG 增强问答路线。资料检索和引用仍沿用现有链路。';
  }

  if (
    route === 'study_plan' ||
    route === 'review_analysis' ||
    route === 'wrong_question_organize'
  ) {
    return 'Agent 路由：建议类路线。Phase 6.1 不会写入计划、复习分析或错题整理结果。';
  }

  return 'Agent 路由：普通 Chat 路线。';
}
```

- [ ] **Step 4: Run mock tests**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
bun --filter @repo/web test
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/web/src/lib/ai-usage-guard.ts apps/web/src/lib/ai-usage-guard.test.mts
git commit -m "feat: show agent route in mock chat"
```

---

### Task 3: Chat API Integration

**Files:**
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Update imports**

In `apps/web/src/app/api/chat/route.ts`, add:

```ts
import { buildChatAgentDecision, combineChatAdditionalPrompts } from '@/lib/chat-agent-runtime';
```

- [ ] **Step 2: Extend mock response input and headers**

Change `createMockChatResponse` input type:

```ts
function createMockChatResponse(input: {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  knowledgeHits: KnowledgeSearchHit[];
  agentDecision: ReturnType<typeof buildChatAgentDecision>;
}) {
```

Pass route into `createMockChatText`:

```ts
  const mockText = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
    agentRoute: input.agentDecision.route,
  });
```

Extend headers:

```ts
    headers: {
      'x-prepmind-ai-mode': 'mock',
      'x-prepmind-rag-hit-count': String(input.knowledgeHits.length),
      ...input.agentDecision.debugHeaders,
    },
```

- [ ] **Step 3: Extend live response headers**

Change `createLiveChatResponse` input type:

```ts
function createLiveChatResponse(input: {
  model: string;
  systemPrompt: string;
  messages: ChatContextMessage[];
  maxOutputTokens: number;
  knowledgeHits: KnowledgeSearchHit[];
  agentDecision: ReturnType<typeof buildChatAgentDecision>;
}) {
```

Extend headers:

```ts
    headers: {
      'x-prepmind-ai-mode': 'live',
      'x-prepmind-rag-hit-count': String(input.knowledgeHits.length),
      ...input.agentDecision.debugHeaders,
    },
```

- [ ] **Step 4: Build agent decision before RAG budget**

After `normalizedActiveContext`, add:

```ts
    const agentDecision = buildChatAgentDecision({
      messages: normalizedMessages,
      activeContext: normalizedActiveContext,
      runId: crypto.randomUUID(),
      userId: 'web-chat-user',
    });
```

Keep the current `searchKnowledgeForChat` call unchanged.

- [ ] **Step 5: Compose Agent prompt with RAG prompt**

Replace:

```ts
    const knowledgeContextPrompt = buildKnowledgeContextPrompt(knowledgeSearch.hits);
```

with:

```ts
    const knowledgeContextPrompt = buildKnowledgeContextPrompt(knowledgeSearch.hits);
    const additionalSystemPrompt = combineChatAdditionalPrompts(
      agentDecision.promptAddition,
      knowledgeContextPrompt,
    );
```

In `buildChatRequestBudget`, replace:

```ts
      additionalSystemPrompt: knowledgeContextPrompt || undefined,
```

with:

```ts
      additionalSystemPrompt: additionalSystemPrompt || undefined,
```

In the fallback branch, replace:

```ts
      const fallbackBudget = buildChatRequestBudget(baseBudgetInput);
```

with:

```ts
      const fallbackAgentPrompt = combineChatAdditionalPrompts(
        agentDecision.promptAddition,
        '',
      );
      const fallbackBudget = buildChatRequestBudget({
        ...baseBudgetInput,
        additionalSystemPrompt: fallbackAgentPrompt || undefined,
      });
```

This keeps the short Agent prompt when RAG context is dropped for token budget reasons.

- [ ] **Step 6: Pass agent decision into response builders**

In mock response:

```ts
      return createMockChatResponse({
        messages: budget.modelMessages,
        activeContext: normalizedActiveContext,
        knowledgeHits: citationHits,
        agentDecision,
      });
```

In live response:

```ts
    return createLiveChatResponse({
      model: providerStatus.model,
      systemPrompt: budget.systemPrompt,
      messages: budget.modelMessages,
      maxOutputTokens: budget.maxOutputTokens,
      knowledgeHits: citationHits,
      agentDecision,
    });
```

Update `console.info` to include route without logging sensitive content:

```ts
      `[AI usage estimate] mode=live model=${providerStatus.model} input≈${budget.estimatedInputTokens}/${budget.maxInputTokens} maxOutput=${budget.maxOutputTokens} messages=${budget.modelMessages.length} activeContext=${Boolean(normalizedActiveContext)} ragHits=${citationHits.length} agentRoute=${agentDecision.route}`,
```

- [ ] **Step 7: Run web tests and lint**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
```

Expected: both commands PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add apps/web/src/app/api/chat/route.ts
git commit -m "feat: route chat through agent decision"
```

---

### Task 4: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused package checks**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
```

Expected: all commands PASS.

- [ ] **Step 2: Run build if feasible**

Run:

```powershell
bun --filter @repo/web build
```

Expected: PASS. If it fails because of an unrelated environment problem, capture the exact failure and do not claim build success.

- [ ] **Step 3: Optional manual mock validation**

Start the app only if browser validation is requested or needed:

```powershell
bun --filter @repo/web dev
```

Expected mock behavior:

- generic chat response header includes `x-prepmind-agent-route: chat`;
- OCR follow-up response header includes `x-prepmind-agent-route: tutor`;
- RAG-style question response header includes `x-prepmind-agent-route: rag_answer`;
- mock output still streams markdown and formula text.

Do not enable live model calls during automated verification.

- [ ] **Step 4: Repo status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on the implementation branch, with only intentional commits ahead of `main`.

---

## Self-Review Checklist

- The plan keeps `/api/chat` as the streaming owner.
- The plan adds only a thin Agent adapter, not a second answer generator.
- RAG retrieval remains `searchKnowledgeForChat`.
- Agent prompt survives RAG prompt removal when budget overflows.
- ReviewAgent, MemoryAgent, PlannerAgent, WrongQuestionOrganizerAgent, and KnowledgeVerifierAgent remain inactive.
- Mock mode stays default and no task enables real model calls.
- Headers expose route metadata without leaking prompts or message content.
- Tests cover route decisions, prompt composition, mock output, and degradation.
