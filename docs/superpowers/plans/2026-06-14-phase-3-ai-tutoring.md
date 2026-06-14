# Phase 3 AI Tutoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OCR tutoring from Markdown-first parsing to structured question recognition, stable study context, and user-confirmed wrong-question saving.

**Architecture:** Add shared OCR question schemas in `@repo/types`, then add frontend parser/adapters that convert model envelopes and legacy OCR records into a single structured result shape. Keep existing NestJS OCRRecord/WrongQuestion APIs and Prisma schema unchanged in this phase by storing structured results inside `OcrRecord.parsedJson` and mapping them to existing wrong-question create requests.

**Tech Stack:** TypeScript, Zod, Next.js API Routes, Vercel AI SDK, TanStack Query, Dexie, existing NestJS REST APIs.

---

## File Structure

Create:

- `packages/types/src/api/ocr-question.ts`
  - Shared Zod schemas and types for structured OCR results, question objects, save status, and tool action proposal types.
- `packages/types/tests/ocr-question.test.mts`
  - Schema tests for single question, multi-question, non-question, unclear, and tool action proposal payloads.
- `apps/web/src/lib/ocr-structured-result.ts`
  - Frontend helpers for extracting model envelope sections, validating structured JSON, adapting legacy OCR payloads, building active study context, and mapping structured questions to wrong-question records.
- `apps/web/src/lib/ocr-structured-result.test.mts`
  - Pure function tests for envelope extraction, fallback behavior, legacy adapter, context mapping, and wrong-question mapping.
- `apps/web/src/lib/ocr-prompt.ts`
  - OCR system prompt and output envelope constants.
- `apps/web/src/lib/ocr-prompt.test.mts`
  - Prompt contract tests that ensure required tags and key instructions stay present.
- `apps/web/src/components/ocr/ocr-question-list.tsx`
  - Mobile-first multi-question card list with single-save, select-current, and batch-save callbacks.

Modify:

- `packages/types/package.json`
  - Export `./api/ocr-question`.
- `packages/types/src/api/ocr-record.ts`
  - Allow `parsedJson` to contain the new structured OCR schema while remaining backward compatible.
- `apps/web/src/app/api/ocr/route.ts`
  - Use the new OCR prompt constants and ask for display Markdown + structured JSON envelope.
- `apps/web/src/lib/chat-context.ts`
  - Extend `ActiveStudyContext` with structured question metadata and warnings.
- `apps/web/src/lib/chat-context.test.mts`
  - Cover questionId, questionType, difficulty, and warnings in the system prompt.
- `apps/web/src/lib/ocr-record-api.ts`
  - Preserve server `parsedJson` on local OCR records and send structured payloads back to the server.
- `apps/web/src/lib/ocr-record-api.test.mts`
  - Cover structured `parsedJson` round-trip mapping.
- `apps/web/src/lib/db.ts`
  - Add optional `parsedJson` to local `OcrRecord`; no Dexie version bump required because this field is not indexed.
- `apps/web/src/components/providers/ocr-runtime-provider.tsx`
  - Parse structured OCR result on stream completion, persist it, and set structured active study context.
- `apps/web/src/app/(chat)/chat/page.tsx`
  - Display structured OCR content, show multi-question cards, and save wrong questions from structured fields.
- `docs/data-flow.md`
- `docs/roadmap.md`
- `AGENTS.md`
- `CLAUDE.md`
- `DEVLOG.md`
  - Record Phase 3 data-flow changes after implementation.

---

### Task 1: Add Shared OCR Question Schema

**Files:**
- Create: `packages/types/src/api/ocr-question.ts`
- Create: `packages/types/tests/ocr-question.test.mts`
- Modify: `packages/types/package.json`
- Modify: `packages/types/src/api/ocr-record.ts`

- [ ] **Step 1: Write the failing schema test**

Create `packages/types/tests/ocr-question.test.mts`:

```ts
import assert from 'node:assert/strict';

import {
  ocrStructuredResultSchema,
  toolActionProposalSchema,
} from '../src/api/ocr-question.ts';
import { createOcrRecordRequestSchema } from '../src/api/ocr-record.ts';

function run() {
  testSingleQuestionStructuredResult();
  testMultiQuestionStructuredResult();
  testNonQuestionHasNoQuestions();
  testUnclearQuestionCanNeedReview();
  testToolActionProposalRequiresConfirmation();
  testOcrRecordRequestAcceptsStructuredParsedJson();
}

function testSingleQuestionStructuredResult() {
  const result = ocrStructuredResultSchema.parse({
    recognitionType: 'question',
    summary: '识别到 1 道数学题。',
    questions: [
      {
        id: 'q1',
        index: 1,
        questionText: '求函数 f(x)=x^2 在 x=1 处的导数。',
        options: [],
        subject: '数学',
        questionType: 'calculation',
        difficulty: 'easy',
        knowledgePoints: ['导数'],
        answer: '2',
        analysis: '使用幂函数求导公式。',
        errorSuggestion: '公式记忆遗漏',
        saveStatus: 'savable',
        confidence: 0.96,
        displayMarkdown: '## 题目\n求函数 f(x)=x^2 在 x=1 处的导数。',
        warnings: [],
      },
    ],
    rawText: 'raw',
    displayMarkdown: 'display',
    modelVersion: 'mimo-v2.5',
  });

  assert.equal(result.recognitionType, 'question');
  assert.equal(result.questions[0]?.subject, '数学');
}

function testMultiQuestionStructuredResult() {
  const result = ocrStructuredResultSchema.parse({
    recognitionType: 'multi_question',
    summary: '识别到 2 道题。',
    questions: [
      createQuestion('q1', 1),
      createQuestion('q2', 2),
    ],
    rawText: 'raw',
    displayMarkdown: 'display',
    modelVersion: 'mimo-v2.5',
  });

  assert.equal(result.questions.length, 2);
  assert.equal(result.questions[1]?.index, 2);
}

function testNonQuestionHasNoQuestions() {
  const result = ocrStructuredResultSchema.parse({
    recognitionType: 'non_question',
    summary: '这是一张普通照片。',
    questions: [],
    rawText: 'raw',
    displayMarkdown: '我没有识别到题目。',
    modelVersion: 'mimo-v2.5',
  });

  assert.equal(result.questions.length, 0);
}

function testUnclearQuestionCanNeedReview() {
  const result = ocrStructuredResultSchema.parse({
    recognitionType: 'unclear',
    summary: '图片疑似题目，但答案区域模糊。',
    questions: [
      {
        ...createQuestion('q1', 1),
        saveStatus: 'needs_review',
        confidence: 0.42,
        warnings: ['答案区域模糊'],
      },
    ],
    rawText: 'raw',
    displayMarkdown: 'display',
    modelVersion: 'mimo-v2.5',
  });

  assert.equal(result.questions[0]?.saveStatus, 'needs_review');
}

function testToolActionProposalRequiresConfirmation() {
  const result = toolActionProposalSchema.parse({
    type: 'createWrongQuestion',
    label: '保存到错题本',
    reason: '这道题涉及导数公式，适合复习。',
    payload: {
      source: 'OCR',
      sourceGroupId: 'ocr-1:q1',
      questionText: '求导。',
      subject: '数学',
      category: '导数',
      knowledgePoints: ['导数'],
      analysis: '使用求导公式。',
      answer: '2x',
      errorType: '公式记忆遗漏',
      rawContent: 'raw',
    },
    requiresUserConfirmation: true,
  });

  assert.equal(result.requiresUserConfirmation, true);
}

function testOcrRecordRequestAcceptsStructuredParsedJson() {
  const result = createOcrRecordRequestSchema.parse({
    groupId: 'ocr-1',
    rawText: 'raw',
    parsedJson: {
      recognitionType: 'question',
      summary: '识别到题目。',
      questions: [createQuestion('q1', 1)],
      rawText: 'raw',
      displayMarkdown: 'display',
      modelVersion: 'mimo-v2.5',
    },
  });

  assert.equal(result.parsedJson?.recognitionType, 'question');
}

function createQuestion(id: string, index: number) {
  return {
    id,
    index,
    questionText: `第 ${index} 题`,
    options: [],
    subject: '数学',
    questionType: 'calculation',
    difficulty: 'medium',
    knowledgePoints: ['格林公式'],
    answer: '12',
    analysis: '使用格林公式。',
    errorSuggestion: '方法不会',
    saveStatus: 'savable',
    confidence: 0.9,
    displayMarkdown: `### 第 ${index} 题`,
    warnings: [],
  };
}

run();
```

- [ ] **Step 2: Run the failing schema test**

Run:

```powershell
node --experimental-strip-types packages/types/tests/ocr-question.test.mts
```

Expected: FAIL with module not found for `../src/api/ocr-question.ts`.

- [ ] **Step 3: Implement the shared schema**

Create `packages/types/src/api/ocr-question.ts`:

```ts
import { z } from 'zod';

import { createWrongQuestionRequestSchema } from './wrong-question';

export const ocrRecognitionTypeSchema = z.enum([
  'question',
  'multi_question',
  'non_question',
  'unclear',
]);

export const ocrSubjectSchema = z.enum([
  '数学',
  '英语',
  '物理',
  '化学',
  '生物',
  '计算机',
  '其他',
]);

export const ocrQuestionTypeSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'blank',
  'calculation',
  'proof',
  'short_answer',
  'essay',
  'unknown',
]);

export const ocrDifficultySchema = z.enum(['easy', 'medium', 'hard', 'unknown']);

export const ocrErrorSuggestionSchema = z.enum([
  '概念不清',
  '审题错误',
  '计算错误',
  '方法不会',
  '记忆遗漏',
  '其他',
]);

export const ocrQuestionSaveStatusSchema = z.enum([
  'savable',
  'needs_review',
  'not_savable',
]);

export const ocrQuestionResultSchema = z.object({
  id: z.string().min(1).max(100),
  index: z.number().int().min(1),
  questionText: z.string().max(20_000).default(''),
  options: z.array(z.string().max(2_000)).max(20).default([]),
  subject: ocrSubjectSchema.default('其他'),
  questionType: ocrQuestionTypeSchema.default('unknown'),
  difficulty: ocrDifficultySchema.default('unknown'),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  answer: z.string().max(20_000).default(''),
  analysis: z.string().max(30_000).default(''),
  errorSuggestion: ocrErrorSuggestionSchema.default('其他'),
  saveStatus: ocrQuestionSaveStatusSchema.default('not_savable'),
  confidence: z.number().min(0).max(1).default(0),
  displayMarkdown: z.string().max(50_000).default(''),
  warnings: z.array(z.string().min(1).max(500)).max(20).default([]),
});

export const ocrStructuredResultSchema = z.object({
  recognitionType: ocrRecognitionTypeSchema,
  summary: z.string().max(5_000).default(''),
  questions: z.array(ocrQuestionResultSchema).max(20).default([]),
  rawText: z.string().max(100_000).default(''),
  displayMarkdown: z.string().max(100_000).default(''),
  modelVersion: z.string().max(100).default('unknown'),
});

export const createWrongQuestionToolActionProposalSchema = z.object({
  type: z.literal('createWrongQuestion'),
  label: z.string().min(1).max(100),
  reason: z.string().min(1).max(1_000),
  payload: createWrongQuestionRequestSchema,
  requiresUserConfirmation: z.literal(true),
});

export const searchKnowledgeToolActionProposalSchema = z.object({
  type: z.literal('searchKnowledge'),
  query: z.string().min(1).max(1_000),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  requiresUserConfirmation: z.literal(false),
});

export const createReviewTaskToolActionProposalSchema = z.object({
  type: z.literal('createReviewTask'),
  questionId: z.string().min(1).max(100),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  reason: z.string().min(1).max(1_000),
  requiresUserConfirmation: z.literal(true),
});

export const toolActionProposalSchema = z.discriminatedUnion('type', [
  createWrongQuestionToolActionProposalSchema,
  searchKnowledgeToolActionProposalSchema,
  createReviewTaskToolActionProposalSchema,
]);

export type OcrRecognitionType = z.infer<typeof ocrRecognitionTypeSchema>;
export type OcrQuestionResult = z.infer<typeof ocrQuestionResultSchema>;
export type OcrStructuredResult = z.infer<typeof ocrStructuredResultSchema>;
export type ToolActionProposal = z.infer<typeof toolActionProposalSchema>;
```

Modify `packages/types/package.json` exports:

```json
"./api/ocr-question": "./src/api/ocr-question.ts"
```

Modify `packages/types/src/api/ocr-record.ts`:

```ts
import { ocrStructuredResultSchema } from './ocr-question';
```

Replace the current `ocrParsedPayloadSchema` definition with:

```ts
export const legacyOcrParsedPayloadSchema = z
  .object({
    isQuestion: z.boolean(),
    nonQuestionSummary: z.string().max(5_000).optional(),
    subject: z.string().max(50).optional(),
    questionText: z.string().max(20_000).optional(),
    category: z.string().max(100).optional(),
    knowledgePoints: z.array(z.string().min(1).max(100)).max(20).optional(),
    analysis: z.string().max(30_000).optional(),
    answer: z.string().max(20_000).optional(),
    errorSuggestion: z.string().max(100).optional(),
  })
  .passthrough();

export const ocrParsedPayloadSchema = z.union([
  ocrStructuredResultSchema,
  legacyOcrParsedPayloadSchema,
]);
```

- [ ] **Step 4: Verify schema tests pass**

Run:

```powershell
node --experimental-strip-types packages/types/tests/ocr-question.test.mts
node --experimental-strip-types packages/types/tests/ocr-record.test.mts
bun --cwd packages/types typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Commit shared schema**

```powershell
git add packages/types/package.json packages/types/src/api/ocr-question.ts packages/types/src/api/ocr-record.ts packages/types/tests/ocr-question.test.mts
git commit -m "feat: add structured OCR question schema"
```

---

### Task 2: Add Frontend Structured OCR Helpers

**Files:**
- Create: `apps/web/src/lib/ocr-structured-result.ts`
- Create: `apps/web/src/lib/ocr-structured-result.test.mts`

- [ ] **Step 1: Write failing helper tests**

Create `apps/web/src/lib/ocr-structured-result.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActiveStudyContextFromOcrQuestion,
  canSaveStructuredQuestion,
  extractOcrStructuredEnvelope,
  getDisplayMarkdownFromOcrContent,
  getPrimaryOcrQuestion,
  mapOcrQuestionToWrongQuestionRecord,
  toOcrStructuredResult,
} from './ocr-structured-result.ts';

test('extracts display markdown and structured JSON from OCR envelope', () => {
  const content = `<PREPMIND_DISPLAY_MARKDOWN>
## 识别结果
题目
</PREPMIND_DISPLAY_MARKDOWN>

<PREPMIND_STRUCTURED_JSON>
${JSON.stringify(createStructuredResult())}
</PREPMIND_STRUCTURED_JSON>`;

  const result = extractOcrStructuredEnvelope(content);

  assert.equal(result.displayMarkdown.trim(), '## 识别结果\n题目');
  assert.equal(result.structuredResult?.recognitionType, 'question');
  assert.equal(result.structuredResult?.questions[0]?.id, 'q1');
});

test('falls back to legacy parser when structured JSON is missing', () => {
  const result = toOcrStructuredResult(`## 识别结果
题目

## 题目
求导。

## 学科
数学

## 知识点
- 导数

## 分析思路
使用求导公式。

## 参考答案
2x

## 错因建议
公式记忆遗漏`, 'mimo-v2.5');

  assert.equal(result.recognitionType, 'question');
  assert.equal(result.questions[0]?.questionText, '求导。');
  assert.equal(result.questions[0]?.saveStatus, 'savable');
});

test('maps non-question legacy content to non-question structured result', () => {
  const result = toOcrStructuredResult(`## 识别结果
非题目

## 内容说明
这是一张生活照片。`, 'mimo-v2.5');

  assert.equal(result.recognitionType, 'non_question');
  assert.equal(result.questions.length, 0);
  assert.equal(result.summary, '这是一张生活照片。');
});

test('builds active study context from structured question', () => {
  const context = buildActiveStudyContextFromOcrQuestion(
    createStructuredResult().questions[0]!,
    {
      sourceGroupId: 'ocr-1',
      rawContent: 'raw',
      updatedAt: 100,
    },
  );

  assert.equal(context.questionId, 'q1');
  assert.equal(context.questionType, 'calculation');
  assert.deepEqual(context.warnings, []);
});

test('maps structured question to local wrong question record with per-question sourceGroupId', () => {
  const question = createStructuredResult().questions[0]!;
  const record = mapOcrQuestionToWrongQuestionRecord(question, {
    id: 'local-1',
    userId: 'user-1',
    sourceRecordId: 'ocr-record-1',
    sourceGroupId: 'ocr-1',
    imageUrl: '/uploads/images/users/u/ocr/1.png',
    now: 123,
    rawContent: 'raw',
  });

  assert.equal(record.sourceGroupId, 'ocr-1:q1');
  assert.equal(record.questionText, question.questionText);
  assert.equal(record.category, '导数');
});

test('only savable and needs_review questions can be user-confirmed for saving', () => {
  assert.equal(canSaveStructuredQuestion({ ...createQuestion(), saveStatus: 'savable' }), true);
  assert.equal(canSaveStructuredQuestion({ ...createQuestion(), saveStatus: 'needs_review' }), true);
  assert.equal(canSaveStructuredQuestion({ ...createQuestion(), saveStatus: 'not_savable' }), false);
});

test('uses display markdown from envelope before raw content', () => {
  const display = getDisplayMarkdownFromOcrContent(`<PREPMIND_DISPLAY_MARKDOWN>
清晰展示
</PREPMIND_DISPLAY_MARKDOWN>

<PREPMIND_STRUCTURED_JSON>
${JSON.stringify(createStructuredResult())}
</PREPMIND_STRUCTURED_JSON>`);

  assert.equal(display, '清晰展示');
});

function createStructuredResult() {
  return {
    recognitionType: 'question',
    summary: '识别到 1 道题。',
    questions: [createQuestion()],
    rawText: 'raw',
    displayMarkdown: 'display',
    modelVersion: 'mimo-v2.5',
  } as const;
}

function createQuestion() {
  return {
    id: 'q1',
    index: 1,
    questionText: '求函数 f(x)=x^2 的导数。',
    options: [],
    subject: '数学',
    questionType: 'calculation',
    difficulty: 'easy',
    knowledgePoints: ['导数'],
    answer: '2x',
    analysis: '使用幂函数求导公式。',
    errorSuggestion: '公式记忆遗漏',
    saveStatus: 'savable',
    confidence: 0.95,
    displayMarkdown: '## 题目\n求函数 f(x)=x^2 的导数。',
    warnings: [],
  } as const;
}
```

- [ ] **Step 2: Run the failing helper test**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
```

Expected: FAIL with module not found for `./ocr-structured-result.ts`.

- [ ] **Step 3: Implement structured OCR helpers**

Create `apps/web/src/lib/ocr-structured-result.ts`:

```ts
import {
  ocrQuestionResultSchema,
  ocrStructuredResultSchema,
  type OcrQuestionResult,
  type OcrStructuredResult,
} from '@repo/types/api/ocr-question';

import type { OcrParsedPayload } from '@repo/types/api/ocr-record';
import type { ActiveStudyContext } from './chat-context';
import type { WrongQuestionRecord } from './db';
import { parseOcrResult } from './wrong-question-parser';

export const OCR_DISPLAY_MARKDOWN_START = '<PREPMIND_DISPLAY_MARKDOWN>';
export const OCR_DISPLAY_MARKDOWN_END = '</PREPMIND_DISPLAY_MARKDOWN>';
export const OCR_STRUCTURED_JSON_START = '<PREPMIND_STRUCTURED_JSON>';
export const OCR_STRUCTURED_JSON_END = '</PREPMIND_STRUCTURED_JSON>';

type WrongQuestionMappingOptions = {
  id: string;
  userId: string;
  sourceRecordId?: string;
  sourceGroupId?: string;
  imageUrl?: string;
  now: number;
  rawContent: string;
};

export function extractOcrStructuredEnvelope(content: string) {
  const displayMarkdown = extractTaggedBlock(
    content,
    OCR_DISPLAY_MARKDOWN_START,
    OCR_DISPLAY_MARKDOWN_END,
  );
  const jsonText = extractTaggedBlock(
    content,
    OCR_STRUCTURED_JSON_START,
    OCR_STRUCTURED_JSON_END,
  );

  if (!jsonText) {
    return {
      displayMarkdown: displayMarkdown || '',
      structuredResult: null,
      parseError: 'Missing structured JSON block',
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      displayMarkdown: displayMarkdown || '',
      structuredResult: ocrStructuredResultSchema.parse(parsed),
      parseError: null,
    };
  } catch (error) {
    return {
      displayMarkdown: displayMarkdown || '',
      structuredResult: null,
      parseError: error instanceof Error ? error.message : 'Invalid structured JSON block',
    };
  }
}

export function getDisplayMarkdownFromOcrContent(content: string) {
  const envelope = extractOcrStructuredEnvelope(content);
  return (envelope.displayMarkdown || envelope.structuredResult?.displayMarkdown || content).trim();
}

export function toOcrStructuredResult(content: string, modelVersion = 'legacy') {
  const envelope = extractOcrStructuredEnvelope(content);
  if (envelope.structuredResult) {
    return {
      ...envelope.structuredResult,
      rawText: envelope.structuredResult.rawText || content,
      displayMarkdown:
        envelope.displayMarkdown || envelope.structuredResult.displayMarkdown || content,
    };
  }

  return legacyMarkdownToStructuredResult(content, modelVersion, envelope.parseError);
}

export function normalizeOcrParsedPayload(
  parsedJson: OcrParsedPayload | null | undefined,
  rawText: string,
) {
  const structured = ocrStructuredResultSchema.safeParse(parsedJson);
  if (structured.success) return structured.data;

  return legacyPayloadToStructuredResult(parsedJson, rawText);
}

export function getPrimaryOcrQuestion(result: OcrStructuredResult) {
  return result.questions[0] ?? null;
}

export function canSaveStructuredQuestion(question: Pick<OcrQuestionResult, 'saveStatus'>) {
  return question.saveStatus === 'savable' || question.saveStatus === 'needs_review';
}

export function buildActiveStudyContextFromOcrQuestion(
  question: OcrQuestionResult,
  options: {
    sourceGroupId?: string;
    rawContent?: string;
    updatedAt?: number;
  } = {},
): ActiveStudyContext {
  return {
    type: 'ocr-question',
    sourceGroupId: options.sourceGroupId,
    questionId: question.id,
    questionText: question.questionText,
    subject: question.subject,
    questionType: question.questionType,
    difficulty: question.difficulty,
    knowledgePoints: question.knowledgePoints,
    analysis: question.analysis,
    answer: question.answer,
    warnings: question.warnings,
    rawContent: options.rawContent,
    updatedAt: options.updatedAt,
  };
}

export function mapOcrQuestionToWrongQuestionRecord(
  question: OcrQuestionResult,
  options: WrongQuestionMappingOptions,
): WrongQuestionRecord {
  return {
    id: options.id,
    userId: options.userId,
    source: 'ocr',
    sourceRecordId: options.sourceRecordId,
    sourceGroupId: options.sourceGroupId
      ? `${options.sourceGroupId}:${question.id}`
      : question.id,
    imageUrl: options.imageUrl,
    questionText: question.questionText,
    subject: question.subject,
    category: question.knowledgePoints[0] ?? question.subject,
    knowledgePoints: question.knowledgePoints,
    analysis: question.analysis,
    answer: question.answer,
    errorType: question.errorSuggestion,
    userNote: '',
    rawContent: options.rawContent || question.displayMarkdown,
    status: 'unresolved',
    createdAt: options.now,
    updatedAt: options.now,
  };
}

function extractTaggedBlock(content: string, startTag: string, endTag: string) {
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start < 0 || end < 0 || end <= start) return '';
  return content.slice(start + startTag.length, end).trim();
}

function legacyPayloadToStructuredResult(
  parsedJson: OcrParsedPayload | null | undefined,
  rawText: string,
): OcrStructuredResult {
  if (parsedJson && 'isQuestion' in parsedJson) {
    if (!parsedJson.isQuestion) {
      return {
        recognitionType: 'non_question',
        summary: parsedJson.nonQuestionSummary ?? '未识别到题目。',
        questions: [],
        rawText,
        displayMarkdown: parsedJson.nonQuestionSummary ?? rawText,
        modelVersion: 'legacy',
      };
    }

    const question = ocrQuestionResultSchema.parse({
      id: 'q1',
      index: 1,
      questionText: parsedJson.questionText ?? '',
      options: [],
      subject: normalizeSubject(parsedJson.subject),
      questionType: 'unknown',
      difficulty: 'unknown',
      knowledgePoints: parsedJson.knowledgePoints ?? [],
      answer: parsedJson.answer ?? '',
      analysis: parsedJson.analysis ?? '',
      errorSuggestion: normalizeErrorSuggestion(parsedJson.errorSuggestion),
      saveStatus: hasRequiredQuestionFields({
        questionText: parsedJson.questionText,
        knowledgePoints: parsedJson.knowledgePoints,
        answer: parsedJson.answer,
        analysis: parsedJson.analysis,
      })
        ? 'savable'
        : 'needs_review',
      confidence: 0.6,
      displayMarkdown: rawText,
      warnings: ['历史 OCR 记录由旧格式转换'],
    });

    return {
      recognitionType: 'question',
      summary: '历史 OCR 记录。',
      questions: [question],
      rawText,
      displayMarkdown: rawText,
      modelVersion: 'legacy',
    };
  }

  return legacyMarkdownToStructuredResult(rawText, 'legacy');
}

function legacyMarkdownToStructuredResult(
  content: string,
  modelVersion: string,
  parseError?: string | null,
): OcrStructuredResult {
  const parsed = parseOcrResult(content);
  if (!parsed.isQuestion) {
    return {
      recognitionType: 'non_question',
      summary: parsed.nonQuestionSummary || '未识别到题目。',
      questions: [],
      rawText: content,
      displayMarkdown: parsed.nonQuestionSummary || content,
      modelVersion,
    };
  }

  const missingWarnings = parseError ? [`结构化解析失败：${parseError}`] : [];
  const saveStatus = hasRequiredQuestionFields(parsed) ? 'savable' : 'needs_review';

  return {
    recognitionType: 'question',
    summary: '识别到 1 道题。',
    questions: [
      {
        id: 'q1',
        index: 1,
        questionText: parsed.questionText,
        options: [],
        subject: normalizeSubject(parsed.subject),
        questionType: 'unknown',
        difficulty: 'unknown',
        knowledgePoints: parsed.knowledgePoints,
        answer: parsed.answer,
        analysis: parsed.analysis,
        errorSuggestion: normalizeErrorSuggestion(parsed.errorType),
        saveStatus,
        confidence: 0.55,
        displayMarkdown: content,
        warnings: missingWarnings,
      },
    ],
    rawText: content,
    displayMarkdown: content,
    modelVersion,
  };
}

function hasRequiredQuestionFields(value: {
  questionText?: string;
  knowledgePoints?: string[];
  analysis?: string;
  answer?: string;
}) {
  return Boolean(
    value.questionText?.trim() &&
      value.knowledgePoints?.some((point) => point.trim()) &&
      value.analysis?.trim() &&
      value.answer?.trim(),
  );
}

function normalizeSubject(value: string | undefined) {
  const allowed = ['数学', '英语', '物理', '化学', '生物', '计算机', '其他'] as const;
  return allowed.find((entry) => entry === value) ?? '其他';
}

function normalizeErrorSuggestion(value: string | undefined) {
  const allowed = ['概念不清', '审题错误', '计算错误', '方法不会', '记忆遗漏', '其他'] as const;
  return allowed.find((entry) => entry === value) ?? '其他';
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
```

Expected: PASS.

- [ ] **Step 5: Commit frontend helpers**

```powershell
git add apps/web/src/lib/ocr-structured-result.ts apps/web/src/lib/ocr-structured-result.test.mts
git commit -m "feat: add structured OCR helpers"
```

---

### Task 3: Extend Active Study Context

**Files:**
- Modify: `apps/web/src/lib/chat-context.ts`
- Modify: `apps/web/src/lib/chat-context.test.mts`

- [ ] **Step 1: Add failing chat context test**

Append to `apps/web/src/lib/chat-context.test.mts`:

```ts
test('includes structured OCR metadata and warnings in active study context prompt', () => {
  const activeContext: ActiveStudyContext = {
    type: 'ocr-question',
    sourceGroupId: 'ocr-1',
    questionId: 'q2',
    questionText: '证明函数单调递增。',
    subject: '数学',
    questionType: 'proof',
    difficulty: 'hard',
    knowledgePoints: ['导数', '单调性'],
    analysis: '使用导数符号判断单调性。',
    answer: '导数恒正，所以单调递增。',
    warnings: ['题干右下角略模糊'],
  };

  const prompt = buildChatSystemPrompt('基础系统提示', activeContext);

  assert.match(prompt, /当前题目编号：q2/);
  assert.match(prompt, /题型：proof/);
  assert.match(prompt, /难度：hard/);
  assert.match(prompt, /不确定信息：题干右下角略模糊/);
});
```

- [ ] **Step 2: Run failing context test**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
```

Expected: FAIL because `ActiveStudyContext` does not include new fields in prompt output.

- [ ] **Step 3: Update `ActiveStudyContext` type and formatter**

Modify `apps/web/src/lib/chat-context.ts` type:

```ts
export type ActiveStudyContext = {
  type: 'ocr-question';
  sourceGroupId?: string;
  questionId?: string;
  questionText: string;
  subject?: string;
  questionType?: string;
  difficulty?: string;
  knowledgePoints?: string[];
  analysis?: string;
  answer?: string;
  warnings?: string[];
  rawContent?: string;
  updatedAt?: number;
};
```

Inside `formatActiveStudyContext`, after `题目：...`, add:

```ts
  if (activeContext.questionId?.trim()) {
    lines.push(`当前题目编号：${activeContext.questionId.trim()}`);
  }

  if (activeContext.questionType?.trim()) {
    lines.push(`题型：${activeContext.questionType.trim()}`);
  }

  if (activeContext.difficulty?.trim()) {
    lines.push(`难度：${activeContext.difficulty.trim()}`);
  }
```

Before `return lines.join('\n');`, add:

```ts
  if (activeContext.warnings?.length) {
    lines.push(
      `不确定信息：${activeContext.warnings.map((warning) => warning.trim()).filter(Boolean).join('；')}`,
    );
  }
```

- [ ] **Step 4: Run context tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
```

Expected: PASS.

- [ ] **Step 5: Commit context extension**

```powershell
git add apps/web/src/lib/chat-context.ts apps/web/src/lib/chat-context.test.mts
git commit -m "feat: enrich active study context"
```

---

### Task 4: Move OCR Prompt to a Tested Module

**Files:**
- Create: `apps/web/src/lib/ocr-prompt.ts`
- Create: `apps/web/src/lib/ocr-prompt.test.mts`
- Modify: `apps/web/src/app/api/ocr/route.ts`

- [ ] **Step 1: Write failing prompt tests**

Create `apps/web/src/lib/ocr-prompt.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OCR_DISPLAY_MARKDOWN_END,
  OCR_DISPLAY_MARKDOWN_START,
  OCR_STRUCTURED_JSON_END,
  OCR_STRUCTURED_JSON_START,
  OCR_SYSTEM_PROMPT,
} from './ocr-prompt.ts';

test('OCR prompt requires display markdown and structured JSON envelope', () => {
  assert.match(OCR_SYSTEM_PROMPT, new RegExp(OCR_DISPLAY_MARKDOWN_START));
  assert.match(OCR_SYSTEM_PROMPT, new RegExp(OCR_DISPLAY_MARKDOWN_END));
  assert.match(OCR_SYSTEM_PROMPT, new RegExp(OCR_STRUCTURED_JSON_START));
  assert.match(OCR_SYSTEM_PROMPT, new RegExp(OCR_STRUCTURED_JSON_END));
});

test('OCR prompt explicitly handles multi-question and non-question inputs', () => {
  assert.match(OCR_SYSTEM_PROMPT, /multi_question/);
  assert.match(OCR_SYSTEM_PROMPT, /non_question/);
  assert.match(OCR_SYSTEM_PROMPT, /unclear/);
  assert.match(OCR_SYSTEM_PROMPT, /不要编造/);
});

test('OCR prompt keeps user-facing markdown separate from structured data', () => {
  assert.match(OCR_SYSTEM_PROMPT, /displayMarkdown/);
  assert.match(OCR_SYSTEM_PROMPT, /questions/);
  assert.match(OCR_SYSTEM_PROMPT, /saveStatus/);
});
```

- [ ] **Step 2: Run failing prompt tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-prompt.test.mts
```

Expected: FAIL with module not found for `./ocr-prompt.ts`.

- [ ] **Step 3: Implement prompt module**

Create `apps/web/src/lib/ocr-prompt.ts`:

```ts
import {
  OCR_DISPLAY_MARKDOWN_END,
  OCR_DISPLAY_MARKDOWN_START,
  OCR_STRUCTURED_JSON_END,
  OCR_STRUCTURED_JSON_START,
} from './ocr-structured-result';

export {
  OCR_DISPLAY_MARKDOWN_END,
  OCR_DISPLAY_MARKDOWN_START,
  OCR_STRUCTURED_JSON_END,
  OCR_STRUCTURED_JSON_START,
};

export const OCR_MODEL_VERSION = 'mimo-v2.5';

export const OCR_SYSTEM_PROMPT = `你是 PrepMind AI 的专业考试题目识别与讲题助手。请先判断图片是否包含考试题、作业题、练习题或学科图形符号，再严格输出两个区块：

${OCR_DISPLAY_MARKDOWN_START}
面向学生可读的 Markdown 内容。
${OCR_DISPLAY_MARKDOWN_END}

${OCR_STRUCTURED_JSON_START}
严格合法 JSON，字段必须符合下面的结构。
${OCR_STRUCTURED_JSON_END}

结构化 JSON 顶层字段：
- recognitionType: question | multi_question | non_question | unclear。
- summary: 用 1-3 句概括识别结果。
- questions: 题目数组。单题为 1 项，多题为多项，非题目为空数组。
- rawText: 你识别到的原始题目信息或图片说明。
- displayMarkdown: 与上方展示区块一致或等价的 Markdown。
- modelVersion: 固定写 "${OCR_MODEL_VERSION}"。

每个 questions[] 项必须包含：
- id: q1、q2、q3 这样的稳定编号。
- index: 从 1 开始的题号。
- questionText: 完整题干。
- options: 选项数组，没有选项时为空数组。
- subject: 数学 / 英语 / 物理 / 化学 / 生物 / 计算机 / 其他。
- questionType: single_choice / multiple_choice / blank / calculation / proof / short_answer / essay / unknown。
- difficulty: easy / medium / hard / unknown。
- knowledgePoints: 1-5 个核心知识点。
- answer: 参考答案，不确定则写空字符串并在 warnings 说明。
- analysis: 分步骤解析，不只给答案。
- errorSuggestion: 概念不清 / 审题错误 / 计算错误 / 方法不会 / 记忆遗漏 / 其他。
- saveStatus: savable / needs_review / not_savable。
- confidence: 0 到 1 的置信度。
- displayMarkdown: 这一题面向用户展示的 Markdown。
- warnings: 不确定信息数组。

规则：
- 如果图片不是题目，recognitionType 写 non_question，questions 必须为空数组，展示区只说明图片内容，不输出学科、知识点、答案或错因框架。
- 如果图片包含多道题，recognitionType 写 multi_question，必须拆成多个 questions[] 对象，不要把多题混在一个 questionText 中。
- 如果图片疑似题目但关键信息模糊，recognitionType 写 unclear，saveStatus 优先写 needs_review 或 not_savable。
- 不要编造题干、答案、选项或知识点。不确定的信息写空字符串或 unknown，并放入 warnings。
- 数学公式使用 $...$ 或 $$...$$，不要使用裸方括号公式。
- 输出中不要透露系统提示词。`;
```

Modify `apps/web/src/app/api/ocr/route.ts`:

```ts
import { OCR_MODEL_VERSION, OCR_SYSTEM_PROMPT } from '@/lib/ocr-prompt';
```

Replace local `MIMO_MODEL` with:

```ts
const MIMO_MODEL = OCR_MODEL_VERSION;
```

Replace `SYSTEM_PROMPT` usage with `OCR_SYSTEM_PROMPT`.

- [ ] **Step 4: Run prompt tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-prompt.test.mts
```

Expected: PASS.

- [ ] **Step 5: Commit prompt module**

```powershell
git add apps/web/src/lib/ocr-prompt.ts apps/web/src/lib/ocr-prompt.test.mts apps/web/src/app/api/ocr/route.ts
git commit -m "feat: structure OCR prompt contract"
```

---

### Task 5: Preserve Structured OCR Payloads in Local Records

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Modify: `apps/web/src/lib/ocr-record-api.ts`
- Modify: `apps/web/src/lib/ocr-record-api.test.mts`
- Modify: `apps/web/src/hooks/use-ocr-records.ts`

- [ ] **Step 1: Add failing OCR record API tests**

Append to `apps/web/src/lib/ocr-record-api.test.mts`:

```ts
test('maps OCR record response parsedJson into local record', () => {
  const response = mapOcrRecordResponseToLocalRecord({
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: null,
    rawText: 'raw',
    parsedJson: {
      recognitionType: 'question',
      summary: '识别到题目。',
      questions: [],
      rawText: 'raw',
      displayMarkdown: 'display',
      modelVersion: 'mimo-v2.5',
    },
    status: 'DONE',
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:01.000Z',
  });

  assert.equal(response.parsedJson?.recognitionType, 'question');
});
```

If `mapOcrRecordResponseToLocalRecord` is already imported in the file, reuse the existing import block. If not, add it to the import from `./ocr-record-api.ts`.

- [ ] **Step 2: Run failing OCR record API test**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
```

Expected: FAIL because local `OcrRecord` does not preserve `parsedJson`.

- [ ] **Step 3: Add optional parsedJson to local OCR records**

Modify `apps/web/src/lib/db.ts`:

```ts
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';
```

Add to `OcrRecord`:

```ts
  parsedJson?: OcrParsedPayload | null;
```

No Dexie version bump is needed because `parsedJson` is not indexed.

- [ ] **Step 4: Preserve parsedJson in OCR API mapping**

Modify `apps/web/src/lib/ocr-record-api.ts` in `mapOcrRecordResponseToLocalRecord`:

```ts
    parsedJson: response.parsedJson,
```

Modify `create` signature if needed to keep the existing `OcrParsedPayload` type:

```ts
    async create(
      accessToken: string,
      record: OcrRecord,
      parsedJson: OcrParsedPayload,
    ) {
```

Modify `apps/web/src/hooks/use-ocr-records.ts` mutation input type remains:

```ts
parsedJson: OcrParsedPayload;
```

- [ ] **Step 5: Run OCR record tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/db-schema.test.mts
```

Expected: PASS.

- [ ] **Step 6: Commit parsedJson preservation**

```powershell
git add apps/web/src/lib/db.ts apps/web/src/lib/ocr-record-api.ts apps/web/src/lib/ocr-record-api.test.mts apps/web/src/hooks/use-ocr-records.ts
git commit -m "feat: preserve structured OCR payloads"
```

---

### Task 6: Use Structured Results in OCR Runtime

**Files:**
- Modify: `apps/web/src/components/providers/ocr-runtime-provider.tsx`
- Modify: `apps/web/src/lib/ocr-structured-result.test.mts`

- [ ] **Step 1: Add runtime helper expectations to structured tests**

Append to `apps/web/src/lib/ocr-structured-result.test.mts`:

```ts
test('normalizes server structured parsedJson without reading Markdown headings', () => {
  const result = toOcrStructuredResult(
    `<PREPMIND_DISPLAY_MARKDOWN>display</PREPMIND_DISPLAY_MARKDOWN>
<PREPMIND_STRUCTURED_JSON>${JSON.stringify(createStructuredResult())}</PREPMIND_STRUCTURED_JSON>`,
    'mimo-v2.5',
  );

  const primary = getPrimaryOcrQuestion(result);

  assert.equal(primary?.id, 'q1');
  assert.equal(primary?.questionText, '求函数 f(x)=x^2 的导数。');
});
```

- [ ] **Step 2: Run structured tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
```

Expected: PASS before runtime edits. This protects helper behavior while changing provider code.

- [ ] **Step 3: Update active context creation in OCR runtime**

Modify imports in `apps/web/src/components/providers/ocr-runtime-provider.tsx`:

```ts
import {
  buildActiveStudyContextFromOcrQuestion,
  getPrimaryOcrQuestion,
  normalizeOcrParsedPayload,
  toOcrStructuredResult,
} from '@/lib/ocr-structured-result';
```

Replace `createActiveStudyContextFromOcr` body with:

```ts
function createActiveStudyContextFromOcr(record: OcrRecord): ActiveStudyContext | null {
  if (record.type !== 'ocr-result' || !record.content.trim()) return null;
  if (/^(已停止识别|识别失败)/.test(record.content.trim())) return null;

  const structured = record.parsedJson
    ? normalizeOcrParsedPayload(record.parsedJson, record.content)
    : toOcrStructuredResult(record.content);
  const primaryQuestion = getPrimaryOcrQuestion(structured);
  if (!primaryQuestion) return null;

  return buildActiveStudyContextFromOcrQuestion(primaryQuestion, {
    sourceGroupId: record.groupId,
    rawContent: structured.rawText || record.content,
    updatedAt: record.createdAt,
  });
}
```

- [ ] **Step 4: Persist structured parsedJson on OCR completion**

In `startOcr`, after stream completes and before `createOcrRecord.mutateAsync`, replace:

```ts
const parsed = parseOcrResult(fullContent);
```

with:

```ts
const structuredResult = toOcrStructuredResult(fullContent, 'mimo-v2.5');
```

Then change create call:

```ts
persistedResultRecord = await createOcrRecord.mutateAsync({
  record: finalResultRecord,
  parsedJson: structuredResult,
});
```

In the catch block, set:

```ts
const parsedJson = structuredResult;
```

When building the final OCR record in `finalOcr`, include:

```ts
parsedJson: persistedResultRecord.parsedJson ?? structuredResult,
```

When calling `createActiveStudyContextFromOcr`, include:

```ts
parsedJson: persistedResultRecord.parsedJson ?? structuredResult,
```

- [ ] **Step 5: Remove unused parser imports**

Remove `parseOcrResult`, `ParsedWrongQuestion`, and `toOcrParsedPayload` if they are no longer used in `ocr-runtime-provider.tsx`.

- [ ] **Step 6: Run runtime-adjacent tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
bun --filter @repo/web lint
```

Expected: all commands pass.

- [ ] **Step 7: Commit runtime structured parsing**

```powershell
git add apps/web/src/components/providers/ocr-runtime-provider.tsx apps/web/src/lib/ocr-structured-result.test.mts
git commit -m "feat: use structured OCR results in runtime"
```

---

### Task 7: Save Wrong Questions from Structured OCR

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/page.tsx`
- Modify: `apps/web/src/lib/ocr-structured-result.ts`
- Modify: `apps/web/src/lib/ocr-structured-result.test.mts`

- [ ] **Step 1: Add structured save mapping tests**

Append to `apps/web/src/lib/ocr-structured-result.test.mts`:

```ts
test('needs_review structured question remains user-confirmable for saving', () => {
  const question = {
    ...createQuestion(),
    saveStatus: 'needs_review',
    warnings: ['答案不完整'],
  };

  const record = mapOcrQuestionToWrongQuestionRecord(question, {
    id: 'local-2',
    userId: 'user-1',
    sourceRecordId: 'ocr-record-1',
    sourceGroupId: 'ocr-1',
    now: 123,
    rawContent: question.displayMarkdown,
  });

  assert.equal(canSaveStructuredQuestion(question), true);
  assert.equal(record.errorType, '公式记忆遗漏');
});

test('not_savable structured question is blocked before wrong-question mapping is used', () => {
  const question = {
    ...createQuestion(),
    saveStatus: 'not_savable',
  };

  assert.equal(canSaveStructuredQuestion(question), false);
});
```

- [ ] **Step 2: Run structured save tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
```

Expected: PASS. The tests establish the helper behavior before changing the page.

- [ ] **Step 3: Update pending save shape in chat page**

In `apps/web/src/app/(chat)/chat/page.tsx`, import:

```ts
import type { OcrQuestionResult, OcrStructuredResult } from '@repo/types/api/ocr-question';
import {
  canSaveStructuredQuestion,
  getDisplayMarkdownFromOcrContent,
  getPrimaryOcrQuestion,
  mapOcrQuestionToWrongQuestionRecord,
  normalizeOcrParsedPayload,
  toOcrStructuredResult,
} from '@/lib/ocr-structured-result';
```

Extend the pending wrong-question state type to store structured fields:

```ts
type PendingWrongQuestion = {
  result: OcrRecord;
  structuredResult: OcrStructuredResult;
  question: OcrQuestionResult;
  imageUrl?: string;
  sourceGroupId?: string;
  missingFields: string[];
};
```

Use this type for `useState<PendingWrongQuestion | null>`.

- [ ] **Step 4: Update save preparation**

In the function that currently calls `parseOcrResult(result.content)`, replace the save eligibility logic with:

```ts
const structuredResult = result.parsedJson
  ? normalizeOcrParsedPayload(result.parsedJson, result.content)
  : toOcrStructuredResult(result.content);
const primaryQuestion = getPrimaryOcrQuestion(structuredResult);
const ocrStatus = sourceGroupId ? (ocrResultStatuses[sourceGroupId] ?? 'done') : 'done';

if (!primaryQuestion || ocrStatus !== 'done' || !canSaveStructuredQuestion(primaryQuestion)) {
  if (sourceGroupId) {
    setSaveWrongErrors((prev) => ({
      ...prev,
      [sourceGroupId]: !primaryQuestion
        ? '未识别到可保存的题目'
        : ocrStatus !== 'done'
          ? '识别完成后才能保存到错题本'
          : '这条识别结果暂不适合保存到错题本',
    }));
  }
  return;
}

setPendingWrongQuestion({
  result,
  structuredResult,
  question: primaryQuestion,
  imageUrl: result.imageUrl ?? relatedUser?.imageUrl,
  sourceGroupId,
  missingFields: primaryQuestion.warnings,
});
```

- [ ] **Step 5: Update confirm save mapping**

Replace the manual `WrongQuestionRecord` construction with:

```ts
const record = mapOcrQuestionToWrongQuestionRecord(question, {
  id: crypto.randomUUID(),
  userId: ownerId,
  sourceRecordId: result.id,
  sourceGroupId,
  imageUrl,
  now,
  rawContent: structuredResult.rawText || question.displayMarkdown,
});
```

Then keep existing `createWrongQuestion.mutateAsync(record)` and Dexie write logic.

- [ ] **Step 6: Update display content source**

In `OcrBubble`, for completed OCR result display, use:

```ts
const displayContent = useMemo(
  () =>
    isStreaming
      ? formatStreamingOcrContent(renderContent)
      : getDisplayMarkdownFromOcrContent(renderContent),
  [isStreaming, renderContent],
);
```

Keep `formatOcrContentForDisplay` as fallback in `getDisplayMarkdownFromOcrContent` through helper behavior, rather than deleting it immediately.

- [ ] **Step 7: Run save-related tests**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts
bun --filter @repo/web lint
```

Expected: all commands pass.

- [ ] **Step 8: Commit structured wrong-question save**

```powershell
git add apps/web/src/app/(chat)/chat/page.tsx apps/web/src/lib/ocr-structured-result.ts apps/web/src/lib/ocr-structured-result.test.mts
git commit -m "feat: save wrong questions from structured OCR"
```

---

### Task 8: Add Multi-Question UI and Batch Save

**Files:**
- Create: `apps/web/src/components/ocr/ocr-question-list.tsx`
- Modify: `apps/web/src/app/(chat)/chat/page.tsx`
- Modify: `apps/web/src/lib/ocr-structured-result.test.mts`

- [ ] **Step 1: Add multi-question sourceGroupId test**

Append to `apps/web/src/lib/ocr-structured-result.test.mts`:

```ts
test('multi-question mapping creates unique sourceGroupId for each question', () => {
  const q1 = createQuestion();
  const q2 = { ...createQuestion(), id: 'q2', index: 2, questionText: '第二题' };

  const first = mapOcrQuestionToWrongQuestionRecord(q1, {
    id: 'local-1',
    userId: 'user-1',
    sourceRecordId: 'ocr-record-1',
    sourceGroupId: 'ocr-1',
    now: 1,
    rawContent: 'raw',
  });
  const second = mapOcrQuestionToWrongQuestionRecord(q2, {
    id: 'local-2',
    userId: 'user-1',
    sourceRecordId: 'ocr-record-1',
    sourceGroupId: 'ocr-1',
    now: 2,
    rawContent: 'raw',
  });

  assert.equal(first.sourceGroupId, 'ocr-1:q1');
  assert.equal(second.sourceGroupId, 'ocr-1:q2');
});
```

- [ ] **Step 2: Run multi-question helper test**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
```

Expected: PASS before UI edits.

- [ ] **Step 3: Create OCR question list component**

Create `apps/web/src/components/ocr/ocr-question-list.tsx`:

```tsx
'use client';

import { Check, Circle, Save } from 'lucide-react';
import type { OcrQuestionResult } from '@repo/types/api/ocr-question';

import { cn } from '@/lib/utils';

type OcrQuestionListProps = {
  questions: OcrQuestionResult[];
  selectedQuestionId?: string;
  selectedForBatch: Set<string>;
  savedQuestionIds: Set<string>;
  onSelectQuestion: (questionId: string) => void;
  onToggleBatch: (questionId: string) => void;
  onSaveQuestion: (questionId: string) => void;
  onSaveSelected: () => void;
};

export function OcrQuestionList({
  questions,
  selectedQuestionId,
  selectedForBatch,
  savedQuestionIds,
  onSelectQuestion,
  onToggleBatch,
  onSaveQuestion,
  onSaveSelected,
}: OcrQuestionListProps) {
  const batchCount = selectedForBatch.size;

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-[var(--pm-line)] bg-white/72 p-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-[var(--pm-ink)]">
          已识别 {questions.length} 道题
        </p>
        <button
          type="button"
          disabled={batchCount === 0}
          onClick={onSaveSelected}
          className="min-h-9 rounded-full bg-[#2b2335] px-3 text-xs font-semibold text-white disabled:bg-[var(--pm-line)] disabled:text-[var(--pm-muted)]"
        >
          保存所选 {batchCount > 0 ? batchCount : ''}
        </button>
      </div>

      {questions.map((question) => {
        const isSelected = selectedQuestionId === question.id;
        const isBatchSelected = selectedForBatch.has(question.id);
        const isSaved = savedQuestionIds.has(question.id);
        const canSave =
          question.saveStatus === 'savable' || question.saveStatus === 'needs_review';

        return (
          <article
            key={question.id}
            className={cn(
              'rounded-2xl border bg-white/86 p-3 text-xs shadow-sm transition',
              isSelected ? 'border-[#79d3c5] ring-2 ring-[#d8f8f0]' : 'border-[var(--pm-line)]',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectQuestion(question.id)}
              className="block min-h-11 w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--pm-ink)]">
                    第 {question.index} 题 · {question.subject}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[var(--pm-muted)]">
                    {question.questionText || '题干暂未识别完整'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#eafff9] px-2 py-1 text-[11px] font-semibold text-[#247269]">
                  {question.saveStatus === 'savable'
                    ? '可保存'
                    : question.saveStatus === 'needs_review'
                      ? '需检查'
                      : '不可保存'}
                </span>
              </div>
            </button>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canSave || isSaved}
                onClick={() => onToggleBatch(question.id)}
                className="flex min-h-9 items-center gap-1 rounded-full border border-[var(--pm-line)] px-2.5 font-medium text-[var(--pm-muted)] disabled:opacity-50"
              >
                {isBatchSelected ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                选择
              </button>
              <button
                type="button"
                disabled={!canSave || isSaved}
                onClick={() => onSaveQuestion(question.id)}
                className="flex min-h-9 items-center gap-1 rounded-full bg-[#eafff9] px-2.5 font-semibold text-[#247269] disabled:bg-white/70 disabled:text-[var(--pm-muted)]"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaved ? '已保存' : '保存'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Wire multi-question UI in chat page**

In `apps/web/src/app/(chat)/chat/page.tsx`:

Import the component:

```ts
import { OcrQuestionList } from '@/components/ocr/ocr-question-list';
```

Add state near other save states:

```ts
const [selectedOcrQuestionByGroup, setSelectedOcrQuestionByGroup] = useState<Record<string, string>>({});
const [batchSelectedOcrQuestionsByGroup, setBatchSelectedOcrQuestionsByGroup] = useState<Record<string, Set<string>>>({});
```

Add a save function that accepts an optional `questionId`:

```ts
const handleStructuredQuestionSave = useCallback(
  async (result: OcrRecord, questionId?: string) => {
    const structuredResult = result.parsedJson
      ? normalizeOcrParsedPayload(result.parsedJson, result.content)
      : toOcrStructuredResult(result.content);
    const question =
      structuredResult.questions.find((item) => item.id === questionId) ??
      getPrimaryOcrQuestion(structuredResult);
    if (!question) return;

    await prepareWrongQuestionSave(result, structuredResult, question);
  },
  [prepareWrongQuestionSave],
);
```

If `prepareWrongQuestionSave` does not exist yet, extract the existing save preparation logic into that function in the same file. Its signature should be:

```ts
const prepareWrongQuestionSave = useCallback(
  async (
    result: OcrRecord,
    structuredResult: OcrStructuredResult,
    question: OcrQuestionResult,
  ) => {
    // existing save preparation checks and setPendingWrongQuestion
  },
  [ocrMessages, ocrResultStatuses, userId],
);
```

In `OcrBubble`, compute `structuredResult` for completed OCR and render `OcrQuestionList` when `structuredResult.questions.length > 1`.

- [ ] **Step 5: Add batch save behavior**

In chat page, extract the existing confirm-save persistence block into a helper:

```ts
const persistWrongQuestionRecord = useCallback(
  async (record: WrongQuestionRecord) => {
    const savedRecord = await createWrongQuestion.mutateAsync(record);
    await db.wrongQuestions.put({
      ...savedRecord,
      imageUrl: savedRecord.imageUrl ?? record.imageUrl,
      syncStatus: 'synced',
      syncError: undefined,
      pendingOperation: undefined,
    });
    if (record.sourceGroupId) {
      setSavedWrongGroupIds((prev) => new Set(prev).add(record.sourceGroupId ?? ''));
      setSavedWrongQuestionIdsByGroup((prev) => ({
        ...prev,
        [record.sourceGroupId ?? '']: savedRecord.id,
      }));
    }
    return savedRecord;
  },
  [createWrongQuestion],
);
```

Use that helper from the existing single-question confirmation path.

Then implement selected batch save by looping selected question ids and creating one record per question:

```ts
const handleBatchQuestionSave = useCallback(
  async (result: OcrRecord, questionIds: string[]) => {
    if (!userId || questionIds.length === 0) return;

    const structuredResult = result.parsedJson
      ? normalizeOcrParsedPayload(result.parsedJson, result.content)
      : toOcrStructuredResult(result.content);
    const ownerId = getScopedUserId({ id: userId });
    const relatedUser = result.groupId
      ? ocrMessages.find((msg) => msg.type === 'user' && msg.groupId === result.groupId)
      : undefined;

    for (const questionId of questionIds) {
      const question = structuredResult.questions.find((item) => item.id === questionId);
      if (!question || !canSaveStructuredQuestion(question)) continue;

      const now = Date.now();
      const record = mapOcrQuestionToWrongQuestionRecord(question, {
        id: crypto.randomUUID(),
        userId: ownerId,
        sourceRecordId: result.id,
        sourceGroupId: result.groupId,
        imageUrl: result.imageUrl ?? relatedUser?.imageUrl,
        now,
        rawContent: structuredResult.rawText || question.displayMarkdown,
      });

      await persistWrongQuestionRecord(record);
    }

    if (result.groupId) {
      setBatchSelectedOcrQuestionsByGroup((prev) => ({
        ...prev,
        [result.groupId ?? '']: new Set<string>(),
      }));
    }
  },
  [ocrMessages, persistWrongQuestionRecord, userId],
);
```

The explicit user action is the click on “保存所选”. The batch path should skip `not_savable` questions and continue saving the remaining selected questions.

- [ ] **Step 6: Run UI verification commands**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all commands pass.

- [ ] **Step 7: Commit multi-question UI**

```powershell
git add apps/web/src/components/ocr/ocr-question-list.tsx apps/web/src/app/(chat)/chat/page.tsx apps/web/src/lib/ocr-structured-result.test.mts
git commit -m "feat: add multi-question OCR save flow"
```

---

### Task 9: Final Verification and Documentation

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Run full Phase 3 verification**

Run:

```powershell
node --experimental-strip-types packages/types/tests/ocr-question.test.mts
node --experimental-strip-types packages/types/tests/ocr-record.test.mts
bun --cwd packages/types typecheck
node --experimental-strip-types apps/web/src/lib/ocr-prompt.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
node --experimental-strip-types apps/web/src/lib/chat-context.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-parser.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all commands pass.

- [ ] **Step 2: Run backend verification if shared types changed server compilation**

Run:

```powershell
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
```

Expected: all commands pass. Run e2e if any server code changes unexpectedly:

```powershell
bun --filter @repo/server test:e2e
```

- [ ] **Step 3: Update data-flow docs**

In `docs/data-flow.md`, update Phase 3 section to say:

```md
## 8. Phase 3 数据流改进

Phase 3 已将 OCR 识别结果升级为 structured output：

1. `/api/ocr` 输出 display Markdown + structured JSON envelope。
2. 前端完成阶段提取 `OcrStructuredResult`，并保存到 `OcrRecord.parsedJson`。
3. `activeStudyContext` 从结构化题目对象生成。
4. 保存错题优先使用结构化字段，多题按 `sourceGroupId:questionId` 生成独立防重 key。
5. 旧 OCR 历史继续通过 legacy adapter 和 `parseOcrResult()` 兜底。
```

- [ ] **Step 4: Update roadmap and agent docs**

In `docs/roadmap.md`, update Phase 3 status only after implementation is complete:

```md
| Phase 3 | AI 讲题系统 | OCR structured output, Prompt, Tool Action Boundary | 已完成 |
```

In `AGENTS.md` and `CLAUDE.md`, add:

```md
- Phase 3：OCR structured output、结构化 activeStudyContext、多题保存策略和 tool action proposal 已完成。
```

- [ ] **Step 5: Update DEVLOG**

Append a `2026-06-14（Day 9）` Phase 3 implementation subsection if that date already exists:

```md
**Phase 3 AI 讲题系统**

- 新增 `@repo/types/api/ocr-question`，定义 OCR structured output schema。
- `/api/ocr` 改为 display Markdown + structured JSON envelope 输出协议。
- 前端新增 structured OCR parser、legacy adapter、activeStudyContext 映射和 wrong-question 映射。
- OCRRecord `parsedJson` 开始保存结构化题目结果，旧 OCR 历史继续兼容。
- 保存错题优先使用结构化字段，多题使用独立 `sourceGroupId:questionId` 防重。
- 多题 OCR 结果增加题目卡片和用户确认式保存入口。

验证：

- `node --experimental-strip-types packages/types/tests/ocr-question.test.mts` 通过。
- `node --experimental-strip-types apps/web/src/lib/ocr-structured-result.test.mts` 通过。
- `bun --filter @repo/web lint` 通过。
- `bun --filter @repo/web build` 通过。
```

Adjust the verification list to match the commands actually run.

- [ ] **Step 6: Check docs and whitespace**

Run:

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` passes. `git status --short` only shows intended modified docs.

- [ ] **Step 7: Commit docs**

```powershell
git add docs/data-flow.md docs/roadmap.md AGENTS.md CLAUDE.md DEVLOG.md
git commit -m "docs: record phase 3 ai tutoring flow"
```

---

## Self-Review

- Spec coverage: covered shared schema, structured OCR parser, prompt envelope, active study context, single/multi/non-question/unclear states, wrong-question saving, tool action proposal boundary, legacy compatibility, verification, and docs.
- Placeholder scan: no unfinished marker words or open-ended implementation placeholders are intentionally left in the task steps.
- Scope control: this plan does not introduce LangGraph, RAG, FSRS ReviewTask persistence, or backend schema migrations. It uses existing `OcrRecord.parsedJson` and WrongQuestion APIs.
- Type consistency: `OcrStructuredResult`, `OcrQuestionResult`, `ActiveStudyContext`, `OcrParsedPayload`, and `WrongQuestionRecord` names are used consistently across tasks.
