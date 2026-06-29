import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatContextMessages,
  buildChatSystemPrompt,
  estimateTextTokens,
  type ActiveStudyContext,
  type ChatContextMessage,
} from './chat-context.ts';

test('estimates Chinese text more conservatively than plain ASCII text', () => {
  assert.equal(estimateTextTokens('这是一道导数题'), 7);
  assert.equal(estimateTextTokens('hello world'), 3);
});

test('keeps the latest user message while trimming older chat history by token budget', () => {
  const messages: ChatContextMessage[] = [
    { role: 'user', content: '旧问题'.repeat(20) },
    { role: 'assistant', content: '旧回答'.repeat(20) },
    { role: 'user', content: '中间问题'.repeat(10) },
    { role: 'assistant', content: '中间回答'.repeat(10) },
    { role: 'user', content: '刚才那一步为什么可以这样变形？' },
  ];

  const contextMessages = buildChatContextMessages(messages, { maxInputTokens: 30 });

  assert.deepEqual(contextMessages, [
    { role: 'user', content: '刚才那一步为什么可以这样变形？' },
  ]);
});

test('keeps recent conversation turns in chronological order within budget', () => {
  const messages: ChatContextMessage[] = [
    { role: 'user', content: '很早以前的问题'.repeat(20) },
    { role: 'assistant', content: '很早以前的回答'.repeat(20) },
    { role: 'user', content: '请解释第二步' },
    { role: 'assistant', content: '第二步使用了配方法。' },
    { role: 'user', content: '为什么可以配方？' },
  ];

  const contextMessages = buildChatContextMessages(messages, { maxInputTokens: 45 });

  assert.deepEqual(contextMessages, [
    { role: 'user', content: '请解释第二步' },
    { role: 'assistant', content: '第二步使用了配方法。' },
    { role: 'user', content: '为什么可以配方？' },
  ]);
});

test('injects active OCR question into the system prompt without relying on chat history', () => {
  const activeContext: ActiveStudyContext = {
    type: 'ocr-question',
    sourceGroupId: 'ocr-1',
    questionId: 'q1',
    questionText: '求函数 f(x)=x^2 的导数。',
    subject: '数学',
    questionType: 'calculation',
    difficulty: 'easy',
    knowledgePoints: ['导数'],
    analysis: '使用幂函数求导公式。',
    answer: '2x',
    warnings: ['答案区域模糊'],
    updatedAt: 100,
  };

  const prompt = buildChatSystemPrompt('基础系统提示', activeContext);

  assert.match(prompt, /基础系统提示/);
  assert.match(prompt, /当前正在讨论的题目/);
  assert.match(prompt, /题目ID：q1/);
  assert.match(prompt, /求函数 f\(x\)=x\^2 的导数。/);
  assert.match(prompt, /题型：calculation/);
  assert.match(prompt, /难度：easy/);
  assert.match(prompt, /知识点：导数/);
  assert.match(prompt, /参考答案：2x/);
  assert.match(prompt, /识别提醒：答案区域模糊/);
});

test('omits active context section when there is no OCR question context', () => {
  const prompt = buildChatSystemPrompt('基础系统提示', null);

  assert.equal(prompt, '基础系统提示');
});

test('adds only a caller-provided summary buffer to the system prompt', () => {
  const prompt = buildChatSystemPrompt('base prompt', null, {
    summaryBuffer: 'Earlier summary: the learner is reviewing derivatives.',
  });

  assert.match(prompt, /base prompt/);
  assert.match(prompt, /Earlier summary/);
});
