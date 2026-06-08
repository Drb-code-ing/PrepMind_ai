# PrepMind AI — 数据流向全景图

> Phase 1 最新版（2026-06-08 Day 4）：移除 TanStack Query，统一消息渲染管线，直接 Dexie 持久化。

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
│  │  IndexedDB — Dexie (prepmind-db)                          │   │
│  │                                                          │   │
│  │  messages    → { id, role, content, order, createdAt }   │   │
│  │  ocrRecords  → { id, type, content, imageUrl, createdAt }│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  内存态 (React)                                           │   │
│  │                                                          │   │
│  │  useChat (Vercel AI SDK) → messages[], input, isLoading  │   │
│  │  chatTimestamps (useState) → 每条消息的创建时间戳         │   │
│  │  useUserStore (zustand)   → currentUser                  │   │
│  │  useChatStore (zustand)   → inputDraft                   │   │
│  │  ocrMessages (useState)   → OCR 识别记录                  │   │
│  │  unifiedMessages (useMemo) → chat + OCR 合并时间线       │   │
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

**与 Day 3 的关键差异**：
- 移除 TanStack Query 内存缓存层（Phase 1 无服务端，`staleTime: Infinity` 使其无实际价值）
- 新增 `chatTimestamps` state 追踪聊天消息创建时间
- 新增 `unifiedMessages` 合并 chat + OCR 统一渲染

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

### 2.4 AI 聊天消息流（核心）

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
        ├──→ chatTimestamps effect: 新消息 ID 记录 Date.now()
        │
        ├──→ unifiedMessages useMemo: chat + OCR 合并排序
        │         │
        │         └──→ ChatBubble Markdown 渲染（rAF 节流滚动）
        │
        ├──→ messagesRef (useLayoutEffect 同步)
        │
        └──→ saveChatToDb effect (messages.length/isLoading 变化)
                    │
                    ▼
              Dexie transaction: messages.clear() + bulkAdd()
              （每条消息含 createdAt 时间戳）
```

**保存时机**（每次聊天至少 2 次全量写入）：
1. 用户消息 + assistant 占位进入数组 → `messages.length` 变化 → 第 1 次 clear + bulkAdd
2. AI 流式完成 → `isLoading` true→false → 第 2 次 clear + bulkAdd

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
        ├──→ ocrMsgRef.current 追加 user + ocr-result 占位
        ├──→ setOcrMessages: 立即渲染用户消息卡片
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
  fullContent（权威数据）patch ocrMsgRef.current → saveOcrToDb
  （直接保存，无 setTimeout）
        │
        ▼
  OcrBubble 渲染: Markdown + 「保存到错题本」按钮
```

### 2.6 上下文恢复（刷新页面）

```
页面刷新
        │
        ▼
  ChatPage (父组件)
        │
        ├── useEffect: db.messages.orderBy("order").toArray()
        ├── useEffect: db.ocrRecords.orderBy("createdAt").toArray()
        │
        ▼  两个查询都完成
  ChatView (子组件) 挂载
        │
        ├── initialMessages → useChat 初始化（首次渲染就有正确数据）
        ├── initialOcrRecords → ocrMessages + chatTimestamps 初始化
        │
        ▼
  unifiedMessages useMemo: 合并两个来源 → 按 createdAt 排序 → 渲染
```

### 2.7 退出登录流

```
点击「退出登录」
        │
        ├── useUserStore.logout() → localStorage 清空 currentUser
        │
        ├── db.transaction("rw", db.messages, db.ocrRecords, async () => {
        │       await db.messages.clear();
        │       await db.ocrRecords.clear();
        │   })
        │
        └── onClose() → 侧边栏关闭
```

### 2.8 页面关闭保护流

```
beforeunload / visibilitychange(hidden)
        │
        ▼
  flush()
        │
        ├── messagesRef.current → map 为 StoredMessage（含 createdAt）
        │       → db.transaction: messages.clear() + bulkAdd()
        │
        └── ocrMsgRef.current
                → db.transaction: ocrRecords.clear() + bulkAdd()
```

---

## 三、统一消息时间线（Day 4 核心修复）

### 问题

Day 3 之前 OCR 消息和聊天消息是两套独立渲染管线：
```jsx
{messages.map(msg => <ChatBubble />)}      // ← 所有聊天消息
{ocrMessages.map(msg => <OcrBubble />)}    // ← 所有 OCR（始终在聊天后面）
```
先发文字 → 再拍照 → 再发文字，顺序变为 [聊天1, 聊天2, 聊天3, OCR1] 而非正确的 [聊天1, OCR1, 聊天2, 聊天3]。

### 方案

```ts
type UnifiedMsg =
  | { kind: "chat"; ... time: number }       // 聊天消息，time 来自 chatTimestamps
  | { kind: "ocr-user"; ... time: number }   // OCR 用户消息，time 来自 OcrRecord.createdAt
  | { kind: "ocr-result"; ... time: number } // OCR 识别结果

// 渲染时合并排序
const unifiedMessages = useMemo(() => {
  const chatEntries = messages.map(m => ({ kind: "chat", time: chatTimestamps[m.id] }));
  const ocrEntries  = ocrMessages.map(m => ({ kind: "ocr-...", time: m.createdAt }));
  return [...chatEntries, ...ocrEntries].sort((a, b) => a.time - b.time);
}, [messages, ocrMessages, chatTimestamps]);

// JSX 单次遍历，按 kind 分派 Bubble
{unifiedMessages.map(msg => msg.kind === "chat" ? <ChatBubble /> : <OcrBubble />)}
```

- **在会话中**：`chatTimestamps` state 为每条聊天消息记录 `Date.now()` 作为时间基准
- **刷新恢复**：从 Dexie 的 `createdAt` 字段恢复（v3 schema 迁移保证每条消息都有 createdAt）
- **OCR 消息**：已有 `createdAt` 字段，直接参与排序

---

## 四、Store / Hook 关系图

```
┌─────────────────────────────────────────────────────────┐
│                     ChatPage (父)                        │
│  useEffect: db.messages.orderBy("order").toArray()      │
│  useEffect: db.ocrRecords.orderBy("createdAt").toArray()│
│         │                         │                      │
│         ▼                         ▼                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │              ChatView (子)                       │    │
│  │                                                  │    │
│  │  useChat()           ← initialMessages (Dexie)  │    │
│  │  useUserStore()      ← localStorage (config)    │    │
│  │  useChatStore()      ← localStorage (inputDraft)│    │
│  │  chatTimestamps      → 聊天消息创建时间追踪      │    │
│  │  ocrMessages state   → OCR 识别记录              │    │
│  │  unifiedMessages     → chat + OCR 合并时间线     │    │
│  │                                                  │    │
│  │  saveChatToDb() ──→ Dexie messages (effect 触发)│    │
│  │  saveOcrToDb()   ──→ Dexie ocrRecords (流式完成)│    │
│  │  flush()         ──→ Dexie (beforeunload 保护)  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ChatSidebar                                    │    │
│  │  useUserStore.logout()                          │    │
│  │  db.transaction: messages.clear() + ocr.clear() │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 五、Dexie Schema

| 版本 | messages 索引 | ocrRecords 索引 | 说明 |
|------|-------------|----------------|------|
| v1 | id, role | id, type, createdAt | 初始版本 |
| v2 | id, role, order | id, type, createdAt | 新增 order 解决刷新乱序 |
| v3 | id, role, order, createdAt | id, type, createdAt | 新增 createdAt 支持统一时间线 |

```ts
interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  order: number;       // 自增序号，刷新恢复时保证基础顺序
  createdAt: number;   // 创建时间戳，统一时间线排序基准
}

interface OcrRecord {
  id: string;
  type: "user" | "ocr-loading" | "ocr-result";
  content: string;
  imageUrl?: string;   // base64 data URL
  createdAt: number;   // 创建时间戳
}
```

---

## 六、Phase 2 迁移规划

### 存储分层策略

| 层级 | Phase 1（当前） | Phase 2（目标） |
|------|-----------------|-----------------|
| localStorage | zustand + persist | 保留（config/token/UI） |
| IndexedDB | Dexie 直接读写 | 保留为离线缓存 |
| TanStack Query | —（Day 4 移除） | 重新引入，管理 server state |
| PostgreSQL | — | Prisma + pgvector |
| Redis | — | 接口缓存、登录态、限流 |
| 对象存储 | — | OSS / MinIO |

### 迁移路线

```
Phase 1（当前）              Phase 2
───────────────────────────────────────────────────
localStorage (config+token)  →  保留
zustand (UI 状态)            →  保留
Dexie messages + ocrRecords  →  useInfiniteQuery + API
Dexie 直接读写                →  TanStack Query 缓存层
useChat (流式聊天)            →  不变
—                             →  PostgreSQL (唯一真值)
—                             →  Redis (缓存层)
—                             →  OSS (文件存储)
```

### 设计原则

- **zustand 仅存 UI 状态**，不作为最终数据源
- **Dexie 是离线副本**，Phase 2 降级为本地缓存层
- **Phase 2 恢复 TanStack Query** 时，`queryFn` 从 Dexie 改为 API，利用 `staleTime` 做乐观缓存
- **useChat 继续管流式聊天**，与 TanStack Query 职责不冲突

---

## 七、前端 vs 后端职责划分

| 功能 | Phase 1 前端 | Phase 2 后端 |
|------|-------------|-------------|
| 认证 | zustand + localStorage | NestJS AuthModule + Prisma |
| 聊天 | useChat + Dexie 直接读写 | ChatModule + PostgreSQL |
| OCR | /api/ocr → MIMO | BullMQ 异步队列 |
| 错题 | ⬜ 未实现 | WrongQuestion CRUD |
| 文件 | base64 内联 | MinIO/OSS 存储 |
