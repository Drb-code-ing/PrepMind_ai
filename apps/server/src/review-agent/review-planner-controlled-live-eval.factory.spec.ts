import type { StructuredModelExecutor } from '@repo/ai';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  createReviewPlannerControlledLiveEvaluator,
  mapControlledLiveDiagnosticCode,
} from './review-planner-controlled-live-eval.factory';

const liveDiagnosticEnv = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'factory-private-canary',
});

describe('review planner controlled Live evaluator factory', () => {
  it('creates one JSON-object executor and runs a fact-free schema canary once', async () => {
    const executor: StructuredModelExecutor = jest.fn((input) => {
      expect(input.systemPrompt).not.toMatch(/factory-private-canary/i);
      expect(input.userPrompt).toBe('{"probe":"schema_canary_v1"}');
      return Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 12, outputTokens: 4 },
      });
    });
    const createExecutor = jest.fn(() => executor);

    const evaluator = createReviewPlannerControlledLiveEvaluator(
      liveDiagnosticEnv,
      { createExecutor, isPricingKnown: () => true },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected enabled evaluator');
    expect(JSON.stringify(evaluator)).not.toMatch(
      /factory-private-canary|api\.deepseek\.com/i,
    );
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'factory-private-canary',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'json_object',
    });

    const first = await evaluator.value.runDiagnostic();
    const second = await evaluator.value.runDiagnostic();

    expect(first).toEqual({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(second).toEqual(first);
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'missing exact confirmation gate',
      { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'false' },
    ],
    ['mock mode', { AI_PROVIDER_MODE: 'mock' }],
    ['global gate disabled', { AI_ENABLE_LIVE_CALLS: 'false' }],
    ['review production gate enabled', { REVIEW_AGENT_MODEL_ENABLED: 'true' }],
    [
      'planner production gate enabled',
      { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    ],
    ['unknown model price', { AI_MODEL: 'unknown-model-v1' }],
  ])('fails closed before executor construction for %s', (_name, override) => {
    const createExecutor = jest.fn();
    const evaluator = createReviewPlannerControlledLiveEvaluator(
      { ...liveDiagnosticEnv, ...override },
      {
        createExecutor,
        isPricingKnown: (model) => model === 'deepseek-v4-flash',
      },
    );

    expect(evaluator).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it('maps an invalid schema canary to a closed attempted diagnostic without retrying', async () => {
    const executor: StructuredModelExecutor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: ['wrong'], diagnosis: 'review_pressure' },
        usage: { inputTokens: 12, outputTokens: 4 },
      }),
    );
    const evaluator = createReviewPlannerControlledLiveEvaluator(
      liveDiagnosticEnv,
      { createExecutor: () => executor, isPricingKnown: () => true },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected enabled evaluator');

    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
    });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['http_auth', ReviewPlannerDiagnosticCode.HttpAuth],
    ['http_rate_limit', ReviewPlannerDiagnosticCode.HttpRateLimit],
    ['http_client', ReviewPlannerDiagnosticCode.HttpClient],
    ['http_server', ReviewPlannerDiagnosticCode.HttpServer],
    ['structured_output', ReviewPlannerDiagnosticCode.StructuredOutput],
    ['invalid_response', ReviewPlannerDiagnosticCode.InvalidResponse],
    ['transport', ReviewPlannerDiagnosticCode.Transport],
    ['unknown', ReviewPlannerDiagnosticCode.Transport],
  ] as const)(
    'maps provider category %s to the fixed safe enum',
    (category, expected) => {
      expect(
        mapControlledLiveDiagnosticCode({
          errorCode: 'PROVIDER_ERROR',
          providerFailureCategory: category,
        }),
      ).toBe(expected);
    },
  );
});
