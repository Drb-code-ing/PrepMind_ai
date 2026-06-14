# PrepMind AI 开发日志

按日期记录关键改动、验证结果和提交信息。所有待办与规划统一放在文末，避免散落在历史记录中。

---

## 2026-06-05（Day 1）

**项目规划与初始化**

- 整理 Phase 0 ~ Phase 10 学习与开发路线。
- 初始化 monorepo：`apps/web`、`apps/server`、`packages/*`。
- 创建基础 packages：`types`、`database`、`ai`、`fsrs`、`rag`、`agent`、`mcp`、`ui`。
- 创建 Prisma schema 初稿与 Docker Compose 基础设施。
- 创建 `CLAUDE.md` 和 `DEVLOG.md`。

---

## 2026-06-06（Day 2）

**Phase 1 登录与聊天 MVP**

- 完成登录/注册 UI、表单校验、本地模拟登录和 AuthGuard。
- 完成移动端优先布局、PWA manifest、shadcn/ui 基础组件。
- 接入 Vercel AI SDK + DeepSeek，通过 `/api/chat` 实现 SSE 流式聊天。
- AI 回复支持 Markdown + GFM。
- 创建 `userStore` 和 `chatStore`，保存本地用户、登录态和输入草稿。

---

## 2026-06-07（Day 3）

**拍照识题与本地持久化**

- 实现图片上传、相机唤起、图片预览和全屏预览。
- 创建 `/api/ocr`，接入多模态 OCR 模型，支持 SSE 流式返回。
- 引入 Dexie，持久化聊天消息和 OCR 记录。
- 修复多轮持久化问题：无限循环、TDZ、刷新丢消息、AI 最终回复未保存。
- 创建 `docs/data-flow.md` 记录当时数据流。

---

## 2026-06-08（Day 4）

**Phase 1 收尾**

- Dexie schema 升级到 v6，`messages`、`ocrRecords`、`wrongQuestions` 增加 `userId`。
- 聊天消息与 OCR 消息合并为统一时间线。
- 实现本地错题本 CRUD、`sourceGroupId` 防重复、保存预览和缺失字段提示。
- 接入 `remark-math`、`rehype-katex`、`katex`，支持数学公式渲染。
- 优化错题详情页交互和遮罩层，修复 hydration warning。
- 实现今日任务静态版。
- 整理 Phase 1 数据流、开发文档和本地博客。

---

## 2026-06-09（Day 5）

**Phase 2.1 后端基础与鉴权**

- 将 workspace 包管理迁移到 Bun。
- 固定 Docker PostgreSQL 本机端口为 5433，新增 `docs/dev-start.md`。
- 扩展 Prisma schema，落地 Auth 相关模型和后续业务模型。
- 新增 NestJS Config / Database / Health 模块。
- 新增统一响应 envelope、异常过滤器和 requestId middleware。
- 新增 AuthModule：注册、登录、当前用户、refresh token 轮换、logout。
- 新增 UsersModule，支持读取和更新当前用户资料。
- `@repo/types` 新增 Auth/Common API schemas。
- 新增 AuthService 单元测试和 Auth e2e。
- 修复 AI Key 缺失提示、保存错题预览公式渲染和 `packages/fsrs` 类型检查脚本。

---

## 2026-06-11（Day 6）

**Phase 2.2 Auth 接入与 Phase 2.3 起步**

- 完成 Phase 2.2 中文 spec 与 implementation plan。
- 接入 TanStack Query，新增 `QueryProvider` 与 `AuthSessionProvider`。
- 新增 `apiClient`、`authApi` 和 Auth hooks。
- 登录/注册页面迁移到 NestJS Auth API。
- `AuthGuard` 改为以后端 session 为权威来源，应用启动通过 `/auth/refresh` 恢复 session。
- 增强 refresh token rotation：旧 RT 重放时返回 `AUTH_REFRESH_REUSED`，并撤销同 family 活跃 RT。
- 新增 WrongQuestion 后端 CRUD API、共享 Zod schema、单测与 e2e。
- 前端错题本和聊天页保存错题流程接入服务端 API。
- 新增 ChatMessage API 与前端聊天历史同步。
- 新增聊天上下文窗口和 `activeStudyContext` 注入，支持围绕 OCR 题目追问。
- 优化非题目 OCR 门禁、流式停止按钮、保存错题入口出现时机和 CRUD 轻提示。

验证：

- 前端 lint/build 通过。
- 后端 lint/build/test/e2e 通过。
- 关键前端 API、上下文、渲染与解析脚本测试通过。
- Prisma migration status 为 `Database schema is up to date`。

---

## 2026-06-12（Day 7）

**Phase 2.3 OCRRecord、MinIO 与流式体验**

- 新增 OCRRecord API contract、后端模块、单测与 e2e。
- 前端新增 OCRRecord API hooks，OCR 完成后先写服务端再同步 Dexie。
- 修复 `/chat-messages/sync` 重复同步导致的唯一约束错误。
- 新增服务端权威缓存合并 helper，服务端空列表会正确清理当前用户本地缓存。
- 移除 `next/font/google`，改用系统字体栈，避免受限网络下生产构建失败。
- 补齐 PWA 图标。
- 新增 MinIO 图片上传链路：`POST /uploads/images`、服务端稳定图片 URL、前端 multipart 上传。
- OCR 图片本地预览与 MinIO 上传并行；上传失败不阻塞 OCR。
- 新增 `StreamingMarkdownRenderer`，流式阶段稳定段落实时进入 Markdown / KaTeX。
- 修复新一轮生成时自动滚动意图没有恢复的问题。

验证：

- 前端 lint/build 通过。
- 后端 lint/build/test/e2e 通过。
- upload、OCRRecord、WrongQuestion、chat sync、streaming markdown、streaming scroll 等关键测试通过。
- server / web dev 短跑启动通过。

---

## 2026-06-13（Day 8）

**Phase 2.3 Final Stabilization 与 Phase 2.5 Product Experience**

- 完成 Phase 2.3 收尾设计与实现计划。
- Dexie schema 升级到 v7，新增 `mutationQueue`。
- 新增 mutation queue helper 与 flush 逻辑，支持 WrongQuestion / OCRRecord 失败写操作补偿同步。
- `AuthSessionProvider` 在 session 恢复、online、focus 时自动尝试 flush。
- WrongQuestion 创建、更新、删除支持乐观写入和失败补偿。
- OCRRecord 创建失败时保留本地 OCR 历史并进入补偿队列。
- ChatMessage 保持 `/chat-messages/sync` 幂等同步，不进入通用 CRUD mutation queue。
- 完成 Phase 2.5 产品体验补全计划。
- 新增学习偏好本地存储和个人中心。
- 今日任务升级为轻学习手账。
- 统一注册登录页、聊天页、错题本、今日任务、个人中心、侧边栏和输入区视觉系统。
- 修复 OCR / 错题展示格式化中全角小题编号、函数参数和多题内容的可读性问题。
- 修复切换页面再返回时聊天历史从顶部平滑滚到底部的问题。

验证：

- 前端 lint/build 通过。
- 后端 lint/build/test/e2e 通过。
- database、types、fsrs 验证通过。
- mutation queue、server cache sync、chat context、chat sync、streaming markdown、streaming scroll 等关键测试通过。
- 浏览器抽样 `/chat`、`/today`、`/error-book`、`/profile`、`/login`、`/register` 通过。

主要提交：

```text
9309358 docs: design phase 2.3 final stabilization
7262d67 docs: plan phase 2.3 final stabilization
eb2b2d0 feat: add local mutation queue schema
18392df feat: add mutation queue helpers
d30682e feat: add mutation queue flush logic
7cb5043 feat: flush local mutation queue
0b681a8 fix: preserve unsynced local cache items
e296758 feat: queue failed wrong question saves
82f1b7e feat: queue wrong question offline mutations
c2c6bc5 feat: queue failed ocr record sync
13f892a feat: add learning preferences storage
af3a012 feat: add profile update client plumbing
5544de0 style: add phase 2.5 visual tokens
a43c25d feat: complete profile center
c027233 style: redesign chat navigation drawer
9ea86b5 feat: redesign today study notebook
881140a style: polish error book experience
ff746a6 style: refresh chat study buddy UI
85d7c65 fix: polish chat empty state
c67fda3 fix: stabilize ocr rendering and chat restore scroll
f5a2eb1 style: soften cartoon theme palette
0b07ef3 style: refresh auth pages theme
```

---

## 2026-06-14（Day 9）

**Phase 3 前文档精简**

- 精简 `AGENTS.md` 与 `CLAUDE.md`，保留当前阶段、命令、模块边界、数据流和下一步。
- 精简 `README.md`，改为 GitHub 项目入口，突出当前能力、架构、启动和 Phase 3 下一步。
- 重写 `docs/roadmap.md`，保留阶段路线、已完成阶段摘要和 Phase 3 验收边界。
- 重写 `docs/data-flow.md`，只描述当前仍有效的数据流，历史实现细节移交给开发日志。
- 压缩 `DEVLOG.md` 历史条目，保持同一天改动合并记录，待办统一放文末。

验证：

- `git diff --check` 通过，仅有 Windows 换行提示。
- 关键文档中的 Phase 3、`mutationQueue`、`5433`、`next/font` 等表述检查通过。

**Phase 3 AI 讲题系统**

- 新增 `@repo/types/api/ocr-question`，定义 OCR structured output、题目对象、保存状态和 tool action proposal schema。
- `/api/ocr` 改为 display Markdown + structured JSON envelope 输出协议，并将 OCR prompt 抽到可测试模块。
- 前端新增 structured OCR parser、legacy adapter、activeStudyContext 映射和 wrong-question 映射。
- OCRRecord `parsedJson` 开始保存结构化题目结果，旧 OCR 历史继续兼容。
- OCR runtime 在流结束后保存结构化结果，并从结构化主问题生成追问上下文。
- 保存错题优先使用结构化字段，多题使用独立 `sourceGroupId:questionId` 防重。
- 聊天页新增多题题目卡片，支持单题确认保存和所选题目批量保存。

验证：

- `node --experimental-strip-types packages/types/tests/ocr-question.test.mts` 通过。
- `node --experimental-strip-types packages/types/tests/ocr-record.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `node --experimental-strip-types apps/web/src/lib/ocr-prompt.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/chat-context.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过；worktree 内存在额外 lockfile，Next.js 输出 root 推断 warning。
- `bun run db:generate` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过。

---

## 当前状态

**Phase 0：已完成**

- Monorepo、设计文档、基础目录、初始数据库设计和基础设施配置。

**Phase 1：已完成**

- 前端 MVP、AI 聊天、OCR、Dexie 本地持久化、错题本 CRUD 和今日任务静态版。

**Phase 2.1：已完成**

- 后端基础、Prisma、PostgreSQL、Auth/User API、统一响应和测试覆盖。

**Phase 2.2：已完成**

- 前端 Auth 已接入后端，登录态权威来源迁移到 NestJS Auth API。
- Dexie 继续作为离线业务数据缓存。

**Phase 2.3：已完成**

- WrongQuestion / ChatMessage / OCRRecord API 已迁移到 PostgreSQL。
- OCR 图片上传链路已接入 MinIO。
- Dexie mutationQueue 与乐观更新层已完成。
- Chat / OCR 上下文、流式渲染和自动滚动体验已稳定。

**Phase 2.5：已完成**

- Chat-first 产品体验壳层、侧边栏导航、亮色软萌日漫风视觉系统已完成。
- 个人中心、本地学习偏好、今日任务轻学习手账已完成。
- 错题本、聊天页、输入区、保存错题弹层和空状态体验已完成打磨。
- 注册/登录页已统一到 Phase 2.5 视觉系统，Auth 数据流不变。

**Phase 3：已完成**

- OCR structured output schema、结构化 prompt、结构化 OCR 解析和 `OcrRecord.parsedJson` 已完成。
- `activeStudyContext` 已从结构化题目生成，支持题目 id、题型、难度和识别提醒。
- 错题保存已优先使用结构化字段，多题支持单题保存和批量保存。
- `createWrongQuestion` / `searchKnowledge` / `createReviewTask` 已保留为 tool action proposal 边界。

---

## 待办与规划

**Phase 4：FSRS 记忆系统**

- [ ] Card / ReviewLog / ReviewTask 数据流。
- [ ] Again / Hard / Good / Easy 评分。
- [ ] 今日复习任务。

**后续方向**

- [ ] RAG 知识库与 pgvector 检索。
- [ ] LangGraph 多 Agent 系统。
- [ ] MCP 工具体系。
- [ ] BullMQ 后台任务与生产观测。
