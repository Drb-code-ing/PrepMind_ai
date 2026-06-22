# Phase 6.4 WrongQuestionOrganizerAgent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-shaped wrong-question organization loop: subject cards, topic decks, deterministic organizer policy, server APIs, and `/error-book` drill-down UI.

**Architecture:** Keep `WrongQuestion` as the fact source and add a separate organization layer: `WrongQuestionSubjectGroup`, `WrongQuestionDeck`, and `WrongQuestionDeckItem`. `@repo/agent` provides a deterministic `WrongQuestionOrganizerAgent` policy that emits grouping suggestions; NestJS owns persistence and user isolation; Next.js renders subject-first navigation and keeps current wrong-question CRUD interactions intact.

**Tech Stack:** Bun workspace, Prisma/PostgreSQL, NestJS 11, Zod shared contracts, `@repo/agent`, Next.js 16, TanStack Query, Dexie fallback.

---

## File Structure

- Create `packages/types/src/api/wrong-question-organizer.ts`: shared Zod schemas and request/response types for subject groups, decks, deck items, organization commands, and move/rename operations.
- Modify `packages/types/src/index.ts` and `packages/types/package.json`: export the new API contract.
- Modify `packages/database/prisma/schema.prisma`: add organization models, enums, and relations.
- Create `packages/database/prisma/migrations/<timestamp>_add_wrong_question_organizer/migration.sql`: migration generated from Prisma.
- Create `packages/agent/src/nodes/wrong-question-organizer.ts`: deterministic organizer policy.
- Create `packages/agent/tests/wrong-question-organizer.test.ts`: policy tests.
- Modify `packages/agent/src/index.ts` and `packages/agent/package.json`: export the policy from the package root and subpath.
- Modify `apps/server/package.json`: add `@repo/agent` dependency.
- Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.module.ts`: NestJS module.
- Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.controller.ts`: REST endpoints.
- Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.ts`: persistence, policy invocation, stats aggregation, and ownership checks.
- Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.spec.ts`: service-level tests for idempotency and locked names.
- Create `apps/server/test/wrong-question-organizer.e2e-spec.ts`: endpoint and user-isolation e2e tests.
- Modify `apps/server/src/app.module.ts`: register the new module.
- Create `apps/web/src/lib/wrong-question-organizer-api.ts`: client adapter and response parsing.
- Create `apps/web/src/lib/wrong-question-organizer-view.ts`: small pure helpers for labels, percentages, and route state.
- Create `apps/web/src/lib/wrong-question-organizer-view.test.mts`: web helper tests.
- Create `apps/web/src/hooks/use-wrong-question-organizer.ts`: TanStack Query hooks and mutations.
- Modify `apps/web/src/hooks/use-wrong-questions.ts`: trigger non-blocking organize after successful create.
- Modify `apps/web/src/app/(main)/error-book/page.tsx`: add subject/deck drill-down and fallback to current list.
- Optionally create `apps/web/src/components/error-book/subject-group-card.tsx` and `apps/web/src/components/error-book/deck-card.tsx` if `page.tsx` becomes hard to review.
- Update `AGENTS.md`, `CLAUDE.md`, `docs/data-flow.md`, and `docs/roadmap.md` after implementation passes verification.

---

### Task 1: Shared Wrong-Question Organizer Contract

**Files:**
- Create: `packages/types/src/api/wrong-question-organizer.ts`
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/package.json`
- Verify: `bun --cwd packages/types typecheck`

- [ ] **Step 1: Create the shared API contract**

Create `packages/types/src/api/wrong-question-organizer.ts` with this structure:

```ts
import { z } from 'zod';

import { wrongQuestionSchema } from './wrong-question';

export const wrongQuestionDeckSourceSchema = z.enum(['AI', 'USER', 'SYSTEM']);
export const wrongQuestionDeckItemSourceSchema = z.enum(['AI', 'USER', 'SYSTEM']);

export const wrongQuestionSubjectGroupSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  subject: z.string().min(1),
  displayName: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  deckCount: z.number().int().nonnegative(),
  topKnowledgePoints: z.array(z.string()),
  lastUpdatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionDeckSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  subjectGroupId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  source: wrongQuestionDeckSourceSchema,
  nameLocked: z.boolean(),
  confidence: z.number().min(0).max(1),
  totalCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  topKnowledgePoints: z.array(z.string()),
  lastUpdatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionDeckItemSchema = z.object({
  id: z.string().min(1),
  deckId: z.string().min(1),
  wrongQuestionId: z.string().min(1),
  reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: wrongQuestionDeckItemSourceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionGroupListResponseSchema = z.object({
  items: z.array(wrongQuestionSubjectGroupSchema),
});

export const wrongQuestionDeckListResponseSchema = z.object({
  subjectGroup: wrongQuestionSubjectGroupSchema,
  items: z.array(wrongQuestionDeckSchema),
});

export const wrongQuestionDeckQuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const wrongQuestionDeckQuestionListResponseSchema = z.object({
  deck: wrongQuestionDeckSchema,
  items: z.array(wrongQuestionSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const organizeWrongQuestionRequestSchema = z.object({
  force: z.boolean().default(false),
});

export const organizeWrongQuestionBatchRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

export const organizeWrongQuestionResponseSchema = z.object({
  subjectGroup: wrongQuestionSubjectGroupSchema,
  deck: wrongQuestionDeckSchema,
  item: wrongQuestionDeckItemSchema,
  createdSubjectGroup: z.boolean(),
  createdDeck: z.boolean(),
  createdItem: z.boolean(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const organizeWrongQuestionBatchResponseSchema = z.object({
  organizedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  items: z.array(organizeWrongQuestionResponseSchema),
});

export const updateWrongQuestionDeckRequestSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().max(240).nullable().optional(),
    nameLocked: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const moveWrongQuestionToDeckRequestSchema = z.object({
  wrongQuestionId: z.string().min(1),
  source: wrongQuestionDeckItemSourceSchema.default('USER'),
});

export const removeWrongQuestionDeckItemResponseSchema = z.object({
  ok: z.literal(true),
});

export type WrongQuestionDeckSource = z.infer<typeof wrongQuestionDeckSourceSchema>;
export type WrongQuestionDeckItemSource = z.infer<typeof wrongQuestionDeckItemSourceSchema>;
export type WrongQuestionSubjectGroupResponse = z.infer<typeof wrongQuestionSubjectGroupSchema>;
export type WrongQuestionDeckResponse = z.infer<typeof wrongQuestionDeckSchema>;
export type WrongQuestionDeckItemResponse = z.infer<typeof wrongQuestionDeckItemSchema>;
export type WrongQuestionGroupListResponse = z.infer<typeof wrongQuestionGroupListResponseSchema>;
export type WrongQuestionDeckListResponse = z.infer<typeof wrongQuestionDeckListResponseSchema>;
export type WrongQuestionDeckQuestionListQuery = z.infer<
  typeof wrongQuestionDeckQuestionListQuerySchema
>;
export type WrongQuestionDeckQuestionListResponse = z.infer<
  typeof wrongQuestionDeckQuestionListResponseSchema
>;
export type OrganizeWrongQuestionRequest = z.infer<typeof organizeWrongQuestionRequestSchema>;
export type OrganizeWrongQuestionBatchRequest = z.infer<
  typeof organizeWrongQuestionBatchRequestSchema
>;
export type OrganizeWrongQuestionResponse = z.infer<typeof organizeWrongQuestionResponseSchema>;
export type OrganizeWrongQuestionBatchResponse = z.infer<
  typeof organizeWrongQuestionBatchResponseSchema
>;
export type UpdateWrongQuestionDeckRequest = z.infer<typeof updateWrongQuestionDeckRequestSchema>;
export type MoveWrongQuestionToDeckRequest = z.infer<
  typeof moveWrongQuestionToDeckRequestSchema
>;
```

- [ ] **Step 2: Export the contract**

Modify `packages/types/src/index.ts`:

```ts
export * from './api/wrong-question-organizer';
```

Add this line to `packages/types/package.json` `exports`:

```json
"./api/wrong-question-organizer": "./src/api/wrong-question-organizer.ts"
```

- [ ] **Step 3: Verify shared types**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Commit**

```powershell
git add packages/types/src/api/wrong-question-organizer.ts packages/types/src/index.ts packages/types/package.json
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: add wrong question organizer contracts"
```

---

### Task 2: Prisma Organization Models

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_add_wrong_question_organizer/migration.sql`
- Verify: `bun --cwd packages/database prisma migrate dev --name add_wrong_question_organizer`
- Verify: `bun --cwd packages/database prisma:generate`
- Verify: `bun --cwd packages/database test`

- [ ] **Step 1: Add relations to existing models**

In `model User`, add:

```prisma
wrongQuestionSubjectGroups WrongQuestionSubjectGroup[]
wrongQuestionDecks         WrongQuestionDeck[]
wrongQuestionDeckItems     WrongQuestionDeckItem[]
```

In `model WrongQuestion`, add:

```prisma
deckItems WrongQuestionDeckItem[]
```

- [ ] **Step 2: Add organization enums and models**

Add these models after `WrongQuestion`:

```prisma
enum WrongQuestionDeckSource {
  AI
  USER
  SYSTEM
}

enum WrongQuestionDeckItemSource {
  AI
  USER
  SYSTEM
}

model WrongQuestionSubjectGroup {
  id          String   @id @default(cuid())
  userId      String
  subject     String
  displayName String
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user  User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  decks WrongQuestionDeck[]

  @@unique([userId, subject])
  @@index([userId, sortOrder])
  @@index([userId, updatedAt])
}

model WrongQuestionDeck {
  id             String                  @id @default(cuid())
  userId         String
  subjectGroupId String
  name           String
  description    String?                 @db.Text
  source         WrongQuestionDeckSource @default(AI)
  nameLocked     Boolean                 @default(false)
  confidence     Float                   @default(0.5)
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  user         User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  subjectGroup WrongQuestionSubjectGroup @relation(fields: [subjectGroupId], references: [id], onDelete: Cascade)
  items        WrongQuestionDeckItem[]

  @@index([userId, subjectGroupId, updatedAt])
  @@index([userId, updatedAt])
}

model WrongQuestionDeckItem {
  id              String                      @id @default(cuid())
  userId          String
  deckId          String
  wrongQuestionId String
  reason          String?                     @db.Text
  confidence      Float                       @default(0.5)
  source          WrongQuestionDeckItemSource @default(AI)
  createdAt       DateTime                    @default(now())
  updatedAt       DateTime                    @updatedAt

  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  deck          WrongQuestionDeck @relation(fields: [deckId], references: [id], onDelete: Cascade)
  wrongQuestion WrongQuestion     @relation(fields: [wrongQuestionId], references: [id], onDelete: Cascade)

  @@unique([deckId, wrongQuestionId])
  @@index([userId, wrongQuestionId])
  @@index([userId, deckId])
}
```

- [ ] **Step 3: Generate the migration**

Run with Docker PostgreSQL available:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres
bun --cwd packages/database prisma migrate dev --name add_wrong_question_organizer
```

Expected: Prisma creates a migration folder and reports the database is in sync.

- [ ] **Step 4: Regenerate Prisma client and typecheck database package**

Run:

```powershell
bun --cwd packages/database prisma:generate
bun --cwd packages/database test
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations packages/database/src
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: add wrong question organizer models"
```

---

### Task 3: Deterministic WrongQuestionOrganizerAgent Policy

**Files:**
- Create: `packages/agent/src/nodes/wrong-question-organizer.ts`
- Create: `packages/agent/tests/wrong-question-organizer.test.ts`
- Modify: `packages/agent/src/index.ts`
- Modify: `packages/agent/package.json`
- Verify: `bun --cwd packages/agent test`
- Verify: `bun --cwd packages/agent typecheck`

- [ ] **Step 1: Write failing policy tests**

Create `packages/agent/tests/wrong-question-organizer.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';

import { organizeWrongQuestion } from '../src/nodes/wrong-question-organizer';

const baseQuestion = {
  id: 'wq_1',
  subject: '高等数学',
  category: '曲线积分',
  knowledgePoints: ['格林公式', '曲线积分'],
  errorType: '概念混淆',
  questionText: '计算闭合曲线积分。',
  analysis: '用格林公式。',
  answer: '12',
  userNote: '',
};

describe('organizeWrongQuestion', () => {
  it('uses the first knowledge point as the deck name', () => {
    const result = organizeWrongQuestion({ wrongQuestion: baseQuestion, existingDecks: [] });

    expect(result.subjectKey).toBe('高等数学');
    expect(result.deckName).toBe('格林公式');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matchedDeckId).toBeUndefined();
  });

  it('reuses an existing deck when names overlap', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: baseQuestion,
      existingDecks: [{ id: 'deck_1', name: '格林公式', nameLocked: false, keywords: ['曲线积分'] }],
    });

    expect(result.matchedDeckId).toBe('deck_1');
    expect(result.deckName).toBe('格林公式');
    expect(result.reason).toContain('已有专题');
  });

  it('falls back to category when knowledge points are empty', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: { ...baseQuestion, knowledgePoints: [] },
      existingDecks: [],
    });

    expect(result.deckName).toBe('曲线积分');
    expect(result.signals).toContain('category');
  });

  it('falls back to error type with lower confidence', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: { ...baseQuestion, knowledgePoints: [], category: '', errorType: '计算错误' },
      existingDecks: [],
    });

    expect(result.deckName).toBe('计算错误');
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('uses other subject and system deck for thin records', () => {
    const result = organizeWrongQuestion({
      wrongQuestion: {
        ...baseQuestion,
        subject: '',
        category: '',
        knowledgePoints: [],
        errorType: '',
      },
      existingDecks: [],
    });

    expect(result.subjectKey).toBe('其他');
    expect(result.deckName).toBe('未分类错题');
  });
});
```

Run:

```powershell
bun --cwd packages/agent test
```

Expected before implementation: fails because `wrong-question-organizer` does not exist.

- [ ] **Step 2: Implement the policy**

Create `packages/agent/src/nodes/wrong-question-organizer.ts`:

```ts
export type WrongQuestionOrganizerInput = {
  wrongQuestion: {
    id: string;
    subject?: string | null;
    category?: string | null;
    knowledgePoints?: readonly string[];
    errorType?: string | null;
    questionText?: string | null;
    analysis?: string | null;
    answer?: string | null;
    userNote?: string | null;
  };
  existingDecks?: readonly WrongQuestionOrganizerExistingDeck[];
};

export type WrongQuestionOrganizerExistingDeck = {
  id: string;
  name: string;
  nameLocked?: boolean;
  keywords?: readonly string[];
};

export type WrongQuestionOrganizerResult = {
  subjectKey: string;
  subjectDisplayName: string;
  deckName: string;
  deckDescription: string;
  matchedDeckId?: string;
  reason: string;
  confidence: number;
  signals: string[];
};

export function organizeWrongQuestion({
  wrongQuestion,
  existingDecks = [],
}: WrongQuestionOrganizerInput): WrongQuestionOrganizerResult {
  const subjectKey = normalizeLabel(wrongQuestion.subject) || '其他';
  const knowledgePoint = firstUsefulLabel(wrongQuestion.knowledgePoints ?? []);
  const category = normalizeLabel(wrongQuestion.category);
  const errorType = normalizeLabel(wrongQuestion.errorType);
  const signals: string[] = [];

  const candidateName = knowledgePoint || category || errorType || '未分类错题';
  if (knowledgePoint) signals.push('knowledgePoint');
  if (!knowledgePoint && category) signals.push('category');
  if (!knowledgePoint && !category && errorType) signals.push('errorType');
  if (candidateName === '未分类错题') signals.push('fallback');

  const matchedDeck = findMatchingDeck(candidateName, existingDecks);
  if (matchedDeck) signals.push('existingDeck');

  const confidence = calculateConfidence({
    hasKnowledgePoint: Boolean(knowledgePoint),
    hasCategory: Boolean(category),
    hasErrorType: Boolean(errorType),
    matchedDeck: Boolean(matchedDeck),
  });

  const deckName = matchedDeck?.name ?? shortenDeckName(candidateName);
  return {
    subjectKey,
    subjectDisplayName: subjectKey,
    deckName,
    deckDescription: buildDescription(deckName, subjectKey, signals),
    matchedDeckId: matchedDeck?.id,
    reason: matchedDeck
      ? `已有专题「${matchedDeck.name}」与当前错题知识点匹配。`
      : `根据${describePrimarySignal(signals)}归入「${deckName}」。`,
    confidence,
    signals,
  };
}

function findMatchingDeck(
  candidateName: string,
  decks: readonly WrongQuestionOrganizerExistingDeck[],
) {
  const normalizedCandidate = normalizeForMatch(candidateName);
  return decks.find((deck) => {
    const deckName = normalizeForMatch(deck.name);
    if (deckName && (deckName.includes(normalizedCandidate) || normalizedCandidate.includes(deckName))) {
      return true;
    }
    return (deck.keywords ?? []).some((keyword) => {
      const normalizedKeyword = normalizeForMatch(keyword);
      return (
        normalizedKeyword.length > 0 &&
        (normalizedKeyword.includes(normalizedCandidate) ||
          normalizedCandidate.includes(normalizedKeyword))
      );
    });
  });
}

function calculateConfidence(input: {
  hasKnowledgePoint: boolean;
  hasCategory: boolean;
  hasErrorType: boolean;
  matchedDeck: boolean;
}) {
  let score = 0.45;
  if (input.hasKnowledgePoint) score += 0.28;
  if (input.hasCategory) score += 0.12;
  if (input.hasErrorType) score += 0.06;
  if (input.matchedDeck) score += 0.12;
  return Math.min(0.95, Number(score.toFixed(2)));
}

function firstUsefulLabel(values: readonly string[]) {
  return values.map(normalizeLabel).find((value) => value.length >= 2) ?? '';
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeForMatch(value: string) {
  return normalizeLabel(value).toLowerCase().replace(/[，。,.、\s]/g, '');
}

function shortenDeckName(value: string) {
  const normalized = normalizeLabel(value);
  if (normalized.length <= 16) return normalized;
  return normalized.slice(0, 16);
}

function buildDescription(deckName: string, subject: string, signals: readonly string[]) {
  if (signals.includes('fallback')) {
    return `${subject}中暂未形成稳定专题的错题。`;
  }
  return `${subject}中与「${deckName}」相关的错题。`;
}

function describePrimarySignal(signals: readonly string[]) {
  if (signals.includes('knowledgePoint')) return '知识点';
  if (signals.includes('category')) return '题目分类';
  if (signals.includes('errorType')) return '错因类型';
  return '默认规则';
}
```

- [ ] **Step 3: Export the policy**

Modify `packages/agent/src/index.ts`:

```ts
export * from './nodes/wrong-question-organizer';
```

Add this subpath to `packages/agent/package.json`:

```json
"./wrong-question-organizer": "./src/nodes/wrong-question-organizer.ts"
```

- [ ] **Step 4: Verify agent package**

Run:

```powershell
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
```

Expected: tests include the new organizer tests and exit 0.

- [ ] **Step 5: Commit**

```powershell
git add packages/agent/src/nodes/wrong-question-organizer.ts packages/agent/tests/wrong-question-organizer.test.ts packages/agent/src/index.ts packages/agent/package.json
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: add wrong question organizer policy"
```

---

### Task 4: Server Organizer API

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/wrong-question-organizer/wrong-question-organizer.module.ts`
- Create: `apps/server/src/wrong-question-organizer/wrong-question-organizer.controller.ts`
- Create: `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.ts`
- Create: `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.spec.ts`
- Create: `apps/server/test/wrong-question-organizer.e2e-spec.ts`
- Modify: `apps/server/src/app.module.ts`
- Verify: `bun --filter @repo/server test -- wrong-question-organizer`
- Verify: `bun --filter @repo/server test:e2e -- wrong-question-organizer.e2e-spec.ts`
- Verify: `bun --filter @repo/server build`

- [ ] **Step 1: Add server dependency on `@repo/agent`**

Modify `apps/server/package.json` dependencies:

```json
"@repo/agent": "*"
```

- [ ] **Step 2: Write service tests first**

Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.spec.ts` with tests for:

```ts
describe('WrongQuestionOrganizerService', () => {
  it('creates subject group, deck, and item for an owned wrong question', async () => {
    // Use mocked PrismaService methods.
    // Expect upsert on wrongQuestionSubjectGroup.
    // Expect create on wrongQuestionDeck when no matching deck exists.
    // Expect upsert on wrongQuestionDeckItem.
  });

  it('does not overwrite locked deck names when organizing again', async () => {
    // Mock existingDeck with nameLocked true and name "我的专题".
    // Expect no deck update that changes name.
  });
});
```

Use Jest mocks matching the service methods below. Expected before implementation: failing import or missing service.

- [ ] **Step 3: Implement service**

Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.service.ts` with these public methods:

```ts
@Injectable()
export class WrongQuestionOrganizerService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups(userId: string): Promise<WrongQuestionGroupListResponse> {}
  async listDecks(userId: string, subjectGroupId: string): Promise<WrongQuestionDeckListResponse> {}
  async listDeckQuestions(
    userId: string,
    deckId: string,
    query: WrongQuestionDeckQuestionListQuery,
  ): Promise<WrongQuestionDeckQuestionListResponse> {}
  async organizeOne(
    userId: string,
    wrongQuestionId: string,
    input: OrganizeWrongQuestionRequest,
  ): Promise<OrganizeWrongQuestionResponse> {}
  async organizeBatch(
    userId: string,
    input: OrganizeWrongQuestionBatchRequest,
  ): Promise<OrganizeWrongQuestionBatchResponse> {}
  async updateDeck(
    userId: string,
    deckId: string,
    input: UpdateWrongQuestionDeckRequest,
  ): Promise<WrongQuestionDeckResponse> {}
  async moveToDeck(
    userId: string,
    deckId: string,
    input: MoveWrongQuestionToDeckRequest,
  ): Promise<WrongQuestionDeckItemResponse> {}
  async removeDeckItem(
    userId: string,
    deckId: string,
    wrongQuestionId: string,
  ): Promise<{ ok: true }> {}
}
```

Core implementation rules:

- `organizeOne` must `findFirst({ where: { id: wrongQuestionId, userId } })`; missing records throw `WRONG_QUESTION_NOT_FOUND`.
- Upsert `WrongQuestionSubjectGroup` by `userId_subject`.
- Load existing decks for the subject group and pass `{ id, name, nameLocked, keywords }` to `organizeWrongQuestion`.
- Use `matchedDeckId` when present; otherwise create a deck with `source: 'AI'`, `nameLocked: false`, and policy confidence.
- Create deck item with `source: input.force ? 'AI' : 'AI'`; if an item already exists for the same deck/question, update reason, confidence, and source.
- Do not rename a deck when `nameLocked=true`.
- `listGroups` should aggregate counts from deck items and wrong question status. If no organization data exists but wrong questions exist, return an empty `items` array and let the web fallback render the old list.
- `removeDeckItem` must delete only the relation and return `{ ok: true }`.

- [ ] **Step 4: Implement controller**

Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.controller.ts`:

```ts
@Controller()
@UseGuards(JwtAuthGuard)
export class WrongQuestionOrganizerController {
  constructor(private readonly service: WrongQuestionOrganizerService) {}

  @Get('wrong-question-groups')
  listGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listGroups(user.id);
  }

  @Get('wrong-question-groups/:subjectGroupId/decks')
  listDecks(@CurrentUser() user: AuthenticatedUser, @Param('subjectGroupId') subjectGroupId: string) {
    return this.service.listDecks(user.id, subjectGroupId);
  }

  @Get('wrong-question-decks/:deckId/questions')
  listDeckQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Query() query: unknown,
  ) {
    return this.service.listDeckQuestions(
      user.id,
      deckId,
      wrongQuestionDeckQuestionListQuerySchema.parse(query),
    );
  }

  @Post('wrong-question-organizer/organize/:wrongQuestionId')
  organizeOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('wrongQuestionId') wrongQuestionId: string,
    @Body() body: unknown,
  ) {
    return this.service.organizeOne(
      user.id,
      wrongQuestionId,
      organizeWrongQuestionRequestSchema.parse(body ?? {}),
    );
  }

  @Post('wrong-question-organizer/organize-batch')
  organizeBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.organizeBatch(
      user.id,
      organizeWrongQuestionBatchRequestSchema.parse(body ?? {}),
    );
  }

  @Patch('wrong-question-decks/:deckId')
  updateDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateDeck(
      user.id,
      deckId,
      updateWrongQuestionDeckRequestSchema.parse(body),
    );
  }

  @Post('wrong-question-decks/:deckId/items')
  moveToDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() body: unknown,
  ) {
    return this.service.moveToDeck(
      user.id,
      deckId,
      moveWrongQuestionToDeckRequestSchema.parse(body),
    );
  }

  @Delete('wrong-question-decks/:deckId/items/:wrongQuestionId')
  removeDeckItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Param('wrongQuestionId') wrongQuestionId: string,
  ) {
    return this.service.removeDeckItem(user.id, deckId, wrongQuestionId);
  }
}
```

- [ ] **Step 5: Register module**

Create `apps/server/src/wrong-question-organizer/wrong-question-organizer.module.ts`:

```ts
@Module({
  imports: [DatabaseModule],
  controllers: [WrongQuestionOrganizerController],
  providers: [WrongQuestionOrganizerService],
})
export class WrongQuestionOrganizerModule {}
```

Add `WrongQuestionOrganizerModule` to `apps/server/src/app.module.ts` imports.

- [ ] **Step 6: Write e2e tests**

Create `apps/server/test/wrong-question-organizer.e2e-spec.ts` by following `wrong-questions.e2e-spec.ts`. Cover:

```ts
it('organizes wrong questions into subject groups and decks', async () => {
  // register
  // create two high math wrong questions
  // POST /wrong-question-organizer/organize/:id
  // GET /wrong-question-groups
  // GET /wrong-question-groups/:id/decks
  // GET /wrong-question-decks/:id/questions
  // assert counts and question ids
});

it('keeps user isolation for groups and decks', async () => {
  // owner organizes a deck
  // other user cannot list that deck questions
  // expect 404 with WRONG_QUESTION_DECK_NOT_FOUND
});

it('locks renamed deck names against later organize calls', async () => {
  // organize one question
  // PATCH deck with { name: "我的格林公式专题", nameLocked: true }
  // organize another matching question
  // list decks and expect locked name remains
});
```

- [ ] **Step 7: Verify server**

Run:

```powershell
bun --filter @repo/server test -- wrong-question-organizer
bun --filter @repo/server test:e2e -- wrong-question-organizer.e2e-spec.ts
bun --filter @repo/server build
```

Expected: all commands exit 0. If e2e needs Docker, start services first:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

- [ ] **Step 8: Commit**

```powershell
git add apps/server/package.json apps/server/src/wrong-question-organizer apps/server/src/app.module.ts apps/server/test/wrong-question-organizer.e2e-spec.ts
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: add wrong question organizer api"
```

---

### Task 5: Web API, Hooks, and View Helpers

**Files:**
- Create: `apps/web/src/lib/wrong-question-organizer-api.ts`
- Create: `apps/web/src/lib/wrong-question-organizer-view.ts`
- Create: `apps/web/src/lib/wrong-question-organizer-view.test.mts`
- Create: `apps/web/src/hooks/use-wrong-question-organizer.ts`
- Modify: `apps/web/src/hooks/use-wrong-questions.ts`
- Verify: `bun --filter @repo/web test`
- Verify: `bun --filter @repo/web lint`

- [ ] **Step 1: Implement the web API adapter**

Create `apps/web/src/lib/wrong-question-organizer-api.ts`:

```ts
import {
  moveWrongQuestionToDeckRequestSchema,
  organizeWrongQuestionBatchRequestSchema,
  organizeWrongQuestionBatchResponseSchema,
  organizeWrongQuestionRequestSchema,
  organizeWrongQuestionResponseSchema,
  removeWrongQuestionDeckItemResponseSchema,
  wrongQuestionDeckItemSchema,
  updateWrongQuestionDeckRequestSchema,
  wrongQuestionDeckListResponseSchema,
  wrongQuestionDeckQuestionListQuerySchema,
  wrongQuestionDeckQuestionListResponseSchema,
  wrongQuestionDeckSchema,
  wrongQuestionGroupListResponseSchema,
  type MoveWrongQuestionToDeckRequest,
  type OrganizeWrongQuestionBatchRequest,
  type OrganizeWrongQuestionRequest,
  type UpdateWrongQuestionDeckRequest,
  type WrongQuestionDeckQuestionListQuery,
} from '@repo/types/api/wrong-question-organizer';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(path: string, body?: unknown, options?: { accessToken?: string | null }) => Promise<T>;
  patch: <T>(path: string, body?: unknown, options?: { accessToken?: string | null }) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createWrongQuestionOrganizerApi(client: ApiClient) {
  return {
    async listGroups(accessToken: string) {
      return wrongQuestionGroupListResponseSchema.parse(
        await client.get<unknown>('/wrong-question-groups', { accessToken }),
      );
    },
    async listDecks(accessToken: string, subjectGroupId: string) {
      return wrongQuestionDeckListResponseSchema.parse(
        await client.get<unknown>(`/wrong-question-groups/${subjectGroupId}/decks`, {
          accessToken,
        }),
      );
    },
    async listDeckQuestions(
      accessToken: string,
      deckId: string,
      query: WrongQuestionDeckQuestionListQuery,
    ) {
      const parsed = wrongQuestionDeckQuestionListQuerySchema.parse(query);
      const params = new URLSearchParams({
        page: String(parsed.page),
        pageSize: String(parsed.pageSize),
      });
      return wrongQuestionDeckQuestionListResponseSchema.parse(
        await client.get<unknown>(`/wrong-question-decks/${deckId}/questions?${params}`, {
          accessToken,
        }),
      );
    },
    async organizeOne(
      accessToken: string,
      wrongQuestionId: string,
      request: OrganizeWrongQuestionRequest = { force: false },
    ) {
      return organizeWrongQuestionResponseSchema.parse(
        await client.post<unknown>(
          `/wrong-question-organizer/organize/${wrongQuestionId}`,
          organizeWrongQuestionRequestSchema.parse(request),
          { accessToken },
        ),
      );
    },
    async organizeBatch(
      accessToken: string,
      request: OrganizeWrongQuestionBatchRequest = { limit: 20 },
    ) {
      return organizeWrongQuestionBatchResponseSchema.parse(
        await client.post<unknown>(
          '/wrong-question-organizer/organize-batch',
          organizeWrongQuestionBatchRequestSchema.parse(request),
          { accessToken },
        ),
      );
    },
    async updateDeck(accessToken: string, deckId: string, request: UpdateWrongQuestionDeckRequest) {
      return wrongQuestionDeckSchema.parse(
        await client.patch<unknown>(
          `/wrong-question-decks/${deckId}`,
          updateWrongQuestionDeckRequestSchema.parse(request),
          { accessToken },
        ),
      );
    },
    async moveToDeck(accessToken: string, deckId: string, request: MoveWrongQuestionToDeckRequest) {
      return wrongQuestionDeckItemSchema.parse(
        await client.post<unknown>(
          `/wrong-question-decks/${deckId}/items`,
          moveWrongQuestionToDeckRequestSchema.parse(request),
          { accessToken },
        ),
      );
    },
    async removeDeckItem(accessToken: string, deckId: string, wrongQuestionId: string) {
      return removeWrongQuestionDeckItemResponseSchema.parse(
        await client.delete<unknown>(
          `/wrong-question-decks/${deckId}/items/${wrongQuestionId}`,
          { accessToken },
        ),
      );
    },
  };
}
```

- [ ] **Step 2: Add view helpers and tests**

Create `apps/web/src/lib/wrong-question-organizer-view.ts`:

```ts
import type {
  WrongQuestionDeckResponse,
  WrongQuestionSubjectGroupResponse,
} from '@repo/types/api/wrong-question-organizer';

export function formatOrganizerCountLabel(total: number, unresolved: number) {
  if (total === 0) return '暂无错题';
  if (unresolved === 0) return `${total} 道 · 已全部掌握`;
  return `${total} 道 · ${unresolved} 道未掌握`;
}

export function getOrganizerMasteryPercent(total: number, resolved: number) {
  if (total <= 0) return 0;
  return Math.round((resolved / total) * 100);
}

export function getOrganizerConfidenceLabel(confidence: number) {
  if (confidence >= 0.8) return '归类稳定';
  if (confidence >= 0.6) return '建议复核';
  return '待整理';
}

export function getSubjectGroupHref(group: Pick<WrongQuestionSubjectGroupResponse, 'id'>) {
  return `/error-book?subjectGroupId=${encodeURIComponent(group.id)}`;
}

export function getDeckHref(deck: Pick<WrongQuestionDeckResponse, 'id'>) {
  return `/error-book?deckId=${encodeURIComponent(deck.id)}`;
}
```

Create `apps/web/src/lib/wrong-question-organizer-view.test.mts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatOrganizerCountLabel,
  getDeckHref,
  getOrganizerConfidenceLabel,
  getOrganizerMasteryPercent,
  getSubjectGroupHref,
} from './wrong-question-organizer-view.ts';

describe('wrong question organizer view helpers', () => {
  it('formats count labels with unresolved count', () => {
    assert.equal(formatOrganizerCountLabel(5, 2), '5 道 · 2 道未掌握');
    assert.equal(formatOrganizerCountLabel(3, 0), '3 道 · 已全部掌握');
    assert.equal(formatOrganizerCountLabel(0, 0), '暂无错题');
  });

  it('calculates mastery percent safely', () => {
    assert.equal(getOrganizerMasteryPercent(10, 7), 70);
    assert.equal(getOrganizerMasteryPercent(0, 0), 0);
  });

  it('labels confidence tiers', () => {
    assert.equal(getOrganizerConfidenceLabel(0.9), '归类稳定');
    assert.equal(getOrganizerConfidenceLabel(0.7), '建议复核');
    assert.equal(getOrganizerConfidenceLabel(0.3), '待整理');
  });

  it('builds drill-down links', () => {
    assert.equal(getSubjectGroupHref({ id: 'subject 1' }), '/error-book?subjectGroupId=subject%201');
    assert.equal(getDeckHref({ id: 'deck 1' }), '/error-book?deckId=deck%201');
  });
});
```

- [ ] **Step 3: Add hooks**

Create `apps/web/src/hooks/use-wrong-question-organizer.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import { createWrongQuestionOrganizerApi } from '@/lib/wrong-question-organizer-api';
import { useUserStore } from '@/stores/userStore';

const organizerApi = createWrongQuestionOrganizerApi(apiClient);

export const wrongQuestionOrganizerQueryKeys = {
  all: ['wrong-question-organizer'] as const,
  groups: () => [...wrongQuestionOrganizerQueryKeys.all, 'groups'] as const,
  decks: (subjectGroupId: string | null) =>
    [...wrongQuestionOrganizerQueryKeys.all, 'decks', subjectGroupId] as const,
  deckQuestions: (deckId: string | null, page: number, pageSize: number) =>
    [...wrongQuestionOrganizerQueryKeys.all, 'deck-questions', deckId, page, pageSize] as const,
};

export function useWrongQuestionGroups() {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  return useQuery({
    queryKey: wrongQuestionOrganizerQueryKeys.groups(),
    queryFn: () => organizerApi.listGroups(accessToken ?? ''),
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}
```

Complete hooks for `useWrongQuestionDecks`, `useWrongQuestionDeckQuestions`, `useOrganizeWrongQuestion`, `useOrganizeWrongQuestionBatch`, `useUpdateWrongQuestionDeck`, `useMoveWrongQuestionToDeck`, and `useRemoveWrongQuestionDeckItem`. Each mutation should invalidate `wrongQuestionOrganizerQueryKeys.all`; move/remove should also invalidate `wrong-question` list queries if the UI depends on deck membership.

- [ ] **Step 4: Trigger non-blocking organize after create**

Modify `apps/web/src/hooks/use-wrong-questions.ts`:

```ts
import { createWrongQuestionOrganizerApi, organizerApi } from '@/lib/wrong-question-organizer-api';
```

Use a local `wrongQuestionOrganizerApi` instance next to `wrongQuestionApi`. In `useCreateWrongQuestion`, change `onSuccess` to:

```ts
onSuccess: (created) => {
  void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
  if (accessToken) {
    void wrongQuestionOrganizerApi
      .organizeOne(accessToken, created.id, { force: false })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
      })
      .catch((error) => {
        console.warn('[WrongQuestionOrganizer] organize after create failed', error);
      });
  }
}
```

Import `wrongQuestionOrganizerQueryKeys` from the new hook module. The organize call must not throw back into the create mutation; saving a wrong question stays successful even if organization fails.

- [ ] **Step 5: Verify web helper and hook changes**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
```

Expected: web test count increases and exits 0; lint exits 0.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/lib/wrong-question-organizer-api.ts apps/web/src/lib/wrong-question-organizer-view.ts apps/web/src/lib/wrong-question-organizer-view.test.mts apps/web/src/hooks/use-wrong-question-organizer.ts apps/web/src/hooks/use-wrong-questions.ts
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: add wrong question organizer web client"
```

---

### Task 6: `/error-book` Subject and Deck UI

**Files:**
- Modify: `apps/web/src/app/(main)/error-book/page.tsx`
- Optional create: `apps/web/src/components/error-book/subject-group-card.tsx`
- Optional create: `apps/web/src/components/error-book/deck-card.tsx`
- Verify: `bun --filter @repo/web test`
- Verify: `bun --filter @repo/web build`
- Manual verify: browser at `/error-book`

- [ ] **Step 1: Add route state**

In `apps/web/src/app/(main)/error-book/page.tsx`, derive:

```ts
const subjectGroupId = searchParams.get('subjectGroupId');
const deckId = searchParams.get('deckId');
const isSubjectView = Boolean(subjectGroupId) && !deckId;
const isDeckView = Boolean(deckId);
```

Use organizer hooks:

```ts
const groupsQuery = useWrongQuestionGroups();
const decksQuery = useWrongQuestionDecks(subjectGroupId);
const deckQuestionsQuery = useWrongQuestionDeckQuestions(deckId, { page: 1, pageSize: 50 });
```

Keep the existing `useWrongQuestions({ pageSize: 50 })` as fallback when organizer data is empty or failed.

- [ ] **Step 2: Render subject group homepage**

When `!isSubjectView && !isDeckView` and `groupsQuery.data?.items.length > 0`, render subject cards instead of `filteredItems`.

Subject card content:

```tsx
<Link href={getSubjectGroupHref(group)} className="pm-glass-card block rounded-[1.35rem] p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <p className="text-xs font-medium text-[var(--pm-muted)]">学科错题集</p>
      <h2 className="mt-1 text-base font-semibold">{group.displayName}</h2>
      <p className="mt-2 text-xs text-[var(--pm-muted)]">
        {formatOrganizerCountLabel(group.totalCount, group.unresolvedCount)}
      </p>
    </div>
    <span className="rounded-full bg-[#eafff9] px-2 py-1 text-xs font-semibold text-[#247269]">
      掌握 {getOrganizerMasteryPercent(group.totalCount, group.resolvedCount)}%
    </span>
  </div>
  <div className="mt-3 flex flex-wrap gap-1.5">
    {group.topKnowledgePoints.slice(0, 4).map((point) => (
      <Badge key={point} subtle>{point}</Badge>
    ))}
  </div>
</Link>
```

If group list is empty but wrong questions exist, show current flat list and a small action button:

```tsx
<button type="button" onClick={() => organizeBatch.mutate({ limit: 50 })}>
  整理历史错题
</button>
```

- [ ] **Step 3: Render deck list for a subject**

When `isSubjectView`, render:

- Back link to `/error-book`.
- Subject name and summary from `decksQuery.data.subjectGroup`.
- Deck cards from `decksQuery.data.items`.
- A small “整理历史错题” action using `useOrganizeWrongQuestionBatch`.

Deck card content:

```tsx
<Link href={getDeckHref(deck)} className="pm-glass-card block rounded-[1.35rem] p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="text-base font-semibold">{deck.name}</h2>
      <p className="mt-1 text-xs text-[var(--pm-muted)]">{deck.description ?? 'AI 整理出的专题'}</p>
    </div>
    <span className="rounded-full bg-white/75 px-2 py-1 text-xs font-semibold text-[var(--pm-muted)]">
      {getOrganizerConfidenceLabel(deck.confidence)}
    </span>
  </div>
  <p className="mt-3 text-xs font-medium text-[var(--pm-muted)]">
    {formatOrganizerCountLabel(deck.totalCount, deck.unresolvedCount)}
  </p>
</Link>
```

Add an inline rename control inside the deck card menu. Do not use `window.prompt`; use an inline input area or a small local dialog pattern consistent with the knowledge page menu behavior.

- [ ] **Step 4: Render deck question list**

When `isDeckView`, use `deckQuestionsQuery.data.items` as the source for `WrongQuestionCard`. Convert API responses to local records with `mapWrongQuestionResponseToLocalRecord` before rendering, or make `WrongQuestionCard` accept a small shared shape.

Keep:

- detail full-screen overlay,
- note save,
- status toggle,
- delete confirmation strip,
- add to review plan.

Add a lightweight “移动到专题” control in detail view only if `decksQuery` can provide target decks. If target deck data is not available in this step, leave move operation out of UI but keep API and hook ready.

- [ ] **Step 5: Preserve fallback behavior**

If any organizer query fails:

```tsx
const organizerUnavailable = groupsQuery.isError || decksQuery.isError || deckQuestionsQuery.isError;
```

Show a small warning:

```tsx
<div className="pm-enter mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
  错题整理视图暂时不可用，当前展示基础错题列表。
</div>
```

Then render the existing filtered flat list from `items`.

- [ ] **Step 6: Verify UI**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web build
```

Expected: both exit 0.

Manual browser verification:

```powershell
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Verify:

- `/error-book` shows subject cards when organizer data exists.
- `/error-book?subjectGroupId=<id>` shows deck cards.
- `/error-book?deckId=<id>` shows wrong questions.
- detail overlay still supports note save, status toggle, delete, and add-to-review.
- no browser native confirm appears.
- mobile viewport keeps buttons at least 44px tall.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/app/(main)/error-book/page.tsx apps/web/src/components/error-book
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "feat: organize error book by subjects and decks"
```

---

### Task 7: Documentation, Final Verification, and Phase Wrap-up

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Optional modify: `README.md` if the public feature list should mention organized wrong-question decks.
- Verify: full relevant test suite.

- [ ] **Step 1: Update documentation**

Update docs with these facts:

- Phase 6.4 completed `WrongQuestionOrganizerAgent` deterministic policy.
- WrongQuestion organization uses PostgreSQL `WrongQuestionSubjectGroup`, `WrongQuestionDeck`, and `WrongQuestionDeckItem`.
- `/error-book` is now subject-first with deck drill-down.
- Organization layer does not replace WrongQuestion / Card / ReviewLog / ReviewTask as fact sources.
- First version does not call live AI models.
- Organization API is online-only and does not enter Dexie `mutationQueue`.
- Next recommended phase can be Phase 6.5 `ReviewAgent / PlannerAgent` or Phase 6.4.x UI polish if manual verification finds UX gaps.

- [ ] **Step 2: Run final verification**

Run:

```powershell
bun --cwd packages/types typecheck
bun --cwd packages/agent test
bun --cwd packages/agent typecheck
bun --cwd packages/database test
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all commands exit 0. If server e2e requires infrastructure:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

- [ ] **Step 3: Run browser acceptance**

Start project:

```powershell
$env:RAG_EMBEDDING_PROVIDER='fake'
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Use the browser to verify:

- Login/register still works.
- Saving a new OCR wrong question still shows success feedback.
- Organizer creates or refreshes subject/deck data after save.
- `/error-book` subject view, deck view, and detail view all work.
- Existing wrong-question CRUD interactions still work.

- [ ] **Step 4: Commit docs**

```powershell
git add AGENTS.md CLAUDE.md docs/data-flow.md docs/roadmap.md README.md
git commit --author="DRB-code-ing <3550215880@qq.com>" -m "docs: wrap up phase 6 wrong question organizer"
```

---

## Self-Review Checklist

- Spec coverage: tasks cover shared contracts, Prisma models, deterministic policy, server API, web API/hooks, `/error-book` UI, docs, and verification.
- Scope control: live model naming, complex deck merge UI, long-term memory, PlannerAgent integration, and Chat prompt injection stay outside Phase 6.4.
- Type consistency: API names use `wrong-question-groups`, `wrong-question-decks`, and `wrong-question-organizer`; Zod response types match planned server responses.
- Cost boundary: `WrongQuestionOrganizerAgent` has no live AI call and no API key usage.
- Data boundary: organizer writes only organization layer records and never mutates wrong-question content or FSRS facts.
