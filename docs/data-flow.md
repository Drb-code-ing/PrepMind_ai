# PrepMind AI 数据流

> 当前版本：2026-06-12。Phase 2.3 进行中，WrongQuestion、ChatMessage 与 OCRRecord 后端 API 及前端接入已完成；图片二进制仍保留在 Dexie。

## 1. 总览

```text
Phase 2.2 鉴权流
用户操作
  -> Next.js Client Component
  -> TanStack Query mutation/query
  -> apiClient
  -> NestJS Auth API
  -> Prisma
  -> PostgreSQL
  -> 统一响应 envelope
  -> 前端 session store
```

```text
Phase 2.3 业务数据流
用户操作
  -> Next.js Client Component
  -> TanStack Query / React state
  -> apiClient 或 Next.js API Route
  -> NestJS REST API / 外部 AI 服务
  -> PostgreSQL
  -> Dexie 本地缓存
```

当前阶段的关键边界：

- 登录/注册/登出/会话恢复已由后端 Auth API 承担。
- refresh token 使用 httpOnly cookie，服务端只保存 hash。
- 前端运行态保存 access token 和当前用户。
- 后端 `/wrong-questions` 已提供错题 CRUD，并按当前 `userId` 隔离数据。
- 前端错题本页面已接入 `/wrong-questions`，Dexie 作为本地缓存。
- 后端 `/chat-messages` 已提供聊天历史同步、读取和清空能力；Dexie 作为聊天消息本地缓存。
- 后端 `/ocr-records` 已提供 OCR 历史读取、创建 upsert 和删除能力；Dexie 作为 OCR 本地缓存。
- `/api/chat` 已加入上下文窗口，只把裁剪后的近期消息和当前活跃题目上下文发送给模型。
- 有效题目 OCR 会生成 `activeStudyContext`，非题目 OCR 不进入题目上下文，也不显示保存错题入口。
- OCR 图片预览和今日任务仍是前端本地业务数据。
- `/api/chat` 和 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。

## 2. Phase 2.2 前端 Auth 数据流

### 2.1 注册

```text
RegisterPage
  -> useRegister()
  -> authApi.register()
  -> apiClient.post('/auth/register')
  -> NestJS AuthService.register()
  -> prisma.user.create()
  -> prisma.refreshToken.create()
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 { user, accessToken }
  -> userStore.setSession()
  -> queryClient.setQueryData(['auth', 'me'])
  -> router.replace('/chat')
```

### 2.2 登录

```text
LoginPage
  -> useLogin()
  -> authApi.login()
  -> apiClient.post('/auth/login')
  -> NestJS AuthService.login()
  -> bcrypt verify password
  -> prisma.refreshToken.create()
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 { user, accessToken }
  -> userStore.setSession()
  -> queryClient.setQueryData(['auth', 'me'])
  -> router.replace('/chat')
```

### 2.3 刷新页面恢复 session

```text
AuthSessionProvider
  -> useRefreshSession()
  -> authApi.refresh()
  -> apiClient.post('/auth/refresh', credentials: include)
  -> NestJS AuthService.refresh()
  -> 校验 refresh cookie
  -> 轮换 refresh token
  -> 返回新的 { user, accessToken }
  -> userStore.setSession()
  -> sessionHydrated = true
```

refresh 失败视为未登录，不弹全局错误。

Refresh token 已启用 rotation 与 reuse detection：

```text
旧 RT 首次用于 /auth/refresh
  -> 标记旧 RT revokedAt
  -> 签发同 familyId 的新 RT

已轮换旧 RT 再次被使用
  -> 判定为 AUTH_REFRESH_REUSED
  -> 撤销同 familyId 下仍活跃的 RT
  -> 清除 refresh cookie
  -> 强制用户重新登录
```

当前 Auth 主链路不依赖 Redis。Refresh token family、撤销状态和审计字段继续存放在 PostgreSQL。

### 2.4 受保护页面

```text
AuthGuard
  -> 读取 userStore.currentUser / accessToken / sessionHydrated
  -> useMe() 调用 /auth/me 校验 access token
  -> 成功：渲染子页面
  -> 失败：clearSession() + router.replace('/login')
```

### 2.5 登出

```text
ChatSidebar
  -> useLogout()
  -> authApi.logout()
  -> apiClient.post('/auth/logout')
  -> NestJS AuthService.logout()
  -> revoke 当前 refresh token
  -> clearCookie(prepmind_refresh)
  -> userStore.clearSession()
  -> queryClient.removeQueries(['auth', 'me'])
  -> router.replace('/login')
```

## 3. apiClient 约定

`apps/web/src/lib/api-client.ts` 负责：

- 默认 baseURL：`NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'`。
- 默认 `credentials: 'include'`。
- 自动 JSON 序列化 request body。
- access token 注入 `Authorization: Bearer <token>`。
- 解析成功 envelope：

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

- 解析失败 envelope 并抛出 `ApiClientError`：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "..."
  },
  "requestId": "..."
}
```

## 4. Phase 1 本地业务数据

| 存储 | Key / 表 | 内容 | 当前状态 |
| --- | --- | --- | --- |
| localStorage | `prepmind-chat` | `inputDraft` | 保留 |
| localStorage | `prepmind-today:{userId}:{date}` | 当日任务完成状态 | 保留 |
| IndexedDB | `messages` | 聊天消息 | 本地缓存，服务端权威来源为 `/chat-messages` |
| IndexedDB | `ocrRecords` | OCR 图片与识别结果 | 本地缓存；OCR 结果服务端权威来源为 `/ocr-records`，图片预览仍本地保留 |
| IndexedDB | `wrongQuestions` | 错题本记录 | 保留，按 `userId` 隔离 |

Phase 2.3 后，`userId` 来自后端真实用户 id。Dexie 不再决定登录态，只消费当前 session 的 user id；已迁移的业务数据以服务端为权威来源。

## 5. Chat / OCR 数据流

### 5.1 聊天

```text
用户输入文本
  -> ChatInputBar
  -> useChat input + chatStore.inputDraft
  -> POST /api/chat(messages + activeContext)
  -> buildChatContextMessages() 按 token 预算裁剪普通聊天历史
  -> buildChatSystemPrompt() 注入当前活跃题目上下文
  -> DeepSeek / OpenAI SSE
  -> useChat messages[]
  -> MarkdownRenderer 渲染 Markdown / GFM / 数学公式
  -> Dexie messages 本地缓存
  -> useSyncChatMessages()
  -> POST /chat-messages/sync
  -> Prisma ChatMessage
  -> PostgreSQL
```

页面启动与历史迁移：

```text
ChatPage
  -> 先读取 Dexie messages 快速恢复界面
  -> ChatView/useChatMessages()
  -> GET /chat-messages
  -> 服务端有记录：覆盖 useChat messages 与 Dexie 缓存
  -> 服务端无记录但 Dexie 有旧消息：POST /chat-messages/sync 迁移本地历史
```

当前阶段仍由 Next.js `/api/chat` 代理外部 AI 服务并负责 SSE 流式输出；NestJS `/chat-messages` 只负责当前用户聊天历史的持久化、恢复和清空。

模型上下文策略：

- `/api/chat` 不再把完整聊天历史原样注入模型。
- 普通聊天消息由 `buildChatContextMessages()` 按估算 token budget 保留最近上下文，并始终保留最新用户消息。
- 聊天历史仍完整保存在 Dexie / PostgreSQL；截断只影响单次模型请求。
- 当前活跃题目上下文通过 `activeContext` 注入 system prompt，不参与普通消息截断。
- system prompt 要求模型优先使用 Markdown 有序步骤，并使用 `$...$` / `$$...$$` 输出数学公式。
- 前端会对常见公式 delimiters 和紧凑步骤文本做轻量格式化，再交给 MarkdownRenderer 渲染。

服务端 ChatMessage API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/chat-messages` | 读取当前用户默认会话消息，支持 `conversationId` |
| `POST` | `/chat-messages/sync` | 批量同步当前会话消息；无 `conversationId` 时创建默认会话 |
| `DELETE` | `/chat-messages` | 清空当前用户会话，支持 `conversationId` |

### 5.2 OCR 与错题本

```text
用户选择图片或拍照
  -> FileReader 生成预览
  -> POST /api/ocr
  -> OCR 模型 SSE 返回固定 Markdown schema
  -> parseOcrResult(content)
  -> POST /ocr-records
  -> Prisma OcrRecord
  -> PostgreSQL
  -> Dexie ocrRecords 缓存
  -> 若识别结果为题目：生成 activeStudyContext
  -> 后续普通聊天请求携带 activeStudyContext，AI 可承接“这道题 / 刚才那一步”等追问
  -> 用户点击“保存到错题本”
  -> parseOcrResult(content)
  -> 保存预览弹窗
  -> POST /wrong-questions
  -> sourceRecordId 指向服务端 OcrRecord.id
  -> Prisma WrongQuestion
  -> PostgreSQL
  -> db.wrongQuestions.put(record) 同步本地缓存
```

错题来源当前仍只有 OCR。聊天页“保存到错题本”已改为先调用服务端 `POST /wrong-questions`，成功后把服务端返回记录写入 Dexie 缓存；新保存的错题 `sourceRecordId` 指向服务端 `OcrRecord.id`。

非题目 OCR 不会写入 `activeStudyContext`，不会显示错题保存入口，也不会套用学科、知识点、错因分析等题目框架。

服务端 OCRRecord API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/ocr-records` | 读取当前用户 OCR 历史，支持 `page`、`pageSize`、`status`、`keyword`、`isQuestion` |
| `GET` | `/ocr-records/:id` | 当前用户 OCR 详情 |
| `POST` | `/ocr-records` | 创建或按 `userId + groupId` upsert OCR 结果 |
| `DELETE` | `/ocr-records/:id` | 删除当前用户 OCR 记录 |

图片策略：

- 当前阶段 `/ocr-records` 不接收 `data:` base64 图片，服务端会返回 `OCR_RECORD_IMAGE_NOT_SUPPORTED`。
- 前端会在创建 OCRRecord 请求前剥离 base64 `imageUrl`。
- 用户拍照预览图继续保存在 Dexie；后续迁移到 MinIO/OSS 后，`imageUrl` 再写入服务端。

OCR / 聊天交互门禁：

- OCR 流式输出期间禁用继续发送新消息，发送按钮切换为停止按钮。
- 用户点击停止时会中断当前 OCR 请求，不再继续追加输出。
- 保存错题入口只在有效题目 OCR 输出结束后出现。

### 5.3 服务端 WrongQuestion API

```text
HTTP Client
  -> Authorization: Bearer accessToken
  -> JwtAuthGuard
  -> WrongQuestionsController
  -> Zod request schema
  -> WrongQuestionsService
  -> Prisma WrongQuestion
  -> PostgreSQL
  -> 统一响应 envelope
```

当前路由：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/wrong-questions` | 分页列表，支持 `status`、`subject`、`keyword` |
| `GET` | `/wrong-questions/:id` | 当前用户错题详情 |
| `POST` | `/wrong-questions` | 创建错题，`sourceGroupId` 用于同用户防重复 |
| `PATCH` | `/wrong-questions/:id` | 更新题目字段、备注、掌握状态 |
| `DELETE` | `/wrong-questions/:id` | 删除当前用户错题 |

权限边界：

- 所有接口都必须经过 `JwtAuthGuard`。
- Service 层所有读写都带 `userId` 条件。
- 访问不存在或不属于当前用户的错题，统一返回 `WRONG_QUESTION_NOT_FOUND`。
- 同一用户重复提交相同 `sourceGroupId`，返回 `WRONG_QUESTION_DUPLICATED`。

### 5.4 前端错题本页面

```text
ErrorBookPage
  -> useWrongQuestions({ pageSize: 50 })
  -> wrongQuestionApi.list()
  -> apiClient.get('/wrong-questions')
  -> 服务端返回 items
  -> 页面渲染 server state
  -> db.wrongQuestions.bulkPut(items) 写入本地缓存
```

更新与删除：

```text
标记掌握 / 保存备注 / 删除
  -> useUpdateWrongQuestion() / useDeleteWrongQuestion()
  -> PATCH / DELETE /wrong-questions/:id
  -> 成功后更新页面状态
  -> 同步 Dexie 缓存
```

离线与失败策略：

- 页面首次进入会先读取 Dexie 中当前用户缓存。
- 服务端同步成功后，以服务端返回为准覆盖页面列表。
- 服务端同步失败时，页面继续展示本地缓存并显示提示。
- 当前阶段暂不做完整离线 mutation 队列；乐观更新和离线写队列后续统一设计。

## 6. Dexie Schema

| 版本 | messages | ocrRecords | wrongQuestions | 说明 |
| --- | --- | --- | --- | --- |
| v1 | `id, role` | `id, type, createdAt` | - | 初始本地消息/OCR |
| v2 | `id, role, order` | `id, type, createdAt` | - | 增加消息顺序 |
| v3 | `id, role, order, createdAt` | `id, type, createdAt` | - | 增加消息时间戳 |
| v4 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, subject, category, errorType, status, createdAt, updatedAt` | 增加错题本 |
| v5 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加 `sourceGroupId` 索引 |
| v6 | `id, userId, [userId+order], role, order, createdAt` | `id, userId, [userId+createdAt], type, groupId, createdAt` | `id, userId, [userId+sourceGroupId], [userId+createdAt], source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加本地账号隔离 |

## 7. 后端 Auth 数据流

```text
HTTP Request
  -> cookie-parser
  -> CORS(credentials: true)
  -> RequestIdMiddleware
  -> Controller
  -> Service
  -> PrismaService
  -> PostgreSQL
  -> ResponseEnvelopeInterceptor
  -> HTTP Response
```

## 8. PostgreSQL / Prisma

当前 Phase 2 已落地 migration：

- `User`
- `RefreshToken`
- `Account`
- `Session`
- `Question`
- `WrongQuestion`
- `Card`
- `ReviewLog`
- `Document`
- `Chunk`
- `Conversation`
- `ChatMessage`
- `OcrRecord`

本机 Docker PostgreSQL 映射：

```text
localhost:5433 -> container:5432
```

Prisma migration 状态应为：

```text
Database schema is up to date
```

## 9. Phase 2.3 后续迁移目标

```text
WrongQuestion / Chat / OCR UI
  -> TanStack Query
  -> apiClient
  -> NestJS REST API
  -> Prisma
  -> PostgreSQL / MinIO
  -> Dexie 离线缓存和乐观更新
```

优先顺序：

1. 图片存储迁移到 MinIO/OSS。
2. Dexie 离线 mutation 队列与乐观更新层。
3. Phase 3 OCR structured output schema 与 tool calling 设计。
