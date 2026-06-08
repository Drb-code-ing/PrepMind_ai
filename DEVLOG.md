# PrepMind AI — 开发日志

按日期记录关键改动、验证结果和提交记录。所有当前待办和规划统一放在文末。

---

## 2026-06-05（Day 1）

**项目规划与初始化**

- 整理 AI 智能备考助手 Phase 0~10 学习与开发规划。
- 将架构设计文档转为 Markdown，放入 `docs/`。
- 初始化 Git 仓库与 monorepo：`apps/web`、`apps/server`、`packages/*`。
- 创建 8 个 workspace 包骨架：`types`、`database`、`ai`、`fsrs`、`rag`、`agent`、`mcp`、`ui`。
- 完成 Prisma Schema 初稿，覆盖用户、题目、错题、复习、文档、聊天等模型。
- 配置 Docker Compose：PostgreSQL + pgvector、Redis、MinIO。
- 创建 `CLAUDE.md` 和 `DEVLOG.md`。

**验证**

- `pnpm install` 成功。
- `pnpm --filter @repo/server build` 通过。
- `pnpm --filter @repo/web build` 通过。

**记录**

- Windows 下 pnpm 11.x store 曾出现权限问题，后续本机暂用 npm workspace 命令更稳定。

---

## 2026-06-06（Day 2）

**Phase 1 登录与聊天 MVP**

- 完成登录/注册页面 UI、表单校验、固定短信验证码登录。
- 创建 `userStore`，使用 zustand + localStorage 保存用户与登录态。
- 接入 AuthGuard，保护主流程页面。
- 完成移动端优先布局、PWA manifest、shadcn/ui 基础组件。
- 接入 Vercel AI SDK + DeepSeek，通过 `/api/chat` 实现 SSE 流式聊天。
- AI 回复支持 Markdown + GFM 渲染。
- 创建 `chatStore` 保存输入框草稿，解决切页丢输入问题。
- 重构聊天页面为顶部栏、侧边栏、输入栏、消息气泡结构。
- 做了一轮代码质量优化：React.memo、rAF 滚动节流、useRef 替代 DOM 查询、API Route 错误处理。

**验证**

- 前端 lint/build 在当日改动后通过。

---

## 2026-06-07（Day 3）

**拍照识题与本地持久化**

- 实现图片上传、相机唤起、图片预览、全屏预览。
- 创建 `/api/ocr`，接入 MIMO v2.5 多模态 OCR，支持 SSE 流式返回。
- OCR 提示词要求输出题干、知识点、分析思路、参考答案等结构化 Markdown。
- 引入 Dexie，创建 `prepmind-db`，先保存 `messages` 与 `ocrRecords`。
- 从 localStorage 消息持久化迁移到 IndexedDB。
- 修复多轮持久化问题：无限循环、TDZ、刷新丢消息、AI 最终回复未保存。
- 拆分 ChatPage / ChatView，确保 Dexie 数据加载完成后再挂载 `useChat()`。
- 创建 `docs/data-flow.md` 记录当时的数据流。

**已知问题**

- 当日发现 OCR 与聊天消息是两套渲染管线，刷新后交错顺序可能不稳定，Day 4 已修复。

---

## 2026-06-08（Day 4）

**架构 review 与 TanStack Query 决策**

- 审查 TanStack Query + Dexie 的实际作用，确认 Phase 1 无服务端数据源时它只是额外缓存层。
- 移除 `@tanstack/react-query`、QueryClient、相关 hooks 和 Providers。
- 明确 Phase 2 接入 HTTP API 后再恢复 TanStack Query，用于 server state。

**Dexie 与消息时间线**

- Dexie schema 升级到 v6。
- `messages` 增加 `createdAt`，支持刷新后按时间线恢复。
- `ocrRecords` 增加 `groupId`，绑定同一次 OCR 的图片与识别结果。
- 新增 `wrongQuestions` 表，作为 Phase 1 错题本唯一数据源。
- 聊天消息与 OCR 消息合并为 `unifiedMessages`，按时间排序统一渲染。

**本地账号隔离修复**

- `messages`、`ocrRecords`、`wrongQuestions` 新增 `userId` 字段和 Dexie 索引。
- 聊天页、OCR 记录、错题本页面全部按当前 `currentUser.id` 读写。
- 保存聊天和 OCR 时只替换当前用户自己的本地记录，不再全表 `clear()`。
- 退出登录不再清空 IndexedDB 业务数据，同一账号重新登录可以恢复自己的历史。
- 清空 localStorage 但未清空 IndexedDB 时，旧的无 `userId` 数据不会再展示给新注册账号。
- 新增 `user-scope` 回归测试，覆盖当前用户过滤和未登录写入保护。

**错题本 CRUD**

- 新增 `parseOcrResult()`：从 OCR Markdown 提取题目、学科、知识点、解析、答案、错因等字段。
- OCR 结果下方“保存到错题本”真实写入 Dexie。
- 使用 `sourceGroupId` 防重复保存，并修复 `sourceGroupId` 未建索引导致的 Dexie SchemaError。
- `/error-book` 实现错题列表、筛选、详情、删除、标记掌握、备注保存。
- 增强交互反馈：保存成功、删除、标记掌握、备注保存都有可见提示。
- 错题详情改为全屏页面式覆盖层，修复底层错题列表透出问题。

**Markdown 与数学公式**

- 新增统一 Markdown 渲染组件。
- 接入 `remark-math`、`rehype-katex`、`katex`，支持 `$...$` 和 `$$...$$` 数学公式。
- 优化 OCR 输出展示，将 `(1)(2)(3)` 这类连续题目格式拆成更易读的段落。

**Hydration 修复**

- 首页和 AuthGuard 改为客户端 effect 后读取本地登录态，避免 SSR/CSR 首屏不一致导致 hydration warning。

**文档同步**

- 重写 `docs/data-flow.md`，同步 Phase 1 当前 localStorage + Dexie + OCR + 错题本数据流。
- 重写 `CLAUDE.md` 与 `AGENTS.md`，同步当前命令、模块规则、Phase 1 进度和下一步。
- 整理 `DEVLOG.md`，将同一天改动合并记录，并把所有待办与规划统一收口到文末。
- 新增 `docs/dev-blog/2026-06-08-phase-1-complete.md`，归档 Phase 1 收官总结、数据流取舍、质量审查和 Phase 2 入口。

**今日任务静态版**

- 新增 `TODAY_TASKS` 静态任务模板：知识点复盘、错题回看、拍照识题、学习总结。
- `/today` 改为可交互任务面板，支持任务勾选、进度条、预计时长和快捷入口。
- 完成状态保存到 `prepmind-today:{userId}:{yyyy-mm-dd}`，按账号和日期隔离。
- 页面读取当前用户未掌握错题数量，用于增强错题复习任务提示。
- 暂不引入统一请求/响应拦截器；Phase 2 接入 NestJS API 后再封装 `apiClient`。
- 新增 `today-tasks` 回归测试，覆盖 storage key、任务 toggle 和进度计算。

**Phase 1 收尾**

- 清理注册页未使用的 `FIXED_SMS_CODE` 导入，前端 lint 不再有该 warning。
- 关键图片预览统一改用 `next/image` + `unoptimized`，保留 base64 预览能力并清除 `<img>` warning。
- 错题详情页备注保存的短暂状态改为可清理 timer，避免卸载后触发状态更新。
- OCR 提示词升级为固定 Markdown schema，并复用前端 schema 常量。
- 保存错题前新增字段预览确认，显示题目、学科、错因、知识点、参考答案和缺失字段提示。
- 新增 `wrong-question-parser` 回归测试，覆盖严格 schema 解析和缺失字段识别。

**代码 review 结论**

- 未发现 P0/P1 阻塞问题。
- Phase 1 本地错题本数据流可继续使用 Dexie；Phase 2 需要迁移到后端 API + PostgreSQL。
- Phase 1 已完成本地用户级数据隔离；Phase 2 迁移为后端用户归属。
- `formatOcrContentForDisplay()` 仍作为展示兜底；字段提取优先依赖固定 Markdown schema。

**验证**

- `node --test apps/web/src/lib/user-scope.test.mts` 通过。
- `node --test apps/web/src/lib/today-tasks.test.mts` 通过。
- `node --test apps/web/src/lib/wrong-question-parser.test.mts` 通过。
- `npm --workspace @repo/web run lint` 通过，0 warning。
- `npm --workspace @repo/web run build` 通过。

**提交记录**

```text
4a92f87 refactor: Day 4 — 移除 TanStack Query + 统一消息时间线 + 修复 OCR 渲染顺序
b64b94d feat: 实现 Phase 1 本地错题本 CRUD
eb861af feat: 支持 Markdown 数学公式渲染
c09cde6 feat: 增强错题本操作反馈
751517a feat: 优化错题详情页交互
07dd63e fix: 修复错题详情页背景透出
```

---

## 当前状态

**Phase 0：已完成**

- Monorepo、设计文档、基础目录、初始数据库设计、基础设施配置。

**Phase 1：已完成**

| 功能 | 状态 |
| --- | --- |
| 登录/注册 UI + 校验 + localStorage 用户态 | 完成 |
| AuthGuard 登录守卫 | 完成 |
| 移动端优先布局 + PWA manifest + shadcn/ui | 完成 |
| AI 聊天 + DeepSeek SSE 流式输出 | 完成 |
| Markdown + GFM + 数学公式渲染 | 完成 |
| chatStore 输入草稿保存 | 完成 |
| 拍照识题 + 图片上传 + OCR 流式输出 | 完成 |
| Dexie 保存 messages / ocrRecords / wrongQuestions + userId 账号隔离 | 完成 |
| 聊天 + OCR 统一时间线 | 完成 |
| 错题本 CRUD（本地版） | 完成 |
| 今日任务（静态版） | 完成 |

---

## 待办与规划

**Phase 1**

- [x] MVP 收尾完成。

**Phase 2 准备**

- [ ] NestJS AuthModule + 用户会话。
- [ ] WrongQuestion CRUD API + Prisma/PostgreSQL。
- [ ] ChatMessage / OCRRecord API。
- [ ] 恢复 TanStack Query 管理 server state。
- [ ] Dexie 降级为离线缓存与乐观更新层。
- [ ] 图片从 base64 迁移到 MinIO/OSS URL。
