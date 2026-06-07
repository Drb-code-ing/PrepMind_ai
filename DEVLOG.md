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

### 明天计划
- 启动 PostgreSQL（Docker），运行 Prisma 首次迁移
- 搭建 NestJS 基础 API 网关 + Swagger
- 实现 JWT 认证模块

---

## 2026-06-05（Day 1 补充）

### 恢复 pnpm

- 发现 pnpm 11.x 的 SQLite 错误是因为 store 文件权限被锁定
- 降级到 pnpm 9.x（`9.15.9`），配置了 npmmirror 镜像加速
- 自定义 store 位置到 `C:/Users/Lenovo/AppData/Local/pnpm-store-fresh`
- `pnpm install` 成功（14 分钟），所有构建验证通过
- 更新了 CLAUDE.md 和 package.json 为 pnpm 命令
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

### Git 提交记录
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

### Phase 1 进度

| 功能 | 状态 |
|------|------|
| 登录/注册 UI + 校验 + zustand + 守卫 | ✅ 完成 |
| AI 聊天 + 流式输出 + Markdown 渲染 | ✅ 完成 |
| chatStore 临时状态管理 | ✅ 完成 |
| 移动端优先布局 + PWA + shadcn/ui | ✅ 完成 |
| 代码质量审查 + 性能优化 | ✅ 完成 |
| 拍照识题 + 图片上传 | ⬜ 待做 |
| 错题本 CRUD | ⬜ 待做 |
| 今日任务（静态版本） | ⬜ 待做 |

### 待解决
- 上下文长度限制（Phase 2）
- 消息持久化到数据库（Phase 2）

### 明天计划
- 拍照识题 UI + 图片上传功能
- 错题本 CRUD 页面

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
- TanStack Query 讨论决策：Phase 2 接入后端时再引入，管理 server state

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
- 识别结果 Markdown 渲染 +「📝 保存到错题本」占位按钮
- 图片独立显示（不包裹在气泡内），点击全屏预览
- 图片改用 base64 data URL（FileReader），修复预览不可见问题

**文档**

- 创建 `docs/data-flow.md` 数据流向全景图（7 章节，671 行）
- 覆盖存储层概览、6 条核心数据流、Store 关系图、Phase 2 迁移规划、前后端职责矩阵

### Git 提交记录
```
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

### Phase 1 进度

| 功能 | 状态 |
|------|------|
| 登录/注册 UI + 校验 + zustand + 守卫 | ✅ 完成 |
| AI 聊天 + 流式输出 + Markdown 渲染 | ✅ 完成 |
| chatStore 临时状态管理 | ✅ 完成 |
| 移动端优先布局 + PWA + shadcn/ui | ✅ 完成 |
| 代码质量审查 + 性能优化 | ✅ 完成 |
| 拍照识题 + 图片上传 | ✅ 完成 |
| 错题本 CRUD | ⬜ 待做 |
| 今日任务（静态版本） | ⬜ 待做 |

### 待解决
- localForage 迁移（替代 localStorage 存储大数据）
- 错题本 CRUD 页面

### 明天计划
- 安装 localForage，迁移 messageStore / OCR 记录到 IndexedDB
- 错题本 CRUD 页面（列表 + 详情 + 删除）
- 今日任务静态页面

---

## Phase 1→Phase 2 迁移规划

> 此区为统一迁移规划，后续每期在此追加进展。

### 存储分层策略

| 层级 | Phase 1（当前） | Phase 2（目标） | 存什么 |
|------|-----------------|-----------------|--------|
| localStorage | zustand + persist | 保留 | 配置、token、用户信息、UI 偏好（体积小、同步读写） |
| IndexedDB | — | localForage → IDB + Dexie | 错题、聊天记录、OCR 图片记录（体积大、异步读写） |
| PostgreSQL | — | Prisma + pgvector | 题库、用户、账号、AI 对话、云端错题、学习记录、分类字典（唯一真值来源） |
| Redis | — | ioredis | 接口缓存、题库缓存、登录态、限流计数器 |
| 对象存储 | — | OSS / COS / MinIO | 图片、大文件、PDF；PG 只存 URL |

### 迁移路线

```
Phase 1                    Phase 2
──────────────────────────────────────────────────
localStorage (全量)   →    localStorage (仅 config/token)
zustand + persist     →    zustand (纯 UI 状态)
messageStore          →    useInfiniteQuery (TanStack Query)
userStore (持久化)    →    useQuery + JWT auth
localForage (新增)    →    IDB + Dexie (替代 localForage)
—                     →    PostgreSQL (唯一真值)
—                     →    Redis (缓存层)
—                     →    OSS (文件存储)
```

### 设计原则

- **zustand 仅存 UI 状态和业务数据的缓存/中转**，不作为最终数据源
- **前端存储是离线副本**，提升移动端体验，支持弱网/离线场景
- **PostgreSQL 是唯一真值来源**，前端数据最终同步到后端
- **Phase 2 引入 TanStack Query** 管理 server state（消息分页、错题 CRUD、用户数据）
- **useChat 继续管流式聊天**，与 TanStack Query 职责不冲突

### 当前进展

- [x] localStorage 三层分离（userStore / chatStore / messageStore）
- [x] messageStore 消息持久化 + isLoading 触发最终保存
- [ ] localForage 迁移 messageStore + OCR 记录
- [ ] IDB + Dexie 替代 localForage（Phase 2）
- [ ] PostgreSQL + Prisma 接入（Phase 2）
- [ ] Redis 缓存层（Phase 2）
- [ ] TanStack Query 引入（Phase 2）
- [ ] OSS 文件存储（Phase 2）
