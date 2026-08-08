import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

import type { AgentExecutionContextV1 } from '@repo/agent/realtime-chat';
import type { RetrieverSearchPortV1 } from '@repo/agent/retriever';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      [
        'export async function resolve(specifier, context, nextResolve) {',
        "  if (specifier === 'server-only') return { url: 'data:text/javascript,export default undefined', shortCircuit: true };",
        '  try { return await nextResolve(specifier, context); } catch (error) {',
        "    if (/^\\.\\.?\\//u.test(specifier) && !/\\.[cm]?[jt]sx?$/u.test(specifier)) return nextResolve(specifier + '.ts', context);",
        '    throw error;',
        '  }',
        '}',
      ].join('\n'),
    ),
  import.meta.url,
);

const {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  runFinalResponseAgentNodeV1,
} = await import('@repo/agent/final-response');
const { createAgentAuthReceiptV1, createAgentExecutionContextV1 } =
  await import('@repo/agent/realtime-chat');
const { createRetrieverSearchPortV1 } = await import('@repo/agent/retriever');

const { buildChatAgentTracePayload } = await import('./agent-trace-payload.ts');
const {
  buildVerifiedEvidenceContextPromptV1,
  prepareRealtimeFinalResponseV1,
  runRealtimeRetrieverCompositionV1,
} = await import('./chat-realtime-composition.ts');
const {
  buildRealtimeChatTraceFailureFinalizeV1,
  buildRealtimeChatTraceFinalizeV1,
  buildRealtimeChatTracePreparationV1,
  buildRealtimeChatTraceStartV1,
} = await import('./chat-realtime-trace.ts');

test('composes Retriever, local evidence, FinalResponse, and terminal Trace without Provider access', async () => {
  const now = Date.now();
  const context = authenticatedContext('owner_1', new AbortController().signal, now);
  let searchCalls = 0;
  const port = createPort(context, async () => {
    searchCalls += 1;
    return {
      ok: true,
      response: {
        hits: [
          {
            documentId: 'doc_1',
            chunkId: 'chunk_1',
            documentName: 'Synthetic document',
            content: '二次函数顶点公式来自配方法，顶点横坐标为负的系数比值。',
            score: 0.93,
            metadata: {
              safety: {
                riskLevel: 'low',
                categories: [],
                matchedPatterns: [],
                safeForPrompt: true,
              },
              retrieval: { mode: 'hybrid', vectorScore: 0.9, keywordScore: 0.8 },
            },
          },
        ],
      },
    };
  });
  const decision = agentDecision();
  const messages = [{ role: 'user' as const, content: '请根据我的资料解释二次函数顶点公式。' }];
  const retrieval = await runRealtimeRetrieverCompositionV1({
    context,
    messages,
    activeContext: null,
    decision,
    port,
    verify: async () => ({
      assessment: { status: 'trusted', availability: 'available' },
    }),
    now: () => now,
  });
  assert.equal(retrieval.ok, true);
  if (!retrieval.ok) return;
  assert.equal(searchCalls, 1);
  assert.match(buildVerifiedEvidenceContextPromptV1(retrieval.value), /顶点公式/u);

  const prepared = prepareRealtimeFinalResponseV1({
    context,
    messages,
    decision,
    retriever: retrieval.value,
    ragIncluded: true,
    maxInputTokens: 2_500,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.value.evidence.citationProjection.citations.length, 1);

  let clock = now;
  const execution = await runFinalResponseAgentNodeV1({
    request: prepared.value.request,
    context,
    config: reviewedMockConfig(),
    responseId: 'response_1',
    modelCallId: 'model_call_1',
    traceAvailable: true,
    now: () => {
      clock += 10;
      return clock;
    },
    executor: async function* () {
      yield { type: 'text_delta', text: '先完成配方。' };
      yield {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 256, outputTokens: 16 },
      };
    },
  });
  assert.equal(execution.ok, true);
  if (!execution.ok) return;
  assert.equal(execution.observation.disposition, 'completed');
  assert.equal(execution.events.filter((event) => event.event === 'response_completed').length, 1);

  const startedAt = new Date(now);
  const preparedAt = new Date(now + 25);
  const base = buildChatAgentTracePayload({
    runId: context.runId,
    conversationId: 'conversation_shared',
    messages,
    mode: 'mock',
    modelProvider: 'mock',
    modelName: 'mock-local-v1',
    budget: { estimatedInputTokens: 500, maxOutputTokens: 1_200 },
    agentDecision: decision,
    knowledgeHits: [],
    startedAt,
    finishedAt: preparedAt,
  });
  const start = buildRealtimeChatTraceStartV1({
    runId: context.runId,
    modelCallId: 'model_call_1',
    conversationId: 'conversation_shared',
    mode: 'mock',
    startedAt,
  });
  const preparation = buildRealtimeChatTracePreparationV1({
    start,
    base,
    requiresRag: decision.requiresRag,
    retriever: retrieval.value,
    evidence: prepared.value.evidence,
    preparedAt,
  });
  const terminal = buildRealtimeChatTraceFinalizeV1({
    start,
    preparation,
    observation: execution.observation,
    finishedAt: new Date(now + 80),
  });
  assert.equal(start.modelCallId, terminal.modelCallId);
  assert.equal(terminal.status, 'completed');
  assert.equal(terminal.verifiedInputTokens, 256);
  assert.equal(terminal.qualityAuthority, 'none');
  assert.equal(terminal.steps.at(-1)?.node, 'FinalResponseAgent');
  const realtimeJson = JSON.stringify({ start, preparation, terminal });
  assert.doesNotMatch(realtimeJson, /请根据我的资料|二次函数顶点公式|doc_1|chunk_1/u);
  assert.doesNotMatch(realtimeJson, /inputPreview|inputHash|owner_1|Authorization|Bearer/u);

  const traceUnavailable = await runFinalResponseAgentNodeV1({
    request: prepared.value.request,
    context,
    config: reviewedMockConfig(),
    responseId: 'response_trace_unavailable',
    modelCallId: 'model_call_trace_unavailable',
    traceAvailable: false,
    now: () => now + 90,
    executor: async function* () {
      yield { type: 'text_delta', text: '正文仍可交付。' };
      yield {
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 200, outputTokens: 12 },
      };
    },
  });
  assert.equal(traceUnavailable.ok, true);
  if (traceUnavailable.ok) {
    const traceUnavailableTerminal = traceUnavailable.events.at(-1);
    assert.equal(traceUnavailableTerminal?.event, 'response_completed');
    assert.equal(
      traceUnavailableTerminal?.event === 'response_completed'
        ? traceUnavailableTerminal.traceTerminal
        : null,
      'completed_trace_unavailable',
    );
  }

  const unexpectedTerminal = buildRealtimeChatTraceFailureFinalizeV1({
    start,
    preparation,
    finishedAt: new Date(now + 100),
    reasonCode: 'unexpected_failure',
    finalResponseAttempted: true,
  });
  assert.equal(unexpectedTerminal.status, 'failed');
  assert.equal(unexpectedTerminal.verifiedInputTokens, null);
  assert.equal(unexpectedTerminal.steps.at(-1)?.status, 'failed');
});

test('propagates abort before retrieval and keeps the search port at zero calls', async () => {
  const controller = new AbortController();
  controller.abort();
  const context = authenticatedContext('owner_abort', controller.signal, Date.now());
  let calls = 0;
  const result = await runRealtimeRetrieverCompositionV1({
    context,
    messages: [{ role: 'user', content: '请查资料解释这一步。' }],
    activeContext: null,
    decision: agentDecision(),
    port: createPort(context, async () => {
      calls += 1;
      return { ok: true, response: { hits: [] } };
    }),
    verify: async () => ({
      assessment: { status: 'skipped', availability: 'available' },
    }),
  });
  assert.deepEqual(result, { ok: false, reasonCode: 'aborted' });
  assert.equal(calls, 0);
});

test('stops after retrieval when the parent aborts and never enters Verifier', async () => {
  const controller = new AbortController();
  const context = authenticatedContext('owner_abort_after_search', controller.signal, Date.now());
  let verifierCalls = 0;
  const result = await runRealtimeRetrieverCompositionV1({
    context,
    messages: [{ role: 'user', content: '请查资料解释这一步。' }],
    activeContext: null,
    decision: agentDecision(),
    port: createPort(context, async () => {
      controller.abort();
      return { ok: true, response: { hits: [] } };
    }),
    verify: async () => {
      verifierCalls += 1;
      return { assessment: { status: 'skipped', availability: 'available' } };
    },
  });
  assert.deepEqual(result, { ok: false, reasonCode: 'aborted' });
  assert.equal(verifierCalls, 0);
});

test('degrades Retriever transport and schema failures to an empty no-RAG evidence layer', async () => {
  const now = Date.now();
  const cases = [
    async () => ({ ok: false as const, reasonCode: 'transport_error' as const }),
    async () => ({ ok: true as const, response: { hits: 'invalid_shape' } }),
  ];

  for (const execute of cases) {
    const context = authenticatedContext(
      'owner_retrieval_degrade',
      new AbortController().signal,
      now,
    );
    const result = await runRealtimeRetrieverCompositionV1({
      context,
      messages: [{ role: 'user', content: '请检索资料。' }],
      activeContext: null,
      decision: agentDecision(),
      port: createPort(context, execute),
      verify: async () => ({
        assessment: { status: 'insufficient', availability: 'unavailable' },
      }),
      now: () => now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    assert.equal(result.value.retriever.result.status, 'degraded');
    assert.equal(result.value.retriever.result.evidenceCandidates.length, 0);
    assert.equal(result.value.provisionalEvidence.bundle, null);
  }
});

test('does not degrade a cross-scope Retriever port binding failure', async () => {
  const now = Date.now();
  const context = authenticatedContext('owner_binding_a', new AbortController().signal, now);
  const other = authenticatedContext('owner_binding_b', new AbortController().signal, now);
  const result = await runRealtimeRetrieverCompositionV1({
    context,
    messages: [{ role: 'user', content: '请检索资料。' }],
    activeContext: null,
    decision: agentDecision(),
    port: createPort(other, async () => ({ ok: true, response: { hits: [] } })),
    verify: async () => ({ assessment: { status: 'skipped', availability: 'available' } }),
    now: () => now,
  });

  assert.deepEqual(result, { ok: false, reasonCode: 'principal_binding_invalid' });
});

test('isolates concurrent runs even when they share one conversation input', async () => {
  const now = Date.now();
  const contexts = [
    authenticatedContext('owner_1', new AbortController().signal, now),
    authenticatedContext('owner_1', new AbortController().signal, now),
  ];
  const messages = [{ role: 'user' as const, content: '请查我的资料。' }];
  const results = await Promise.all(
    contexts.map((context) =>
      runRealtimeRetrieverCompositionV1({
        context,
        messages,
        activeContext: null,
        decision: agentDecision(),
        port: createPort(context, async () => ({
          ok: true,
          response: {
            hits: [
              {
                documentId: 'doc_shared',
                chunkId: 'chunk_shared',
                documentName: 'Synthetic shared document',
                content: '并发运行必须保持各自的 execution context 绑定。',
                score: 0.93,
                metadata: {
                  safety: {
                    riskLevel: 'low',
                    categories: [],
                    matchedPatterns: [],
                    safeForPrompt: true,
                  },
                  retrieval: { mode: 'hybrid', vectorScore: 0.9, keywordScore: 0.8 },
                },
              },
            ],
          },
        })),
        verify: async () => ({
          assessment: { status: 'skipped', availability: 'available' },
        }),
        now: () => now,
      }),
    ),
  );
  assert.ok(results.every((result) => result.ok));
  if (!results[0]?.ok || !results[1]?.ok) return;
  assert.notEqual(results[0].value.retriever.result.runId, results[1].value.retriever.result.runId);
  assert.notEqual(
    results[0].value.provisionalEvidence.bundle?.bundleId,
    results[1].value.provisionalEvidence.bundle?.bundleId,
  );
});

function authenticatedContext(
  ownerId: string,
  signal: AbortSignal,
  now: number,
): AgentExecutionContextV1 {
  const authResponse = {};
  const request = {};
  const bearerToken = {};
  const receipt = createAgentAuthReceiptV1(
    { ownerId, authority: 'server_jwt' },
    { authResponse, request, bearerToken },
  );
  if (!receipt.ok) throw new Error('invalid test receipt');
  const suffix = Math.random().toString(16).slice(2);
  const context = createAgentExecutionContextV1(
    {
      runId: `run_${suffix}`,
      requestId: `request_${suffix}`,
      principal: { kind: 'authenticated', ownerId, authority: 'server_jwt' },
      deadlineAt: new Date(now + 10_000).toISOString(),
    },
    { signal, authReceipt: receipt.value, authResponse, request, bearerToken },
  );
  if (!context.ok) throw new Error('invalid test context');
  return context.value;
}

function createPort(
  context: AgentExecutionContextV1,
  execute: Parameters<typeof createRetrieverSearchPortV1>[0]['execute'],
): RetrieverSearchPortV1 {
  const created = createRetrieverSearchPortV1({ scope: context, execute });
  if (!created.ok) throw new Error('invalid test port');
  return created.port;
}

function agentDecision() {
  return {
    route: 'rag_answer' as const,
    confidence: 0.95,
    reason: 'explicit knowledge request',
    requiresRag: true,
    requiresHumanApproval: false,
    promptAddition: 'Use verified evidence conservatively.',
    debugHeaders: {},
    degraded: false,
  };
}

function reviewedMockConfig() {
  return {
    schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
    enabled: true,
    runtimeAuthority: 'reviewed_mock' as const,
    mode: 'mock' as const,
    provider: 'mock' as const,
    modelRef: 'mock-local-v1' as const,
    executorProvenance: 'mock_synthetic' as const,
    timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
    maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
    maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
    priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
    inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
    outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
    requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  };
}
