import assert from 'node:assert/strict';
import test from 'node:test';

import { OCR_SYSTEM_PROMPT } from './ocr-prompt.ts';

test('OCR prompt requires display markdown and structured JSON envelope', () => {
  assert.match(OCR_SYSTEM_PROMPT, /<PREPMIND_DISPLAY_MARKDOWN>/);
  assert.match(OCR_SYSTEM_PROMPT, /<\/PREPMIND_DISPLAY_MARKDOWN>/);
  assert.match(OCR_SYSTEM_PROMPT, /<PREPMIND_STRUCTURED_JSON>/);
  assert.match(OCR_SYSTEM_PROMPT, /<\/PREPMIND_STRUCTURED_JSON>/);
});

test('OCR prompt documents structured question fields and save status rules', () => {
  assert.match(OCR_SYSTEM_PROMPT, /recognitionType/);
  assert.match(OCR_SYSTEM_PROMPT, /multi_question/);
  assert.match(OCR_SYSTEM_PROMPT, /questionType/);
  assert.match(OCR_SYSTEM_PROMPT, /difficulty/);
  assert.match(OCR_SYSTEM_PROMPT, /saveStatus/);
  assert.match(OCR_SYSTEM_PROMPT, /savable/);
  assert.match(OCR_SYSTEM_PROMPT, /needs_review/);
  assert.match(OCR_SYSTEM_PROMPT, /not_savable/);
});

test('OCR prompt prevents non-question images from using tutoring fields', () => {
  assert.match(OCR_SYSTEM_PROMPT, /非题目/);
  assert.match(OCR_SYSTEM_PROMPT, /questions 必须是空数组/);
  assert.match(OCR_SYSTEM_PROMPT, /不要输出学科、知识点、解析、答案或错因/);
});
