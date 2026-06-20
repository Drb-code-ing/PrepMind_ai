# Phase 6.1 Router + Tutor Chat Integration Design

## Background

Phase 6.0 has landed the Agent runtime foundation: shared contracts, deterministic RouterAgent, threshold guards, in-memory run recorder, degradation runtime, and graph descriptor.

Phase 6.1 should connect this foundation to the existing Chat/OCR tutoring path without rewriting the product's core chat experience. The current `/api/chat` route already handles:

- mock/live model mode switching,
- streaming response protocol,
- active OCR question context injection,
- token budget trimming,
- RAG search and citation markdown,
- graceful fallback when retrieval fails.

The first business integration must preserve those guarantees. Phase 6.1 is therefore a thin integration layer, not a full Agent rewrite.

## Goal

Route chat requests through RouterAgent and use TutorAgent-style prompt behavior when the route is `tutor`, while keeping the existing chat streaming, RAG, OCR context, and cost-control behavior stable.

## Non-Goals

- Do not implement ReviewAgent, PlannerAgent, MemoryAgent, WrongQuestionOrganizerAgent, or KnowledgeVerifierAgent.
- Do not persist AgentRun / AgentStep to PostgreSQL yet.
- Do not introduce background queues.
- Do not add ActionProposal UI.
- Do not change WrongQuestion CRUD or ReviewTask behavior.
- Do not enable live model calls by default.
- Do not replace the current RAG retrieval implementation.
- Do not change the frontend streaming protocol.

## Current Chat Flow

The current `/api/chat` flow is:

```text
Request
  -> validate messages
  -> get AI provider status
  -> normalize active OCR context
  -> search user knowledge base when accessToken exists
  -> build knowledge context prompt
  -> build chat request budget
  -> if mock: stream mock text
  -> if live: stream model text
  -> append citations
```

Phase 6.1 should insert Router/Tutor decisions before budget construction:

```text
Request
  -> validate messages
  -> normalize active OCR context
  -> run lightweight Agent router
  -> build route-aware system prompt
  -> continue existing RAG / budget / streaming flow
```

## Recommended Approach

Use a new small web-side adapter around `@repo/agent`, rather than calling `runAgentRuntime` as the final answer generator.

Reason:

- `runAgentRuntime` currently returns placeholder markdown, which is useful for Phase 6.0 tests but not suitable to replace the existing streaming model output.
- `/api/chat` already owns streaming and provider behavior.
- Phase 6.1 needs Agent routing metadata and prompt shaping, not a second response generator.

Recommended module:

```text
apps/web/src/lib/chat-agent-runtime.ts
```

Responsibilities:

- Build an `AgentState` from latest user text, conversation id, user id fallback, and active OCR context.
- Call `routeAgentRequest`.
- Return `ChatAgentDecision`.
- Build route-specific system prompt additions.
- Expose headers/debug metadata for the chat route.
- Never call a live model.
- Never write data.

## ChatAgentDecision

Phase 6.1 should introduce a local web adapter type:

```ts
type ChatAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
  promptAddition: string;
  debugHeaders: Record<string, string>;
};
```

This is intentionally smaller than full `AgentState`. The Chat API only needs routing and prompt behavior.

## Routing Behavior

### chat

Default route. Behavior remains the same as today.

Prompt addition:

- empty string or a very small no-op instruction.

### tutor

Used for OCR question follow-up, "why", "how to solve", "explain this step", and similar tutoring requests.

Prompt addition:

- answer in Socratic tutoring style when appropriate,
- first clarify known conditions,
- avoid dumping only the final answer,
- ask one guiding question if the user's intent is exploratory,
- if the user asks directly for the answer, give the answer but include reasoning,
- preserve current Markdown/math formatting rules.

This prompt must cooperate with `activeStudyContext`, not duplicate or overwrite it.

### rag_answer

Phase 6.1 should not replace existing RAG. The route can mark `requiresRag=true`, but the current `searchKnowledgeForChat` function remains the retrieval path.

Prompt addition:

- treat retrieved chunks as references, not absolute truth,
- cite sources when useful,
- if no hit exists, answer normally.

### study_plan / review_analysis / wrong_question_organize

In Phase 6.1 these routes should not trigger their corresponding business Agent.

Behavior:

- keep normal chat answer,
- optionally add a short prompt hint that the user is asking for a plan/review/organization suggestion,
- do not write data,
- do not create proposals yet.

This prevents RouterAgent from making the chat route accidentally perform Phase 6.4+ work.

## Headers and Observability

`/api/chat` should add lightweight debug headers:

- `x-prepmind-agent-route`
- `x-prepmind-agent-confidence`
- `x-prepmind-agent-rag-required`

Existing headers must remain:

- `x-prepmind-ai-mode`
- `x-prepmind-rag-hit-count`

If RouterAgent fails, the route should fall back to `chat` and set:

- `x-prepmind-agent-route: chat`
- `x-prepmind-agent-degraded: true`

No full sensitive prompt or message content should be written to headers.

## Prompt Composition

Prompt order should be:

```text
BASE_SYSTEM_PROMPT
  -> active OCR context from buildChatSystemPrompt
  -> agent route prompt addition
  -> RAG knowledge context prompt
```

This order keeps the product identity and OCR context stable, then adds route-specific behavior, then adds retrieved evidence.

Implementation detail:

- `buildChatRequestBudget` already supports `additionalSystemPrompt`.
- Phase 6.1 should combine agent prompt addition and RAG prompt before passing `additionalSystemPrompt`.
- If token budget overflows and RAG prompt is removed, the Agent prompt addition should remain because it is short and controls behavior.

## Mock Response Behavior

Mock mode should make Agent routing visible without pretending to be a real model.

Recommended changes:

- extend `createMockChatText` input with optional `agentRoute`;
- when route is `tutor`, include a mock line that says the request is being handled as a tutoring route;
- when route is `rag_answer`, keep citation behavior unchanged;
- do not generate fake ReviewAgent or MemoryAgent analysis.

This keeps local UI testing useful while avoiding fake intelligence.

## Live Model Validation

Live model validation is optional for Phase 6.1 and should only be used after mock tests pass.

Rules:

- require `AI_PROVIDER_MODE=live`;
- require `AI_ENABLE_LIVE_CALLS=true`;
- use a small fixed set of 3 to 5 prompts;
- keep `AI_MAX_INPUT_TOKENS <= 2500`;
- keep `AI_MAX_OUTPUT_TOKENS <= 1200`;
- prefer `deepseek-v4-flash`;
- record observed behavior manually in the development log if live validation is performed.

Suggested live cases:

1. OCR follow-up: "为什么这一步可以这样变形？"
2. Direct tutoring: "讲一下这道极限题怎么做。"
3. RAG question with uploaded notes.
4. General chat that should not trigger TutorAgent.

## Error Handling

- If RouterAgent throws, fall back to `chat`.
- If agent prompt construction fails, continue with the existing system prompt.
- If RAG fails, continue with normal answer as today.
- If token budget overflows, preserve existing 413 behavior.
- If live model fails, preserve current `CHAT_ERROR_MESSAGE`.

## Testing Requirements

### Package tests

`@repo/agent`:

- keep existing router/runtime tests passing;
- add route cases if Router keywords are adjusted.

`apps/web`:

- test `buildChatAgentDecision` for `chat`, `tutor`, `rag_answer`, and degradation.
- test prompt composition keeps Agent prompt when RAG prompt is dropped.
- test `createMockChatText` reflects Tutor route without breaking formula rendering.
- test request body remains backward compatible.

### Integration-level checks

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
```

If feasible before merge:

```powershell
bun --filter @repo/web build
```

## Acceptance Criteria

1. `/api/chat` includes Agent route headers in mock and live modes.
2. OCR follow-up questions route to `tutor` when active OCR context exists.
3. Generic messages still route to `chat`.
4. RAG questions still use the existing knowledge search and citation markdown.
5. Review/Memory/Planner/Organizer Agents are not executed.
6. Existing streaming behavior is unchanged from the frontend perspective.
7. Mock mode remains the default and does not call any external model.
8. Router failure does not break chat.
9. Tests cover route decision, prompt addition, mock response changes, and degradation.

## Implementation Sequence

1. Add `apps/web/src/lib/chat-agent-runtime.ts` and tests.
2. Extend `createMockChatText` with route-aware mock hints.
3. Update `/api/chat` to call the adapter and add headers.
4. Keep RAG and token budget logic unchanged except prompt composition.
5. Run focused tests and web checks.
6. Update docs after implementation if the final behavior differs from this design.
