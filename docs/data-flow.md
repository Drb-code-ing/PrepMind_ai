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
拍照识题 → /api/ocr  → MIMO v2.5 → SSE → 固定 Markdown schema → 用户预览确认 → Dexie wrongQuestions
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
| localStorage | `prepmind-today:{userId}:{date}` | 当天已完成任务 ID | 今日任务静态版，本地按账号和日期隔离 |
| IndexedDB | `messages` | 聊天消息 | 按 `userId` 隔离，当前账号只读写自己的记录 |
| IndexedDB | `ocrRecords` | OCR 用户图片与识别结果 | 按 `userId` 隔离，`groupId` 绑定同一次 OCR |
| IndexedDB | `wrongQuestions` | 错题本记录 | 按 `userId` 隔离，Phase 1 错题本唯一数据源 |

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
Dexie transaction: 删除当前 userId 的旧 messages + bulkAdd 新 messages
```

`messages` 表字段：

```ts
interface StoredMessage {
  id: string;
  userId: string;
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
  userId: string;
  type: 'user' | 'ocr-loading' | 'ocr-result';
  groupId?: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
}
```

`userId` 用于本地账号隔离。`groupId` 用来把同一次 OCR 的图片消息与识别结果绑定起来，也是保存错题时防重复的关键来源。

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

错题来源目前只有 OCR。OCR prompt 要求 AI 保留固定二级标题 schema，前端解析后先弹出保存预览：

```text
OCR 识别结果
  ↓
用户点击“保存到错题本”
  ↓
按 userId + sourceGroupId 检查是否已存在
  ↓
parseOcrResult(content)
  ↓
校验必填字段：题目 / 知识点 / 分析思路 / 参考答案
  ↓
展示保存预览与缺失字段提示
  ↓
用户确认后组装 WrongQuestionRecord
  ↓
db.wrongQuestions.add(record)
  ↓
按钮变为“已保存”，禁止重复保存
```

`wrongQuestions` 表字段：

```ts
interface WrongQuestionRecord {
  id: string;
  userId: string;
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
db.wrongQuestions.where('userId').equals(currentUser.id).sortBy('createdAt')
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
- `questionText`、`knowledgePoints`、`analysis`、`answer` 是保存预览的重点字段，缺失时提示用户补充。

---

## 8. Dexie Schema 版本

| 版本 | messages | ocrRecords | wrongQuestions | 说明 |
| --- | --- | --- | --- | --- |
| v1 | `id, role` | `id, type, createdAt` | - | 初始本地消息/OCR |
| v2 | `id, role, order` | `id, type, createdAt` | - | 增加消息顺序 |
| v3 | `id, role, order, createdAt` | `id, type, createdAt` | - | 增加消息时间戳 |
| v4 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, subject, category, errorType, status, createdAt, updatedAt` | 增加错题本 |
| v5 | `id, role, order, createdAt` | `id, type, groupId, createdAt` | `id, source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加 `sourceGroupId` 索引 |
| v6 | `id, userId, [userId+order], role, order, createdAt` | `id, userId, [userId+createdAt], type, groupId, createdAt` | `id, userId, [userId+sourceGroupId], [userId+createdAt], source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt` | 增加本地账号隔离 |

v5 的 `sourceGroupId` 索引用于保存错题时按 OCR group 防重复。
v6 的 `userId` 索引用于阻断不同本地账号之间的聊天、OCR、错题串用。

---

## 9. 登出数据流

```text
点击“退出登录”
  ↓
useUserStore.logout()
  ↓
currentUser 置空
  ↓
返回登录/聊天入口
```

Phase 1 当前采用“本地业务数据按 `userId` 隔离”的策略。退出登录不删除 IndexedDB 业务数据，同一账号再次登录可以恢复自己的聊天、OCR 和错题记录；新账号不会看到旧账号数据。

如果用户在浏览器里只清空 localStorage 而没有清空 IndexedDB，旧的 v5 及以前无 `userId` 数据会保持无主状态，不再自动展示给新注册账号。

## 10. 今日任务静态版

Phase 1 的今日任务不调用后端，也不引入请求/响应拦截器。

```text
/today
  ↓
读取 currentUser.id + 当天日期
  ↓
readTodayTaskState(userId, dateKey)
  ↓
渲染静态任务模板 + 完成进度
  ↓
用户勾选任务
  ↓
writeTodayTaskState(userId, state)
```

任务模板在前端常量 `TODAY_TASKS` 中维护，包括：

- 知识点复盘
- 错题回看
- 拍照识题
- 学习总结

页面会读取 Dexie `wrongQuestions` 中当前用户的未掌握错题数量，用来增强“错题回看”任务提示，但任务本身仍是静态模板。

---

## 11. Phase 2 迁移方向

| 功能 | Phase 1 | Phase 2 |
| --- | --- | --- |
| 认证 | zustand + localStorage | NestJS AuthModule + session/JWT |
| 聊天记录 | Dexie `messages` + `userId` | ChatMessage API + PostgreSQL 用户归属 |
| OCR 记录 | Dexie `ocrRecords` + `userId` + base64 | OCR API + BullMQ + 对象存储 URL |
| 错题本 | Dexie `wrongQuestions` + `userId` | WrongQuestion CRUD API + PostgreSQL 用户归属 |
| 今日任务 | 静态模板 + localStorage 用户/日期隔离 | Task API + AI/FSRS 推荐 |
| 服务端状态 | 无 TanStack Query | TanStack Query 管理 API 缓存 |
| 离线能力 | Dexie 是主数据源 | Dexie 作为离线缓存 |

迁移原则：

- PostgreSQL 成为唯一真实数据源。
- Dexie 降级为离线缓存和乐观更新层。
- TanStack Query 只管理 API server state，不再包裹本地 Dexie 读写。
- OCR 输出在 Phase 1 已使用固定 Markdown schema；Phase 2 可升级为后端 schema 校验和结构化 JSON。
