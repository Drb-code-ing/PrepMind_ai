import assert from 'node:assert/strict';

import {
  agentTraceCreateRequestSchema,
  agentTraceDetailResponseSchema,
  agentTraceListQuerySchema,
  agentTraceModeSchema,
  agentTraceRealtimeFinalizeRequestSchema,
  agentTraceRealtimePrepareRequestSchema,
  agentTraceRealtimeStartRequestSchema,
  agentTraceRunSchema,
  agentTraceSummaryQuerySchema,
  agentTraceSummaryResponseSchema,
  agentTraceStepSchema,
} from '../src/api/agent-trace.ts';

testEnums();
testQueryDefaults();
testRunAndStepPayloads();
testCreateRequestSanity();
testRealtimeLifecycleSchemas();
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
    modelCallId: null,
    firstTokenLatencyMs: null,
    finishReason: null,
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    qualityAuthority: 'none',
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
  assert.deepEqual(agentTraceDetailResponseSchema.parse({ run, steps: [step] }).steps, [step]);
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
  assert.throws(() => agentTraceCreateRequestSchema.parse({ ...parsed, status: 'running' }));
  const legacyWithRealtimeIdentity = agentTraceCreateRequestSchema.parse({
    ...parsed,
    modelCallId: 'must_not_cross_legacy_boundary',
  });
  assert.equal(Object.hasOwn(legacyWithRealtimeIdentity, 'modelCallId'), false);
  assert.doesNotThrow(() =>
    agentTraceCreateRequestSchema.parse({
      ...parsed,
      inputPreview: 'x'.repeat(2000),
      steps: [
        {
          ...parsed.steps[0]!,
          inputSummary: 'x'.repeat(2000),
        },
      ],
    }),
  );
  assert.throws(() =>
    agentTraceCreateRequestSchema.parse({
      ...parsed,
      steps: [
        {
          ...parsed.steps[0]!,
          inputSummary: 'x'.repeat(2001),
        },
      ],
    }),
  );
  assert.throws(() =>
    agentTraceStepSchema.parse({
      id: 'step_too_long',
      runId: 'run_1',
      node: 'RouterAgent',
      status: 'completed',
      startedAt: '2026-06-28T00:00:00.000Z',
      finishedAt: '2026-06-28T00:00:00.020Z',
      durationMs: 20,
      inputSummary: 'x'.repeat(161),
      outputSummary: 'route=rag_answer',
      errorMessage: null,
    }),
  );
}

function testRealtimeLifecycleSchemas() {
  const start = agentTraceRealtimeStartRequestSchema.parse({
    runId: 'realtime_run_1',
    modelCallId: 'model_call_1',
    conversationId: 'conversation_1',
    mode: 'mock',
    startedAt: '2026-08-05T00:00:00.000Z',
  });
  assert.throws(() =>
    agentTraceRealtimeStartRequestSchema.parse({
      ...start,
      inputPreview: 'must never cross realtime start',
    }),
  );

  const prepare = agentTraceRealtimePrepareRequestSchema.parse({
    runId: start.runId,
    modelCallId: start.modelCallId,
    preparation: {
      route: 'rag_answer',
      confidence: 0.9,
      modelProvider: 'mock',
      modelName: 'mock-local-v1',
      inputTokenEstimate: 500,
      outputTokenEstimate: 1200,
      maxOutputTokens: 1200,
      pricingKnown: false,
      costEstimate: 0,
      ragHitCount: 1,
      verifierStatus: 'trusted',
      verifierChunkCount: 1,
      degraded: false,
      preparedAt: '2026-08-05T00:00:00.500Z',
      steps: [traceStep('RetrieverAgent', 'completed')],
    },
  });
  assert.throws(() =>
    agentTraceRealtimePrepareRequestSchema.parse({
      ...prepare,
      preparation: {
        ...prepare.preparation,
        steps: [...prepare.preparation.steps, traceStep('FinalResponseAgent', 'completed')],
      },
    }),
  );
  assert.throws(() =>
    agentTraceRealtimePrepareRequestSchema.parse({
      ...prepare,
      preparation: {
        ...prepare.preparation,
        steps: [
          {
            ...prepare.preparation.steps[0]!,
            inputSummary: '用户正文绝不能进入 realtime JSON',
          },
        ],
      },
    }),
  );

  const completed = agentTraceRealtimeFinalizeRequestSchema.parse({
    runId: start.runId,
    modelCallId: start.modelCallId,
    status: 'completed',
    pricingKnown: true,
    degraded: false,
    finishedAt: '2026-08-05T00:00:01.000Z',
    totalDurationMs: 1000,
    firstTokenLatencyMs: 40,
    finishReason: 'stop',
    verifiedInputTokens: 256,
    verifiedOutputTokens: 32,
    priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
    verifiedCostCny: 0.00096,
    qualityAuthority: 'none',
    preparation: prepare.preparation,
    steps: [...prepare.preparation.steps, traceStep('FinalResponseAgent', 'completed')],
  });
  assert.equal(completed.status, 'completed');
  assert.throws(() =>
    agentTraceRealtimeFinalizeRequestSchema.parse({
      ...completed,
      status: 'degraded',
      degraded: false,
    }),
  );
  assert.throws(() =>
    agentTraceRealtimeFinalizeRequestSchema.parse({
      ...completed,
      verifiedInputTokens: null,
      verifiedOutputTokens: null,
      priceProfile: null,
      verifiedCostCny: null,
    }),
  );

  const failed = agentTraceRealtimeFinalizeRequestSchema.parse({
    ...completed,
    status: 'failed',
    pricingKnown: false,
    degraded: true,
    finishReason: 'aborted',
    firstTokenLatencyMs: null,
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    steps: [...prepare.preparation.steps, traceStep('FinalResponseAgent', 'failed')],
  });
  assert.equal(failed.status, 'failed');

  const earlyFailure = agentTraceRealtimeFinalizeRequestSchema.parse({
    runId: start.runId,
    modelCallId: start.modelCallId,
    status: 'failed',
    pricingKnown: false,
    degraded: true,
    finishedAt: '2026-08-05T00:00:00.100Z',
    totalDurationMs: 100,
    firstTokenLatencyMs: null,
    finishReason: 'aborted',
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    qualityAuthority: 'none',
    steps: [],
  });
  assert.equal(earlyFailure.preparation, undefined);
  assert.throws(() =>
    agentTraceRealtimeFinalizeRequestSchema.parse({
      ...earlyFailure,
      steps: [traceStep('FinalResponseAgent', 'failed')],
    }),
  );
}

function traceStep(node: string, status: 'completed' | 'failed') {
  return {
    node,
    status,
    startedAt: '2026-08-05T00:00:00.000Z',
    finishedAt: '2026-08-05T00:00:00.010Z',
    durationMs: 10,
    inputSummary: 'safe input summary',
    outputSummary: 'safe output summary',
    errorMessage: status === 'failed' ? 'safe_failure' : null,
  };
}

function testSummaryPayload() {
  const summary = agentTraceSummaryResponseSchema.parse({
    days: 7,
    totalRuns: 4,
    runningRuns: 1,
    liveRuns: 1,
    mockRuns: 3,
    degradedRuns: 1,
    failedRuns: 0,
    totalInputTokens: 1000,
    totalOutputTokens: 2400,
    totalCostEstimate: 0.0042,
    verifiedUsageRuns: 1,
    totalVerifiedInputTokens: 240,
    totalVerifiedOutputTokens: 80,
    totalVerifiedCostCny: 0.0012,
    lastRunAt: '2026-06-28T00:00:02.000Z',
    routeBreakdown: [{ route: 'tutor', count: 2 }],
    verifierBreakdown: [{ status: 'trusted', count: 1 }],
  });

  assert.equal(summary.totalRuns, 4);
  assert.equal(summary.routeBreakdown[0]?.route, 'tutor');
}
