# Phase 5.3 Document Processing And Embedding Design

## 背景

Phase 5.2 已完成知识库资料进入系统的最小闭环：用户上传 PDF / DOCX / Markdown / TXT 后，原文件进入 MinIO，PostgreSQL 创建 `Document(status=PENDING, sourceType=UPLOAD)`，并支持当前用户维度的列表、详情和删除。

Phase 5.3 的目标是让这些 `PENDING` 文档真正变成可检索的数据资产：

```text
Document(PENDING)
  -> 读取 MinIO 原文件
  -> 解析文本
  -> 段落感知分块
  -> 生成 embedding
  -> 写入 Chunk(content, metadata, index, tokenCount, embedding, userId)
  -> Document(DONE)
```

本阶段仍不接入 Chat，不实现向量检索 API，不做 `/knowledge` 前端页面。RAG 在 PrepMind 中仍然是增强层：没有资料、没有命中或处理失败时，Chat 后续必须可以降级为普通 AI 回答。

## 范围

Phase 5.3 实现：

- TXT / Markdown / DOCX / PDF 的基础文本解析。
- 段落优先的 chunking，支持目标 token 数、overlap、元数据生成。
- embedding provider 抽象，第一版使用与当前 `vector(1536)` schema 匹配的 provider。
- 将 chunk 与 embedding 写入 PostgreSQL。
- `Document` 状态流转：`PENDING -> PROCESSING -> DONE / FAILED`。
- 为开发、测试和后续 UI 预留显式处理入口：`POST /knowledge/documents/:id/process`。
- 单测和 e2e 覆盖成功路径、失败路径、用户隔离和重复处理边界。

Phase 5.3 不实现：

- `POST /knowledge/search`。
- Chat RAG context 注入。
- citations 展示。
- `/knowledge` 前端页面。
- 离线上传队列。
- 完整 BullMQ worker、任务重试后台和进度条系统。
- 高精度 PDF 版面还原、表格结构还原、图片 OCR、公式识别。

## 推荐方案

采用“服务内可触发处理 + future worker ready”的轻量方案。

第一版通过后端 service 和显式 API 处理文档：

```text
POST /knowledge/documents/:id/process
  -> JwtAuthGuard
  -> 校验 document 属于当前用户
  -> claim PENDING / FAILED 文档为 PROCESSING
  -> 读取文件、解析、分块、embedding、写入 chunks
  -> 标记 DONE
```

这样可以先把数据链路打通，同时把 `DocumentProcessingService` 的入口设计成未来 BullMQ job handler 可复用的纯服务方法。后续迁移到 BullMQ 时，controller 只负责 enqueue，worker 复用同一套处理逻辑。

不采用上传时同步处理。原因是文档解析和 embedding 可能超过普通请求可接受时长，也会让上传失败和处理失败混在一起，难以后续扩展。

## 当前代码基础

已有模型：

```text
Document
- id
- userId
- name
- type: PDF | DOCX | MD | TXT
- size
- mimeType
- storageKey
- status: PENDING | PROCESSING | DONE | FAILED
- sourceType
- errorMessage
- contentHash
- processedAt
- chunks

Chunk
- id
- documentId
- userId
- content
- embedding: vector(1536)?
- metadata
- index
- tokenCount
- createdAt
```

已有服务：

- `KnowledgeDocumentsService`：上传、列表、详情、删除。
- `StorageService.uploadKnowledgeDocument()`：资料文件写入 MinIO。
- `StorageService.readObject()`：可以读取对象，但当前错误码是 `UPLOAD_IMAGE_NOT_FOUND`，属于图片语义。
- `packages/rag`：目前只有 `chunker.ts`、`embedder.ts` placeholder。

Phase 5.3 需要补齐资料读取语义：

```text
StorageService.readKnowledgeDocumentObject(storageKey)
```

它内部可以复用通用 MinIO 读取逻辑，但对外返回 `KNOWLEDGE_DOCUMENT_NOT_FOUND` 或 `KNOWLEDGE_DOCUMENT_READ_FAILED`，避免资料处理链路出现图片错误码。

## 后端组件

### DocumentProcessingService

负责完整处理流程：

```text
processDocument(userId, documentId, options?)
```

职责：

- 校验 `Document(id, userId)` 存在。
- 只允许处理 `PENDING` / `FAILED` 文档；`DONE` 默认拒绝，除非传入 `force=true`。
- 使用条件更新把文档 claim 为 `PROCESSING`，降低重复处理风险。
- 读取 MinIO 原文件。
- 调用 parser 得到纯文本和弱结构元数据。
- 调用 chunker 生成 chunks。
- 调用 embedding provider 批量生成向量。
- 删除旧 chunks，再写入新 chunks。
- 成功后设置 `status=DONE`、`processedAt=now()`、`errorMessage=null`。
- 失败后设置 `status=FAILED`、保存清洗后的 `errorMessage`。

### DocumentParserService

按 `Document.type` 路由到对应 parser：

```ts
type ParsedDocument = {
  text: string;
  metadata: {
    sourceName: string;
    mimeType: string;
    pageCount?: number;
    headings?: string[];
  };
};
```

第一版 parser 策略：

- TXT：按 UTF-8 解码 buffer，规范化换行。
- Markdown：按 UTF-8 解码，保留标题行，去掉明显无意义的连续空白。
- DOCX：使用 `mammoth` 提取 raw text，不处理复杂样式。
- PDF：使用基础文本提取库读取文本和页数，不追求版面还原。

解析后统一执行文本清洗：

- 转换 `\r\n` / `\r` 为 `\n`。
- 去掉 null 字符和不可见控制字符。
- 合并过多空行。
- trim 首尾空白。

如果清洗后文本为空，进入 `FAILED`，错误码建议为 `KNOWLEDGE_DOCUMENT_EMPTY_TEXT`。

### packages/rag chunker

`packages/rag` 承担纯算法逻辑，不依赖 NestJS、不访问数据库。

建议导出：

```ts
type ChunkInput = {
  documentId: string;
  sourceName: string;
  text: string;
  metadata?: Record<string, unknown>;
};

type ChunkingOptions = {
  targetTokens: number;
  overlapTokens: number;
  maxTokens: number;
};

type TextChunk = {
  content: string;
  index: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
};

splitDocument(input: ChunkInput, options?: Partial<ChunkingOptions>): TextChunk[];
```

默认参数：

```text
targetTokens = 650
overlapTokens = 80
maxTokens = 900
```

第一版 token 计算可以使用近似策略，中文按字符和标点粗略估算，英文按 whitespace token 粗略估算。等检索质量需要提升时，再切换到正式 tokenizer。无论使用近似还是 tokenizer，都必须把计算逻辑集中在 `packages/rag`，不要散落在 server service 中。

分块策略：

1. 优先按 Markdown 标题、空行、自然段切分。
2. 如果段落过长，再按句号、问号、分号、英文句点等句子边界切分。
3. 如果单句仍超长，按字符窗口兜底切分。
4. 相邻 chunk 保留 overlap，降低跨段断裂。
5. 每个 chunk metadata 至少包含：

```json
{
  "documentId": "...",
  "sourceName": "高等数学笔记.pdf",
  "chunkIndex": 0,
  "parser": "pdf-basic",
  "sectionTitle": "格林公式"
}
```

`sectionTitle` 可以为空。PDF 第一版如果拿不到可靠页码，不强行伪造页码。

### EmbeddingProvider

`packages/rag` 或 `apps/server` 提供 provider interface：

```ts
type EmbeddingProvider = {
  model: string;
  dimensions: number;
  embedBatch(texts: string[]): Promise<number[][]>;
};
```

第一版默认 provider：

```text
model = text-embedding-3-small
dimensions = 1536
```

原因是当前 Prisma schema 已固定：

```text
Chunk.embedding Unsupported("vector(1536)")?
```

`packages/rag/src/embedder.ts` 现有注释写的是 bge-m3，但 bge-m3 与当前 1536 维 schema 不匹配。Phase 5.3 不应在没有 schema migration 的情况下强行切 bge-m3。正确做法是保留 provider 抽象，后续如果选择 bge-m3，再通过 migration 调整向量维度或引入可配置维度方案。

写入前必须校验：

- embedding 数量等于 chunk 数量。
- 每条 embedding 维度等于 provider.dimensions。
- provider.dimensions 等于数据库向量维度 1536。

测试中使用 fake provider，返回稳定的 1536 维向量，避免单测依赖外部 API。

### ChunkPersistenceService

Prisma 对 `Unsupported("vector(1536)")` 不能直接友好写入，因此向量写入使用 raw SQL。推荐把 raw SQL 封装在单独 persistence service 中，避免业务流程里拼 SQL。

写入流程：

```text
transaction:
  delete Chunk where documentId = target document id
  insert chunk rows with vector literal
  update Document DONE
```

插入时必须带：

```text
documentId
userId
content
metadata
index
tokenCount
embedding
createdAt
```

向量 literal 必须来自 number 数组转换，不接受用户输入字符串。metadata 使用 JSON 序列化参数传入，避免手写 JSON 拼接。

如果单事务里包含大量 embedding 结果导致事务过长，第一版可以限制最大 chunk 数，例如单文档最多 500 个 chunks。超出时进入 `FAILED`，提示用户拆分资料。后续再做批量任务和后台进度。

## API 设计

新增：

```text
POST /knowledge/documents/:id/process
```

请求：

```ts
type KnowledgeDocumentProcessRequest = {
  force?: boolean;
};
```

响应复用 `KnowledgeDocumentResponse`，其中成功处理后：

```text
status = DONE
chunkCount > 0
processedAt != null
errorMessage = null
```

错误边界：

| 场景 | HTTP | code |
| --- | --- | --- |
| 文档不存在或不属于当前用户 | 404 | `KNOWLEDGE_DOCUMENT_NOT_FOUND` |
| 文档正在处理中 | 409 | `KNOWLEDGE_DOCUMENT_PROCESSING` |
| 文档已完成且未传 `force=true` | 409 | `KNOWLEDGE_DOCUMENT_ALREADY_DONE` |
| 原文件不存在或读取失败 | 404 / 502 | `KNOWLEDGE_DOCUMENT_NOT_FOUND` / `KNOWLEDGE_DOCUMENT_READ_FAILED` |
| 解析后无文本 | 422 | `KNOWLEDGE_DOCUMENT_EMPTY_TEXT` |
| embedding provider 失败 | 502 | `KNOWLEDGE_EMBEDDING_FAILED` |

如果处理流程已经 claim 到 `PROCESSING` 后失败，对用户返回对应错误，同时数据库状态要落为 `FAILED`。不要让文档长期停留在 `PROCESSING`。

## 状态流转

正常路径：

```text
PENDING -> PROCESSING -> DONE
```

失败路径：

```text
PENDING -> PROCESSING -> FAILED
FAILED -> PROCESSING -> DONE
```

重复请求：

```text
PROCESSING -> 409
DONE + force=false -> 409
DONE + force=true -> PROCESSING -> DONE
```

`force=true` 的处理语义是重建 chunks：先 claim，再删除旧 chunks，再写入新 chunks。如果中途失败，状态为 `FAILED`，旧 chunks 是否保留需要明确。第一版建议 claim 后先删除旧 chunks，保证 `FAILED` 文档不会被未来检索误用；因为 Phase 5.4 检索只会读取 `DONE` 文档，数据一致性优先于保留旧结果。

## 错误信息策略

`Document.errorMessage` 存用户可理解、可展示的短消息，不存完整 stack：

```text
无法读取资料文件
资料中没有可解析的文本
生成向量失败，请稍后重试
资料过长，请拆分后再上传
```

服务端日志保留详细错误和 stack。用户接口只返回业务 code 和短消息。

## 配置

建议新增环境变量：

```text
RAG_EMBEDDING_PROVIDER=openai
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_EMBEDDING_DIMENSIONS=1536
RAG_EMBEDDING_BATCH_SIZE=32
RAG_CHUNK_TARGET_TOKENS=650
RAG_CHUNK_OVERLAP_TOKENS=80
RAG_MAX_CHUNKS_PER_DOCUMENT=500
```

如果缺少 embedding API key，处理接口应返回 `KNOWLEDGE_EMBEDDING_FAILED`，并将文档置为 `FAILED`。这不影响上传、删除、列表，也不影响 Chat 普通回答。

## 权限与隔离

- 所有处理入口必须经过 `JwtAuthGuard`。
- 查询、claim、删除 chunks、写 chunks 都必须带当前 `userId`。
- 不能只凭 `documentId` 读取或处理文档。
- `storageKey` 不暴露给前端。
- chunk metadata 不写入敏感配置、API key、内部 bucket 名称。

## 测试策略

### packages/rag

- 段落分块：短文档生成单 chunk。
- 长段落切分：超长段落按句子或字符兜底切分。
- overlap 生效：相邻 chunk 有有限重叠，不无限增长。
- metadata：`documentId`、`sourceName`、`chunkIndex` 保留。
- tokenCount：非空文本 tokenCount 大于 0。

### server unit

- `DocumentProcessingService` 成功处理 TXT，状态变为 `DONE`，生成 chunks。
- `PENDING -> PROCESSING -> DONE` 状态流转正确。
- parser 返回空文本时状态变为 `FAILED`。
- embedding 维度不匹配时状态变为 `FAILED`。
- `PROCESSING` 文档重复处理返回冲突。
- 用户 A 不能处理用户 B 的文档。
- `force=true` 会重建 chunks。

### server e2e

- 上传 TXT 后调用 process，返回 `DONE`，`chunkCount > 0`。
- 未登录调用 process 返回 401。
- 跨用户调用 process 返回 404。
- 上传无法解析的空文本，process 返回失败且详情为 `FAILED`。

### 验证命令

```powershell
bun --cwd packages/rag typecheck
bun --cwd packages/types typecheck
bun --filter @repo/server test -- knowledge-documents.service.spec.ts document-processing.service.spec.ts
bun --filter @repo/server build
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
```

如果新增 parser 依赖，还需要确认 Bun / NestJS build 都能通过。

## 验收标准

Phase 5.3 完成后应满足：

1. 用户上传资料后，可以通过后端处理入口把文档从 `PENDING` 变为 `DONE`。
2. TXT / Markdown / DOCX / PDF 至少能提取基础文本；解析为空时进入 `FAILED`。
3. `Chunk` 中写入当前用户、文档、内容、顺序、tokenCount、metadata 和 1536 维 embedding。
4. 重复处理、处理中处理、跨用户处理都有明确错误。
5. 处理失败不会影响资料列表、删除、Chat 普通回答、错题本、复习任务和统计页面。
6. 代码边界支持后续 Phase 5.4 直接基于 `DONE` 文档和 chunks 实现 search API。
7. Phase 5.3 不提前实现 Chat RAG 注入和前端知识库页面，避免阶段范围失控。
