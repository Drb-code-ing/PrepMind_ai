# PrepMind AI 数据流

> 当前版本：2026-06-15。Phase 4.4 已完成，Phase 4 继续推进。本文只描述当前仍然有效的数据流边界，历史实现细节见 `DEVLOG.md`。

## 1. 当前边界

- 登录态权威来源：NestJS Auth API + PostgreSQL refresh token + httpOnly cookie。
- 业务数据权威来源：WrongQuestion、ChatMessage、OCRRecord 均已迁移到 PostgreSQL。
- 本地缓存职责：Dexie 负责快速恢复、离线兜底、乐观更新、旧图片预览和 mutation queue。
- AI 代理职责：`/api/chat` 与 `/api/ocr` 仍由 Next.js API Route 代理外部 AI 服务。
- 图片存储职责：新 OCR 图片通过 NestJS `/uploads/images` 上传到 MinIO。
- 复习系统职责：错题可生成 FSRS 复习卡，Card / ReviewLog / ReviewTask 以 PostgreSQL 为权威来源。
- 本地轻状态：今日任务轻手账 checklist、学习偏好和 in-app 复习提醒偏好继续使用 userId scoped localStorage。

```text
用户操作
  -> Next.js Client
  -> TanStack Query / React state
  -> apiClient 或 Next.js API Route
  -> NestJS REST API / 外部 AI 服务
  -> PostgreSQL / MinIO
  -> Dexie / localStorage 本地兜底
```

## 2. Auth

```text
登录 / 注册
  -> authApi
  -> apiClient
  -> NestJS Auth API
  -> Prisma User + RefreshToken
  -> Set-Cookie: prepmind_refresh=httpOnly
  -> 返回 { user, accessToken }
  -> userStore 运行态 session
```

```text
刷新页面
  -> AuthSessionProvider
  -> POST /auth/refresh
  -> 校验 refresh cookie
  -> refresh token rotation
  -> 返回新的 { user, accessToken }
  -> 恢复前端 session
```

关键约定：

- refresh token 只以 hash 形式保存在 PostgreSQL。
- refresh token 已启用 rotation 与 reuse detection。
- 旧 RT 重放时，服务端撤销同 family 活跃 token 并强制重新登录。
- 当前 Auth 主链路不依赖 Redis。
- refresh 失败视为未登录，不弹全局错误。

## 3. AI 聊天

```text
用户输入文本
  -> ChatInputBar
  -> /api/chat
  -> buildChatContextMessages() 裁剪近期聊天历史
  -> buildChatSystemPrompt() 注入 activeStudyContext
  -> OpenAI / DeepSeek SSE
  -> StreamingMarkdownRenderer 渐进渲染
  -> Dexie messages 本地缓存
  -> POST /chat-messages/sync
  -> PostgreSQL
```

关键约定：

- `/api/chat` 不注入完整历史，只注入裁剪后的近期上下文和当前活跃题目上下文。
- 完整聊天历史仍保存于 PostgreSQL 与 Dexie。
- `activeStudyContext` 来自有效 OCR 题目，用于承接“这一步为什么这样做”等追问。
- Chat / OCR 展示层的格式化不回写 `activeStudyContext`。
- 流式输出使用渐进 Markdown 渲染：稳定段落进入 Markdown / KaTeX，尾部未稳定内容保持轻量文本。
- 自动滚动默认跟随输出；用户触摸、滚轮或指针操作内容区后暂停，新一轮生成或回到底部时恢复。

服务端 ChatMessage API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/chat-messages` | 读取当前用户会话消息，支持 `conversationId` |
| `POST` | `/chat-messages/sync` | 幂等同步当前会话快照，无 `conversationId` 时创建默认会话 |
| `DELETE` | `/chat-messages` | 清空当前用户会话，支持 `conversationId` |

ChatMessage 不进入通用 CRUD mutation queue，继续使用会话快照幂等同步。

## 4. OCR 与错题本

```text
用户选择图片或拍照
  -> 本地 preview URL 即时展示
  -> 并行：
      A. POST /api/ocr -> 外部 OCR 模型 SSE
      B. POST /uploads/images -> MinIO -> 服务端图片 URL
  -> OCR 输出完成
  -> 提取 OcrStructuredResult
  -> 写入 OcrRecord.parsedJson
  -> POST /ocr-records
  -> 若为有效题目：从结构化题目生成 activeStudyContext
  -> 用户确认保存错题
  -> POST /wrong-questions
  -> 成功：PostgreSQL + Dexie 缓存
  -> 失败：Dexie mutationQueue 暂存，后续自动补偿同步
```

关键约定：

- `/api/ocr` 输出 display Markdown + structured JSON envelope。
- `OcrStructuredResult` 是 OCR 完成态的主要数据来源，旧 Markdown parser 仅作为历史记录和异常输出兜底。
- 当前错题来源仍以 OCR 为主。
- 非题目 OCR 不生成 `activeStudyContext`，不显示保存错题入口，也不套用题目分析框架。
- 保存错题入口只在有效题目 OCR 输出结束后出现。
- 多题 OCR 会拆成独立题目对象，错题防重 key 使用 `sourceGroupId:questionId`。
- `activeStudyContext` 从结构化题目对象生成，包含题目 id、题型、难度和识别提醒。
- `sourceRecordId` 指向服务端 `OcrRecord.id`。
- `/ocr-records` 与 `/wrong-questions` 不接收 `data:` base64 图片；前端创建请求前会剥离本地 base64。
- 新图片优先保存 `/uploads/images/users/...` 服务端 URL。
- 上传失败不阻塞 OCR，当前设备 Dexie 继续保留本地预览作为兜底。

服务端 OCRRecord API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/ocr-records` | 读取当前用户 OCR 历史，支持分页、状态、关键词和 `isQuestion` |
| `GET` | `/ocr-records/:id` | 读取当前用户 OCR 详情 |
| `POST` | `/ocr-records` | 创建或按 `userId + groupId` upsert OCR 结果 |
| `DELETE` | `/ocr-records/:id` | 删除当前用户 OCR 记录 |

服务端 WrongQuestion API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/wrong-questions` | 分页列表，支持 `status`、`subject`、`keyword` |
| `GET` | `/wrong-questions/:id` | 当前用户错题详情 |
| `POST` | `/wrong-questions` | 创建错题，`sourceGroupId` 用于同用户防重复 |
| `PATCH` | `/wrong-questions/:id` | 更新题目字段、备注、掌握状态 |
| `DELETE` | `/wrong-questions/:id` | 删除当前用户错题 |

权限边界：

- 所有业务 API 均经过 `JwtAuthGuard`。
- Service 层读写必须带当前 `userId` 条件。
- 访问不存在或不属于当前用户的数据，返回业务级 not found。
- 同一用户重复提交相同 `sourceGroupId`，返回 `WRONG_QUESTION_DUPLICATED`。

## 5. FSRS 复习

```text
错题详情
  -> POST /reviews/cards/from-wrong-question
  -> Card(wrongQuestionId) 写入 PostgreSQL
  -> 今日任务读取 /review-tasks/today
  -> 懒生成当日本地日期的 ReviewTask
  -> 用户查看答案并选择 Again / Hard / Good / Easy
  -> POST /review-tasks/:taskId/rating + clientMutationId
  -> @repo/fsrs 计算下一次复习时间
  -> 事务内更新 Card + 写入 ReviewLog(clientMutationId) + 完成 ReviewTask
  -> /stats 读取 /reviews/stats 与 /reviews/logs
```

关键约定：

- Phase 4.1 使用 WrongQuestion-first 复习模型，不强制先迁移到 Question。
- `@repo/fsrs` 是纯调度算法包，不依赖 Prisma、NestJS、浏览器或系统时间副作用。
- `ReviewTask` 是 Phase 4.3 新增的持久化任务层，只记录 pending / completed / skipped / cancelled 生命周期。
- Card / ReviewLog / ReviewTask 均按当前 `userId` 隔离，所有 Review API 经过 `JwtAuthGuard`。
- ReviewTask 评分使用前端生成的 `clientMutationId` 幂等提交；服务端写入 `ReviewLog.clientMutationId`，同一评分命令重试不会重复写 `ReviewLog`。
- 复习评分在线成功时写入 PostgreSQL；离线或可重试失败时进入 Dexie `mutationQueue` 的 `reviewTask/rating`。
- 离线评分不会本地推进 FSRS、Card、ReviewLog 或统计；今日任务页只展示待同步状态，服务端同步成功后刷新 ReviewTask 和 Review stats 查询。
- `/review-tasks/today` 按当前用户本地日期懒生成到期任务，同一 `cardId + scheduledDate` 不重复创建。
- `/review-tasks/:taskId/rating` 在事务内更新 Card、写入 ReviewLog、完成 ReviewTask，并关联 `reviewLogId`。
- `/review-tasks/:taskId/skip` 与 `/review-tasks/:taskId/reopen` 只改变 ReviewTask 状态，不更新 Card，也不写 ReviewLog。
- 今日任务页读取 persisted ReviewTask，评分、跳过和恢复后通过 TanStack Query 失效重新读取。
- 学习统计页 `/stats` 不在前端扫描原始表，只读取服务端聚合后的 Review stats/logs。
- `/reviews/stats` 基于 `Card` / `ReviewLog` 聚合复习次数、掌握率、连续复习、评分分布、卡片状态和每日趋势。
- `/reviews/logs` 返回当前用户最近复习记录和错题摘要，`ReviewLog` 通过关联 `card.userId` 隔离用户。

服务端 Review API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/reviews/cards/from-wrong-question` | 将当前用户错题加入复习计划，重复加入返回已有卡片 |
| `GET` | `/reviews/cards/by-wrong-question/:wrongQuestionId` | 读取错题对应复习卡状态 |
| `GET` | `/reviews/tasks/today` | 旧派生视图；前端主链路已迁移到 `/review-tasks/today` |
| `GET` | `/reviews/stats` | 读取 7 天 / 30 天复习统计，支持用户本地日期分桶 |
| `GET` | `/reviews/logs` | 分页读取当前用户最近复习日志 |
| `POST` | `/reviews/cards/:cardId/rating` | 提交 Again / Hard / Good / Easy 评分，更新 Card 并写 ReviewLog |

服务端 ReviewTask API：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/review-tasks/today` | 懒生成并读取当前用户本地日期的 ReviewTask，支持 `date`、`timezoneOffsetMinutes`、`includeCompleted` |
| `GET` | `/review-tasks` | 分页读取 ReviewTask，支持 `date` 与 `status` 过滤 |
| `POST` | `/review-tasks/:taskId/rating` | 提交评分，支持 `clientMutationId` 幂等，事务内更新 Card、写入 ReviewLog、完成 ReviewTask |
| `POST` | `/review-tasks/:taskId/skip` | 跳过待复习任务，只更新 ReviewTask |
| `POST` | `/review-tasks/:taskId/reopen` | 恢复已跳过任务到待复习，只更新 ReviewTask |

## 6. Dexie 与离线补偿

Dexie 当前职责：

| 表 | 作用 | 权威来源 |
| --- | --- | --- |
| `messages` | 聊天消息本地缓存 | `/chat-messages` |
| `ocrRecords` | OCR 历史本地缓存、本地图片预览兜底 | `/ocr-records` |
| `wrongQuestions` | 错题本本地缓存、乐观更新 | `/wrong-questions` |
| `mutationQueue` | WrongQuestion / OCRRecord / ReviewTask rating 失败写操作补偿队列 | 本地暂存，最终以服务端为准 |

mutation queue 流程：

```text
WrongQuestion / OCRRecord / ReviewTask rating 写操作
  -> 乐观更新 TanStack Query / Dexie
  -> 调用 NestJS API
  -> 成功：服务端返回覆盖本地缓存，syncStatus=synced
  -> 失败：写入 mutationQueue，业务记录标记 syncStatus=failed；ReviewTask rating 只展示待同步状态
  -> session 恢复 / online / focus 时 flushMutationQueue
  -> 成功后清理 mutationQueue，并刷新 ReviewTask / Review stats 查询
```

进入队列的操作：

- WrongQuestion：create / update / delete。
- OCRRecord：create；delete 已预留在 flush 逻辑中。
- ReviewTask：rating。

不进入队列的操作：

- ChatMessage：使用 `/chat-messages/sync` 会话快照幂等同步。
- ReviewTask skip / reopen：当前只在线更新 ReviewTask，不进入离线补偿队列。
- 图片上传：上传失败不阻塞 OCR，不自动静默迁移历史 base64。
- 今日任务轻手账 checklist 和学习偏好：仍是 localStorage 本地轻状态。

冲突处理：

- 删除操作服务端返回 404 视为成功。
- WrongQuestion 重复创建返回 `WRONG_QUESTION_DUPLICATED` 视为已存在。
- 401 / 403 不重试；网络错误和 5xx 按退避策略重试。
- 服务端列表仍是已同步数据的权威来源；本地只保留未同步 mutation 记录作为补偿。

## 7. localStorage

| Key | 内容 | 说明 |
| --- | --- | --- |
| `prepmind-chat` | 输入框草稿 | 本地体验状态 |
| `prepmind-today:{userId}:{date}` | 轻手账 checklist 完成状态 | 当前不承载 ReviewTask 复习任务 |
| `prepmind-preferences:{userId}` | 学习目标、讲解偏好、每日强度 | Phase 2.5 本地偏好，暂不注入 prompt |
| `prepmind-review-reminder:{userId}` | in-app 复习提醒偏好 | Phase 4.4 本地偏好，当前仅用于页面内摘要 |

学习偏好后续如果要影响 AI 讲解风格，需要在个性化讲解阶段单独设计 prompt 注入边界。

## 8. PostgreSQL / Prisma

当前已落地的核心模型：

- `User`
- `RefreshToken`
- `Conversation`
- `ChatMessage`
- `OcrRecord`
- `WrongQuestion`
- `Question`
- `Card`
- `ReviewLog`（`clientMutationId` 用于 ReviewTask rating 幂等）
- `ReviewTask`
- `Document`
- `Chunk`

本机 Docker PostgreSQL 映射：

```text
localhost:5433 -> container:5432
```

Prisma migration 状态期望：

```text
Database schema is up to date
```

## 9. Phase 3 数据流改进

Phase 3 已将 OCR 识别链路从 Markdown-first 升级为 structured output：

1. `/api/ocr` 要求模型同时输出可展示 Markdown 和结构化 JSON envelope。
2. 前端完成阶段提取 `OcrStructuredResult`，并保存到 `OcrRecord.parsedJson`。
3. `activeStudyContext` 从结构化题目对象生成，后续追问继续承接当前题目。
4. 保存错题优先使用结构化字段，多题按 `sourceGroupId:questionId` 生成独立防重 key。
5. 旧 OCR 历史继续通过 legacy adapter 和 `parseOcrResult()` 兜底。
6. `createWrongQuestion`、`searchKnowledge`、`createReviewTask` 已保留为 tool action proposal 边界，暂不自动写库。
