# PrepMind AI 数据流

> 当前版本：2026-06-09。Phase 1 前端 MVP 已完成；Phase 2.1 后端基础与鉴权已完成。前端业务 UI 尚未全面迁移到后端 API。

## 1. 总览

```text
Phase 1 前端业务流
用户操作
  -> Next.js Client Component
  -> React state / zustand
  -> localStorage / IndexedDB(Dexie)
  -> 页面刷新后从本地恢复
```

```text
Phase 2.1 后端鉴权流
客户端 HTTP 请求
  -> NestJS Controller
  -> Service
  -> Prisma
  -> PostgreSQL
  -> 统一响应 envelope
```

当前阶段的关键边界：

- 前端登录/注册页面仍使用 Phase 1 localStorage 模拟账号。
- NestJS Auth API 已可独立工作，是 Phase 2.2 前端迁移目标。
- 聊天和 OCR 仍由 Next.js API Route 代理外部 AI 服务。
- Dexie 仍是前端聊天、OCR、错题和今日任务的本地数据源。
- PostgreSQL 已承载后端用户、refresh token 等服务端模型。

## 2. Phase 1 前端本地存储

| 存储 | Key / 表 | 内容 | 说明 |
| --- | --- | --- | --- |
| localStorage | `prepmind-user` | `currentUser`、`users[]` | Phase 1 模拟登录注册 |
| localStorage | `prepmind-chat` | `inputDraft` | 切页不丢输入框草稿 |
| localStorage | `prepmind-today:{userId}:{date}` | 当日已完成任务 ID | 今日任务静态版，按账号和日期隔离 |
| IndexedDB | `messages` | 聊天消息 | 按 `userId` 隔离 |
| IndexedDB | `ocrRecords` | OCR 图片与识别结果 | 按 `userId` 隔离，`groupId` 绑定同一次 OCR |
| IndexedDB | `wrongQuestions` | 错题本记录 | 按 `userId` 隔离，`sourceGroupId` 防重复保存 |

## 3. Phase 1 聊天数据流

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

`/api/chat` 当前仍是 Next.js API Route。它会检查 `DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY` 是否存在；缺失时返回明确错误，前端显示可见提示。

## 4. Phase 1 OCR 与错题本数据流

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

错题来源当前只有 OCR。字段提取策略：

- `questionText`：来自 OCR Markdown 的“题目”段。
- `subject`：优先取 AI 输出，缺失时按关键词兜底。
- `knowledgePoints`：来自 AI 输出列表，最多保留 8 个。
- `category`：优先取第一个知识点，缺失时退回学科。
- `analysis`：来自“分析思路”段。
- `answer`：来自“参考答案”段。
- `errorType`：优先取 AI 输出错因，缺失时按关键词兜底。

保存预览中的题目与参考答案使用统一 Markdown/KaTeX 渲染，避免数学公式裸露为 `$...$`。

## 5. Dexie Schema

| 版本 | messages | ocrRecords | wrongQuestions | 说明 |
| --- | --- | --- | --- | --- |
| v1 | `id, role` | `id, type, createdAt` | - | 初始本地消息/OCR |
| v2 | `id, role, order` | `id, type, createdAt` | - | 增加消息顺序 |
| v3 | `id, role, order, createdAt` | `id, type, createdAt` | - | 增加消息时间戳 |
| v4 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, subject, category, errorType, status, createdAt, updatedAt` | 增加错题本 |
| v5 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加 `sourceGroupId` 索引 |
| v6 | `id, userId, [userId+order], role, order, createdAt` | `id, userId, [userId+createdAt], type, groupId, createdAt` | `id, userId, [userId+sourceGroupId], [userId+createdAt], source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加本地账号隔离 |

## 6. Phase 2.1 后端基础数据流

### 6.1 请求入口

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

统一成功响应：

```json
{
  "success": true,
  "data": {},
  "requestId": "..."
}
```

统一错误响应：

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

### 6.2 注册

```text
POST /auth/register
  -> registerRequestSchema 校验
  -> 检查 email 是否已存在
  -> bcrypt hash password
  -> prisma.user.create()
  -> 创建 refresh token family
  -> refresh token hash 写入 PostgreSQL
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 user + accessToken
```

### 6.3 登录

```text
POST /auth/login
  -> loginRequestSchema 校验
  -> prisma.user.findUnique(email)
  -> bcrypt compare password
  -> 创建 refresh token
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 user + accessToken
```

### 6.4 当前用户

```text
GET /auth/me
  -> Authorization: Bearer accessToken
  -> JwtAuthGuard
  -> CurrentUser decorator
  -> prisma.user.findUniqueOrThrow()
  -> 返回 AuthUser
```

### 6.5 Refresh Token 轮换

```text
POST /auth/refresh
  -> 读取 httpOnly cookie: prepmind_refresh
  -> hash 后查 refreshTokens
  -> 校验未过期、未撤销
  -> revoke 旧 refresh token
  -> 创建同 familyId 新 refresh token
  -> Set-Cookie 新 refresh token
  -> 返回 user + accessToken
```

### 6.6 Logout

```text
POST /auth/logout
  -> 读取 refresh cookie
  -> revoke 当前 refresh token
  -> 清除 prepmind_refresh cookie
  -> 返回 { ok: true }
```

### 6.7 用户资料

```text
GET /users/me
  -> JwtAuthGuard
  -> 返回当前用户资料

PATCH /users/me
  -> JwtAuthGuard
  -> updateMeRequestSchema
  -> prisma.user.update()
  -> 返回更新后的 AuthUser
```

## 7. PostgreSQL / Prisma

当前 Phase 2.1 已落地 migration：

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

## 8. Phase 2.2 迁移目标

Phase 2.2 重点是把前端从“本地模拟登录”迁移到“后端 Auth API”：

```text
登录/注册页面
  -> apiClient
  -> NestJS Auth API
  -> TanStack Query 缓存 current user
  -> AuthGuard 读取 server session
  -> Dexie 降级为离线缓存
```

优先顺序：

1. 封装 `apiClient`：baseURL、credentials、错误解析、requestId。
2. 引入 TanStack Query：`useMe`、`useLogin`、`useRegister`、`useLogout`。
3. 登录/注册 UI 接入 `/auth/register`、`/auth/login`。
4. AuthGuard 改为以后端 `/auth/me` 为权威来源。
5. 401 统一处理：跳转登录、清理前端 session cache。
6. 保留 Dexie 历史数据读取，为 WrongQuestion/Chat/OCR API 迁移做准备。
