# Phase 5.4 Knowledge Search API Design

## 1. 背景

Phase 5.1 已完成 RAG 数据模型、`Chunk.embedding vector(1536)` 和 shared contract。
Phase 5.2 已完成文档上传、列表、详情和删除 API。
Phase 5.3 已完成文档解析、段落感知分块、embedding 生成和 chunk 入库。

Phase 5.4 的目标是让已处理完成的知识库资料真正可检索。它只提供后端检索 API，
不接入 Chat prompt，不展示 citations，也不新增 `/knowledge` 前端页面。

## 2. 目标

新增 `POST /knowledge/search`：

- 接收当前用户的自然语言查询。
- 使用现有 `EmbeddingService` 将 query 转为 embedding。
- 在当前用户 `DONE` 文档下的 chunks 中做 pgvector cosine search。
- 返回符合 `topK` 和 `minScore` 的命中片段。
- 保持无资料、无命中时返回空数组，不阻断后续 Chat 阶段。

## 3. 非目标

本阶段不做：

- Chat RAG 注入。
- citations 展示。
- `/knowledge` 前端页面。
- Hybrid search。
- Rerank 模型。
- LangGraph / Agent 编排。
- 用户资料可信度判断；这留给 Phase 6 `KnowledgeVerifierAgent`。

## 4. API Contract

复用 `@repo/types/api/knowledge` 中已有 schema。

请求：

```ts
type KnowledgeSearchRequest = {
  query: string;
  topK?: number; // default 5, min 1, max 20
  minScore?: number; // default 0.7, min 0, max 1
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

`score` 使用 cosine similarity，范围为 `0..1`：

```text
score = 1 - cosine_distance
```

pgvector cosine distance 使用 `<=>` 计算。

## 5. 数据流

```text
POST /knowledge/search
  -> JwtAuthGuard 获取 userId
  -> knowledgeSearchRequestSchema 校验 body
  -> EmbeddingService.embedChunks([query])
  -> KnowledgeSearchService.search(userId, request, queryEmbedding)
  -> raw SQL join Chunk + Document
  -> 只查询 Document.status = DONE 且 Chunk.userId = userId
  -> 按 cosine distance 升序排序
  -> 映射为 KnowledgeSearchResponse
```

无资料、无 chunk、无命中：

```json
{ "hits": [] }
```

## 6. 查询边界

检索必须同时满足：

- `Chunk.userId = currentUser.id`
- `Document.userId = currentUser.id`
- `Document.status = 'DONE'`
- `Chunk.embedding IS NOT NULL`
- `score >= minScore`

禁止通过 `documentId`、`chunkId` 或 raw SQL 漏出其他用户资料。

## 7. 服务拆分

在现有 `KnowledgeDocumentsModule` 中补充检索能力，避免新建过大的模块：

```text
KnowledgeDocumentsController
  - POST /knowledge/search

KnowledgeSearchService
  - embed query
  - execute pgvector raw SQL
  - map rows to contract response

EmbeddingService
  - 继续负责 embedding provider 抽象和维度校验
```

`KnowledgeSearchService` 不直接创建 OpenAI client，避免 embedding provider 逻辑分散。

## 8. 错误处理

请求参数错误：

- 由 `knowledgeSearchRequestSchema` 抛出校验错误。
- 例如空 query、`topK > 20`、`minScore > 1`。

embedding 失败：

- 沿用现有 `KNOWLEDGE_EMBEDDING_FAILED`。
- API 返回 502。
- Phase 5.5 Chat RAG 接入时捕获该错误并降级普通回答。

数据库检索失败：

- 包装为 `KNOWLEDGE_SEARCH_FAILED`。
- API 返回 502。
- 不返回部分结果，避免用户误以为检索完整。

无命中不是错误。

## 9. SQL 设计

使用 raw SQL，因为 Prisma 不直接支持 pgvector similarity 查询。

查询逻辑等价于：

```sql
SELECT
  c.id AS "chunkId",
  c."documentId",
  d.name AS "documentName",
  c.content,
  c.metadata,
  1 - (c.embedding <=> $queryVector::vector) AS score
FROM "Chunk" c
JOIN "Document" d ON d.id = c."documentId"
WHERE
  c."userId" = $userId
  AND d."userId" = $userId
  AND d.status = 'DONE'
  AND c.embedding IS NOT NULL
  AND 1 - (c.embedding <=> $queryVector::vector) >= $minScore
ORDER BY c.embedding <=> $queryVector::vector ASC
LIMIT $topK;
```

query vector 必须先转为安全的 pgvector literal，并校验：

- 长度等于 `RAG_EMBEDDING_DIMENSIONS`。
- 每个值都是 finite number。

## 10. 测试策略

shared contract：

- `knowledgeSearchRequestSchema` 保持 query、topK、minScore 边界测试。
- `knowledgeSearchResponseSchema` 保持 hit shape 测试。

server unit tests：

- query embedding 维度错误时不执行 SQL。
- 无命中返回 `{ hits: [] }`。
- 只返回当前用户、`DONE` 文档的 chunks。
- `score < minScore` 的结果被过滤。
- 数据库异常包装为 `KNOWLEDGE_SEARCH_FAILED`。

server e2e tests：

- 未登录访问 `POST /knowledge/search` 返回 401。
- 用户 A 不能检索到用户 B 的 chunks。
- 已处理完成文档的 chunk 可被检索。
- `minScore` 过高时返回空 hits。

## 11. 验收标准

Phase 5.4 完成时必须满足：

1. `POST /knowledge/search` 可用，且返回 `KnowledgeSearchResponse`。
2. 无资料、无命中返回空 hits。
3. 检索只覆盖当前用户 `DONE` 文档的 chunks。
4. 使用 pgvector cosine similarity，返回 `0..1` score。
5. embedding 或数据库失败有稳定错误码。
6. 不影响现有上传、处理、Chat mock/live guard、错题、复习和统计链路。

## 12. 后续阶段

Phase 5.5 再把 `POST /knowledge/search` 接入 Chat：

- Chat 根据开关触发检索。
- 命中后注入 knowledge context。
- 未命中、无资料或检索失败时降级普通 AI 回答。
- 返回 citations 给前端展示。

Phase 6 再引入 `KnowledgeVerifierAgent`：

- 对检索片段和回答初稿做可信度评估。
- 提醒用户资料中可能存在错误或冲突。
