import assert from 'node:assert/strict';

import type {
  AgentTraceRealtimeFinalizeRequest,
  AgentTraceRealtimePrepareRequest,
  AgentTraceRealtimeStartRequest,
} from '@repo/types/api/agent-trace';

import { createAgentTraceApi } from './agent-trace-api.ts';

const requests: CapturedRequest[] = [];
const api = createAgentTraceApi({
  get: async <T,>(path: string, options?: RequestOptions) => {
    requests.push({ path, accessToken: options?.accessToken });
    if (path.startsWith('/agent-traces/summary')) {
      return createTraceSummaryResponse() as T;
    }
    if (path === '/agent-traces/trace_run_1') {
      return createTraceResponse() as T;
    }
    return createTraceListResponse() as T;
  },
  post: async <T,>(path: string, body?: unknown, options?: RequestOptions) => {
    requests.push({ path, body, accessToken: options?.accessToken });
    return createTraceResponse(path.endsWith('/realtime') ? 'running' : 'degraded') as T;
  },
  patch: async <T,>(path: string, body?: unknown, options?: RequestOptions) => {
    requests.push({ path, body, accessToken: options?.accessToken });
    return createTraceResponse(path.endsWith('/prepare') ? 'running' : 'completed') as T;
  },
});

const result = await api.createTrace('token_1', createTracePayload());

assert.equal(requests[0]?.path, '/agent-traces');
assert.equal(requests[0]?.accessToken, 'token_1');
assert.equal((requests[0]?.body as Record<string, unknown>).runId, 'trace_run_1');
assert.equal(result.run.id, 'trace_run_1');
assert.equal(result.steps[0]?.node, 'RouterAgent');

requests.length = 0;

const list = await api.listTraces('token_1', { limit: 10, mode: 'live' });
assert.equal(requests[0]?.path, '/agent-traces?limit=10&mode=live');
assert.equal(requests[0]?.accessToken, 'token_1');
assert.equal(list.runs[0]?.id, 'trace_run_1');

requests.length = 0;

const summary = await api.getSummary('token_1', { days: 14 });
assert.equal(requests[0]?.path, '/agent-traces/summary?days=14');
assert.equal(summary.days, 14);
assert.equal(summary.totalRuns, 1);

requests.length = 0;

const detail = await api.getTrace('token_1', 'trace_run_1');
assert.equal(requests[0]?.path, '/agent-traces/trace_run_1');
assert.equal(detail.run.id, 'trace_run_1');

requests.length = 0;
const started = await api.startRealtimeTrace('token_1', createRealtimeStartPayload());
assert.equal(requests[0]?.path, '/agent-traces/realtime');
assert.equal(started.run.status, 'running');

requests.length = 0;
const prepared = await api.prepareRealtimeTrace(
  'token_1',
  'trace_run_1',
  createRealtimePreparePayload(),
);
assert.equal(requests[0]?.path, '/agent-traces/realtime/trace_run_1/prepare');
assert.equal(prepared.run.status, 'running');

requests.length = 0;
const finalized = await api.finalizeRealtimeTrace(
  'token_1',
  'trace_run_1',
  createRealtimeFinalizePayload(),
);
assert.equal(requests[0]?.path, '/agent-traces/realtime/trace_run_1/terminal');
assert.equal(finalized.run.status, 'completed');

function createTracePayload() {
  return {
    runId: 'trace_run_1',
    conversationId: null,
    route: 'rag_answer' as const,
    confidence: 0.91,
    status: 'degraded' as const,
    mode: 'live' as const,
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: 0,
    ragHitCount: 2,
    verifierStatus: 'suspicious' as const,
    verifierChunkCount: 2,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答',
    startedAt: '2026-06-28T08:00:00.000Z',
    finishedAt: '2026-06-28T08:00:02.000Z',
    totalDurationMs: 2000,
    steps: [
      {
        node: 'RouterAgent',
        status: 'completed' as const,
        startedAt: '2026-06-28T08:00:00.000Z',
        finishedAt: '2026-06-28T08:00:00.020Z',
        durationMs: 20,
        inputSummary: '资料型问题',
        outputSummary: 'route=rag_answer',
        errorMessage: null,
      },
    ],
  };
}

function createTraceResponse(status: 'running' | 'completed' | 'degraded' = 'degraded') {
  const payload = createTracePayload();
  return {
    run: {
      id: payload.runId,
      userId: 'user_1',
      conversationId: payload.conversationId,
      route: payload.route,
      confidence: payload.confidence,
      status,
      mode: payload.mode,
      modelProvider: payload.modelProvider,
      modelName: payload.modelName,
      inputTokenEstimate: payload.inputTokenEstimate,
      outputTokenEstimate: payload.outputTokenEstimate,
      maxOutputTokens: payload.maxOutputTokens,
      pricingKnown: status === 'completed' ? true : payload.pricingKnown,
      costEstimate: payload.costEstimate,
      modelCallId: status === 'degraded' ? null : 'model_call_1',
      firstTokenLatencyMs: status === 'completed' ? 20 : null,
      finishReason: status === 'completed' ? 'stop' : null,
      verifiedInputTokens: status === 'completed' ? 256 : null,
      verifiedOutputTokens: status === 'completed' ? 32 : null,
      priceProfile: status === 'completed' ? 'deepseek-v4-pro-cny-2026-07-15' : null,
      verifiedCostCny: status === 'completed' ? 0.00096 : null,
      qualityAuthority: 'none',
      ragHitCount: payload.ragHitCount,
      verifierStatus: payload.verifierStatus,
      verifierChunkCount: payload.verifierChunkCount,
      degraded: status === 'degraded',
      inputHash: payload.inputHash,
      inputPreview: payload.inputPreview,
      startedAt: payload.startedAt,
      finishedAt: status === 'running' ? null : payload.finishedAt,
      totalDurationMs: status === 'running' ? null : payload.totalDurationMs,
      createdAt: payload.startedAt,
      updatedAt: payload.finishedAt,
    },
    steps: [
      {
        id: 'step_1',
        runId: payload.runId,
        ...payload.steps[0],
      },
    ],
  };
}

function createRealtimeStartPayload(): AgentTraceRealtimeStartRequest {
  const payload = createTracePayload();
  return {
    runId: payload.runId,
    modelCallId: 'model_call_1',
    conversationId: payload.conversationId,
    mode: payload.mode,
    startedAt: payload.startedAt,
  };
}

function createRealtimePreparePayload(): AgentTraceRealtimePrepareRequest {
  const start = createRealtimeStartPayload();
  const payload = createTracePayload();
  return {
    runId: start.runId,
    modelCallId: start.modelCallId,
    preparation: {
      route: payload.route,
      confidence: payload.confidence,
      modelProvider: payload.modelProvider,
      modelName: payload.modelName,
      inputTokenEstimate: payload.inputTokenEstimate,
      outputTokenEstimate: payload.outputTokenEstimate,
      maxOutputTokens: payload.maxOutputTokens,
      pricingKnown: payload.pricingKnown,
      costEstimate: payload.costEstimate,
      ragHitCount: payload.ragHitCount,
      verifierStatus: payload.verifierStatus,
      verifierChunkCount: payload.verifierChunkCount,
      degraded: false,
      preparedAt: '2026-06-28T08:00:01.000Z',
      steps: [
        {
          ...payload.steps[0]!,
          node: 'RouterAgent',
          inputSummary: 'scope=canonical_route',
        },
      ],
    },
  };
}

function createRealtimeFinalizePayload(): AgentTraceRealtimeFinalizeRequest {
  const start = createRealtimeStartPayload();
  const prepare = createRealtimePreparePayload();
  return {
    runId: start.runId,
    modelCallId: start.modelCallId,
    status: 'completed' as const,
    pricingKnown: true,
    degraded: false,
    finishedAt: '2026-06-28T08:00:02.000Z',
    totalDurationMs: 2000,
    firstTokenLatencyMs: 20,
    finishReason: 'stop' as const,
    verifiedInputTokens: 256,
    verifiedOutputTokens: 32,
    priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
    verifiedCostCny: 0.00096,
    qualityAuthority: 'none' as const,
    preparation: prepare.preparation,
    steps: [
      ...prepare.preparation.steps,
      {
        node: 'FinalResponseAgent',
        status: 'completed' as const,
        startedAt: '2026-06-28T08:00:01.000Z',
        finishedAt: '2026-06-28T08:00:02.000Z',
        durationMs: 1000,
        inputSummary: 'scope=final_response',
        outputSummary: 'disposition=completed finish=stop',
        errorMessage: null,
      },
    ],
  };
}

function createTraceListResponse() {
  return {
    runs: [createTraceResponse().run],
  };
}

function createTraceSummaryResponse() {
  return {
    days: 14,
    totalRuns: 1,
    runningRuns: 0,
    liveRuns: 1,
    mockRuns: 0,
    degradedRuns: 1,
    failedRuns: 0,
    totalInputTokens: 800,
    totalOutputTokens: 1200,
    totalCostEstimate: 0,
    verifiedUsageRuns: 0,
    totalVerifiedInputTokens: 0,
    totalVerifiedOutputTokens: 0,
    totalVerifiedCostCny: 0,
    lastRunAt: '2026-06-28T08:00:02.000Z',
    routeBreakdown: [{ route: 'rag_answer' as const, count: 1 }],
    verifierBreakdown: [{ status: 'suspicious' as const, count: 1 }],
  };
}

type RequestOptions = {
  accessToken?: string | null;
  signal?: AbortSignal;
};

type CapturedRequest = {
  path: string;
  body?: unknown;
  accessToken?: string | null;
};
