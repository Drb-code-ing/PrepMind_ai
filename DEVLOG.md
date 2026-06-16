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

**Phase 4.1 FSRS 复习闭环**

- 完成 Phase 4 FSRS 设计 spec 与 Phase 4.1 implementation plan。
- 实现 `@repo/fsrs` 纯调度器，支持 Again / Hard / Good / Easy 评分后的状态、间隔和日志字段计算。
- 新增 `@repo/types/api/review`，统一 Review API contract。
- 调整 Prisma `Card` / `ReviewLog`：`Card` 支持 `wrongQuestionId`，`ReviewLog` 记录 `elapsedDays` 与 `reviewDurationMs`。
- 新增 NestJS Review API：错题加入复习、按错题读取卡片、今日到期卡片、提交评分。
- 前端新增 Review API client 与 hooks。
- 错题详情支持加入复习计划，加入后按钮显示复习状态和下次复习时间。
- 今日任务接入到期复习卡，支持查看答案和四档评分；评分后卡片按服务端状态从今日待复习中移除。
- 修复 server e2e 的 ts-jest rootDir 配置，避免 workspace package export map 在 e2e 编译阶段解析歧义。

验证：

- `bun --cwd packages/fsrs test` 通过。
- `node --experimental-strip-types packages/types/tests/review.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --cwd packages/database test` 通过。
- `bun run db:generate` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-api.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器冒烟通过：注册测试账号、创建测试错题、错题详情加入复习、今日任务展开答案、提交“掌握”评分、卡片从今日到期列表移除。

**Phase 4.2 学习统计**

- 新增 Review stats/logs API，基于 `Card` / `ReviewLog` / `WrongQuestion` 聚合复习数据。
- 新增 `/stats` 学习统计页，展示复习总览、趋势、评分分布、卡片状态和最近复习记录。
- 侧边栏和今日任务页新增学习统计入口。
- 统计和日志按当前 `userId` 隔离，不新增 `ReviewTask` 表。
- 浏览器验收通过：注册 smoke 账号、创建错题、加入复习计划、提交“掌握”评分、打开 `/stats` 验证 7 天 / 30 天统计、侧边栏入口和今日任务入口；验收后删除 smoke 账号。

验证：

- `node --experimental-strip-types packages/types/tests/review.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --filter @repo/server test -- reviews.service.spec.ts` 通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand reviews.e2e-spec.ts` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。

**Phase 4.3 ReviewTask 数据流**

- 新增 Prisma `ReviewTask`、`ReviewTaskStatus`、`ReviewTaskSource`，以 `cardId + scheduledDate` 防止同一复习卡当日重复生成任务。
- 新增 `@repo/types/api/review-task`，统一 ReviewTask 今日任务、列表、评分、跳过和恢复 API contract。
- 新增 NestJS `ReviewTasksModule`：`/review-tasks/today` 懒生成当日任务，`/review-tasks/:taskId/rating` 在事务内更新 Card、写入 ReviewLog、完成 ReviewTask。
- 新增跳过与恢复：`skip` / `reopen` 只改变 ReviewTask 状态，不更新 Card，也不写 ReviewLog。
- 今日任务页从 `/reviews/tasks/today` 迁移到 `/review-tasks/today`，展示待复习、已完成和已跳过状态，并支持恢复已跳过任务。
- `/stats` 继续以 ReviewLog 为统计事实来源，ReviewTask 只表示任务生命周期。
- 打磨 `/stats` 复习趋势图：30 天模式改为稀疏刻度的 SVG 面积折线图，并收敛线宽、点位和配色。
- 浏览器验收通过：创建 smoke 账号和到期复习卡、打开 `/today`、跳过、恢复、展开答案、提交“掌握”评分、确认任务进入已完成摘要、打开 `/stats` 验证 ReviewLog 统计；验收后删除 smoke 账号。
- 本地已 fast-forward 合并 `codex/phase-4-3-review-task-flow` 到 `main`。

验证：

- `node --experimental-strip-types packages/types/tests/review-task.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --cwd packages/database test` 通过。
- `bun --cwd packages/fsrs test` 通过。
- `bun --cwd packages/database prisma migrate deploy` 通过；无待应用 migration。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-task-api.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-task-view.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- `git diff --check` 通过。

---

## 2026-06-15（Day 10）

**Phase 4.4 离线评分队列与提醒摘要**

- ReviewTask 评分加入 `clientMutationId` 幂等链路，服务端通过 `ReviewLog.clientMutationId` 避免弱网重试重复写入复习日志。
- Prisma 新增 `ReviewLog.clientMutationId` nullable unique 字段，并补齐 ReviewTask rating 单测与 e2e 幂等覆盖。
- Dexie `mutationQueue` 扩展 `reviewTask/rating`，离线或可重试失败的评分会进入待同步队列。
- 今日任务页新增本地待同步评分状态、手动重试入口和 in-app 复习提醒摘要；离线评分不本地推进 FSRS、ReviewLog 或统计。
- 新增 `@repo/web test` 脚本，统一运行前端 Node `.test.mts` 测试。
- 浏览器验收中修复重复知识点展示导致的 React duplicate key 警告，新增展示层知识点去空、去重和数量限制。

验证：

- `node --experimental-strip-types packages/types/tests/review.test.mts` 通过。
- `node --experimental-strip-types packages/types/tests/review-task.test.mts` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `bun --cwd packages/database test` 通过。
- `bun --cwd packages/database prisma migrate deploy` 通过；无待应用 migration。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --filter @repo/server test -- review-tasks.service.spec.ts` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand review-tasks.e2e-spec.ts` 通过。
- `bun --filter @repo/web test` 通过，128 个测试全部通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器验收通过：注册 smoke 账号、创建错题和 ReviewTask、打开 `/today`、展开答案、模拟后端断开提交离线评分、恢复后端并手动重试同步；待同步状态、按钮禁用、完成摘要和 console 恢复后无错误均符合预期。
- `git diff --check` 通过。

---

## 2026-06-16（Day 11）

**Phase 4.5.1 复习计划预览与统计图表升级**

- 新增 `@repo/types/api/review-task` 的 plan contract，限制 `days`、`startDate` 和 `timezoneOffsetMinutes` 查询边界。
- 新增 `GET /review-tasks/plan`，基于 `Card.nextReview` 只读计算未来复习压力、逾期数量、待同步数量和预计用时，不创建未来 `ReviewTask`。
- 后端补齐 plan query 默认值、用户隔离、日期边界、future task 不创建等单测与 e2e 覆盖。
- 前端新增 `reviewTaskApi.getPlan`、`useReviewTaskPlan` 和 `/plan` 页面，展示未来 7 天复习压力、每日安排和高峰日提示。
- 今日任务页新增复习计划入口；未来日期只展示“到期后处理”，今日行跳转 `/today`。
- 新增客户端 `BaseEChart`，通过 `useEffect` 动态加载 ECharts，避免 SSR / hydration 风险。
- `/stats` 升级为 ECharts 趋势图、评分分布图和卡片状态图，保留评分 fallback 文本网格，移动端无横向溢出。
- 修复 `/stats` 空态判断：图表空态只看当前统计窗口 `totalReviews`，历史最近记录不再阻止当前窗口空态。
- 修复 ECharts 图表在浏览器缩放和半透明背景下偏糊的问题：统一使用 SVG renderer，提升文字、坐标轴和细线清晰度。
- `/plan` 使用本地日期刷新 hook，在 focus、visibilitychange 和跨日时刷新计划窗口。
- 浏览器验收通过：注册 QA 账号、创建错题、加入复习卡、提交评分，验证 `/plan` 非空计划、`/stats` 三个 canvas 非空、7 天 / 30 天切换、`/today` 入口和移动端布局。

验证：

- `node --experimental-strip-types apps/web/src/lib/review-stats-view.test.mts` 通过。
- `bun --filter @repo/web test` 通过，136 个测试全部通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- `bun --filter @repo/server test` 通过，80 个测试全部通过。
- `bun --filter @repo/server lint` 通过。
- `bun --filter @repo/server build` 通过。
- `bun --cwd packages/types typecheck` 通过。
- `node --experimental-strip-types packages/types/tests/review-task.test.mts` 通过。
- `bun --cwd packages/database test` 通过。
- `bun --cwd packages/fsrs test` 通过。
- `bun --filter @repo/server test:e2e` 通过，8 个 suites、13 个 tests 全部通过。
- `git diff --check` 通过。

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

**Phase 4：进行中**

- Phase 4.1 WrongQuestion-first FSRS 复习闭环已完成。
- Phase 4.2 学习统计页和 Review stats/logs API 已完成。
- Phase 4.3 ReviewTask 持久化任务流已完成并合并到 `main`。
- Phase 4.4 离线评分队列、服务端幂等评分和 in-app 提醒摘要已完成。
- Phase 4.5.1 复习计划预览、`/plan` 页面和 `/stats` ECharts 图表升级已完成。
- 错题可加入复习卡，今日任务可读取持久化 ReviewTask 并提交四档评分、跳过和恢复。
- `/plan` 可只读预览未来复习压力；`/stats` 可读取复习趋势、评分分布、卡片状态和最近复习记录。
- Card / ReviewLog / ReviewTask 以 PostgreSQL 为权威来源；ReviewTask rating 离线失败可进入 Dexie mutationQueue，但 FSRS 和统计只在服务端同步成功后推进。

---

## 待办与规划

**Phase 4：FSRS 记忆系统**

- [x] WrongQuestion-first Card / ReviewLog 第一轮数据流。
- [x] Again / Hard / Good / Easy 评分入口。
- [x] 今日任务接入到期复习卡。
- [x] 复习历史与统计。
- [x] 更完整的 ReviewTask 数据流。
- [x] Phase 4.4：离线评分队列与提醒策略。
- [x] Phase 4.5.1：复习计划预览与统计图表升级。
- [ ] Phase 4.5.2：复习提醒策略与更长期计划设置。

**后续方向**

- [ ] RAG 知识库与 pgvector 检索。
- [ ] LangGraph 多 Agent 系统。
- [ ] MCP 工具体系。
- [ ] BullMQ 后台任务与生产观测。
