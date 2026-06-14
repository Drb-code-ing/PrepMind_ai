# Phase 4.3 ReviewTask 数据流设计

> 目标：在 Phase 4.1 的 FSRS 复习闭环和 Phase 4.2 的学习统计基础上，将今日复习任务从“实时派生视图”升级为服务端持久化任务流，为跳过、恢复、任务完成记录、后续提醒和 PlannerAgent 打基础。

## 1. 背景

当前复习链路已经具备：

- `Card` 表记录 FSRS 卡片状态、下次复习时间和错题来源。
- `ReviewLog` 表记录每次 Again / Hard / Good / Easy 评分。
- `/reviews/tasks/today` 会实时查询 `Card.nextReview <= 当天结束时间` 的到期卡片，并返回今日复习卡。
- 今日任务页可以查看答案并提交评分，评分成功后更新 `Card` 并写入 `ReviewLog`。
- `/stats` 已通过 `/reviews/stats` 和 `/reviews/logs` 读取复习统计和最近记录。

当前缺口是：今日复习任务本身没有持久化身份。系统只能知道“某张卡当前到期”，但不能稳定表达：

- 今天这张卡是否已经被安排过。
- 用户是否跳过过这条任务。
- 用户误操作后是否可以恢复任务。
- 某条今日任务最终对应哪次 `ReviewLog`。
- 后续 PlannerAgent 或提醒系统应该基于哪条任务记录工作。

Phase 4.3 通过新增 `ReviewTask` 表补齐这个任务层。

## 2. 设计目标

1. 新增服务端持久化 `ReviewTask` 数据流。
2. 今日任务页的复习任务来源从 `/reviews/tasks/today` 迁移到 `/review-tasks/today`。
3. 打开今日任务页时自动生成当前日期的到期复习任务。
4. 同一张卡同一天只生成一条任务。
5. 评分成功后将任务标记为 `COMPLETED`，并关联对应 `ReviewLog`。
6. 支持跳过任务和恢复任务，前端提供明确反馈。
7. 保持 `Card` / `ReviewLog` 仍是 FSRS 调度和统计的权威来源。
8. 不破坏 Phase 4.2 `/stats` 的统计口径。

## 3. 非目标

Phase 4.3 不做：

- 不做离线评分 mutation queue。
- 不做系统通知、浏览器 push 或日历提醒。
- 不做 AI 自动生成复习计划。
- 不做任务锁定、任务补偿日历、成就系统。
- 不迁移今日任务里的本地静态手账项，只迁移“复习任务”。
- 不改变 `@repo/fsrs` 调度算法。
- 不把 `/stats` 改为基于 `ReviewTask` 统计；Phase 4.2 仍以 `ReviewLog` 为复习事实来源。

## 4. 方案选择

### 4.1 方案 A：继续增强派生视图

继续让 `/reviews/tasks/today` 直接查 `Card`，只在返回结构里增加更多字段。

优点：

- 改动最少。
- 不需要 Prisma migration。
- 当前今日任务页容易继续复用。

缺点：

- 仍然没有任务身份，无法表达跳过、恢复、完成关联。
- 后续离线评分、提醒、PlannerAgent 都缺少任务记录。
- 越往后越容易把状态散落在前端和 `Card` 上。

### 4.2 方案 B：新增持久化 `ReviewTask` 表，推荐

新增 `ReviewTask` 表，将“今天安排了哪张卡”持久化。今日任务页读取任务，评分、跳过和恢复都围绕 task 操作。

优点：

- 数据模型更接近真实产品。
- 能清晰表达任务生命周期。
- 后续离线评分队列、提醒、AI 计划都可以复用。
- 不改变 `Card` / `ReviewLog` 的 FSRS 权威边界。

缺点：

- 需要新增 migration、共享 contract、后端模块和前端 hooks。
- 今日任务页要调整数据流。

### 4.3 方案 C：先做离线评分队列

不新增任务表，先把评分失败写入 Dexie mutationQueue，解决弱网下评分丢失问题。

优点：

- 能直接改善弱网体验。
- 范围相对独立。

缺点：

- 离线评分队列仍然缺少稳定任务身份。
- 后续做跳过、恢复、提醒时还要回头补任务表。

结论：Phase 4.3 采用方案 B。

## 5. 数据模型

新增 Prisma model：

```prisma
model ReviewTask {
  id            String           @id @default(cuid())
  userId        String
  cardId        String
  reviewLogId   String?          @unique
  scheduledDate String
  dueAt         DateTime
  status        ReviewTaskStatus @default(PENDING)
  source        ReviewTaskSource @default(FSRS)
  completedAt   DateTime?
  skippedAt     DateTime?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  card      Card       @relation(fields: [cardId], references: [id], onDelete: Cascade)
  reviewLog ReviewLog? @relation(fields: [reviewLogId], references: [id], onDelete: SetNull)

  @@unique([cardId, scheduledDate])
  @@index([userId, scheduledDate, status])
  @@index([userId, status, dueAt])
}

enum ReviewTaskStatus {
  PENDING
  COMPLETED
  SKIPPED
  CANCELLED
}

enum ReviewTaskSource {
  FSRS
  MANUAL
  PLANNER
}
```

字段说明：

- `scheduledDate` 使用用户本地日期字符串 `YYYY-MM-DD`，用于“某天的任务”。
- `dueAt` 保存生成任务时的 `Card.nextReview` 快照。
- `status` 表达任务生命周期，不替代 `Card.state`。
- `reviewLogId` 在评分完成后关联本次 `ReviewLog`。
- `source` 先默认 `FSRS`，为后续手动任务和 PlannerAgent 预留。

约束说明：

- `@@unique([cardId, scheduledDate])` 防止同一张卡同一天重复生成任务。
- 所有查询都必须带当前 `userId`。
- `ReviewTask` 删除随用户和卡片级联。

## 6. 任务生成策略

Phase 4.3 采用“懒生成 + 幂等补齐”。

流程：

```text
用户打开今日任务页
  -> GET /review-tasks/today?date=YYYY-MM-DD&timezoneOffsetMinutes=-480
  -> 后端计算用户本地当天 UTC 边界
  -> 查询未暂停且 Card.nextReview <= 当天结束时间的卡片
  -> 对缺少当天 ReviewTask 的卡片批量创建 PENDING 任务
  -> 返回当天任务列表
```

生成规则：

- 只为 `suspendedAt = null` 的卡片生成任务。
- 到期边界使用用户本地日期，避免跨时区造成“今天/明天”错位。
- 已存在 `PENDING` / `COMPLETED` / `SKIPPED` / `CANCELLED` 的同日任务都不重复创建。
- 任务创建失败如果遇到唯一约束冲突，按“已存在”处理并重新查询。

不使用定时任务的原因：

- 当前 Phase 4 还没有引入 BullMQ 调度任务。
- 懒生成足够支撑单用户移动端体验。
- 后续 Phase 7 可以增加每日预生成 job，但不改变 API contract。

## 7. 服务端 API

新增 `ReviewTasksModule`，不要继续扩大 `ReviewsController`。

### 7.1 `GET /review-tasks/today`

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | 服务端当前日期 | 用户本地任务日期 |
| `timezoneOffsetMinutes` | number | `0` | 浏览器 `Date.getTimezoneOffset()` |
| `includeCompleted` | boolean | `true` | 是否返回已完成任务 |

响应结构：

```ts
type ReviewTaskTodayResponse = {
  date: string;
  pendingCount: number;
  completedCount: number;
  skippedCount: number;
  tasks: ReviewTaskItem[];
};
```

`ReviewTaskItem` 包含：

- task 基础字段：`id`、`status`、`source`、`scheduledDate`、`dueAt`、`completedAt`、`skippedAt`。
- card 摘要：`cardId`、`state`、`reviewCount`、`lapses`、`nextReview`。
- wrongQuestion 摘要：复用当前今日复习卡展示需要的题干、答案、解析、学科、知识点、图片。

### 7.2 `GET /review-tasks`

用于后续历史任务列表和调试。Phase 4.3 前端可以暂不接完整页面，但 API 要提供基础分页。

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | number | `1` | 页码 |
| `pageSize` | number | `20` | 最大 50 |
| `date` | `YYYY-MM-DD` | 可选 | 指定日期 |
| `status` | task status | 可选 | 按状态筛选 |

### 7.3 `POST /review-tasks/:taskId/rating`

请求体复用 `ReviewRatingRequest`：

```ts
{
  rating: 1 | 2 | 3 | 4;
  reviewedAt?: string;
  reviewDurationMs?: number;
}
```

事务内完成：

```text
校验 ReviewTask 属于当前 userId
  -> 校验任务状态是 PENDING
  -> 读取并校验关联 Card 属于当前 userId
  -> 调用 @repo/fsrs scheduleReview
  -> 更新 Card
  -> 创建 ReviewLog
  -> 更新 ReviewTask.status = COMPLETED
  -> 写入 reviewLogId / completedAt
```

错误语义：

- 任务不存在或不属于当前用户：`REVIEW_TASK_NOT_FOUND`。
- 已完成任务重复评分：`REVIEW_TASK_ALREADY_COMPLETED`。
- 已跳过任务评分：`REVIEW_TASK_NOT_PENDING`。
- 卡片不存在或不属于当前用户：`REVIEW_CARD_NOT_FOUND`。

### 7.4 `POST /review-tasks/:taskId/skip`

将 `PENDING` 任务标记为 `SKIPPED`。

规则：

- 不更新 `Card`。
- 不写 `ReviewLog`。
- 写入 `skippedAt`。
- 如果任务已完成，返回 `REVIEW_TASK_ALREADY_COMPLETED`。

### 7.5 `POST /review-tasks/:taskId/reopen`

将 `SKIPPED` 任务恢复为 `PENDING`。

规则：

- 只允许恢复 `SKIPPED`。
- 清空 `skippedAt`。
- 不更新 `Card`。
- 不影响 `ReviewLog`。

## 8. 与现有 Reviews API 的关系

保留现有 `/reviews/cards/:cardId/rating`：

- 作为底层兼容接口。
- 错题详情或临时调试仍可直接按卡片评分。
- 不主动创建或更新 `ReviewTask`。

今日任务页迁移到 `/review-tasks/:taskId/rating`：

- 用户从任务入口评分时，必须产生任务完成记录。
- 统计仍由 `ReviewLog` 驱动，不依赖 `ReviewTask`。
- 后续如果需要统计“任务完成率”，再基于 `ReviewTask` 新增独立 stats 字段。

## 9. 共享类型

在 `@repo/types/api/review-task` 新增：

- `reviewTaskStatusSchema`
- `reviewTaskSourceSchema`
- `reviewTaskItemSchema`
- `reviewTaskTodayQuerySchema`
- `reviewTaskTodayResponseSchema`
- `reviewTaskListQuerySchema`
- `reviewTaskListResponseSchema`
- `reviewTaskRatingResponseSchema`
- `reviewTaskActionResponseSchema`

类型命名：

- `ReviewTaskStatus`
- `ReviewTaskSource`
- `ReviewTaskItemResponse`
- `ReviewTaskTodayQuery`
- `ReviewTaskTodayResponse`
- `ReviewTaskListQuery`
- `ReviewTaskListResponse`
- `ReviewTaskRatingResponse`
- `ReviewTaskActionResponse`

## 10. 前端数据流

新增 API client：

```ts
reviewTaskApi.getToday(accessToken, query)
reviewTaskApi.list(accessToken, query)
reviewTaskApi.submitRating(accessToken, taskId, request)
reviewTaskApi.skip(accessToken, taskId)
reviewTaskApi.reopen(accessToken, taskId)
```

新增 hooks：

```ts
useTodayReviewTaskList(date)
useReviewTaskList(query)
useSubmitReviewTaskRating()
useSkipReviewTask()
useReopenReviewTask()
```

今日任务页调整：

- 复习任务区读取 `useTodayReviewTaskList(dateKey)`。
- 待复习卡展示 `PENDING` 任务。
- 已完成任务可以显示在“今日已完成”轻量区域，避免用户评分后卡片突然消失得过于突兀。
- 跳过任务后显示轻提示，并移动到“已跳过”区域或折叠摘要。
- 恢复任务后回到待复习区域。

保留当前本地静态手账：

- 非复习类 `TODAY_TASKS` 仍使用 localStorage。
- ReviewTask 只负责复习卡，不负责“拍照识题”“整理错题”等轻任务。

## 11. 错误处理

- 未登录：由 `AuthGuard` 跳转登录。
- 任务不存在：前端提示“任务不存在或已被更新”，并刷新今日任务列表。
- 重复评分：提示“这条复习任务已经完成”，刷新任务列表。
- 跳过已完成任务：提示“已完成的任务不能跳过”。
- 网络失败：保持按钮可重试，不做离线队列。
- 列表读取失败：显示内联错误和重试按钮。

## 12. 测试计划

### 12.1 共享类型测试

- `ReviewTaskTodayResponse` 能校验带错题摘要的任务。
- `ReviewTaskStatus` 只接受 `PENDING` / `COMPLETED` / `SKIPPED` / `CANCELLED`。
- query schema 能 coerce page、pageSize、timezoneOffsetMinutes。

### 12.2 后端单元测试

覆盖 `ReviewTasksService`：

- `getToday` 会为到期卡片生成当天任务。
- 同一张卡同一天重复调用不会重复生成。
- `submitRating` 会更新 Card、创建 ReviewLog、完成 ReviewTask。
- `skip` 只更新任务，不写 ReviewLog。
- `reopen` 只允许恢复 skipped 任务。
- 所有查询和操作都按当前 userId 隔离。

### 12.3 后端 e2e

覆盖：

- 注册用户、创建错题、加入复习计划、打开今日任务自动生成 ReviewTask。
- 对 task 提交评分后，task 变为 `COMPLETED`，并关联 `reviewLogId`。
- 另一个用户看不到该任务。
- 跳过和恢复链路正常。
- `/stats` 仍能通过 `ReviewLog` 看到评分结果。

### 12.4 前端测试

- `review-task-api` 请求路径、schema parsing。
- 今日任务 helper：pending/completed/skipped 分组。
- 评分反馈、跳过反馈、恢复反馈文案。

### 12.5 浏览器验收

1. 注册 smoke 账号。
2. 创建错题并加入复习计划。
3. 打开 `/today`，确认生成复习任务。
4. 展开答案并提交“掌握”，确认任务完成反馈和列表变化。
5. 创建第二张任务，验证跳过和恢复。
6. 打开 `/stats`，确认复习统计仍正常。
7. 删除 smoke 账号。

## 13. 验收标准

Phase 4.3 完成时必须满足：

- 数据库存在 `ReviewTask` 表和 migration。
- 今日任务页读取 `/review-tasks/today`。
- 打开今日任务页会幂等生成当天到期复习任务。
- 同一张卡同一天不会重复生成任务。
- task 评分成功后 `ReviewTask.status = COMPLETED`，并关联 `ReviewLog`。
- 跳过和恢复有明确 UI 反馈。
- `/stats` 不回退，仍能展示复习结果。
- 后端 unit/e2e 覆盖生成、评分、跳过、恢复和用户隔离。
- 前端 lint/build 通过。
- 浏览器核心链路验收通过。

## 14. 后续衔接

Phase 4.3 完成后可以继续：

1. Phase 4.4：离线评分队列，将 task rating 失败写入 Dexie mutationQueue。
2. Phase 4.5：复习提醒策略，结合 PWA notification 或轻量站内提醒。
3. Phase 6：PlannerAgent 基于 ReviewTask / ReviewLog / stats 生成学习计划。
4. Phase 7：BullMQ 每日预生成 ReviewTask，替代纯懒生成。
