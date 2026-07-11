import assert from 'node:assert/strict';
import test from 'node:test';

import { agentContextPolicySchema } from '@repo/types/api/agent';

import { assembleChatContext } from './context-budget-assembler.ts';

const latestUser = { role: 'user' as const, content: 'latest user question' };

function assemble(
  overrides: Partial<Parameters<typeof assembleChatContext>[0]> = {},
) {
  return assembleChatContext({
    baseSystemPrompt: 'base safety prompt',
    recentMessages: [latestUser],
    maxInputTokens: 300,
    maxOutputTokens: 400,
    ...overrides,
  });
}

test('never drops the latest non-empty user message', () => {
  const result = assemble({
    recentMessages: [
      { role: 'user', content: 'old question '.repeat(200) },
      { role: 'assistant', content: 'old answer '.repeat(200) },
      { role: 'user', content: '   ' },
      latestUser,
    ],
    maxInputTokens: 40,
  });

  assert.deepEqual(result.modelMessages.at(-1), latestUser);
});

test('returns safe 413 metadata when mandatory content alone exceeds max input', () => {
  const secret = 'LATEST_USER_SECRET';
  const result = assemble({
    baseSystemPrompt: 'BASE_SECRET '.repeat(100),
    recentMessages: [{ role: 'user', content: secret.repeat(100) }],
    maxInputTokens: 20,
  });

  assert.equal(result.exceedsInputLimit, true);
  assert.equal(result.modelMessages.length, 1);
  assert.equal(result.contextPolicy.recentMessageCount, 1);
  assert.ok(result.estimatedInputTokens > result.maxInputTokens);
  assert.doesNotMatch(JSON.stringify(result.contextPolicy), /BASE_SECRET|LATEST_USER_SECRET/);
});

test('keeps current OCR question before RAG and summary', () => {
  const result = assemble({
    activeStudyContext: {
      type: 'ocr-question',
      questionText: 'CURRENT_OCR_QUESTION',
      analysis: 'optional analysis '.repeat(100),
    },
    recentMessages: [
      { role: 'user', content: 'old question '.repeat(40) },
      { role: 'assistant', content: 'old answer '.repeat(40) },
      latestUser,
    ],
    safeRagContext: 'RAG_SECRET '.repeat(100),
    summaryBuffer: 'SUMMARY_SECRET '.repeat(100),
    summaryVersion: 2,
    summaryStatus: 'reused',
    maxInputTokens: 90,
  });

  assert.match(result.systemPrompt, /CURRENT_OCR_QUESTION/);
  assert.equal(result.exceedsInputLimit, false);
  assert.ok(result.estimatedInputTokens <= result.maxInputTokens);
  assert.ok(result.contextPolicy.layerTokenCounts?.activeStudy ?? 0);
  assert.doesNotMatch(result.systemPrompt, /RAG_SECRET/);
  const ocrIndex = result.systemPrompt.indexOf('CURRENT_OCR_QUESTION');
  const summaryIndex = result.systemPrompt.indexOf('SUMMARY_SECRET');
  assert.ok(summaryIndex < 0 || ocrIndex < summaryIndex);
});

test('never lets optional OCR context turn a valid mandatory request into 413', () => {
  const result = assemble({
    baseSystemPrompt: 'b',
    activeStudyContext: { type: 'ocr-question', questionText: 'x'.repeat(100) },
    recentMessages: [{ role: 'user', content: 'u'.repeat(61) }],
    maxInputTokens: 30,
  });

  assert.equal(result.contextPolicy.layerTokenCounts?.mandatory, 25);
  assert.equal(result.exceedsInputLimit, false);
  assert.ok(result.estimatedInputTokens <= 30);
});

test('refits OCR to the actual global remaining budget instead of dropping it', () => {
  const result = assemble({
    baseSystemPrompt: 'b',
    activeStudyContext: { type: 'ocr-question', questionText: 'x'.repeat(100) },
    recentMessages: [{ role: 'user', content: 'u'.repeat(77) }],
    maxInputTokens: 35,
  });

  assert.equal(result.contextPolicy.layerTokenCounts?.mandatory, 29);
  assert.ok((result.contextPolicy.layerTokenCounts?.activeStudy ?? 0) > 0);
  assert.match(result.systemPrompt, /Current OCR question:\n+x/);
  assert.ok(result.estimatedInputTokens <= 35);
  assert.equal(result.exceedsInputLimit, false);
});

test('caps included guidance at 10 percent of the input budget', () => {
  const result = assemble({
    agentGuidance: 'guidance '.repeat(100),
    stateGuidance: 'state '.repeat(100),
    maxInputTokens: 300,
  });

  const tokens = result.contextPolicy.layerTokenCounts?.agentGuidance ?? 0;
  assert.ok(tokens > 0);
  assert.ok(tokens <= Math.floor(result.maxInputTokens * 0.1));
});

test('budgets agent and state guidance independently without hiding state drops', () => {
  const stateGoal = 'STATE_GOAL';
  const result = assemble({
    agentGuidance: 'agent '.repeat(1000),
    stateGuidance: stateGoal,
    maxInputTokens: 1000,
  });

  const agentTokens = result.contextPolicy.layerTokenCounts?.agentGuidance ?? 0;
  const stateTokens = result.contextPolicy.layerTokenCounts?.stateGuidance ?? 0;
  assert.ok(agentTokens > 0);
  assert.ok(stateTokens > 0 || result.contextPolicy.droppedLayers?.includes('stateGuidance'));
  assert.ok(agentTokens + stateTokens <= Math.floor(result.maxInputTokens * 0.1));
  if (stateTokens > 0) assert.match(result.systemPrompt, new RegExp(stateGoal));
  assert.doesNotMatch(JSON.stringify(result.contextPolicy), new RegExp(stateGoal));
});

test('caps included OCR context at 20 percent of the input budget', () => {
  const result = assemble({
    activeStudyContext: {
      type: 'ocr-question',
      questionText: 'question '.repeat(100),
      analysis: 'analysis '.repeat(100),
    },
    maxInputTokens: 300,
  });

  const tokens = result.contextPolicy.layerTokenCounts?.activeStudy ?? 0;
  assert.ok(tokens > 0);
  assert.ok(tokens <= Math.floor(result.maxInputTokens * 0.2));
});

test('caps included safe RAG at 25 percent of the input budget', () => {
  const result = assemble({
    safeRagContext: 'safe rag detail '.repeat(12),
    maxInputTokens: 300,
  });

  const tokens = result.contextPolicy.layerTokenCounts?.rag ?? 0;
  assert.ok(tokens > 0);
  assert.ok(tokens <= Math.floor(result.maxInputTokens * 0.25));
});

test('fails closed only for invalid output budget when input budget is valid', () => {
  const result = assemble({ maxInputTokens: 300, maxOutputTokens: Number.NaN });

  assert.equal(result.maxOutputTokens, 0);
  assert.equal(result.exceedsInputLimit, false);
  assert.ok(result.estimatedInputTokens <= result.maxInputTokens);
  assert.deepEqual(result.modelMessages, [latestUser]);
});

test('keeps only recent complete turns in chronological order', () => {
  const recentTurn = [
    { role: 'user' as const, content: 'recent complete question' },
    { role: 'assistant' as const, content: 'recent complete answer' },
  ];
  const result = assemble({
    recentMessages: [
      { role: 'assistant', content: 'orphan assistant' },
      { role: 'user', content: 'very old question '.repeat(100) },
      { role: 'assistant', content: 'very old answer '.repeat(100) },
      ...recentTurn,
      latestUser,
    ],
    maxInputTokens: 80,
  });

  assert.deepEqual(result.modelMessages, [...recentTurn, latestUser]);
  assert.equal(result.modelMessages.some((message) => message.content === 'orphan assistant'), false);
});

test('caps summary at 15 percent and 400 tokens', () => {
  const result = assemble({
    recentMessages: [
      { role: 'user', content: 'old question '.repeat(700) },
      { role: 'assistant', content: 'old answer '.repeat(700) },
      latestUser,
    ],
    summaryBuffer: 'summary detail '.repeat(1000),
    summaryVersion: 3,
    summaryStatus: 'generated',
    maxInputTokens: 3000,
  });

  assert.equal(result.contextPolicy.summaryIncluded, true);
  assert.ok((result.contextPolicy.layerTokenCounts?.summary ?? 0) <= 400);
  assert.ok(
    (result.contextPolicy.layerTokenCounts?.summary ?? 0) <=
      Math.floor(result.maxInputTokens * 0.15),
  );
});

test('drops safe RAG as a whole when it cannot fit its lane', () => {
  const result = assemble({
    safeRagContext: 'WHOLE_RAG_CONTEXT '.repeat(500),
    maxInputTokens: 200,
  });

  assert.doesNotMatch(result.systemPrompt, /WHOLE_RAG_CONTEXT/);
  assert.equal(result.contextPolicy.layerTokenCounts?.rag, 0);
  assert.ok(result.contextPolicy.droppedLayers?.includes('rag'));
});

test('reclaims unused optional lanes for recent turns before RAG', () => {
  const turns = Array.from({ length: 5 }, (_, index) => [
    { role: 'user' as const, content: `question-${index} ${'q'.repeat(40)}` },
    { role: 'assistant' as const, content: `answer-${index} ${'a'.repeat(40)}` },
  ]).flat();
  const result = assemble({
    recentMessages: [...turns, latestUser],
    safeRagContext: 'RAG_AFTER_RECENT '.repeat(20),
    maxInputTokens: 180,
  });

  assert.ok(
    (result.contextPolicy.layerTokenCounts?.recentMessages ?? 0) >
      Math.floor(result.maxInputTokens * 0.4),
  );
  assert.doesNotMatch(result.systemPrompt, /RAG_AFTER_RECENT/);
});

test('does not include summary when no history was dropped', () => {
  const result = assemble({
    recentMessages: [
      { role: 'user', content: 'previous question' },
      { role: 'assistant', content: 'previous answer' },
      latestUser,
    ],
    summaryBuffer: 'SUMMARY_MUST_NOT_APPEAR',
    summaryVersion: 1,
    summaryStatus: 'reused',
    maxInputTokens: 1000,
  });

  assert.equal(result.contextPolicy.droppedMessageCount, 0);
  assert.equal(result.contextPolicy.summaryIncluded, false);
  assert.doesNotMatch(result.systemPrompt, /SUMMARY_MUST_NOT_APPEAR/);
});

test('returns bounded metadata without any layer content', () => {
  const secrets = [
    'AGENT_GUIDANCE_SECRET',
    'STATE_GUIDANCE_SECRET',
    'OCR_SECRET',
    'RAG_SECRET',
    'SUMMARY_SECRET',
  ];
  const result = assemble({
    agentGuidance: secrets[0],
    stateGuidance: secrets[1],
    activeStudyContext: { type: 'ocr-question', questionText: secrets[2] },
    recentMessages: [
      { role: 'user', content: 'old '.repeat(300) },
      { role: 'assistant', content: 'answer '.repeat(300) },
      latestUser,
    ],
    safeRagContext: secrets[3],
    summaryBuffer: secrets[4],
    summaryVersion: 4,
    summaryStatus: 'reused',
    maxInputTokens: 200,
  });

  const policy = agentContextPolicySchema.parse(result.contextPolicy);
  const serialized = JSON.stringify(policy);
  for (const secret of secrets) assert.doesNotMatch(serialized, new RegExp(secret));
  assert.ok((policy.droppedLayers?.length ?? 0) <= 4);
});

test('hard-bounds optional sources before fitting without limiting the latest user', () => {
  const optionalTail = 'OPTIONAL_TAIL_SENTINEL';
  const mandatoryTail = 'MANDATORY_TAIL_SENTINEL';
  const result = assemble({
    agentGuidance: `${'g'.repeat(2100)}${optionalTail}`,
    stateGuidance: `${'s'.repeat(2100)}${optionalTail}`,
    activeStudyContext: {
      type: 'ocr-question',
      questionText: `${'q'.repeat(2500)}${optionalTail}`,
      analysis: `${'a'.repeat(1100)}${optionalTail}`,
      answer: `${'n'.repeat(700)}${optionalTail}`,
      knowledgePoints: [`${'k'.repeat(5000)}${optionalTail}`],
    },
    safeRagContext: `${'r'.repeat(16100)}${optionalTail}`,
    summaryBuffer: `${'m'.repeat(4100)}${optionalTail}`,
    summaryVersion: 5,
    summaryStatus: 'generated',
    recentMessages: [
      { role: 'assistant', content: 'orphan history forces summary eligibility' },
      { role: 'user', content: `${'u'.repeat(20000)}${mandatoryTail}` },
    ],
    maxInputTokens: 100000,
  });

  assert.doesNotMatch(result.systemPrompt, new RegExp(optionalTail));
  assert.doesNotMatch(JSON.stringify(result.contextPolicy), new RegExp(optionalTail));
  assert.match(result.modelMessages.at(-1)?.content ?? '', new RegExp(mandatoryTail));
  assert.ok(result.estimatedInputTokens <= result.maxInputTokens);
  assert.equal(result.exceedsInputLimit, false);
});

test('fails closed for NaN and unsafe integer budgets', () => {
  for (const maxInputTokens of [Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    const result = assemble({ maxInputTokens, maxOutputTokens: Number.NaN });
    assert.equal(result.maxInputTokens, 0);
    assert.equal(result.maxOutputTokens, 0);
    assert.equal(result.exceedsInputLimit, true);
    assert.ok(Number.isSafeInteger(result.estimatedInputTokens));
    assert.ok(result.contextPolicy.droppedMessageCount >= 0);
  }
});

test('fails closed for zero input budget without negative counts', () => {
  const result = assemble({ maxInputTokens: 0, maxOutputTokens: 0 });

  assert.equal(result.exceedsInputLimit, true);
  assert.deepEqual(result.modelMessages, [latestUser]);
  assert.ok(result.contextPolicy.droppedMessageCount >= 0);
  assert.ok(
    Object.values(result.contextPolicy.layerTokenCounts ?? {}).every(
      (count) => Number.isSafeInteger(count) && count >= 0,
    ),
  );
});

test('uses safe integer lane caps for small budgets and rounding edges', () => {
  const result = assemble({
    agentGuidance: 'guidance',
    activeStudyContext: { type: 'ocr-question', questionText: 'question' },
    safeRagContext: 'rag',
    summaryBuffer: 'summary',
    recentMessages: [
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      latestUser,
    ],
    maxInputTokens: 7,
  });

  assert.equal(result.exceedsInputLimit, true);
  assert.ok(
    Object.values(result.contextPolicy.layerTokenCounts ?? {}).every(
      (count) => Number.isSafeInteger(count) && count >= 0,
    ),
  );
});
