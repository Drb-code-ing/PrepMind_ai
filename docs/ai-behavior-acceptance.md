# AI 行为验收规范

本文记录 PrepMind AI 的 Chat / RAG / Agent 行为验收边界，避免把 mock 链路测试误当成真实模型体验验收。

## 1. Mock 与 Live 的分工

- Mock 验收用于验证工程链路：请求参数、路由、headers、prompt 拼接、token 预算、RAG 降级、消息同步和 UI 渲染。
- Live 验收用于验证真实体验：回答质量、Tutor 讲题风格、RAG 引用是否自然、Agent prompt 是否真的影响输出。
- 普通 CRUD、鉴权、FSRS、统计、资料上传和解析不要求 live 验收。
- Chat RAG、TutorAgent、KnowledgeVerifierAgent、RouterAgent prompt 行为改动必须做小样本 live smoke。

## 2. Live 验收成本边界

真实模型只能在同时开启以下变量时调用：

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MODEL='deepseek-v4-flash'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
```

- 开发默认必须回到 `AI_PROVIDER_MODE=mock`。
- live smoke 每轮控制在 3 到 5 个固定用例。
- `AI_MAX_OUTPUT_TOKENS=500` 只适合极短 smoke，不适合 Tutor 讲题或 RAG 答案质量验收。
- live 验收结束后要切回 mock，避免用户继续操作时产生额外费用。

开发环境可以用 `/agent-trace` 的 `AI 模式` 开关在 mock / live 之间切换，但它只是调试便利，不放宽成本与鉴权边界：

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_DEV_MODE_SWITCH_ENABLED='true'
```

- 开关只在非 production 且 `AI_DEV_MODE_SWITCH_ENABLED=true` 时可见。
- Live 选项只有在 `AI_ENABLE_LIVE_CALLS=true` 且存在 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 时可用。
- 即使通过开关切到 live，`/api/chat` 仍要求有效 access token，并会调用 `/auth/me` 校验。
- 验收记录仍以 `/api/chat` 响应头 `x-prepmind-ai-mode=mock|live` 为准。

## 3. RAG 验收边界

- `RAG_EMBEDDING_PROVIDER=fake` 只能证明上传、处理、分块、入库、检索 API 和前端页面链路可用。
- fake embedding 不能证明语义检索效果；即使资料含有关键词，也可能无法稳定命中。
- RAG 语义效果验收必须使用真实 embedding，或使用专门设计的可控测试向量。
- 没有资料、没有命中或检索失败时，Chat 必须继续普通回答。
- `KNOWLEDGE_PROCESSING_MODE=queue` 的 smoke 只证明 BullMQ、Redis、worker、`BackgroundJob`、文档状态流和 chunk 入库可靠，不证明真实模型回答质量。
- queue 模式不改变 `/api/chat` 的 live 边界；Chat 真实模型仍必须同时满足 `AI_PROVIDER_MODE=live`、`AI_ENABLE_LIVE_CALLS=true`、有效 API key 和登录态校验。

## 4. Chat 空回复兜底

真实模型或流式 SDK 偶发无有效 assistant 内容时，兜底提示不是根治方案，而是稳定性保护：

- 如果流式结束后最后一条仍是 user，前端不得把该会话快照同步为成功对话。
- 如果流式结束后 assistant 内容为空白，前端不得同步该空回复。
- 同步前必须等待短稳定窗口，避免前端节流合并最后 token 时把半截 assistant 内容落库。
- 页面隐藏或关闭时不得把流式中的半截消息写入 Dexie。
- 后端 `/chat-messages/sync` 必须拒绝非空但没有非空 assistant 收尾的快照。
- UI 显示 `本次回答没有成功生成，请重试`，并记录 debug 信息。
- 正常生成 assistant 内容后，兜底错误应自动清除。

## 5. Phase 6.3 验收清单

KnowledgeVerifierAgent 落地后必须覆盖：

- 无 RAG 命中：普通 Chat 正常回答。
- 正确资料命中：回答自然引用资料。
- 可疑资料命中：回答不盲从资料，并温和提示用户核对资料片段。
- Tutor + RAG 混合：Tutor 讲题策略仍生效，Verifier 不破坏讲题体验。
- mock 单测和 live 小样本 smoke 都通过。

## 6. Phase 6.4 验收清单

WrongQuestionOrganizerAgent 落地后必须覆盖：

- 保存错题成功后，整理流程失败不得影响错题保存。
- `/error-book` 首页优先展示学科卡片，学科内展示专题 deck，专题内展示错题列表。
- 专题重命名有即时反馈，并设置 `nameLocked`，后续整理不覆盖用户命名。
- 错题详情、备注、掌握状态、删除确认和加入复习仍可用。
- 更新或删除错题后，organizer 查询缓存需要失效刷新，学科和专题统计不能 stale。
- Organizer 不调用 live 模型，不读取 API key，不进入 Dexie `mutationQueue`。
- 用户隔离必须通过 e2e 覆盖，不能跨用户读取学科、专题或错题关联。

## 7. Phase 6.7 Agent Trace / Eval 验收清单（已完成）

Agent Trace 与固定评测集已落地，并必须持续覆盖：

- fixed deterministic eval set 必须在 `@repo/agent` 中稳定回归 RouterAgent、TutorAgent、KnowledgeVerifierAgent、WrongQuestionOrganizerAgent、ReviewAgent、PlannerAgent、MemoryAgent、KnowledgeDedupAgent 和 KnowledgeOrganizerAgent 的确定性 policy 行为。
- Mock 验收只证明 trace capture、headers、API、UI 和估算成本链路可用；如果改动 prompt 或 live 输出体验，仍需要按本文规则做小样本 live smoke。
- `/api/chat` 只有在存在 access token 时 best-effort 写入 `/agent-traces`；trace 写入失败不得打断流式回答，只能通过 `x-prepmind-agent-trace-recorded=false` 或日志暴露。
- Trace 只能保存脱敏元数据：route、confidence、step summary、token 估算、verifier 状态、模型名、模式和估算成本；不得保存完整 prompt、完整回答、完整 RAG chunk、access token、refresh token 或 API key。
- 前端 payload builder 和后端 service 都必须裁剪并脱敏 `DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`Authorization: Bearer ...`、`Cookie: ...` 等敏感片段。
- `/agent-trace` 的成本看板只展示基于 token 估算和本地价格表的估算成本，不代表供应商真实账单，也不应用作财务对账。
- `/agent-traces` 是在线账号级观测 API，不进入 Dexie `mutationQueue`；离线或弱网导致 trace 丢失是可接受降级。

## 8. Reflexion / Critic 验收要求

当改动 RouterAgent、TutorAgent prompt、RAG prompt、KnowledgeVerifierAgent 或 `/api/chat` 输出行为时，除了 mock 单测和必要的 live smoke，还要记录 critic/rubric 结论。

Critic 不替代人工判断，也不负责生产环境自动重试；它先作为验收层，稳定发现明显错误：RAG 有命中但没有“参考资料”、可疑、冲突或不足资料没有“核对/谨慎”提示、提示式讲题直接给最终答案、建议型 route 谎称已经创建/保存/安排了数据。

本地固定规则通过 `bun --filter @repo/agent test -- critic-rubric` 验证；当前 Bun 过滤会运行 `@repo/agent` 测试套件，并确保 critic-rubric 用例包含在内。真实模型验收记录使用 `docs/acceptance/phase-6-reflexion-smoke-template.md`。

## 9. Phase 7.1 后台队列验收清单（已完成）

知识库文档处理接入 BullMQ 后必须持续覆盖：

- `KNOWLEDGE_PROCESSING_MODE=inline` 仍为默认 fallback，不投递 BullMQ，可同步完成文档处理；当前 NestJS 仍会初始化 BullMQ 模块，本地开发建议继续启动 redis。
- `KNOWLEDGE_PROCESSING_MODE=queue` 会创建 `BackgroundJob`，投递 BullMQ，并由 `SERVER_ROLE=worker | both` 且注册了 worker processor 的进程处理。
- `GET /background-jobs` 与 `GET /background-jobs/:id` 必须经过认证，按当前账号隔离，只返回脱敏任务元数据。
- `PROCESSING` 中的资料禁止替换；worker 遇到 `status + storageKey + contentHash` 快照变化时必须跳过旧结果，不写 stale chunks。
- `/knowledge` 页面需要展示后台处理状态，只在处理活跃时轮询；静态 `PENDING` 不应造成无限请求。
- 队列 smoke 通过不代表 live Chat 通过；如果同时改动 Chat prompt、RAG 引用或 Tutor 输出，仍要做 3 到 5 个 live 小样本验收。

## 10. Phase 7.2 RAG SafetyGuard 规划验收要求

RAG SafetyGuard 规划见 `docs/superpowers/plans/2026-06-30-phase-7-rag-safety-guard.md`。实现时必须持续覆盖：

- 用户上传资料是低信任证据，不是系统、开发者或工具调用指令。
- 高风险 prompt injection chunk 不进入 Chat prompt。
- 中风险 chunk 只能作为可疑原文引用，不能执行其中命令。
- 正常学习资料检索和引用不能因为安全过滤整体回退。
- inline 与 queue 处理都必须写入一致的 chunk safety metadata。
- `KnowledgeVerifierAgent` 需要把 prompt injection 风险转成保守 guidance。
- Trace 和 BackgroundJob 仍只能保存脱敏元数据，不保存完整恶意 chunk。
- mock 单测覆盖固定攻击样本；如果改动最终 Chat 输出，还要做 3 到 5 个 live 小样本验收，确认模型没有服从恶意资料。

### Phase 7.2 RAG SafetyGuard implemented acceptance checklist

- User-uploaded documents are treated as low-trust evidence, not as system, developer, or tool-call instructions.
- High-risk prompt injection chunks are classified during document processing and persisted in `Chunk.metadata.safety`.
- `/knowledge/search` returns safety metadata for retrieved chunks so downstream Chat and UI layers do not need to re-guess risk.
- High-risk chunks are excluded before Chat prompt assembly and before citation rendering.
- Medium-risk chunks can still appear only as quoted, untrusted source text and must not be obeyed as instructions.
- Safe study chunks can backfill prompt slots after unsafe chunks are filtered, so normal RAG does not regress just because one retrieved chunk is blocked.
- `KnowledgeVerifierAgent` treats high-risk or `safeForPrompt=false` evidence as suspicious and emits conservative prompt guidance.
- `/knowledge` search results surface compact safety signals without blocking upload, processing, search, or deletion workflows.
- Inline and queue processing paths must continue to write consistent safety metadata.
- Agent Trace and BackgroundJob records remain metadata-only and must not store complete malicious chunks, full prompts, API keys, tokens, or cookies.
- Mock tests cover fixed prompt-injection samples. Live smoke is still required when final Chat output behavior changes, because deterministic filtering does not prove real-model refusal quality.
