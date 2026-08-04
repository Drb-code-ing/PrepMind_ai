import { describe, expect, test } from 'bun:test';

import type { FinalResponseStreamExecutor, FinalResponseStreamExecutorEvent } from '@repo/ai';

import {
  createAgentAuthReceiptV1,
  createAgentExecutionContextV1,
  parseFinalResponseRequestV1,
  type AgentExecutionContextV1,
  type FinalResponseRequestV1,
  type FinalResponseStreamEventV1,
} from '../src/contracts/realtime-chat.ts';
import {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  runFinalResponseAgentNodeV1,
  type FinalResponseAgentConfigV1,
} from '../src/nodes/final-response.ts';
import { projectVerifiedEvidenceBundleV1 } from '../src/nodes/evidence-projector.ts';
import {
  createRetrieverSearchPortV1,
  RETRIEVER_AGENT_POLICY_V1,
  runRetrieverAgentNodeV1,
} from '../src/nodes/retriever.ts';

const NOW = Date.parse('2026-08-04T12:00:00.000Z');
const DEADLINE = '2026-08-04T12:00:20.000Z';
let sequence = 0;

describe('FinalResponseAgent stream node', () => {
  test('emits started, deltas, verified local citations, and exactly one completed terminal', async () => {
    const context = authenticatedContext('owner_final_success');
    const request = await requestWithEvidence(context, 'trusted');
    let calls = 0;
    let providerPrompt = '';
    const emitted: unknown[] = [];
    const result = await runFinalResponseAgentNodeV1({
      request,
      context,
      config: mockConfig(),
      responseId: 'response_success',
      modelCallId: 'model_call_success',
      traceAvailable: true,
      now: () => NOW,
      executor(input) {
        calls += 1;
        providerPrompt = input.userPrompt;
        return scriptedStream([
          { type: 'text_delta', text: '合外力等于质量与加速度的乘积。' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 320, outputTokens: 24 },
          },
        ]);
      },
      emit(event) {
        emitted.push(event);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(calls).toBe(1);
    expect(result.events.map((event) => event.event)).toEqual([
      'response_started',
      'text_delta',
      'citations',
      'response_completed',
    ]);
    expect(emitted).toEqual(result.events);
    expect(result.events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
    expect(result.events.filter(isTerminal)).toHaveLength(1);
    expect(result.partialText).toBe('合外力等于质量与加速度的乘积。');
    expect(result.observation).toMatchObject({
      disposition: 'completed',
      reasonCode: 'completed',
      attempted: true,
      executorProvenance: 'mock_synthetic',
      qualityAuthority: 'none',
      usage: { inputTokens: 320, outputTokens: 24 },
      pricingKnown: true,
      estimatedCostCny: 0.001104,
      traceAvailable: true,
      deliveryFailed: false,
    });

    const prompt = JSON.parse(providerPrompt) as {
      evidenceStatus: string;
      input: { evidence: Array<Record<string, unknown>> };
    };
    expect(prompt.evidenceStatus).toBe('trusted');
    expect(Object.keys(prompt.input.evidence[0]!).sort()).toEqual([
      'citationId',
      'excerpt',
      'sourceLabel',
      'trustLabel',
    ]);
    for (const forbidden of [
      'owner_final_success',
      'documentId',
      'chunkId',
      'sourceRef',
      'safetyCodes',
      'credential',
      'endpoint',
    ]) {
      expect(providerPrompt).not.toContain(forbidden);
      expect(JSON.stringify(result.observation)).not.toContain(forbidden);
    }
  });

  test('keeps no-RAG and insufficient citation-free while conflict stays caution-only', async () => {
    const context = authenticatedContext('owner_final_status');
    const cases = [
      { name: 'no-rag', request: noRagRequest(context), expectedCitations: 0 },
      {
        name: 'insufficient',
        request: await requestWithEvidence(context, 'insufficient'),
        expectedCitations: 0,
      },
      {
        name: 'conflict',
        request: await requestWithEvidence(context, 'conflict'),
        expectedCitations: 1,
      },
    ] as const;

    for (const current of cases) {
      let prompt = '';
      const result = await runFinalResponseAgentNodeV1({
        request: current.request,
        context,
        config: mockConfig(),
        responseId: `response_${current.name.replace('-', '_')}`,
        modelCallId: `model_call_${current.name.replace('-', '_')}`,
        traceAvailable: false,
        now: () => NOW,
        executor(input) {
          prompt = input.userPrompt;
          return scriptedStream([
            { type: 'text_delta', text: '这是受本地证据边界约束的回答。' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 200, outputTokens: 20 },
            },
          ]);
        },
      });
      expect(result.ok, current.name).toBe(true);
      if (!result.ok) continue;
      expect(result.events.filter((event) => event.event === 'citations')).toHaveLength(
        current.expectedCitations,
      );
      expect(JSON.stringify(result.events)).not.toMatch(/tool|write_success|saved/iu);
      const parsedPrompt = JSON.parse(prompt) as {
        evidenceStatus: string;
        input: { evidence: Array<{ trustLabel: string }> };
      };
      if (current.name === 'conflict') {
        expect(parsedPrompt.evidenceStatus).toBe('conflict');
        expect(parsedPrompt.input.evidence.every((entry) => entry.trustLabel === 'caution')).toBe(
          true,
        );
      }
      const terminal = result.events.at(-1);
      expect(terminal?.event).toBe('response_completed');
      if (terminal?.event === 'response_completed') {
        expect(terminal.traceTerminal).toBe('completed_trace_unavailable');
      }
    }
  });

  test('distinguishes honest pre-token failure from partial post-token failure without citations', async () => {
    const context = authenticatedContext('owner_final_failure');
    const request = await requestWithEvidence(context, 'trusted');
    for (const current of [
      {
        name: 'pre-token',
        executor: (() =>
          (async function* () {
            throw new Error('raw provider failure');
          })()) as FinalResponseStreamExecutor,
        expectedPhase: 'before_first_token',
        expectedText: '',
      },
      {
        name: 'post-token',
        executor: (() =>
          (async function* () {
            yield { type: 'text_delta' as const, text: '已经生成的部分内容。' };
            throw new Error('raw provider failure');
          })()) as FinalResponseStreamExecutor,
        expectedPhase: 'after_first_token',
        expectedText: '已经生成的部分内容。',
      },
    ] as const) {
      const result = await runFinalResponseAgentNodeV1({
        request,
        context,
        config: mockConfig(),
        responseId: `response_${current.name.replace('-', '_')}`,
        modelCallId: `model_call_${current.name.replace('-', '_')}`,
        traceAvailable: true,
        now: () => NOW,
        executor: current.executor,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.partialText).toBe(current.expectedText);
      expect(result.events.some((event) => event.event === 'citations')).toBe(false);
      const terminal = result.events.at(-1);
      expect(terminal?.event).toBe('response_failed');
      if (terminal?.event === 'response_failed') {
        expect(terminal.phase).toBe(current.expectedPhase);
        expect(terminal.retryable).toBe(false);
        expect(terminal.userMessage).toBe(
          current.name === 'pre-token'
            ? '回答暂时不可用，可稍后重试。'
            : '生成中断，内容可能不完整。',
        );
      }
      expect(result.observation.usage).toBeNull();
      expect(result.observation.estimatedCostCny).toBeNull();
    }
  });

  test('bounds timeout and client emitter failure to one local aborted terminal with no retry', async () => {
    const context = authenticatedContext('owner_final_abort');
    const request = noRagRequest(context);
    let timeoutCalls = 0;
    let timeoutDelayMs: number | null = null;
    let clearedTimers = 0;
    const timedOut = await runFinalResponseAgentNodeV1({
      request,
      context,
      config: mockConfig(),
      responseId: 'response_timeout',
      modelCallId: 'model_call_timeout',
      traceAvailable: true,
      now: () => NOW,
      executor(input) {
        timeoutCalls += 1;
        return (async function* () {
          await new Promise<void>((resolve) =>
            input.signal.addEventListener('abort', () => resolve(), { once: true }),
          );
          throw new Error('timeout raw');
        })();
      },
      setTimer(callback, delayMs) {
        timeoutDelayMs = delayMs;
        queueMicrotask(callback);
        return Object.freeze({ timer: 'synthetic' });
      },
      clearTimer() {
        clearedTimers += 1;
      },
    });
    expect(timedOut.ok).toBe(true);
    if (timedOut.ok) {
      expect(timeoutCalls).toBe(1);
      expect(timedOut.events.filter(isTerminal)).toHaveLength(1);
      expect(timedOut.events.at(-1)).toMatchObject({
        event: 'response_failed',
        errorCode: 'provider_timeout',
        retryable: false,
      });
      expect(timeoutDelayMs).toBe(FINAL_RESPONSE_AGENT_TIMEOUT_MS);
      expect(clearedTimers).toBe(1);
    }

    let emitterCalls = 0;
    const disconnected = await runFinalResponseAgentNodeV1({
      request,
      context,
      config: mockConfig(),
      responseId: 'response_disconnect',
      modelCallId: 'model_call_disconnect',
      traceAvailable: true,
      now: () => NOW,
      executor() {
        return scriptedStream([
          { type: 'text_delta', text: '客户端可能已经收到的片段。' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 10 },
          },
        ]);
      },
      emit(event) {
        emitterCalls += 1;
        if (event.event === 'text_delta') throw new Error('client disconnected');
      },
    });
    expect(disconnected.ok).toBe(true);
    if (disconnected.ok) {
      expect(emitterCalls).toBe(2);
      expect(disconnected.events.filter(isTerminal)).toHaveLength(1);
      expect(disconnected.events.at(-1)).toMatchObject({
        event: 'response_failed',
        phase: 'aborted',
        errorCode: 'aborted',
        retryable: false,
      });
      expect(disconnected.observation).toMatchObject({
        disposition: 'aborted',
        reasonCode: 'client_disconnected',
        deliveryFailed: true,
      });
    }
  });

  test('collapses parent-abort and duplicate timeout callbacks into one cleaned terminal', async () => {
    const controller = new AbortController();
    const context = authenticatedContext(
      'owner_final_abort_race',
      controller.signal,
      NOW + FINAL_RESPONSE_AGENT_TIMEOUT_MS,
    );
    const request = noRagRequest(context);
    let timerCallback: (() => void) | null = null;
    let timerDelayMs: number | null = null;
    let clearCalls = 0;
    const running = runFinalResponseAgentNodeV1({
      request,
      context,
      config: mockConfig(),
      responseId: 'response_abort_race',
      modelCallId: 'model_call_abort_race',
      traceAvailable: true,
      now: () => NOW,
      executor(input) {
        return (async function* () {
          await new Promise<void>((resolve) =>
            input.signal.addEventListener('abort', () => resolve(), { once: true }),
          );
          throw new Error('late provider abort');
        })();
      },
      setTimer(callback, delayMs) {
        timerCallback = callback;
        timerDelayMs = delayMs;
        return Object.freeze({ timer: 'race' });
      },
      clearTimer() {
        clearCalls += 1;
      },
    });

    await Promise.resolve();
    expect(timerDelayMs).toBe(FINAL_RESPONSE_AGENT_TIMEOUT_MS);
    controller.abort();
    const triggerTimeout = timerCallback as (() => void) | null;
    if (triggerTimeout === null) throw new Error('timer was not installed');
    triggerTimeout();
    triggerTimeout();
    const result = await running;

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events.filter(isTerminal)).toHaveLength(1);
    expect(result.events.at(-1)).toMatchObject({
      event: 'response_failed',
      phase: 'aborted',
      errorCode: 'aborted',
      retryable: false,
    });
    expect(clearCalls).toBe(1);
  });

  test('keeps a completed citation ledger authoritative when terminal delivery disconnects', async () => {
    const context = authenticatedContext('owner_final_terminal_delivery');
    const request = await requestWithEvidence(context, 'trusted');
    const deliveredEvents: FinalResponseStreamEventV1[] = [];
    const result = await runFinalResponseAgentNodeV1({
      request,
      context,
      config: mockConfig(),
      responseId: 'response_terminal_delivery',
      modelCallId: 'model_call_terminal_delivery',
      traceAvailable: true,
      now: () => NOW,
      executor: () =>
        scriptedStream([
          { type: 'text_delta', text: '引用只来自本地白名单。' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 100, outputTokens: 10 },
          },
        ]),
      emit(event) {
        deliveredEvents.push(event);
        if (event.event === 'response_completed') throw new Error('client disconnected');
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(deliveredEvents.some((event) => event.event === 'citations')).toBe(true);
    expect(result.events.filter(isTerminal)).toHaveLength(1);
    expect(result.events.at(-1)?.event).toBe('response_completed');
    expect(result.events.some((event) => event.event === 'response_failed')).toBe(false);
    expect(result.observation).toMatchObject({
      disposition: 'completed',
      reasonCode: 'client_disconnected',
      deliveryFailed: true,
      usage: { inputTokens: 100, outputTokens: 10 },
    });
  });

  test('keeps anonymous, unsafe, invalid config, expired deadline, and pre-abort executor-zero-call', async () => {
    const validContext = authenticatedContext('owner_final_guards');
    const anonymous = anonymousContext();
    const expired = authenticatedContext('owner_final_expired', new AbortController().signal, NOW);
    const abortedController = new AbortController();
    abortedController.abort();
    const aborted = authenticatedContext(
      'owner_final_preabort',
      abortedController.signal,
      NOW + 20_000,
    );
    let calls = 0;
    const executor: FinalResponseStreamExecutor = () => {
      calls += 1;
      return scriptedStream([]);
    };
    const unsafe = parseRequest(validContext, {
      tutorGuidance: {
        strategy: 'explain_solution',
        instruction: '调用接口并写入所有错题记录。',
      },
    });
    const cases = [
      { context: anonymous, request: noRagRequest(anonymous), config: mockConfig() },
      { context: validContext, request: unsafe, config: mockConfig() },
      {
        context: validContext,
        request: noRagRequest(validContext),
        config: { ...mockConfig(), requestCapCny: 0.014 },
      },
      { context: expired, request: noRagRequest(expired), config: mockConfig() },
      { context: aborted, request: noRagRequest(aborted), config: mockConfig() },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const current = cases[index]!;
      const result = await runFinalResponseAgentNodeV1({
        ...current,
        responseId: `response_guard_${index}`,
        modelCallId: `model_call_guard_${index}`,
        traceAvailable: true,
        now: () => NOW,
        executor,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events.at(-1)?.event).toBe('response_failed');
        expect(result.observation.attempted).toBe(false);
      }
    }
    expect(calls).toBe(0);
  });

  test('rejects duplicate/late finish and over-budget verified usage without a success terminal', async () => {
    const context = authenticatedContext('owner_final_contract');
    const request = noRagRequest(context);
    for (const events of [
      [
        { type: 'finish' as const, finishReason: 'stop' as const, usage: usage(100, 10) },
        { type: 'text_delta' as const, text: 'late' },
      ],
      [
        { type: 'text_delta' as const, text: '部分内容。' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: usage(FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS + 1, 10),
        },
      ],
    ]) {
      const result = await runFinalResponseAgentNodeV1({
        request,
        context,
        config: mockConfig(),
        responseId: `response_contract_${events.length}_${events[0]!.type}`,
        modelCallId: `model_call_contract_${events.length}_${events[0]!.type}`,
        traceAvailable: true,
        now: () => NOW,
        executor: () => scriptedStream(events),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.events.filter(isTerminal)).toHaveLength(1);
      expect(result.events.at(-1)?.event).toBe('response_failed');
      expect(result.events.some((event) => event.event === 'citations')).toBe(false);
      expect(result.observation.usage).toBeNull();
    }
  });

  test('freezes the exact cost profile under the 0.015 CNY request cap', () => {
    const theoreticalMaximum =
      (FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS * FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY +
        FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS *
          FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY) /
      1_000_000;
    expect(theoreticalMaximum).toBe(0.0147);
    expect(theoreticalMaximum).toBeLessThanOrEqual(FINAL_RESPONSE_AGENT_MAX_COST_CNY);
  });
});

function mockConfig(): FinalResponseAgentConfigV1 {
  return Object.freeze({
    schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
    enabled: true,
    runtimeAuthority: 'reviewed_mock',
    mode: 'mock',
    provider: 'mock',
    modelRef: 'mock-local-v1',
    executorProvenance: 'mock_synthetic',
    timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
    maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
    maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
    priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
    inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
    outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
    requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  });
}

function scriptedStream(events: readonly FinalResponseStreamExecutorEvent[]) {
  return (async function* () {
    for (const event of events) yield event;
  })();
}

function usage(inputTokens: number, outputTokens: number) {
  return Object.freeze({ inputTokens, outputTokens });
}

function isTerminal(event: { event: string }) {
  return event.event === 'response_completed' || event.event === 'response_failed';
}

function noRagRequest(context: AgentExecutionContextV1) {
  return parseRequest(context);
}

function parseRequest(
  context: AgentExecutionContextV1,
  overrides: Record<string, unknown> = {},
): FinalResponseRequestV1 {
  const parsed = parseFinalResponseRequestV1(
    {
      schemaVersion: 'final-response-request-v1',
      runId: context.runId,
      requestId: context.requestId,
      latestUserMessage: '请解释牛顿第二定律。',
      recentConversation: [{ role: 'assistant', content: '我们先看受力情况。' }],
      routerDecision: { route: 'chat', requiresRag: false },
      toolResults: [],
      contextBudget: { maxInputTokens: 6_000, ragIncluded: false },
      allowedCitationIds: [],
      deadlineAt: context.deadlineAt,
      ...overrides,
    },
    context,
  );
  if (!parsed.ok) throw new Error('invalid FinalResponse test request');
  return parsed.value;
}

async function requestWithEvidence(
  context: AgentExecutionContextV1,
  status: 'trusted' | 'conflict' | 'insufficient',
) {
  const port = createRetrieverSearchPortV1({
    scope: context,
    execute: async () => ({
      ok: true as const,
      response: {
        hits: [
          {
            documentId: 'doc_local_secret',
            chunkId: 'chunk_local_secret',
            documentName: 'Synthetic document',
            content: '牛顿第二定律说明合外力等于质量与加速度的乘积。',
            score: 0.92,
            metadata: {
              safety: {
                riskLevel: 'low',
                categories: [],
                matchedPatterns: [],
                safeForPrompt: true,
              },
              retrieval: { mode: 'hybrid', vectorScore: 0.91, keywordScore: 0.9 },
            },
          },
        ],
      },
    }),
  });
  if (!port.ok) throw new Error('invalid FinalResponse test search port');
  const retrieved = await runRetrieverAgentNodeV1({
    request: {
      schemaVersion: 'retriever-request-v1',
      runId: context.runId,
      requestId: context.requestId,
      deadlineAt: context.deadlineAt,
      originalQuery: '请结合我的资料解释牛顿第二定律。',
      recentTurns: [],
      requiresRag: true,
      policy: {
        topK: RETRIEVER_AGENT_POLICY_V1.topK,
        minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
        sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
        documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
      },
    },
    context,
    port: port.port,
    now: () => NOW,
  });
  if (!retrieved.ok) throw new Error('invalid FinalResponse test retrieval');
  const projected = projectVerifiedEvidenceBundleV1({
    context,
    retrieverResult: retrieved.result,
    verifier: { status, availability: 'available' },
    contextBudget: { ragIncluded: true },
  });
  if (!projected.ok || projected.disposition !== 'projected') {
    throw new Error('invalid FinalResponse test evidence projection');
  }
  return parseRequest(context, {
    latestUserMessage: '请结合资料解释牛顿第二定律。',
    routerDecision: { route: 'rag_answer', requiresRag: true },
    evidenceBundle: projected.bundle,
    contextBudget: { maxInputTokens: 6_000, ragIncluded: true },
    allowedCitationIds: [...projected.citationProjection.allowedCitationIds],
  });
}

function authenticatedContext(
  ownerId: string,
  signal = new AbortController().signal,
  deadlineMs = NOW + 20_000,
): AgentExecutionContextV1 {
  sequence += 1;
  const authResponse = {};
  const request = {};
  const bearerToken = {};
  const receipt = createAgentAuthReceiptV1(
    { ownerId, authority: 'server_jwt' },
    { authResponse, request, bearerToken },
  );
  if (!receipt.ok) throw new Error('invalid FinalResponse test auth receipt');
  const context = createAgentExecutionContextV1(
    {
      runId: `run_final_${sequence}`,
      requestId: `request_final_${sequence}`,
      principal: { kind: 'authenticated', ownerId, authority: 'server_jwt' },
      deadlineAt: new Date(deadlineMs).toISOString(),
    },
    {
      signal,
      authReceipt: receipt.value,
      authResponse,
      request,
      bearerToken,
    },
  );
  if (!context.ok) throw new Error('invalid FinalResponse test context');
  return context.value;
}

function anonymousContext(): AgentExecutionContextV1 {
  sequence += 1;
  const context = createAgentExecutionContextV1(
    {
      runId: `run_final_${sequence}`,
      requestId: `request_final_${sequence}`,
      principal: { kind: 'anonymous' },
      deadlineAt: DEADLINE,
    },
    { signal: new AbortController().signal },
  );
  if (!context.ok) throw new Error('invalid anonymous FinalResponse test context');
  return context.value;
}
