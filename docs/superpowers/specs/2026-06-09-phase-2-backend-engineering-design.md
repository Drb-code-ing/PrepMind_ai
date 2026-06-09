# Phase 2 后端工程化设计

日期：2026-06-09  
状态：已完成讨论，等待进入实施计划

## 目标

Phase 2 的目标是把 Phase 1 的纯前端 MVP 升级为真正的前后端应用。这个阶段不追求一次性完成所有未来模块，而是先建立稳定的后端工程底座，让当前已经存在的用户功能可以依赖真实服务端数据。

核心目标：

- 使用真实注册、登录和鉴权流程，替代 Phase 1 的本地模拟账号。
- PostgreSQL 成为主数据源。
- 为错题本、聊天记录、OCR 记录提供服务端 API。
- 建立统一的请求、响应、错误和校验规范。
- 为前端恢复 TanStack Query 做准备。
- 将 Dexie 从主数据源降级为未来离线缓存或本地草稿存储。

## 包管理器决策

Phase 2 开始后，仓库统一使用 Bun 作为包管理器和 workspace 脚本入口。

但 NestJS 服务端运行时在 Phase 2 暂时仍使用 Node.js。这可以兼顾两点：

- 解决当前 Windows 本机 pnpm 权限问题。
- 避免 NestJS、Prisma、Jest 等后端生态在 Bun runtime 下出现兼容性风险。

推荐命令风格：

```text
bun install
bun --filter @repo/web dev
bun --filter @repo/server start:dev
bun --filter @repo/database prisma:migrate
bun --filter @repo/database prisma:generate
```

迁移完成后，仓库只维护一个主 lockfile，优先使用 Bun 的 lockfile。现有 `package-lock.json`、`pnpm-lock.yaml` 不再作为主路径维护，避免三套锁文件互相干扰。

## 后端架构

当前 `apps/server` 仍是 NestJS 默认骨架。Phase 2 应该将其整理成面向业务模块的结构：

```text
apps/server/src/
  main.ts
  app.module.ts
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
  config/
  database/
  health/
  auth/
  users/
  wrong-questions/
  chat-messages/
  ocr-records/
```

核心模块职责：

- `ConfigModule`：统一读取 `DATABASE_URL`、`REDIS_URL`、JWT 配置、cookie 配置、CORS origin。
- `DatabaseModule`：提供 Prisma 访问和数据库生命周期管理。
- `HealthModule`：提供 `GET /health` 健康检查。
- `AuthModule`：负责注册、登录、刷新 token、退出登录、当前用户查询。
- `UsersModule`：负责当前用户资料读取和修改。
- `WrongQuestionsModule`：负责错题本 CRUD。
- `ChatMessagesModule`：负责会话和聊天消息持久化。
- `OcrRecordsModule`：负责 OCR 记录持久化。

分层约定：

- Controller 只处理 HTTP 入参和出参。
- Service 负责业务规则、权限判断、防重复和状态变更。
- Prisma 查询集中在 service 或 repository 层，不直接散落在 controller 中。
- 前端不直接依赖 Prisma 类型。

## API 响应规范

Phase 2 后端需要统一成功和失败响应格式，方便前端 `apiClient` 处理。

成功响应：

```json
{
  "success": true,
  "data": {},
  "requestId": "req_..."
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "邮箱或密码错误"
  },
  "requestId": "req_..."
}
```

后端基础设施需要包含：

- 全局请求校验。
- 全局异常过滤。
- Prisma 错误、业务错误、未知错误统一转换。
- 成功响应统一包装。
- 每个请求生成 `requestId`，便于后续排查问题和接入链路追踪。

## Schema 策略

项目约定已经明确使用 Zod 做 DTO 和 API Schema，因此 Phase 2 不建议再引入一套 class-validator DTO。

推荐策略：

```text
packages/types
  定义 auth / user / wrong-question / chat / ocr 的 Zod schema

apps/server
  复用 schema 校验 body / query / params

apps/web
  复用 schema 约束 API 类型和表单数据
```

这样可以让前后端共享同一份 API 合同，避免服务端 DTO、前端类型和文档三者漂移。OpenAPI 生成可以等 schema 稳定后再加。

## 鉴权设计

Phase 2 使用短期 access token + 长期 refresh token。

access token：

- JWT。
- 登录和刷新时返回给前端。
- 前端只保存在内存中。
- 请求业务 API 时放入 `Authorization: Bearer <token>`。
- 建议有效期约 15 分钟。

refresh token：

- 随机不透明 token。
- 明文只放在 httpOnly cookie 中。
- 数据库只保存 hash。
- 每次刷新都进行 rotation。
- 退出登录时撤销。
- 建议有效期 7 到 30 天。

### Auth API

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

### 登录流程

```text
POST /auth/login
  -> 校验邮箱和密码
  -> 生成 access token
  -> 生成 refresh token
  -> 将 refresh token hash 写入数据库
  -> 将 refresh token 明文写入 httpOnly cookie
  -> 返回 { user, accessToken }
```

### 刷新流程

```text
POST /auth/refresh
  -> 从 httpOnly cookie 读取 refresh token
  -> 计算 hash 并查询数据库
  -> 判断是否存在、过期、撤销
  -> 撤销旧 refresh token
  -> 签发新的 refresh token 和 access token
  -> 新 refresh token hash 写入数据库
  -> 新 refresh token 明文写入 httpOnly cookie
  -> 返回 { user, accessToken }
```

### 退出登录

```text
POST /auth/logout
  -> 从 cookie 读取 refresh token
  -> 找到对应数据库记录
  -> 设置 revokedAt
  -> 清除 refresh cookie
  -> 前端清空内存中的 user 和 accessToken
```

这是真正的服务端退出登录，不只是前端删除状态。

## 数据库模型调整

Phase 2 的数据库模型不要机械复制 Dexie 表，也不要过早把 Phase 4、Phase 5 的模型全部做满。当前阶段只服务真实用户、真实持久化和现有功能迁移。

### User

现有 `User` 需要补充认证字段：

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  phone        String?  @unique
  passwordHash String
  name         String?
  avatarUrl    String?
  role         Role     @default(STUDENT)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  refreshTokens RefreshToken[]
}
```

Phase 2 先实现邮箱密码登录。手机号字段可以先预留，不作为第一批登录入口。

### RefreshToken

新增 refresh token 表，用于 token rotation、多设备登录和退出登录失效。

```prisma
model RefreshToken {
  id          String    @id @default(cuid())
  userId      String
  tokenHash   String    @unique
  familyId    String
  expiresAt   DateTime
  revokedAt   DateTime?
  lastUsedAt  DateTime?
  userAgent   String?
  ipAddress   String?
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@index([familyId])
}
```

现有 `Account` 和 `Session` 更适合未来 OAuth 或 NextAuth 风格能力。Phase 2 的 JWT 鉴权流程不依赖它们。

### Conversation 和 ChatMessage

Phase 1 只有一条聊天时间线，但服务端建议从 Phase 2 开始引入 `Conversation`，避免后续多会话功能需要大改数据库。

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages ChatMessage[]

  @@index([userId, updatedAt])
}

model ChatMessage {
  id             String      @id @default(cuid())
  userId         String
  conversationId String
  role           MessageRole
  content        String      @db.Text
  order          Int
  metadata       Json?
  createdAt      DateTime    @default(now())

  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([conversationId, order])
  @@index([userId, conversationId])
  @@index([userId, createdAt])
}
```

### OcrRecord

服务端不继续保存 Phase 1 的 UI message 形态，而是把一次 OCR 识别保存为一条业务记录。

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

MinIO 文件上传可以留到 Phase 3 OCR 工程化时做。Phase 2 可以先接受 `imageUrl` 或临时图片数据，重点是把 OCR 记录和用户绑定起来。

### WrongQuestion

Phase 2 的错题表建议自包含题目内容，不强制绑定 `Question` 表。

原因是 Phase 1 的错题来源是 OCR 解析结果，不一定有独立题库题目。如果现在强行拆成 `Question + WrongQuestion`，保存错题流程会变复杂，而且对当前业务收益不高。

```prisma
model WrongQuestion {
  id              String              @id @default(cuid())
  userId          String
  source          WrongQuestionSource @default(OCR)
  sourceRecordId  String?
  sourceGroupId   String?
  imageUrl         String?
  questionText     String              @db.Text
  subject          String
  category         String
  knowledgePoints  String[]
  analysis         String              @db.Text
  answer           String              @db.Text
  errorType        String?
  userNote         String?             @db.Text
  rawContent       String?             @db.Text
  status           WrongQuestionStatus @default(UNRESOLVED)
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, sourceGroupId])
  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([userId, subject])
}
```

`Question`、`Card`、`ReviewLog`、`Document`、`Chunk` 可以继续作为未来模型保留，但不作为 Phase 2 主线实现。

## API 推进顺序

推荐按以下顺序实现：

1. `HealthModule`
2. `AuthModule`
3. `UsersModule`
4. `WrongQuestionsModule`
5. `ChatMessagesModule`
6. `OcrRecordsModule`

第一批接口：

```text
GET  /health

POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me

GET   /users/me
PATCH /users/me

GET    /wrong-questions
GET    /wrong-questions/:id
POST   /wrong-questions
PATCH  /wrong-questions/:id
DELETE /wrong-questions/:id

GET  /conversations
POST /conversations
GET  /conversations/:id/messages
POST /conversations/:id/messages/bulk

GET  /ocr-records
POST /ocr-records
GET  /ocr-records/:id
```

现有 Next.js AI 代理路由 `/api/chat` 和 `/api/ocr` 在 Phase 2 初期可以保留。等认证和数据 API 稳定后，再考虑迁移到 NestJS。

## 前端迁移策略

前端不要一次性重写，而是按功能闭环迁移。

推荐顺序：

1. 登录/注册页改为调用 Auth API。
2. 新增 `apiClient`，处理 access token 注入和 401 自动刷新。
3. 恢复 TanStack Query，管理服务端状态。
4. 错题本 CRUD 从 Dexie 迁到 HTTP API。
5. 聊天记录和 OCR 记录迁到 HTTP API。
6. Dexie 保留为未来离线缓存或本地草稿层。

应用启动时的登录态恢复：

```text
App 启动
  -> POST /auth/refresh
  -> 成功：写入内存 user 和 accessToken
  -> 失败：视为未登录
```

API 401 处理：

```text
请求返回 401
  -> POST /auth/refresh
  -> refresh 成功：重放原请求
  -> refresh 失败：清空登录态并跳转登录页
```

## 测试策略

Phase 2 不追求一开始覆盖所有分支，但关键链路必须有测试。

必须覆盖：

- Auth service 单元测试：注册、登录、刷新、退出。
- WrongQuestions service 单元测试：创建、列表、更新、删除、用户隔离。
- API e2e smoke test：注册 -> 登录 -> 创建错题 -> 查询列表 -> 更新 -> 删除。

包管理器迁移完成后，lint、build、test 都应通过 Bun workspace 脚本执行。

## 实施切片

推荐按以下提交块推进：

1. Bun workspace 和脚本迁移。
2. NestJS 工程底座和 health 接口。
3. Prisma schema Phase 2 迁移。
4. AuthModule 和 refresh token rotation。
5. 前端 `apiClient` 与真实登录注册。
6. WrongQuestions API 与前端错题本迁移。
7. Conversations 和 ChatMessages API。
8. OcrRecords API。
9. Dexie 角色整理和文档更新。

每个切片都要独立验证并提交。

## 非目标

Phase 2 暂不做以下事项：

- 不在 Phase 2 初期迁移 AI SSE 路由到 NestJS。
- 不实现 BullMQ 业务队列。
- 不实现 FSRS 复习调度。
- 不实现 RAG 文档解析和向量检索。
- 不强制 OCR 错题绑定标准化 `Question` 表。
