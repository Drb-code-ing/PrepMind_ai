import assert from 'node:assert/strict';

import {
  agentTraceCreateRequestSchema,
  agentTraceDetailResponseSchema,
  agentTraceListQuerySchema,
  agentTraceModeSchema,
  agentTraceRunSchema,
  agentTraceSummaryQuerySchema,
  agentTraceSummaryResponseSchema,
  agentTraceStepSchema,
} from '../src/api/agent-trace.ts';

testEnums();
testQueryDefaults();
testRunAndStepPayloads();
testCreateRequestSanity();
testSummaryPayload();

function testEnums() {
  assert.equal(agentTraceModeSchema.parse('mock'), 'mock');
  assert.equal(agentTraceModeSchema.parse('live'), 'live');
  assert.throws(() => agentTraceModeSchema.parse('sandbox'));
}

function testQueryDefaults() {
  assert.deepEqual(agentTraceListQuerySchema.parse({}), { limit: 20 });
  assert.deepEqual(agentTraceListQuerySchema.parse({ limit: '5', mode: 'live' }), {
    limit: 5,
    mode: 'live',
  });
  assert.deepEqual(agentTraceSummaryQuerySchema.parse({}), { days: 7 });
  assert.throws(() => agentTraceListQuerySchema.parse({ limit: 0 }));
  assert.throws(() => agentTraceSummaryQuerySchema.parse({ days: 31 }));
}

function testRunAndStepPayloads() {
  const run = agentTraceRunSchema.parse({
    id: 'run_1',
    userId: 'user_1',
    conversationId: 'conversation_1',
    route: 'tutor',
    confidence: 0.86,
    status: 'completed',
    mode: 'mock',
    modelProvider: 'mock',
    modelName: 'mock-prepmind-chat',
    inputTokenEstimate: 120,
    outputTokenEstimate: 240,
    maxOutputTokens: 1200,
    pricingKnown: true,
    costEstimate: 0,
    ragHitCount: 0,
    verifierStatus: 'skipped',
    verifierChunkCount: 0,
    tutorIntent: 'socratic_hint',
    tutorDepth: 'guided',
    degraded: false,
    inputHash: 'hash_1',
    inputPreview: '这道题给我一点提示',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:01.000Z',
    totalDurationMs: 1000,
    createdAt: '2026-06-28T00:00:01.000Z',
    updatedAt: '2026-06-28T00:00:01.000Z',
  });

  const step = agentTraceStepSchema.parse({
    id: 'step_1',
    runId: run.id,
    node: 'RouterAgent',
    status: 'completed',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:00.010Z',
    durationMs: 10,
    inputSummary: '用户请求讲题提示',
    outputSummary: 'route=tutor confidence=0.86',
    errorMessage: null,
  });

  assert.equal(run.route, 'tutor');
  assert.equal(step.node, 'RouterAgent');
  assert.deepEqual(agentTraceDetailResponseSchema.parse({ run, steps: [step] }).steps, [
    step,
  ]);
}

function testCreateRequestSanity() {
  const parsed = agentTraceCreateRequestSchema.parse({
    runId: 'run_1',
    conversationId: null,
    route: 'rag_answer',
    confidence: 0.91,
    status: 'degraded',
    mode: 'live',
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: 0.0034,
    ragHitCount: 2,
    verifierStatus: 'suspicious',
    verifierChunkCount: 2,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答',
    startedAt: '2026-06-28T00:00:00.000Z',
    finishedAt: '2026-06-28T00:00:02.000Z',
    totalDurationMs: 2000,
    steps: [
      {
        node: 'RouterAgent',
        status: 'completed',
        startedAt: '2026-06-28T00:00:00.000Z',
        finishedAt: '2026-06-28T00:00:00.020Z',
        durationMs: 20,
        inputSummary: '资料型问题',
        outputSummary: 'route=rag_answer',
        errorMessage: null,
      },
    ],
  });

  assert.equal(parsed.steps.length, 1);
  assert.equal(parsed.verifierStatus, 'suspicious');
  assert.throws(() => agentTraceCreateRequestSchema.parse({ ...parsed, costEstimate: -1 }));
  assert.throws(() =>
    agentTraceCreateRequestSchema.parse({
      ...parsed,
      steps: [
        {
          ...parsed.steps[0]!,
          inputSummary: 'x'.repeat(161),
        },
      ],
    }),
  );
}

function testSummaryPayload() {
  const summary = agentTraceSummaryResponseSchema.parse({
    days: 7,
    totalRuns: 4,
    liveRuns: 1,
    mockRuns: 3,
    degradedRuns: 1,
    failedRuns: 0,
    totalInputTokens: 1000,
    totalOutputTokens: 2400,
    totalCostEstimate: 0.0042,
    lastRunAt: '2026-06-28T00:00:02.000Z',
    routeBreakdown: [{ route: 'tutor', count: 2 }],
    verifierBreakdown: [{ status: 'trusted', count: 1 }],
  });

  assert.equal(summary.totalRuns, 4);
  assert.equal(summary.routeBreakdown[0]?.route, 'tutor');
}
