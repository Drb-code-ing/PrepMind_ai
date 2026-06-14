# Phase 4 FSRS 记忆系统设计

> 目标：把 Phase 2.3 已落地的错题本从“保存和查看”推进到“按记忆曲线复习”，让用户能把错题加入复习、完成今日复习、用 Again / Hard / Good / Easy 评分，并让系统更新下一次复习时间。

## 1. 背景

当前主链路已经具备：

- OCR structured output 可以稳定拆出题目字段。
- WrongQuestion API 已迁移到 PostgreSQL，并按当前 `userId` 隔离。
- 错题本页面支持查看、备注、标记掌握和删除。
- 今日任务仍是本地轻学习手账，没有接入真实复习数据。
- `packages/fsrs` 已存在纯算法包占位，但 `fsrs()` 和 `scheduler` 仍未实现。
- Prisma schema 已有 `Card` / `ReviewLog` 初稿，但 `Card` 只关联 `Question`，还没有和当前真正可用的 `WrongQuestion` 链路打通。

Phase 4 的核心不是单独做一个算法 demo，而是把“错题 -> 复习卡片 -> 今日复习 -> 评分 -> 下次复习”的数据流跑通。

## 2. 设计原则

### 2.1 WrongQuestion-first

当前用户真正产生和管理的是 `WrongQuestion`。Phase 4 优先让错题生成复习卡片，而不是先强制把错题迁移成题库 `Question`。`Question` 保留为后续题库、RAG、公共题目抽象，不阻塞当前阶段。

### 2.2 FSRS 算法与业务持久化分离

`packages/fsrs` 只负责纯算法计算，不依赖 Prisma、NestJS、浏览器或时间源副作用。后端 Review module 负责读写 Card / ReviewLog，调用 `@repo/fsrs` 得到新状态。

### 2.3 服务端为权威

复习状态、评分记录、下次复习时间必须以 PostgreSQL 为权威来源。前端可以用 TanStack Query 做缓存和乐观反馈，但 Phase 4.1 不把复习写操作放进 Dexie `mutationQueue`，避免把离线补偿范围扩大得过早。

### 2.4 ReviewTask 先作为 API 视图

今日复习任务可以由 `Card.nextReview <= todayEnd` 动态查询得到，不需要第一轮就新建持久化 `ReviewTask` 表。Phase 4 中的 `ReviewTask` 指 API 返回的任务 DTO。后续如果要做 AI 学习计划、任务锁定、日历统计，再引入持久化任务表。

### 2.5 移动端复习体验优先

评分入口要适合手机单手操作：卡片内容清晰、答案可折叠、四个评分按钮稳定不跳动。不要把复习页做成复杂管理后台。

## 3. 范围

### 3.1 In Scope

1. 实现 `@repo/fsrs` 的卡片调度核心。
2. 定义共享 Review API schema 和类型。
3. 调整 Prisma Card 模型，使它能关联 WrongQuestion。
4. 新增 NestJS Review module。
5. 支持从错题创建或复用复习卡片。
6. 支持获取今日到期复习任务。
7. 支持提交 Again / Hard / Good / Easy 评分，并写入 ReviewLog。
8. 错题详情页显示“加入复习 / 复习中”状态。
9. 今日任务页接入真实到期复习卡片。
10. 更新数据流、roadmap、AGENTS、CLAUDE、DEVLOG。

### 3.2 Out of Scope

第一轮不做：

- AI 自动创建复习任务。
- RAG 知识点推荐复习。
- 多卡组、Deck、标签系统。
- 复习日历热力图。
- 离线复习评分 mutation queue。
- 推送通知和 PWA 后台提醒。
- 完整学习统计看板。
- 把所有 WrongQuestion 强制迁移成 Question。

## 4. 核心方案选择

### 4.1 方案 A：WrongQuestion-first Card，推荐

给 `Card` 增加 `wrongQuestionId` 可选关联，Phase 4 创建卡片时直接关联错题。`questionId` 保留为可选字段，为后续题库卡片预留。

优点：

- 最贴近当前产品数据流。
- 不需要先重构题库模型。
- 错题详情和复习卡片字段天然一致。
- 后续可以逐步把高质量错题沉淀为 `Question`。

缺点：

- Card 短期会支持两类来源：WrongQuestion / Question。
- 需要在响应 DTO 中明确 source 类型。

### 4.2 方案 B：先把 WrongQuestion 提升为 Question

保存错题或加入复习时创建 `Question`，Card 仍只关联 `Question`。

优点：

- 数据模型更接近长期题库抽象。
- Card 来源单一。

缺点：

- Phase 4 需要额外处理 WrongQuestion 和 Question 的同步、去重、字段差异。
- 当前产品没有题库页面，收益不明显。

### 4.3 方案 C：通用 ReviewItem

新增 `ReviewItem` 作为统一复习对象，Card 关联 ReviewItem，ReviewItem 再指向错题、知识点、文档片段等。

优点：

- 长期扩展性强。

缺点：

- 对当前阶段过度抽象。
- 会让 FSRS 第一轮实现变慢，难以及时验收。

结论：Phase 4.1 采用方案 A。

## 5. 数据模型

### 5.1 Card

建议在 Prisma 中把现有 `Card` 调整为：

```prisma
model Card {
  id              String     @id @default(cuid())
  userId          String
  questionId      String?    @unique
  wrongQuestionId String?    @unique
  difficulty      Float      @default(5.0)
  stability       Float      @default(0.0)
  retrievability  Float      @default(1.0)
  lastReview      DateTime?
  nextReview      DateTime   @default(now())
  reviewCount     Int        @default(0)
  lapses          Int        @default(0)
  state           CardState  @default(NEW)
  suspendedAt     DateTime?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  question      Question?      @relation(fields: [questionId], references: [id])
  wrongQuestion WrongQuestion? @relation(fields: [wrongQuestionId], references: [id], onDelete: Cascade)
  logs          ReviewLog[]

  @@index([userId, nextReview])
  @@index([userId, state])
  @@index([userId, wrongQuestionId])
}
```

约束：

- `questionId` 和 `wrongQuestionId` 至少有一个存在。
- Phase 4.1 创建的卡片只使用 `wrongQuestionId`。
- `wrongQuestionId` 唯一，避免同一道错题重复加入复习。
- `suspendedAt` 用于以后暂停复习，第一轮只读不强做 UI。

Prisma 不适合表达“二选一非空”的 check 约束，第一轮在 service 层校验。

### 5.2 ReviewLog

保留现有字段，补充 `elapsedDays` 和 `reviewDurationMs` 可选字段：

```prisma
model ReviewLog {
  id               String   @id @default(cuid())
  cardId           String
  rating           Int
  scheduledDays    Int
  elapsedDays      Int      @default(0)
  reviewDurationMs Int?
  stabilityBefore  Float
  stabilityAfter   Float
  difficultyBefore Float
  difficultyAfter  Float
  reviewedAt       DateTime @default(now())

  card Card @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@index([cardId])
  @@index([reviewedAt])
}
```

`rating` 使用 1 到 4：

- `1` Again
- `2` Hard
- `3` Good
- `4` Easy

### 5.3 ReviewTask DTO

第一轮不建 `ReviewTask` 表，API 返回派生任务：

```ts
type ReviewTask = {
  cardId: string;
  dueAt: string;
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
  reviewCount: number;
  lapses: number;
  source: 'wrongQuestion' | 'question';
  wrongQuestion?: {
    id: string;
    questionText: string;
    subject: string;
    knowledgePoints: string[];
    answer: string;
    analysis: string;
    imageUrl?: string | null;
    status: 'UNRESOLVED' | 'RESOLVED';
  };
};
```

今日任务统计：

```ts
type TodayReviewTasksResponse = {
  date: string;
  dueCount: number;
  newCount: number;
  reviewCount: number;
  learningCount: number;
  tasks: ReviewTask[];
};
```

## 6. FSRS 算法边界

### 6.1 `@repo/fsrs`

`packages/fsrs` 暴露纯函数：

```ts
type Rating = 1 | 2 | 3 | 4;

type FsrsCardState = {
  difficulty: number;
  stability: number;
  retrievability: number;
  lastReview?: Date | null;
  nextReview: Date;
  reviewCount: number;
  lapses: number;
  state: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
};

type ScheduleReviewInput = {
  card: FsrsCardState;
  rating: Rating;
  reviewedAt: Date;
};

type ScheduleReviewResult = {
  card: FsrsCardState;
  log: {
    scheduledDays: number;
    elapsedDays: number;
    stabilityBefore: number;
    stabilityAfter: number;
    difficultyBefore: number;
    difficultyAfter: number;
  };
};
```

### 6.2 第一轮算法要求

第一轮目标是稳定和可测试，不追求复杂参数调优：

- NEW 卡第一次评分后进入 LEARNING 或 REVIEW。
- Again 增加 lapses，缩短间隔，进入 RELEARNING 或 LEARNING。
- Hard 小幅增加稳定性，短间隔。
- Good 按正常间隔增长。
- Easy 更大幅增加稳定性，较长间隔。
- 所有输出必须 deterministic，测试固定时间输入和输出。

算法实现必须集中在 `packages/fsrs`，后端 service 只调用，不复制公式。

### 6.3 后续增强

如果后续要对齐更完整的 FSRS 参数，可以在 `packages/fsrs` 内替换算法实现。只要输入输出 contract 不变，前后端和数据库不需要大改。

## 7. 后端 API

新增 `ReviewModule`，路径统一使用 `/reviews`。

### 7.1 创建或复用错题卡片

```http
POST /reviews/cards/from-wrong-question
```

请求：

```ts
{
  wrongQuestionId: string;
}
```

行为：

- 校验错题属于当前用户。
- 如果已经存在卡片，返回现有卡片，`created=false`。
- 如果不存在，创建 `Card`，`nextReview=now()`，`state=NEW`。

响应：

```ts
{
  card: ReviewCardResponse;
  created: boolean;
}
```

### 7.2 获取错题对应卡片状态

```http
GET /reviews/cards/by-wrong-question/:wrongQuestionId
```

用于错题详情页展示“加入复习 / 复习中”。

如果不存在，返回 404 或 `{ card: null }`。为前端简单，推荐返回 `{ card: null }`。

### 7.3 获取今日复习任务

```http
GET /reviews/tasks/today?date=2026-06-14
```

行为：

- 默认使用服务端当前日期。
- 查询当前用户未暂停且 `nextReview <= 当日结束时间` 的卡片。
- 按 `nextReview asc` 排序。
- include `wrongQuestion`，第一轮只展示 wrong-question 来源卡片。

### 7.4 提交评分

```http
POST /reviews/cards/:cardId/rating
```

请求：

```ts
{
  rating: 1 | 2 | 3 | 4;
  reviewedAt?: string;
  reviewDurationMs?: number;
}
```

行为：

- 校验卡片属于当前用户。
- 在事务中读取 Card。
- 调用 `@repo/fsrs` 得到新 card 状态和 log 数据。
- 更新 Card。
- 写入 ReviewLog。
- 返回更新后的 Card、ReviewLog、下一次复习时间。

幂等策略：

- 第一轮不做请求幂等 key。
- 前端评分按钮点击后立即禁用，避免重复提交。
- 后续如要支持弱网重试，再加 `clientReviewId`。

## 8. 前端数据流

### 8.1 API client 和 hooks

新增：

- `apps/web/src/lib/review-api.ts`
- `apps/web/src/hooks/use-reviews.ts`

hooks：

- `useTodayReviewTasks()`
- `useCreateCardFromWrongQuestion()`
- `useWrongQuestionReviewCard(wrongQuestionId)`
- `useSubmitReviewRating()`

全部使用 TanStack Query。评分成功后 invalidate：

- `reviews.tasks.today`
- `reviews.card.byWrongQuestion`
- `wrongQuestions`

### 8.2 错题本详情页

在详情底部动作区增加复习状态：

- 无卡片：显示“加入复习”。
- 已有卡片：显示“复习中”，并展示下次复习日期。
- 创建成功后轻提示“已加入今日复习”或“已加入复习计划”。
- 创建失败时使用现有 CRUD 轻提示风格。

`WrongQuestion.status` 和 FSRS `Card.state` 分开处理：

- `WrongQuestion.status` 表示用户主观是否掌握。
- `Card.state` 表示记忆调度状态。
- 标记已掌握不自动删除 Card；评分 Easy 也不自动把错题标记为已掌握。

### 8.3 今日任务页

保留现有本地轻学习任务，但新增真实复习区：

1. 顶部统计增加“今日待复习 N 张”。
2. 任务清单上方或下方显示“今日复习”卡片列表。
3. 每张复习卡片默认显示题干、知识点、图片缩略图。
4. “查看答案”后显示答案和解析。
5. 展示四个评分按钮：Again / Hard / Good / Easy。
6. 评分成功后卡片从今日待复习列表移出或显示完成状态。

第一轮不新增独立 `/review` 路由，避免页面数量膨胀。等今日任务页承载不下时，再拆出专门复习页。

## 9. 离线和缓存策略

Phase 4.1 策略：

- 今日复习列表由服务端读取，TanStack Query 缓存。
- 加入复习、评分都要求在线。
- 网络失败时不写 Dexie mutationQueue，只显示轻提示并允许重试。
- 旧有 WrongQuestion / OCRRecord mutationQueue 不受影响。

理由：

- 评分是强顺序行为，重复提交和离线合并容易产生错误 schedule。
- 第一轮先保证服务端权威链路稳定。
- 后续可以引入 `reviewMutationQueue`，但需要 `clientReviewId` 和幂等策略配套。

## 10. 错误处理

后端错误码：

- `WRONG_QUESTION_NOT_FOUND`：错题不存在或不属于当前用户。
- `REVIEW_CARD_NOT_FOUND`：卡片不存在或不属于当前用户。
- `REVIEW_CARD_SOURCE_INVALID`：创建卡片时来源不合法。
- `REVIEW_RATING_INVALID`：评分不是 1 到 4。

前端行为：

- 404：显示“这条复习卡片不存在或已被删除”。
- 409 或重复创建：视为已加入复习，刷新卡片状态。
- 5xx / 网络错误：轻提示“操作失败，请稍后重试”。

## 11. 测试策略

### 11.1 `packages/fsrs`

覆盖：

- NEW + Again / Hard / Good / Easy 的状态变化。
- REVIEW + Again 进入 RELEARNING 并增加 lapses。
- scheduledDays 不为负数。
- nextReview 晚于 reviewedAt。
- 同输入 deterministic。

命令：

```powershell
bun --cwd packages/fsrs test
```

### 11.2 `@repo/types`

新增 `@repo/types/api/review`：

- 创建错题卡片请求。
- 今日任务响应。
- 提交评分请求。
- Card / ReviewLog response schema。

命令：

```powershell
bun --cwd packages/types typecheck
```

### 11.3 后端

覆盖：

- 只能为自己的错题创建卡片。
- 重复创建返回已有卡片。
- 今日任务只返回当前用户到期卡片。
- 提交评分会同时更新 Card 和写 ReviewLog。
- 其他用户不能读取或评分。

命令：

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
```

### 11.4 前端

覆盖：

- review-api 请求和 envelope 解析。
- 错题详情“加入复习”状态切换。
- 今日任务评分成功后刷新列表。
- 浏览器手动验收：创建卡片、今日复习、评分、刷新后状态保持。

命令：

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

## 12. 风险与应对

### 风险 1：Card 同时支持 WrongQuestion / Question 后模型变复杂

应对：Phase 4.1 只创建 wrong-question 来源卡片，Question 来源只保留 schema 扩展口，不做 UI。

### 风险 2：FSRS 算法参数不够准确

应对：第一轮保证 deterministic 和合理间隔，不把参数调优当作阶段目标。后续可以替换 `packages/fsrs` 内部实现，不改变 API 和 DB contract。

### 风险 3：今日任务页变臃肿

应对：只新增一个“今日复习”区块，不重做整页。如果卡片数量多，再进入 Phase 8 做虚拟列表或独立复习页。

### 风险 4：评分重复提交

应对：前端提交中禁用按钮，后端第一轮不做幂等。后续离线评分或自动重试时再加 `clientReviewId`。

### 风险 5：错题删除后 Card 悬挂

应对：`Card.wrongQuestionId` 关系使用 `onDelete: Cascade`。删除错题会自动删除对应复习卡和 ReviewLog。

## 13. 验收标准

- 用户能在错题详情页把错题加入复习。
- 同一错题重复加入不会创建重复卡片。
- 今日任务页能显示到期复习卡片。
- 用户能查看答案和解析后提交 Again / Hard / Good / Easy。
- 评分后 Card 的 `nextReview`、`state`、`reviewCount`、`lapses` 正确更新。
- ReviewLog 记录每次评分前后的 difficulty / stability。
- 复习数据按 `userId` 隔离，跨账号不可见。
- 刷新页面后复习状态仍以服务端数据恢复。
- 现有 WrongQuestion / OCRRecord / ChatMessage 数据流不受影响。

## 14. 推荐实施顺序

1. 实现 `packages/fsrs` 纯算法和测试。
2. 新增 `@repo/types/api/review` schema。
3. 调整 Prisma schema 和 migration，让 Card 支持 `wrongQuestionId`。
4. 新增后端 ReviewModule、Service、Controller 和测试。
5. 新增前端 review-api 和 hooks。
6. 错题详情页接入“加入复习 / 复习中”。
7. 今日任务页接入真实到期复习卡片和评分入口。
8. 浏览器手动验收移动端主链路。
9. 更新数据流、roadmap、AGENTS、CLAUDE、DEVLOG。
