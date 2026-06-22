# Phase 6.4 WrongQuestionOrganizerAgent Design

## 背景

Phase 6.0 到 Phase 6.3 已经完成 Agent Runtime 地基、RouterAgent、TutorAgent 策略层和 KnowledgeVerifierAgent。当前错题本仍以平铺列表为主，虽然 CRUD、复习卡、备注和离线补偿已经可用，但长期学习场景下会出现两个问题：

1. 错题数量增长后，用户需要先按学科进入，再按专题复盘，而不是在一个长列表里筛选。
2. `subject`、`category`、`knowledgePoints` 已经存在，但它们只是错题字段，还没有形成稳定的“学科卡片 + 专题 deck”组织层。

Phase 6.4 的目标是先把错题组织层打通，让错题本首页从“所有错题列表”升级为“学科优先、专题下钻”的结构。Agent 在本阶段采用确定性 policy，不调用真实模型，避免成本、命名漂移和自动写库失控。

## 产品目标

- 错题本首页优先展示学科卡片，例如“高等数学”“大学英语”。
- 学科内部展示专题 deck，例如“曲线积分与格林公式”“阅读理解长难句”。
- 每个学科卡片展示错题数、未掌握数、已掌握数、主要知识点和最近更新时间。
- 每个专题 deck 展示错题数、未掌握数、归类原因、置信度和最近更新时间。
- 用户可以从专题进入错题列表，并继续使用查看、删除、标记掌握、备注、加入复习计划等现有能力。
- 用户可以重命名专题；手动重命名后的 deck 名称锁定，后续自动整理不覆盖。
- 用户可以把错题移动到其它专题；移动结果作为用户选择保存，后续自动整理尊重用户选择。

## 非目标

- 不在 Phase 6.4 调用真实模型进行自动归类。
- 不做复杂多专题合并 UI；合并只在数据模型和 API 设计中预留，必要时实现一个最小服务端能力。
- 不改变 WrongQuestion、Card、ReviewLog、ReviewTask 的事实源语义。
- 不让 Agent 直接删除错题或改写题目内容。
- 不把错题组织结果写入 Dexie mutation queue；第一版以在线 API 为主，错题本仍可用旧 Dexie 缓存兜底展示错题列表。
- 不把错题专题自动注入 Chat prompt；后续 PlannerAgent 或 MemoryAgent 阶段再决定是否注入。

## 核心设计

Phase 6.4 新增“组织层”，不替代错题事实层：

```text
WrongQuestion                  事实源：题目、解析、答案、状态、备注
Card / ReviewLog / ReviewTask  复习事实源：FSRS 调度、评分、任务状态

WrongQuestionSubjectGroup      展示组织层：学科卡片
WrongQuestionDeck              展示组织层：专题 deck
WrongQuestionDeckItem          组织关联层：错题属于哪个专题
```

组织层可以重建、修正、重命名，但不能让题目事实和复习事实丢失。删除 deck 默认只删除组织关联，不删除错题本身。

## 数据模型

### WrongQuestionSubjectGroup

```text
id          String
userId      String
subject     String
displayName String
sortOrder   Int
createdAt   DateTime
updatedAt   DateTime
```

约束：

- `@@unique([userId, subject])`
- `@@index([userId, sortOrder])`
- `subject` 使用 WrongQuestion 的原始学科字段归一化后写入。
- `displayName` 默认等于 `subject`，后续可支持用户重命名学科卡片。

### WrongQuestionDeck

```text
id             String
userId         String
subjectGroupId String
name           String
description    String?
source         WrongQuestionDeckSource
nameLocked     Boolean
confidence     Float
createdAt      DateTime
updatedAt      DateTime
```

枚举：

```text
WrongQuestionDeckSource = AI | USER | SYSTEM
```

约束：

- `@@index([userId, subjectGroupId, updatedAt])`
- 同一 subjectGroup 下 `name` 不强制唯一；服务层创建时尽量复用同名 deck，避免硬唯一导致后续重命名冲突。
- `nameLocked=true` 表示用户已经手动命名，自动整理只能继续关联错题，不能覆盖名称。

### WrongQuestionDeckItem

```text
id              String
deckId          String
wrongQuestionId String
reason          String?
confidence      Float
source          WrongQuestionDeckItemSource
createdAt       DateTime
updatedAt       DateTime
```

枚举：

```text
WrongQuestionDeckItemSource = AI | USER | SYSTEM
```

约束：

- `@@unique([deckId, wrongQuestionId])`
- `@@index([wrongQuestionId])`
- 一道错题第一版只展示一个主 deck；模型保留多归属能力，UI 先按最新主归属展示。

## Organizer Policy

Phase 6.4 的 `WrongQuestionOrganizerAgent` 是确定性 policy，放在 `@repo/agent`，不读取数据库、不调用模型、不写业务数据。它只根据输入错题和已有 deck 摘要输出建议。

输入：

```text
wrongQuestion:
  subject
  category
  knowledgePoints
  errorType
  questionText
  analysis
  answer
  userNote

existingDecks:
  id
  name
  nameLocked
  keywords
```

输出：

```text
subjectKey
subjectDisplayName
deckName
deckDescription
matchedDeckId?
reason
confidence
signals
```

归类规则：

1. 学科优先使用 `subject`，空值归入“其他”。
2. 专题名优先取高质量 `knowledgePoints[0]`，其次取 `category`，再其次取 `errorType`。
3. 如果已有 deck 名称或关键词与候选知识点重合，复用已有 deck。
4. 如果没有合适 deck，生成短专题名，长度控制在 4 到 16 个中文字符附近。
5. `confidence` 根据命中字段数量计算：知识点和已有 deck 命中最高，只有 errorType 时较低。
6. 用户移动过的错题或用户创建的 deck 在服务层优先级最高，policy 只提供建议。

## 服务端 API

新增模块建议命名为 `wrong-question-groups` 或 `wrong-question-organizer`。为了避免和现有 `/wrong-questions` CRUD 混在一起，推荐使用：

```text
GET    /wrong-question-groups
GET    /wrong-question-groups/:subjectGroupId/decks
GET    /wrong-question-decks/:deckId/questions
POST   /wrong-question-organizer/organize/:wrongQuestionId
POST   /wrong-question-organizer/organize-batch
PATCH  /wrong-question-decks/:deckId
POST   /wrong-question-decks/:deckId/items
DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId
```

接口语义：

- `GET /wrong-question-groups` 返回学科卡片摘要，包含统计字段。
- `GET /wrong-question-groups/:subjectGroupId/decks` 返回专题 deck 摘要。
- `GET /wrong-question-decks/:deckId/questions` 返回该专题下错题列表，复用现有 wrongQuestion response。
- `POST /wrong-question-organizer/organize/:wrongQuestionId` 对单个错题运行 deterministic organizer 并写入组织层。
- `POST /wrong-question-organizer/organize-batch` 整理当前用户未归类错题，限制单次最多 50 道。
- `PATCH /wrong-question-decks/:deckId` 支持重命名、描述更新和 `nameLocked`。
- `POST /wrong-question-decks/:deckId/items` 支持用户手动移动错题到专题。
- `DELETE /wrong-question-decks/:deckId/items/:wrongQuestionId` 只删除专题关联，不删除错题。

权限边界：

- 所有接口使用 `JwtAuthGuard`。
- 所有查询和写入必须带当前 `userId`。
- 跨用户 subject group、deck、deck item 返回 not found。
- 批量整理只处理当前用户错题。

## 保存错题后的数据流

```text
用户保存错题
  -> POST /wrong-questions
  -> WrongQuestion 写入 PostgreSQL
  -> 前端提示保存成功
  -> 前端或服务端触发 POST /wrong-question-organizer/organize/:id
  -> Organizer policy 输出学科组和专题建议
  -> 服务端 upsert SubjectGroup / Deck / DeckItem
  -> 错题本页面刷新学科卡片摘要
```

第一版可以由前端保存成功后触发整理接口，这样对现有 `WrongQuestionsService.create()` 侵入更小。后续 Phase 7 引入 BullMQ 后，可以改成保存成功后投递后台整理任务。

## 用户手动调整数据流

### 重命名专题

```text
用户在专题卡片菜单点击重命名
  -> PATCH /wrong-question-decks/:deckId { name, nameLocked: true }
  -> Deck 名称更新
  -> 后续 organizer 复用该 deck 时不覆盖 name
```

### 移动错题

```text
用户在错题详情或专题列表中选择移动
  -> POST /wrong-question-decks/:targetDeckId/items { wrongQuestionId, source: USER }
  -> 服务端确保 targetDeck 和 wrongQuestion 属于同一用户
  -> 写入或更新 DeckItem
  -> UI 刷新原 deck 和目标 deck
```

第一版 UI 可以只支持“移动到已有专题”，创建新专题可通过重命名或后续操作补充。若实现成本可控，可在移动弹层内允许输入新专题名。

## 前端信息架构

错题本首页：

```text
/error-book
  -> Header: 错题本总览
  -> Summary: 全部 / 未掌握 / 已掌握
  -> SubjectGroupCard[]
```

学科页：

```text
/error-book?subjectGroupId=xxx
  -> 学科标题与统计
  -> DeckCard[]
```

专题页：

```text
/error-book?deckId=xxx
  -> 专题标题、说明、归类原因
  -> WrongQuestionCard[]
  -> WrongQuestionDetail overlay/fullscreen
```

交互要求：

- 保持当前移动端优先风格。
- 首页不要继续平铺所有错题，除非无组织数据时作为降级。
- 删除错题、保存备注、标记掌握、加入复习计划沿用当前轻提示体系。
- deck 菜单使用右上角三点菜单，不使用浏览器原生 confirm。
- 空状态要告诉用户“保存错题后系统会自动整理为学科和专题”。
- 当组织 API 失败时，错题本仍展示原有错题列表降级，不阻塞用户查看和删除错题。

## Dexie 与离线边界

- WrongQuestion 的离线 CRUD 继续使用现有 Dexie `mutationQueue`。
- SubjectGroup / Deck / DeckItem 第一版不进入 mutation queue。
- 离线时页面可展示 Dexie 中的错题列表作为降级。
- 在线恢复后，前端可重新拉取组织层摘要。
- 若某道本地待同步错题尚未获得服务端 id，不参与 organizer。

## 测试策略

### Agent 单元测试

- 无知识点时按 `category` 生成 deck。
- 有知识点时优先使用知识点。
- 已有 deck 命中时复用 `matchedDeckId`。
- 只有 errorType 时 confidence 较低。
- 空学科归入“其他”。

### Types 单元测试

- 新增 group/deck API schema 的成功解析。
- 重命名 deck 请求必须有合法 name。
- 批量整理 limit 不超过 50。

### Server 单元测试 / e2e

- 保存错题后单道 organize 能创建学科组、deck 和 deck item。
- 重复 organize 不创建重复 deck item。
- 用户 A 不能读取或移动用户 B 的 deck / item。
- 重命名 deck 后 `nameLocked=true`，再次 organize 不覆盖名称。
- 删除 deck item 不删除 WrongQuestion。

### Web 单元测试

- 学科摘要能正确计算未掌握和已掌握展示。
- 专题卡片能显示 confidence、reason 和最近更新时间。
- 组织 API 失败时页面降级到错题列表。
- 移动端触摸按钮不小于 44px。

### 手动验收

- 创建不同学科错题后，首页展示多个学科卡片。
- 进入“高等数学”后能看到专题 deck。
- 进入专题后能查看错题详情、保存备注、标记掌握、删除错题。
- 重命名专题后刷新页面仍保留新名称。
- 手动移动错题后，原专题数量减少，目标专题数量增加。

## 成本与风险控制

- 本阶段 Agent 不调用真实模型，因此不会增加 DeepSeek / OpenAI token 成本。
- 写库动作只在服务端 API 内完成，所有操作受 `JwtAuthGuard` 和 `userId` 约束。
- 自动整理只写组织层，不改题目事实和复习事实。
- 前端有降级路径，组织层接口失败不影响基础错题本。
- 后续如果引入真实模型命名专题，需要保留 mock 模式和小样本 live 验收，并限制单次批量整理数量。

## 验收标准

Phase 6.4 完成后应满足：

- 新增错题组织数据模型和共享 API contract。
- `WrongQuestionOrganizerAgent` deterministic policy 可测试、可导出、无模型调用。
- 服务端能按当前用户创建和读取学科卡片、专题 deck 和 deck item。
- 保存错题后可触发单题整理，批量整理能补齐历史未归类错题。
- 错题本首页按学科卡片展示，学科内按专题下钻。
- 专题内错题保留现有查看、删除、备注、标记掌握和加入复习计划能力。
- 用户重命名专题后，后续自动整理不会覆盖该名称。
- 所有新增路径通过 lint、typecheck、测试和一次浏览器手动体验验证。
