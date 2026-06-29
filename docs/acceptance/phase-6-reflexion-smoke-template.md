# Phase 6 Reflexion / Critic Smoke Template

Use this template when a change affects RouterAgent, TutorAgent prompts, RAG prompt assembly, KnowledgeVerifierAgent guidance, or `/api/chat` output behavior.

## Preconditions

- Dev mode remains `AI_PROVIDER_MODE=mock` unless this run explicitly needs live output.
- Live smoke must set both `AI_PROVIDER_MODE=live` and `AI_ENABLE_LIVE_CALLS=true`.
- Keep live cases small, normally 3 to 5 prompts.
- Do not paste API keys, full private documents, full prompts, or full RAG chunks into this report.

## Local Checks

```powershell
bun --filter @repo/agent test -- critic-rubric
bun --filter @repo/web test -- chat-context ai-usage-guard agent-trace-payload
```

> 当前 Bun 过滤会运行对应 package 的测试套件；上面命令的验收重点是确保 critic-rubric、chat context、usage guard 和 trace payload 相关用例被覆盖。

## Smoke Cases

| Case | Prompt | Expected Route | Actual Route | RAG Hits | Verifier Status | Expected Critic Result | Actual Critic Failures | Actual Notes |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| RAG citation | Ask an answer grounded in uploaded notes | `rag_answer` | | > 0 | `trusted` | pass, includes references | | |
| RAG caution | Ask against weak or conflicting notes | `rag_answer` | | > 0 | `suspicious` / `conflict` / `insufficient` | pass, includes verification notice | | |
| Tutor hint | Ask for a hint only | `tutor` | | 0 | `skipped` | pass, no final-answer-only reply | | |
| Advisory plan | Ask for a study plan suggestion | `study_plan` | | 0 | `skipped` | pass, no claim that data was written | | |

## Critic Notes

- `rag_answer_missing_citations` means a RAG answer used retrieval but did not expose references.
- `verifier_notice_missing` means suspicious, conflicting, or insufficient material was not called out.
- `socratic_hint_gave_final_answer` means a hint route collapsed into answer-only behavior.
- `advisory_route_claimed_write` means a read-only agent implied it already wrote tasks, plans, memories, or organizer data.

## Result

- Date:
- Model / mode:
- Commit under test:
- Passed:
- Follow-up regression cases:
