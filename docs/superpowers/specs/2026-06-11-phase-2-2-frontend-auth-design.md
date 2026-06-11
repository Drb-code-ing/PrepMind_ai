# Phase 2.2 前端 Auth 接入设计

## 目标

Phase 2.2 的目标是把前端登录态从 Phase 1 的 localStorage 模拟账号迁移到 Phase
2.1 已完成的 NestJS Auth API。完成后，注册、登录、会话恢复、退出登录都以后端为权威来源。

本阶段不迁移错题、聊天、OCR 数据 API。Dexie 继续作为 Phase 1 业务数据的本地存储，只使用真实后端用户 id 做隔离。

## 范围

包含：

- 新增前端 `apiClient`，统一处理 API base URL、`credentials: 'include'`、响应 envelope、错误信息和 `requestId`。
- 引入 TanStack Query 管理 Auth/User server state。
- 新增 Auth API 方法与 hooks：`login`、`register`、`me`、`refresh`、`logout`。
- 登录/注册页面调用真实后端 API。
- `AuthGuard` 改为以后端 session 为权威来源。
- 侧边栏退出登录调用 `/auth/logout` 并清理前端 session cache。
- 保留 Dexie 本地数据，后续 Phase 2.3 再迁移业务数据。

不包含：

- WrongQuestion、ChatMessage、OCRRecord 的服务端 CRUD。
- 手机验证码真实登录。
- OAuth / 微信 / 支付宝登录。
- 复杂 token 静默刷新队列。

## 架构

前端新增三层：

1. `apiClient`
   - 封装 `fetch`。
   - 解析后端统一响应 envelope。
   - 请求默认携带 cookie。
   - 对失败响应抛出结构化 `ApiClientError`。

2. Auth session store
   - 保存短生命周期 access token 和当前用户。
   - 不再保存模拟注册用户列表和明文密码。
   - 为 Dexie 继续提供 `currentUser.id`、`username`、`email`。

3. TanStack Query hooks
   - `useMe` 读取当前用户。
   - `useLogin` / `useRegister` 写入 access token 与 user。
   - `useLogout` 调用后端 logout，清理 query cache 和 session store。

## 数据流

### 注册

```text
RegisterPage
  -> useRegister()
  -> POST /auth/register
  -> 后端创建用户 + refresh cookie
  -> 前端保存 accessToken + user
  -> query cache 写入 ['auth', 'me']
  -> 跳转 /chat
```

### 登录

```text
LoginPage
  -> useLogin()
  -> POST /auth/login
  -> 后端设置 refresh cookie
  -> 前端保存 accessToken + user
  -> query cache 写入 ['auth', 'me']
  -> 跳转 /chat
```

### 刷新页面恢复 session

```text
AuthProvider 初始化
  -> accessToken 不存在
  -> POST /auth/refresh
  -> 成功则保存 accessToken + user
  -> GET /auth/me 校验并刷新 user cache
  -> 失败则保持未登录
```

### 退出登录

```text
Sidebar logout
  -> useLogout()
  -> POST /auth/logout
  -> 清理 accessToken + user
  -> 清理 auth query cache
  -> 跳转 /login
```

## 错误处理

- `apiClient` 对 `success: false` 响应抛出 `ApiClientError`。
- 页面表单展示 `error.message`，没有 message 时显示通用错误文案。
- 401 时不在底层自动跳转，避免请求层和路由层耦合；由 AuthGuard 和 mutation 调用方决定跳转。
- refresh 失败视为未登录，不弹全局错误。

## UI 规则

- 继续保持当前移动端优先登录/注册布局。
- Phase 2.2 只做必要交互更新，不重做视觉设计。
- 手机号验证码登录暂时禁用或提示“暂未开放”，避免继续使用本地模拟登录。
- 登录/注册提交中禁用按钮并显示处理中状态，避免重复提交。

## 验收标准

- 注册后 PostgreSQL 创建真实用户，前端进入 `/chat`。
- 登录后后端设置 refresh cookie，前端进入 `/chat`。
- 刷新页面后可通过 refresh cookie 恢复登录态。
- 退出登录会调用 `/auth/logout`，清理前端 session 并跳回 `/login`。
- Phase 1 Dexie 业务数据仍能按用户 id 隔离读取。
- 前端 lint/build 通过。
- 后端 lint/build/unit/e2e 通过。

