/* eslint-disable @typescript-eslint/unbound-method */
import {
  createModelAgentRuntime,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  runBudgetedStage,
  type AgentBudgetPort,
} from '@repo/agent/chat-run-budget';
import type {
  ChatRunBudgetReservationRequest,
  ChatRunBudgetUsage,
} from '@repo/types';

import { ChatRunBudgetStageRunner } from './chat-run-budget-stage-runner';
import {
  ChatVerifierStageService,
  createChatVerifierStageRuntime,
} from './chat-verifier-stage';

const input = {
  ownerId: 'owner_1',
  turnId: 'turn_1',
  policyVersion: 'chat-v1',
  attempt: 1,
  query: '这份资料能否可靠支持当前学习结论？',
  chunks: [
    {
      documentId: 'doc_1',
      documentTitle: 'Notes',
      chunkId: 'chunk_1',
      score: 0.9,
      content: '这条推导可能有误，使用之前需要重新检查计算过程。',
    },
  ],
};

function harness(
  execute: StructuredModelExecutor,
  enabled = true,
  timeoutMs = 500,
) {
  let reservation: ChatRunBudgetReservationRequest;
  const reserve = jest.fn((request: ChatRunBudgetReservationRequest) => {
    reservation = request;
    return Promise.resolve({ id: request.reservationId } as never);
  });
  const transition = () =>
    Promise.resolve({ kind: 'updated', reservation: {} as never } as const);
  const settle = jest.fn(
    (_owner: string, _id: string, usage: ChatRunBudgetUsage) => {
      if (
        usage.inputTokens > reservation.inputTokens ||
        usage.outputTokens > reservation.outputTokens ||
        usage.costMicros > reservation.costMicros
      ) {
        return Promise.resolve({
          kind: 'conflict',
          reservation: {} as never,
        } as const);
      }
      return transition();
    },
  );
  const port: AgentBudgetPort = {
    reserve,
    settle,
    dispatch: jest.fn(transition),
    uncertain: jest.fn(transition),
    release: jest.fn(transition),
    settleUncertain: jest.fn(transition),
  };
  const runner = {
    forTurn: jest.fn(() =>
      Promise.resolve({
        run: <T>(
          stage: ChatRunBudgetReservationRequest['stage'],
          usage: ChatRunBudgetUsage,
          callback: () => Promise<{ value: T; usage: ChatRunBudgetUsage }>,
        ) =>
          runBudgetedStage(
            port,
            {
              ownerId: input.ownerId,
              turnId: input.turnId,
              ledgerId: 'ledger_1',
              reservationId: 'verifier:turn_1:1',
              stage,
              ...usage,
            },
            callback,
          ),
      }),
    ),
  };
  const executor = jest.fn(execute);
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs,
    executor,
  });
  return {
    port,
    reserve,
    settle,
    executor,
    runner,
    service: new ChatVerifierStageService(
      runner as unknown as ChatRunBudgetStageRunner,
      { enabled, runtime },
    ),
  };
}

const success: StructuredModelExecutor = () =>
  Promise.resolve({
    object: { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] },
    usage: { inputTokens: 200, outputTokens: 30 },
  });

describe('ChatVerifierStageService ledger boundary (synthetic executor, no network)', () => {
  it('settles actual successful usage in CNY micros and binds the turn', async () => {
    const h = harness(success);
    const result = await h.service.run(input);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.degraded).toBe(false);
    expect(h.runner.forTurn).toHaveBeenCalledWith(
      'owner_1',
      'turn_1',
      'chat-v1',
      1,
    );
    expect(h.executor).toHaveBeenCalledTimes(1);
    expect(h.settle).toHaveBeenCalledWith('owner_1', 'verifier:turn_1:1', {
      inputTokens: 200,
      outputTokens: 30,
      costMicros: 780,
    });
    expect(h.port.uncertain).not.toHaveBeenCalled();
  });

  it.each([
    ['gate off', { ...input }, false],
    ['empty', { ...input, chunks: [] }, true],
    [
      'unsafe',
      {
        ...input,
        chunks: [
          {
            ...input.chunks[0],
            metadata: {
              safety: { riskLevel: 'high' as const, safeForPrompt: false },
            },
          },
        ],
      },
      true,
    ],
    ['already aborted', { ...input, signal: AbortSignal.abort() }, true],
  ])('does not reserve or invoke for %s', async (_name, request, enabled) => {
    const h = harness(success, enabled);
    const result = await h.service.run(request);
    expect(result.observation.attempted).toBe(false);
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.executor).not.toHaveBeenCalled();
  });

  it.each([
    ['provider failure', () => Promise.reject(new Error('synthetic failure'))],
    [
      'invalid schema',
      () =>
        Promise.resolve({
          object: { status: 'unrecognised' },
          usage: { inputTokens: 200, outputTokens: 30 },
        }),
    ],
    [
      'invalid usage',
      () =>
        Promise.resolve({
          object: { status: 'trusted', evidenceCodes: ['consistent_support'] },
          usage: { inputTokens: 0, outputTokens: 0 },
        }),
    ],
    [
      'over-cap usage',
      () =>
        Promise.resolve({
          object: { status: 'trusted', evidenceCodes: ['consistent_support'] },
          usage: { inputTokens: 2_000, outputTokens: 450 },
        }),
    ],
  ] satisfies [string, StructuredModelExecutor][])(
    'holds uncertain budget after %s',
    async (_name, executor) => {
      const h = harness(executor);
      const result = await h.service.run(input);
      expect(result.degraded).toBe(true);
      expect(result.result.status).not.toBe('trusted');
      expect(h.port.uncertain).toHaveBeenCalledWith(
        'owner_1',
        'verifier:turn_1:1',
      );
      expect(h.settle).not.toHaveBeenCalled();
      expect(h.port.release).not.toHaveBeenCalled();
    },
  );

  it('retains a hold when the executor ignores a timeout', async () => {
    const h = harness(() => new Promise(() => undefined), true, 50);
    const result = await h.service.run(input);
    expect(result.observation.disposition).toBe('fallback_timeout');
    expect(h.port.uncertain).toHaveBeenCalledTimes(1);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it('retains a hold for cancellation after dispatch', async () => {
    const controller = new AbortController();
    const h = harness(() => {
      controller.abort();
      return new Promise(() => undefined);
    });
    const result = await h.service.run({ ...input, signal: controller.signal });
    expect(result.observation.disposition).toBe('fallback_aborted');
    expect(h.port.uncertain).toHaveBeenCalledTimes(1);
    expect(h.settle).not.toHaveBeenCalled();
  });

  it('fails closed before the provider when reservation is denied', async () => {
    const h = harness(success);
    h.reserve.mockRejectedValueOnce(new Error('Chat run budget exhausted'));
    await expect(h.service.run(input)).rejects.toThrow('budget exhausted');
    expect(h.executor).not.toHaveBeenCalled();
    expect(h.port.uncertain).not.toHaveBeenCalled();
  });

  it('does not swallow the losing dispatch permit', async () => {
    const h = harness(success);
    h.port.dispatch = () =>
      Promise.resolve({
        kind: 'conflict',
        reservation: { status: 'DISPATCHED' } as never,
      });
    await expect(h.service.run(input)).rejects.toThrow('already dispatched');
    expect(h.executor).not.toHaveBeenCalled();
    expect(h.port.release).not.toHaveBeenCalled();
  });
});

describe('Verifier runtime configuration', () => {
  it.each([
    {},
    { AI_PROVIDER_MODE: 'live', AI_ENABLE_LIVE_CALLS: false },
    {
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      KNOWLEDGE_VERIFIER_MODEL_ENABLED: false,
    },
    {
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      KNOWLEDGE_VERIFIER_MODEL_ENABLED: true,
      KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'synthetic',
      AI_BASE_URL: 'http://api.deepseek.com/v1',
    },
  ])('keeps incomplete or non-HTTPS configuration disabled', (env) => {
    expect(createChatVerifierStageRuntime(env).enabled).toBe(false);
  });
});
