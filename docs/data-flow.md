# PrepMind AI — 数据流向全景图

> 记录项目所有数据的完整生命周期：从用户输入到存储、从 Phase 1 本地状态到 Phase 2 后端迁移路径。

---

## 一、存储层总览（Phase 1 现状）

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器 (Client)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    localStorage                           │   │
│  │                                                          │   │
│  │  prepmind-user     → { currentUser, users[] }            │   │
│  │  prepmind-chat     → { inputDraft }                      │   │
│  │  prepmind-messages → { messages[] }                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    内存态 (React)                          │   │
│  │                                                          │   │
│  │  useChat (Vercel AI SDK) → messages[], input, isLoading  │   │
│  │  useUserStore (zustand)  → currentUser, users            │   │
│  │  useChatStore (zustand)  → inputDraft                    │   │
│  │  useMessageStore(zustand)→ messages[]                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    外部服务                                │   │
│  │                                                          │   │
│  │  DeepSeek API ← Next.js API Route (/api/chat)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、核心数据流详解

### 2.1 用户注册流

```
用户输入 (email + username + password + confirm)
        │
        ▼
┌─────────────────┐
│  register/page   │  表单状态: useState (email, username, password)
│  客户端校验      │  validateEmail() / validatePassword() / validateUsername()
│  协议勾选检查    │  agreed === true 才允许提交
└────────┬────────┘
         │ handleSubmit()
         ▼
┌─────────────────┐
│  userStore       │  register({ email, username, password })
│  zustand action  │  检查重复 → 生成 id (crypto.randomUUID())
└────────┬────────┘
         │ set({ users: [...users, newUser] })
         ▼
┌─────────────────┐
│  zustand/persist │  自动同步到 localStorage["prepmind-user"]
│  localStorage    │  存储: { currentUser: null, users: [newUser] }
└────────┬────────┘
         │ 返回 { ok: true }
         ▼
┌─────────────────┐
│  router.push     │  跳转到 /login
│  (/login)        │
└─────────────────┘
```

**数据形态变化：**
```
表单输入 → { email, username, password } (plain object)
    → RegisteredUser { id: uuid, email, username, password, createdAt }
    → localStorage JSON string
```

### 2.2 用户登录流

```
用户输入 (手机号+验证码 或 邮箱+密码)
        │
        ▼
┌─────────────────┐
│  login/page      │  Tab 切换: phone / email
│  表单校验        │  validatePhone() / validateSmsCode() / validateEmail() / validatePassword()
│  协议勾选检查    │  agreed === true
└────────┬────────┘
         │ handleSubmit()
         ▼
┌─────────────────┐     ┌──────────────────────────┐
│  userStore       │◄────│  localStorage             │
│  loginByPhone()  │     │  读取 users[] 查找匹配    │
│  loginByEmail()  │     │  验证码固定: "246810"     │
└────────┬────────┘     └──────────────────────────┘
         │ set({ currentUser: { id, username, email, phone } })
         ▼
┌─────────────────┐
│  zustand/persist │  localStorage["prepmind-user"].currentUser 更新
│  localStorage    │
└────────┬────────┘
         │ 返回 { ok: true }
         ▼
┌─────────────────┐
│  router.push     │  跳转到 /chat
│  (/chat)         │
└─────────────────┘
```

### 2.3 登录态保持与 AuthGuard

```
页面加载 / 刷新
        │
        ▼
┌──────────────────────────────────────────────────────┐
│  AuthGuard 组件                                       │
│                                                       │
│  1. useState(hydrated = false)                        │
│  2. useEffect → zustand.persist.onFinishHydration()  │
│     → hydrated = true                                 │
│  3. if (hydrated && !currentUser) → redirect /login   │
│  4. if (!hydrated || !currentUser) → 显示加载中       │
│  5. if (hydrated && currentUser) → 渲染 children      │
└──────────────────────────────────────────────────────┘

根页面 (/) 也做同样检查：
  hydrated && currentUser → redirect /chat
  hydrated && !currentUser → 显示"开始使用"按钮
```

**关键时序：**
```
T0: React hydrate, zustand store = { currentUser: null } (默认值)
T1: zustand persist 从 localStorage 读取, 恢复 currentUser
T2: onFinishHydration 回调 → hydrated = true
T3: currentUser 从 null 变为已登录用户 → 触发 re-render → 渲染页面
```

### 2.4 AI 聊天消息流（核心）

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Phase 1 消息全链路                            │
│                                                                      │
│  ① 用户输入                                                          │
│  ┌──────────────┐                                                    │
│  │ ChatInputBar  │ textarea → onInput (auto-resize)                  │
│  │               │ onChange → onInputChange(e)                        │
│  └──────┬───────┘                                                    │
│         │                                                            │
│         ▼                                                            │
│  ② 双通道同步                                                        │
│  ┌──────────────────────────────────────────┐                        │
│  │ onInputChange(e):                        │                        │
│  │   ├→ handleInputChange(e)  [useChat]     │  更新 useChat.input    │
│  │   └→ setInputDraft(text)  [chatStore]    │  同步到 zustand        │
│  │      → persist → localStorage            │  切页面不丢            │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ③ 用户提交 (Enter 或 点击发送)                                       │
│  ┌──────────────────────────────────────────┐                        │
│  │ form onSubmit → handleSubmit [useChat]   │                        │
│  │   useChat 内部:                          │                        │
│  │   1. 将 user message 加入 messages[]     │                        │
│  │   2. POST /api/chat { messages }         │───┐                    │
│  │   3. 清空 input                          │   │                    │
│  └──────────────────────────────────────────┘   │                    │
│                                                  │                    │
│         ▼                                        │                    │
│  ④ 消息数量变化触发 clearInputDraft              │                    │
│  ┌──────────────────────────────────────────┐   │                    │
│  │ useEffect([messages.length]):            │   │                    │
│  │   initialLoadDoneRef 跳过首次            │   │                    │
│  │   后续变化 → clearInputDraft()           │   │                    │
│  │   → localStorage["prepmind-chat"] 清空   │   │                    │
│  └──────────────────────────────────────────┘   │                    │
│                                                  │                    │
│                                                  ▼                    │
│  ⑤ API Route 处理                               │                    │
│  ┌──────────────────────────────────────────┐   │                    │
│  │ /api/chat/route.ts (Next.js)             │◄──┘                    │
│  │   1. 解析 { messages }                   │                        │
│  │   2. 校验 messages 非空                   │                        │
│  │   3. streamText({                        │                        │
│  │        model: aiProvider(DEFAULT_MODEL), │                        │
│  │        system: "你是 PrepMind AI...",     │                        │
│  │        messages                          │                        │
│  │      })                                  │                        │
│  │   4. return result.toDataStreamResponse() │                        │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ⑥ LLM 调用                                                          │
│  ┌──────────────────────────────────────────┐                        │
│  │ aiProvider (createOpenAI):               │                        │
│  │   apiKey: DEEPSEEK_API_KEY               │                        │
│  │   baseURL: https://api.deepseek.com      │                        │
│  │   model: deepseek-chat                   │                        │
│  │                                          │                        │
│  │   HTTP POST → DeepSeek API               │                        │
│  │   返回: SSE 流                           │                        │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ⑦ SSE 流式返回                                                      │
│  ┌──────────────────────────────────────────┐                        │
│  │ Vercel AI SDK toDataStreamResponse():    │                        │
│  │   Content-Type: text/event-stream        │                        │
│  │   数据: token-by-token                   │                        │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ⑧ 前端接收 + 渲染                                                   │
│  ┌──────────────────────────────────────────┐                        │
│  │ useChat hook:                            │                        │
│  │   每收到 token → 更新 messages[]         │                        │
│  │   最后一条 assistant message content 追加 │                        │
│  │   isLoading: true → false (完成时)       │                        │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ⑨ 双重持久化                                                        │
│  ┌──────────────────────────────────────────┐                        │
│  │ useEffect([messages]):                   │                        │
│  │   setPersistedMessages(messages)         │                        │
│  │   → zustand/persist                      │                        │
│  │   → localStorage["prepmind-messages"]    │                        │
│  │   (每 token 更新都写一次, 后续可优化)     │                        │
│  └──────────────────────────────────────────┘                        │
│         │                                                            │
│         ▼                                                            │
│  ⑩ UI 渲染                                                          │
│  ┌──────────────────────────────────────────┐                        │
│  │ ChatBubble (React.memo):                 │                        │
│  │   user → <span>{content}</span>          │                        │
│  │   assistant → <Markdown>{content}</Markdown>                     │
│  │   loading → 光标动画 (animate-pulse)     │                        │
│  │                                          │                        │
│  │ 智能滚动:                                │                        │
│  │   isAutoScrollRef (用户上翻时停止跟随)    │                        │
│  │   rAF 节流 (避免每 token 强制布局)        │                        │
│  └──────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
```

**useChat 上下文传递：**
```
useChat 维护完整的 messages[] 数组
  → 每次 POST /api/chat 时携带全部历史消息
  → DeepSeek 收到完整上下文
  → 实现多轮对话记忆
  → 限制: 无 token 截断策略 (Phase 2 解决)
```

### 2.5 聊天上下文恢复（刷新页面）

```
页面刷新
    │
    ▼
┌─────────────────────────────────────────────┐
│  ChatPage 初始化                              │
│                                              │
│  1. useMessageStore 从 localStorage 读取     │
│     → persistedMessages: StoredMessage[]     │
│                                              │
│  2. useChat({ initialMessages: persisted })  │
│     → 恢复完整消息列表                        │
│                                              │
│  3. useChatStore 从 localStorage 读取        │
│     → inputDraft: string                     │
│     → useChat({ initialInput: inputDraft })  │
│     → 恢复输入框内容                          │
│                                              │
│  4. ChatBubble 渲染所有历史消息              │
│  5. initialLoadDoneRef = true (跳过首次清空) │
└─────────────────────────────────────────────┘
```

### 2.6 退出登录流

```
用户点击"退出登录"
        │
        ▼
┌─────────────────┐
│  ChatSidebar     │
│  logout 按钮     │
└────────┬────────┘
         │ onClick:
         ▼
┌─────────────────────────────────────────┐
│  1. userStore.logout()                  │
│     → set({ currentUser: null })        │
│     → persist → localStorage 更新       │
│                                          │
│  2. messageStore.clearMessages()        │
│     → set({ messages: [] })             │
│     → persist → localStorage 清空       │
│                                          │
│  3. sidebar onClose()                   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────┐
│  AuthGuard       │  currentUser === null
│  → redirect      │  → /login
│  /login          │
└─────────────────┘

注意: chatStore.inputDraft 不主动清空 (下次登录可能还需要)
      userStore.users[] 不清空 (保留注册用户数据)
```

---

## 三、Store 间关系图

```
┌──────────────────────────────────────────────────────────────┐
│                     Zustand Store 依赖关系                     │
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  userStore   │    │  chatStore    │    │  messageStore   │  │
│  │             │    │              │    │                │  │
│  │ currentUser  │    │ inputDraft   │    │ messages[]     │  │
│  │ users[]     │    │              │    │                │  │
│  │             │    │              │    │                │  │
│  │ persist: ✓  │    │ persist: ✓   │    │ persist: ✓     │  │
│  │ key: user   │    │ key: chat    │    │ key: messages  │  │
│  └──────┬──────┘    └──────┬───────┘    └───────┬────────┘  │
│         │                  │                     │           │
│         │     ┌────────────┼─────────────────────┘           │
│         │     │            │                                 │
│         ▼     ▼            ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    ChatPage                              │ │
│  │                                                          │ │
│  │  useUserStore  → currentUser (显示用户名/AuthGuard)       │ │
│  │  useChatStore  → inputDraft / setInputDraft / clearInput │ │
│  │  useMessageStore → persistedMessages / setPersisted      │ │
│  │  useChat       → messages / input / handleSubmit         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  读取方向: 组件 → store → localStorage                       │
│  写入方向: 用户操作 → store action → persist → localStorage  │
└──────────────────────────────────────────────────────────────┘
```

---

## 四、Phase 2 迁移规划：数据流重构

### 4.1 迁移总览

```
Phase 1 (当前)                      Phase 2 (目标)
─────────────────                   ─────────────────
zustand + localStorage              NestJS + Prisma + PostgreSQL + Redis
前端直连 DeepSeek API               后端代理 LLM 调用
无 JWT 认证                         JWT access/refresh token
消息存 localStorage                 消息存 ChatMessage 表
用户存 localStorage                 用户存 User 表
无 conversationId                   按 conversationId 管理会话
输入框草稿本地存                     草稿可选: localStorage 保留
```

### 4.2 认证系统迁移

```
Phase 1 (现在):                      Phase 2 (迁移后):
────────────────                     ──────────────────
register/page.tsx                    register/page.tsx (UI 不变)
  │                                    │
  ▼                                    ▼
userStore.register()                 POST /api/auth/register
  │                                    │
  ▼                                    ▼
localStorage.users[]                 NestJS AuthModule
                                       │
                                       ▼
                                     Prisma → User 表
                                       │
                                       ▼
                                     bcrypt 加密密码
                                       │
                                       ▼
                                     返回 JWT token
                                       │
                                       ▼
                                     localStorage 只存 token
                                     (currentUser 从 token 解析)

前端改造:
  - userStore 保留, 但 currentUser 改为从 JWT 解析
  - register/login action 改为调用后端 API
  - users[] 不再前端存储
  - 新增 refreshToken 逻辑
  - AuthGuard 改为校验 JWT 有效性 (而非仅检查 zustand state)

后端新增:
  - AuthModule: register / login / refresh / logout
  - JWT Strategy: access_token (15min) + refresh_token (7d)
  - Guard: JwtAuthGuard 保护所有非公开路由
  - PasswordService: bcrypt hash/verify
```

**迁移后的认证流：**
```
用户输入 → 前端校验 → POST /api/auth/login
  → NestJS AuthService.login()
  → Prisma 查询 User
  → bcrypt 验证密码
  → 签发 JWT (access + refresh)
  → 返回 { accessToken, refreshToken, user }

前端收到:
  → userStore.setTokens(accessToken, refreshToken)
  → persist → localStorage["prepmind-user"] 只存 tokens
  → currentUser 从 accessToken 解码 (或存一份 user info)
```

### 4.3 聊天消息流迁移

```
Phase 1 (现在):                      Phase 2 (迁移后):
────────────────                     ──────────────────
useChat → POST /api/chat             useChat → POST /api/chat
  → Next.js Route Handler              → Next.js 代理到 NestJS
  → streamText(DeepSeek)               → 或直接调 NestJS SSE 端点
  → SSE 返回                           → NestJS ChatModule
                                         │
                                         ├→ Prisma 写入 ChatMessage
                                         ├→ 从 Redis 读取上下文缓存
                                         ├→ Agent System 处理 (Phase 6)
                                         └→ streamText → SSE 返回

前端改造:
  - useChat 的 api 改为指向后端 (或保持 Next.js 代理)
  - messageStore 可选保留作缓存层 (加速首屏)
  - 新增 conversationId 管理
  - 新增历史会话列表页面
  - 乐观更新: 发消息先写本地, 再同步服务端

后端新增:
  - ChatModule:
    - POST /api/chat/stream (SSE)
    - GET /api/chat/conversations (会话列表)
    - GET /api/chat/conversations/:id/messages (历史消息)
    - DELETE /api/chat/conversations/:id
  - ChatService:
    - saveMessage() → Prisma → ChatMessage 表
    - getHistory(conversationId) → 分页查询
    - getContext(conversationId, limit=20) → 截断策略
  - ChatController:
    - SSE 流式输出 (NestJS @Sse 装饰器)
```

**迁移后的聊天流：**
```
用户输入 → useChat → POST /api/chat/stream
  → Next.js API Route (代理)
  → NestJS ChatController
    → ChatService.saveMessage(userMsg)
    → ChatService.getContext(conversationId)
    → aiProvider.streamText(messages)
    → SSE token-by-token 返回
    → ChatService.saveMessage(assistantMsg) (流结束后)

前端:
  → useChat 接收 token 流
  → messages[] 实时更新
  → messageStore 作本地缓存 (可选)
  → 刷新页面从后端拉取历史 (而非 localStorage)
```

### 4.4 上下文管理升级

```
Phase 1 (现在):
  全量上下文: 每次 POST 携带所有历史消息
  问题: 超长对话会超出 token 限制

Phase 2 (迁移后):
  ┌─────────────────────────────────────────────────┐
  │  智能上下文管理                                   │
  │                                                  │
  │  1. 最近 N 条消息 (滑动窗口)                     │
  │  2. 早期消息摘要 (summarize)                     │
  │  3. RAG 检索相关历史 (Phase 5)                   │
  │  4. 用户画像注入 (MemoryAgent, Phase 6)          │
  │                                                  │
  │  实现:                                           │
  │  - Redis 缓存最近 20 条消息                      │
  │  - 超出窗口的消息 → LLM 摘要 → 存入 context 字段 │
  │  - PostgreSQL 存全量历史                          │
  └─────────────────────────────────────────────────┘
```

### 4.5 拍照识题流（Phase 3 预览）

```
Phase 1 (待做):                      Phase 3 (完整):
────────────────                     ─────────────────
[📷] 按钮 → 占位                     [📷] 按钮
                                       │
                                       ├→ 相机拍照 / 相册选择
                                       ├→ 图片压缩 + 预览
                                       ▼
                                     POST /api/question/ocr (multipart)
                                       │
                                       ▼
                                     NestJS QuestionModule
                                       │
                                       ├→ BullMQ ocr-queue (异步)
                                       │   └→ OCR Worker
                                       │       ├→ 调用 OCR API
                                       │       ├→ 提取题目文本
                                       │       ├→ AI 识别知识点
                                       │       └→ 返回结构化结果
                                       │
                                       ├→ Prisma 写入 Question 表
                                       └→ 返回 { questionId, text, knowledgePoints }

前端:
  → 显示识别结果
  → 用户确认 → 发送到聊天 / 保存到错题本
  → messageStore 缓存图片消息
```

### 4.6 错题本迁移（Phase 2+3）

```
Phase 1 (待做):                      Phase 2+3:
────────────────                     ─────────────
静态 CRUD 页面                       后端 API 驱动
zustand 存 localStorage              Prisma → WrongQuestion 表
  │                                    │
  ▼                                    ▼
add/remove/edit                      POST /api/question/wrong
→ localStorage 更新                  GET /api/question/wrong?page=1&limit=20
                                     PUT /api/question/wrong/:id
                                     DELETE /api/question/wrong/:id
                                       │
                                       ▼
                                     支持: AI 自动分析错因
                                     支持: 一键加入复习队列 (FSRS, Phase 4)
```

### 4.7 数据迁移策略

```
从 Phase 1 localStorage 迁移到 Phase 2 数据库:

┌────────────────────────────────────────────────────────────┐
│  迁移脚本 (一次性)                                          │
│                                                             │
│  1. 读取 localStorage["prepmind-user"].users[]             │
│     → 批量写入 PostgreSQL User 表                           │
│     → 密码需要重新 bcrypt hash (Phase 1 是明文)             │
│                                                             │
│  2. 读取 localStorage["prepmind-messages"].messages[]      │
│     → 写入 ChatMessage 表                                   │
│     → 关联到对应 userId                                     │
│     → 生成 conversationId                                   │
│                                                             │
│  3. 清理 localStorage                                      │
│     → 只保留 JWT tokens                                     │
│     → 删除 prepmind-user (users[])                         │
│     → 删除 prepmind-messages                               │
│     → 保留 prepmind-chat (inputDraft, 可选)                │
└────────────────────────────────────────────────────────────┘
```

---

## 五、Phase 完整数据流演进图

```
Phase 1 (MVP)          Phase 2 (后端)         Phase 3 (AI讲题)       Phase 5 (RAG)
──────────────         ──────────────         ──────────────         ──────────────
                                                                      
用户 ──→ 前端           用户 ──→ 前端           用户 ──→ 前端           用户 ──→ 前端
  │                      │                      │                      │
  ▼                      ▼                      ▼                      ▼
zustand ──→ localStorage  │                   POST /question/ocr    POST /rag/search
  │                      ▼                      │                      │
  ▼                   JWT Guard                 ▼                      ▼
API Route ──→ DeepSeek    │                  BullMQ OCR Queue     Embedding + pgvector
  │                      ▼                      │                      │
  ▼                   NestJS ChatModule         ▼                      ▼
SSE ──→ useChat           │                  OCR Worker            Hybrid Search
  │                      ▼                      │                      │
  ▼                   Prisma + PostgreSQL       ▼                      ▼
渲染                    + Redis 缓存          Question 表           Rerank + LLM
                         │                      │                      │
                         ▼                      ▼                      ▼
                      ChatMessage 表         WrongQuestion 表      RAG 增强回答


Phase 4 (FSRS)          Phase 6 (Agent)        Phase 9 (MCP)
──────────────          ──────────────         ──────────────
                                                                 
POST /review/feedback    用户消息               Agent 调用工具
  │                      │                      │
  ▼                      ▼                      ▼
FSRS 算法计算           LangGraph Router      MCP Tool Registry
  │                      │                      │
  ▼                   ┌──┴──┬──────┐          ┌──┴──┬──────┐
Card 表更新           Tutor Review Planner   Search OCR  FSRS
  │                   Agent Agent  Agent     Tool  Tool  Tool
  ▼                      │
下次复习时间            Memory Agent
                         │
                         ▼
                      长期记忆更新
```

---

## 六、前端 vs 后端职责划分

| 模块 | Phase 1 前端职责 | Phase 2 后端职责 | 迁移方式 |
|------|-----------------|-----------------|---------|
| **认证** | zustand + localStorage 模拟 | JWT + bcrypt + Prisma | userStore 改为调 API，存 token |
| **聊天** | useChat → Next.js API Route → DeepSeek | NestJS ChatModule → AI SDK → DeepSeek | API Route 改为代理到 NestJS |
| **消息存储** | messageStore → localStorage | ChatMessage 表 (Prisma) | localStorage 作缓存，主存改后端 |
| **上下文** | useChat 全量传 messages | Redis 缓存 + 滑动窗口 + 摘要 | 后端管理上下文截断策略 |
| **错题本** | zustand + localStorage CRUD | WrongQuestion 表 + API | 前端 store 改为调 API |
| **OCR** | 占位按钮 | BullMQ + OCR Worker | 前端上传图片，后端异步处理 |
| **复习** | 静态页面 | FSRS 算法 + Card 表 | 后端计算，前端展示 |
| **RAG** | 无 | pgvector + Embedding + Rerank | 纯后端，前端只调搜索 API |
| **Agent** | 无 | LangGraph StateGraph | 纯后端，前端只展示结果 |
| **输入框草稿** | chatStore → localStorage | 保留 localStorage (纯 UI 状态) | 不迁移，前端自管 |

### 职责划分原则

```
前端管什么:
  ✅ UI 状态 (输入框草稿、侧边栏开关、滚动位置)
  ✅ 乐观更新 (发消息先显示，再同步后端)
  ✅ 表单校验 (正则、格式)
  ✅ 渲染逻辑 (Markdown、气泡、动画)
  ✅ 本地缓存 (加速首屏，可选)

后端管什么:
  ✅ 业务数据持久化 (用户、消息、题目、卡片)
  ✅ 认证与授权 (JWT、RBAC)
  ✅ AI 调用 (LLM、OCR、Embedding)
  ✅ 异步任务 (BullMQ 队列)
  ✅ 上下文管理 (截断、摘要、缓存)
  ✅ 数据安全 (密码加密、输入净化)
```

---

## 七、当前 Phase 1 已知限制与解决路径

| 限制 | 影响 | Phase 2 解决方案 |
|------|------|-----------------|
| 上下文无截断 | 超长对话超出 token 限制 | Redis 滑动窗口 + LLM 摘要 |
| 消息每 token 写 localStorage | 性能浪费 | 后端存，前端只缓存最终结果 |
| 密码明文存储 | 安全隐患 | bcrypt hash |
| 无 conversationId | 无法管理多会话 | Prisma ChatMessage 表 + conversationId |
| useChat 刷新丢失流式状态 | 正在生成时刷新会中断 | 后端存储生成状态，前端重连恢复 |
| 无 token 刷新机制 | 登录态过期需重新登录 | JWT refresh_token 自动续期 |
