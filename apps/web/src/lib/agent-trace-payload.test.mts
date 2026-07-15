import assert from 'node:assert/strict';

import {
  buildChatAgentTracePayload,
  createInputHash,
  createInputPreview,
} from './agent-trace-payload.ts';
import { assembleChatContextForRoute } from './chat-context-orchestration.ts';
import {
  projectChatModelAgentObservation,
  type SafeChatModelAgentObservation,
} from './chat-model-agent-observation.ts';

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

const routerModelObservation: SafeChatModelAgentObservation = {
  attempted: true,
  disposition: 'candidate_applied',
  durationMs: 31,
  inputTokens: 100,
  outputTokens: 20,
};
const verifierModelObservation: SafeChatModelAgentObservation = {
  attempted: true,
  disposition: 'fallback_timeout',
  durationMs: 45,
  inputTokens: 60,
  outputTokens: 10,
  errorCode: 'TIMEOUT',
  providerFailureCategory: 'transport',
};
const observedPayload = buildChatAgentTracePayload({
  runId: 'trace_run_observed',
  conversationId: 'conv_observed',
  messages: [{ role: 'user', content: 'candidate trace usage' }],
  mode: 'live',
  modelProvider: 'deepseek',
  modelName: 'deepseek-v4-flash',
  budget: {
    estimatedInputTokens: 500,
    maxOutputTokens: 200,
  },
  agentDecision: {
    route: 'rag_answer',
    confidence: 0.9,
    reason: 'fixed deterministic reason',
    requiresRag: true,
    requiresHumanApproval: false,
  },
  knowledgeHits: [],
  knowledgeVerifierResult: {
    status: 'insufficient',
    reason: 'fixed verifier reason',
    promptAddition: '',
    debug: {
      checkedChunkCount: 0,
      lowScoreChunkCount: 0,
      conflictSignals: [],
      suspiciousSignals: [],
    },
  },
  modelAgentObservations: {
    router: routerModelObservation,
    verifier: verifierModelObservation,
  },
  startedAt: new Date('2026-07-15T08:00:00.000Z'),
  finishedAt: new Date('2026-07-15T08:00:01.000Z'),
});

assert.equal(observedPayload.inputTokenEstimate, 660);
assert.equal(observedPayload.outputTokenEstimate, 230);
assert.equal(observedPayload.maxOutputTokens, 200);
assert.equal(observedPayload.pricingKnown, false);
assert.equal(observedPayload.costEstimate, 0);
assert.equal(
  observedPayload.steps.map((step) => step.node).join(','),
  'RouterAgent,RouterModelCandidate,KnowledgeVerifierAgent,KnowledgeVerifierModelCandidate',
);
assert.equal(
  observedPayload.steps.find((step) => step.node === 'RouterModelCandidate')
    ?.outputSummary,
  'attempted=true disposition=candidate_applied durationMs=31 inputTokens=100 outputTokens=20',
);
assert.equal(
  observedPayload.steps.find(
    (step) => step.node === 'KnowledgeVerifierModelCandidate',
  )?.outputSummary,
  'attempted=true disposition=fallback_timeout durationMs=45 inputTokens=60 outputTokens=10 error=TIMEOUT provider=transport',
);

const observationCanary = 'CANARY_reason_error_provider_raw_secret';
const saturatedPayload = buildChatAgentTracePayload({
  runId: 'trace_run_saturated',
  conversationId: null,
  messages: [{ role: 'user', content: 'safe arithmetic' }],
  mode: 'mock',
  modelProvider: 'mock',
  modelName: 'mock-prepmind-chat',
  budget: {
    estimatedInputTokens: Number.MAX_SAFE_INTEGER - 5,
    maxOutputTokens: Number.MAX_SAFE_INTEGER - 3,
  },
  agentDecision: {
    route: 'chat',
    confidence: 1,
    reason: observationCanary,
    requiresRag: false,
    requiresHumanApproval: false,
  },
  modelAgentObservations: {
    router: {
      attempted: true,
      disposition: 'candidate_applied',
      durationMs: 7,
      inputTokens: 10,
      outputTokens: 9,
      raw: { prompt: observationCanary },
    },
    verifier: {
      attempted: true,
      disposition: 'fallback_runtime_error',
      durationMs: Number.NaN,
      inputTokens: -4,
      outputTokens: Number.NaN,
      usageUnavailable: true,
      errorCode: observationCanary,
      providerFailureCategory: observationCanary,
      rawError: observationCanary,
    },
  } as never,
  startedAt: new Date('2026-07-15T08:00:00.000Z'),
  finishedAt: new Date('2026-07-15T08:00:01.000Z'),
});

assert.equal(saturatedPayload.inputTokenEstimate, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedPayload.outputTokenEstimate, Number.MAX_SAFE_INTEGER);
assert.equal(saturatedPayload.maxOutputTokens, Number.MAX_SAFE_INTEGER - 3);
assert.ok(
  saturatedPayload.steps
    .find((step) => step.node === 'KnowledgeVerifierModelCandidate')
    ?.outputSummary.includes('durationMs=0 inputTokens=0 outputTokens=0'),
);
assert.ok(
  saturatedPayload.steps
    .find((step) => step.node === 'KnowledgeVerifierModelCandidate')
    ?.outputSummary.includes(
      'error=UNKNOWN provider=unknown usageUnavailable=true',
    ),
);
assert.equal(JSON.stringify(saturatedPayload).includes(observationCanary), false);

const unavailableUsageCanary = 'CANARY_unavailable_usage_raw_secret';
const projectedUnavailableUsage = projectChatModelAgentObservation({
  attempted: true,
  disposition: 'fallback_runtime_error',
  usageUnavailable: true,
  usage: { inputTokens: 987, outputTokens: 654 },
  trace: {
    durationMs: 23,
    errorCode: 'PROVIDER_ERROR',
    providerFailureCategory: 'provider',
    rawError: unavailableUsageCanary,
  },
  raw: unavailableUsageCanary,
});

assert.equal(projectedUnavailableUsage.usageUnavailable, true);
assert.equal(projectedUnavailableUsage.inputTokens, 0);
assert.equal(projectedUnavailableUsage.outputTokens, 0);

const unavailableUsagePayload = buildChatAgentTracePayload({
  runId: 'trace_run_unavailable_usage',
  conversationId: null,
  messages: [{ role: 'user', content: 'safe projected observation' }],
  mode: 'mock',
  modelProvider: 'mock',
  modelName: 'mock-prepmind-chat',
  budget: {
    estimatedInputTokens: 80,
    maxOutputTokens: 40,
  },
  agentDecision: {
    route: 'chat',
    confidence: 1,
    reason: 'fixed safe reason',
    requiresRag: false,
    requiresHumanApproval: false,
  },
  modelAgentObservations: {
    router: projectedUnavailableUsage,
  },
  startedAt: new Date('2026-07-15T08:00:00.000Z'),
  finishedAt: new Date('2026-07-15T08:00:01.000Z'),
});

assert.equal(unavailableUsagePayload.inputTokenEstimate, 80);
assert.equal(unavailableUsagePayload.outputTokenEstimate, 40);
assert.equal(unavailableUsagePayload.costEstimate, 0);
assert.match(
  unavailableUsagePayload.steps.find(
    (step) => step.node === 'RouterModelCandidate',
  )?.outputSummary ?? '',
  /inputTokens=0 outputTokens=0 .*usageUnavailable=true/,
);
assert.equal(
  JSON.stringify(unavailableUsagePayload).includes(unavailableUsageCanary),
  false,
);

const defensiveUnavailableUsagePayload = buildChatAgentTracePayload({
  runId: 'trace_run_defensive_unavailable_usage',
  conversationId: null,
  messages: [{ role: 'user', content: 'safe observation invariant' }],
  mode: 'mock',
  modelProvider: 'mock',
  modelName: 'mock-prepmind-chat',
  budget: { estimatedInputTokens: 80, maxOutputTokens: 40 },
  agentDecision: {
    route: 'chat',
    confidence: 1,
    reason: 'fixed safe reason',
    requiresRag: false,
    requiresHumanApproval: false,
  },
  modelAgentObservations: {
    router: {
      attempted: true,
      disposition: 'fallback_runtime_error',
      durationMs: 23,
      inputTokens: 987,
      outputTokens: 654,
      usageUnavailable: true,
    },
  },
  startedAt: new Date('2026-07-15T08:00:00.000Z'),
  finishedAt: new Date('2026-07-15T08:00:01.000Z'),
});

assert.equal(defensiveUnavailableUsagePayload.inputTokenEstimate, 80);
assert.equal(defensiveUnavailableUsagePayload.outputTokenEstimate, 40);
