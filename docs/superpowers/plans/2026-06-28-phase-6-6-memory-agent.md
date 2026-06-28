# Phase 6.6 MemoryAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first MemoryAgent loop: deterministic memory candidates, user approval, revocation, and profile-page management.

**Architecture:** Keep `@repo/agent` pure and deterministic. Put API contracts in `@repo/types`, persistence in Prisma/PostgreSQL, orchestration in NestJS, and management UI in `/profile`. Do not inject memories into `/api/chat` in this phase.

**Tech Stack:** Bun workspaces, TypeScript strict, Zod, Prisma, NestJS, Next.js 16, React 19, TanStack Query, Tailwind 4.

---

## Commit Discipline

The user requires a commit after each completed step. Treat each task below as one commit boundary. Before each commit, run the task-specific verification command and use a subagent or independent review pass to check the diff.

## File Map

### Types and Agent

- Create `packages/types/src/api/memory-agent.ts`: Zod schemas for candidates, memories, requests, query params, and responses.
- Modify `packages/types/src/api/index.ts`: export memory-agent contract.
- Modify `packages/types/package.json`: add `./api/memory-agent` subpath.
- Create `packages/types/tests/memory-agent.test.mts`: schema behavior tests.
- Create `packages/types/tests/memory-agent-runtime-import.test.mts`: runtime subpath import guard.
- Replace `packages/agent/src/nodes/memory.ts`: deterministic memory candidate policy.
- Delete or simplify `packages/agent/src/memory/index.ts` if it remains an unused stub.
- Modify `packages/agent/src/index.ts`: export memory policy.
- Modify `packages/agent/package.json`: add `./memory` export.
- Create `packages/agent/tests/memory.test.ts`: policy tests.

### Database

- Modify `packages/database/prisma/schema.prisma`: add `UserMemoryType`, `UserMemoryCandidateStatus`, `UserMemoryStatus`, `UserMemoryCandidate`, `UserMemory`, and `User` relations.
- Create `packages/database/prisma/migrations/20260628000000_add_user_memories/migration.sql`: SQL migration.

### Server

- Create `apps/server/src/memory-agent/memory-agent.module.ts`
- Create `apps/server/src/memory-agent/memory-agent.controller.ts`
- Create `apps/server/src/memory-agent/memory-agent.service.ts`
- Create `apps/server/src/memory-agent/memory-agent.service.spec.ts`
- Modify `apps/server/src/app.module.ts`: import `MemoryAgentModule`.

### Web

- Create `apps/web/src/lib/memory-agent-api.ts`
- Create `apps/web/src/lib/memory-agent-api.test.mts`
- Create `apps/web/src/lib/memory-agent-query-keys.ts`
- Create `apps/web/src/lib/memory-agent-query-keys.test.mts`
- Create `apps/web/src/hooks/use-memory-agent.ts`
- Create `apps/web/src/components/memory-agent/memory-agent-panel.tsx`
- Create `apps/web/src/lib/memory-agent-ui-integration.test.mts`
- Modify `apps/web/src/app/(main)/profile/page.tsx`

### Docs

- Modify `AGENTS.md`
- Modify `README.md`
- Modify `docs/data-flow.md`
- Modify `docs/roadmap.md`
- Modify `DEVLOG.md`

---

## Task 1: Types and Deterministic Agent Policy

**Files:**

- Create: `packages/types/src/api/memory-agent.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Create: `packages/types/tests/memory-agent.test.mts`
- Create: `packages/types/tests/memory-agent-runtime-import.test.mts`
- Modify: `packages/agent/src/nodes/memory.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`
- Create: `packages/agent/tests/memory.test.ts`

- [ ] **Step 1: Write the failing type schema test**

Create `packages/types/tests/memory-agent.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  generateMemoryCandidatesRequestSchema,
  memoryCandidateListQuerySchema,
  memoryCandidateSchema,
  memoryCandidateStatusSchema,
  userMemoryListQuerySchema,
  userMemorySchema,
  userMemoryTypeSchema,
} from '../src/api/memory-agent';

testEnums();
testQueryDefaults();
testCandidatePayload();
testMemoryPayload();

function testEnums() {
  assert.equal(userMemoryTypeSchema.parse('WEAK_POINT'), 'WEAK_POINT');
  assert.equal(memoryCandidateStatusSchema.parse('PENDING'), 'PENDING');
  assert.throws(() => userMemoryTypeSchema.parse('RANDOM_NOTE'));
}

function testQueryDefaults() {
  assert.deepEqual(memoryCandidateListQuerySchema.parse({}), {
    status: 'PENDING',
    limit: 20,
  });
  assert.deepEqual(userMemoryListQuerySchema.parse({}), {
    status: 'ACTIVE',
  });
  assert.deepEqual(generateMemoryCandidatesRequestSchema.parse({}), {
    source: 'profile',
    force: false,
  });
  assert.throws(() => memoryCandidateListQuerySchema.parse({ limit: 0 }));
  assert.throws(() => memoryCandidateListQuerySchema.parse({ limit: 51 }));
}

function testCandidatePayload() {
  const parsed = memoryCandidateSchema.parse({
    id: 'candidate_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先提示再给完整答案。',
    reason: '用户在聊天中明确表达了这个偏好。',
    evidence: [{ sourceType: 'chat', sourceId: 'msg_1', summary: '以后先给我提示' }],
    confidence: 0.86,
    status: 'PENDING',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    decidedAt: null,
  });

  assert.equal(parsed.type, 'EXPLANATION_PREFERENCE');
  assert.equal(parsed.evidence[0]?.sourceType, 'chat');
}

function testMemoryPayload() {
  const parsed = userMemorySchema.parse({
    id: 'memory_1',
    userId: 'user_1',
    type: 'WEAK_POINT',
    title: '导数应用薄弱',
    content: '用户在导数应用题中多次出现审题错误。',
    status: 'ACTIVE',
    confidence: 0.82,
    lastUsedAt: null,
    archivedAt: null,
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  });

  assert.equal(parsed.status, 'ACTIVE');
}
```

- [ ] **Step 2: Write the failing runtime import test**

Create `packages/types/tests/memory-agent-runtime-import.test.mts`:

```ts
const memoryAgentModule = await import('../src/api/memory-agent.ts');

if (typeof memoryAgentModule.userMemorySchema?.parse !== 'function') {
  throw new Error('userMemorySchema should be available at runtime');
}

if (typeof memoryAgentModule.memoryCandidateSchema?.parse !== 'function') {
  throw new Error('memoryCandidateSchema should be available at runtime');
}
```

- [ ] **Step 3: Run type tests and verify they fail**

Run:

```powershell
bun test packages/types/tests/memory-agent.test.mts packages/types/tests/memory-agent-runtime-import.test.mts
```

Expected: fails because `../src/api/memory-agent` does not exist.

- [ ] **Step 4: Add the memory-agent contract**

Create `packages/types/src/api/memory-agent.ts` with these exported schemas and types:

```ts
import { z } from 'zod';

export const userMemoryTypeSchema = z.enum([
  'LEARNING_GOAL',
  'EXPLANATION_PREFERENCE',
  'WEAK_POINT',
  'STUDY_HABIT',
]);

export const memoryCandidateStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

export const userMemoryStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const memoryEvidenceSchema = z.object({
  sourceType: z.enum(['chat', 'wrong-question', 'review', 'preference']),
  sourceId: z.string().min(1).optional(),
  summary: z.string().min(1),
});

export const memoryCandidateSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: userMemoryTypeSchema,
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
  evidence: z.array(memoryEvidenceSchema).min(1).max(5),
  confidence: z.number().min(0).max(1),
  status: memoryCandidateStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});

export const userMemorySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: userMemoryTypeSchema,
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(500),
  status: userMemoryStatusSchema,
  confidence: z.number().min(0).max(1),
  lastUsedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const memoryCandidateListQuerySchema = z.object({
  status: memoryCandidateStatusSchema.default('PENDING'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const memoryCandidateListResponseSchema = z.object({
  items: z.array(memoryCandidateSchema),
});

export const generateMemoryCandidatesRequestSchema = z.object({
  source: z.enum(['profile', 'manual']).default('profile'),
  force: z.boolean().default(false),
});

export const generateMemoryCandidatesResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  createdCount: z.number().int().nonnegative(),
  candidates: z.array(memoryCandidateSchema),
  summary: z.string().min(1),
});

export const acceptMemoryCandidateResponseSchema = z.object({
  candidate: memoryCandidateSchema,
  memory: userMemorySchema,
});

export const rejectMemoryCandidateResponseSchema = z.object({
  candidate: memoryCandidateSchema,
});

export const userMemoryListQuerySchema = z.object({
  status: z.union([userMemoryStatusSchema, z.literal('all')]).default('ACTIVE'),
  type: userMemoryTypeSchema.optional(),
});

export const userMemoryListResponseSchema = z.object({
  items: z.array(userMemorySchema),
});

export const updateUserMemoryRequestSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    content: z.string().min(1).max(500).optional(),
    status: userMemoryStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const deleteUserMemoryResponseSchema = z.object({
  ok: z.literal(true),
});

export type UserMemoryType = z.infer<typeof userMemoryTypeSchema>;
export type MemoryCandidateStatus = z.infer<typeof memoryCandidateStatusSchema>;
export type UserMemoryStatus = z.infer<typeof userMemoryStatusSchema>;
export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export type UserMemory = z.infer<typeof userMemorySchema>;
export type MemoryCandidateListQuery = z.infer<typeof memoryCandidateListQuerySchema>;
export type MemoryCandidateListResponse = z.infer<typeof memoryCandidateListResponseSchema>;
export type GenerateMemoryCandidatesRequest = z.infer<
  typeof generateMemoryCandidatesRequestSchema
>;
export type GenerateMemoryCandidatesResponse = z.infer<
  typeof generateMemoryCandidatesResponseSchema
>;
export type AcceptMemoryCandidateResponse = z.infer<
  typeof acceptMemoryCandidateResponseSchema
>;
export type RejectMemoryCandidateResponse = z.infer<
  typeof rejectMemoryCandidateResponseSchema
>;
export type UserMemoryListQuery = z.infer<typeof userMemoryListQuerySchema>;
export type UserMemoryListResponse = z.infer<typeof userMemoryListResponseSchema>;
export type UpdateUserMemoryRequest = z.infer<typeof updateUserMemoryRequestSchema>;
```

Modify `packages/types/src/api/index.ts`:

```ts
export * from './memory-agent';
```

Modify `packages/types/package.json` exports:

```json
"./api/memory-agent": "./src/api/memory-agent.ts"
```

- [ ] **Step 5: Run type tests and typecheck**

Run:

```powershell
bun test packages/types/tests/memory-agent.test.mts packages/types/tests/memory-agent-runtime-import.test.mts
bun --cwd packages/types typecheck
```

Expected: both pass.

- [ ] **Step 6: Write failing agent policy tests**

Create `packages/agent/tests/memory.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { analyzeMemory, memoryNode } from '../src/index';

describe('analyzeMemory', () => {
  it('creates an explanation preference from explicit preference text', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [
        {
          conversationId: 'conv_1',
          messageId: 'msg_1',
          text: '以后讲题先给我一点提示，不要直接给完整答案',
          createdAt: '2026-06-28T00:00:00.000Z',
        },
      ],
      weakPointSignals: [],
      reviewSignals: { consecutiveActiveDays: 1, totalReviewsInWindow: 3 },
      existingMemories: [],
    });

    expect(result.candidates[0]?.type).toBe('EXPLANATION_PREFERENCE');
    expect(result.candidates[0]?.content).toContain('先提示');
    expect(result.signals).toContain('explicitPreference');
  });

  it('creates a weak point memory only after repeated signals', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [],
      weakPointSignals: [
        {
          label: '导数应用',
          subject: '数学',
          wrongCount: 4,
          recentAgainCount: 2,
        },
      ],
      reviewSignals: { consecutiveActiveDays: 2, totalReviewsInWindow: 8 },
      existingMemories: [],
    });

    expect(result.candidates[0]?.type).toBe('WEAK_POINT');
    expect(result.candidates[0]?.content).toContain('导数应用');
    expect(result.signals).toContain('repeatedWeakPoint');
  });

  it('skips one-off weak signals and duplicate existing memories', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [{ conversationId: 'c', messageId: 'm', text: '这题不会', createdAt: '2026-06-28T00:00:00.000Z' }],
      weakPointSignals: [{ label: '数列', wrongCount: 1, recentAgainCount: 0 }],
      reviewSignals: { consecutiveActiveDays: 1, totalReviewsInWindow: 1 },
      existingMemories: [{ type: 'WEAK_POINT', content: '用户在导数应用题中多次出现审题错误。' }],
    });

    expect(result.candidates).toEqual([]);
    expect(result.signals).toContain('insufficientSignals');
  });

  it('exports memory policy from the package root', () => {
    expect(memoryNode).toBe(analyzeMemory);
  });
});
```

- [ ] **Step 7: Run agent tests and verify they fail**

Run:

```powershell
bun --cwd packages/agent test tests/memory.test.ts
```

Expected: fails because `analyzeMemory` is not exported.

- [ ] **Step 8: Implement deterministic memory policy**

Replace `packages/agent/src/nodes/memory.ts`:

```ts
import type {
  MemoryEvidence,
  UserMemoryType,
} from '@repo/types/api/memory-agent';

export type MemoryAgentInput = {
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

export type MemoryCandidateDraft = {
  type: UserMemoryType;
  title: string;
  content: string;
  reason: string;
  evidence: MemoryEvidence[];
  confidence: number;
};

export type MemoryAgentResult = {
  candidates: MemoryCandidateDraft[];
  signals: string[];
};

const MAX_CANDIDATES = 5;

export function analyzeMemory(input: MemoryAgentInput): MemoryAgentResult {
  const candidates: MemoryCandidateDraft[] = [];
  const signals = new Set<string>();

  addProfileGoal(input, candidates, signals);
  addExplicitPreference(input, candidates, signals);
  addWeakPoint(input, candidates, signals);
  addStudyHabit(input, candidates, signals);

  const uniqueCandidates = candidates
    .filter((candidate) => !hasExistingMemory(input, candidate))
    .slice(0, MAX_CANDIDATES);

  if (uniqueCandidates.length === 0) {
    signals.add('insufficientSignals');
  }

  return {
    candidates: uniqueCandidates,
    signals: [...signals],
  };
}

function addProfileGoal(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const goal = input.profilePreference?.examGoal?.trim();
  if (!goal) return;

  candidates.push({
    type: 'LEARNING_GOAL',
    title: '学习目标',
    content: `用户当前的备考目标是：${goal}。`,
    reason: '用户在个人档案中填写了稳定备考目标。',
    evidence: [{ sourceType: 'preference', summary: `备考目标：${goal}` }],
    confidence: 0.9,
  });
  signals.add('profileGoal');
}

function addExplicitPreference(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const message = input.recentChatSignals.find((item) =>
    /以后|下次|总是|先.*提示|不要直接|苏格拉底|详细/.test(item.text),
  );
  if (!message) return;

  candidates.push({
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先给提示或思路，再给完整答案。',
    reason: '用户在聊天中明确表达了讲解方式偏好。',
    evidence: [{ sourceType: 'chat', sourceId: message.messageId, summary: message.text.slice(0, 80) }],
    confidence: 0.86,
  });
  signals.add('explicitPreference');
}

function addWeakPoint(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const weakPoint = [...input.weakPointSignals].sort(
    (left, right) =>
      right.recentAgainCount - left.recentAgainCount ||
      right.wrongCount - left.wrongCount ||
      left.label.localeCompare(right.label, 'zh-Hans-CN'),
  )[0];

  if (!weakPoint || (weakPoint.wrongCount < 3 && weakPoint.recentAgainCount < 2)) return;

  const subjectPrefix = weakPoint.subject ? `${weakPoint.subject} ` : '';
  candidates.push({
    type: 'WEAK_POINT',
    title: `${weakPoint.label}薄弱点`,
    content: `用户在${subjectPrefix}${weakPoint.label}相关题目中反复出错，适合后续优先复盘。`,
    reason: `该知识点累计错题 ${weakPoint.wrongCount} 道，近期 Again ${weakPoint.recentAgainCount} 次。`,
    evidence: [{ sourceType: 'wrong-question', summary: `${weakPoint.label} 重复出错` }],
    confidence: weakPoint.recentAgainCount >= 2 ? 0.84 : 0.76,
  });
  signals.add('repeatedWeakPoint');
}

function addStudyHabit(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  if (input.reviewSignals.consecutiveActiveDays < 7) return;

  const time = input.reviewSignals.preferredReviewTime;
  candidates.push({
    type: 'STUDY_HABIT',
    title: '稳定复习习惯',
    content: time
      ? `用户已连续学习一周，常用复习时间接近 ${time}。`
      : '用户已连续学习一周，适合保持稳定的短周期复习节奏。',
    reason: '连续活跃天数达到长期习惯候选阈值。',
    evidence: [{ sourceType: 'review', summary: `连续活跃 ${input.reviewSignals.consecutiveActiveDays} 天` }],
    confidence: 0.72,
  });
  signals.add('studyHabit');
}

function hasExistingMemory(input: MemoryAgentInput, candidate: MemoryCandidateDraft) {
  const normalizedContent = normalizeText(candidate.content);
  return input.existingMemories.some(
    (memory) =>
      memory.type === candidate.type &&
      (normalizeText(memory.content).includes(normalizedContent) ||
        normalizedContent.includes(normalizeText(memory.content))),
  );
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

export const memoryNode = analyzeMemory;
```

Modify `packages/agent/src/index.ts`:

```ts
export * from './nodes/memory.ts';
```

Modify `packages/agent/package.json` exports:

```json
"./memory": "./src/nodes/memory.ts"
```

- [ ] **Step 9: Run task verification**

Run:

```powershell
bun test packages/types/tests/memory-agent.test.mts packages/types/tests/memory-agent-runtime-import.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/agent test tests/memory.test.ts tests/thresholds.test.ts
bun --cwd packages/agent typecheck
```

Expected: all pass.

- [ ] **Step 10: Subagent review**

Ask a subagent to review only this task diff for:

- Contract/schema mismatch.
- Agent policy calling external models.
- Duplicate memory filtering weakness.
- Missing package export.

Fix any confirmed issue, rerun Step 9.

- [ ] **Step 11: Commit**

Run:

```powershell
git add packages/types packages/agent
git commit -m "feat: add memory agent contracts and policy"
```

---

## Task 2: Prisma Schema and Migration

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260628000000_add_user_memories/migration.sql`

- [ ] **Step 1: Add Prisma models and relations**

Modify `User` in `packages/database/prisma/schema.prisma`:

```prisma
  memoryCandidates          UserMemoryCandidate[]
  memories                  UserMemory[]
```

Add enums and models after `ReviewTaskSource`:

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

model UserMemoryCandidate {
  id               String                    @id @default(cuid())
  userId           String
  type             UserMemoryType
  title            String                    @db.VarChar(80)
  content          String                    @db.Text
  reason           String                    @db.Text
  evidence         Json
  confidence       Float                     @default(0.5)
  status           UserMemoryCandidateStatus @default(PENDING)
  sourceHash       String
  acceptedMemoryId String?
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt
  decidedAt        DateTime?

  user           User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  acceptedMemory UserMemory? @relation(fields: [acceptedMemoryId], references: [id], onDelete: SetNull)

  @@unique([userId, sourceHash])
  @@index([userId, status, updatedAt])
  @@index([userId, type, updatedAt])
}

model UserMemory {
  id                String           @id @default(cuid())
  userId            String
  type              UserMemoryType
  title             String           @db.VarChar(80)
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

- [ ] **Step 2: Create SQL migration**

Create `packages/database/prisma/migrations/20260628000000_add_user_memories/migration.sql`:

```sql
CREATE TYPE "UserMemoryType" AS ENUM (
  'LEARNING_GOAL',
  'EXPLANATION_PREFERENCE',
  'WEAK_POINT',
  'STUDY_HABIT'
);

CREATE TYPE "UserMemoryCandidateStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "UserMemoryStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserMemoryType" NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "content" TEXT NOT NULL,
  "status" "UserMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceCandidateId" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "lastUsedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMemoryCandidate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserMemoryType" NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "content" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "status" "UserMemoryCandidateStatus" NOT NULL DEFAULT 'PENDING',
  "sourceHash" TEXT NOT NULL,
  "acceptedMemoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "UserMemoryCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMemoryCandidate_userId_sourceHash_key"
  ON "UserMemoryCandidate"("userId", "sourceHash");

CREATE INDEX "UserMemoryCandidate_userId_status_updatedAt_idx"
  ON "UserMemoryCandidate"("userId", "status", "updatedAt");

CREATE INDEX "UserMemoryCandidate_userId_type_updatedAt_idx"
  ON "UserMemoryCandidate"("userId", "type", "updatedAt");

CREATE INDEX "UserMemory_userId_status_updatedAt_idx"
  ON "UserMemory"("userId", "status", "updatedAt");

CREATE INDEX "UserMemory_userId_type_updatedAt_idx"
  ON "UserMemory"("userId", "type", "updatedAt");

ALTER TABLE "UserMemory"
  ADD CONSTRAINT "UserMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMemoryCandidate"
  ADD CONSTRAINT "UserMemoryCandidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMemoryCandidate"
  ADD CONSTRAINT "UserMemoryCandidate_acceptedMemoryId_fkey"
  FOREIGN KEY ("acceptedMemoryId") REFERENCES "UserMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Verify Prisma schema**

Run:

```powershell
bun --cwd packages/database prisma:generate
bun --cwd packages/database test
```

Expected: Prisma client generation and TypeScript typecheck pass.

- [ ] **Step 4: Subagent review**

Ask a subagent to review only the schema and migration for:

- Prisma relation mismatch.
- Missing `userId` indexes.
- Migration SQL not matching schema.
- Any accidental destructive statement.

Fix any confirmed issue, rerun Step 3.

- [ ] **Step 5: Commit**

Run:

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/20260628000000_add_user_memories/migration.sql
git commit -m "feat: add user memory persistence"
```

---

## Task 3: NestJS Memory APIs

**Files:**

- Create: `apps/server/src/memory-agent/memory-agent.module.ts`
- Create: `apps/server/src/memory-agent/memory-agent.controller.ts`
- Create: `apps/server/src/memory-agent/memory-agent.service.ts`
- Create: `apps/server/src/memory-agent/memory-agent.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`

- [ ] **Step 1: Write service tests first**

Create tests that cover:

- `generateCandidates()` reads current user signals and creates deduped `PENDING` candidates.
- `acceptCandidate()` is idempotent and creates one `ACTIVE` memory.
- `rejectCandidate()` does not create a memory.
- `listMemories()`, `updateMemory()`, and `deleteMemory()` scope by current `userId`.
- The service does not call any live AI provider.

Use the existing Jest mock style from `apps/server/src/review-agent/review-agent.service.spec.ts`.

- [ ] **Step 2: Run server test and verify it fails**

Run:

```powershell
bun --filter @repo/server test -- memory-agent.service.spec.ts
```

Expected: fails because `MemoryAgentService` does not exist.

- [ ] **Step 3: Implement service**

Create `MemoryAgentService` with these public methods:

```ts
async listCandidates(userId: string, query: MemoryCandidateListQuery)
async generateCandidates(userId: string, input: GenerateMemoryCandidatesRequest)
async acceptCandidate(userId: string, candidateId: string)
async rejectCandidate(userId: string, candidateId: string)
async listMemories(userId: string, query: UserMemoryListQuery)
async updateMemory(userId: string, memoryId: string, input: UpdateUserMemoryRequest)
async deleteMemory(userId: string, memoryId: string)
```

Implementation rules:

- Use `analyzeMemory` from `@repo/agent/memory`.
- Use `sourceHash = sha256(userId + type + normalized content + evidence summary)`.
- Use `upsert` or unique-conflict handling for candidate dedupe.
- In `acceptCandidate`, wrap candidate update and memory create in `prisma.$transaction`.
- Reject non-owned records with `AppError` 404.
- `deleteMemory` uses `deleteMany({ where: { id, userId } })` and returns `{ ok: true }` only when a row was deleted.

- [ ] **Step 4: Implement controller and module**

Create guarded routes:

```ts
@Controller()
@UseGuards(JwtAuthGuard)
export class MemoryAgentController {
  @Get('memory-agent/candidates')
  listCandidates(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {}

  @Post('memory-agent/candidates/generate')
  generateCandidates(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {}

  @Post('memory-agent/candidates/:id/accept')
  acceptCandidate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {}

  @Post('memory-agent/candidates/:id/reject')
  rejectCandidate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {}

  @Get('user-memories')
  listMemories(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {}

  @Patch('user-memories/:id')
  updateMemory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {}

  @Delete('user-memories/:id')
  deleteMemory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {}
}
```

Parse every query/body with the schemas from `@repo/types/api/memory-agent`.

- [ ] **Step 5: Register module**

Modify `apps/server/src/app.module.ts`:

```ts
import { MemoryAgentModule } from './memory-agent/memory-agent.module';
```

Add `MemoryAgentModule` to `imports`.

- [ ] **Step 6: Run server verification**

Run:

```powershell
bun --filter @repo/server test -- memory-agent.service.spec.ts
bun --filter @repo/server build
```

Expected: tests and build pass.

- [ ] **Step 7: Subagent review**

Ask a subagent to review only server diff for:

- Missing `JwtAuthGuard`.
- User isolation gaps.
- Non-idempotent accept behavior.
- Any model/API call in service.
- Writes to unrelated review/chat/wrong-question tables.

Fix any confirmed issue, rerun Step 6.

- [ ] **Step 8: Commit**

Run:

```powershell
git add apps/server/src/memory-agent apps/server/src/app.module.ts
git commit -m "feat: add memory agent api"
```

---

## Task 4: Web API Client, Hooks, and Profile UI

**Files:**

- Create: `apps/web/src/lib/memory-agent-api.ts`
- Create: `apps/web/src/lib/memory-agent-api.test.mts`
- Create: `apps/web/src/lib/memory-agent-query-keys.ts`
- Create: `apps/web/src/lib/memory-agent-query-keys.test.mts`
- Create: `apps/web/src/hooks/use-memory-agent.ts`
- Create: `apps/web/src/components/memory-agent/memory-agent-panel.tsx`
- Create: `apps/web/src/lib/memory-agent-ui-integration.test.mts`
- Modify: `apps/web/src/app/(main)/profile/page.tsx`

- [ ] **Step 1: Write API client tests**

Create `apps/web/src/lib/memory-agent-api.test.mts` following the review-agent API test pattern. Assert these calls:

```text
GET /memory-agent/candidates?status=PENDING&limit=20
POST /memory-agent/candidates/generate
POST /memory-agent/candidates/candidate_1/accept
POST /memory-agent/candidates/candidate_1/reject
GET /user-memories?status=ACTIVE
PATCH /user-memories/memory_1
DELETE /user-memories/memory_1
```

- [ ] **Step 2: Write query key tests**

Create `apps/web/src/lib/memory-agent-query-keys.test.mts` and assert stable keys:

```ts
assert.deepEqual(memoryAgentQueryKeys.candidates('user_1', { status: 'PENDING', limit: 20 }), [
  'memory-agent',
  'user_1',
  'candidates',
  { status: 'PENDING', limit: 20 },
]);
```

- [ ] **Step 3: Run web tests and verify they fail**

Run:

```powershell
bun --filter @repo/web test -- src/lib/memory-agent-api.test.mts src/lib/memory-agent-query-keys.test.mts
```

Expected: fails because files do not exist.

- [ ] **Step 4: Implement API client**

Create `apps/web/src/lib/memory-agent-api.ts`:

```ts
import {
  acceptMemoryCandidateResponseSchema,
  deleteUserMemoryResponseSchema,
  generateMemoryCandidatesRequestSchema,
  generateMemoryCandidatesResponseSchema,
  memoryCandidateListResponseSchema,
  memoryCandidateListQuerySchema,
  rejectMemoryCandidateResponseSchema,
  updateUserMemoryRequestSchema,
  userMemoryListQuerySchema,
  userMemoryListResponseSchema,
  userMemorySchema,
  type GenerateMemoryCandidatesRequest,
  type MemoryCandidateListQuery,
  type UpdateUserMemoryRequest,
  type UserMemoryListQuery,
} from '@repo/types/api/memory-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(path: string, body?: unknown, options?: { accessToken?: string | null }) => Promise<T>;
  patch: <T>(path: string, body?: unknown, options?: { accessToken?: string | null }) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createMemoryAgentApi(client: ApiClient) {
  return {
    async listCandidates(accessToken: string, query: MemoryCandidateListQuery) {
      const parsed = memoryCandidateListQuerySchema.parse(query);
      const params = new URLSearchParams({
        status: parsed.status,
        limit: String(parsed.limit),
      });
      return memoryCandidateListResponseSchema.parse(
        await client.get<unknown>(`/memory-agent/candidates?${params.toString()}`, {
          accessToken,
        }),
      );
    },
    async generateCandidates(accessToken: string, input: GenerateMemoryCandidatesRequest) {
      const parsed = generateMemoryCandidatesRequestSchema.parse(input);
      return generateMemoryCandidatesResponseSchema.parse(
        await client.post<unknown>('/memory-agent/candidates/generate', parsed, { accessToken }),
      );
    },
    async acceptCandidate(accessToken: string, candidateId: string) {
      return acceptMemoryCandidateResponseSchema.parse(
        await client.post<unknown>(`/memory-agent/candidates/${candidateId}/accept`, {}, { accessToken }),
      );
    },
    async rejectCandidate(accessToken: string, candidateId: string) {
      return rejectMemoryCandidateResponseSchema.parse(
        await client.post<unknown>(`/memory-agent/candidates/${candidateId}/reject`, {}, { accessToken }),
      );
    },
    async listMemories(accessToken: string, query: UserMemoryListQuery) {
      const parsed = userMemoryListQuerySchema.parse(query);
      const params = new URLSearchParams({ status: parsed.status });
      if (parsed.type) params.set('type', parsed.type);
      return userMemoryListResponseSchema.parse(
        await client.get<unknown>(`/user-memories?${params.toString()}`, { accessToken }),
      );
    },
    async updateMemory(accessToken: string, memoryId: string, input: UpdateUserMemoryRequest) {
      const parsed = updateUserMemoryRequestSchema.parse(input);
      return userMemorySchema.parse(
        await client.patch<unknown>(`/user-memories/${memoryId}`, parsed, { accessToken }),
      );
    },
    async deleteMemory(accessToken: string, memoryId: string) {
      return deleteUserMemoryResponseSchema.parse(
        await client.delete<unknown>(`/user-memories/${memoryId}`, { accessToken }),
      );
    },
  };
}
```

- [ ] **Step 5: Implement hooks and query keys**

Create hooks that:

- Use `useAuthStore` or the existing auth token source used by `useReviewAgentSuggestions`.
- Fetch candidates and active memories only when both `accessToken` and `userId` exist.
- Invalidate `candidates` and `memories` after accept/reject/update/delete/generate.

- [ ] **Step 6: Build MemoryAgentPanel**

Create `MemoryAgentPanel` with props:

```ts
type MemoryAgentPanelProps = {
  userId: string;
};
```

UI requirements:

- Candidate section title: `建议记住`
- Active memory section title: `已确认记忆`
- Buttons: `生成候选`, `确认`, `忽略`, `停用`, `恢复`, `删除`
- Notice copy: `第一版不会自动把这些记忆用于每次对话，后续会增加个性化开关。`
- Use `Sparkles`, `Check`, `X`, `Archive`, `Trash2`, `RotateCcw` from `lucide-react`.
- All buttons use `tap-target` or min height `44px`.

- [ ] **Step 7: Integrate into profile page**

Modify `apps/web/src/app/(main)/profile/page.tsx`:

```tsx
import { MemoryAgentPanel } from '@/components/memory-agent/memory-agent-panel';
```

Render after the learning preference section:

```tsx
{userId ? <MemoryAgentPanel userId={userId} /> : null}
```

- [ ] **Step 8: Run web verification**

Run:

```powershell
bun --filter @repo/web test -- src/lib/memory-agent-api.test.mts src/lib/memory-agent-query-keys.test.mts src/lib/memory-agent-ui-integration.test.mts
bun --filter @repo/web build
```

Expected: tests and build pass.

- [ ] **Step 9: Subagent review**

Ask a subagent to review only web diff for:

- API parsing mismatches.
- Missing auth token handling.
- Mutation invalidation gaps.
- Touch target and mobile overflow risks.
- Any claim that memories already affect every chat.

Fix any confirmed issue, rerun Step 8.

- [ ] **Step 10: Commit**

Run:

```powershell
git add apps/web/src/lib/memory-agent-api.ts apps/web/src/lib/memory-agent-api.test.mts apps/web/src/lib/memory-agent-query-keys.ts apps/web/src/lib/memory-agent-query-keys.test.mts apps/web/src/hooks/use-memory-agent.ts apps/web/src/components/memory-agent/memory-agent-panel.tsx apps/web/src/lib/memory-agent-ui-integration.test.mts 'apps/web/src/app/(main)/profile/page.tsx'
git commit -m "feat: add memory management to profile"
```

---

## Task 5: Documentation and Acceptance Updates

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update project docs**

Required content:

- Mark Phase 6.6 as completed only after implementation and verification pass.
- Explain `MemoryAgent` is deterministic and does not call real models.
- Explain candidates require user confirmation.
- Explain `UserMemoryCandidate` and `UserMemory` are PostgreSQL authority.
- Explain `/api/chat` does not auto-inject memories in Phase 6.6.
- Move next mainline to Phase 6.7 Agent Trace UI / cost dashboard / fixed eval set.

- [ ] **Step 2: Update DEVLOG**

Add a Phase 6.6 entry that lists:

- Contract and policy.
- Persistence.
- Server API.
- Profile UI.
- Verification commands run.

- [ ] **Step 3: Run doc sanity checks**

Run:

```powershell
rg -n "Phase 6\\.6|MemoryAgent|UserMemory|UserMemoryCandidate|Phase 6\\.7" AGENTS.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git diff --check
```

Expected: references are present and whitespace check passes.

- [ ] **Step 4: Subagent review**

Ask a subagent to review only docs for:

- Phase status contradictions.
- Any claim that Chat uses memories automatically.
- Missing next-step update.
- Missing verification notes.

Fix any confirmed issue, rerun Step 3.

- [ ] **Step 5: Commit**

Run:

```powershell
git add AGENTS.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 6.6 memory agent complete"
```

---

## Task 6: Final Verification, Merge, and Push

**Files:** no planned source changes unless verification exposes a defect.

- [ ] **Step 1: Run focused verification matrix**

Run:

```powershell
bun test packages/types/tests/memory-agent.test.mts packages/types/tests/memory-agent-runtime-import.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/database test
bun --filter @repo/server test -- memory-agent.service.spec.ts
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web build
```

Expected: all pass.

- [ ] **Step 2: Browser verification**

Start the dev servers if needed:

```powershell
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Open `/profile` and verify:

- Candidate and active memory sections render.
- Generate, accept, reject, archive, restore, and delete states are visible.
- Text does not overlap on mobile viewport.
- Page still supports nickname and learning preference save.

- [ ] **Step 3: Subagent final review**

Ask a subagent to inspect the full branch diff for:

- Security and privacy risks.
- Missing user isolation.
- Hidden model calls.
- Missing verification or docs.
- Regression risk in `/api/chat`, `/profile`, and existing review-agent code.

Fix confirmed issues with a new small commit using a precise message.

- [ ] **Step 4: Push**

Run:

```powershell
git status --short --branch
git push origin main
```

Expected: push succeeds and local `main` is even with `origin/main`.

---

## Self-Review Checklist

- Spec coverage: every spec section maps to a task above.
- Placeholder scan: this plan uses concrete files, commands, status names, API routes, and commit messages.
- Type consistency: contract names match server and web plan names.
- Phase boundary: no task injects memories into `/api/chat`.
- Cost boundary: no task adds live model calls.
- Commit boundary: every implementation task ends with a commit.
