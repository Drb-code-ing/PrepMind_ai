# Phase 7.8.2 Hybrid Retrieval Design

## 背景

当前 `/knowledge/search` 已经支持 Qwen / OpenAI / fake embedding，并使用 pgvector cosine distance 做纯向量检索。纯向量检索适合语义改写，但对精确术语、专有名词、公式符号、章节编号和英文缩写不一定稳定。Phase 7.8.1 已经新增 RAG Eval Baseline，下一步可以在不靠感觉的前提下改进检索排序。

## 目标

- 将 `/knowledge/search` 从纯向量检索升级为第一版 Hybrid Retrieval。
- 同时召回 vector candidates 和 keyword candidates。
- 对候选 chunk 按 `chunkId` 合并去重，计算 0 到 1 的最终分数。
- 保持 API contract 不变：响应仍是 `{ hits: KnowledgeSearchHit[] }`。
- 保留当前用户隔离、`Document.status = DONE`、`Chunk.embedding IS NOT NULL` 和 `minScore/topK` 边界。
- 不新增数据库 migration，不引入 Elasticsearch，不接入 reranker 模型。

## 非目标

- 不实现生产级 BM25 服务或倒排索引集群。
- 不引入新前端筛选项。
- 不改变 Chat RAG prompt、citation 格式或 VerifierAgent 行为。
- 不把 keyword query、完整 prompt、完整 chunk 或用户私有资料写入 eval 文件。
- 不强制真实 Qwen API 进入默认测试。

## 方案选择

### 方案 A：PostgreSQL inline hybrid（推荐）

保留现有 vector SQL，同时新增一条 PostgreSQL full-text keyword SQL。服务层把两路候选合并、去重、打分、排序、截断。

优点：

- 不需要 migration，回滚简单。
- 单元测试可以 mock 两次 `$queryRaw`。
- 后续可以替换 keyword SQL 或加索引，而不改变合并逻辑。

缺点：

- `to_tsvector` inline 计算没有专门索引，资料量大时性能不如生成列 + GIN。
- 中文分词能力有限，第一版主要补强英文术语、专有名词、章节号和短语。

### 方案 B：新增 tsvector 列 + GIN index

给 `Chunk` 增加全文检索索引，性能更接近生产方案。缺点是需要 migration、回填和更细的部署说明，不适合作为第一版小步验证。

### 方案 C：接外部搜索引擎

Elasticsearch / Meilisearch / Typesense 都可以做更完整的关键词召回，但会引入新基础设施和同步一致性问题，当前阶段过重。

本阶段采用方案 A。

## 后端设计

### 候选召回

`KnowledgeSearchService.search()` 继续先为 query 生成 embedding。随后执行两路 SQL：

```text
vector candidates:
  - 使用 pgvector cosine distance
  - 返回 topK * 4 个候选
  - 字段包含 vectorScore、keywordScore=0

keyword candidates:
  - 使用 websearch_to_tsquery('simple', query)
  - 对 d.name + c.content 做 to_tsvector('simple', ...)
  - 返回 topK * 4 个候选
  - 字段包含 keywordScore、vectorScore
```

keyword 路只作为召回补充，第一版不改变数据模型。

### 合并与打分

新增纯函数 `mergeHybridSearchRows()`：

```text
same chunkId:
  vectorScore = max(vectorScore)
  keywordScore = max(keywordScore)
  metadata = 原 chunk metadata

finalScore:
  max(
    vectorScore,
    keywordScore * 0.95,
    vectorScore * 0.7 + keywordScore * 0.3
  )
```

这样设计的原因：

- 向量非常强时不被关键词拖低。
- 关键词精确命中时，即使向量分数一般，也能进入结果。
- 加权融合用于处理两边都不错但都不是满分的候选。
- 最终分数 clamp 到 `0..1`，继续满足 `KnowledgeSearchHit.score` contract。

最终排序：

```text
score DESC
keywordScore DESC
vectorScore DESC
documentName ASC
chunkId ASC
```

然后应用 `minScore` 和 `topK`。

### Metadata

响应 contract 不变，但在 hit metadata 中追加轻量 `retrieval` 元数据：

```ts
metadata: {
  ...originalMetadata,
  retrieval: {
    mode: 'hybrid',
    vectorScore: number,
    keywordScore: number,
  },
}
```

这不改变 schema，因为 `metadata` 本来允许扩展字段。它用于调试和后续 eval，不包含 query、prompt、API key 或完整私有上下文。

## 数据流

```text
POST /knowledge/search
  -> JwtAuthGuard userId
  -> validate KnowledgeSearchRequest
  -> EmbeddingService.embedChunks([query])
  -> vector SQL candidates
  -> keyword SQL candidates
  -> mergeHybridSearchRows
  -> filter score >= minScore
  -> sort + topK
  -> KnowledgeSearchResponse
```

## 错误处理

- Query embedding 维度错误或非 finite：保持 `KNOWLEDGE_EMBEDDING_FAILED`。
- 任一路 SQL 失败：保持 `KNOWLEDGE_SEARCH_FAILED`，避免返回不完整结果让用户误以为检索完整。
- Keyword query 没有命中：正常返回 vector-only 候选。
- Vector query 没有命中但 keyword 命中：允许 keyword 候选进入排序。

## 测试策略

遵循 TDD，先加失败测试：

- `mergeHybridSearchRows()` 能合并重复 chunk，并保留最高 vector / keyword score。
- keyword-only 精确命中可通过 `minScore`。
- 结果按 final score 排序并截断 topK。
- metadata 中包含 `retrieval.mode = hybrid`、vectorScore 和 keywordScore。
- `KnowledgeSearchService.search()` 会执行两路 SQL 并调用合并逻辑。
- query embedding 非法时仍不执行 SQL。
- SQL 异常仍包装为 `KNOWLEDGE_SEARCH_FAILED`。

## 验收标准

- `bun --filter @repo/server test -- hybrid-search`
- `bun --filter @repo/server test -- knowledge-search.service`
- `bun --filter @repo/server test -- rag-eval-runner`
- `bun --filter @repo/server build`
- `git diff --check`

本阶段不要求 live Chat smoke，因为 Chat prompt、模型路由和最终生成行为不变。但建议在本地用 Qwen embedding 做一次 `/knowledge/search` API smoke，验证精确术语和语义问题都能命中。

## 后续阶段

- Phase 7.8.3：把 RAG Eval runner 接入真实检索 smoke，输出 baseline vs hybrid 指标。
- Phase 7.8.4：考虑 `tsvector` 生成列 + GIN index。
- Phase 7.8.5：根据 eval 结果决定是否接入 reranker。
