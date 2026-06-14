# Phase 4.2 学习统计设计

> 目标：在 Phase 4.1 已完成“错题 -> 复习卡 -> 今日复习 -> 评分 -> 下次复习”的基础上，新增独立学习统计页和服务端统计 API，让用户能看到复习成果、评分分布、复习趋势和最近记录。

## 1. 背景

Phase 4.1 已经落地：

- `Card` / `ReviewLog` 以 PostgreSQL 为权威来源。
- 错题详情可以加入复习计划。
- 今日任务页可以读取到期复习卡，并提交 Again / Hard / Good / Easy 评分。
- 评分会更新 `Card` 并写入 `ReviewLog`。

当前缺口是：用户完成复习后看不到长期反馈。今日任务页只告诉用户“今天要做什么”，错题本只负责具体题目管理，还缺少一个回答“我最近复习得怎么样”的模块。

Phase 4.2 通过独立 `/stats` 页面补齐这个产品闭环，同时把统计口径沉淀到 NestJS Review API，避免前端直接拼统计逻辑。

## 2. 设计目标

1. 新增独立“学习统计”页面，路由为 `/stats`。
2. 新增服务端 Review stats/logs API，统计口径统一在后端。
3. 展示最近 7 天和 30 天的复习表现。
4. 展示评分分布、卡片状态分布、连续复习天数和最近复习记录。
5. 保持移动端优先、轻量数据手账风格，不引入复杂图表库。
6. 为后续 Agent 学习规划提供可复用的数据接口。

## 3. 非目标

Phase 4.2 不做：

- 不新增持久化 `ReviewTask` 表。
- 不做 AI 自动总结或自动学习建议。
- 不做 RAG 知识库接入。
- 不做月历热力图、成就系统、排行榜。
- 不做离线评分 mutation queue。
- 不引入 ECharts、Recharts 等图表库。
- 不改变 Phase 4.1 的 FSRS 调度算法。

## 4. 方案选择

### 4.1 方案 A：前端直接用现有 Review API 拼统计

前端读取今日任务和最近记录，再自行计算统计。

优点：

- 后端改动少。
- 第一屏能很快做出来。

缺点：

- 统计口径分散在前端。
- 后续 Agent、移动端或其他页面无法复用。
- 前端需要拉大量原始数据，分页和性能边界不好控制。

### 4.2 方案 B：新增服务端统计 API，推荐

后端基于 `Card`、`ReviewLog`、`WrongQuestion` 聚合统计；前端只负责展示。

优点：

- 统计口径清晰，后续可复用。
- 不需要新增数据库表。
- 能和现有 `ReviewsModule`、`@repo/types/api/review` 自然衔接。
- 适合后续 Agent 根据统计结果生成学习计划。

缺点：

- 需要新增共享 schema、后端 service 方法、前端 API client 和 hooks。

### 4.3 方案 C：统计页同时正式化 ReviewTask 数据流

新增持久化任务表，把今日任务、复习任务和统计一起做完整。

优点：

- 长期模型更完整。
- 可以支持任务锁定、计划回放、日历统计。

缺点：

- 范围过大，会把 Phase 4.2 拖成 Phase 4.3。
- 当前最急需的是复习反馈，不是完整计划系统。

结论：Phase 4.2 采用方案 B。

## 5. 后端 API

### 5.1 `GET /reviews/stats`

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `range` | `7d \| 30d` | `7d` | 统计窗口 |
| `endDate` | `YYYY-MM-DD` | 服务端当前日期 | 统计结束日期 |
| `timezoneOffsetMinutes` | number | `0` | 浏览器 `Date.getTimezoneOffset()`，用于按用户本地日期分桶 |

响应结构：

```ts
type ReviewStatsResponse = {
  range: '7d' | '30d';
  fromDate: string;
  toDate: string;
  totalReviews: number;
  reviewedCards: number;
  dueCards: number;
  accuracyLikeRate: number;
  streakDays: number;
  ratingCounts: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  stateCounts: {
    NEW: number;
    LEARNING: number;
    REVIEW: number;
    RELEARNING: number;
  };
  dailyReviews: Array<{
    date: string;
    count: number;
  }>;
};
```

统计口径：

- `totalReviews`：窗口内 `ReviewLog` 条数。
- `reviewedCards`：窗口内 distinct `cardId` 数。
- `dueCards`：当前仍到期的未暂停卡片数量，条件为 `Card.nextReview <= now` 且 `suspendedAt = null`。
- `accuracyLikeRate`：`(rating=3 + rating=4) / totalReviews`，无记录时为 `0`。
- `streakDays`：从 `toDate` 往前计算连续有复习记录的天数。
- `ratingCounts`：窗口内四档评分分布。
- `stateCounts`：当前未暂停卡片状态分布，不受 range 限制。
- `dailyReviews`：按用户本地日期分桶，长度等于 range 天数，无记录日期补 `0`。

### 5.2 `GET /reviews/logs`

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | number | `1` | 页码 |
| `pageSize` | number | `20` | 每页数量，最大 50 |

响应结构：

```ts
type ReviewLogListResponse = {
  items: Array<{
    id: string;
    cardId: string;
    rating: 1 | 2 | 3 | 4;
    scheduledDays: number;
    elapsedDays: number;
    reviewDurationMs: number | null;
    reviewedAt: string;
    nextReview: string;
    currentCardState: 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';
    wrongQuestion?: {
      id: string;
      questionText: string;
      subject: string;
      knowledgePoints: string[];
      status: 'UNRESOLVED' | 'RESOLVED';
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
};
```

注意：`ReviewLog` 不保存评分后的历史卡片状态，所以列表中返回 `currentCardState`，表示当前卡片状态，不命名为 `stateAfter`，避免误导。

## 6. 后端实现边界

### 6.1 数据来源

使用现有模型：

- `Card`
- `ReviewLog`
- `WrongQuestion`

`ReviewLog` 本身没有 `userId`，所有查询必须通过 `card.userId` 过滤：

```ts
where: {
  card: {
    userId,
  },
}
```

### 6.2 日期与时区

前端使用 `getLocalDateKey()` 生成 `endDate`，并通过 `new Date().getTimezoneOffset()` 传入 `timezoneOffsetMinutes`。

后端按用户本地日期计算窗口边界：

- `toDate` 当天 23:59:59.999 local time。
- `fromDate` 为 `rangeDays - 1` 天前的 00:00:00.000 local time。
- 存储和比较仍使用 UTC `Date`。

这样统计页不会在中国时区午夜前后出现“今天记录跑到昨天/明天”的体验问题。

### 6.3 性能

Phase 4.2 数据量较小，可以先用 Prisma 聚合和普通查询完成：

- `ReviewLog.reviewedAt` 已有索引。
- `Card` 已有 `@@index([userId, nextReview])` 和 `@@index([userId, state])`。
- `ReviewLog` 查询通过 `card.userId` join 过滤。

如果后续 ReviewLog 规模变大，再考虑新增复合索引或把 `userId` 冗余到 `ReviewLog`。Phase 4.2 不做冗余字段迁移。

## 7. 共享类型

在 `@repo/types/api/review` 中新增：

- `reviewStatsRangeSchema`
- `reviewStatsQuerySchema`
- `reviewStatsResponseSchema`
- `reviewLogListQuerySchema`
- `reviewLogListResponseSchema`

类型命名：

- `ReviewStatsRange`
- `ReviewStatsQuery`
- `ReviewStatsResponse`
- `ReviewLogListQuery`
- `ReviewLogListResponse`

前后端都使用这些 schema 校验运行时数据。

## 8. 前端页面

### 8.1 路由

新增：

```text
apps/web/src/app/(main)/stats/page.tsx
```

页面标题：学习统计。

### 8.2 页面模块

页面从上到下：

1. 顶部导航：返回聊天、标题、轻量说明。
2. 总览卡片：复习次数、掌握率、连续复习、当前待复习。
3. 范围切换：`7 天` / `30 天` segmented control。
4. 复习趋势：CSS 条形图展示 `dailyReviews`。
5. 评分分布：四档评分的横向条。
6. 卡片状态：新卡、学习中、复习中、重学中。
7. 最近复习记录：分页列表，展示题目摘要、评分、复习时间、下次复习时间。

### 8.3 视觉原则

- 沿用 Phase 2.5 的亮色软萌日漫风。
- 统计页更偏“数据手账”，不要像企业后台。
- 图表使用 CSS 条形图和进度条，不引入图表库。
- 移动端优先，所有触摸目标不小于 44px。
- 空状态要解释“完成一次复习后这里会出现统计”，不要显示冷冰冰的空表格。

### 8.4 导航入口

新增入口：

- 主侧边栏增加 `学习统计`。
- 今日任务页底部快捷入口增加 `学习统计`。

如果侧边栏当前导航结构较集中，新增入口应复用现有 nav item 样式，不单独做新的导航系统。

## 9. 前端数据流

新增 API client：

```ts
reviewApi.getStats(accessToken, query)
reviewApi.getLogs(accessToken, query)
```

新增 hooks：

```ts
useReviewStats(range)
useReviewLogs(page, pageSize)
```

TanStack Query key：

```ts
['reviews', 'stats', range, endDate, timezoneOffsetMinutes]
['reviews', 'logs', page, pageSize]
```

评分提交成功后继续 `invalidateQueries({ queryKey: reviewQueryKeys.all })`，让 `/today` 和 `/stats` 都能刷新。

## 10. 错误处理

- 未登录：由 `AuthGuard` 跳转登录，不在统计页重复处理。
- stats/logs 读取失败：展示内联错误卡片和重试按钮。
- 空数据：展示空状态，不作为错误。
- API 参数错误：后端返回 `VALIDATION_ERROR`，前端显示“统计范围无效，请刷新重试”。
- logs 分页越界：返回空列表和正确 total，不报错。

## 11. 测试计划

### 11.1 共享类型测试

新增或扩展 `packages/types` review schema 测试：

- stats response 能校验完整 payload。
- logs response 能校验带 wrongQuestion 的记录。
- `range` 只允许 `7d` / `30d`。

### 11.2 后端单元测试

覆盖 `ReviewsService`：

- `getStats` 按当前用户隔离。
- `getStats` 正确计算 ratingCounts。
- `getStats` 正确补齐 dailyReviews 空日期。
- `getStats` 无记录时 `accuracyLikeRate = 0`。
- `getLogs` 返回最近记录和错题摘要。

### 11.3 后端 e2e

覆盖：

- 注册/登录后创建错题、创建复习卡、提交评分。
- `GET /reviews/stats?range=7d` 返回评分统计。
- `GET /reviews/logs` 返回当前用户记录。
- 另一个用户不能看到这些统计。

### 11.4 前端测试

- `review-api` 测试 stats/logs 请求路径和 schema parsing。
- `/stats` 的轻量渲染逻辑可通过 helper 测试覆盖标签、比例、空态文案。

### 11.5 浏览器验收

手动或 Playwright 验收：

1. 注册测试账号。
2. 创建错题和复习卡。
3. 在 `/today` 完成评分。
4. 打开 `/stats`。
5. 确认总览、趋势、评分分布、最近记录出现。
6. 切换 7 天 / 30 天，数据正常刷新。
7. 清理测试账号。

## 12. 验收标准

Phase 4.2 完成时必须满足：

- `/stats` 页面存在并可从导航进入。
- Review stats/logs API 均经过 `JwtAuthGuard`。
- 统计和日志只返回当前用户数据。
- 评分后 `/stats` 能展示最新统计和最近记录。
- 空数据用户看到明确空状态。
- `bun --filter @repo/server test` 通过。
- `bun --filter @repo/server test:e2e -- --runInBand` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
- 浏览器核心链路验证通过。

## 13. 后续衔接

Phase 4.2 完成后，Phase 4 后续可以继续：

1. Phase 4.3：更完整的 ReviewTask 数据流，把今日任务从本地手账升级为服务端任务。
2. Phase 4.4：离线评分队列和提醒策略。
3. Phase 5：RAG 知识库，统计页可以作为 AI 学习建议的数据输入。
4. Phase 6：Agent 根据 stats/logs 生成复习计划和学习总结。
