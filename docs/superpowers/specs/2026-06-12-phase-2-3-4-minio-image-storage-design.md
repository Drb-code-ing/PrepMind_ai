# Phase 2.3.4 MinIO 图片存储迁移设计

## 目标

Phase 2.3 已完成 WrongQuestion、ChatMessage、OCRRecord 的服务端 API 与前端接入。当前遗留问题是 OCR 原图仍以 base64 形式保存在 Dexie 中：用户清除浏览器数据、换设备或重新登录后，OCR 历史和错题图片会丢失。

本阶段目标是把 OCR 图片从 Dexie base64 迁移到 MinIO 对象存储 URL，让 OCRRecord 和 WrongQuestion 都能引用稳定的服务端图片地址。Dexie 继续作为快速恢复和旧数据兜底缓存，但不再是新图片的唯一来源。

## 范围

包含：

- 后端新增 Uploads 模块，提供受保护的图片上传 API。
- 后端接入 MinIO client，支持 bucket 初始化、对象 key 生成、文件写入和图片读取。
- 新增共享 API schema，定义上传响应、文件大小和 MIME 类型约束。
- OCR 流程在调用 `/api/ocr` 前或同时上传原图，拿到服务端 `imageUrl` 后写入 OCRRecord。
- 保存错题时复用 OCRRecord 的服务端 `imageUrl`，让 WrongQuestion 图片跨刷新、跨设备可恢复。
- 前端保留本地 object URL / base64 预览作为即时展示和旧数据兜底。
- 文档、开发日志和启动说明补充 MinIO 环境变量。

不包含：

- 前端直传 presigned URL。
- 图片裁剪、压缩、审核、病毒扫描。
- 图片删除的生命周期回收任务。
- 把历史 Dexie base64 批量迁移到 MinIO。
- 生产 CDN、权限水印或图片鉴黄。

## 关键决策

### 1. 使用后端代理上传，不使用前端直传

本阶段选择：

```text
前端 FormData
  -> POST /uploads/images
  -> NestJS JwtAuthGuard
  -> 文件类型/大小校验
  -> MinIO putObject
  -> 返回 { objectKey, imageUrl }
```

理由：

- Phase 2 当前后端 API 已统一使用 JWT 鉴权和 response envelope，代理上传能复用这套边界。
- 文件大小、MIME 类型和对象 key 生成集中在后端，更容易测试和审计。
- presigned URL 会引入签名过期、前端直连 MinIO、CORS 和二段式提交，当前收益不够高。

后续进入生产化或大文件上传时，再把 Uploads 模块扩展为 presigned URL。

### 2. MinIO bucket 私有，图片读取先走后端公开路由

开发环境 MinIO bucket 设为私有。后端提供只读图片路由：

```text
GET /uploads/images/:objectKey...
```

该读取路由先按公开资源处理，不要求 access token。原因是 OCRRecord / WrongQuestion 的 `imageUrl` 会直接给 Next.js `Image` 或普通 `<img>` 使用，浏览器加载图片时不方便附带 Bearer token。

安全边界：

- objectKey 使用高随机值和用户分区，例如 `users/{userId}/ocr/{groupId}/{random}.{ext}`。
- 不暴露 MinIO root credential。
- 不提供目录遍历或任意 path 读取；服务端只允许读取规范化后的 `users/...` key。
- 后续如果要做强权限图片，可以改为短期签名读取 URL。

### 3. 不改 Prisma schema

当前 Prisma 已有字段：

```prisma
model OcrRecord {
  imageUrl String?
}

model WrongQuestion {
  imageUrl String?
}
```

本阶段只把这两个字段从“多数为空”变成“优先保存服务端 URL”。不新增 migration，降低 Phase 2.3 收尾风险。

### 4. 新数据使用服务端 URL，旧数据继续兜底

新 OCR 流程：

```text
用户选择图片
  -> 前端生成本地预览
  -> 上传图片到 /uploads/images
  -> 得到 imageUrl
  -> /api/ocr 继续使用原 File 调外部多模态模型
  -> OCR 完成后 POST /ocr-records，imageUrl 使用服务端 URL
  -> 保存错题时 WrongQuestion.imageUrl 使用 OCRRecord.imageUrl
```

旧数据兼容：

- 如果服务端 OCRRecord / WrongQuestion 没有 `imageUrl`，前端继续使用 Dexie 中按 `groupId` 或 `id` 保留的本地图片预览。
- 如果上传失败但 OCR 成功，本阶段允许 OCR 流程继续完成；OCRRecord 不写图片 URL，页面显示本地预览并给出轻提示。
- 服务端同步成功后仍以服务端列表为权威快照，Dexie 只补回服务端缺失的图片预览。

## API 设计

### `POST /uploads/images`

请求：

```text
Content-Type: multipart/form-data
Authorization: Bearer <accessToken>

file: image/jpeg | image/png | image/webp
purpose: ocr | wrong-question | profile
groupId?: string
```

约束：

- 最大文件大小：默认 8 MB，通过 `UPLOAD_IMAGE_MAX_BYTES` 配置。
- MIME 类型：`image/jpeg`、`image/png`、`image/webp`。
- `purpose` 当前主要使用 `ocr`，预留 `wrong-question` 和 `profile`。
- 未登录返回 `401`。
- 非图片返回 `UPLOAD_IMAGE_INVALID_TYPE`。
- 超过大小返回 `UPLOAD_IMAGE_TOO_LARGE`。
- MinIO 写入失败返回 `UPLOAD_IMAGE_FAILED`。

响应：

```json
{
  "objectKey": "users/user_id/ocr/ocr-1710000000000/random.webp",
  "imageUrl": "http://localhost:3001/uploads/images/users/user_id/ocr/ocr-1710000000000/random.webp",
  "mimeType": "image/webp",
  "size": 123456
}
```

### `GET /uploads/images/*`

请求：

```text
GET /uploads/images/users/:userId/ocr/:groupId/:filename
```

行为：

- 从 MinIO 读取对象并流式返回。
- 设置 `Content-Type`、`Cache-Control: public, max-age=31536000, immutable`。
- 对不存在的对象返回 `404`。
- 禁止 `..`、反斜杠、空 key 和不以 `users/` 开头的 key。

## 后端组件

### `UploadsModule`

职责：

- 暴露上传和图片读取 Controller。
- 注入 `StorageService`。
- 接入 `JwtAuthGuard` 保护上传接口。

### `StorageService`

职责：

- 初始化 MinIO client。
- 确保 bucket 存在。
- 根据 `userId`、`purpose`、`groupId` 和扩展名生成 object key。
- 写入对象并返回可访问 URL。
- 读取对象 stream 和 metadata。

配置项：

```text
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=prepmind-dev
PUBLIC_API_BASE_URL=http://localhost:3001
UPLOAD_IMAGE_MAX_BYTES=8388608
```

`PUBLIC_API_BASE_URL` 用于生成返回给前端的 `imageUrl`。开发环境默认为 `http://localhost:3001`。

## 前端组件

### `upload-api`

新增 `apps/web/src/lib/upload-api.ts`：

- `uploadImage(accessToken, file, { purpose, groupId })`
- 使用 `FormData`，不走 JSON 序列化。
- 解析 `@repo/types/api/upload` 响应 schema。

### `use-upload-image`

新增 mutation：

- 依赖当前 access token。
- 上传成功返回 `{ objectKey, imageUrl, mimeType, size }`。
- 上传失败抛出 `ApiClientError` 或普通 Error，由 OCR runtime 转成轻提示。

### OCR runtime 集成

`startOcr()` 中的顺序：

1. 生成 `groupId`。
2. 立即插入用户消息和空 OCR result，展示本地 `previewUrl`。
3. 并行或优先执行图片上传。
4. 调用 `/api/ocr` 继续传原始 File。
5. OCR 完成后创建 OCRRecord：
   - 上传成功：`imageUrl = uploaded.imageUrl`
   - 上传失败：`imageUrl = undefined`，Dexie 保留本地 preview。
6. 更新本地 user record / result record 的 `imageUrl`，优先使用服务端 URL。

建议先用“上传和 OCR 并行，OCRRecord 等两者结束后写入”的实现，避免上传慢导致用户看不到识别进度。

## 数据流

```text
User Image File
  -> local preview URL
  -> Uploads API
  -> MinIO object
  -> imageUrl
  -> OCRRecord.imageUrl
  -> WrongQuestion.imageUrl
  -> Dexie cache
  -> ErrorBook / Chat timeline render
```

保存错题时：

```text
OCR result record
  -> parsed wrong question payload
  -> imageUrl from OCRRecord/local OCR result
  -> POST /wrong-questions
  -> PostgreSQL WrongQuestion.imageUrl
  -> ErrorBook server list
```

## 错误处理

- 上传失败不阻断 OCR 识别。用户仍可看到本地预览和 OCR 结果。
- OCR 成功但上传失败时，保存错题允许继续；错题服务端没有图片 URL，Dexie 本地缓存继续保留图片预览。
- 上传成功但 OCR 失败时，OCRRecord 按失败状态保存时可以带 `imageUrl`；页面可展示“识别失败 + 原图”。
- MinIO 未启动时，上传返回结构化错误，前端提示“图片云端保存失败，已继续本地识题”。
- 后端读取图片不存在时返回 404，前端图片组件自然显示破图兜底；后续可加占位图。

## 测试策略

后端单测：

- object key 生成不包含原始文件名、不允许目录穿越。
- MIME 类型和大小校验。
- `StorageService` 在 bucket 不存在时会初始化 bucket。

后端 e2e：

- 未登录上传返回 401。
- 上传非图片返回结构化错误。
- 上传合法图片返回 `imageUrl` 和 `objectKey`。
- 读取上传后的图片返回正确 `Content-Type`。

前端纯函数测试：

- `upload-api` 正确构造 FormData。
- OCRRecord / WrongQuestion 映射保留服务端 `imageUrl`，并在缺失时继续允许 Dexie fallback。

手动验收：

- 启动 Docker PostgreSQL / Redis / MinIO。
- 上传一张题目图片并完成 OCR。
- 刷新页面，OCR 历史图片仍显示。
- 保存到错题本，错题卡片和详情页图片仍显示。
- 清除浏览器 IndexedDB 后重新登录，服务端 OCR / 错题图片仍可显示。

## 验收标准

- 新 OCR 记录写入服务端 `imageUrl`。
- 新错题写入服务端 `imageUrl`。
- 清除浏览器数据后，同账号仍能从服务端恢复 OCR / 错题图片。
- MinIO 未启动或上传失败时，OCR 主流程不崩溃，用户能收到轻提示。
- 前端不再把新 OCR 图片 base64 写入 OCRRecord / WrongQuestion API。
- 旧 Dexie 图片预览兼容逻辑不被破坏。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e` 通过。

## 后续延展

- Phase 2.3.5 再做 Dexie 离线 mutation 队列，把上传失败、OCRRecord 创建失败、WrongQuestion 创建失败纳入统一重试。
- Phase 3 structured output 可直接引用 `OcrRecord.imageUrl` 作为题目来源资产。
- Phase 7/10 可升级为 presigned URL、CDN、对象生命周期清理和可观测性指标。
