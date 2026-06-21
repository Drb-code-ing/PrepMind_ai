import assert from 'node:assert/strict';
import test from 'node:test';

import type { TutorStrategy } from '@repo/agent/tutor';

import {
  buildChatAgentDecision,
  combineChatAdditionalPrompts,
} from './chat-agent-runtime.ts';
import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

const activeContext: ActiveStudyContext = {
  type: 'ocr-question',
  questionText: 'Find the derivative of f(x)=x^2.',
  subject: 'Advanced Mathematics',
  questionType: 'calculation',
};

test('routes OCR follow-up requests to tutor and builds tutor prompt', () => {
  const messages: ChatContextMessage[] = [
    { role: 'user', content: 'Why can this step be done like this?' },
  ];

  const decision = buildChatAgentDecision({
    messages,
    activeContext,
    runId: 'run_1',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.requiresRag, false);
  assert.equal(decision.tutorStrategy?.intent, 'socratic_hint');
  assert.match(decision.promptAddition, /TutorAgent strategy: socratic_hint/);
  assert.equal(decision.debugHeaders['x-prepmind-agent-route'], 'tutor');
  assert.equal(decision.debugHeaders['x-prepmind-agent-rag-required'], 'false');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-intent'], 'socratic_hint');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-depth'], 'standard');
});

test('uses latest Chinese hint request text for TutorAgent strategy metadata', () => {
  const decision = buildChatAgentDecision({
    messages: [
      {
        role: 'user',
        content:
          '题目：y=x^2 在 x=3 处求导。为什么这一步可以这样理解？请只给一句提示。',
      },
    ],
    activeContext,
    runId: 'run_chinese_hint',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.tutorStrategy?.intent, 'socratic_hint');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-intent'], 'socratic_hint');
  assert.match(decision.promptAddition, /TutorAgent strategy: socratic_hint/);
});

test('keeps general messages on chat route', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'hello' }],
    activeContext: null,
    runId: 'run_2',
    userId: 'user_1',
  });

  assert.equal(decision.route, 'chat');
  assert.equal(decision.promptAddition, '');
});

test('does not call TutorAgent policy for non-tutor routes', () => {
  let called = false;
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'hello' }],
    activeContext: null,
    runId: 'run_non_tutor',
    userId: 'user_1',
    tutorPolicy: () => {
      called = true;
      throw new Error('should not be called');
    },
  });

  assert.equal(decision.route, 'chat');
  assert.equal(called, false);
  assert.equal(decision.tutorStrategy, undefined);
});

test('keeps tutor route and generic tutor prompt when TutorAgent policy throws', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'Why can this step be done like this?' }],
    activeContext,
    runId: 'run_tutor_degraded',
    userId: 'user_1',
    tutorPolicy: () => {
      throw new Error('tutor failed');
    },
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.degraded, true);
  assert.equal(decision.tutorStrategy, undefined);
  assert.match(decision.promptAddition, /TutorAgent generic fallback/);
  assert.equal(decision.debugHeaders['x-prepmind-agent-degraded'], 'true');
});

test('uses injected TutorAgent policy result for tutor route metadata', () => {
  const customStrategy: TutorStrategy = {
    intent: 'answer_direct',
    depth: 'brief',
    shouldAskGuidingQuestion: false,
    shouldGiveFinalAnswer: true,
    shouldUseActiveStudyContext: true,
    answerStructure: ['final_answer', 'reasoning_steps'],
    promptAddition: 'custom tutor prompt',
    debug: {
      reason: 'test',
      matchedSignals: ['answer only'],
    },
  };

  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'Why can this step be done like this?' }],
    activeContext,
    runId: 'run_tutor_custom',
    userId: 'user_1',
    tutorPolicy: () => customStrategy,
  });

  assert.equal(decision.route, 'tutor');
  assert.equal(decision.tutorStrategy, customStrategy);
  assert.equal(decision.promptAddition, 'custom tutor prompt');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-intent'], 'answer_direct');
  assert.equal(decision.debugHeaders['x-prepmind-tutor-depth'], 'brief');
});

test('uses injected router result for rag answer prompt without replacing RAG search', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'answer from my notes' }],
    activeContext: null,
    runId: 'run_3',
    userId: 'user_1',
    router: () => ({
      name: 'rag_answer',
      confidence: 0.9,
      reason: 'test route',
      requiresRag: true,
      requiresHumanApproval: false,
    }),
  });

  assert.equal(decision.route, 'rag_answer');
  assert.equal(decision.requiresRag, true);
  assert.match(decision.promptAddition, /knowledge base/);
});

test('degrades to chat when router throws', () => {
  const decision = buildChatAgentDecision({
    messages: [{ role: 'user', content: 'help me understand this problem' }],
    activeContext: null,
    runId: 'run_4',
    userId: 'user_1',
    router: () => {
      throw new Error('router failed');
    },
  });

  assert.equal(decision.route, 'chat');
  assert.equal(decision.degraded, true);
  assert.equal(decision.debugHeaders['x-prepmind-agent-degraded'], 'true');
});

test('combines agent prompt before knowledge prompt and preserves either prompt alone', () => {
  assert.equal(combineChatAdditionalPrompts('', ''), '');
  assert.equal(combineChatAdditionalPrompts('agent prompt', ''), 'agent prompt');
  assert.equal(combineChatAdditionalPrompts('', 'knowledge prompt'), 'knowledge prompt');
  assert.equal(
    combineChatAdditionalPrompts('agent prompt', 'knowledge prompt'),
    'agent prompt\n\n---\n\nknowledge prompt',
  );
});
