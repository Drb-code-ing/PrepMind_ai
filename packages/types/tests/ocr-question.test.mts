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
    questions: [createQuestion('q1', 1), createQuestion('q2', 2)],
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
