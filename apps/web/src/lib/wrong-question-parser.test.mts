import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
