# PrepMind AI — 数据流向全景图

> 记录项目所有数据的完整生命周期：从用户输入到存储、从 Phase 1 本地状态到 Phase 2 后端迁移路径。

---

## 一、存储层总览（Phase 1 现状）

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器 (Client)                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  localStorage（zustand + persist）                        │   │
│  │                                                          │   │
│  │  prepmind-user  → { currentUser, users[] }  配置/token   │   │
│  │  prepmind-chat  → { inputDraft }            UI 状态      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  IndexedDB — Dexie (prepmind-db)                         │   │
│  │                                                          │   │
│  │  messages    → { id, role, content, order }  聊天记录    │   │
│  │  ocrRecords  → { id, type, content, imageUrl, createdAt }│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  TanStack Query（内存缓存层）                              │   │
│  │                                                          │   │
│  │  ["messages"]     → Dexie messages 的内存副本             │   │
│  │  ["ocr-records"]  → Dexie ocrRecords 的内存副本           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  内存态 (React)                                           │   │
│  │                                                          │   │
│  │  useChat (Vercel AI SDK) → messages[], input, isLoading  │   │
│  │  useUserStore (zustand)  → currentUser                   │   │
│  │  useChatStore (zustand)  → inputDraft                    │   │
│  │  ocrMessages (useState)  → OCR 识别结果                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  外部服务                                                 │   │
│  │                                                          │   │
│  │  DeepSeek API ← /api/chat (Vercel AI SDK streamText)    │   │
│  │  MIMO v2.5    ← /api/ocr  (SSE 流式转发)                │   │
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
  register/page — 客户端校验 (validateEmail/Password/Username)
        │
        ▼
  useUserStore.register(user)
        │
        ├──→ zustand state: currentUser + users[] 更新
        │
        └──→ persist → localStorage "prepmind-user" 写入
```

### 2.2 用户登录流

```
用户输入 (phone/email + code/password)
        │
        ▼
  login/page — 校验通过
        │
        ▼
  useUserStore.loginByPhone() / loginByEmail()
        │
        ├──→ zustand state: currentUser 更新
        │
        └──→ persist → localStorage "prepmind-user" 写入
```

### 2.3 登录态持久化 + AuthGuard

```
页面刷新 / 新标签页
        │
        ▼
  zustand persist 自动从 localStorage 恢复
        │
        ▼
  useUserStore.persist.onFinishHydration() 等待水合完成
        │
        ▼
  AuthGuard 检查 currentUser
        │
        ├── 有值 → 放行
        └── null → redirect /login
```

### 2.4 AI 聊天消息流（核心 10 步）

```
用户输入文字 → onInputChange → useChat input + chatStore.inputDraft
        │
        ▼  点击发送
  handleSubmit → POST /api/chat { messages }
        │
        ▼
  streamText (DeepSeek) → SSE 流式响应
        │
        ▼  逐 token
  useChat 内部: messages[] 更新 → React 重渲染
        │
        ├──→ ChatBubble Markdown 渲染（rAF 节流滚动）
        │
        ├──→ messagesRef (useLayoutEffect 同步)
        │
        └──→ saveMessages effect (messages.length/isLoading 变化)
                    │
                    ▼
              saveMessagesRef.mutate(msgs)
                    │
                    ▼
              Dexie transaction: messages.clear() + bulkAdd()
                    │
                    ▼
              TanStack Query cache 更新
```

### 2.5 拍照识题 OCR 流

```
用户选图 → camera/gallery <input type="file">
        │
        ▼
  FileReader.readAsDataURL → base64 预览
        │
        ▼  点击发送（有图片时拦截，不走 useChat）
  handleOcrSubmit
        │
        ├──→ setOcrMessages: 添加 user 消息 + result 占位
        │
        ▼
  POST /api/ocr (FormData: image + text)
        │
        ▼
  MIMO v2.5 (stream: true) → SSE 转发
        │
        ▼  逐 token
  ReadableStream 消费 → setOcrMessages 更新 result 内容
        │
        ▼  流式完成
  saveOcrRef.mutate(ocrMessages) → Dexie ocrRecords
        │
        ▼
  OcrBubble 渲染: Markdown + 「保存到错题本」按钮
```

### 2.6 聊天上下文恢复（刷新页面）

```
页面刷新
        │
        ▼
  ChatPage (父组件)
        │
        ├── usePersistedMessages() → Dexie messages.orderBy("order")
        │
        ├── useOcrRecords()        → Dexie ocrRecords.orderBy("createdAt")
        │
        ▼  两个查询都 isSuccess 后
  ChatView (子组件) 挂载
        │
        ├── initialMessages → useChat 初始化（首次渲染就有正确数据）
        │
        └── initialOcrRecords → ocrMessages state 初始化
```

### 2.7 退出登录流

```
点击「退出登录」
        │
        ├── useUserStore.logout()      → localStorage 清空 currentUser
        │
        ├── useClearMessages.mutate()  → Dexie messages 清空 + TanStack cache 清空
        │
        └── onClose()                  → 侧边栏关闭
```

### 2.8 页面关闭保护流

```
beforeunload / visibilitychange(hidden)
        │
        ▼
  flush()
        │
        ├── messagesRef.current → Dexie transaction 保存聊天消息
        │
        └── ocrMsgRef.current   → Dexie transaction 保存 OCR 记录
```

---

## 三、Store / Hook 关系图

```
┌─────────────────────────────────────────────────────────┐
│                     ChatPage (父)                        │
│  usePersistedMessages() ──→ Dexie messages              │
│  useOcrRecords()        ──→ Dexie ocrRecords            │
│         │                         │                      │
│         ▼                         ▼                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │              ChatView (子)                       │    │
│  │                                                  │    │
│  │  useChat()         ← initialMessages (Dexie)    │    │
│  │  useUserStore()    ← localStorage (config)      │    │
│  │  useChatStore()    ← localStorage (inputDraft)  │    │
│  │  useSaveMessages() → Dexie messages (持久化)     │    │
│  │  useSaveOcrRecords()→ Dexie ocrRecords (持久化)  │    │
│  │  ocrMessages state → OCR 识别结果                │    │
│  │                                                  │    │
│  │  saveMessagesRef ──→ Dexie (effect 触发)         │    │
│  │  saveOcrRef      ──→ Dexie (直接调用)            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ChatSidebar                                    │    │
│  │  useUserStore.logout()                          │    │
│  │  useClearMessages.mutate() → Dexie 清空         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 四、Phase 2 迁移规划

### 存储分层策略

| 层级 | Phase 1（当前） | Phase 2（目标） | 存什么 |
|------|-----------------|-----------------|--------|
| localStorage | zustand + persist | 保留 | 配置、token、UI 偏好 |
| TanStack Query | 内存缓存 (Dexie) | 管理 server state (API) | 消息分页、错题、用户数据 |
| IndexedDB | Dexie (`prepmind-db`) | 保留为离线缓存 | 本地副本，弱网可用 |
| PostgreSQL | — | Prisma + pgvector | 唯一真值来源 |
| Redis | — | ioredis | 接口缓存、登录态、限流 |
| 对象存储 | — | OSS / MinIO | 图片、大文件；PG 只存 URL |

### 迁移路线

```
Phase 1                         Phase 2
────────────────────────────────────────────────────────────
localStorage (config+token)  →  保留
zustand (UI 状态)            →  保留
Dexie messages               →  useInfiniteQuery (TanStack Query → API)
Dexie ocrRecords             →  useQuery (TanStack Query → API)
useChat (流式聊天)           →  不变，继续管流式
—                            →  PostgreSQL (唯一真值)
—                            →  Redis (缓存层)
—                            →  OSS (文件存储)
```

### 设计原则

- **zustand 仅存 UI 状态**，不作为最终数据源
- **TanStack Query 管理 server state**，Phase 2 替换 queryFn 从 Dexie 改为 API 调用
- **useChat 继续管流式聊天**，与 TanStack Query 职责不冲突
- **Dexie 是离线副本**，Phase 2 降级为本地缓存
- **PostgreSQL 是唯一真值来源**

---

## 五、前端 vs 后端职责划分

| 功能 | Phase 1 前端 | Phase 2 前端 | Phase 2 后端 |
|------|-------------|-------------|-------------|
| 认证 | zustand + localStorage | useQuery + JWT | NestJS AuthModule + Prisma |
| 聊天 | useChat + Dexie | useChat + API | ChatModule + PostgreSQL |
| 消息存储 | Dexie messages | TanStack Query 缓存 | PostgreSQL ChatMessage |
| 上下文 | useChat 全量传递 | 滑动窗口截断 | Redis 滑动窗口 + 总结 |
| OCR | /api/ocr → MIMO | 不变 | BullMQ 异步队列 |
| 错题 | ⬜ 未实现 | TanStack Query | WrongQuestion CRUD |
| 文件 | base64 内联 | 上传到 OSS | MinIO/OSS 存储 |

---

## 六、已知限制与解决路径

| 限制 | 影响 | Phase 2 方案 |
|------|------|-------------|
| OCR 和聊天消息渲染顺序错乱 | 先图片后文字，文字显示在图片上方 | 统一消息渲染管线 |
| 上下文全量传递 | token 超限时失败 | Redis 滑动窗口 + 总结 |
| beforeunload 异步保存 | 极端情况可能丢数据 | Service Worker + 后端同步 |
| setTimeout(100) OCR 保存 | 慢设备可能读到旧数据 | 改用 ref 直接跟踪 |
| 图片 base64 内联 | 消息体积大 | Phase 2 上传 OSS，PG 存 URL |
| 无对话历史管理 | 只有一条对话 | Phase 2 conversationId + 列表 |
