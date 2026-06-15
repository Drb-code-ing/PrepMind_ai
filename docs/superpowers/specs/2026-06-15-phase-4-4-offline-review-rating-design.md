# Phase 4.4 离线评分队列与提醒策略设计

> 目标：让复习评分在弱网和离线场景下“不丢、不重、不乱”，并补齐一个轻量 in-app 提醒策略骨架，为后续真正的提醒系统打基础。

## 1. 背景

Phase 4.1 已经完成 WrongQuestion-first FSRS 复习闭环，Phase 4.2 完成学习统计，Phase 4.3 将今日复习任务迁移到持久化 `ReviewTask`。

当前评分主链路是：

```text
用户点击 Again / Hard / Good / Easy
  -> POST /review-tasks/:taskId/rating
  -> 服务端事务内更新 Card
  -> 写入 ReviewLog
  -> 完成 ReviewTask
  -> 前端刷新 /review-tasks 与 /reviews/stats
```

这条链路在在线场景下可用，但弱网下存在三个问题：

1. 用户离线点击评分时，评分会直接失败，复习结果没有本地保留。
2. 如果服务端已经完成事务但客户端没收到响应，前端再次提交会遇到“任务已完成”，用户看到的是失败。
3. 今日任务页没有待同步状态，用户不知道这次评分有没有被保存。

Phase 4.4 要补齐“评分命令”的可靠性，而不是重新设计 FSRS 算法或任务系统。

## 2. 设计目标

1. 评分请求支持服务端幂等，重复提交同一个评分命令不会重复写 `ReviewLog`。
2. 前端在网络错误、离线或 5xx 时，将评分写入 Dexie 队列。
3. 今日任务页能展示“已评分，待同步”的本地状态，避免用户重复点击。
4. 网络恢复、窗口聚焦、session 恢复时自动 flush 待同步评分。
5. flush 成功后刷新今日任务和学习统计。
6. 401 / 403、业务冲突、参数错误要进入终态错误，不无限重试。
7. 提醒策略先做 in-app 摘要，不接浏览器通知、Push、BullMQ 或系统日历。

## 3. 非目标

Phase 4.4 不做：

- 不做浏览器 Notification permission。
- 不做 PWA Push。
- 不做 BullMQ 定时提醒。
- 不做短信、邮件或系统日历。
- 不把跳过、恢复放入离线队列。
- 不做跨设备离线合并。
- 不改 `@repo/fsrs` 调度公式。
- 不把 `/stats` 改为基于 `ReviewTask` 统计；统计仍以 `ReviewLog` 为事实来源。

## 4. 方案选择

### 4.1 方案 A：只做前端离线队列

离线时把评分写入 Dexie，恢复网络后重试原接口。

优点：

- 改动较少。
- 复用当前 mutation queue 思路。

缺点：

- 无法处理“服务端成功但响应丢失”的场景。
- 重试可能因为任务已完成而失败。
- 无法保证 `ReviewLog` 不重复。

结论：不采用。

### 4.2 方案 B：服务端幂等 + 前端离线队列，推荐

评分请求增加 `clientMutationId`。服务端以该 id 识别同一次评分命令；前端离线时将同一个 `clientMutationId` 保存在 Dexie 队列，flush 时重用。

优点：

- 能覆盖响应丢失后的安全重试。
- 本地队列和服务端事务边界清晰。
- 不影响现有 `ReviewTask` 生命周期。
- 后续可以平滑扩展到更通用的 command/outbox。

缺点：

- 需要 Prisma migration。
- 需要扩展共享 API contract。
- 今日任务页需要展示待同步状态。

结论：Phase 4.4 采用方案 B。

### 4.3 方案 C：服务端 command/outbox 表

新增统一 command 表，所有离线操作都通过 command id 执行。

优点：

- 适合生产级审计和跨端合并。
- 可以统一 WrongQuestion、OCRRecord、ReviewTask 等 mutation。

缺点：

- 对当前阶段过重。
- 会重构现有 mutationQueue 和 API 边界。

结论：保留为后续工程化方向，不在 Phase 4.4 实施。

## 5. 服务端幂等设计

### 5.1 API contract

扩展 `ReviewRatingRequest`：

```ts
type ReviewRatingRequest = {
  rating: 1 | 2 | 3 | 4;
  reviewedAt?: string;
  reviewDurationMs?: number;
  clientMutationId?: string;
};
```

约束：

- `clientMutationId` 是客户端生成的 UUID 字符串。
- 在线即时评分也应生成 `clientMutationId`。
- 旧客户端不传 `clientMutationId` 时，服务端保持当前非幂等行为。

### 5.2 Prisma 变更

给 `ReviewLog` 增加可空唯一字段：

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
  clientMutationId String?  @unique

  card       Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)
  reviewTask ReviewTask?

  @@index([cardId])
  @@index([reviewedAt])
}
```

PostgreSQL 允许多个 `NULL` 通过唯一索引，因此旧数据不受影响。

### 5.3 幂等流程

`POST /review-tasks/:taskId/rating` 的服务端逻辑调整为：

```text
收到 rating 请求
  -> 如果 clientMutationId 存在，先按 clientMutationId + 当前 userId 查询 ReviewLog
  -> 若找到已完成记录：
       - 找到关联 ReviewTask
       - 确认 taskId 与当前请求一致
       - 返回已有 task/card/log
  -> 若未找到：
       - 查询当前 userId 下的 ReviewTask
       - 要求任务为 PENDING
       - 运行 FSRS
       - 写 ReviewLog(clientMutationId)
       - 更新 Card
       - 完成 ReviewTask(reviewLogId)
       - 返回 task/card/log
```

冲突规则：

- 同一个 `clientMutationId` 命中当前用户的其他 `taskId`：返回 `REVIEW_RATING_IDEMPOTENCY_CONFLICT`。
- 任务已完成且 `reviewLogId` 对应的 `clientMutationId` 与本次不同：返回 `REVIEW_TASK_NOT_PENDING`。
- 任务属于其他用户：返回 `REVIEW_TASK_NOT_FOUND`。
- `clientMutationId` 唯一约束冲突但查询不到当前用户记录：返回 `REVIEW_RATING_IDEMPOTENCY_CONFLICT`。

### 5.4 兼容旧 Review API

旧接口 `/reviews/cards/:cardId/rating` 可以继续保留当前行为。Phase 4.4 的离线队列只接入 `/review-tasks/:taskId/rating`，因为今日复习任务已经迁移到 `ReviewTask`。

## 6. 前端离线评分队列

### 6.1 Dexie schema

现有 `mutationQueue` 继续复用，但扩展枚举：

```ts
export type MutationEntity = 'wrongQuestion' | 'ocrRecord' | 'reviewTask';
export type MutationOperation = 'create' | 'update' | 'delete' | 'rating';
```

新增 payload：

```ts
type ReviewTaskRatingPayload = {
  taskId: string;
  request: {
    rating: 1 | 2 | 3 | 4;
    reviewedAt: string;
    reviewDurationMs?: number;
    clientMutationId: string;
  };
  taskSnapshot: ReviewTaskItemResponse;
};
```

`dedupeKey` 使用：

```text
{userId}:reviewTask:{taskId}:rating
```

同一任务只保留一条待同步评分。用户重复点击不会生成多条队列记录。

### 6.2 入队规则

点击评分时：

```text
生成 clientMutationId
  -> 调用 submitRating
  -> 成功：照常刷新查询
  -> 失败：
      如果是网络错误、离线、timeout 或 5xx：
        写入 mutationQueue
        UI 标记 task 为 pending sync
      如果是 401 / 403：
        不入队，提示重新登录
      如果是 4xx 业务错误：
        不入队，提示具体错误
```

本地状态不直接更新 Card 或 ReviewLog。原因是 FSRS 调度结果必须由服务端事务计算并确认。前端只展示“评分命令已暂存”，不伪造已完成统计。

### 6.3 UI 状态

今日任务页展示三类状态：

1. `PENDING`：服务端待复习任务，可查看答案、评分、跳过。
2. `LOCAL_RATING_PENDING`：用户已选择评分，但等待同步。
3. `COMPLETED` / `SKIPPED`：服务端已确认状态。

`LOCAL_RATING_PENDING` 展示文案：

```text
已选择：掌握，等待同步
```

按钮策略：

- 评分按钮禁用。
- 跳过按钮禁用。
- 查看答案可以继续展开。
- 提供一个轻量入口“重试同步”，触发 `flushMutationQueue()`。

顶部摘要：

```text
有 1 条复习评分待同步
```

该提示只基于当前用户 `mutationQueue` 中 `entity=reviewTask`、`operation=rating` 的记录。

### 6.4 Flush 规则

复用当前触发点：

- session 恢复后。
- 浏览器 online。
- window focus。
- 用户点击“重试同步”。

flush 成功：

```text
删除 mutationQueue 记录
  -> invalidate reviewTaskQueryKeys.all
  -> invalidate reviewQueryKeys.all
  -> 今日任务页显示已完成摘要
```

flush 可重试失败：

- 状态保持 `failed`。
- 记录 `lastError`。
- 使用现有退避策略 `10s -> 30s -> 120s`。

flush 终态失败：

- 401 / 403：提示重新登录。
- `REVIEW_TASK_NOT_PENDING`：查询任务最新状态；如果任务已完成，删除本地队列并刷新；如果仍不一致，保留错误提示。
- `REVIEW_RATING_IDEMPOTENCY_CONFLICT`：保留错误提示，不自动覆盖。

## 7. In-app 提醒策略骨架

Phase 4.4 只做应用内提醒摘要，不做系统通知。

### 7.1 今日任务页提醒

今日任务页顶部新增复习提醒摘要：

```text
今日待复习：3 张
已逾期：1 张
下一张：14:30
待同步评分：1 条
```

数据来源：

- 今日待复习：`/review-tasks/today.pendingCount`。
- 已逾期：返回任务中 `status=PENDING` 且 `dueAt < now` 的数量，前端可先计算。
- 下一张：返回任务中最近的 pending `dueAt`，前端可先计算。
- 待同步评分：Dexie `mutationQueue`。

### 7.2 偏好结构预留

可以预留本地偏好 key：

```text
prepmind-review-reminder:{userId}
```

结构：

```ts
type ReviewReminderPreference = {
  inAppEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
};
```

Phase 4.4 可以只提供默认值和读取函数，不必须做设置 UI。系统级通知和提醒时间策略放到 Phase 4.5。

## 8. 数据流

```text
用户点击评分
  -> 生成 clientMutationId
  -> POST /review-tasks/:taskId/rating
  -> 成功：服务端事务完成，前端刷新数据
  -> 网络失败：
      -> enqueue mutationQueue(reviewTask/rating)
      -> 今日任务显示待同步评分
      -> online/focus/session 恢复触发 flush
      -> flush 使用同一 clientMutationId
      -> 服务端幂等返回已有或新完成结果
      -> 删除本地队列并刷新今日任务和统计
```

## 9. 测试策略

### 9.1 共享类型

覆盖：

- `ReviewRatingRequest` 接受合法 `clientMutationId`。
- 非 UUID 或空字符串被拒绝。
- 不传 `clientMutationId` 仍兼容。

### 9.2 后端单元测试

覆盖：

- 首次评分写入 `ReviewLog.clientMutationId`。
- 同一个 `clientMutationId` 重试返回已有结果，不重复创建 `ReviewLog`。
- 同一个 `clientMutationId` 用于不同 `taskId` 返回冲突。
- 任务已完成且 mutation id 不同返回 `REVIEW_TASK_NOT_PENDING`。
- 其他用户无法通过 mutation id 读取任务结果。

### 9.3 后端 e2e

覆盖：

- `POST /review-tasks/:taskId/rating` 首次成功。
- 同一请求重放成功且 `ReviewLog` 数量仍为 1。
- 换一个 `clientMutationId` 重评同一任务失败。

### 9.4 前端单元测试

覆盖：

- `createMutationQueueItem()` 支持 `reviewTask/rating`。
- 同一 `dedupeKey` 的评分队列只保留一条。
- `flushMutationItem()` 能调用 `reviewTaskApi.submitRating()`。
- 401 / 403 终态失败不重试。
- 网络错误和 5xx 进入重试。
- 今日任务 pending sync 分组和提醒摘要计算正确。

### 9.5 浏览器验收

手动验收：

1. 打开今日任务页，找到一张待复习卡。
2. 模拟离线或断开后端。
3. 点击“掌握”。
4. 页面显示“已选择：掌握，等待同步”。
5. 恢复后端。
6. 触发 focus 或点击重试同步。
7. 页面刷新为已完成，统计页复习次数增加。
8. 检查数据库只生成一条 `ReviewLog`。

## 10. 风险与取舍

- 风险：本地显示“待同步评分”容易被误解为已经完成。解决：文案明确写“等待同步”，统计不提前增加。
- 风险：服务端幂等查询如果只按 `clientMutationId` 查，可能泄露跨用户状态。解决：查询必须通过 `ReviewLog.card.userId` 约束当前用户。
- 风险：旧接口 `/reviews/cards/:cardId/rating` 与新接口行为不一致。解决：离线队列只接入 ReviewTask 主链路，旧接口保持兼容。
- 风险：通知需求扩散。解决：Phase 4.4 只做 in-app 摘要，浏览器通知和定时提醒进入 Phase 4.5。

## 11. 验收标准

Phase 4.4 完成时必须满足：

- 离线评分不会丢失，刷新页面后仍能看到待同步状态。
- 网络恢复后评分自动同步。
- 同一个 `clientMutationId` 重试不会重复写 `ReviewLog`。
- 服务端成功但客户端响应丢失时，重试能拿回已有结果。
- 今日任务和学习统计在同步成功后刷新。
- 不可重试错误不会无限重试。
- 文档更新 `docs/data-flow.md`、`docs/roadmap.md`、`AGENTS.md`、`CLAUDE.md`、`DEVLOG.md`。

## 12. 下一步实施顺序

1. 扩展 shared type：`ReviewRatingRequest.clientMutationId`。
2. 增加 Prisma migration：`ReviewLog.clientMutationId`。
3. 改造后端 ReviewTask rating 幂等逻辑。
4. 扩展前端 mutation queue 类型与 flush。
5. 今日任务页展示待同步评分和提醒摘要。
6. 补齐测试和文档。
