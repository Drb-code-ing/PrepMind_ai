# Phase 6.6 MemoryAgent Design

## 背景

PrepMind 当前已经完成 Phase 6.5：`ReviewAgent` 和 `PlannerAgent` 能基于错题、复习日志、复习计划和偏好生成只读学习建议。多 Agent 主线已经覆盖了路由、讲题策略、知识库核对、错题组织、复习诊断和计划建议。

下一步进入 `MemoryAgent`。它的价值不是把所有聊天内容沉淀为“记忆”，而是把长期稳定、可解释、对后续学习确实有帮助的信号沉淀为用户可管理的学习记忆。由于长期记忆直接影响个性化体验和用户信任，本阶段优先建立人审确认、撤销和用户可见管理闭环。

本阶段仍遵守 Phase 6 既有边界：

- Agent 框架继续使用 LangGraph，不引入 AutoGen。
- `@repo/agent` 继续实现确定性 policy，不读取 API key，不调用真实模型。
- `/api/chat` 仍是 mock/live 模型调用边界，真实模型调用继续受双开关保护。
- 分析型 Agent 不在每次 Chat 中自动执行。
- 涉及写入的个性化结果必须用户可见、可确认、可撤销。

## 产品目标

- 生成长期记忆候选，帮助用户沉淀学习目标、讲解偏好、长期薄弱点和稳定学习习惯。
- 用户必须先确认候选，候选才会变成正式长期记忆。
- 用户可以忽略候选、停用正式记忆、删除正式记忆。
- 第一版把“学习记忆”放在 `/profile`，让用户在个人档案中集中管理。
- 为后续个性化 prompt 注入预留能力，但本阶段默认不把记忆自动注入每次 Chat。

## 非目标

- 不把每条聊天消息自动写入长期记忆。
- 不静默创建正式记忆。
- 不在每次 Chat 中自动执行 `MemoryAgent`。
- 不默认把正式记忆注入 Chat prompt。
- 不调用真实模型生成记忆。
- 不进入 Dexie `mutationQueue`；记忆管理是在线账号级能力。
- 不替代现有 localStorage 学习偏好；本阶段只在服务端建立可管理长期记忆。

## 推荐方案

采用“候选层 + 正式记忆层”的两阶段设计：

```text
PostgreSQL facts
  -> ChatMessage / WrongQuestion / ReviewLog / Card / ReviewPreference
  -> MemoryAgentService 聚合当前用户长期信号
  -> @repo/agent memory deterministic policy
  -> UserMemoryCandidate(PENDING)
  -> 用户确认 / 忽略
  -> UserMemory(ACTIVE / ARCHIVED)
  -> /profile 学习记忆管理
```

核心原则：

- `UserMemoryCandidate` 表示“系统建议记住这件事”，不是事实。
- `UserMemory` 表示“用户确认过的长期记忆”，可停用和删除。
- 同一用户下相近记忆要做轻量去重，避免重复候选刷屏。
- 后端负责用户隔离、状态流和幂等写入。
- 前端只展示和触发用户明确动作，不做离线乐观写入。

## 记忆类型

第一版支持四类记忆：

| 类型 | 说明 | 示例 |
| --- | --- | --- |
| `LEARNING_GOAL` | 长期学习目标或考试目标 | “用户正在准备考研数学一。” |
| `EXPLANATION_PREFERENCE` | 稳定讲解偏好 | “用户更偏好先给思路再给完整答案。” |
| `WEAK_POINT` | 长期反复薄弱点 | “用户在导数应用题中多次出现审题错误。” |
| `STUDY_HABIT` | 稳定学习节奏或行为习惯 | “用户通常晚上复习，单次更适合 25 分钟以内。” |

候选必须包含：

- 简短标题。
- 可直接给用户看的内容。
- 生成原因。
- 证据摘要。
- 置信度。
- 来源类型和来源引用。

## 数据模型

新增枚举：

```prisma
enum UserMemoryType {
  LEARNING_GOAL
  EXPLANATION_PREFERENCE
  WEAK_POINT
  STUDY_HABIT
}

enum UserMemoryCandidateStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}

enum UserMemoryStatus {
  ACTIVE
  ARCHIVED
}
```

新增 `UserMemoryCandidate`：

```prisma
model UserMemoryCandidate {
  id              String                    @id @default(cuid())
  userId          String
  type            UserMemoryType
  title           String
  content         String                    @db.Text
  reason          String                    @db.Text
  evidence        Json
  confidence      Float                     @default(0.5)
  status          UserMemoryCandidateStatus @default(PENDING)
  sourceHash      String
  acceptedMemoryId String?
  createdAt       DateTime                  @default(now())
  updatedAt       DateTime                  @updatedAt
  decidedAt       DateTime?

  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  acceptedMemory UserMemory? @relation(fields: [acceptedMemoryId], references: [id], onDelete: SetNull)

  @@unique([userId, sourceHash])
  @@index([userId, status, updatedAt])
  @@index([userId, type, updatedAt])
}
```

新增 `UserMemory`：

```prisma
model UserMemory {
  id                String           @id @default(cuid())
  userId            String
  type              UserMemoryType
  title             String
  content           String           @db.Text
  status            UserMemoryStatus @default(ACTIVE)
  sourceCandidateId String?
  confidence        Float            @default(0.5)
  lastUsedAt        DateTime?
  archivedAt        DateTime?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  user       User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  candidates UserMemoryCandidate[]

  @@index([userId, status, updatedAt])
  @@index([userId, type, updatedAt])
}
```

实现时需要根据 Prisma 关系要求微调 relation name，但语义保持以上结构。`sourceHash` 由 `userId + type + normalizedContent + evidenceKey` 生成，用于避免重复候选。

## API Contract

在 `@repo/types` 新增 `api/memory-agent.ts`，导出 Zod schema 和类型。服务端新增 `MemoryAgentModule`。

### 候选接口

```text
GET /memory-agent/candidates
POST /memory-agent/candidates/generate
POST /memory-agent/candidates/:id/accept
POST /memory-agent/candidates/:id/reject
```

`GET /memory-agent/candidates` 查询参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `status` | `PENDING / ACCEPTED / REJECTED / EXPIRED` | `PENDING` | 候选状态 |
| `limit` | number | `20` | 1 到 50 |

`POST /memory-agent/candidates/generate` 请求体：

```ts
type GenerateMemoryCandidatesRequest = {
  source?: 'profile' | 'manual';
  force?: boolean;
};
```

生成接口的第一版行为：

- 读取当前用户近 60 天学习信号。
- 默认只生成尚未存在的候选。
- `force=true` 允许重新扫描，但仍受 `sourceHash` 去重。
- 返回本次新增候选数和当前待确认候选列表。

`accept` 行为：

- 只允许接受当前用户的 `PENDING` 候选。
- 幂等：重复接受已 `ACCEPTED` 候选时返回已关联记忆。
- 创建 `UserMemory(status=ACTIVE)`。
- 更新候选为 `ACCEPTED`，写入 `acceptedMemoryId` 和 `decidedAt`。

`reject` 行为：

- 只允许拒绝当前用户的 `PENDING` 候选。
- 更新候选为 `REJECTED` 和 `decidedAt`。
- 不创建正式记忆。

### 正式记忆接口

```text
GET /user-memories
PATCH /user-memories/:id
DELETE /user-memories/:id
```

`GET /user-memories` 查询参数：

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `status` | `ACTIVE / ARCHIVED / all` | `ACTIVE` | 正式记忆状态 |
| `type` | `UserMemoryType` | 无 | 可选类型过滤 |

`PATCH /user-memories/:id` 请求体：

```ts
type UpdateUserMemoryRequest = {
  title?: string;
  content?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
};
```

`DELETE /user-memories/:id`：

- 删除当前用户的正式记忆。
- 第一版使用硬删除，候选保留历史状态。
- 删除后不影响错题、复习、聊天和知识库事实数据。

## MemoryAgent Policy

在 `@repo/agent` 中新增可导出的 memory policy：

```ts
type MemoryAgentInput = {
  now: string;
  profilePreference?: {
    examGoal?: string;
    explanationStyle?: string;
    dailyIntensity?: string;
  };
  recentChatSignals: Array<{
    conversationId: string;
    messageId: string;
    text: string;
    createdAt: string;
  }>;
  weakPointSignals: Array<{
    label: string;
    subject?: string;
    wrongCount: number;
    recentAgainCount: number;
  }>;
  reviewSignals: {
    consecutiveActiveDays: number;
    totalReviewsInWindow: number;
    preferredReviewTime?: string;
  };
  existingMemories: Array<{
    type: UserMemoryType;
    content: string;
  }>;
};

type MemoryAgentResult = {
  candidates: MemoryCandidateDraft[];
  signals: string[];
};
```

规则优先级：

1. 明确偏好优先：用户说“以后都这样讲”“我更喜欢先提示再给答案”等，生成 `EXPLANATION_PREFERENCE`。
2. 学习目标优先从 profile 偏好提取，不从单句聊天过度推断。
3. 薄弱点必须满足重复条件，例如 `wrongCount >= 3` 或 `recentAgainCount >= 2`。
4. 学习习惯必须来自连续活跃、复习偏好或稳定时间窗口，不从偶然一次行为推断。
5. 与 `existingMemories` 内容相近时跳过，避免重复。

第一版可以采用简单字符串和聚合统计规则，不做 embedding 相似度。

## 服务端数据聚合

`MemoryAgentService` 负责从 PostgreSQL 聚合当前用户信号：

- `ChatMessage`：近 60 天用户消息，最多 100 条，只筛选含明确偏好关键词的短文本。
- `WrongQuestion` + `Card` + `ReviewLog`：复用 ReviewAgent 的弱点聚合思路，识别重复薄弱点。
- `ReviewPreference`：读取复习时间、每日分钟和卡片上限。
- `UserMemory`：读取现有 `ACTIVE` 记忆用于去重。

隐私和性能边界：

- 所有查询都必须按 `userId` 过滤。
- 不把完整聊天记录返回给前端候选卡片，只返回证据摘要和必要引用。
- 默认窗口 60 天，避免全量扫描。
- 单次生成最多新增 5 条候选。
- 生成失败不影响 `/profile` 基础资料展示。

## 前端设计

第一版在 `/profile` 增加“学习记忆”区块。

页面能力：

- 展示待确认候选。
- 展示已启用记忆。
- 支持“生成候选”“确认”“忽略”“停用”“恢复”“删除”。
- 候选卡片显示类型、内容、原因、证据摘要和置信度。
- 已启用记忆卡片显示类型、内容、更新时间和状态。

文案边界：

- 候选文案使用“建议记住”，避免暗示已经生效。
- 正式记忆文案使用“已确认记忆”。
- 页面说明必须明确：“第一版不会自动把这些记忆用于每次对话，后续会增加个性化开关。”

交互边界：

- API 失败时只提示当前操作失败，不影响其他资料保存。
- 确认和删除需要清晰按钮状态。
- 删除正式记忆前需要轻量确认。
- 移动端触摸目标不小于 44px。

## Chat Prompt 边界

本阶段不把 `UserMemory` 默认注入 `/api/chat` prompt。

允许做的预留：

- 在 API contract 中保留 `lastUsedAt` 字段。
- 在文档中说明后续可增加“启用个性化回答”开关。
- `chat-agent-runtime` 对 `memory_reflection` route 继续保持 advisory workflow prompt，不声明已经写入记忆。

明确不做：

- 不在 `buildChatRequestBudget` 中读取记忆。
- 不在 Next.js `/api/chat` 中请求 `/user-memories`。
- 不改变现有 token 预算。

## 降级策略

- 候选生成失败：返回标准错误，前端保留 profile 主页面。
- 没有足够信号：返回空候选和解释性 summary，不创建低质量候选。
- 候选已被处理：`accept/reject` 返回当前状态，避免重复写入。
- 正式记忆已删除：后续查询不返回；关联候选仍保留 accepted 历史。
- Policy 抛错：服务端不写入候选，返回可恢复错误。
- 前端网络失败：不进入 Dexie 队列，提示稍后重试。

## 测试策略

### Types

- `memory-agent` schema 能验证候选、正式记忆、生成请求和状态流。
- `limit`、`status`、`type` 查询参数边界正确。
- runtime import 测试覆盖新 subpath export。

### Agent

- 明确偏好文本能生成 `EXPLANATION_PREFERENCE` 候选。
- 重复薄弱点能生成 `WEAK_POINT` 候选。
- 偶然单次聊天不会生成长期记忆。
- existing memories 能阻止重复候选。
- `shouldRunMemoryAgent` 既有阈值继续通过。

### Server

- 所有接口必须经过 `JwtAuthGuard`。
- 候选生成只读取当前用户数据。
- `sourceHash` 去重生效。
- 接受候选幂等，且只创建一条正式记忆。
- 拒绝候选不创建正式记忆。
- 更新、停用、删除正式记忆只作用于当前用户。

### Web

- Profile 页面能展示候选和正式记忆。
- 生成候选、确认、忽略、停用、删除操作调用正确 API。
- API 失败不影响昵称和学习偏好保存。
- 移动端布局无文本溢出，按钮触摸区域达标。

## 验收标准

Phase 6.6 完成后应满足：

- `@repo/types` 提供 MemoryAgent API contract。
- `@repo/agent` 提供 deterministic MemoryAgent policy 和 subpath export。
- Prisma schema 和 migration 包含候选表、正式记忆表、状态枚举和索引。
- NestJS 提供候选生成、确认、拒绝、正式记忆查询、更新和删除接口。
- `/profile` 能管理学习记忆候选和正式记忆。
- 任何记忆写入都需要用户明确确认。
- 正式记忆可以停用和删除。
- `/api/chat` 不自动注入记忆，不新增 token 成本。
- 通过 types、agent、server、web 相关测试和 build。
- 文档更新 `AGENTS.md`、`README.md`、`docs/data-flow.md`、`docs/roadmap.md`、`DEVLOG.md`。

## 实施节奏

用户要求每完成一个明确步骤都提交代码。Phase 6.6 建议拆成以下提交边界：

1. Design spec：提交本设计文档。
2. Types + Agent policy：提交 contract、policy 和单测。
3. Database migration：提交 Prisma schema、migration 和数据库测试。
4. Server API：提交 NestJS module/service/controller 和 server 测试。
5. Web profile integration：提交前端 API client、hooks、Profile UI 和前端测试。
6. Docs + acceptance：提交项目文档、开发日志和最终验收修正。

每个步骤完成后先运行对应最小验证，再提交。最终合并前再运行完整验证矩阵。

## 后续扩展

- Phase 6.7 可把 MemoryAgent 候选、确认、拒绝过程纳入 Agent Trace UI。
- 后续可增加“启用个性化回答”开关，再把 `ACTIVE` 记忆按预算注入 Chat prompt。
- 后续可引入 embedding 去重，但第一版不需要。
- Phase 7 引入 BullMQ 后，可把周期性记忆候选生成改为后台任务。
