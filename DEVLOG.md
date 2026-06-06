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

**前端目录整理**
- 清理 Next.js 默认文件（SVG、favicon、.next 构建缓存）
- 创建 Phase 1 目录结构：`(auth)/login`、`(auth)/register`、`(main)/chat|today|error-book|profile`
- 移除 dark mode，纯白背景风格

**登录页 + 注册页**
- 登录页：手机号/邮箱 Tab 切换，正则校验（失焦+提交）
- 注册页：邮箱/用户名/密码/确认密码，校验规则完整
- 微信/支付宝快捷登录占位（标注"即将上线"）

**状态管理**
- 安装 zustand，创建 `stores/userStore.ts`
- zustand + persist 持久化到 localStorage（key: `prepmind-user`）
- 支持注册、手机号登录、邮箱登录、登出
- 固定短信验证码 `246810`（Phase 1 测试用）

**路由守卫**
- 创建 `AuthGuard` 组件，包裹 `(main)` 路由组
- 未登录用户自动重定向到 `/login`

**UI 组件**
- 底部导航栏：4 个 tab（今日/AI 对话/错题本/我的），选中态高亮
- PWA manifest.json 配置
- 移动端适配：44px 触摸区域、iOS 安全区域、禁止横滚

**修复**
- `FieldError` 类型兼容 `undefined`（Partial 导致）
- 移除按钮 `disabled` 属性，修复 React controlled input 警告

### Git 提交记录
```
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
| 登录/注册 UI | ✅ 完成 |
| 表单正则校验 | ✅ 完成 |
| zustand 状态管理 | ✅ 完成 |
| AuthGuard 守卫 | ✅ 完成 |
| AI 聊天 + 流式输出 | ⬜ 待做 |
| 拍照识题 + 图片上传 | ⬜ 待做 |
| 错题本 CRUD | ⬜ 待做 |
| 今日任务（静态） | ⬜ 待做 |

### 明天计划
- 实现 AI 聊天页面 + 流式输出（Vercel AI SDK mock）
- 拍照识题 UI
