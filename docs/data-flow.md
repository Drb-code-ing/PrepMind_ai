# PrepMind AI 数据流

> 当前版本：2026-06-11。Phase 2.3 已开始，后端 WrongQuestion CRUD API 已接入 PostgreSQL；前端业务页面仍保留在 Dexie。

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
Phase 1 业务数据流仍保留
用户操作
  -> Next.js Client Component
  -> React state / zustand
  -> IndexedDB(Dexie)
  -> 页面刷新后从本地恢复
```

当前阶段的关键边界：

- 登录/注册/登出/会话恢复已由后端 Auth API 承担。
- refresh token 使用 httpOnly cookie，服务端只保存 hash。
- 前端运行态保存 access token 和当前用户。
- 后端 `/wrong-questions` 已提供错题 CRUD，并按当前 `userId` 隔离数据。
- 聊天、OCR、错题本、今日任务仍是前端本地业务数据。
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
| IndexedDB | `messages` | 聊天消息 | 保留，按 `userId` 隔离 |
| IndexedDB | `ocrRecords` | OCR 图片与识别结果 | 保留，按 `userId` 隔离 |
| IndexedDB | `wrongQuestions` | 错题本记录 | 保留，按 `userId` 隔离 |

Phase 2.2 后，`userId` 来自后端真实用户 id。Dexie 不再决定登录态，只消费当前 session 的 user id。

## 5. Chat / OCR 数据流

### 5.1 聊天

```text
用户输入文本
  -> ChatInputBar
  -> useChat input + chatStore.inputDraft
  -> POST /api/chat
  -> DeepSeek / OpenAI SSE
  -> useChat messages[]
  -> MarkdownRenderer 渲染 Markdown / GFM / 数学公式
  -> Dexie messages
```

### 5.2 OCR 与错题本

```text
用户选择图片或拍照
  -> FileReader 生成预览
  -> POST /api/ocr
  -> OCR 模型 SSE 返回固定 Markdown schema
  -> ocrRecords
  -> 用户点击“保存到错题本”
  -> parseOcrResult(content)
  -> 保存预览弹窗
  -> db.wrongQuestions.add(record)
```

错题来源当前仍只有 OCR。后端 WrongQuestion CRUD API 已完成，但前端保存错题流程尚未接入该 API。

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

## 9. Phase 2.3 迁移目标

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

1. 前端错题本接入 server state。
2. ChatMessage API。
3. OCRRecord API。
4. Dexie 降级为离线缓存与乐观更新层。
5. 图片存储迁移到 MinIO/OSS。
