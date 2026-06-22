# Phase 6.5 ReviewAgent / PlannerAgent Design

## 背景

Phase 4 已完成 FSRS 复习闭环、ReviewTask 持久化、离线评分队列、学习统计、复习计划预览和 ReviewPreference 容量偏好。Phase 6.4 又补齐了错题组织层，让错题本从平铺列表升级为“学科卡片 -> 专题 deck -> 错题列表”。

当前缺口是：系统已经知道用户错在哪里、复习压力在哪天高、哪些专题反复出现，但这些信息还没有被 Agent 汇总成面向用户的“复习诊断”和“学习计划建议”。Phase 6.5 的目标是补齐这一层，让 PrepMind 从数据展示进一步走向学习指导。

本阶段仍保持经济、可控、可测试：`ReviewAgent` 和 `PlannerAgent` 都先实现为 deterministic policy，不直接调用真实模型、不读取 API key、不自动写入未来任务。

## 产品目标

- 在不增加 AI token 成本的前提下，为用户生成复习分析与计划建议。
- `ReviewAgent` 负责识别薄弱知识点、反复错因、低稳定度卡片和高优先级专题。
- `PlannerAgent` 负责结合复习压力、每日容量偏好和 ReviewAgent 结果，生成今日重点和未来 7 / 14 天节奏建议。
- 建议结果可以展示在 `/plan` 和 `/today`，但不替代现有 ReviewTask、ReviewPreference、ReviewLog 事实来源。
- 用户看到的是“系统建议你怎么复习”，而不是“系统已经替你改了计划”。

## 非目标

- 不自动创建 `ReviewTask(source=PLANNER)`。
- 不改写 `Card.nextReview`、FSRS 参数、ReviewLog 或 ReviewPreference。
- 不把建议写入 Dexie mutation queue。
- 不接入真实模型作为主链路。
- 不做长期记忆沉淀，MemoryAgent 留到后续阶段。
- 不做复杂拖拽排期、日历排程或计划确认 UI。
- 不把 Agent 建议注入 Chat prompt，除非后续明确设计。

## 推荐方案

Phase 6.5 采用“只读 Agent 建议闭环”：

```text
PostgreSQL facts
  -> ReviewTask / Card / ReviewLog / ReviewPreference / WrongQuestionDeck
  -> ReviewAnalysisService 聚合当前用户学习信号
  -> ReviewAgent deterministic policy 生成薄弱点诊断
  -> PlannerAgent deterministic policy 生成计划建议
  -> GET /review-agent/suggestions 返回只读建议
  -> /plan 与 /today 展示建议摘要
```

核心原则：

- 服务端负责读取事实数据和用户隔离。
- `@repo/agent` 只负责纯策略计算，不直接访问数据库。
- API 返回建议和原因，不产生副作用。
- 前端只展示建议，不默认执行建议。

## Agent 职责

### ReviewAgent

输入：

```ts
type ReviewAgentInput = {
  now: string;
  weakKnowledgePoints: Array<{
    label: string;
    subject?: string;
    deckName?: string;
    wrongCount: number;
    recentAgainCount: number;
    averageDifficulty: number;
    averageStability: number;
  }>;
  cardSummary: {
    dueCount: number;
    overdueCount: number;
    highDifficultyCount: number;
    lowStabilityCount: number;
  };
  recentReviewSummary: {
    totalReviews: number;
    againCount: number;
    hardCount: number;
    goodCount: number;
    easyCount: number;
  };
};
```

输出：

```ts
type ReviewAgentResult = {
  priority: 'low' | 'medium' | 'high';
  summary: string;
  weakPoints: Array<{
    label: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    confidence: number;
  }>;
  actions: Array<{
    title: string;
    description: string;
    targetHref: string;
  }>;
  signals: string[];
};
```

规则：

1. `overdueCount > 0` 时，整体优先级至少为 `medium`。
2. `overdueCount >= 5`、`recentAgainCount >= 3` 或 `lowStabilityCount >= 5` 时，整体优先级为 `high`。
3. 知识点排序优先看 `recentAgainCount`，其次看 `wrongCount`，再看 `averageDifficulty`。
4. 如果没有明显薄弱点，输出低压力建议，引导用户保持节奏或整理错题。
5. 所有建议必须可解释，返回 `signals` 便于调试和演示。

### PlannerAgent

输入：

```ts
type PlannerAgentInput = {
  review: ReviewAgentResult;
  plan: ReviewTaskPlanResponse;
  preference: ReviewPreferenceResponse;
};
```

输出：

```ts
type PlannerAgentResult = {
  headline: string;
  todayFocus: string;
  weekStrategy: string;
  capacityNotice?: string;
  suggestedBlocks: Array<{
    title: string;
    minutes: number;
    reason: string;
    targetHref: string;
  }>;
  signals: string[];
};
```

规则：

1. 如果今日或逾期压力超出容量，优先建议清理逾期和高优先级薄弱点。
2. 如果未来存在高峰日，建议提前复盘相关错题专题，而不是提前创建任务。
3. 如果复习压力轻，建议用户补齐错题整理、上传资料或做轻量巩固。
4. `suggestedBlocks.minutes` 总和不应超过 `ReviewPreference.dailyMinutes`；超容量时通过 `capacityNotice` 提醒用户调整期望。
5. 计划建议必须使用已有页面入口，例如 `/today`、`/plan`、`/error-book`，不生成虚假的功能链接。

## 服务端 API

新增模块建议命名为 `review-agent`。

```text
GET /review-agent/suggestions
```

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `days` | number | `7` | 计划窗口，允许 1 到 14 |
| `startDate` | `YYYY-MM-DD` | 用户本地今天 | 与 `/review-tasks/plan` 保持一致 |
| `timezoneOffsetMinutes` | number | `0` | 浏览器 `Date.getTimezoneOffset()` |

响应结构：

```ts
type ReviewAgentSuggestionResponse = {
  generatedAt: string;
  review: ReviewAgentResult;
  planner: PlannerAgentResult;
  planSummary: ReviewTaskPlanResponse['summary'];
};
```

权限边界：

- 使用 `JwtAuthGuard`。
- 所有查询必须按当前 `userId` 过滤。
- 不返回其它用户错题、卡片、日志或 deck。
- 本接口只读，不写数据库。

## 数据聚合

服务端聚合需要读取：

- `Card`：`difficulty`、`stability`、`nextReview`、`state`、`wrongQuestionId`。
- `ReviewLog`：最近 30 天评分分布和 Again / Hard 情况。
- `WrongQuestion`：`subject`、`knowledgePoints`、`category`、`errorType`、`status`。
- `WrongQuestionDeckItem`：错题所属 deck 和 subject group。
- `ReviewPreference`：每日分钟、每日卡片上限、计划窗口。
- `/review-tasks/plan` 同等压力模型：可复用 `ReviewTasksService.getPlan()`，避免重复实现压力逻辑。

聚合边界：

- 只统计当前用户。
- 默认只取最近 30 天 ReviewLog 和高风险卡片，避免查询过重。
- 薄弱点最多返回 5 个，行动建议最多返回 3 个。
- 没有 ReviewLog 时，仍可基于错题数量、Card 难度和到期压力生成保守建议。

## 前端展示

第一版推荐只做轻量接入：

- `/plan`：在现有计划建议卡上方或下方增加“Agent 学习建议”区域，展示 `headline`、`todayFocus`、`weekStrategy` 和建议 blocks。
- `/today`：在今日复习摘要附近展示一条短建议，例如“今天先处理逾期卡，再复盘高等数学 · 格林公式专题”。
- 如果建议 API 失败，不影响 `/plan` 和 `/today` 原有数据展示。
- 空数据时显示“暂无明显薄弱点，保持当前复习节奏”。

视觉要求：

- 延续当前轻漫画、柔和卡通风格。
- 不做夸张大卡片，不抢占主要任务区域。
- 移动端触摸目标不小于 44px。
- 文案要像学习建议，不像系统日志。

## 成本与安全边界

- `@repo/agent` 的 `review` 和 `planner` 节点不 import `streamText`、不读取 `AI_PROVIDER_MODE`、不读取 API key。
- 真实模型验收不属于 Phase 6.5 主链路；如果后续需要 live 验收，只能小样本、显式双开关开启。
- API 不写入计划任务，因此不会污染 FSRS 和 ReviewTask 生命周期。
- Agent 输出是建议，不是事实数据；事实仍来自 PostgreSQL 的 Card / ReviewLog / ReviewTask / ReviewPreference。

## 降级策略

- 没有错题或复习卡：返回低压力建议，引导保存错题或加入复习。
- 没有 ReviewLog：使用 Card 和 WrongQuestion 生成保守诊断。
- `/review-tasks/plan` 计算失败：接口返回错误，前端保持原页面并提示建议暂不可用。
- Agent policy 抛错：服务端返回标准错误，不写任何数据。
- 前端建议请求失败：只隐藏 Agent 建议区，不影响今日任务或计划页。

## 测试策略

### Agent package

- `ReviewAgent` 能根据逾期卡、Again 次数和低稳定度输出高优先级。
- `ReviewAgent` 能在无明显风险时输出低压力建议。
- `PlannerAgent` 能在超容量时生成 `capacityNotice`。
- `PlannerAgent` 生成的建议 blocks 不超过每日分钟预算。
- `@repo/agent` 导出 `review` 和 `planner` subpath，且没有 live model 调用。

### Types

- 新增 `review-agent` API schema。
- 校验 `days`、`startDate`、`timezoneOffsetMinutes`。
- 校验完整 response，包括 review、planner 和 planSummary。

### Server

- `GET /review-agent/suggestions` 必须经过 `JwtAuthGuard`。
- 服务端只读取当前用户数据。
- 能聚合 deck / knowledgePoint / ReviewLog / Card 信号。
- 不创建 ReviewTask，不更新 Card，不写 ReviewLog。
- 无 ReviewLog 或无 deck 时仍返回可用建议。

### Web

- API client 正确请求 `/review-agent/suggestions`。
- TanStack Query key 稳定。
- `/plan` 和 `/today` 在建议 API 失败时不崩溃。
- 移动端建议区域无文本溢出，按钮触摸区达标。

## 验收标准

Phase 6.5 完成后应满足：

- `ReviewAgent` 和 `PlannerAgent` 都是可测试、可导出的 deterministic policy。
- 新增只读建议 API，按当前用户隔离。
- API 返回复习诊断、学习计划建议和计划摘要。
- `/plan` 至少展示完整 Agent 建议。
- `/today` 至少展示一条今日学习建议。
- 现有 `/review-tasks/plan`、`/today`、`/stats`、错题本和 Chat 不回退。
- 无真实模型调用、无 API key 读取、无新增 token 成本。
- 通过 agent/types/server/web 相关测试、build 和一次浏览器体验验证。

## 后续扩展

- Phase 6.6 可继续推进 MemoryAgent，把长期稳定的学习偏好、人审确认结果和反复弱点沉淀为长期记忆。
- 后续可增加 ActionProposal：用户确认后创建 `ReviewTask(source=PLANNER)`，但不在本阶段实现。
- Phase 7 引入 BullMQ 后，可把周期性复习分析变成后台任务，而不是每次打开页面都实时计算。
