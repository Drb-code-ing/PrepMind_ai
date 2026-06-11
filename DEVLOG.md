# PrepMind AI 开发日志

按日期记录关键改动、验证结果和提交记录。所有待办和规划统一放在文末。

---

## 2026-06-05（Day 1）

**项目规划与初始化**

- 整理 Phase 0 ~ Phase 10 学习与开发路线。
- 初始化 monorepo：`apps/web`、`apps/server`、`packages/*`。
- 创建基础 packages：`types`、`database`、`ai`、`fsrs`、`rag`、`agent`、`mcp`、`ui`。
- 创建 Prisma schema 初稿。
- 配置 Docker Compose：PostgreSQL + pgvector、Redis、MinIO。
- 创建 `CLAUDE.md` 和 `DEVLOG.md`。

---

## 2026-06-06（Day 2）

**Phase 1 登录与聊天 MVP**

- 完成登录/注册 UI、表单校验和固定短信验证码登录。
- 创建 `userStore`，使用 zustand + localStorage 保存本地用户与登录态。
- 接入 AuthGuard。
- 完成移动端优先布局、PWA manifest、shadcn/ui 基础组件。
- 接入 Vercel AI SDK + DeepSeek，通过 `/api/chat` 实现 SSE 流式聊天。
- AI 回复支持 Markdown + GFM。
- 创建 `chatStore` 保存输入框草稿。

---

## 2026-06-07（Day 3）

**拍照识题与本地持久化**

- 实现图片上传、相机唤起、图片预览、全屏预览。
- 创建 `/api/ocr`，接入 OCR 多模态模型，支持 SSE 流式返回。
- OCR 提示词要求输出题干、知识点、分析思路、参考答案等结构化 Markdown。
- 引入 Dexie，创建 `prepmind-db`。
- 将聊天消息和 OCR 记录迁移到 IndexedDB。
- 修复多轮持久化问题：无限循环、TDZ、刷新丢消息、AI 最终回复未保存。
- 创建 `docs/data-flow.md` 记录当时数据流。

---

## 2026-06-08（Day 4）

**Phase 1 收尾**

- 移除 Phase 1 中不必要的 TanStack Query，明确 Phase 2 接入 HTTP API 后再恢复。
- Dexie schema 升级到 v6。
- `messages`、`ocrRecords`、`wrongQuestions` 增加 `userId`，实现本地账号隔离。
- 聊天消息与 OCR 消息合并为统一时间线渲染。
- 实现本地错题本 CRUD。
- OCR 结果保存错题前增加字段预览和缺失字段提示。
- 使用 `sourceGroupId` 防重复保存错题。
- 接入 `remark-math`、`rehype-katex`、`katex`，支持数学公式渲染。
- 优化错题详情页交互和遮罩层。
- 修复 hydration warning。
- 实现今日任务静态版。
- 整理 Phase 1 数据流、开发文档和本地博客。

---

## 2026-06-09（Day 5）

**Phase 2.1 后端基础与鉴权**

- 将 workspace 包管理迁移到 Bun。
- 固定 Docker PostgreSQL 本机端口为 5433，避免 Windows 本地 PostgreSQL 干扰。
- 新增 `docs/dev-start.md`，记录本地启动、迁移和验证命令。
- 扩展 Prisma schema，落地 Auth 相关模型和后续业务模型。
- 新增 migration：`20260609000000_phase_2_auth_foundation`。
- 新增 Prisma Client 修复脚本，适配 Bun workspace 下的生成路径。
- 新增 NestJS ConfigModule、DatabaseModule、HealthModule。
- 新增统一响应 envelope、异常过滤器、requestId middleware。
- 新增 AuthModule：注册、登录、当前用户、refresh token 轮换、logout。
- Refresh token 使用 httpOnly cookie，服务端只保存 hash。
- 新增 UsersModule，支持读取和更新当前用户资料。
- `@repo/types` 新增 Auth/Common API schemas。
- 新增 AuthService 单元测试和 Auth e2e。
- 修复 `/api/chat` 在 AI Key 缺失时只显示无响应的问题，改为明确错误提示。
- 修复保存错题预览弹窗公式未渲染问题。
- 修复 `packages/fsrs` 的 `test` 脚本，改为类型检查。

---

## 2026-06-11（Day 6）

**Phase 2.2 前端接入后端 Auth**

- 完成 Phase 2.2 中文 spec 与 implementation plan。
- 新增 `@tanstack/react-query`，恢复前端 server state 管理基础设施。
- 新增 `QueryProvider` 与 `AuthSessionProvider`。
- 新增 `apiClient`：
  - 默认 `credentials: 'include'`。
  - 解析后端统一 response envelope。
  - 支持 access token 注入。
  - 抛出结构化 `ApiClientError`。
- 新增 `authApi` 和后端用户映射：
  - `register`
  - `login`
  - `refresh`
  - `me`
  - `logout`
- 简化 `userStore`，登录态改为运行态 session：`currentUser`、`accessToken`、`sessionHydrated`。
- 新增 Auth hooks：
  - `useMe`
  - `useLogin`
  - `useRegister`
  - `useLogout`
  - `useRefreshSession`
- 登录/注册页面迁移到 NestJS Auth API。
- 手机号验证码登录暂未开放，页面明确提示使用邮箱登录。
- AuthGuard 改为以后端 session 为权威来源。
- 应用启动通过 `/auth/refresh` 恢复 session。
- 侧边栏登出调用 `/auth/logout` 并清理前端 session cache。
- 修复前端 build 中 `.next/dev` 本地缓存污染导致的类型检查问题。
- 更新 `AGENTS.md`、`CLAUDE.md`、`docs/roadmap.md`、`docs/data-flow.md`。

**Auth 安全增强**

- 在 refresh token rotation 基础上增加 reuse detection。
- 已轮换的旧 RT 再次被使用时，返回 `AUTH_REFRESH_REUSED`。
- 当同 token family 仍存在活跃 RT 时，立即撤销整个 family 并清除 refresh cookie。
- logout 后的旧 cookie 或已全量撤销的 family 继续按普通失效处理。
- 当前 Auth 主链路仍使用 PostgreSQL 存储 refresh token 状态，不引入 Redis。

**Phase 2.3 后端 WrongQuestion CRUD API**

- 新增 `@repo/types/api/wrong-question`，提供错题 CRUD 的 Zod schema 与请求/响应类型。
- 新增 `WrongQuestionsModule`、`WrongQuestionsController`、`WrongQuestionsService`。
- 新增 `/wrong-questions` REST API：
  - `GET /wrong-questions`
  - `GET /wrong-questions/:id`
  - `POST /wrong-questions`
  - `PATCH /wrong-questions/:id`
  - `DELETE /wrong-questions/:id`
- 所有错题接口接入 `JwtAuthGuard`，Service 层按当前 `userId` 强制隔离。
- `sourceGroupId` 用于同用户同 OCR 来源防重复保存，重复时返回 `WRONG_QUESTION_DUPLICATED`。
- 访问不存在或非当前用户的错题统一返回 `WRONG_QUESTION_NOT_FOUND`。

**Phase 2.3 前端错题本接入服务端**

- 新增 `wrong-question-api`，封装本地错题记录与服务端 WrongQuestion schema 的双向映射。
- 新增 `useWrongQuestions`、`useCreateWrongQuestion`、`useUpdateWrongQuestion`、`useDeleteWrongQuestion`。
- 聊天页保存错题流程改为先调用 `POST /wrong-questions`，成功后把服务端返回记录写入 Dexie。
- 错题本页面改为通过 TanStack Query 读取服务端错题列表。
- 标记已掌握、保存备注、删除错题改为调用服务端 API，并同步 Dexie 缓存。
- 服务端同步失败时，错题本页面继续展示 Dexie 本地缓存并提示用户。
- 修复本地开发 CORS：开发环境允许 `localhost`、`127.0.0.1` 和私有局域网地址的动态端口，避免 Next.js 自动切到 `3002` 后注册/登录请求被浏览器拦截。
- 修复保存错题时 OCR base64 图片导致请求体过大并返回 500 的问题：前端创建错题请求不再上传 `data:` 图片，Dexie 本地缓存继续保留图片；后端将 body parser 超大请求映射为 `PAYLOAD_TOO_LARGE`。

**验证**

- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- `node --experimental-strip-types apps/web/src/lib/api-client.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/auth-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/user-scope.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过：5 suites / 14 tests。
- `bun --filter @repo/server test:e2e` 通过：3 suites / 4 tests。
- `bun --cwd packages/types typecheck` 通过。
- Prisma migration status：`Database schema is up to date`。

**提交记录**

```text
332a3a3 docs: plan Phase 2.2 frontend auth
863d7f0 chore: add frontend query providers
1dd95fb feat: add frontend api client
afb2578 feat: add frontend auth session state
9c27aaa feat: add auth query hooks
19f54e1 feat: migrate frontend auth to backend
37b7cf6 fix: stabilize frontend auth build
65ad246 docs: update Phase 2.2 auth flow
8ebc04f feat: detect refresh token reuse
```

---

## 当前状态

**Phase 0：已完成**

- Monorepo、设计文档、基础目录、初始数据库设计、基础设施配置。

**Phase 1：已完成**

- 前端 MVP、AI 聊天、OCR、Dexie 本地持久化、错题本 CRUD、今日任务静态版。

**Phase 2.1：已完成**

- 后端基础、Prisma、PostgreSQL、Auth/User API、统一响应和测试覆盖。

**Phase 2.2：已完成**

- 前端 Auth 已接入后端，登录态权威来源迁移到 NestJS Auth API。
- Dexie 继续作为离线业务数据缓存。

**Phase 2.3：进行中**

- WrongQuestion CRUD API 与前端错题本接入已完成。

---

## 待办与规划

**Phase 2.3：业务 API 迁移**

- [x] WrongQuestion CRUD API + Prisma/PostgreSQL。
- [x] 前端错题本接入 `apiClient` + TanStack Query。
- [ ] ChatMessage API。
- [ ] OCRRecord API。
- [ ] Dexie 降级为离线缓存与乐观更新层。
- [ ] 图片从 base64 迁移到 MinIO/OSS URL。

**Phase 3 准备**

- [ ] OCR structured output schema。
- [ ] AI 讲题 prompt 与 tool calling 设计。
- [ ] createWrongQuestion / searchKnowledge / createReviewTask 工具规划。
