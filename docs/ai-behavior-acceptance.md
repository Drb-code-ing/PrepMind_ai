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

## 3. RAG 验收边界

- `RAG_EMBEDDING_PROVIDER=fake` 只能证明上传、处理、分块、入库、检索 API 和前端页面链路可用。
- fake embedding 不能证明语义检索效果；即使资料含有关键词，也可能无法稳定命中。
- RAG 语义效果验收必须使用真实 embedding，或使用专门设计的可控测试向量。
- 没有资料、没有命中或检索失败时，Chat 必须继续普通回答。

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
