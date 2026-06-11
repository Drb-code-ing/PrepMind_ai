import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canSaveOcrResult,
  formatOcrContentForDisplay,
  getMissingWrongQuestionFields,
  parseOcrResult,
  WRONG_QUESTION_REQUIRED_FIELDS,
} from './wrong-question-parser.ts';

test('parses strict OCR markdown schema into wrong question fields', () => {
  const parsed = parseOcrResult(`## 题目
求函数 f(x)=x^2 在 x=1 处的导数。

## 学科
数学

## 知识点
- 导数定义
- 幂函数求导

## 分析思路
使用幂函数求导公式。

## 参考答案
f'(1)=2。

## 错因建议
公式记忆不牢`);

  assert.equal(parsed.questionText, '求函数 f(x)=x^2 在 x=1 处的导数。');
  assert.equal(parsed.subject, '数学');
  assert.deepEqual(parsed.knowledgePoints, ['导数定义', '幂函数求导']);
  assert.equal(parsed.category, '导数定义');
  assert.equal(parsed.answer, "f'(1)=2。");
  assert.deepEqual(getMissingWrongQuestionFields(parsed), []);
});

test('reports missing required fields before saving a weak OCR result', () => {
  const parsed = parseOcrResult(`## 题目
图片较模糊，只能看到部分题干。`);

  assert.deepEqual(getMissingWrongQuestionFields(parsed), [
    'knowledgePoints',
    'analysis',
    'answer',
  ]);
  assert.deepEqual(WRONG_QUESTION_REQUIRED_FIELDS, [
    'questionText',
    'knowledgePoints',
    'analysis',
    'answer',
  ]);
});

test('detects non-question OCR output and blocks wrong-question saving', () => {
  const parsed = parseOcrResult(`## 识别结果
非题目

## 题目
无题目内容。该图片是一张人像照片，未包含任何可识别的题目文字或学科图形符号。

## 学科
未识别

## 知识点
- 未识别

## 分析思路
图片主体为人物照片，不是考试题目。

## 参考答案
未识别

## 错因建议
其他`);

  assert.equal(parsed.isQuestion, false);
  assert.equal(canSaveOcrResult(parsed, 'done'), false);
});

test('formats non-question OCR output as a natural assistant response', () => {
  const content = `## 识别结果
非题目

## 内容说明
这是一张年轻女性的肖像照片，没有发现题干、选项、公式或学科图形符号。`;

  const parsed = parseOcrResult(content);
  const display = formatOcrContentForDisplay(content);

  assert.equal(parsed.isQuestion, false);
  assert.equal(
    parsed.nonQuestionSummary,
    '这是一张年轻女性的肖像照片，没有发现题干、选项、公式或学科图形符号。',
  );
  assert.equal(
    display,
    '我没有在图片里识别到考试题或练习题。\n\n这是一张年轻女性的肖像照片，没有发现题干、选项、公式或学科图形符号。',
  );
  assert.equal(display.includes('## 学科'), false);
  assert.equal(display.includes('## 知识点'), false);
  assert.equal(display.includes('错因建议'), false);
});

test('blocks saving while OCR result is still streaming', () => {
  const parsed = parseOcrResult(`## 题目
求函数 f(x)=x^2 的导数。

## 学科
数学

## 知识点
- 导数

## 分析思路
使用导数公式。

## 参考答案
2x

## 错因建议
公式记忆遗漏`);

  assert.equal(parsed.isQuestion, true);
  assert.equal(canSaveOcrResult(parsed, 'streaming'), false);
  assert.equal(canSaveOcrResult(parsed, 'done'), true);
});
