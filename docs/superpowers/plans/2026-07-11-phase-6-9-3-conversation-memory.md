# Phase 6.9.3 Conversation Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PrepMind Chat 增加 PostgreSQL 权威的滚动会话摘要、24 小时可恢复会话状态、Redis/Dexie 降级缓存和分层 context budget，并完成受控 Live 摘要验收。

**Architecture:** NestJS `POST /conversation-context/prepare` 在 Chat 调用前读取当前用户的持久化消息，达到 12 条未摘要消息或 70% token pressure 时通过 `ModelAgentRuntime` 生成增量摘要，并使用 source hash + CAS 推进单行摘要水位。PostgreSQL 是 summary/state 权威来源，Redis 与 Dexie 只缓存 sanitized state；Next.js 将 prepare 结果送入纯函数 Context Budget Assembler，prepare/Redis/model 失败都降级为当前近期消息窗口。

**Tech Stack:** TypeScript strict、Zod 3、NestJS 11、Prisma/PostgreSQL、ioredis、Next.js 16、Dexie 4、Bun/Jest/Node test、Docker Compose、Playwright headed、OpenAI-compatible ModelAgentRuntime

---

## 0. 交付拆分与分支纪律

Phase 6.9.3 跨越 contract/database、server state、model CAS、Web assembler 和真实验收。为了避免单分支再次持续数十小时，拆成五个可独立验收的 slice：

| Slice                       | 分支                                         | 唯一实现提交                                       |
| --------------------------- | -------------------------------------------- | -------------------------------------------------- |
| 6.9.3.1 Contract + Prisma   | `codex/phase-6-9-3-1-conversation-contracts` | `feat(memory): add conversation memory contracts`  |
| 6.9.3.2 State + prepare API | `codex/phase-6-9-3-2-conversation-state`     | `feat(server): add conversation state prepare API` |
| 6.9.3.3 Summary + CAS       | `codex/phase-6-9-3-3-conversation-summary`   | `feat(ai): add rolling conversation summaries`     |
| 6.9.3.4 Web assembler       | `codex/phase-6-9-3-4-context-assembler`      | `feat(web): assemble layered chat context`         |
| 6.9.3.5 Docker/Live/docs    | `codex/phase-6-9-3-5-live-acceptance`        | `docs(ai): close phase 6.9.3 acceptance`           |

每个 slice 必须：

1. 从已推送的最新 `main` 新建分支，不能从前一个功能分支继续开分支；
2. 先 RED，再 GREEN，再请求独立只读代码审查；
3. 功能分支完整验收后创建唯一实现提交；
4. `--no-ff` 合并 main，在 main 重跑同一门禁并推送 `origin/main`；
5. 核对 local/tracking/remote SHA 一致后删除本地功能分支；
6. slice 完成即更新 DEVLOG/验收证据；项目总状态在 6.9.3.5 收口。

---

## Task 1（Phase 6.9.3.1）：Conversation contract 与 Prisma 地基

**Files:**

- Create: `packages/types/src/api/conversation-context.ts`
- Create: `packages/types/tests/conversation-context.test.mts`
- Modify: `packages/types/package.json`
- Modify: `packages/types/src/api/agent.ts`
- Modify: `packages/types/tests/agent.test.mts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260711120000_conversation_memory/migration.sql`
- Create: `packages/database/tests/conversation-memory-schema.test.mts`
- Modify: `packages/database/package.json`
- Modify: `AGENTS.md`, `README.md`, `docs/roadmap.md`, `docs/data-flow.md`, `DEVLOG.md`

- [ ] **Step 1: 从最新 main 建立 slice 6.9.3.1 分支并确认基线**

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/phase-6-9-3-1-conversation-contracts
git status --short --branch
bun --cwd packages/types typecheck
bun --cwd packages/database test
```

Expected: main 与 origin/main 一致；typecheck/database test 退出 0。

- [ ] **Step 2: 写 conversation context contract RED 测试**

在 `packages/types/tests/conversation-context.test.mts` 写入：

```ts
import assert from 'node:assert/strict';

import {
  conversationContextPrepareRequestSchema,
  conversationContextPrepareResponseSchema,
} from '../src/api/conversation-context.ts';

const request = conversationContextPrepareRequestSchema.parse({
  conversationId: 'conv_1',
  maxInputTokens: 2500,
  statePatch: { activeGoal: '复习导数', activeQuestionId: 'question_1' },
});
assert.equal(request.conversationId, 'conv_1');

const response = conversationContextPrepareResponseSchema.parse({
  conversationId: 'conv_1',
  summaryBuffer: '用户正在复习导数。',
  coveredThroughOrder: 11,
  summaryVersion: 1,
  summaryStatus: 'generated',
  state: {
    conversationId: 'conv_1',
    activeGoal: '复习导数',
    activeQuestionId: 'question_1',
    stateVersion: 1,
    expiresAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  debug: {
    uncoveredMessageCount: 12,
    triggerReason: 'message_count',
    modelMode: 'mock',
    errorCode: null,
  },
});
assert.equal(response.summaryVersion, 1);

assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    sourceHash: 'must-not-be-public',
  }),
);
```

同步扩展 `packages/types/tests/agent.test.mts`，断言 context policy 能解析：

```ts
layerTokenCounts: {
  mandatory: 120,
  agentGuidance: 20,
  activeStudy: 80,
  recentMessages: 400,
  rag: 200,
  summary: 120,
},
droppedLayers: ['rag'],
summaryVersion: 1,
summaryStatus: 'generated',
```

- [ ] **Step 3: 运行 contract 测试确认 RED**

```powershell
node --experimental-strip-types packages/types/tests/conversation-context.test.mts
```

Expected: FAIL，原因是 `conversation-context.ts` 不存在。

- [ ] **Step 4: 实现 strict Zod contract**

`packages/types/src/api/conversation-context.ts` 的公共形状固定为：

```ts
import { z } from 'zod';

export const conversationSummaryStatusSchema = z.enum([
  'not_needed',
  'reused',
  'generated',
  'degraded',
  'stale_snapshot',
  'cas_conflict',
]);

export const conversationSummaryTriggerReasonSchema = z.enum([
  'message_count',
  'token_pressure',
  'none',
]);

export const conversationStateSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    activeGoal: z.string().max(300).nullable(),
    activeQuestionId: z.string().max(100).nullable(),
    stateVersion: z.number().int().positive(),
    expiresAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const conversationContextPrepareRequestSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    maxInputTokens: z.number().int().min(200).max(12_000),
    statePatch: z
      .object({
        activeGoal: z.string().trim().max(300).nullable().optional(),
        activeQuestionId: z.string().trim().max(100).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const conversationContextPrepareResponseSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    summaryBuffer: z.string().max(4_000).nullable(),
    coveredThroughOrder: z.number().int().min(0).nullable(),
    summaryVersion: z.number().int().positive().nullable(),
    summaryStatus: conversationSummaryStatusSchema,
    state: conversationStateSchema.nullable(),
    debug: z
      .object({
        uncoveredMessageCount: z.number().int().min(0),
        triggerReason: conversationSummaryTriggerReasonSchema,
        modelMode: z.enum(['mock', 'live', 'none']),
        errorCode: z.string().min(1).max(120).nullable(),
      })
      .strict(),
  })
  .strict();

export type ConversationContextPrepareRequest = z.infer<
  typeof conversationContextPrepareRequestSchema
>;
export type ConversationContextPrepareResponse = z.infer<
  typeof conversationContextPrepareResponseSchema
>;
export type ConversationStateResponse = z.infer<typeof conversationStateSchema>;
export type ConversationSummaryStatus = z.infer<typeof conversationSummaryStatusSchema>;
```

`packages/types/src/api/agent.ts` 给 `agentContextPolicySchema` 增加 optional、向后兼容字段：

```ts
layerTokenCounts: z
  .object({
    mandatory: z.number().int().min(0),
    agentGuidance: z.number().int().min(0),
    activeStudy: z.number().int().min(0),
    recentMessages: z.number().int().min(0),
    rag: z.number().int().min(0),
    summary: z.number().int().min(0),
  })
  .strict()
  .optional(),
droppedLayers: z.array(z.enum(['agentGuidance', 'activeStudy', 'rag', 'summary'])).optional(),
summaryVersion: z.number().int().positive().optional(),
summaryStatus: z
  .enum(['not_needed', 'reused', 'generated', 'degraded', 'stale_snapshot', 'cas_conflict'])
  .optional(),
```

在 `packages/types/package.json` 增加 `./api/conversation-context` export。

- [ ] **Step 5: 运行 contract 测试确认 GREEN**

```powershell
node --experimental-strip-types packages/types/tests/conversation-context.test.mts
bun --cwd packages/types typecheck
```

Expected: 两条命令退出 0。

- [ ] **Step 6: 写 Prisma schema/migration RED 检查**

当前 database workspace 没有 runtime schema test。创建
`packages/database/tests/conversation-memory-schema.test.mts`：

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../prisma/migrations/20260711120000_conversation_memory/migration.sql', import.meta.url),
  'utf8',
);

assert.match(schema, /model ConversationSummary/);
assert.match(schema, /conversationId\s+String\s+@unique/);
assert.match(schema, /model ConversationState/);
assert.match(migration, /ConversationSummary_watermark_check/);
assert.match(migration, /ConversationState_expiry_check/);
assert.match(migration, /ON DELETE CASCADE/);
```

把 `packages/database/package.json` 的 test 改为：

```json
"test": "node --experimental-strip-types --test tests/*.test.mts && tsc --noEmit"
```

Run:

```powershell
bun --cwd packages/database test
```

Expected: FAIL，因为模型与 migration 尚不存在。

- [ ] **Step 7: 添加 Prisma models、关系、索引和数据库 CHECK**

在 `schema.prisma` 添加 `ConversationSummaryMode { MOCK LIVE }` 和：

```prisma
model ConversationSummary {
  id                  String                  @id @default(cuid())
  conversationId      String                  @unique
  userId              String
  summary             String                  @db.Text
  coveredThroughOrder Int
  sourceMessageCount  Int
  sourceHash          String                  @db.VarChar(71)
  summaryVersion      Int                     @default(1)
  modelMode           ConversationSummaryMode
  modelProvider       String                  @db.VarChar(80)
  modelName           String                  @db.VarChar(120)
  promptVersion       String                  @db.VarChar(80)
  inputTokenCount     Int
  outputTokenCount    Int
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, conversationId])
}

model ConversationState {
  id                    String   @id @default(cuid())
  conversationId        String   @unique
  userId                 String
  activeGoal             String?  @db.VarChar(300)
  activeQuestionId       String?  @db.VarChar(100)
  pendingActionProposal  Json?
  lastToolNames          String[] @default([])
  stateVersion           Int      @default(1)
  expiresAt              DateTime
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
  @@index([expiresAt])
}
```

同时在 `User` / `Conversation` 增加对应 relation。migration SQL 必须显式创建 enum/table/index/FK，并添加：

```sql
ALTER TABLE "ConversationSummary"
  ADD CONSTRAINT "ConversationSummary_watermark_check" CHECK (
    "coveredThroughOrder" >= 0 AND
    "sourceMessageCount" > 0 AND
    "summaryVersion" > 0 AND
    "inputTokenCount" >= 0 AND
    "outputTokenCount" >= 0
  );

ALTER TABLE "ConversationState"
  ADD CONSTRAINT "ConversationState_version_check" CHECK ("stateVersion" > 0),
  ADD CONSTRAINT "ConversationState_expiry_check" CHECK ("expiresAt" > "createdAt");
```

- [ ] **Step 8: 生成 Prisma client 并完成 6.9.3.1 验证**

```powershell
bun --filter @repo/database prisma:generate
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server build
git diff --check
```

Docker PostgreSQL 已启动时额外运行：

```powershell
$env:POSTGRES_PORT='5433'
bun --filter @repo/database prisma:migrate
bun --filter @repo/database prisma:status
```

Expected: 所有命令退出 0，migration status 为 up to date。

- [ ] **Step 9: 同步 slice 文档、审查、提交、合并、main 复验并推送**

文档必须写明“只完成 contract/database，尚无 prepare API、摘要生成或 Chat 注入”。独立审查重点：
strict schema、内部字段泄露、级联删除、CHECK、索引、旧 API 向后兼容。

```powershell
git add packages/types packages/database AGENTS.md README.md docs/roadmap.md docs/data-flow.md DEVLOG.md
git commit -m "feat(memory): add conversation memory contracts"
git switch main
git merge --no-ff codex/phase-6-9-3-1-conversation-contracts -m "merge: phase 6.9.3.1 conversation contracts"
# 在 main 重跑 Step 8
git push origin main
```

---

## Task 2（Phase 6.9.3.2）：ConversationState、Redis cache 与 prepare API

**Files:**

- Modify: `apps/server/package.json`, `bun.lock`, `apps/server/src/app.module.ts`
- Create: `apps/server/src/conversation-context/conversation-context.module.ts`
- Create: `apps/server/src/conversation-context/conversation-context.controller.ts`
- Create: `apps/server/src/conversation-context/conversation-context.service.ts`
- Create: `apps/server/src/conversation-context/conversation-state-cache.service.ts`
- Create: `apps/server/src/conversation-context/conversation-context.service.spec.ts`
- Create: `apps/server/src/conversation-context/conversation-state-cache.service.spec.ts`
- Create: `apps/server/test/conversation-context.e2e-spec.ts`
- Modify: `apps/server/src/chat-messages/chat-messages.service.ts`
- Modify: `packages/types/src/api/chat-message.ts`
- Modify: `packages/types/tests/chat-message.test.mts`
- Modify: `AGENTS.md`, `README.md`, `DEVLOG.md`
- Modify: `docs/roadmap.md`, `docs/data-flow.md`

- [ ] **Step 1: 从最新 main 建立 6.9.3.2 分支并安装显式依赖**

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/phase-6-9-3-2-conversation-state
bun add --cwd apps/server '@repo/ai@workspace:*' ioredis@^5.10.1
```

`ioredis` 必须成为 server 直接 dependency，不能只依赖 BullMQ 的传递依赖。

- [ ] **Step 2: 写 state/ownership/cache RED 测试**

测试必须覆盖以下具体行为，并至少包含这两个直接调用样例：

```ts
it('returns 404 before reading state for an unowned conversation');
it('upserts only activeGoal and activeQuestionId with a 24h expiry');
it('does not accept pendingActionProposal or lastToolNames from the client');
it('returns an existing unexpired state without changing the version');
it('increments stateVersion when a sanitized patch changes state');
it('falls back to PostgreSQL when Redis misses or throws');
it('rejects invalid cached JSON and never returns cross-user cache data');
it('uses a hashed user/conversation cache key and a 24h maximum TTL');

it('returns 404 before reading state for an unowned conversation', async () => {
  prisma.conversation.findFirst.mockResolvedValue(null);
  await expect(service.prepare('user_2', request)).rejects.toMatchObject({
    code: 'CHAT_CONVERSATION_NOT_FOUND',
    statusCode: 404,
  });
  expect(cache.get).not.toHaveBeenCalled();
  expect(prisma.conversationState.findUnique).not.toHaveBeenCalled();
});

it('falls back to PostgreSQL when Redis throws', async () => {
  cache.get.mockRejectedValue(new Error('raw redis credential text'));
  prisma.conversation.findFirst.mockResolvedValue({ id: 'conv_1' });
  prisma.conversationState.findFirst.mockResolvedValue(stateRecord);
  const result = await service.prepare('user_1', request);
  expect(result.state?.stateVersion).toBe(1);
  expect(JSON.stringify(result)).not.toContain('raw redis credential text');
});
```

Run:

```powershell
bun --filter @repo/server test -- conversation-context conversation-state-cache
```

Expected: FAIL，因为 module/services 不存在。

- [ ] **Step 3: 实现 state cache 的严格边界**

`ConversationStateCacheService` 对外只提供：

```ts
type ConversationStateCache = {
  get(userId: string, conversationId: string): Promise<ConversationStateResponse | null>;
  set(userId: string, value: ConversationStateResponse): Promise<void>;
  delete(userId: string, conversationId: string): Promise<void>;
};
```

key 使用：

```ts
const digest = createHash('sha256').update(`${userId}\u0000${conversationId}`).digest('hex');
return `prepmind:conversation-state:${digest}`;
```

读取必须经过 `conversationStateSchema.safeParse(JSON.parse(raw))`；任何 Redis/JSON/schema 错误返回
`null` 并仅记录固定 `CONVERSATION_STATE_CACHE_READ_FAILED`。写入使用 `SET key json EX ttlSeconds`，
ttl 为 `min(expiresAt-now, 86400)`；不得缓存 summary/message/prompt。

- [ ] **Step 4: 实现 prepare controller 与 state service**

Controller 固定为：

```ts
@Controller('conversation-context')
@UseGuards(JwtAuthGuard)
export class ConversationContextController {
  constructor(private readonly service: ConversationContextService) {}

  @Post('prepare')
  prepare(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.prepare(user.id, conversationContextPrepareRequestSchema.parse(body));
  }
}
```

本 slice 的 `prepare()` 先实现 state + 已存在 summary 读取，不生成新摘要：

```ts
async prepare(userId: string, input: ConversationContextPrepareRequest) {
  const conversation = await this.prisma.conversation.findFirst({
    where: { id: input.conversationId, userId },
    select: { id: true },
  });
  if (!conversation) throw this.notFound();

  const state = await this.resolveState(userId, input);
  const summary = await this.prisma.conversationSummary.findFirst({
    where: { conversationId: input.conversationId, userId },
  });
  const uncoveredMessageCount = await this.prisma.chatMessage.count({
    where: {
      userId,
      conversationId: input.conversationId,
      order: { gt: summary?.coveredThroughOrder ?? -1 },
    },
  });
  return this.mapPrepareResponse(summary, state, uncoveredMessageCount);
}
```

`resolveState()` 先查 cache，miss 回源 PG；有 statePatch 时先 PG upsert/CAS 后 best-effort cache set。
过期 PG state 返回 null 或由 patch 创建新版本，不允许旧 cache 复活。

- [ ] **Step 5: 扩展 chat history 响应以恢复 sanitized state**

`chatMessagesResponseSchema` 新增向后兼容字段：

```ts
state: conversationStateSchema.nullable().optional(),
```

`list/sync` 返回 state 时必须按 `userId + conversationId` 查询，过期则返回 null；不得返回 summary、
pendingActionProposal、lastToolNames、sourceHash 或 cache key。

- [ ] **Step 6: 写并运行 e2e**

`conversation-context.e2e-spec.ts` 使用两个临时账号覆盖：owner prepare 201、other user 404、非法 client
state 字段 400、Redis 不可用仍从 PG 返回、删除 Conversation 后 state/summary cascade。默认使用 Mock，
不调用网络模型。

```powershell
$env:POSTGRES_PORT='5433'
bun --filter @repo/server test -- conversation-context conversation-state-cache
bun --filter @repo/server test:e2e -- conversation-context
bun --filter @repo/server lint
bun --filter @repo/server build
git diff --check
```

- [ ] **Step 7: 文档、独立审查、唯一提交、合并 main 与推送**

审查重点：ownership 查询、客户端字段白名单、Redis key/JSON/TTL、缓存失败降级、删除后不复活、
响应无 summary 内部字段。提交：

```powershell
git commit -m "feat(server): add conversation state prepare API"
```

合并 main 后重跑 Step 6 并推送。

---

## Task 3（Phase 6.9.3.3）：滚动摘要、ModelAgentRuntime 与 source hash + CAS

**Files:**

- Modify: `apps/server/src/config/env.ts`, `env.spec.ts`
- Create: `apps/server/src/conversation-context/conversation-summary.contract.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-policy.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-safety.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-runtime.factory.ts`
- Create: `apps/server/src/conversation-context/conversation-summary.service.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-policy.spec.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-safety.spec.ts`
- Create: `apps/server/src/conversation-context/conversation-summary-runtime.factory.spec.ts`
- Create: `apps/server/src/conversation-context/conversation-summary.service.spec.ts`
- Modify: conversation context module/service/e2e
- Modify: `docker/docker-compose.dev.yml` only for safe Mock defaults; no key
- Modify: `AGENTS.md`, `README.md`, `DEVLOG.md`
- Modify: `docs/roadmap.md`, `docs/data-flow.md`
- Modify: `docs/acceptance-checklist.md`, `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: 从最新 main 建立 6.9.3.3 分支并写 env RED tests**

新增 env 默认/边界测试：

```ts
expect(parseEnv(requiredEnv)).toMatchObject({
  AI_PROVIDER_MODE: 'mock',
  AI_ENABLE_LIVE_CALLS: false,
  CONVERSATION_SUMMARY_MAX_CALLS: 1,
  CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: 1600,
  CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: 400,
  CONVERSATION_SUMMARY_TIMEOUT_MS: 8000,
});
```

非法 budget、非 HTTPS live base URL、live 无 key 必须 fail-closed 或使 runtime unavailable，不能让
server 因默认 Mock 缺 key 启动失败。

- [ ] **Step 2: 写 policy/safety/hash RED tests**

覆盖以下纯函数，测试正文使用实际输入输出：

```ts
expect(
  resolveSummaryTrigger({
    uncoveredMessageCount: 12,
    estimatedFullContextTokens: 500,
    maxInputTokens: 2500,
  }),
).toBe('message_count');

expect(
  resolveSummaryTrigger({
    uncoveredMessageCount: 2,
    estimatedFullContextTokens: 1800,
    maxInputTokens: 2500,
  }),
).toBe('token_pressure');

expect(redactSummaryCredentials('Authorization: Bearer example-secret-token-value')).toContain(
  '[REDACTED]',
);

const messages = [
  { id: 'u1', order: 0, role: 'USER' as const, content: 'question' },
  { id: 'a1', order: 1, role: 'ASSISTANT' as const, content: 'answer' },
];
expect(hashSummarySource(messages)).not.toBe(
  hashSummarySource([{ ...messages[0], content: 'changed' }, ...messages.slice(1)]),
);

expect(
  selectCompleteSummaryTarget([
    { id: 'u1', order: 0, role: 'USER', content: 'question' },
    { id: 'a1', order: 1, role: 'ASSISTANT', content: 'answer' },
    { id: 'u2', order: 2, role: 'USER', content: 'unfinished' },
  ]),
).toEqual({ coveredThroughOrder: 1, sourceMessageCount: 2 });
```

Run:

```powershell
bun --filter @repo/server test -- conversation-summary-policy conversation-summary-safety
```

Expected: RED，模块不存在。

- [ ] **Step 3: 实现 strict summary schema 与安全纯函数**

`conversation-summary.contract.ts`：

```ts
export const conversationSummaryOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(4_000),
  })
  .strict();
export const CONVERSATION_SUMMARY_PROMPT_VERSION = 'conversation-summary-v1';
```

trigger 使用 `uncovered >= 12` 优先，否则 `estimated >= floor(max * 0.7)`；token/max 非安全整数返回
`none`。目标水位必须停在最新完整 assistant 消息，永不覆盖 user-only tail。source hash 使用稳定 JSON
数组 `[id, order, role, content]` 与 `sha256:<64 hex>`。

安全模块在 provider 前替换 bearer/key/cookie/credential-like 片段；输出再次扫描，命中返回固定
`CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED`，不记录命中原文。

- [ ] **Step 4: 写 ModelAgentRuntime Mock/Live RED tests**

测试注入 fake executor，按以下实际调用形状覆盖：

```ts
it('uses task conversation_summary and strict schema in mock and live');
it('blocks live when AI_ENABLE_LIVE_CALLS is false before budget reservation');
it('uses one call and reserves max output before invoking provider');
it('maps timeout/schema/provider errors to bounded summary error codes');
it('never exposes prompt, message content, key, baseURL or raw error');

const result = await createSummaryRuntime({
  mode: 'live',
  liveCallsEnabled: false,
  executor: async () => {
    calls += 1;
    return { object: { summary: 'must not run' } };
  },
}).invokeStructured({
  runId: 'summary_run_1',
  task: 'conversation_summary',
  schema: conversationSummaryOutputSchema,
  systemPrompt: 'fixed summary instruction',
  userPrompt: 'synthetic redacted conversation',
  estimatedInputTokens: 120,
  maxOutputTokens: 80,
  budget: createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 1600,
    maxOutputTokens: 400,
  }),
});
expect(result.ok).toBe(false);
if (result.ok) throw new Error('expected live guard');
expect(result.error.code).toBe('LIVE_CALLS_DISABLED');
expect(result.budget.usedCalls).toBe(0);
expect(calls).toBe(0);
```

- [ ] **Step 5: 实现 server composition root**

`conversation-summary-runtime.factory.ts` 读取已解析 `ServerEnv`，Mock 时注入 deterministic responder；
Live 时仅在双开关、provider、key、HTTPS URL、model 全部有效时创建
`createOpenAICompatibleStructuredExecutor()`。`@repo/ai` 不读取 env。

`env.ts` 增加并锁定这些字段：

```ts
AI_PROVIDER_MODE: z.enum(['mock', 'live']).default('mock'),
AI_ENABLE_LIVE_CALLS: booleanStringSchema.default(false),
AI_MODEL: z.string().min(1).max(120).default('deepseek-v4-flash'),
AI_BASE_URL: z.string().url().default('https://api.deepseek.com/v1'),
DEEPSEEK_API_KEY: optionalNonEmptyStringSchema,
CONVERSATION_SUMMARY_MAX_CALLS: z.coerce.number().int().min(1).max(1).default(1),
CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: z.coerce.number().int().min(200).max(4000).default(1600),
CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(50).max(800).default(400),
CONVERSATION_SUMMARY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(8000),
```

`superRefine` 在 `AI_PROVIDER_MODE=live && AI_ENABLE_LIVE_CALLS=true` 时要求 HTTPS base URL、可识别
provider 与对应 key；Mock 或 live gate 关闭时不要求 key，保证默认 server 可启动。

runtime budget 每次 prepare 新建：

```ts
createModelAgentBudget({
  maxCalls: env.CONVERSATION_SUMMARY_MAX_CALLS,
  maxInputTokens: env.CONVERSATION_SUMMARY_MAX_INPUT_TOKENS,
  maxOutputTokens: env.CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS,
});
```

- [ ] **Step 6: 写 summary orchestration 与并发 CAS RED tests**

必须覆盖：首次 create、增量 update、旧摘要复用、12 条/70% 触发、user-only tail 不被覆盖、模型失败不推进、credential output
不推进、target range 内容变化 stale、只新增更高 order 仍可推进、两个并发请求仅一个 CAS 成功、
first-create unique conflict 返回 `cas_conflict`。

- [ ] **Step 7: 实现事务外模型调用 + 事务内复核/CAS**

核心顺序必须固定：

```ts
const snapshot = await repository.readSnapshot(userId, conversationId);
const trigger = resolveSummaryTrigger(...);
if (trigger === 'none') return reuse(snapshot);

const sourceHash = hashSummarySource(snapshot.targetMessages);
const modelResult = await runtime.invokeStructured(buildSummaryRequest(snapshot));
if (!modelResult.ok) return degraded(snapshot, modelResult.error.code);
assertSafeSummaryOutput(modelResult.data.summary);

const persisted = await prisma.$transaction(async (tx) => {
  const currentMessages = await repository.readTargetMessages(tx, snapshot);
  if (hashSummarySource(currentMessages) !== sourceHash) return 'stale_snapshot';
  return repository.compareAndSwapSummary(tx, snapshot, modelResult);
});
```

不得在模型调用期间开启 Prisma transaction；CAS conflict 后不得在同一请求重复调用模型。

- [ ] **Step 8: 完整 Mock e2e 与验证**

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='false'
$env:POSTGRES_PORT='5433'
bun --filter @repo/server test -- conversation-summary conversation-context
bun --filter @repo/server test:e2e -- conversation-context
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
git diff --check
```

- [ ] **Step 9: 独立审查、文档、唯一提交、main 复验推送**

审查重点：原始错误/消息/key 泄露、source hash 稳定性、snapshot 范围、first-create race、CAS retry、
预算 fail-open、provider config、模型调用是否误进事务。提交：

```powershell
git commit -m "feat(ai): add rolling conversation summaries"
```

---

## Task 4（Phase 6.9.3.4）：Web prepare 接入、分层 assembler 与 Dexie 恢复

**Files:**

- Create: `apps/web/src/lib/conversation-context-api.ts`
- Create: `apps/web/src/lib/conversation-context-api.test.mts`
- Create: `apps/web/src/lib/context-budget-assembler.ts`
- Create: `apps/web/src/lib/context-budget-assembler.test.mts`
- Modify: `apps/web/src/lib/chat-api-policy.ts`, tests
- Modify: `apps/web/src/lib/ai-usage-guard.ts`, tests
- Modify: `apps/web/src/lib/chat-context.ts`, tests
- Modify: `apps/web/src/app/api/chat/route.ts`
- Modify: `apps/web/src/components/providers/chat-runtime-provider.tsx`
- Modify: `apps/web/src/lib/chat-message-api.ts`, tests
- Modify: `apps/web/src/lib/db.ts`
- Create: `apps/web/src/lib/conversation-state-cache.ts`, test
- Modify: Agent Trace payload tests
- Modify: `AGENTS.md`, `README.md`, `DEVLOG.md`
- Modify: `docs/roadmap.md`, `docs/data-flow.md`
- Modify: `docs/acceptance-checklist.md`, `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: 从最新 main 建立 6.9.3.4 分支并写 request/prepare RED tests**

`parseChatApiRequestBody()` 必须接受有界 optional `conversationId`，非法类型/空白/超长返回 400。
`ChatRuntimeProvider` request body 增加当前 state 中的 conversationId：

```ts
body: ({ messages }) => ({
  messages,
  conversationId: conversationIdRef.current,
  activeContext: activeStudyContextRef.current,
  accessToken: accessTokenRef.current,
}),
```

先写测试并运行：

```powershell
bun --filter @repo/web test -- chat-api-policy conversation-context-api
```

Expected: RED。

- [ ] **Step 2: 实现 authenticated prepare client 与安全降级**

`prepareConversationContext()` 使用 `apiClient.post` 调 Nest API，response 必须经
`conversationContextPrepareResponseSchema.parse()`。Next route 仅在 accessToken + conversationId
同时存在时调用，timeout 为 `CONVERSATION_CONTEXT_PREPARE_TIMEOUT_MS`（默认 10 秒，有界
1~15 秒），请求 abort 向下转发。

任何 network/timeout/5xx/schema error 返回：

```ts
{
  summaryBuffer: null,
  state: null,
  summaryStatus: 'degraded',
  summaryVersion: null,
  safeErrorCode: 'CONVERSATION_CONTEXT_PREPARE_FAILED',
}
```

warning 不得打印 access token、response body、summary 或 raw error。

- [ ] **Step 3: 写分层 assembler RED tests**

覆盖以下不变量，并加入实际优先级断言：

```ts
it('never drops the latest non-empty user message');
it('returns 413 metadata when mandatory content alone exceeds max input');
it('keeps current OCR question text before RAG and summary');
it('keeps recent complete turns in chronological order');
it('caps summary at 15 percent and 400 tokens');
it('caps safe RAG at 25 percent and drops it as a whole when unsafe to truncate');
it('reclaims unused optional lanes for more recent messages before RAG');
it('does not include summary when no history was dropped');
it('returns only token counts, versions and bounded dropped-layer codes');

const assembled = assembleChatContext({
  baseSystemPrompt: 'base',
  activeStudyContext: { type: 'ocr-question', questionText: 'current OCR question' },
  recentMessages: [
    { role: 'user', content: 'old question'.repeat(80) },
    { role: 'assistant', content: 'old answer'.repeat(80) },
    { role: 'user', content: 'latest user question' },
  ],
  safeRagContext: 'rag context'.repeat(100),
  summaryBuffer: 'old summary'.repeat(100),
  summaryVersion: 2,
  summaryStatus: 'reused',
  maxInputTokens: 300,
  maxOutputTokens: 400,
});
expect(assembled.modelMessages.at(-1)?.content).toBe('latest user question');
expect(assembled.systemPrompt).toContain('current OCR question');
expect(assembled.estimatedInputTokens).toBeLessThanOrEqual(300);
expect(JSON.stringify(assembled.contextPolicy)).not.toContain('old summary');
```

Run:

```powershell
bun --filter @repo/web test -- context-budget-assembler ai-usage-guard chat-context
```

Expected: RED，新 assembler 不存在或旧 budget 行为不符合层级。

- [ ] **Step 4: 实现纯函数 Context Budget Assembler**

公共输入分层：

```ts
type AssembleChatContextInput = {
  baseSystemPrompt: string;
  agentGuidance?: string;
  activeStudyContext?: ActiveStudyContext | null;
  recentMessages: ChatContextMessage[];
  safeRagContext?: string;
  summaryBuffer?: string | null;
  summaryVersion?: number | null;
  summaryStatus?: ConversationSummaryStatus;
  maxInputTokens: number;
  maxOutputTokens: number;
};
```

固定优先级：mandatory base/latest user -> agent/OCR -> recent complete turns -> safe RAG -> summary ->
unused lane reclaim recent/RAG。summary 只有存在 dropped history 时才加入。输出必须兼容现有
`ChatRequestBudget`，并增加 strict `layerTokenCounts/droppedLayers/summaryVersion/summaryStatus`。

删除 `combineChatAdditionalPrompts()` 对 RAG/Agent 的不可区分拼接依赖；Router/Tutor guidance 与 RAG
作为独立 layer 传入。

- [ ] **Step 5: 把 prepare + assembler 接入 `/api/chat`**

顺序固定：请求验证 -> provider/live auth -> prepare context -> Router/RAG -> assembler -> 413 -> trace ->
mock/live streaming。prepare 返回 summary 只在 server-side 使用，不写回浏览器正文。

response headers 增加安全状态：

```text
x-prepmind-conversation-summary-status
x-prepmind-conversation-summary-version
x-prepmind-context-dropped-layers
```

不得增加 summary content/header。Agent Trace 只写 context policy metadata。

- [ ] **Step 6: Dexie v9 sanitized state 恢复**

`db.ts` 增加：

```ts
export interface StoredConversationState {
  id: string; // `${userId}:${conversationId}`
  userId: string;
  conversationId: string;
  activeGoal: string | null;
  activeQuestionId: string | null;
  stateVersion: number;
  expiresAt: string;
  updatedAt: string;
}
```

Dexie v9 store：

```ts
conversationStates: '&id, userId, [userId+conversationId], expiresAt, updatedAt';
```

现有 `GET /chat-messages` 与 sync response 中 optional sanitized state 写入 cache；服务端 version >= local
才覆盖，过期 local 不恢复。用户登出/清会话时删除对应缓存。不得缓存 summary、pendingActionProposal、
lastToolNames、prompt 或 token。

- [ ] **Step 7: Web 全量验证与构建**

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --cwd packages/types typecheck
bun --filter @repo/server test -- conversation-context
bun --filter @repo/server build
git diff --check
```

- [ ] **Step 8: 独立审查、文档、唯一提交、main 复验推送**

审查重点：latest user 是否会丢、百分比整数/NaN fail-open、完整轮次、RAG 截断安全、summary 泄露、
prepare abort、headers、Dexie 跨用户/过期/版本覆盖。提交：

```powershell
git commit -m "feat(web): assemble layered chat context"
```

本 slice 改动真实 Chat 行为，功能分支与 main 均启动 Mock 项目并使用 headed 可见浏览器检查 Chat；
真实 Live 摘要留给 Task 5。

---

## Task 5（Phase 6.9.3.5）：Docker、受控 Live、清理与阶段文档收口

**Files:**

- Create: `docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `AGENTS.md`, `README.md`, `DEVLOG.md`
- Modify: `docs/roadmap.md`, `docs/data-flow.md`
- Modify: `docs/acceptance-checklist.md`, `docs/ai-behavior-acceptance.md`
- Modify implementation/tests only when acceptance exposes a real defect; any fix must先 RED

- [ ] **Step 1: 从最新 main 建立 6.9.3.5 分支并检查秘密边界**

```powershell
git switch main
git pull --ff-only origin main
git switch -c codex/phase-6-9-3-5-live-acceptance
git status --short --branch
git grep -n "DEEPSEEK_API_KEY\|OPENAI_API_KEY" -- ':!*.env*'
```

Expected: 只出现变量名/脱敏测试，不出现真实 key。Compose 只声明变量透传和 Mock 默认，不写 key。

- [ ] **Step 2: Docker Mock 全栈启动与机器检查**

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
docker compose -f docker/docker-compose.dev.yml --profile worker ps
curl.exe -fsS http://127.0.0.1:3001/health
```

Expected: server/web/admin/worker 与基础设施启动；worker healthy；API health 成功。

- [ ] **Step 3: Mock API 级长会话验收**

创建临时账号，同步至少 12 条合成完整消息，调用 prepare，断言：

```text
summaryStatus=generated
summaryVersion=1
coveredThroughOrder=目标水位
summaryBuffer 非空但不含 credential-like 输入
第二次 prepare 为 reused/not_needed
other user 同 conversationId 为 404
```

然后修改目标范围消息，使用并发测试确认 stale/CAS 不误推进。验收输出只记录 id hash、status、version、
watermark、token count 和固定 error code。

- [ ] **Step 4: Headed 可见浏览器 Mock 验收**

使用 webapp-testing/Playwright headed 模式打开 `http://127.0.0.1:3000`，让用户可共同观察：

1. 注册临时账号并连续完成长对话；
2. response headers/Agent Trace 显示 summary status/version 和 layer counts；
3. 早期内容离开近期窗口后，Mock 链路仍显示 summaryIncluded；
4. 页面无 console/page error、无横向溢出、Chat streaming 保持正常；
5. 不在 UI、Network headers 或 Trace 显示 summary 正文。

- [ ] **Step 5: 受控 Live 小样本**

确认用户本机安全 env 已配置后，仅临时设置：

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_MAX_INPUT_TOKENS='2500'
$env:AI_MAX_OUTPUT_TOKENS='1200'
$env:CONVERSATION_SUMMARY_MAX_CALLS='1'
$env:CONVERSATION_SUMMARY_MAX_INPUT_TOKENS='1600'
$env:CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS='400'
```

禁止输出 key。重建 server/web 后，用 headed 浏览器运行固定合成样本：早期表达学习目标或纠正 -> 至少
12 条完整消息 -> 触发 summary -> 询问早期信息。记录 provider/model、promptVersion、status/version、
输入输出 token、耗时、是否正确保留目标/纠正、是否错误升级为长期偏好。

Live 通过条件：summary schema valid；无 credential retention；一次调用预算内；最终回答能利用摘要；
summary 失败时 Chat 仍可回答；没有完整 prompt/output/key 进入日志/Trace/报告。

- [ ] **Step 6: 恢复 Mock 并清理**

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='false'
```

删除临时用户以级联清理 Conversation/ChatMessage/Summary/State，验证 Redis cache key 不再返回；清理
浏览器 local state/Dexie 测试记录。不得删除用户原有数据或停止用户未授权的 Docker 服务。

- [ ] **Step 7: 全套验证**

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/ai test
bun --cwd packages/ai typecheck
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
git diff --check
```

每个 native command 显式检查 `$LASTEXITCODE`；任何失败先修复并重跑，不得用局部通过推断全绿。

- [ ] **Step 8: 写高质量验收记录与阶段文档**

`docs/acceptance/2026-07-11-phase-6-9-3-conversation-memory.md` 必须记录：

- Git SHA、Docker services、Mock/Live provider/model/promptVersion（无 key/baseURL）；
- 12 条与 70% 两种触发、CAS/stale、多用户、Redis/Dexie 降级；
- layer token count、summary version/watermark、Live token/耗时和清理结果；
- “Mock 证明工程 contract，Live 小样本证明本次摘要体验，不证明所有长对话质量”；
- 已恢复 Mock、已删除临时账号/会话/summary/state/cache。

项目文档明确 Phase 6.9.3 完成、下一任务 Phase 6.9.4 Router/Verifier 混合路径；Phase 6.9.7 详细
面试学习博客继续保留。

- [ ] **Step 9: 独立最终审查、唯一提交、合并 main、main 复验并推送**

独立审查覆盖全阶段 diff 与真实验收证据，Critical/Important 必须清零。提交：

```powershell
git add docker AGENTS.md README.md DEVLOG.md docs apps packages bun.lock
git commit -m "docs(ai): close phase 6.9.3 acceptance"
git switch main
git merge --no-ff codex/phase-6-9-3-5-live-acceptance -m "merge: phase 6.9.3 conversation memory"
```

在 main 重跑 Step 2、4、5、6、7 的适用验收，最后：

```powershell
git push origin main
git rev-parse main
git rev-parse origin/main
git ls-remote origin refs/heads/main
```

三个 SHA 必须一致后删除本地分支。

---

## 全阶段完成定义

只有同时满足以下条件，Phase 6.9.3 才能标记完成：

- contracts、Prisma migration、prepare/state/cache、summary CAS、Web assembler、Dexie 恢复全部合入 main；
- Mock、Docker、headed 浏览器、受控 Live 和多用户隔离证据齐全；
- summary/model/cache 任一失败都不阻断 Chat；
- 最新问题、OCR 当前题目和最近完整轮次不会被 summary/RAG 挤掉；
- PostgreSQL 是权威，Redis/Dexie 不会跨用户、过期复活或覆盖更高版本；
- summary 不含 credential-like 数据，不升级为长期记忆，不进入 Trace 原文；
- 临时账号、会话、summary/state/cache、Dexie 数据已清理，AI mode 已恢复 Mock；
- 功能分支和 main 均完成验收，main 已推送且 SHA 核对一致；
- 文档能回答设计文档列出的五个回顾问题，并明确下一步 Phase 6.9.4。
