# Phase 5.2 Knowledge Upload And Status API Design

## 背景

Phase 5.1 已完成 RAG 知识库地基：`Document` / `Chunk` 数据模型、`vector(1536)` 索引预留和 `@repo/types/api/knowledge` 共享 contract。Phase 5.2 的目标是把“资料进入系统”的最小闭环落地，但不提前实现解析、分块、embedding、检索和 Chat RAG 注入。

本阶段只让用户能够把学习资料上传到 MinIO，并在 PostgreSQL 中看到当前文档状态。后续 Phase 5.3 再接后台解析和 embedding。

## 范围

Phase 5.2 实现：

- `POST /knowledge/documents`：上传 PDF / DOCX / MD / TXT，写入 MinIO，并创建 `Document(status=PENDING, sourceType=UPLOAD)`。
- `GET /knowledge/documents`：分页读取当前用户文档列表，支持 `status`、`sourceType`、`limit`、`cursor`。
- `GET /knowledge/documents/:id`：读取当前用户单个文档详情。
- `DELETE /knowledge/documents/:id`：删除当前用户文档记录，并尽力删除 MinIO 原文件。
- `@repo/types/api/knowledge` 补齐 upload request/response、detail、delete response contract。
- 后端单测和 e2e 覆盖鉴权、用户隔离、文件类型、文件大小、列表过滤、删除权限和响应 schema。

Phase 5.2 不实现：

- 文件文本解析。
- Chunk 创建。
- embedding 生成。
- 向量检索 API。
- Chat RAG 注入和引用展示。
- `/knowledge` 前端页面。
- 文件上传离线队列。

## 数据模型使用

继续使用 Phase 5.1 的 `Document` 模型：

```text
Document
- id
- userId
- name
- type
- size
- mimeType
- storageKey
- status: PENDING | PROCESSING | DONE | FAILED
- sourceType: UPLOAD
- errorMessage
- contentHash
- processedAt
- createdAt
- updatedAt
```

上传成功后的初始状态固定为：

```text
status = PENDING
sourceType = UPLOAD
chunkCount = 0
processedAt = null
errorMessage = null
```

`Chunk` 在 Phase 5.2 不写入。列表响应中的 `chunkCount` 通过 `_count.chunks` 或聚合查询得到。

## 文件类型与大小限制

第一版允许：

| 类型 | MIME 类型 | 扩展名 |
| --- | --- | --- |
| PDF | `application/pdf` | `.pdf` |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` |
| Markdown | `text/markdown`, `text/x-markdown` | `.md`, `.markdown` |
| TXT | `text/plain` | `.txt` |

默认最大文件大小建议为 20MB，通过环境变量配置：

```text
UPLOAD_DOCUMENT_MAX_BYTES=20971520
```

文件类型判断以 MIME 类型为主，必要时结合原始文件名扩展名兜底。非法类型返回业务错误 `KNOWLEDGE_DOCUMENT_INVALID_TYPE`，超出大小返回 `KNOWLEDGE_DOCUMENT_TOO_LARGE`。

## 存储设计

复用现有 `UploadsModule` 的 MinIO 基础设施，但不要把资料文件放进图片 URL 读取接口。推荐扩展 `StorageService` 的通用对象能力：

```text
uploadKnowledgeDocument(userId, file)
deleteObject(storageKey)
```

对象 key 规则：

```text
users/{userId}/knowledge/{documentId-or-uploadGroup}/{uuid}.{ext}
```

Phase 5.2 的文件不需要公开读取 URL。后续解析 worker 通过 `storageKey` 从 MinIO 读取原文件。

## API 设计

### POST /knowledge/documents

请求：

```text
multipart/form-data
- file: required
```

响应使用统一 envelope，`data` 为 `KnowledgeDocumentResponse`。

成功流程：

```text
JwtAuthGuard
  -> 校验 multipart file
  -> 校验 MIME / size
  -> 生成 contentHash
  -> 创建 Document id
  -> 上传文件到 MinIO
  -> 写入 Document(status=PENDING)
  -> 返回 document response
```

如果 MinIO 上传失败，不写入 Document；如果 Document 写入失败，尝试删除已上传对象。删除失败只记录服务端错误，不把脏对象暴露给用户。

### GET /knowledge/documents

查询参数使用 Phase 5.1 的 `knowledgeDocumentListQuerySchema`：

```text
status?: PENDING | PROCESSING | DONE | FAILED
sourceType?: UPLOAD | NOTE | WRONG_QUESTION | OCR | CHAT
limit?: 1..100, default 20
cursor?: string
```

排序：

```text
updatedAt desc, id desc
```

只返回当前用户文档。`nextCursor` 使用最后一条 `id`，实现方式可以先用 Prisma cursor pagination；如果后续需要严格稳定排序，再升级为复合 cursor。

### GET /knowledge/documents/:id

读取当前用户单个文档。不存在或不属于当前用户时返回 not found，不暴露跨用户存在性。

### DELETE /knowledge/documents/:id

删除当前用户单个文档：

```text
查 Document(userId, id)
  -> 尽力删除 MinIO storageKey
  -> 删除 Document
  -> cascade 删除 Chunk
```

MinIO 文件已经不存在时，删除接口仍视为成功。数据库记录不存在或不属于当前用户时返回 not found。

## 错误码

Phase 5.2 预留以下业务错误：

| code | HTTP | 说明 |
| --- | --- | --- |
| `KNOWLEDGE_DOCUMENT_REQUIRED` | 400 | 未上传文件 |
| `KNOWLEDGE_DOCUMENT_INVALID_TYPE` | 400 | 文件类型不支持 |
| `KNOWLEDGE_DOCUMENT_TOO_LARGE` | 413 | 文件过大 |
| `KNOWLEDGE_DOCUMENT_NOT_FOUND` | 404 | 文档不存在或无权访问 |
| `KNOWLEDGE_DOCUMENT_UPLOAD_FAILED` | 502 | MinIO 写入失败 |

## 权限与隔离

- 所有 `/knowledge/documents` 写接口和读接口都必须经过 `JwtAuthGuard`。
- 所有 Prisma 查询必须带当前 `userId`。
- 不提供按 `storageKey` 公开读取资料文件的接口。
- 删除文档不能删除其他用户对象，即使传入合法 document id 也必须校验 `userId`。

## 与后续阶段的接口

Phase 5.3 解析任务可以基于 Phase 5.2 的状态流转继续扩展：

```text
Document(PENDING)
  -> parser worker claims document
  -> Document(PROCESSING)
  -> create Chunk records
  -> generate embeddings
  -> Document(DONE)
```

解析失败：

```text
Document(PROCESSING)
  -> Document(FAILED, errorMessage)
```

Phase 5.2 不启动 worker，也不把上传成功误导成“知识库已可检索”。

## 测试策略

Contract:

- `knowledgeDocumentUploadResponseSchema` 能解析上传响应。
- detail/delete/list 查询边界能解析。
- 非法类型、非法 limit、空文件等输入被拒绝。

Backend unit:

- `KnowledgeDocumentsService.createUploadDocument()` 校验类型、大小、hash、状态。
- list/detail/delete 均按 `userId` 隔离。
- 删除文档时调用 storage delete，storage not found 不阻断删除。

Backend e2e:

- 未登录上传返回 401。
- 非法类型上传返回 `KNOWLEDGE_DOCUMENT_INVALID_TYPE`。
- 合法 PDF / TXT 上传返回 `PENDING` 文档。
- 用户 A 看不到用户 B 的文档。
- 列表过滤和分页生效。
- 删除后当前用户列表不再返回该文档。

## 验收标准

- Phase 5.2 完成后，后端能接收资料文件并保存到 MinIO。
- PostgreSQL 中存在当前用户的 `Document(PENDING, sourceType=UPLOAD)`。
- 用户只能读取、删除自己的文档。
- `@repo/types/api/knowledge` 能表达 Phase 5.2 的上传、详情、列表和删除响应。
- 解析、embedding、检索和 Chat RAG 注入仍未实现，文档中保持明确边界。
