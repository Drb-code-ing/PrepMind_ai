# Phase 2.3 OCRRecord API 设计

## 目标

Phase 2.3 的目标是逐步把 Phase 1 的本地业务数据迁移到服务端。WrongQuestion 与
ChatMessage 已完成服务端 API 和前端接入；下一步是 OCRRecord API。

本设计的目标是让 OCR 原始记录具备服务端权威来源：用户拍照或上传图片识题后，OCR
文本结果、解析结果、是否为题目、来源分组和创建时间都保存到 PostgreSQL。Dexie
继续作为本地缓存和快速恢复层。

## 范围

包含：

- 新增 `@repo/types/api/ocr-record`，定义 OCRRecord API 的 Zod schema 与 TypeScript 类型。
- 新增 NestJS `OcrRecordsModule`：
  - `GET /ocr-records`
  - `GET /ocr-records/:id`
  - `POST /ocr-records`
  - `DELETE /ocr-records/:id`
- 所有 OCRRecord 接口接入 `JwtAuthGuard`，按当前 `userId` 强制隔离。
- 前端新增 `ocr-record-api` 与 TanStack Query hooks。
- OCR 流式识别完成后，前端把 OCR 结果保存到服务端，再同步 Dexie。
- 页面启动时，前端可从服务端恢复 OCR 历史，并覆盖本地缓存。
- 非题目 OCR 也保存 OCRRecord，但不生成错题入口、不写入 `activeStudyContext`。

不包含：

- 图片上传到 MinIO / OSS。
- 图片从 base64 到对象存储 URL 的完整迁移。
- OCRRecord 编辑能力。
- OCRRecord 离线写队列。
- 多会话 OCR 分组管理。
- 后端直接代理 `/api/ocr` 外部 AI SSE。

## 关键决策

### 1. 本阶段不改 Prisma schema

当前 Prisma 已有 `OcrRecord` 模型：

```prisma
model OcrRecord {
  id         String    @id @default(cuid())
  userId     String
  groupId    String
  imageUrl   String?
  rawText    String    @db.Text
  parsedJson Json?
  status     OcrStatus @default(DONE)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])
  @@index([userId, createdAt])
}
```

它已经能满足 Phase 2.3 的最低需求：保存 OCR 文本、解析 JSON、图片 URL 占位、状态和用户隔离。为了减少迁移风险，本阶段优先复用该模型，不新增 migration。

### 2. 题目字段进入 `parsedJson`

OCR 解析出的题目字段先放在 `parsedJson` 中，而不是在 `OcrRecord` 表上铺开列。

推荐结构：

```ts
type OcrParsedPayload = {
  isQuestion: boolean;
  subject?: string;
  questionText?: string;
  category?: string;
  knowledgePoints?: string[];
  analysis?: string;
  answer?: string;
  errorSuggestion?: string;
};
```

这样可以兼容非题目 OCR，也为 Phase 3 structured output 保留演进空间。等 OCR 输出 schema 稳定后，再考虑是否把高频筛选字段上升为数据库列。

### 3. 图片暂不上传服务端

Phase 1 中图片预览是 base64。直接把 base64 上传到 OCRRecord API 会带来请求体过大、数据库污染和后续迁移成本。

本阶段策略：

- OCRRecord API 的 `imageUrl` 字段只接受普通 URL，不接受 `data:` base64。
- 前端保存 OCRRecord 时不上传 base64 图片。
- Dexie 继续保存本地图片预览，用于当前设备回看。
- 后续 MinIO 阶段补 `imageUrl` / `storageKey` / `thumbnailUrl` 的真实写入。

### 4. 服务端是权威来源，Dexie 是缓存

已登录用户的 OCR 记录以服务端为权威来源。Dexie 用于：

- 页面快速恢复。
- 当前设备保存 base64 预览。
- 服务端短暂不可用时展示最近缓存。

本阶段不做离线新增队列。如果 OCRRecord 服务端保存失败，前端可以保留 Dexie 记录并提示同步失败，后续离线 mutation 队列统一处理。

## API 设计

### `POST /ocr-records`

创建或保存 OCR 记录。

请求：

```ts
{
  groupId: string;
  rawText: string;
  parsedJson?: OcrParsedPayload;
  imageUrl?: string;
  status?: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
}
```

规则：

- `groupId` 对应前端 OCR `groupId` / `sourceGroupId`。
- 同一用户重复提交相同 `groupId` 时执行 `upsert`：更新 `rawText`、`parsedJson`、`imageUrl`、`status`，保留同一条记录 id，避免重复记录。
- `rawText` 必须是 OCR 模型最终输出文本。
- `imageUrl` 如果以 `data:` 开头，前端不应提交；后端也应拒绝并返回结构化错误。

响应：

```ts
{
  id: string;
  groupId: string;
  rawText: string;
  parsedJson: OcrParsedPayload | null;
  imageUrl: string | null;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}
```

### `GET /ocr-records`

读取当前用户 OCR 历史。

查询参数：

```ts
{
  page?: number;
  pageSize?: number;
  status?: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  keyword?: string;
  isQuestion?: boolean;
}
```

规则：

- 默认按 `createdAt desc` 排序。
- `keyword` 只匹配 `rawText`。OCR 原始输出包含题目正文，因此本阶段不额外做 JSON 内字段全文搜索。
- `isQuestion` 使用 Prisma JSON path 查询 `parsedJson.isQuestion`，确保分页 total 与筛选结果一致。

响应：

```ts
{
  items: OcrRecordDto[];
  page: number;
  pageSize: number;
  total: number;
}
```

### `GET /ocr-records/:id`

读取当前用户单条 OCR 记录。

规则：

- 只能读取当前用户自己的记录。
- 记录不存在或不属于当前用户时统一返回 `OCR_RECORD_NOT_FOUND`。

### `DELETE /ocr-records/:id`

删除当前用户单条 OCR 记录。

规则：

- 只能删除当前用户自己的记录。
- 删除 OCRRecord 不级联删除 WrongQuestion。错题已经是独立学习资产。
- 记录不存在或不属于当前用户时统一返回 `OCR_RECORD_NOT_FOUND`。

## 前端数据流

### OCR 完成后保存记录

```text
用户拍照 / 上传图片
  -> POST /api/ocr
  -> 外部 AI OCR SSE
  -> 前端收集 final content
  -> parseOcrResult(content)
  -> ocrRecordApi.create()
  -> POST /ocr-records
  -> 服务端返回 OCRRecord
  -> 写入 Dexie ocrRecords 缓存
  -> 如果是题目：生成 activeStudyContext
  -> 如果不是题目：只展示自然语言说明
```

### 页面启动恢复

```text
ChatPage
  -> 先读 Dexie ocrRecords 快速恢复本地 OCR 时间线
  -> useOcrRecords()
  -> GET /ocr-records
  -> 服务端记录覆盖 Dexie 缓存
```

### 保存错题关系

```text
有效题目 OCRRecord
  -> 用户点击保存到错题本
  -> POST /wrong-questions
  -> sourceGroupId = ocrRecord.groupId
  -> sourceRecordId = ocrRecord.id
```

这样 WrongQuestion 可以关联服务端 OCRRecord，而不是只依赖本地 group id。

## 错误处理

- 未登录或 access token 无效：沿用全局 Auth 处理。
- 重复 `groupId`：执行 `upsert` 并返回同一条记录，前端视为保存成功。
- 访问不存在或非当前用户记录：返回 `OCR_RECORD_NOT_FOUND`。
- `rawText` 为空：返回 `OCR_RECORD_INVALID_CONTENT`。
- `imageUrl` 是 `data:` base64：返回 `OCR_RECORD_IMAGE_NOT_SUPPORTED`。
- 服务端保存失败：前端保留 Dexie 缓存，并显示轻提示“已保存在本地，稍后再同步”。

## 测试策略

### 共享类型

- `ocr-record` schema 能校验合法创建请求。
- 空 `rawText`、非法 `status`、base64 `imageUrl` 会失败。

### 后端单元测试

- 当前用户可创建 OCRRecord。
- 相同 `userId + groupId` 重复创建会更新同一条记录，不产生重复数据。
- 用户只能读取、删除自己的 OCRRecord。
- 非当前用户访问返回 `OCR_RECORD_NOT_FOUND`。
- base64 `imageUrl` 被拒绝。

### 后端 e2e

- 登录后 `POST /ocr-records` 成功。
- `GET /ocr-records` 返回当前用户记录。
- `GET /ocr-records/:id` 返回详情。
- `DELETE /ocr-records/:id` 删除成功。
- 未登录访问返回 401。

### 前端测试

- `ocr-record-api` 能把服务端 DTO 映射成前端 Dexie 记录。
- 创建请求不会上传 `data:` base64 图片。
- `parsedJson.isQuestion=false` 的记录不会生成错题保存入口。

## 验收标准

- OCR 完成后，当前用户的 OCR 记录能写入 PostgreSQL。
- 刷新页面后，前端可以从服务端恢复 OCR 历史。
- 非题目 OCR 也能保存为 OCRRecord，但不进入错题保存流。
- 保存错题时可以写入 `sourceRecordId` 指向服务端 OCRRecord。
- Dexie 仍能作为本地缓存使用。
- 前端 lint/build 通过。
- 后端 lint/build/unit/e2e 通过。
