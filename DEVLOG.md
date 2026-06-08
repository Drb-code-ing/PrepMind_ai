# PrepMind AI — 开发日志

按日期记录每天做了什么，方便回顾进度。

---

## 2026-06-05（Day 1）

### 今天完成了

**项目规划**

- 整理了 AI 智能备考助手的学习与开发规划文档（Phase 0~10，共 11 个阶段）
- 从 DeepSeek 导出了完整的架构设计文档（10 章节：系统架构、Monorepo、数据库、API、Agent、MCP 等）
- 两份文档都转成了 Markdown 格式放在 `docs/` 目录

**项目初始化**

- 初始化了 Git 仓库
- 搭建了 pnpm workspaces 的 Monorepo 结构
- 创建了 Next.js 16 前端应用（`apps/web`）
- 创建了 NestJS 11 后端服务（`apps/server`）
- 创建了 8 个 workspace 包骨架：
  - `@repo/types` — 共享类型 + Zod schemas
  - `@repo/database` — Prisma + 数据访问
  - `@repo/ai` — LLM 调用封装
  - `@repo/fsrs` — FSRS 间隔重复算法
  - `@repo/rag` — RAG 核心
  - `@repo/agent` — LangGraph Agent
  - `@repo/mcp` — MCP 工具注册
  - `@repo/ui` — 共享 React 组件
- 完成了 Prisma Schema 设计（12 个 model：User, Account, Session, Question, WrongQuestion, Card, ReviewLog, Document, Chunk, ChatMessage 等）
- 配置了 Docker Compose（PostgreSQL+pgvector, Redis, MinIO）
- 编写了 CLAUDE.md 项目指引
- 创建了 DEVLOG.md 开发日志

**验证**

- `pnpm install` 成功（pnpm 9.x，配置了 npmmirror 镜像）
- NestJS 构建通过（`pnpm --filter @repo/server build`）
- Next.js 构建通过（`pnpm --filter @repo/web build`）
- Git 提交完成（3 次提交）

### 踩的坑

- pnpm 11.x 的 SQLite store 在 Windows 上有权限问题（`ERR_SQLITE_ERROR: disk I/O error`）
- 解决方案：降级到 pnpm 9.x + 配置 npmmirror 镜像 + 自定义 store 位置
- `create-next-app` 会自动生成 `pnpm-workspace.yaml`，和根目录冲突，需要删除
- `nest new` 安装依赖也会失败，需要从根目录统一安装

### 恢复 pnpm（Day 1 补充）

- 降级到 pnpm 9.x（`9.15.9`），配置了 npmmirror 镜像加速
- 自定义 store 位置到 `C:/Users/Lenovo/AppData/Local/pnpm-store-fresh`
- `pnpm install` 成功（14 分钟），所有构建验证通过
- 提交了修复：`e8d8570 fix: 恢复 pnpm 工作流`

---

## 2026-06-06（Day 2）

### 今天完成了

**Phase 1 — 登录模块（纯前端）**

- 清理 Next.js 默认文件，创建 Phase 1 目录结构
- 登录页：手机号/邮箱 Tab 切换，正则校验（失焦+提交）
- 注册页：邮箱/用户名/密码/确认密码，校验规则完整
- 安装 zustand，创建 `stores/userStore.ts`，persist 到 localStorage
- 支持注册、手机号登录、邮箱登录、登出，固定短信验证码 `246810`
- AuthGuard 登录守卫 + zustand rehydration 等待（刷新页面不丢登录态）
- 移动端适配：PWA manifest、44px 触摸区域、iOS 安全区域
- 移除 dark mode，纯白背景风格
- 修复：FieldError 类型兼容 undefined、controlled input 警告

**AI 聊天 + 流式输出**

- 安装 Vercel AI SDK（`ai` + `@ai-sdk/openai`）
- 创建 `lib/ai-provider.ts`：统一封装 Provider，切模型只改环境变量
- 创建 `app/api/chat/route.ts`：streamText SSE 流式输出
- ChatPage 改用 `useChat()` hook，自动管理消息收发和上下文传递
- DeepSeek API 已连通，打字机效果跑通

**聊天页面重构（参考豆包布局）**

- ChatTopBar：顶部标题栏 + 菜单按钮
- ChatSidebar：右侧滑出面板（今日任务/错题本/个人中心/退出登录）
- ChatInputBar：底部输入栏（文本框 + [+] [📷] [🎤/发送]）
- 消息发送后欢迎页消失，展示聊天气泡
- 删除 BottomNav，侧边栏已替代导航

**Markdown 渲染 + 智能滚动**

- 安装 react-markdown + remark-gfm，AI 气泡支持完整 GFM 渲染
- 智能自动滚动：用户上翻时停止跟随，rAF 节流避免每 token 强制布局

**状态管理**

- chatStore（zustand + persist）：inputDraft 持久化到 localStorage，切页面不丢
- 包装 onInputChange 回调同步 store，去掉 useEffect + eslint-disable

**shadcn/ui 集成**

- 安装 shadcn/ui（base-nova style, neutral 色系）
- 添加 button/input/card/dialog/label/textarea 组件
- globals.css 更新为 shadcn 标准 CSS 变量（oklch 色彩空间）

**代码质量优化（/simplify 四维度审查）**

- 移除 chatStore 死代码（isWaiting, currentSessionId, resetChat）
- ChatBubble 用 React.memo，已完成消息跳过重渲染
- remarkPlugins 数组提升到模块级
- document.querySelector 改为 useRef
- AuthGuard 合并两个 loading 状态
- API Route 加 try/catch + 消息校验
- textarea 高度从 useEffect 改为 onInput

### Git 提交记录（Day 2）

```
af62415 docs: 更新开发日志 + Phase 1 进度 + 开发博客
e43d058 refactor: /simplify 代码质量优化（4 维度审查）
6bcf6e8 feat: AI 回复 Markdown 渲染
c3cb433 feat: 智能自动滚动，用户上翻时不强制拉回底部
a260fea feat: chatStore 管理聊天临时状态
cd0b7fb feat: AI 聊天流式输出，Vercel AI SDK + DeepSeek
72b21a8 fix: 修复滚动问题，只有聊天区域可滚动
db8a8dc refactor: 删除 BottomNav，重做 ChatInputBar 参考豆包
b19f752 feat: 重构聊天页面，参考豆包布局
e788cd5 feat: 集成 shadcn/ui 组件库
3c9f6fc fix: AuthGuard 等待 zustand rehydration 完成再校验
2b7eb0c feat: 聊天消息发送功能 + 消息气泡
bd6eb31 fix: 移除 disabled 属性，修复 controlled input 警告
895af98 fix: 登录页协议勾选控制登录按钮
ca1d4fa feat: AuthGuard 登录守卫，未登录重定向 /login
7c9d33f feat: zustand userStore + 登录注册全流程
f0f7238 fix: FieldError 类型兼容 undefined
cd44f63 feat: 登录/注册表单正则验证
08ef74b docs: 记录 pnpm EPERM 权限问题，当前用 npm
```

---

## 2026-06-07（Day 3）

### 今天完成了

**Bug 修复（3 个）**

- 修复登录态丢失：根页面改为 client component，等待 zustand hydration 完成后再校验
- 修复 inputDraft 残留：新增 `clearInputDraft`，消息发送后清空输入框草稿
- 修复聊天上下文丢失：创建 `messageStore`（zustand + persist），消息持久化到 localStorage

**状态管理 + 数据流**

- 创建 `stores/messageStore.ts`：聊天消息持久化，刷新页面不丢上下文
- 修复无限循环：`messages` 每 token 产生新引用 → 改用 `messages.length` 作 effect 依赖 + `messagesRef` 读内容
- 修复 TDZ 错误：`messagesRef` 初始化移到 `useChat()` 之后
- 修复渲染警告：`messagesRef.current = messages` 移入 `useLayoutEffect`
- 修复 AI 回复丢失：persistence effect 增加 `isLoading` 依赖，AI 完成时最终持久化
- TanStack Query 讨论决策：Phase 2 接入后端时引入，管理 server state

**聊天页面增强**

- 加号按钮展开功能菜单（图片/文件/拍照），Plus 图标旋转 45° 动画
- 恢复底部栏独立相机按钮
- 智能发送按钮：有文字/图片时显示发送，否则显示麦克风

**拍照识题 + 图片上传**

- 相机/相册唤醒：两个隐藏 `<input type="file">`（camera capture + gallery）
- 菜单「图片」触发相册、「拍照」触发摄像头、底部相机按钮触发摄像头
- 已选图片在输入区上方显示 80×80 预览缩略图 + 移除按钮
- 新建 `/api/ocr` 路由：接收 FormData，调用 MIMO v2.5 多模态识别
- 系统提示词要求结构化输出：题干、知识点、分析思路、参考答案
- 有图片时表单提交拦截走 OCR 流程，不走 useChat
- OCR 改为 SSE 流式输出（MIMO stream: true），逐 token 渲染结果
- 识别结果 Markdown 渲染 +「📝 保存到错题本」占位按钮
- 图片独立显示（不包裹在气泡内），点击全屏预览
- 图片改用 base64 data URL（FileReader），修复预览不可见问题

**存储架构迁移：localStorage → Dexie + TanStack Query**

- 安装 `dexie` + `@tanstack/react-query`
- 创建 `lib/db.ts`：Dexie 数据库 `prepmind-db`，两张表（messages + ocrRecords）
- 创建 `lib/query-client.ts`：QueryClient 工厂（staleTime/gcTime Infinity）
- 创建 `app/providers.tsx`：客户端 QueryClientProvider 包装
- 创建 `hooks/use-messages.ts`：usePersistedMessages / useSaveMessages / useClearMessages
- 创建 `hooks/use-ocr-records.ts`：useOcrRecords / useSaveOcrRecords
- layout.tsx 添加 Providers 包装
- 删除 `stores/messageStore.ts`，localStorage 仅保留 config/token/UI 状态
- 直接采用 Dexie 跳过 localForage，省去 Phase 2 迁移

**ChatPage 重构：父组件 + 子组件模式**

- ChatPage（父）：负责 Dexie 加载，数据未就绪时显示 loading
- ChatView（子）：包含 useChat，首次挂载时 initialMessages 已就绪
- 解决 useChat 的 initialMessages 只在首次渲染生效的问题

**Dexie 持久化修复（多轮迭代）**

- 修复 mutation 对象放在 useEffect 依赖中导致无限 clear+bulkAdd 循环
- clear() + bulkAdd() 包裹在 db.transaction() 原子事务中
- mutation 对象改用 ref 持有，从 effect 依赖中移除
- 首次加载跳过保存（数据已在 Dexie 中）
- 添加 beforeunload + visibilitychange 监听，页面关闭时强制保存
- StoredMessage 加 order 字段，Dexie schema v2，解决刷新后消息顺序错乱
- /simplify 审查发现 Dexie v2 schema 遗漏 ocrRecords 表导致数据丢失，已修复

**文档**

- 创建 `docs/data-flow.md` 数据流向全景图（7 章节，671 行）
- 覆盖存储层概览、6 条核心数据流、Store 关系图、Phase 2 迁移规划、前后端职责矩阵

### 已知问题

- **OCR 刷新后渲染顺序错误**：拍照识别的图片+结果在刷新后与文字聊天消息的相对顺序可能错乱。Dexie 存储本身正常，问题在渲染层（OCR 消息和聊天消息是两套独立的状态和渲染逻辑）

### Git 提交记录（Day 3，27 次提交）

```
b3de1e8 fix: /simplify 审查修复 — OCR 数据丢失根因 + 4 个问题
9f59fbf docs: Day 3 深夜补充 — Dexie 迁移 + OCR 流式 + 审查修复
08b3ec0 fix: OCR 保存改用 ref + setTimeout，确保数据写入 Dexie
e21c30d fix: OCR 记录直接在流式完成后保存，不依赖 effect
8b5c227 chore: 移除 debug 日志
941ccd7 debug: 追踪消息顺序问题
ddf430a fix: 等待 OCR 数据加载完成再挂载 ChatView
dcc3eec debug: 添加 Dexie 持久化 debug 日志
55755f3 fix: OCR 消息持久化 — 加 ocrLoading 依赖触发流式完成后保存
fcd37e1 fix: 消息顺序 + OCR 流式输出 + OCR 持久化
0d8c464 fix: 修复 Dexie 持久化数据丢失（3 个关键问题）
3a5527e fix: 拆分 ChatPage + ChatView，彻底修复消息丢失
fb8f590 refactor: Dexie + TanStack Query 替代 messageStore + localStorage
322cc83 fix: localForage 加载完成前阻塞渲染，修复 AI 回复丢失
402796c refactor: 引入 TanStack Query + localForage，替代 messageStore
8d7bd0f fix: 图片改用 base64 data URL，修复预览不可见
31479c3 feat: 点击图片全屏预览
d446b45 fix: OCR 图片独立显示，不包裹在气泡内
13f962e fix: OCR 用户消息显示图片缩略图 + 文字可选
ce1dade feat: 拍照识题 — MIMO v2.5 图片识别 + 错题本占位
f2c763f feat: 实现相机和相册唤醒功能
7d3aeaf fix: AI 回复完成后也持久化消息，刷新不丢最新回复
145d656 fix: messagesRef 赋值移入 useLayoutEffect，消除渲染期警告
504348e fix: messagesRef 初始化移到 useChat 之后，修复 TDZ 错误
81da953 fix: 修复消息持久化导致的 Maximum update depth exceeded
bf142f4 fix: 恢复底部栏相机按钮
a5b134d feat: 加号按钮展开功能菜单（图片/文件/拍照）
0d969fd docs: 添加数据流向全景图
4ce5e59 fix: 修复 3 个 bug — 登录态持久化、输入框残留、聊天上下文丢失
```

---

## 2026-06-08（Day 4）

### 今天完成了

**架构审查：TanStack Query 真实角色分析**

- 逐行审查了 TanStack Query + Dexie 的全部代码，发现 TanStack Query 在 Phase 1 是死重：
  - `staleTime: Infinity` + `gcTime: Infinity` 关闭了所有自动刷新能力
  - `useQuery` 直接读 Dexie，不走 HTTP，等价于 `useState + await Dexie`
  - 全局只用了 `useQuery` + `useMutation` + `setQueryData`，`invalidateQueries`、`useInfiniteQuery` 等核心 API 全未使用
  - `beforeunload` 处理器已经证明直接 Dexie 写入完全可行
- 结论：当前引入纯粹是 Day 3 迁移 localStorage→Dexie 时的过早引入，Phase 2 接入 API 时再装回来即可

**移除 TanStack Query**

- 删除 `hooks/use-messages.ts`、`hooks/use-ocr-records.ts`（TanStack Query 薄封装）
- 删除 `lib/query-client.ts`（QueryClient 工厂）
- 删除 `app/providers.tsx`（QueryClientProvider）
- `app/layout.tsx` 移除 Providers 包裹
- `chat-sidebar.tsx` 退出登录改为直接 `db.transaction()` 清空两张 Dexie 表
- 卸载 `@tanstack/react-query` 依赖，bundle 减小 ~47KB
- 空 `hooks/` 目录一并移除

**Dexie schema v3 — 消息时间戳**

- `StoredMessage` 新增 `createdAt: number` 字段
- 新增 v3 schema：`messages: "id, role, order, createdAt"` + upgrade 迁移填充旧数据

**统一消息渲染管线（修复 OCR 渲染顺序）**

- 新增 `UnifiedMsg` 类型（`"chat" | "ocr-user" | "ocr-result"`）
- `chatTimestamps` state + effect 追踪每条聊天消息的创建时间戳
- `useMemo` 将 chat messages + OCR records 合并并按 `time` 排序，ChatBubble 和 OcrBubble 按时间线交错渲染
- OCR 流式完成保存移除 `setTimeout(100)` 竞态，改为直接用 `fullContent`（权威数据）patch ref 后保存
- 保存路径统一：chat 和 OCR 都走直接 Dexie `clear + bulkAdd` 事务，不再有双重写入路径

**错题本 CRUD（Phase 1 本地版）**

- Dexie 新增 `wrongQuestions` 表，作为 Phase 1 错题本唯一数据源
- `ocrRecords` 新增 `groupId`，稳定绑定同一次 OCR 的图片与识别结果
- 新增 `parseOcrResult()`，把 OCR Markdown 解析为题目、学科、知识点、解析、答案、错因等字段
- OCR 提示词改为稳定 Markdown 标题结构，便于前端轻量提取字段
- OCR 结果的「保存到错题本」改为真实写入 Dexie，并按 `sourceGroupId` 防重复保存
- `/error-book` 实现移动端优先的错题列表、状态/学科筛选、详情查看、删除、标记掌握、备注编辑
- 退出登录时同步清空 `messages`、`ocrRecords`、`wrongQuestions`

### Git 提交记录（Day 4）

```
4a92f87 refactor: Day 4 — 移除 TanStack Query + 统一消息时间线 + 修复 OCR 渲染顺序
（错题本 CRUD 待提交）
```

---

## Phase 1 进度

| 功能                                 | 状态    |
| ------------------------------------ | ------- |
| 登录/注册 UI + 校验 + zustand + 守卫 | ✅ 完成 |
| AI 聊天 + 流式输出 + Markdown 渲染   | ✅ 完成 |
| chatStore 临时状态管理               | ✅ 完成 |
| 移动端优先布局 + PWA + shadcn/ui     | ✅ 完成 |
| 代码质量审查 + 性能优化              | ✅ 完成 |
| 拍照识题 + 图片上传 + OCR 流式       | ✅ 完成 |
| OCR/聊天消息渲染顺序统一             | ✅ 完成 |
| 错题本 CRUD                          | ✅ 完成 |
| 今日任务（静态版本）                 | ⬜ 待做 |

## 待解决

- 上下文长度限制（Phase 2）
- 消息持久化到数据库（Phase 2）
- 无对话历史管理（Phase 2）

## 明天计划

- 今日任务静态页面

---

## Phase 1→Phase 2 迁移规划

> Phase 2 接入后端时恢复 TanStack Query，当前 Phase 1 直接 Dexie 足够。

### 存储分层策略

| 层级           | Phase 1（当前）       | Phase 2（目标）       | 存什么                         |
| -------------- | --------------------- | --------------------- | ------------------------------ |
| localStorage   | zustand + persist     | 保留                  | 配置、token、用户信息、UI 偏好 |
| IndexedDB      | Dexie (`prepmind-db`) | 保留为离线缓存        | 聊天消息、OCR 记录、错题       |
| TanStack Query | —（已移除）           | 引入管理 server state | API 数据的缓存层               |
| PostgreSQL     | —                     | Prisma + pgvector     | 唯一真值来源                   |
| Redis          | —                     | ioredis               | 接口缓存、登录态、限流         |
| 对象存储       | —                     | OSS / COS / MinIO     | 图片、大文件；PG 只存 URL      |

### 迁移路线

```
Phase 1（当前）             Phase 2
──────────────────────────────────────────────────
localStorage (config+token)  →  保留
zustand (UI 状态)             →  保留
Dexie messages + ocrRecords  →  useInfiniteQuery + API（TanStack Query 重新引入）
useChat (流式聊天)            →  不变
—                             →  PostgreSQL (唯一真值)
—                             →  Redis (缓存层)
—                             →  OSS (文件存储)
```

### 当前进展

- [x] localStorage 三层分离（userStore / chatStore）
- [x] 聊天消息 + OCR 记录持久化到 Dexie
- [x] 统一消息渲染管线（chat + OCR 按时间线排序）
- [x] 移除过早引入的 TanStack Query（Phase 2 再装）
- [ ] 错题本 CRUD
- [ ] 今日任务（静态版本）
- [ ] PostgreSQL + Prisma 接入（Phase 2）
- [ ] Redis 缓存层（Phase 2）
- [ ] TanStack Query 重新引入（Phase 2）
- [ ] OSS 文件存储（Phase 2）
