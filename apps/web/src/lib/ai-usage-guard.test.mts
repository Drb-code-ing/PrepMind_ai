import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatRequestBudget,
  createMockChatText,
  parseAiTokenLimit,
} from './ai-usage-guard.ts';
import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

test('parses positive token limits and falls back for unsafe values', () => {
  assert.equal(parseAiTokenLimit('1800', 2500, { min: 200, max: 12000 }), 1800);
  assert.equal(parseAiTokenLimit('100000', 2500, { min: 200, max: 12000 }), 2500);
  assert.equal(parseAiTokenLimit('0', 2500, { min: 200, max: 12000 }), 2500);
  assert.equal(parseAiTokenLimit('abc', 2500, { min: 200, max: 12000 }), 2500);
});

test('shows tutor route in mock output without breaking markdown and math checks', () => {
  const text = createMockChatText({
    hasActiveContext: true,
    latestUserText: 'Why can this step be done like this?',
    agentRoute: 'tutor',
  });

  assert.match(text, /TutorAgent/);
  assert.match(text, /Why can this step/);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});

test('shows tutor strategy metadata in mock output when provided', () => {
  const text = createMockChatText({
    hasActiveContext: true,
    latestUserText: 'Why can this step be done like this?',
    agentRoute: 'tutor',
    tutorIntent: 'socratic_hint',
  });

  assert.match(text, /TutorAgent/);
  assert.match(text, /socratic_hint/);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});

test('does not show tutor strategy metadata for normal chat mock output', () => {
  const text = createMockChatText({
    hasActiveContext: false,
    latestUserText: 'hello',
    agentRoute: 'chat',
  });

  assert.doesNotMatch(text, /socratic_hint/);
  assert.match(text, /normal Chat path/);
  assert.doesNotMatch(text, /Agent route: normal Chat path\.\n{3,}1\./);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});

test('shows knowledge verifier status in mock output when provided', () => {
  const text = createMockChatText({
    hasActiveContext: false,
    latestUserText: '根据我的笔记回答',
    agentRoute: 'rag_answer',
    verifierStatus: 'suspicious',
  });

  assert.match(text, /KnowledgeVerifierAgent/);
  assert.match(text, /suspicious/);
});

test('budgets the system prompt, active OCR context, and recent messages together', () => {
  const activeContext: ActiveStudyContext = {
    type: 'ocr-question',
    questionText: '题目内容'.repeat(500),
    analysis: '分析内容'.repeat(500),
    answer: '答案内容'.repeat(300),
    knowledgePoints: ['导数', '极值'],
  };
  const messages: ChatContextMessage[] = [
    { role: 'user', content: '旧问题'.repeat(200) },
    { role: 'assistant', content: '旧回答'.repeat(200) },
    { role: 'user', content: '为什么这一步可以这样做？' },
  ];

  const budget = buildChatRequestBudget({
    baseSystemPrompt: '基础系统提示',
    activeContext,
    messages,
    maxInputTokens: 700,
    maxOutputTokens: 600,
    activeContextLimits: {
      questionChars: 160,
      analysisChars: 120,
      answerChars: 80,
    },
  });

  assert.equal(budget.modelMessages.length, 1);
  assert.equal(budget.modelMessages[0].content, '为什么这一步可以这样做？');
  assert.equal(budget.exceedsInputLimit, false);
  assert.ok(budget.estimatedInputTokens <= 700);
  assert.equal(budget.maxOutputTokens, 600);
  assert.match(budget.systemPrompt, /题目内容/);
  assert.match(budget.systemPrompt, /\.{3}/);
  assert.deepEqual(budget.contextPolicy, {
    recentMessageCount: 1,
    summaryIncluded: false,
    droppedMessageCount: 2,
    estimatedTokenCount: budget.estimatedInputTokens,
  });
});

test('marks a request as too large when the latest user message alone exceeds the input budget', () => {
  const budget = buildChatRequestBudget({
    baseSystemPrompt: '基础系统提示',
    activeContext: null,
    messages: [{ role: 'user', content: '超长输入'.repeat(1000) }],
    maxInputTokens: 500,
    maxOutputTokens: 600,
  });

  assert.equal(budget.modelMessages.length, 1);
  assert.equal(budget.exceedsInputLimit, true);
  assert.ok(budget.estimatedInputTokens > 500);
});

test('includes additional system prompt in the token budget', () => {
  const budget = buildChatRequestBudget({
    baseSystemPrompt: 'base prompt',
    activeContext: null,
    additionalSystemPrompt: 'knowledge context',
    messages: [{ role: 'user', content: 'question' }],
    maxInputTokens: 500,
    maxOutputTokens: 600,
  });

  assert.match(budget.systemPrompt, /base prompt/);
  assert.match(budget.systemPrompt, /knowledge context/);
  assert.ok(budget.estimatedInputTokens > 0);
});

test('includes precomputed summary buffer and exposes context policy metadata', () => {
  const budget = buildChatRequestBudget({
    baseSystemPrompt: 'base prompt',
    activeContext: null,
    summaryBuffer: 'Earlier summary: user missed the chain rule twice.',
    messages: [
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'latest question' },
    ],
    maxInputTokens: 35,
    maxOutputTokens: 600,
  });

  assert.match(budget.systemPrompt, /Earlier summary/);
  assert.equal(budget.contextPolicy.summaryIncluded, true);
  assert.equal(budget.contextPolicy.recentMessageCount, 1);
  assert.equal(budget.contextPolicy.droppedMessageCount, 2);
  assert.equal(budget.contextPolicy.estimatedTokenCount, budget.estimatedInputTokens);
});

test('creates a visible mock answer that preserves streaming markdown and math render checks', () => {
  const text = createMockChatText({
    hasActiveContext: true,
    latestUserText: '为什么这样做？',
  });

  assert.match(text, /本地 mock 模型/);
  assert.match(text, /为什么这样做/);
  assert.match(text, /\$\$f'\(x\)=2x\$\$/);
});
