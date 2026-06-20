import assert from 'node:assert/strict';
import test from 'node:test';

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
  assert.match(decision.promptAddition, /Socratic/);
  assert.equal(decision.debugHeaders['x-prepmind-agent-route'], 'tutor');
  assert.equal(decision.debugHeaders['x-prepmind-agent-rag-required'], 'false');
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
