# Phase 6.2 TutorAgent Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable TutorAgent policy layer that classifies tutoring intent, generates structured teaching prompts, and feeds strategy metadata into the existing chat flow without changing streaming, RAG, OCR context, or mock/live provider behavior.

**Architecture:** `@repo/agent` owns deterministic TutorAgent strategy classification and prompt construction. `apps/web/src/lib/chat-agent-runtime.ts` calls the TutorAgent policy only after RouterAgent selects the `tutor` route, then `/api/chat` continues to own streaming, token budgets, RAG, citations, and provider calls. Mock mode displays route and Tutor strategy metadata for low-cost local validation.

**Tech Stack:** TypeScript, Bun workspace, `@repo/agent`, `@repo/types`, Next.js API Route, Node test runner for web lib tests, Bun tests for package tests.

---

## File Structure

- Modify `packages/agent/src/nodes/tutor.ts`
  Replace the current throwing stub with a pure TutorAgent strategy module. It exports `buildTutorStrategy`, `buildGenericTutorPrompt`, and strategy-related types.

- Create `packages/agent/tests/tutor.test.ts`
  Covers intent classification, depth selection, prompt construction, active OCR context usage, and fallback behavior.

- Modify `packages/agent/src/index.ts`
  Re-export TutorAgent policy types/functions from the package root.

- Modify `packages/agent/package.json`
  Add a `./tutor` subpath export for web code that only needs the TutorAgent policy.

- Modify `apps/web/src/lib/chat-agent-runtime.ts`
  Call TutorAgent policy for the `tutor` route, attach `tutorStrategy` to `ChatAgentDecision`, add tutor debug headers, and degrade safely if policy construction fails.

- Modify `apps/web/src/lib/chat-agent-runtime.test.mts`
  Verify tutor route strategy selection, non-tutor isolation, fallback behavior, and prompt ordering.

- Modify `apps/web/src/lib/ai-usage-guard.ts`
  Extend mock output with optional `tutorIntent` metadata while preserving the existing `agentRoute` behavior and math rendering checks.

- Modify `apps/web/src/lib/ai-usage-guard.test.mts`
  Verify mock text exposes TutorAgent strategy metadata only when present.

- Modify `apps/web/src/app/api/chat/route.ts`
  Pass `tutorStrategy?.intent` into mock output and preserve existing live headers and stream behavior.

---

### Task 1: TutorAgent Strategy Tests

**Files:**
- Create: `packages/agent/tests/tutor.test.ts`
- Modify: `packages/agent/src/nodes/tutor.ts`

- [ ] **Step 1: Write the failing TutorAgent tests**

Create `packages/agent/tests/tutor.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { buildGenericTutorPrompt, buildTutorStrategy } from '../src/nodes/tutor';

describe('buildTutorStrategy', () => {
  it('classifies direct solving requests as explain_solution', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Please explain how to solve this derivative problem.',
      activeStudyContext: 'Find the derivative of f(x)=x^2.',
    });

    expect(strategy.intent).toBe('explain_solution');
    expect(strategy.depth).toBe('deep');
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.shouldUseActiveStudyContext).toBe(true);
    expect(strategy.answerStructure).toContain('known_conditions');
    expect(strategy.answerStructure).toContain('reasoning_steps');
    expect(strategy.answerStructure).toContain('final_answer');
    expect(strategy.promptAddition).toContain('TutorAgent strategy: explain_solution');
    expect(strategy.promptAddition).toContain('Answer in Chinese');
  });

  it('classifies why follow-ups as socratic_hint', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Why can this step be done like this?',
      activeStudyContext: 'Use Green theorem to compute a line integral.',
    });

    expect(strategy.intent).toBe('socratic_hint');
    expect(strategy.depth).toBe('standard');
    expect(strategy.shouldAskGuidingQuestion).toBe(true);
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toContain('guiding_question');
    expect(strategy.debug.matchedSignals).toContain('why');
  });

  it('classifies user submitted steps as step_check', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'I wrote this step. Is it correct?',
      activeStudyContext: 'Solve an integration problem.',
    });

    expect(strategy.intent).toBe('step_check');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toEqual([
      'known_conditions',
      'reasoning_steps',
      'common_mistake',
      'guiding_question',
    ]);
    expect(strategy.promptAddition).toContain('judge the submitted step first');
  });

  it('classifies concept questions as concept_bridge', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'What is the key theorem behind this formula?',
      activeStudyContext: 'A line integral problem.',
    });

    expect(strategy.intent).toBe('concept_bridge');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toContain('concept');
    expect(strategy.promptAddition).toContain('connect the concept back to the active problem');
  });

  it('classifies answer-only requests as answer_direct', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Just give me the final answer.',
      activeStudyContext: 'Find a limit.',
    });

    expect(strategy.intent).toBe('answer_direct');
    expect(strategy.depth).toBe('brief');
    expect(strategy.shouldAskGuidingQuestion).toBe(false);
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.answerStructure[0]).toBe('final_answer');
  });

  it('falls back to general_follow_up for unknown text', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '',
      activeStudyContext: undefined,
    });

    expect(strategy.intent).toBe('general_follow_up');
    expect(strategy.depth).toBe('standard');
    expect(strategy.shouldUseActiveStudyContext).toBe(false);
    expect(strategy.promptAddition).toContain('TutorAgent strategy: general_follow_up');
  });
});

describe('buildGenericTutorPrompt', () => {
  it('returns a compact fallback prompt for policy degradation', () => {
    const prompt = buildGenericTutorPrompt();

    expect(prompt).toContain('TutorAgent generic fallback');
    expect(prompt).toContain('Answer in Chinese');
    expect(prompt.length).toBeLessThan(500);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
bun --cwd packages/agent test tests/tutor.test.ts
```

Expected: FAIL because `buildTutorStrategy` and `buildGenericTutorPrompt` are not exported from `packages/agent/src/nodes/tutor.ts`.

- [ ] **Step 3: Replace the TutorAgent stub with exported types and function signatures**

Modify `packages/agent/src/nodes/tutor.ts`:

```ts
export type TutorIntent =
  | 'explain_solution'
  | 'socratic_hint'
  | 'step_check'
  | 'concept_bridge'
  | 'answer_direct'
  | 'general_follow_up';

export type TutorDepth = 'brief' | 'standard' | 'deep';

export type TutorAnswerSection =
  | 'known_conditions'
  | 'concept'
  | 'reasoning_steps'
  | 'common_mistake'
  | 'final_answer'
  | 'guiding_question';

export type TutorStrategy = {
  intent: TutorIntent;
  depth: TutorDepth;
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  shouldUseActiveStudyContext: boolean;
  answerStructure: TutorAnswerSection[];
  promptAddition: string;
  debug: {
    reason: string;
    matchedSignals: string[];
  };
};

export type BuildTutorStrategyInput = {
  latestUserText: string;
  activeStudyContext?: string;
};

export function buildTutorStrategy(input: BuildTutorStrategyInput): TutorStrategy {
  throw new Error('TutorAgent policy sentinel failure');
}

export function buildGenericTutorPrompt() {
  return [
    'TutorAgent generic fallback.',
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Clarify known conditions, explain the key idea, and keep reasoning steps readable.',
  ].join('\n');
}
```

- [ ] **Step 4: Run the test again**

Run:

```powershell
bun --cwd packages/agent test tests/tutor.test.ts
```

Expected: FAIL with `TutorAgent policy sentinel failure`.

- [ ] **Step 5: Commit the failing tests and signatures**

Run:

```powershell
git add packages/agent/src/nodes/tutor.ts packages/agent/tests/tutor.test.ts
git commit -m "test: add tutor agent policy expectations"
```

---

### Task 2: TutorAgent Strategy Implementation and Exports

**Files:**
- Modify: `packages/agent/src/nodes/tutor.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Implement deterministic strategy classification**

Replace the throwing implementation in `packages/agent/src/nodes/tutor.ts` with:

```ts
type IntentRule = {
  intent: TutorIntent;
  signals: string[];
  reason: string;
};

const intentRules: IntentRule[] = [
  {
    intent: 'answer_direct',
    signals: ['only answer', 'answer only', 'just give me', 'final answer', '直接给答案', '只要答案'],
    reason: 'User explicitly asks for a direct answer.',
  },
  {
    intent: 'step_check',
    signals: ['is it correct', 'am i right', 'check', 'this step', '哪里错', '对吗', '这一步'],
    reason: 'User asks to verify a submitted step.',
  },
  {
    intent: 'concept_bridge',
    signals: ['what is', 'formula', 'theorem', 'concept', '公式', '定理', '概念', '是什么'],
    reason: 'User asks for the concept or theorem behind the problem.',
  },
  {
    intent: 'socratic_hint',
    signals: ['why', 'hint', 'how should i think', '思路', '提示', '为什么', '为什么可以'],
    reason: 'User asks for reasoning guidance rather than only the final answer.',
  },
  {
    intent: 'explain_solution',
    signals: ['how to solve', 'solve', 'explain', '讲一下', '解析', '怎么做'],
    reason: 'User asks for a full solution explanation.',
  },
];

export function buildTutorStrategy(input: BuildTutorStrategyInput): TutorStrategy {
  const text = normalizeText(input.latestUserText);
  const match = findIntent(text);
  const hasActiveStudyContext = Boolean(input.activeStudyContext?.trim());
  const intent = match.intent;
  const depth = selectDepth(intent, hasActiveStudyContext);
  const answerStructure = selectAnswerStructure(intent, hasActiveStudyContext);

  return {
    intent,
    depth,
    shouldAskGuidingQuestion: intent === 'socratic_hint' || intent === 'step_check',
    shouldGiveFinalAnswer: intent === 'answer_direct' || intent === 'explain_solution',
    shouldUseActiveStudyContext: hasActiveStudyContext,
    answerStructure,
    promptAddition: buildTutorPrompt({
      intent,
      depth,
      answerStructure,
      hasActiveStudyContext,
    }),
    debug: {
      reason: match.reason,
      matchedSignals: match.matchedSignals,
    },
  };
}
```

- [ ] **Step 2: Add helper functions in the same file**

Append these helpers below `buildTutorStrategy`:

```ts
function normalizeText(text: string) {
  return text.trim().toLowerCase();
}

function findIntent(text: string): {
  intent: TutorIntent;
  matchedSignals: string[];
  reason: string;
} {
  for (const rule of intentRules) {
    const matchedSignals = rule.signals.filter((signal) =>
      text.includes(signal.toLowerCase()),
    );

    if (matchedSignals.length > 0) {
      return {
        intent: rule.intent,
        matchedSignals,
        reason: rule.reason,
      };
    }
  }

  return {
    intent: 'general_follow_up',
    matchedSignals: [],
    reason: 'No strong tutoring intent signal was matched.',
  };
}

function selectDepth(intent: TutorIntent, hasActiveStudyContext: boolean): TutorDepth {
  if (intent === 'answer_direct') return 'brief';
  if (intent === 'explain_solution' && hasActiveStudyContext) return 'deep';
  return 'standard';
}

function selectAnswerStructure(
  intent: TutorIntent,
  hasActiveStudyContext: boolean,
): TutorAnswerSection[] {
  if (intent === 'answer_direct') {
    return ['final_answer', 'reasoning_steps'];
  }

  if (intent === 'step_check') {
    return ['known_conditions', 'reasoning_steps', 'common_mistake', 'guiding_question'];
  }

  if (intent === 'concept_bridge') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'];
  }

  if (intent === 'socratic_hint') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'];
  }

  if (intent === 'explain_solution') {
    return ['known_conditions', 'concept', 'reasoning_steps', 'final_answer'];
  }

  return hasActiveStudyContext
    ? ['known_conditions', 'reasoning_steps', 'guiding_question']
    : ['concept', 'reasoning_steps'];
}

function buildTutorPrompt(input: {
  intent: TutorIntent;
  depth: TutorDepth;
  answerStructure: TutorAnswerSection[];
  hasActiveStudyContext: boolean;
}) {
  return [
    `TutorAgent strategy: ${input.intent}`,
    `TutorAgent depth: ${input.depth}`,
    `Answer structure: ${input.answerStructure.join(' -> ')}`,
    input.hasActiveStudyContext
      ? 'Start from the active OCR question context when it is relevant.'
      : 'No active OCR question context is available; use the latest user message and recent conversation.',
    ...buildIntentInstructions(input.intent),
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Use readable Markdown. Keep formulas in $...$ or $$...$$ form.',
  ].join('\n');
}

function buildIntentInstructions(intent: TutorIntent) {
  if (intent === 'answer_direct') {
    return [
      'Give the final answer first.',
      'Add concise reasoning after the answer.',
      'Do not end with a Socratic question unless the user asks for guidance.',
    ];
  }

  if (intent === 'step_check') {
    return [
      'Judge the submitted step first.',
      'If the step is wrong, identify the exact issue before giving the correction.',
      'Avoid rewriting the entire solution unless the missing context makes that necessary.',
    ];
  }

  if (intent === 'concept_bridge') {
    return [
      'Explain the concept, theorem, or formula in exam-oriented language.',
      'Connect the concept back to the active problem.',
      'Use a small example only when it reduces confusion.',
    ];
  }

  if (intent === 'socratic_hint') {
    return [
      'Do not dump the full final answer immediately.',
      'Explain the key basis behind the step.',
      'End with one guiding question that helps the user continue.',
    ];
  }

  if (intent === 'explain_solution') {
    return [
      'Restate the known conditions before solving.',
      'Explain the key method before calculations.',
      'Split reasoning into separate readable steps and include the final answer.',
    ];
  }

  return [
    'Answer normally as a tutor.',
    'Use the active study context when it helps the current question.',
    'Keep the answer structured and concise.',
  ];
}
```

- [ ] **Step 3: Keep the generic fallback prompt**

Ensure `buildGenericTutorPrompt` remains:

```ts
export function buildGenericTutorPrompt() {
  return [
    'TutorAgent generic fallback.',
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Clarify known conditions, explain the key idea, and keep reasoning steps readable.',
  ].join('\n');
}
```

- [ ] **Step 4: Export TutorAgent from package root**

Modify `packages/agent/src/index.ts`:

```ts
export * from './graph';
export * from './nodes/tutor';
export * from './recorder';
export * from './router';
export * from './runtime';
export * from './state';
export * from './thresholds';
```

- [ ] **Step 5: Add a package subpath export**

Modify `packages/agent/package.json`:

```json
"exports": {
  ".": "./src/index.ts",
  "./router": "./src/router.ts",
  "./tutor": "./src/nodes/tutor.ts"
}
```

- [ ] **Step 6: Run package tests and typecheck**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: PASS. Existing runtime tests must still pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add packages/agent/src/nodes/tutor.ts packages/agent/src/index.ts packages/agent/package.json packages/agent/tests/tutor.test.ts
git commit -m "feat: add tutor agent policy"
```

---

### Task 3: Web Chat Agent Adapter Integration

**Files:**
- Modify: `apps/web/src/lib/chat-agent-runtime.ts`
- Modify: `apps/web/src/lib/chat-agent-runtime.test.mts`

- [ ] **Step 1: Extend web adapter tests**

Modify `apps/web/src/lib/chat-agent-runtime.test.mts`.

Update the imports:

```ts
import type { TutorStrategy } from '@repo/agent/tutor';
```

In the existing tutor route test, add:

```ts
  assert.equal(decision.tutorStrategy?.intent, 'socratic_hint');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-intent'], 'socratic_hint');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-depth'], 'standard');
```

Append:

```ts
test('does not call TutorAgent policy for non-tutor routes', () => {
  let called = false;
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'hello' }],
    activeContext: null,
    runId: 'run_non_tutor',
    userId: 'user_1',
    tutorPolicy: () => {
      called = true;
      throw new Error('should not be called');
    },
  });

  assert.equal(decision.route, 'chat');
  assert.equal(called, false);
  assert.equal(decision.tutorStrategy, undefined);
});

test('keeps tutor route and generic tutor prompt when TutorAgent policy throws', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'Why can this step be done like this?' }],
    activeContext,
    runId: 'run_tutor_degraded',
    userId: 'user_1',
    tutorPolicy: () => {
      throw new Error('tutor failed');
    },
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.degraded, true);
  assert.equal(decision.tutorStrategy, undefined);
  assert.match(decision.promptAddition, /TutorAgent generic fallback/);
  assert.equal(decision.debugHeaders['x-prepmind-agent-degraded'], 'true');
});

test('uses injected TutorAgent policy result for tutor route metadata', () => {
  const customStrategy: TutorStrategy = {
    intent: 'answer_direct',
    depth: 'brief',
    shouldAskGuidingQuestion: false,
    shouldGiveFinalAnswer: true,
    shouldUseActiveStudyContext: true,
    answerStructure: ['final_answer', 'reasoning_steps'],
    promptAddition: 'custom tutor prompt',
    debug: {
      reason: 'test',
      matchedSignals: ['answer only'],
    },
  };

  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'Why can this step be done like this?' }],
    activeContext,
    runId: 'run_tutor_custom',
    userId: 'user_1',
    tutorPolicy: () => customStrategy,
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.tutorStrategy, customStrategy);
  assert.equal(decision.promptAddition, 'custom tutor prompt');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-intent'], 'answer_direct');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-depth'], 'brief');
});
```

- [ ] **Step 2: Run the failing web adapter test**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-agent-runtime.test.mts
```

Expected: FAIL because `ChatAgentDecision` does not expose `tutorStrategy`, and `buildChatAgentDecision` does not accept `tutorPolicy`.

- [ ] **Step 3: Import TutorAgent policy**

Modify `apps/web/src/lib/chat-agent-runtime.ts` imports:

```ts
import { routeAgentRequest } from '@repo/agent/router';
import {
  buildGenericTutorPrompt,
  buildTutorStrategy,
  type BuildTutorStrategyInput,
  type TutorStrategy,
} from '@repo/agent/tutor';
```

- [ ] **Step 4: Extend adapter types**

In `apps/web/src/lib/chat-agent-runtime.ts`, add `tutorStrategy`:

```ts
export type ChatAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
  tutorStrategy?: TutorStrategy;
  promptAddition: string;
  debugHeaders: Record<string, string>;
  degraded: boolean;
};
```

Extend `BuildChatAgentDecisionInput`:

```ts
  tutorPolicy?: (input: BuildTutorStrategyInput) => TutorStrategy;
```

- [ ] **Step 5: Pass latest user text to decision construction**

Change `buildChatAgentDecision`:

```ts
export function buildChatAgentDecision(
  input: BuildChatAgentDecisionInput,
): ChatAgentDecision {
  try {
    const latestUserText = getLatestUserText(input.messages);
    const state = createChatAgentState(input, latestUserText);
    const route = (input.router ?? routeAgentRequest)(state);

    return toDecision(route, false, {
      latestUserText,
      activeStudyContext: input.activeContext?.questionText,
      tutorPolicy: input.tutorPolicy,
    });
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
```

Update `createChatAgentState` signature:

```ts
function createChatAgentState(input: BuildChatAgentDecisionInput, latestUserText: string): AgentState {
```

and set:

```ts
      text: latestUserText,
```

- [ ] **Step 6: Add TutorAgent-aware decision conversion**

Replace `toDecision` with:

```ts
function toDecision(
  route: RouterResult,
  degraded: boolean,
  tutorInput?: BuildTutorStrategyInput & {
    tutorPolicy?: (input: BuildTutorStrategyInput) => TutorStrategy;
  },
): ChatAgentDecision {
  const debugHeaders: Record<string, string> = {
    'x-prepmind-agent-route': route.name,
    'x-prepmind-agent-confidence': route.confidence.toFixed(2),
    'x-prepmind-agent-rag-required': String(route.requiresRag),
  };

  let tutorStrategy: TutorStrategy | undefined;
  let promptAddition = buildRoutePromptAddition(route.name);
  let isDegraded = degraded;

  if (route.name === 'tutor' && tutorInput) {
    try {
      tutorStrategy = (tutorInput.tutorPolicy ?? buildTutorStrategy)({
        latestUserText: tutorInput.latestUserText,
        activeStudyContext: tutorInput.activeStudyContext,
      });
      promptAddition = tutorStrategy.promptAddition;
      debugHeaders['x-prepmind-tutor-intent'] = tutorStrategy.intent;
      debugHeaders['x-prepmind-tutor-depth'] = tutorStrategy.depth;
    } catch {
      promptAddition = buildGenericTutorPrompt();
      isDegraded = true;
    }
  }

  if (isDegraded) {
    debugHeaders['x-prepmind-agent-degraded'] = 'true';
  }

  return {
    route: route.name,
    confidence: route.confidence,
    reason: route.reason,
    requiresRag: route.requiresRag,
    requiresHumanApproval: route.requiresHumanApproval,
    tutorStrategy,
    promptAddition,
    debugHeaders,
    degraded: isDegraded,
  };
}
```

- [ ] **Step 7: Run focused web adapter test**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/chat-agent-runtime.test.mts
```

Expected: PASS.

- [ ] **Step 8: Run broader web tests**

Run:

```powershell
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
git add apps/web/src/lib/chat-agent-runtime.ts apps/web/src/lib/chat-agent-runtime.test.mts
git commit -m "feat: apply tutor agent strategy to chat adapter"
```

---

### Task 4: Mock Output Tutor Strategy Metadata

**Files:**
- Modify: `apps/web/src/lib/ai-usage-guard.ts`
- Modify: `apps/web/src/lib/ai-usage-guard.test.mts`
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Add failing mock metadata test**

In `apps/web/src/lib/ai-usage-guard.test.mts`, append:

```ts
test('shows tutor strategy metadata in mock output when provided', () => {
  const text = createMockChatText({
    hasActiveContext: true,
    latestUserText: 'Why can this step be done like this?',
    agentRoute: 'tutor',
    tutorIntent: 'socratic_hint',
  });

  assert.match(text, /TutorAgent/);
  assert.match(text, /socratic_hint/);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});

test('does not show tutor strategy metadata for normal chat mock output', () => {
  const text = createMockChatText({
    hasActiveContext: false,
    latestUserText: 'hello',
    agentRoute: 'chat',
  });

  assert.doesNotMatch(text, /socratic_hint/);
  assert.match(text, /normal Chat path/);
});
```

- [ ] **Step 2: Run the failing mock test**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
```

Expected: FAIL because `createMockChatText` does not accept or render `tutorIntent`.

- [ ] **Step 3: Extend mock type imports and input**

Modify `apps/web/src/lib/ai-usage-guard.ts`.

Add:

```ts
import type { TutorIntent } from '@repo/agent/tutor';
```

Extend `createMockChatText` input:

```ts
export function createMockChatText(input: {
  hasActiveContext: boolean;
  latestUserText?: string;
  agentRoute?: AgentRoute;
  tutorIntent?: TutorIntent;
}) {
```

- [ ] **Step 4: Add tutor metadata to mock output**

Inside `createMockChatText`, after `contextLine`, add:

```ts
  const tutorLine = formatMockTutorStrategy(input.tutorIntent);
```

In the returned template, place `${tutorLine}` after `${formatMockAgentRoute(input.agentRoute)}`:

```ts
${formatMockAgentRoute(input.agentRoute)}

${tutorLine}

1. ...
```

Add helper:

```ts
function formatMockTutorStrategy(intent?: TutorIntent) {
  if (!intent) return '';

  return `TutorAgent strategy: ${intent}. Mock mode shows strategy metadata only and does not call a live model.`;
}
```

- [ ] **Step 5: Pass tutor intent from chat route**

Modify `apps/web/src/app/api/chat/route.ts`.

Inside `createMockChatResponse`, update `createMockChatText`:

```ts
  const mockText = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
    agentRoute: input.agentDecision.route,
    tutorIntent: input.agentDecision.tutorStrategy?.intent,
  });
```

No live response code changes are needed because headers already spread `agentDecision.debugHeaders`.

- [ ] **Step 6: Run mock and web tests**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/ai-usage-guard.test.mts
bun --filter @repo/web test
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/src/lib/ai-usage-guard.ts apps/web/src/lib/ai-usage-guard.test.mts apps/web/src/app/api/chat/route.ts
git commit -m "feat: show tutor strategy in mock chat"
```

---

### Task 5: Full Verification and Phase 6.2 Readiness

**Files:**
- No implementation files.

- [ ] **Step 1: Run agent checks**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: PASS.

- [ ] **Step 2: Run shared type checks**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: PASS.

- [ ] **Step 3: Run web checks**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: PASS.

- [ ] **Step 4: Inspect package exports**

Run:

```powershell
bun --cwd packages/agent typecheck
bun --filter @repo/web build
```

Expected: PASS, confirming `@repo/agent/tutor` resolves from the web app.

- [ ] **Step 5: Confirm no live model calls were introduced**

Run:

```powershell
rg "AI_ENABLE_LIVE_CALLS|AI_PROVIDER_MODE|streamText|aiProvider" packages/agent apps/web/src/lib apps/web/src/app/api/chat
```

Expected:

- `packages/agent/src/nodes/tutor.ts` has no `streamText`, `aiProvider`, API key, or live model call.
- live model usage remains inside `apps/web/src/app/api/chat/route.ts`.
- provider switches remain controlled by existing `AI_PROVIDER_MODE` and `AI_ENABLE_LIVE_CALLS` code.

- [ ] **Step 6: Check git status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree after implementation commits.

---

## Self-Review Checklist

- The plan implements TutorAgent as a pure deterministic policy module.
- The plan does not make TutorAgent call a live model.
- The plan keeps `/api/chat` as the only owner of streaming provider calls.
- The plan keeps RAG retrieval and citations unchanged.
- The plan keeps active OCR context flowing through the existing chat prompt.
- The plan exposes `x-prepmind-tutor-intent` and `x-prepmind-tutor-depth` only when a tutor strategy exists.
- The plan preserves fallback behavior when RouterAgent or TutorAgent policy fails.
- The plan updates mock output without changing markdown/math rendering checks.
- The plan does not execute ReviewAgent, PlannerAgent, MemoryAgent, WrongQuestionOrganizerAgent, KnowledgeVerifierAgent, or write actions.
- The plan provides focused tests before implementation and broad verification before merge.
