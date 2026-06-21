# Phase 6.3 KnowledgeVerifierAgent Design

## Background

Phase 5.5 connected Chat to the user knowledge base. When RAG hits exist,
`/api/chat` injects retrieved chunks into the system prompt and appends Markdown
citations. Phase 6.1 and Phase 6.2 then added RouterAgent and TutorAgent prompt
strategy without changing the existing streaming model path.

The current RAG boundary is intentionally conservative: retrieved user notes are
references, not guaranteed truth. Phase 6.3 adds `KnowledgeVerifierAgent` as a
low-cost credibility layer so Chat can avoid blindly following suspicious or
conflicting user material.

## Goal

Add a deterministic `KnowledgeVerifierAgent` policy that evaluates retrieved RAG
chunks before prompt injection and exposes a structured verifier result to the
Chat flow. The verifier should keep Chat non-blocking, reduce blind trust in
uploaded notes, and give the user a gentle note when source material needs
checking.

## Non-Goals

- Do not introduce a second live model call for verification by default.
- Do not replace the existing `/knowledge/search` API.
- Do not block ordinary Chat when RAG has no hits, retrieval fails, or verifier
  evaluation degrades.
- Do not rewrite the final answer after streaming.
- Do not edit, delete, or mark uploaded documents as wrong.
- Do not implement KnowledgeDedupAgent, WrongQuestionOrganizerAgent,
  PlannerAgent, ReviewAgent, or MemoryAgent.
- Do not change the frontend streaming protocol.
- Do not enable live model calls by default.

## Recommended Approach

Use a pure deterministic module in `@repo/agent`:

```text
packages/agent/src/nodes/knowledge-verifier.ts
```

The module accepts the latest user question and normalized RAG chunks, then
returns:

```ts
type KnowledgeVerifierStatus =
  | 'trusted'
  | 'suspicious'
  | 'conflict'
  | 'insufficient'
  | 'skipped';

type KnowledgeVerifierResult = {
  status: KnowledgeVerifierStatus;
  reason: string;
  userNotice?: string;
  promptAddition: string;
  debug: {
    checkedChunkCount: number;
    lowScoreChunkCount: number;
    conflictSignals: string[];
    suspiciousSignals: string[];
  };
};
```

The existing `@repo/types/api/agent` already has `verifierResult` with
`trusted | suspicious | conflict | insufficient | skipped`, so Phase 6.3 can keep
the shared contract stable and expose the richer package-local prompt/debug data
through `@repo/agent/knowledge-verifier`.

## Verification Heuristics

The first version should stay practical and cheap:

- `skipped`: no RAG hits.
- `insufficient`: all hits are below the useful score threshold or chunk content
  is too thin to support an answer.
- `conflict`: multiple chunks contain explicit contradiction markers or mutually
  incompatible answer/result markers.
- `suspicious`: chunks contain uncertainty or error markers such as "可能有误",
  "待核对", "不确定", "contradict", "wrong", or "needs verification".
- `trusted`: at least one useful chunk exists and no strong suspicious/conflict
  signal is found.

This is not a correctness oracle. It is a guardrail that tells the final model
how carefully to use retrieved material.

## Prompt Behavior

`buildKnowledgeContextPrompt` should include verifier instructions only when RAG
hits exist:

- `trusted`: use retrieved chunks as supporting evidence, still reason normally.
- `insufficient`: do not force citations as proof; answer from general knowledge
  if the chunks are weak.
- `suspicious`: do not blindly follow the notes; compare with problem
  conditions and general knowledge.
- `conflict`: state that retrieved notes conflict and give the reasoning basis
  before choosing a position.

The prompt addition should stay short so token budget pressure prefers dropping
long RAG chunk text before dropping Agent/Tutor behavior instructions.

## User-Facing Notice

If the verifier result is `suspicious`, `conflict`, or `insufficient`,
`appendCitationMarkdown` should add a short section after citations:

```markdown
### 资料核对提示

检索到的资料可能需要核对：...
```

Rules:

- The notice must be gentle. Avoid saying "你的笔记是错的".
- No notice when status is `trusted` or `skipped`.
- No fabricated document correction.
- Citations still show the original retrieved sources.

## Chat Integration

Phase 6.3 should integrate at the web RAG layer:

```text
Request
  -> RouterAgent / TutorAgent decision
  -> searchKnowledgeForChat
  -> KnowledgeVerifierAgent evaluates hits
  -> buildKnowledgeContextPrompt(hits, verifier)
  -> combine Agent prompt + verifier-aware RAG prompt
  -> existing mock/live streaming
  -> append citations + optional verifier notice
```

`/api/chat` should expose debug headers:

- `x-prepmind-knowledge-verifier-status`
- `x-prepmind-knowledge-verifier-chunks`

Do not expose full chunk text or user prompts in headers.

## Mock and Live Behavior

Mock mode should show verifier status when RAG hits exist. It should not pretend
to have verified correctness with a live model.

Live validation is required as a small smoke after tests pass because
`docs/ai-behavior-acceptance.md` marks KnowledgeVerifierAgent prompt behavior as
live-smoke territory. Use:

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
```

Keep the smoke to 3 fixed cases:

1. No RAG hit degrades to ordinary Chat.
2. Trusted RAG hit is cited naturally.
3. Suspicious or conflicting RAG hit produces a conservative answer and a gentle
  资料核对提示。

## Error Handling

- Verifier receives no hits: return `skipped`.
- Verifier throws: degrade to `skipped`, log a warning from the web layer, and
  continue Chat.
- RAG search fails: existing behavior remains, no verifier run.
- Token budget overflows: existing budget behavior remains.
- Live model fails: existing Chat error handling remains.

## Testing Requirements

### `@repo/agent`

Add tests for:

- no chunks -> `skipped`;
- high-score useful chunks -> `trusted`;
- low-score or thin chunks -> `insufficient`;
- uncertainty markers -> `suspicious`;
- conflicting answer/result markers -> `conflict`;
- prompt addition is compact and status-aware.

### `apps/web`

Add tests for:

- `buildKnowledgeContextPrompt` includes verifier guidance;
- `appendCitationMarkdown` adds a notice only for non-trusted statuses;
- `searchKnowledgeForChat` returns verifier metadata when hits exist;
- `/api/chat` can pass verifier status to headers and mock text without changing
  no-hit behavior.

## Acceptance Criteria

1. `KnowledgeVerifierAgent` exists as a deterministic `@repo/agent` policy.
2. RAG no-hit and retrieval failure paths still answer normally.
3. Trusted RAG hits keep normal citation behavior.
4. Suspicious/conflicting/insufficient RAG hits add conservative prompt guidance
   and a gentle user notice.
5. Verifier status is observable through safe response headers.
6. TutorAgent prompt behavior still comes before RAG/verifier prompt behavior.
7. No new live model call is introduced by `@repo/agent`.
8. Unit tests, web tests, builds, and a small live smoke pass before merge.

