# PrepMind AI 数据流

> 当前版本：2026-06-14。Phase 2.5 已完成，下一步进入 Phase 3。本文只描述当前仍然有效的数据流边界，历史实现细节见 `DEVLOG.md`。

## 1. 当前边界

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- 业务数据权威来源：WrongQuestion、ChatMessage、OCRRecord 均已迁移到 PostgreSQL。
- 本地缓存职责：Dexie 负责快速恢复、离线兜底、乐观更新、旧图片预览和 mutation queue。
- AI 代理职责：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- 图片存储职责：新 OCR 图片通过 NestJS `/uploads/images` 上传到 MinIO。
- 本地轻状态：今日任务和学习偏好继续使用 userId scoped localStorage。

```text
用户操作
  -> Next.js Client
  -> TanStack Query / React state
  -> apiClient 或 Next.js API Route
  -> NestJS REST API / 外部 AI 服务
  -> PostgreSQL / MinIO
  -> Dexie / localStorage 本地兜底
```

## 2. Auth

```text
登录 / 注册
  -> authApi
  -> apiClient
  -> NestJS Auth API
  -> Prisma User + RefreshToken
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 { user, accessToken }
  -> userStore 运行态 session
```

```text
刷新页面
  -> AuthSessionProvider
  -> POST /auth/refresh
  -> 校验 refresh cookie
  -> refresh token rotation
  -> 返回新的 { user, accessToken }
  -> 恢复前端 session
```

关键约定：

- refresh token 只以 hash 形式保存在 PostgreSQL。
- refresh token 已启用 rotation 与 reuse detection。
- 旧 RT 重放时，服务端撤销同 family 活跃 token 并强制重新登录。
- 当前 Auth 主链路不依赖 Redis。
- refresh 失败视为未登录，不弹全局错误。

## 3. AI 聊天

```text
用户输入文本
  -> ChatInputBar
  -> /api/chat
  -> buildChatContextMessages() 裁剪近期聊天历史
  -> buildChatSystemPrompt() 注入 activeStudyContext
  -> OpenAI / DeepSeek SSE
  -> StreamingMarkdownRenderer 渐进渲染
  -> Dexie messages 本地缓存
  -> POST /chat-messages/sync
  -> PostgreSQL
```

关键约定：

- `/api/chat` 不注入完整历史，只注入裁剪后的近期上下文和当前活跃题目上下文。
- 完整聊天历史仍保存于 PostgreSQL 与 Dexie。
- `activeStudyContext` 来自有效 OCR 题目，用于承接“这一步为什么这样做”等追问。
- Chat / OCR 展示层的格式化不回写 `activeStudyContext`。
- 流式输出使用渐进 Markdown 渲染：稳定段落进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本。
- 自动滚动默认跟随输出；用户触摸、滚轮或指针操作内容区后暂停，新一轮生成或回到底部时恢复。

服务端 ChatMessage API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/chat-messages` | 读取当前用户会话消息，支持 `conversationId` |
| `POST` | `/chat-messages/sync` | 幂等同步当前会话快照，无 `conversationId` 时创建默认会话 |
| `DELETE` | `/chat-messages` | 清空当前用户会话，支持 `conversationId` |

ChatMessage 不进入通用 CRUD mutation queue，继续使用会话快照幂等同步。

## 4. OCR 与错题本

```text
用户选择图片或拍照
  -> 本地 preview URL 即时展示
  -> 并行：
      A. POST /api/ocr -> 外部 OCR 模型 SSE
      B. POST /uploads/images -> MinIO -> 服务端图片 URL
  -> OCR 输出完成
  -> parseOcrResult()
  -> POST /ocr-records
  -> 若为有效题目：生成 activeStudyContext
  -> 用户确认保存错题
  -> POST /wrong-questions
  -> 成功：PostgreSQL + Dexie 缓存
  -> 失败：Dexie mutationQueue 暂存，后续自动补偿同步
```

关键约定：

- 当前错题来源仍只有 OCR。
- 非题目 OCR 不生成 `activeStudyContext`，不显示保存错题入口，也不套用题目分析框架。
- 保存错题入口只在有效题目 OCR 输出结束后出现。
- `sourceRecordId` 指向服务端 `OcrRecord.id`。
- `/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片；前端创建请求前会剥离本地 base64。
- 新图片优先保存 `/uploads/images/users/...` 服务端 URL。
- 上传失败不阻塞 OCR，当前设备 Dexie 继续保留本地预览作为兜底。

服务端 OCRRecord API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/ocr-records` | 读取当前用户 OCR 历史，支持分页、状态、关键词和 `isQuestion` |
| `GET` | `/ocr-records/:id` | 读取当前用户 OCR 详情 |
| `POST` | `/ocr-records` | 创建或按 `userId + groupId` upsert OCR 结果 |
| `DELETE` | `/ocr-records/:id` | 删除当前用户 OCR 记录 |

服务端 WrongQuestion API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/wrong-questions` | 分页列表，支持 `status`、`subject`、`keyword` |
| `GET` | `/wrong-questions/:id` | 当前用户错题详情 |
| `POST` | `/wrong-questions` | 创建错题，`sourceGroupId` 用于同用户防重复 |
| `PATCH` | `/wrong-questions/:id` | 更新题目字段、备注、掌握状态 |
| `DELETE` | `/wrong-questions/:id` | 删除当前用户错题 |

权限边界：

- 所有业务 API 均经过 `JwtAuthGuard`。
- Service 层读写必须带当前 `userId` 条件。
- 访问不存在或不属于当前用户的数据，返回业务级 not found。
- 同一用户重复提交相同 `sourceGroupId`，返回 `WRONG_QUESTION_DUPLICATED`。

## 5. Dexie 与离线补偿

Dexie 当前职责：

| 表 | 作用 | 权威来源 |
| --- | --- | --- |
| `messages` | 聊天消息本地缓存 | `/chat-messages` |
| `ocrRecords` | OCR 历史本地缓存、本地图片预览兜底 | `/ocr-records` |
| `wrongQuestions` | 错题本本地缓存、乐观更新 | `/wrong-questions` |
| `mutationQueue` | WrongQuestion / OCRRecord 失败写操作补偿队列 | 本地暂存，最终以服务端为准 |

mutation queue 流程：

```text
WrongQuestion / OCRRecord 写操作
  -> 乐观更新 TanStack Query / Dexie
  -> 调用 NestJS API
  -> 成功：服务端返回覆盖本地缓存，syncStatus=synced
  -> 失败：写入 mutationQueue，业务记录标记 syncStatus=failed
  -> session 恢复 / online / focus 时 flushMutationQueue
  -> 成功后清理 mutationQueue
```

进入队列的操作：

- WrongQuestion：create / update / delete。
- OCRRecord：create；delete 已预留在 flush 逻辑中。

不进入队列的操作：

- ChatMessage：使用 `/chat-messages/sync` 会话快照幂等同步。
- 图片上传：上传失败不阻塞 OCR，不自动静默迁移历史 base64。
- 今日任务和学习偏好：仍是 localStorage 本地轻状态。

冲突处理：

- 删除操作服务端返回 404 视为成功。
- WrongQuestion 重复创建返回 `WRONG_QUESTION_DUPLICATED` 视为已存在。
- 401 / 403 不重试；网络错误和 5xx 按退避策略重试。
- 服务端列表仍是已同步数据的权威来源；本地只保留未同步 mutation 记录作为补偿。

## 6. localStorage

| Key | 内容 | 说明 |
| --- | --- | --- |
| `prepmind-chat` | 输入框草稿 | 本地体验状态 |
| `prepmind-today:{userId}:{date}` | 今日任务完成状态 | 当前仍是本地轻学习手账 |
| `prepmind-preferences:{userId}` | 学习目标、讲解偏好、每日强度 | Phase 2.5 本地偏好，暂不注入 prompt |

学习偏好后续如果要影响 AI 讲解风格，需要在 Phase 3 单独设计 prompt 注入边界。

## 7. PostgreSQL / Prisma

当前已落地的核心模型：

- `User`
- `RefreshToken`
- `Conversation`
- `ChatMessage`
- `OcrRecord`
- `WrongQuestion`
- `Question`
- `Card`
- `ReviewLog`
- `Document`
- `Chunk`

本机 Docker PostgreSQL 映射：

```text
localhost:5433 -> container:5432
```

Prisma migration 状态期望：

```text
Database schema is up to date
```

## 8. Phase 3 数据流改进方向

Phase 3 需要重点解决当前 OCR Markdown 解析链路的脆弱性：

1. 用 structured output schema 承载题目字段，而不是依赖前端从 Markdown 中猜字段。
2. 明确单题、多题、非题目输入的识别结果和保存策略。
3. 让 `activeStudyContext` 来源于稳定结构化数据。
4. 将 `createWrongQuestion`、`searchKnowledge`、`createReviewTask` 设计为可审计的 tool calling 边界。
