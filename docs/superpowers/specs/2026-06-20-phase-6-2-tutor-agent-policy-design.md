# Phase 6.2 TutorAgent Policy Design

## Background

Phase 6.1 has connected the existing chat route to `RouterAgent`. The web chat flow now receives route metadata, adds route-aware prompt guidance, and keeps the original streaming, OCR context, RAG, mock/live switch, and token budget behavior.

The current `tutor` route is still shallow. It tells the model to behave like a tutor, but there is no reusable `TutorAgent` policy that can decide how the answer should be taught. Phase 6.2 should turn TutorAgent from a prompt hint into a small, testable strategy layer.

## Goal

Build a reusable TutorAgent policy module that classifies tutoring intent, produces a structured teaching strategy, and feeds that strategy into the existing chat prompt without replacing the current model streaming path.

## Non-Goals

- Do not replace `/api/chat` with a full LangGraph execution chain.
- Do not make TutorAgent call a live model directly.
- Do not persist AgentRun or AgentStep to PostgreSQL yet.
- Do not implement KnowledgeVerifierAgent, WrongQuestionOrganizerAgent, ReviewAgent, PlannerAgent, or MemoryAgent.
- Do not change WrongQuestion CRUD, ReviewTask, RAG document APIs, or OCR parsing behavior.
- Do not enable live model calls by default.
- Do not change the frontend streaming protocol.

## Recommended Approach

Use a pure `@repo/agent` module for TutorAgent policy:

```text
packages/agent/src/nodes/tutor.ts
```

The module should expose deterministic functions that inspect the latest user text, active OCR context, and route information, then return a strategy object. The web adapter in `apps/web/src/lib/chat-agent-runtime.ts` should consume that strategy and append a compact prompt addition to `/api/chat`.

This keeps the implementation low cost and testable:

- RouterAgent still decides whether this is a tutoring request.
- TutorAgent decides how to tutor.
- `/api/chat` still streams the final model output.
- Existing RAG and OCR context stay authoritative.
- Mock mode remains useful without external model calls.

## Tutor Strategy Contract

Phase 6.2 should add a small contract under `@repo/types` or keep it package-local if no cross-package consumer needs schema validation yet.

Recommended shape:

```ts
type TutorIntent =
  | 'explain_solution'
  | 'socratic_hint'
  | 'step_check'
  | 'concept_bridge'
  | 'answer_direct'
  | 'general_follow_up';

type TutorDepth = 'brief' | 'standard' | 'deep';

type TutorStrategy = {
  intent: TutorIntent;
  depth: TutorDepth;
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  shouldUseActiveStudyContext: boolean;
  answerStructure: Array<
    | 'known_conditions'
    | 'concept'
    | 'reasoning_steps'
    | 'common_mistake'
    | 'final_answer'
    | 'guiding_question'
  >;
  promptAddition: string;
  debug: {
    reason: string;
    matchedSignals: string[];
  };
};
```

If the project prefers fewer shared types in this stage, `TutorStrategy` can start inside `packages/agent/src/nodes/tutor.ts` and only export TypeScript types from `@repo/agent/tutor`.

## Tutoring Modes

### `explain_solution`

Used when the user asks how to solve a problem or asks for a complete explanation.

Behavior:

- restate known conditions from OCR context when available;
- explain the key method before calculations;
- split reasoning into readable steps;
- give the final answer if the user clearly asks for solving.

### `socratic_hint`

Used when the user asks "why", "how should I think", or appears to be learning rather than asking for a direct answer.

Behavior:

- avoid dumping the full solution first;
- identify the next useful concept or transformation;
- ask one guiding question at the end;
- still answer directly if the user explicitly requests the answer.

### `step_check`

Used when the user gives their own step and asks whether it is correct.

Behavior:

- judge the submitted step first;
- point out the exact issue if incorrect;
- explain the correction;
- avoid rewriting the entire solution unless needed.

### `concept_bridge`

Used when the user asks about a concept behind a problem, such as a theorem, formula, or transformation.

Behavior:

- explain the concept in exam-oriented language;
- connect it back to the active problem;
- give a small example if it reduces confusion.

### `answer_direct`

Used when the user explicitly asks for only the answer or wants fast verification.

Behavior:

- give the answer first;
- include concise reasoning after it;
- avoid excessive Socratic questioning.

### `general_follow_up`

Fallback tutoring mode.

Behavior:

- answer normally;
- use active study context if present;
- keep structure readable.

## Intent Signals

TutorAgent should start with deterministic signal matching rather than a model call.

Examples:

| Signal | Intent |
| --- | --- |
| "怎么做", "讲一下", "解析", "solve", "explain" | `explain_solution` |
| "为什么", "为什么可以", "思路", "hint" | `socratic_hint` |
| "我这样对吗", "这一步", "哪里错", "check" | `step_check` |
| "是什么", "公式", "定理", "概念" | `concept_bridge` |
| "只要答案", "直接给答案", "answer only" | `answer_direct` |

Active OCR context should increase confidence for tutoring behavior, but it should not force every message into a heavy solution format. If the latest user message is clearly a casual message, TutorAgent can still use `general_follow_up`.

## Prompt Composition

Phase 6.1 prompt order remains:

```text
BASE_SYSTEM_PROMPT
  -> active OCR context from buildChatSystemPrompt
  -> agent route / tutor strategy prompt addition
  -> RAG knowledge context prompt
```

Phase 6.2 should replace the current generic Tutor prompt addition with a strategy-specific prompt:

```text
TutorAgent strategy: socratic_hint
- Start from the active question context if available.
- Do not give the full final answer immediately unless the user asks directly.
- Explain the key basis of the step.
- End with one guiding question.
```

The strategy prompt must be short. It controls answer shape; it should not duplicate the full OCR question or RAG content.

## Web Integration

Modify `apps/web/src/lib/chat-agent-runtime.ts` so that:

- `buildChatAgentDecision` calls TutorAgent policy only when the route is `tutor`;
- non-tutor routes keep their current behavior;
- TutorAgent failures degrade to the existing generic tutor prompt or normal chat;
- debug headers expose strategy metadata without leaking sensitive content.

Recommended headers:

- `x-prepmind-agent-route`
- `x-prepmind-agent-confidence`
- `x-prepmind-agent-rag-required`
- `x-prepmind-tutor-intent`
- `x-prepmind-tutor-depth`
- optional `x-prepmind-agent-degraded`

## Mock Behavior

Mock mode should show the chosen Tutor strategy briefly, so local validation can confirm routing and policy behavior without spending tokens.

Example mock text:

```markdown
已按 TutorAgent 的 `socratic_hint` 策略处理这次追问。

我们先抓住关键条件，再看这一步为什么成立。
```

Mock output should still preserve formula rendering behavior and should not invent a real full solution.

## Error Handling

- If RouterAgent fails, keep the Phase 6.1 fallback to `chat`.
- If TutorAgent policy fails, keep route `tutor` but use a generic tutor prompt and set degraded metadata.
- If active OCR context is missing, TutorAgent should still answer from recent messages.
- If RAG fails, chat continues as normal.
- If the token budget drops RAG prompt, Tutor strategy prompt should remain because it is short and behavior-critical.
- If live model fails, preserve the existing chat error response.

## Testing Requirements

### `@repo/agent`

Add tests for:

- direct solving request -> `explain_solution`;
- "why" follow-up with active context -> `socratic_hint`;
- user-submitted step -> `step_check`;
- formula/concept question -> `concept_bridge`;
- "only answer" request -> `answer_direct`;
- empty or unknown text -> `general_follow_up`;
- prompt addition is non-empty, compact, and Chinese-first.

### `apps/web`

Add or update tests for:

- tutor route calls TutorAgent policy;
- non-tutor route does not call TutorAgent policy;
- TutorAgent failure degrades without breaking chat;
- debug headers include tutor intent and depth;
- mock output includes route and tutor strategy metadata;
- combined prompt keeps Tutor strategy before RAG context.

## Verification Commands

Run focused checks first:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --filter @repo/web test -- chat-agent-runtime ai-usage-guard
```

Then run broader checks before merge:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

If package exports change, also run:

```powershell
bun --cwd packages/types typecheck
```

## Live Model Validation

Live validation is optional and should only happen after mock and unit tests pass.

Rules:

- set `AI_PROVIDER_MODE=live`;
- set `AI_ENABLE_LIVE_CALLS=true`;
- use `deepseek-v4-flash`;
- keep `AI_MAX_INPUT_TOKENS <= 2500`;
- keep `AI_MAX_OUTPUT_TOKENS <= 1200`;
- test no more than 3 to 5 fixed prompts;
- record whether the model follows the intended tutoring mode.

Suggested prompts:

1. OCR follow-up: "为什么这一步可以这样变形？"
2. Direct solve: "讲一下这道导数题怎么做。"
3. Step check: "我这样写对吗？"
4. Direct answer: "直接告诉我答案。"

## Acceptance Criteria

1. TutorAgent policy exists as a reusable package module.
2. Tutor requests produce structured strategy metadata.
3. `/api/chat` keeps existing streaming, OCR, RAG, mock/live, and token budget behavior.
4. Tutor strategy prompt is inserted only for tutor route.
5. Tutor policy failure does not break chat.
6. Mock mode visibly reflects Tutor strategy.
7. Tests cover strategy classification, prompt generation, web adapter integration, and degradation.
8. No external model call is introduced by TutorAgent policy itself.

## Implementation Sequence

1. Add TutorAgent policy tests in `packages/agent/tests/tutor.test.ts`.
2. Replace the current `packages/agent/src/nodes/tutor.ts` stub with a pure strategy module.
3. Export the TutorAgent module through `packages/agent/package.json`.
4. Update `apps/web/src/lib/chat-agent-runtime.ts` to consume Tutor strategy for `tutor` route.
5. Update mock response generation to show Tutor strategy metadata.
6. Run focused tests.
7. Run broader web checks.
8. Update docs only if implementation behavior differs from this design.
