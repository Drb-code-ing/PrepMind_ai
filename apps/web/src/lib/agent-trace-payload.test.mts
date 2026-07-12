import assert from 'node:assert/strict';

import {
  buildChatAgentTracePayload,
  createInputHash,
  createInputPreview,
} from './agent-trace-payload.ts';
import { assembleChatContextForRoute } from './chat-context-orchestration.ts';

assert.equal(createInputPreview(` ${'题'.repeat(120)} `).length, 80);
assert.equal(createInputHash('同一个问题'), createInputHash('同一个问题'));
assert.notEqual(createInputHash('问题 A'), createInputHash('问题 B'));

const traceSummarySecret = 'summary secret body must never enter trace';
const assembledTraceBudget = assembleChatContextForRoute({
  baseSystemPrompt: 'base',
  agentGuidance: undefined,
  activeStudyContext: null,
  recentMessages: [
    { role: 'user', content: 'old question '.repeat(500) },
    { role: 'assistant', content: 'old answer '.repeat(500) },
    { role: 'user', content: 'latest trace question' },
  ],
  safeRagContext: undefined,
  preparedContext: {
    conversationId: 'conv_actual_1',
    summaryBuffer: traceSummarySecret,
    coveredThroughOrder: 2,
    summaryVersion: 3,
    summaryStatus: 'reused',
    state: null,
    safeErrorCode: null,
  },
  maxInputTokens: 300,
  maxOutputTokens: 1200,
});
assert.equal(assembledTraceBudget.contextPolicy.summaryIncluded, true);

const payload = buildChatAgentTracePayload({
  runId: 'trace_run_1',
  conversationId: 'conv_actual_1',
  messages: [
    { role: 'user', content: `根据我的资料回答 ${'题'.repeat(120)}` },
  ],
  mode: 'live',
  modelProvider: 'deepseek',
  modelName: 'deepseek-v4-flash',
  budget: assembledTraceBudget,
  agentDecision: {
    route: 'tutor',
    confidence: 0.78,
    reason: '用户请求讲题。',
    requiresRag: false,
    requiresHumanApproval: false,
    degraded: false,
    tutorStrategy: {
      intent: 'socratic_hint',
      depth: 'standard',
    },
  },
  knowledgeHits: [
    {
      documentId: 'doc_1',
      title: '讲义',
      chunkId: 'chunk_1',
      content: 'chunk content',
      score: 0.8,
    },
  ],
  knowledgeVerifierResult: {
    status: 'trusted',
    reason: 'usable',
    promptAddition: '',
    debug: {
      checkedChunkCount: 1,
      lowScoreChunkCount: 0,
      conflictSignals: [],
      suspiciousSignals: [],
    },
  },
  startedAt: new Date('2026-06-28T08:00:00.000Z'),
  finishedAt: new Date('2026-06-28T08:00:02.000Z'),
});

assert.equal(payload.runId, 'trace_run_1');
assert.equal(payload.conversationId, 'conv_actual_1');
assert.equal(payload.status, 'completed');
assert.equal(payload.route, 'tutor');
assert.equal(payload.mode, 'live');
assert.equal(payload.pricingKnown, false);
assert.equal(payload.inputPreview?.length, 80);
assert.equal(payload.ragHitCount, 1);
assert.equal(payload.verifierStatus, 'trusted');
assert.equal(payload.verifierChunkCount, 1);
assert.equal(payload.tutorIntent, 'socratic_hint');
assert.equal(payload.steps.map((step) => step.node).join(','), 'RouterAgent,TutorAgent,KnowledgeVerifierAgent');
assert.ok(payload.steps.every((step) => step.inputSummary.length <= 160));
assert.match(payload.steps[0]?.inputSummary ?? '', /recentMessages=1/);
assert.match(payload.steps[0]?.inputSummary ?? '', /summary=true/);
assert.match(payload.steps[0]?.inputSummary ?? '', /droppedMessages=2/);
assert.match(
  payload.steps[0]?.inputSummary ?? '',
  /layerTokens=m:\d+,a:\d+,s:\d+,o:\d+,r:\d+,k:\d+,y:\d+/,
);
assert.ok(
  (payload.steps[0]?.inputSummary.indexOf('layerTokens=') ?? -1) <
    (payload.steps[0]?.inputSummary.indexOf('latestUserPreview=') ?? -1),
);
assert.doesNotMatch(JSON.stringify(payload), new RegExp(traceSummarySecret));

const sensitivePayload = buildChatAgentTracePayload({
  runId: 'trace_run_sensitive',
  conversationId: null,
  messages: [
    {
      role: 'user',
      content: 'Authorization: Bearer secret_token DEEPSEEK_API_KEY=secret_key 请讲题',
    },
  ],
  mode: 'mock',
  modelProvider: 'mock',
  modelName: 'mock-prepmind-chat',
  budget: {
    estimatedInputTokens: 100,
    maxOutputTokens: 200,
    contextPolicy: {
      recentMessageCount: 1,
      summaryIncluded: false,
      droppedMessageCount: 0,
      estimatedTokenCount: 100,
    },
  },
  agentDecision: {
    route: 'chat',
    confidence: 0.7,
    reason: 'normal chat',
    requiresRag: false,
    requiresHumanApproval: false,
    degraded: false,
  },
  knowledgeHits: [],
  startedAt: new Date('2026-06-28T08:00:00.000Z'),
  finishedAt: new Date('2026-06-28T08:00:01.000Z'),
});

assert.ok(!sensitivePayload.inputPreview?.includes('secret_token'));
assert.ok(!sensitivePayload.inputPreview?.includes('secret_key'));
assert.ok(sensitivePayload.inputPreview?.includes('[redacted]'));
assert.ok(sensitivePayload.steps.every((step) => !step.inputSummary.includes('secret_token')));
assert.ok(sensitivePayload.steps.every((step) => !step.inputSummary.includes('secret_key')));
