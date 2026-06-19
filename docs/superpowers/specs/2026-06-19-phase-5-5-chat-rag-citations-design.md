# Phase 5.5 Chat RAG 增强与引用展示设计

## 目标

Phase 5.5 把 Phase 5.4 已完成的 `POST /knowledge/search` 接入 Chat 主链路，让用户上传并处理完成的学习资料可以增强 AI 回答。

本阶段只做 Chat RAG 增强与引用展示，不做 `/knowledge` 前端页面，不做 LangGraph 多 Agent，不做 `KnowledgeVerifierAgent`。

## 产品边界

- RAG 是增强层，不是 Chat 的前置条件。
- 未登录、未上传资料、无命中、检索失败或后端知识库不可用时，Chat 必须继续按普通 AI 回答。
- 命中资料时，AI 可以使用资料片段作为参考，但不能把资料视为绝对真理。
- 引用展示第一版采用 Markdown “参考资料”区域，跟随助手消息一起保存和恢复。
- Phase 6 再引入 `KnowledgeVerifierAgent` 判断资料可信度和冲突。

## 触发策略

第一版默认对文本 Chat 请求启用 RAG 检索，不对 OCR 图片识别接口启用。

服务端使用最新一条用户消息作为检索 query：

```text
latest user message
  -> POST /knowledge/search
  -> hits.length > 0 ? build knowledge context : normal chat
```

默认参数：

- `topK = 4`
- `minScore = 0.72`
- 注入片段最多 4 条。
- 单条片段内容截断到 700 字符。

## 数据流

```text
ChatInputBar
  -> useChat
  -> POST /api/chat
  -> validate messages / activeContext
  -> buildChatRequestBudget()
  -> searchKnowledgeForChat()
      -> POST ${NEXT_PUBLIC_API_BASE_URL}/knowledge/search
      -> Authorization: Bearer accessToken
      -> KnowledgeSearchResponse
  -> build knowledge context into system prompt
  -> mock stream or live stream
  -> append citation markdown when hits exist
  -> ChatRuntimeProvider saves assistant content to Dexie + /chat-messages/sync
```

## 鉴权

`/api/chat` 需要从请求体接收前端当前 access token，仅用于服务端代理调用 NestJS `/knowledge/search`。

约束：

- token 不写入日志。
- token 不注入 prompt。
- token 不保存到 Dexie 或 ChatMessage。
- token 缺失时跳过 RAG，继续普通 Chat。

## Prompt 注入

当检索命中时，在基础 system prompt 和 active OCR context 之后追加知识库上下文：

```text
---

可参考的用户知识库片段：
[资料1] 文档名：...
内容：...

[资料2] 文档名：...
内容：...

使用要求：
1. 这些片段是用户资料，只能作为参考，不代表一定正确。
2. 如果片段与通用知识或题目条件冲突，优先说明推理依据。
3. 回答中需要用自然语言说明参考了哪些资料。
```

知识库上下文参与 token budget 估算。若加入 RAG 后超过输入预算，优先缩减 RAG 片段；仍超限则降级为不带 RAG 的普通 Chat。

## 引用展示

第一版不修改 ChatMessage 数据库 schema。引用以 Markdown 形式追加到助手消息底部：

```markdown
---

### 参考资料

1. 《高等数学笔记.pdf》 · 片段 3 · 相似度 0.86
2. 《格林公式整理.md》 · 片段 1 · 相似度 0.82
```

优点：

- 不需要修改 ChatMessage 表。
- 历史消息、Dexie 缓存和 `/chat-messages/sync` 都能自然保存引用。
- MarkdownRenderer 已能展示该内容。

后续如果需要独立 citation UI，再引入结构化 message metadata。

## 错误处理

- `/knowledge/search` 返回 401 / 403：跳过 RAG，普通回答。
- `/knowledge/search` 返回 502 或网络失败：记录不含敏感信息的 warning，普通回答。
- 检索结果 schema 校验失败：跳过 RAG，普通回答。
- AI live 调用失败：沿用现有 Chat 错误处理。

## 测试策略

- `chat-rag-context` 纯函数测试：
  - latest user query 提取。
  - hit 转知识库 prompt context。
  - citation markdown 生成。
  - 长片段截断。
  - 无 hit 不生成 context / citation。
- `/api/chat` route 测试：
  - mock 模式下带 token 时会调用 knowledge search。
  - 无 token 时不调用 knowledge search。
  - search 失败时仍返回 mock stream。
  - 命中时 stream 内容包含参考资料区域。
- 前端 runtime 测试：
  - `experimental_prepareRequestBody` 会把 access token 放入请求体。

## 验收标准

1. 普通 Chat 在无资料、无 token 或检索失败时仍可返回。
2. 命中知识库时，AI 请求 system prompt 包含知识库片段。
3. 命中知识库时，助手消息底部包含 Markdown 参考资料。
4. 引用内容可以被现有 ChatMessage 同步和 Dexie 恢复保存。
5. 不引入真实模型默认调用；开发默认仍为 mock。
6. 不改变 OCR、错题、复习、统计主链路。
