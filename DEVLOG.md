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

**验证**

- 前后端基础构建通过。

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
- 优化聊天页结构与滚动性能。

**验证**

- 前端 lint/build 通过。

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

**已知问题**

- 当日发现 OCR 与聊天消息是两套渲染管线，刷新后交错顺序不稳定，Day 4 已修复。

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

**验证**

- `node --test apps/web/src/lib/user-scope.test.mts` 通过。
- `node --test apps/web/src/lib/today-tasks.test.mts` 通过。
- `node --test apps/web/src/lib/wrong-question-parser.test.mts` 通过。
- 前端 lint/build 通过。

**提交记录**

```text
4a92f87 refactor: Day 4 - 移除 TanStack Query + 统一消息时间线 + 修复 OCR 渲染顺序
b64b94d feat: 实现 Phase 1 本地错题本 CRUD
eb861af feat: 支持 Markdown 数学公式渲染
c09cde6 feat: 增强错题本操作反馈
751517a feat: 优化错题详情页交互
07dd63e fix: 修复错题详情页背景透出
```

---

## 2026-06-09（Day 5）

**Phase 2.1 后端基础与鉴权**

- 将 workspace 包管理迁移到 Bun。
- 删除 pnpm/npm 锁文件，新增 `bun.lock`。
- 固定 Docker PostgreSQL 本机端口为 5433，避免 Windows 本地 PostgreSQL 干扰。
- 新增 `docs/dev-start.md`，记录本地启动、迁移和验证命令。
- 扩展 Prisma schema，落地 Auth 相关模型和后续业务模型。
- 新增 migration：`20260609000000_phase_2_auth_foundation`。
- 新增 Prisma Client 修复脚本，适配 Bun workspace 下的生成路径。
- 新增 NestJS ConfigModule、DatabaseModule、HealthModule。
- 新增统一响应 envelope、异常过滤器、requestId middleware。
- 新增 AuthModule：
  - 注册
  - 登录
  - 当前用户
  - refresh token 轮换
  - logout
- Refresh token 使用 httpOnly cookie，服务端只保存 hash。
- 新增 UsersModule，支持读取和更新当前用户资料。
- `@repo/types` 新增 Auth/Common API schemas。
- 新增 AuthService 单元测试和 Auth e2e。
- 修复 `/api/chat` 在 AI Key 缺失时只显示无响应的问题，改为明确错误提示。
- 修复保存错题预览弹窗公式未渲染问题。
- 修复 `packages/fsrs` 的 `test` 脚本，改为类型检查。

**文档同步**

- 重写 `AGENTS.md` 和 `CLAUDE.md`，同步当前 Bun/Phase 2.1 状态。
- 重写 `docs/data-flow.md`，新增 Phase 2.1 Auth 数据流。
- 重写 `docs/dev-start.md`，补充 worktree env 同步和 5433 数据库约定。
- 重写 `docs/roadmap.md`，拆分 Phase 2.1 / 2.2 / 2.3。
- 新增本地博客 `Blog/2026-06-09-phase-2-1-backend-auth.md`，不进入 Git 跟踪。

**验证**

- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过：2 suites / 4 tests。
- `bun --filter @repo/server test:e2e` 通过：2 suites / 2 tests。
- `node --experimental-strip-types apps/web/src/lib/ai-provider.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/today-tasks.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/user-scope.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts` 通过。
- `bun --cwd packages/database test` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --cwd packages/fsrs test` 通过。
- Prisma migration status：database schema is up to date。

**提交记录**

```text
8a88f67 chore: migrate workspace scripts to Bun
a7e72cf feat: add shared auth API schemas
2ee0e81 chore: add server auth dependencies
245c807 feat: add Phase 2 Prisma auth schema
75c1f03 feat: add NestJS backend foundation
c2995b6 feat: add auth services and JWT guard
0566912 test: cover AuthService core flow
fa09fd6 test: update health endpoint e2e smoke
f79541e test: add auth e2e flow coverage
5eb600f chore: stabilize docker postgres dev setup
bbe09e1 docs: add local dev startup guide
5210b99 chore: ignore local temp files
b366e56 fix: surface chat config errors and render save preview math
```

---

## 当前状态

**Phase 0：已完成**

- Monorepo、设计文档、基础目录、初始数据库设计、基础设施配置。

**Phase 1：已完成**

- 前端 MVP、AI 聊天、OCR、Dexie 本地持久化、错题本 CRUD、今日任务静态版。

**Phase 2.1：已完成**

- 后端基础、Prisma、PostgreSQL、Auth/User API、统一响应和测试覆盖。

---

## 待办与规划

**Phase 2.2：前端接入后端 Auth**

- [ ] 封装 `apiClient`。
- [ ] 接入 TanStack Query。
- [ ] 登录/注册页面调用 NestJS Auth API。
- [ ] AuthGuard 改为以后端 `/auth/me` 为权威来源。
- [ ] 实现 401 处理和登出清理。
- [ ] 保留 Dexie 为离线缓存，不再作为登录态权威来源。

**Phase 2.3：业务 API 迁移**

- [ ] WrongQuestion CRUD API + Prisma/PostgreSQL。
- [ ] ChatMessage API。
- [ ] OCRRecord API。
- [ ] Dexie 降级为离线缓存与乐观更新层。
- [ ] 图片从 base64 迁移到 MinIO/OSS URL。

**Phase 3 准备**

- [ ] OCR structured output schema。
- [ ] AI 讲题 prompt 与 tool calling 设计。
- [ ] createWrongQuestion / searchKnowledge / createReviewTask 工具规划。
