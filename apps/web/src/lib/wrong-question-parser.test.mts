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

test('parses relaxed OCR headings shown as bold labels', () => {
  const parsed = parseOcrResult(`**题目**
利用格林公式，计算下列曲线积分：
(1) 第一题。
(2) 第二题。
(3) 第三题。

**学科**
数学

**知识点**
格林公式的应用
平面曲线积分的计算
保守场的判定与势函数

**分析思路**
分别判断每个积分是否满足格林公式条件，再计算区域面积或补线积分。

**参考答案**
(1) 12
(2) 0
(3) π²/4

**错因建议**
计算错误 / 概念不清`);

  assert.equal(parsed.isQuestion, true);
  assert.equal(parsed.subject, '数学');
  assert.deepEqual(parsed.knowledgePoints, [
    '格林公式的应用',
    '平面曲线积分的计算',
    '保守场的判定与势函数',
  ]);
  assert.equal(parsed.analysis.includes('格林公式条件'), true);
  assert.equal(parsed.answer.includes('π²/4'), true);
  assert.deepEqual(getMissingWrongQuestionFields(parsed), []);
  assert.equal(canSaveOcrResult(parsed, 'done'), true);
});

test('formats dense OCR answer steps into readable sections', () => {
  const display = formatOcrContentForDisplay(`## 识别结果
题目

## 题目
利用格林公式计算曲线积分。

## 学科
数学

## 知识点
- 格林公式

## 分析思路
补线后使用格林公式。

## 参考答案
(3) 答案：π²/8 + 1 计算过程：补充路径：从(π/2,1)到(0,0)的直线段L₁，参数化或直接计算。先求闭曲线积分：设完整闭曲线C = L + L₁（逆时针），应用格林公式。P = 2xy³ - y²cosx，Q = 1 - 2ysinx + 3x²y²。∂Q/∂x = -2y cosx + 6xy²，∂P/∂y = 6xy² - 2y cosx。所以∂Q/∂x - ∂P/∂y = 0，因此∮ C = 0。

## 错因建议
方法不会`);

  assert.match(display, /### \(3\)/);
  assert.match(display, /\*\*答案：\*\* \$\\pi\^2\/8 \+ 1\$/);
  assert.match(display, /\*\*计算过程：\*\*\n\n/);
  assert.match(display, /\n\nP = 2xy³ - y²cosx/);
  assert.match(display, /\n\nQ = 1 - 2ysinx \+ 3x²y²/);
  assert.match(display, /\n\n∂Q\/∂x = -2y cosx \+ 6xy²/);
  assert.match(display, /\n\n所以∂Q\/∂x - ∂P\/∂y = 0/);
});
