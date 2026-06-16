# Phase 4.5.1 复习计划与统计图表设计

> 目标：在 Phase 4.4 已完成 ReviewTask 持久化、离线评分队列和 in-app 提醒摘要的基础上，补齐长期复习计划入口，并把 `/stats` 从轻量手绘统计升级为更精致、可读性更强的图表页。

## 1. 背景

当前 Phase 4 的复习主链路已经可用：

```text
错题 -> 加入复习 -> Card
  -> /review-tasks/today 懒生成今日 ReviewTask
  -> 今日任务评分
  -> ReviewLog + Card.nextReview 更新
  -> /reviews/stats 和 /reviews/logs 展示统计
```

Phase 4.4 还补齐了离线评分队列和今日页的 in-app 提醒摘要。现在的缺口是：

1. 用户只能看到今天要复习什么，看不到未来几天的复习压力。
2. `/stats` 已有数据，但图表表现偏基础，不够适合作为项目展示页。
3. 今日提醒只是摘要，没有形成“长期计划页 + 今日执行页 + 统计复盘页”的完整三角。

Phase 4.5.1 先做应用内计划和统计体验，不接浏览器通知、Push、BullMQ 定时任务或 Redis 调度。

## 2. 设计目标

1. 新增 `/plan` 页面，让用户看到未来 7 天的复习压力、峰值日期、预计耗时和行动建议。
2. 新增 `GET /review-tasks/plan` API，提供长期计划预览数据。
3. 未来计划默认只预览 Card 到期情况，不提前创建未来 ReviewTask，避免 FSRS 评分后未来任务过期。
4. `/today` 继续负责今日执行和离线评分待同步状态，不承载长期计划。
5. `/stats` 使用 ECharts 升级趋势、评分分布和卡片状态展示，但不改变 `/reviews/stats` 和 `/reviews/logs` 的统计口径。
6. 图表组件必须 client-only，避免 Next.js SSR / hydration 问题。
7. 保持当前亮色、柔和、轻漫画手账风格，避免企业后台感和过重粉色气泡风格。

## 3. 非目标

Phase 4.5.1 不做：

- 浏览器 Notification permission。
- PWA Push / Service Worker 后台提醒。
- BullMQ / Redis 定时提醒任务。
- 邮件、短信、系统日历。
- Agent 自动生成学习计划。
- 更改 FSRS 算法。
- 更改 `/reviews/stats` 现有统计事实来源。
- 提前持久化未来 7 天的 ReviewTask。

这些能力放到 Phase 4.5.2 或后续 Agent / 工程化阶段继续设计。

## 4. 方案选择

### 4.1 方案 A：只改前端，用现有 `/review-tasks` 拼长期计划

前端按日期循环请求 `/review-tasks?date=...`，再自己汇总。

优点：

- 后端改动少。
- 可以快速出页面。

缺点：

- 会依赖已经生成的 ReviewTask，未来日期没有任务就看不到真实压力。
- 多次请求，移动端体验差。
- 计划口径分散在前端，后续 Agent / Planner 不好复用。

结论：不采用。

### 4.2 方案 B：新增计划 API，未来只预览 Card.nextReview，推荐

后端新增 `/review-tasks/plan`。今天仍可沿用当前 `/review-tasks/today` 的懒生成逻辑；未来日期只读取 `Card.nextReview`，按用户本地日期分组，生成计划预览，不写入 ReviewTask。

优点：

- 长期计划口径清楚，后续 Agent / Planner 可复用。
- 不污染 ReviewTask 生命周期。
- 用户评分后，Card.nextReview 改变，下一次计划自然刷新。
- 前端只做展示和本地待同步状态合并。

缺点：

- 需要新增 API contract、service、hook 和测试。
- 计划页要解释“未来为预计，到期后进入今日任务”。

结论：采用。

### 4.3 方案 C：提前生成未来 ReviewTask

打开 `/plan` 时直接创建未来 7 天 ReviewTask。

优点：

- 计划任务实体稳定，后续可以做跳过、拖拽、日历。

缺点：

- 用户今天评分后，未来任务会因为 `Card.nextReview` 改变而变成脏任务。
- 需要复杂的取消、重排和幂等策略。
- 对当前阶段过重。

结论：不采用，留到真正的 Planner 阶段重新设计。

## 5. 后端 API

### 5.1 `GET /review-tasks/plan`

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `days` | number | `7` | 计划窗口，Phase 4.5.1 限制为 1 到 14 |
| `startDate` | `YYYY-MM-DD` | 用户本地今天 | 计划开始日期 |
| `timezoneOffsetMinutes` | number | `0` | 浏览器 `Date.getTimezoneOffset()` |

响应结构：

```ts
type ReviewTaskPlanResponse = {
  startDate: string;
  endDate: string;
  generatedThroughDate: string;
  summary: {
    overdueCount: number;
    todayDueCount: number;
    upcomingDueCount: number;
    estimatedTotalMinutes: number;
    peakDay: {
      date: string;
      count: number;
    } | null;
    intensity: 'light' | 'normal' | 'heavy';
  };
  days: Array<{
    date: string;
    label: string;
    dueCount: number;
    overdueCount: number;
    pendingCount: number;
    completedCount: number;
    skippedCount: number;
    estimatedMinutes: number;
    intensity: 'light' | 'normal' | 'heavy';
  }>;
  suggestion: {
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
  };
};
```

### 5.2 统计口径

- `overdueCount`：`Card.nextReview` 早于计划开始日 00:00 的未暂停卡片数量。
- `todayDueCount`：计划开始日当天到期的未暂停卡片数量。
- `upcomingDueCount`：计划窗口内但不含今天的未暂停卡片数量。
- `estimatedMinutes`：先使用固定估算，默认每张复习卡 2 分钟。
- `intensity`：
  - `light`：0 到 5 张。
  - `normal`：6 到 15 张。
  - `heavy`：16 张及以上。
- `pendingCount` / `completedCount` / `skippedCount`：只统计已经存在的 ReviewTask。未来预览日通常为 0，除非后续阶段允许生成未来任务。

### 5.3 生成边界

`/review-tasks/plan` 不负责生成未来 ReviewTask。

为了保持今日页行为一致，有两个可接受实现：

1. `/plan` 不触发任何任务生成，只根据 Card 和已有 ReviewTask 预览。
2. `/plan` 内部只确保 `startDate` 当天的到期任务存在，逻辑与 `/review-tasks/today` 一致。

Phase 4.5.1 推荐第 1 种：计划页是纯预览，今日页仍是执行入口和任务生成入口。这样副作用最少，也便于测试。

## 6. 共享类型

在 `@repo/types/api/review-task` 新增：

- `reviewTaskPlanIntensitySchema`
- `reviewTaskPlanQuerySchema`
- `reviewTaskPlanDaySchema`
- `reviewTaskPlanResponseSchema`
- `ReviewTaskPlanIntensity`
- `ReviewTaskPlanQuery`
- `ReviewTaskPlanDayResponse`
- `ReviewTaskPlanResponse`

前后端都通过 Zod schema 校验查询和响应，保持现有 contract 风格。

## 7. 前端数据流

新增 API client：

```ts
reviewTaskApi.getPlan(accessToken, query)
```

新增 TanStack Query key：

```ts
['review-tasks', 'plan', query]
```

新增 hook：

```ts
useReviewTaskPlan(query)
```

`/plan` 页面会同时读取：

1. `useReviewTaskPlan()`：服务端长期计划预览。
2. `useReviewTaskPendingRatings(userId)`：本地离线评分待同步数量。

本地待同步评分不回写计划 API，只在前端摘要卡上合并展示，文案明确为“待同步评分”。

## 8. `/plan` 页面设计

路由：

```text
apps/web/src/app/(main)/plan/page.tsx
```

页面模块从上到下：

1. 顶部导航：返回聊天、标题“复习计划”、轻量副标题。
2. 计划总览卡：未来 7 天预计复习张数、峰值日期、预计总耗时。
3. 四个摘要指标：已逾期、今日到期、未来到期、待同步评分。
4. ECharts 7 日柱状图：按日期展示复习压力，颜色区分轻松、正常、偏重。
5. 每日计划列表：展示日期、卡片数、预计分钟、强度标签、入口按钮。
6. 建议卡片：根据逾期和峰值情况给出一条明确行动建议。
7. 空状态：没有复习压力时，引导去错题本或今日任务。

交互原则：

- 点击今天的计划进入 `/today`。
- 点击未来日期暂时仍进入 `/today` 或保留为只读状态，不做未来任务操作。
- 不做“回到底部”之类额外交互。
- 移动端图表高度固定，避免加载后布局跳动。

## 9. `/stats` 优化设计

`/stats` 保持现有数据源：

- `GET /reviews/stats`
- `GET /reviews/logs`

升级内容：

1. 趋势图：用 ECharts line / area 展示 7 天或 30 天复习次数。
2. 评分分布：用 ECharts donut 或横向条形图展示 Again / Hard / Good / Easy。
3. 卡片状态：用小型 donut 或柔和分组卡展示 NEW / LEARNING / REVIEW / RELEARNING。
4. 最近记录：保留当前列表，但优化层级、间距和标签色。
5. 空状态、错误态和 loading 态保持现有逻辑，但文案更清晰。

`/stats` 不改变：

- `accuracyLikeRate` 计算方式。
- `streakDays` 计算方式。
- `dailyReviews` 日期补齐方式。
- ReviewLog 作为复习事实来源的边界。

## 10. ECharts 接入方案

新增轻量 client-only 图表组件：

```text
apps/web/src/components/charts/base-echart.tsx
```

实现原则：

1. 组件文件使用 `'use client'`。
2. 在 `useEffect` 中动态 `import('echarts')`，避免 SSR 引用浏览器对象。
3. 使用 `ResizeObserver` 监听容器尺寸，调用 `chart.resize()`。
4. unmount 时 `dispose()`，避免切页后残留实例。
5. 图表 option 由纯函数构建，便于单元测试。
6. 不优先引入 `echarts-for-react`，减少封装层和 React 19 / Next 16 兼容风险。

需要新增依赖：

```text
echarts
```

## 11. 视觉原则

整体延续当前产品风格，但比今日任务更像“学习仪表手账”：

- 主基底使用亮色、柔和、轻漫画网点质感。
- 图表色彩以青绿、天蓝、淡黄、柔紫为主。
- 避免大面积粉色气泡和高饱和渐变按钮。
- 卡片边角保持当前圆润风格，但避免层层套卡。
- 图表线条要细，网格线轻，标签字号保证移动端可读。
- 所有按钮触摸区域不小于 44px。

## 12. 错误和边界处理

- 未登录：沿用 AuthGuard / 前端 session 保护。
- `/review-tasks/plan` 参数非法：返回统一 validation error。
- 无复习卡：显示空状态，不视为错误。
- 服务端读取失败：展示错误卡和重试按钮。
- ECharts 加载失败：显示轻量 fallback，不影响页面主体信息。
- 离线状态：计划 API 读取失败时只展示错误态，不从 Dexie 推断长期计划，避免口径不一致。

## 13. 测试计划

### 13.1 共享类型

- `reviewTaskPlanQuerySchema` 正确处理默认 `days`、`startDate` 和 `timezoneOffsetMinutes`。
- 非法日期、非法 days 被拒绝。
- `reviewTaskPlanResponseSchema` 能校验完整响应。

### 13.2 后端单元测试

覆盖 `ReviewTasksService.getPlan`：

- 按当前 `userId` 隔离 Card。
- 按用户本地日期分组未来到期卡片。
- 正确统计 overdue / today / upcoming。
- 正确计算 peakDay、estimatedMinutes 和 intensity。
- 不创建未来 ReviewTask。
- 已暂停卡片不进入计划。

### 13.3 后端 e2e

- 登录后请求 `GET /review-tasks/plan` 返回计划数据。
- 另一个用户看不到当前用户卡片。
- `days` 超限返回 validation error。

### 13.4 前端单元测试

- `review-task-api` 正确拼接 `/review-tasks/plan` 参数并解析 schema。
- plan 视图 helper 正确生成摘要、强度标签和空状态。
- ECharts option builder 对空数据、单日数据、多日数据都返回稳定结构。
- `/stats` option builder 正确映射 dailyReviews、ratingCounts 和 stateCounts。

### 13.5 浏览器验收

启动项目后手动或 Playwright 验证：

1. `/plan` 可访问，登录保护正常。
2. 7 日图表可见且 canvas 非空。
3. `/plan` 在移动端无文字重叠和横向溢出。
4. `/stats` 趋势图、评分分布和卡片状态图可见。
5. 切换 `/stats` 的 7 天 / 30 天后图表更新。
6. 今日任务评分后，`/plan` 与 `/stats` 重新读取并展示新状态。
7. 切页返回后没有 ECharts 实例报错或内存残留告警。

## 14. 验收标准

Phase 4.5.1 完成时必须满足：

- `/plan` 页面存在并可从主导航或今日页进入。
- `/review-tasks/plan` 经过 `JwtAuthGuard`，只返回当前用户数据。
- 未来计划不提前生成未来 ReviewTask。
- `/stats` 使用 ECharts 展示主要统计图表。
- 图表组件无 SSR hydration 错误。
- 离线评分待同步数量仍能在计划摘要里体现。
- 现有 `/today`、`/stats`、ReviewTask rating、mutationQueue 行为不回退。
- Web lint/test/build、server lint/test/build/e2e、packages typecheck/fsrs/database 测试按阶段要求通过。
- 文档同步更新 `docs/data-flow.md`、`docs/roadmap.md`、`AGENTS.md`、`CLAUDE.md`、`README.md`、`DEVLOG.md`。

## 15. 下一步实施顺序

1. 新增 shared plan schema 和类型测试。
2. 新增后端 `/review-tasks/plan` controller/service/tests/e2e。
3. 新增前端 `reviewTaskApi.getPlan`、query hook 和 helper 测试。
4. 新增 client-only ECharts 基础组件和 option builders。
5. 实现 `/plan` 页面和导航入口。
6. 改造 `/stats` 图表和布局。
7. 启动项目做浏览器验收。
8. 同步文档、开发日志和当天博客。
