# PrepMind AI — Phase 1 数据流

> 当前版本：2026-06-08。Phase 1 是纯前端 MVP，不接入数据库服务端；浏览器本地状态暂由 localStorage + Dexie 承担。

---

## 1. 总览

```text
用户操作
  ↓
Next.js Client Component
  ↓
React / zustand 内存态
  ↓
localStorage 或 IndexedDB(Dexie)
  ↓
页面刷新后从本地恢复
```

外部 AI 调用仍通过 Next.js API Route 代理：

```text
聊天输入 → /api/chat → DeepSeek → SSE → useChat → Dexie messages
拍照识题 → /api/ocr  → MIMO v2.5 → SSE → Dexie ocrRecords → 用户确认保存 → Dexie wrongQuestions
```

Phase 1 没有后端数据库，因此：

- localStorage 只存用户态和 UI 草稿。
- Dexie 是本地业务数据源。
- TanStack Query 已移除，Phase 2 接入 HTTP API 后再恢复。

---

## 2. 存储分层

| 存储 | Key / 表 | 当前内容 | 说明 |
| --- | --- | --- | --- |
| localStorage | `prepmind-user` | `currentUser`、`users[]` | Phase 1 模拟登录注册 |
| localStorage | `prepmind-chat` | `inputDraft` | 切页不丢输入框草稿 |
| IndexedDB | `messages` | 聊天消息 | 由 `useChat()` 产生，写入 Dexie |
| IndexedDB | `ocrRecords` | OCR 用户图片与识别结果 | 按 `groupId` 绑定同一次 OCR |
| IndexedDB | `wrongQuestions` | 错题本记录 | Phase 1 错题本唯一数据源 |

---

## 3. 登录态数据流

```text
注册/登录表单
  ↓
客户端校验
  ↓
useUserStore.register / loginByPhone / loginByEmail
  ↓
zustand state 更新
  ↓
persist 写入 localStorage: prepmind-user
```

刷新或进入受保护页面时：

```text
Client useEffect
  ↓
hydrateUserStoreFromStorage()
  ↓
从 localStorage 手动恢复 currentUser / users
  ↓
AuthGuard 判断 currentUser
  ↓
有用户：放行；无用户：redirect /login
```

这里不用服务端读取 localStorage，避免 SSR 与 CSR 首屏不一致导致 hydration warning。

---

## 4. 聊天数据流

```text
用户输入文本
  ↓
ChatInputBar onInputChange
  ↓
useChat input + chatStore.inputDraft
  ↓
提交到 /api/chat
  ↓
DeepSeek SSE 流式返回
  ↓
useChat messages[] 更新
  ↓
MarkdownRenderer 渲染 Markdown / GFM / 数学公式
  ↓
saveChatToDb()
  ↓
Dexie transaction: messages.clear() + messages.bulkAdd()
```

`messages` 表字段：

```ts
interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  order: number;
  createdAt: number;
}
```

保存策略：

- 用户消息进入数组后保存一次。
- AI 流式完成、`isLoading` 变为 false 后再保存一次，确保最终回复不丢。
- 页面关闭或隐藏时执行 flush，减少未写入风险。

---

## 5. OCR 数据流

```text
用户选择图片或拍照
  ↓
FileReader 转 base64 预览
  ↓
提交到 /api/ocr
  ↓
MIMO v2.5 SSE 流式返回
  ↓
ocrMessages 实时更新
  ↓
流式完成后写入 Dexie ocrRecords
```

`ocrRecords` 表字段：

```ts
interface OcrRecord {
  id: string;
  type: 'user' | 'ocr-loading' | 'ocr-result';
  groupId?: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
}
```

`groupId` 用来把同一次 OCR 的图片消息与识别结果绑定起来，也是保存错题时防重复的关键来源。

---

## 6. 聊天 + OCR 统一时间线

Day 3 的问题是聊天消息和 OCR 消息分两段渲染，刷新后顺序可能变成“全部聊天在前，OCR 在后”。

当前方案：

```ts
type UnifiedMsg =
  | { kind: 'chat'; time: number }
  | { kind: 'ocr-user'; time: number }
  | { kind: 'ocr-result'; time: number };
```

渲染时：

```text
messages + ocrMessages
  ↓
按 createdAt / chatTimestamps 合并
  ↓
sort(time)
  ↓
一次 map，根据 kind 分发到 ChatBubble / OcrBubble
```

刷新恢复时：

- `messages` 使用 Dexie 里的 `createdAt`。
- `ocrRecords` 直接使用表里的 `createdAt`。
- 新消息用 `chatTimestamps` 记录创建时间。

---

## 7. 错题本数据流

错题来源目前只有 OCR：

```text
OCR 识别结果
  ↓
用户点击“保存到错题本”
  ↓
检查 sourceGroupId 是否已存在
  ↓
parseOcrResult(content)
  ↓
组装 WrongQuestionRecord
  ↓
db.wrongQuestions.add(record)
  ↓
按钮变为“已保存”，禁止重复保存
```

`wrongQuestions` 表字段：

```ts
interface WrongQuestionRecord {
  id: string;
  source: 'ocr' | 'manual' | 'chat';
  sourceRecordId?: string;
  sourceGroupId?: string;
  imageUrl?: string;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string;
  userNote: string;
  rawContent: string;
  status: 'unresolved' | 'resolved';
  createdAt: number;
  updatedAt: number;
}
```

错题本页面读写：

```text
/error-book 初始加载
  ↓
db.wrongQuestions.orderBy('createdAt').reverse().toArray()
  ↓
本地 state items
  ↓
筛选 / 详情 / 删除 / 标记掌握 / 保存备注
  ↓
db.wrongQuestions.update/delete
```

当前分类策略：

- `subject`：优先取 AI 输出的学科，缺失时由关键词推断。
- `category`：优先取第一个知识点，缺失时回退到学科。
- `knowledgePoints`：从 AI 输出的知识点列表提取，最多保留 8 个。
- `errorType`：优先取 AI 输出的错因，缺失时由关键词推断。

---

## 8. Dexie Schema 版本

| 版本 | messages | ocrRecords | wrongQuestions | 说明 |
| --- | --- | --- | --- | --- |
| v1 | `id, role` | `id, type, createdAt` | - | 初始本地消息/OCR |
| v2 | `id, role, order` | `id, type, createdAt` | - | 增加消息顺序 |
| v3 | `id, role, order, createdAt` | `id, type, createdAt` | - | 增加消息时间戳 |
| v4 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, subject, category, errorType, status, createdAt, updatedAt` | 增加错题本 |
| v5 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加 `sourceGroupId` 索引 |

v5 的 `sourceGroupId` 索引用于保存错题时按 OCR group 防重复。

---

## 9. 登出数据流

```text
点击“退出登录”
  ↓
useUserStore.logout()
  ↓
currentUser 置空
  ↓
Dexie transaction 清空：
  - messages
  - ocrRecords
  - wrongQuestions
  ↓
返回登录/聊天入口
```

Phase 1 采用“登出清空本地业务数据”的策略，避免模拟多用户时数据串用。Phase 2 后需要改为后端用户隔离，不应简单清空真实历史数据。

---

## 10. Phase 2 迁移方向

| 功能 | Phase 1 | Phase 2 |
| --- | --- | --- |
| 认证 | zustand + localStorage | NestJS AuthModule + session/JWT |
| 聊天记录 | Dexie `messages` | ChatMessage API + PostgreSQL |
| OCR 记录 | Dexie `ocrRecords` + base64 | OCR API + BullMQ + 对象存储 URL |
| 错题本 | Dexie `wrongQuestions` | WrongQuestion CRUD API + PostgreSQL |
| 服务端状态 | 无 TanStack Query | TanStack Query 管理 API 缓存 |
| 离线能力 | Dexie 是主数据源 | Dexie 作为离线缓存 |

迁移原则：

- PostgreSQL 成为唯一真实数据源。
- Dexie 降级为离线缓存和乐观更新层。
- TanStack Query 只管理 API server state，不再包裹本地 Dexie 读写。
- OCR 输出应升级为严格 schema，前端解析只做校验和兜底。
