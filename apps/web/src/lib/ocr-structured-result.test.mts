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
  const result = toOcrStructuredResult(
    `## 识别结果
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
公式记忆遗漏`,
    'mimo-v2.5',
  );

  assert.equal(result.recognitionType, 'question');
  assert.equal(result.questions[0]?.questionText, '求导。');
  assert.equal(result.questions[0]?.saveStatus, 'savable');
});

test('maps non-question legacy content to non-question structured result', () => {
  const result = toOcrStructuredResult(
    `## 识别结果
非题目

## 内容说明
这是一张生活照片。`,
    'mimo-v2.5',
  );

  assert.equal(result.recognitionType, 'non_question');
  assert.equal(result.questions.length, 0);
  assert.equal(result.summary, '这是一张生活照片。');
});

test('builds active study context from structured question', () => {
  const context = buildActiveStudyContextFromOcrQuestion(createStructuredResult().questions[0]!, {
    sourceGroupId: 'ocr-1',
    rawContent: 'raw',
    updatedAt: 100,
  });

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

test('returns the first savable structured question as primary question', () => {
  const result = {
    ...createStructuredResult(),
    questions: [
      { ...createQuestion(), id: 'q1', saveStatus: 'not_savable' },
      { ...createQuestion(), id: 'q2', index: 2, saveStatus: 'needs_review' },
    ],
  };

  assert.equal(getPrimaryOcrQuestion(result)?.id, 'q2');
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
