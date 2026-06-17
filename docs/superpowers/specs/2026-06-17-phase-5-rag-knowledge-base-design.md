# Phase 5 RAG 知识库设计

> 目标：让 PrepMind 从“通用 AI 备考助手”升级为“能理解用户资料的个性化备考助手”。RAG 是增强层，不是阻塞层；没有资料、没有命中或检索失败时，AI 聊天仍然正常回答。

## 1. 背景

PrepMind 当前已经完成了错题、OCR、AI 讲题、ReviewTask、FSRS 复习、学习统计和长期复习计划。现有主链路更偏“题目输入后的学习与复习”：

```text
拍照 / 提问 -> AI 讲题 -> 保存错题 -> 加入复习 -> 今日任务 -> 统计与计划
```

Phase 5 要补上“用户资料理解”这一层：

```text
教材 / 笔记 / 讲义 / PDF
  -> 知识库
  -> AI 回答时检索用户资料
  -> 命中则结合资料回答并展示引用
  -> 未命中则保持普通 AI 回答
```

这属于 PrepMind 的 Prep 能力，但它不是完整备考闭环本身。更准确地说：

```text
RAG = 学习资料记忆层
Chat / OCR = 学习交互层
FSRS / ReviewTask = 复习调度层
Stats / Plan = 反馈与规划层
```

Phase 5 的价值是让后续 Agent、Planner 和个性化备考建议拥有可靠的资料上下文。

## 2. 设计目标

1. 支持用户上传学习资料，并将资料解析、分块、向量化后存入 PostgreSQL + pgvector。
2. 提供知识库文档列表、状态查询、删除和重新索引能力。
3. 提供 `POST /knowledge/search` 检索 API，按当前用户隔离查询 ready chunks。
4. Chat 支持可选知识库增强：命中资料时注入 RAG context，未命中或异常时降级为普通 AI 回答。
5. AI 回答中展示资料引用来源，帮助用户知道答案依据来自哪些文件或片段。
6. 第一版只做个人私有知识库，不做公共资料库或多人共享。
7. 复用现有 Prisma `Document` / `Chunk` 草案模型，按 Phase 5 需求补齐字段和 API contract。

## 3. 非目标

Phase 5 第一版不做：

- 公共知识库。
- 团队共享、班级共享或复杂权限。
- 网页抓取。
- OCR / 错题 / 聊天内容自动全部入库。
- 自动整理课程体系。
- Hybrid Search。
- Rerank 模型。
- LangGraph Agent 自动规划。
- PDF 版面级高精度还原。
- 长文档流式解析进度条的复杂调度系统。

这些能力可以在 RAG 主链路稳定后继续扩展。

## 4. 方案选择

### 4.1 方案 A：极简同步 RAG

上传资料后同步解析、同步 embedding、同步写入 pgvector，再立即返回 ready。

优点：

- 代码最少。
- 第一版上线最快。

缺点：

- 大文件上传会阻塞请求。
- 失败重试、进度展示和取消处理都不好做。
- 后续接 BullMQ 时需要重构状态流转。

结论：不采用。

### 4.2 方案 B：生产轻量版 RAG，推荐

先把文档、分块、状态流转、检索接口和 Chat 降级策略设计完整。第一版可以使用服务内 job runner 或手动触发处理，数据模型和 API 按未来 BullMQ 预留。

```text
上传资料
  -> Document.status = PENDING
  -> 解析 / 分块 / embedding
  -> Document.status = DONE 或 FAILED
  -> Chat 只检索 DONE 文档
```

优点：

- 数据流稳定，后续迁移到 BullMQ 不需要推翻。
- 用户体验更可控，可以展示 pending / processing / failed。
- Chat 主流程和 RAG 处理流程解耦。

缺点：

- 第一版代码量比极简同步方案多。

结论：采用。

### 4.3 方案 C：完整 RAG 工程版

一开始就做 BullMQ Worker、失败重试、混合检索、rerank、引用评分、批量索引和完整知识库后台。

优点：

- 架构完整。

缺点：

- Phase 5 开局过重。
- 会拖慢主线，风险集中在文档解析和异步任务上。

结论：暂不采用。

## 5. 数据模型

当前 `packages/database/prisma/schema.prisma` 已经预留 `Document`、`Chunk`、`DocumentType`、`ProcessStatus` 和 `Unsupported("vector")`。Phase 5 不急着重命名数据库表，优先复用现有结构，必要时补充字段。

### 5.1 Document

现有模型保留核心字段：

```text
Document
- id
- name
- type: PDF / DOCX / MD / TXT
- size
- mimeType
- storageKey
- status: PENDING / PROCESSING / DONE / FAILED
- userId
- createdAt
- updatedAt
```

Phase 5 建议补充：

```text
- sourceType: UPLOAD / NOTE / WRONG_QUESTION / OCR / CHAT
- errorMessage: string?
- contentHash: string?
- processedAt: DateTime?
```

第一版只写入 `sourceType = UPLOAD`。其他来源先预留，不主动接入。

### 5.2 Chunk

现有模型保留核心字段：

```text
Chunk
- id
- documentId
- content
- embedding: vector
- metadata
- index
- userId
- createdAt
```

Phase 5 建议补充：

```text
- tokenCount: number?
```

`metadata` 用来保存页码、标题、段落范围、文件名快照等弱结构信息。

### 5.3 索引

必须保留：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

建议新增：

```sql
CREATE INDEX IF NOT EXISTS idx_document_user_status
ON "Document" ("userId", "status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_chunk_document
ON "Chunk" ("documentId");

CREATE INDEX IF NOT EXISTS idx_chunk_user
ON "Chunk" ("userId");
```

向量索引使用 raw SQL 创建，Prisma 不直接表达：

```sql
CREATE INDEX IF NOT EXISTS idx_chunk_embedding
ON "Chunk"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
```

向量维度必须和 embedding provider 保持一致。

## 6. 后端模块

新增 `KnowledgeModule`，内部边界如下：

```text
KnowledgeController
  -> KnowledgeService
  -> KnowledgeRepository

DocumentParserService
  -> PDF / TXT / Markdown parser

ChunkingService
  -> paragraph-aware chunking

EmbeddingService
  -> embedding provider abstraction

KnowledgeSearchService
  -> query embedding + pgvector search
```

`packages/rag` 当前只有 placeholder retriever。Phase 5 可以让 `apps/server` 先落地 API 与数据库集成，再把纯检索算法、chunking 策略或 ranking 逻辑逐步下沉到 `packages/rag`。不要让 `packages/rag` 反向依赖 `apps/server`。

## 7. API 设计

### 7.1 上传文档

```text
POST /knowledge/documents
Content-Type: multipart/form-data
```

请求：

```text
file: PDF / TXT / Markdown
title?: string
```

响应：

```ts
type KnowledgeDocumentResponse = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  mimeType: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};
```

上传成功只代表文件已经保存和任务已创建，不代表 embedding 已完成。

### 7.2 文档列表

```text
GET /knowledge/documents
```

支持查询：

```text
status?: PENDING | PROCESSING | DONE | FAILED
limit?: number
cursor?: string
```

按当前 `userId` 隔离。

### 7.3 文档详情

```text
GET /knowledge/documents/:id
```

返回文档状态和 chunk 统计，不默认返回全部 chunk 内容。

### 7.4 删除文档

```text
DELETE /knowledge/documents/:id
```

删除：

```text
Document
-> Chunk cascade
-> MinIO object
```

MinIO 删除失败不能留下数据库脏状态。第一版建议先删 DB，再记录 object cleanup failure 日志；后续可加后台补偿。

### 7.5 重新索引

```text
POST /knowledge/documents/:id/reindex
```

行为：

```text
删除旧 chunks
-> status = PENDING
-> 重新解析 / 分块 / embedding
```

### 7.6 检索

```text
POST /knowledge/search
```

请求：

```ts
type KnowledgeSearchRequest = {
  query: string;
  topK?: number;
  minScore?: number;
};
```

响应：

```ts
type KnowledgeSearchResponse = {
  hits: Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
};
```

如果没有 ready 文档，返回空 hits，不报错。

## 8. 解析与分块

第一版支持：

```text
PDF
TXT
Markdown
```

解析策略：

- TXT / Markdown：直接读取文本，保留标题和段落。
- PDF：先用基础文本提取，不追求版面还原。
- DOCX 可以保留类型枚举，但第一版不一定开放上传。

分块策略：

```text
目标 chunk：500-800 tokens
overlap：80-120 tokens
优先按标题 / 段落 / 空行切分
超长段落再按 token 近似切分
```

Chunk metadata 示例：

```json
{
  "page": 3,
  "sectionTitle": "格林公式",
  "sourceName": "高等数学笔记.pdf"
}
```

## 9. Embedding

新增 `EmbeddingService` 抽象，不把具体模型散落在业务代码里。

```ts
type EmbeddingProvider = {
  embedText(input: string): Promise<number[]>;
  embedBatch(inputs: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
};
```

第一版可以先接一个 provider。无论使用 OpenAI、DeepSeek、Gemini 或本地 embedding，必须满足：

- 维度固定。
- 写入前校验维度。
- provider 异常会让 document.status 变为 FAILED。
- embedding 失败不影响 Chat 普通回答。

## 10. Chat 接入

Chat 的核心规则：

```text
RAG 只增强回答，不阻断回答。
```

流程：

```text
用户发送消息
  -> 判断是否开启知识库增强
  -> 查询当前用户是否有 DONE 文档
  -> 无文档：普通 AI 回答
  -> 有文档：生成 query embedding
  -> pgvector search topK chunks
  -> 无命中或低分：普通 AI 回答
  -> 有命中：把 chunks 注入 prompt
  -> AI 回答并返回 citations
```

降级策略：

```ts
if (!knowledgeEnabled) {
  return baseChat();
}

try {
  const hits = await searchKnowledge(query);
  if (hits.length === 0) {
    return baseChat({ hint: 'no_rag_hit' });
  }
  return ragChat({ hits });
} catch {
  return baseChat({ hint: 'rag_unavailable' });
}
```

前端可以展示轻提示，但不能阻断对话：

- 当前未使用知识库资料。
- 未命中相关资料，本次按通用能力回答。
- 知识库暂时不可用，已切换为普通回答。

## 11. Prompt 边界

RAG context 注入时必须明确：

```text
以下资料来自用户个人知识库，可能不完整。
如果资料与常识或题目上下文冲突，请说明不确定性。
不要编造不存在的引用。
只有真正使用资料时才输出引用。
```

建议注入格式：

```text
<knowledge_context>
[source: 高等数学笔记.pdf, chunk: 3, score: 0.82]
...chunk content...

[source: 线性代数.md, chunk: 8, score: 0.78]
...chunk content...
</knowledge_context>
```

回答结果需要携带 citations，用于前端展示，不依赖前端从 Markdown 中解析。

## 12. 前端设计

新增页面：

```text
/knowledge
```

第一版功能：

- 上传资料。
- 查看文档列表。
- 查看处理状态。
- 查看失败原因。
- 删除文档。
- 重新索引。

状态展示：

```text
PENDING：等待处理
PROCESSING：正在解析
DONE：可用于问答
FAILED：处理失败
```

Chat 页面新增轻量控制：

```text
知识库增强：开 / 关
```

回答底部展示：

```text
参考资料
1. 高等数学笔记.pdf · 第 3 段
2. 线性代数.md · 第 8 段
```

没有资料时，Chat 输入和回答体验不变。

## 13. 离线与本地缓存

Phase 5 第一版不把知识库上传放入 Dexie mutationQueue。原因：

- 文件上传和 embedding 处理不是简单 CRUD。
- 本地排队大文件容易导致浏览器存储膨胀。
- 失败重试应该由服务端文档状态和后续 job queue 管理。

前端可以缓存文档列表查询结果，但 PostgreSQL 是权威来源。

## 14. 权限与安全

所有查询必须按当前 `userId` 过滤：

```text
Document.userId = currentUser.id
Chunk.userId = currentUser.id
```

禁止：

- 用户通过 documentId 查询别人的文档。
- 检索时跨用户扫描 chunk。
- 把 MinIO objectKey 暴露为可猜测公开下载地址。
- 在 prompt 中注入其他用户资料。

上传限制：

- 限制文件类型。
- 限制文件大小。
- 记录 MIME type。
- 后续可补充文件 hash 去重。

## 15. 测试策略

后端：

- Document CRUD service 单测。
- 上传接口 e2e。
- 删除文档级联删除 chunks。
- search API 在无文档时返回空 hits。
- search API 只返回当前用户 chunks。
- document failed 状态不会被 Chat 检索。
- embedding provider 维度不匹配时进入 failed。

前端：

- `/knowledge` 空态、上传态、处理中、失败态、ready 态。
- 删除与重新索引交互。
- Chat 在无资料时仍能普通回答。
- Chat 在检索失败时显示非阻塞提示。
- citations 展示不影响 Markdown 渲染。

包级：

- `@repo/types` Zod schema typecheck。
- `packages/rag` chunking / retriever 纯逻辑测试。

## 16. 阶段拆分

### Phase 5.1：数据模型与 contract

- 复用并补齐 `Document` / `Chunk` Prisma 模型。
- 增加必要索引和 raw SQL vector index。
- 增加 `@repo/types` knowledge API schema。

### Phase 5.2：文档上传与状态 API

- `POST /knowledge/documents`
- `GET /knowledge/documents`
- `GET /knowledge/documents/:id`
- `DELETE /knowledge/documents/:id`
- `POST /knowledge/documents/:id/reindex`

### Phase 5.3：解析、分块、embedding 入库

- TXT / Markdown / PDF 基础解析。
- paragraph-aware chunking。
- embedding provider 抽象。
- 写入 chunks 和 vector。
- 状态流转 PENDING / PROCESSING / DONE / FAILED。

### Phase 5.4：检索 API

- `POST /knowledge/search`
- query embedding。
- pgvector cosine search。
- topK 和 minScore。
- 当前用户隔离。

### Phase 5.5：Chat RAG 增强

- Chat 支持 knowledge enabled。
- 命中资料时注入 context。
- 未命中 / 无资料 / 检索失败时降级普通回答。
- 返回 citations。

### Phase 5.6：知识库页面体验打磨

- `/knowledge` 页面。
- 文档列表和状态。
- 删除、重新索引。
- Chat 引用展示。
- 移动端体验检查。

## 17. 验收标准

Phase 5 第一版完成时应满足：

1. 用户可以上传 TXT / Markdown / PDF 学习资料。
2. 文档会进入处理状态，并在成功后变为可检索。
3. 用户可以删除文档，相关 chunks 不再被检索。
4. `POST /knowledge/search` 能返回当前用户自己的相关 chunks。
5. Chat 在有命中资料时可以结合资料回答并展示引用。
6. Chat 在没有资料、没有命中或 RAG 异常时仍能正常回答。
7. RAG 相关失败不会破坏 OCR、错题、复习任务和统计页面。

