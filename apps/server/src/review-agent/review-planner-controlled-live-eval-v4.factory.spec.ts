import type { ModelAgentResult, StructuredModelExecutor } from '@repo/ai';
import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  createReviewPlannerControlledLiveV4Evaluator,
  mapV4ControlledLiveStructuredOutputStage,
  validateReviewPlannerControlledLiveV4Preflight,
} from './review-planner-controlled-live-eval-v4.factory';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v4-factory-private-key',
});

describe('review planner controlled Live v4 evaluator', () => {
  it('constructs a private V4 executor only after the closed-gate preflight and accounts for a positive-usage canary once', async () => {
    const executor: StructuredModelExecutor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 12, outputTokens: 4 },
      }),
    );
    const createExecutor = jest.fn(() => executor);

    const evaluator = createReviewPlannerControlledLiveV4Evaluator(env, {
      createExecutor,
      isPricingKnown: () => true,
    });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected v4 evaluator');
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'v4-factory-private-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
    });
    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('turns a rejecting private fetch/executor into one safe attempted transport closure without retaining the raw canary', async () => {
    const rawCanary = 'RAW_V4_PRIVATE_FETCH_REJECTION_CANARY';
    const executor: StructuredModelExecutor = jest.fn(() =>
      Promise.reject(new Error(rawCanary)),
    );
    const evaluator = createReviewPlannerControlledLiveV4Evaluator(env, {
      createExecutor: () => executor,
      isPricingKnown: () => true,
    });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected v4 evaluator');
    const diagnostic = await evaluator.value.runDiagnostic();

    expect(diagnostic).toEqual({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
    expect(JSON.stringify(diagnostic)).not.toContain(rawCanary);
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
    { AI_MODEL: 'other-model' },
  ])('fails v4 preflight before executor construction for %o', (override) => {
    const createExecutor = jest.fn();
    expect(
      createReviewPlannerControlledLiveV4Evaluator(
        { ...env, ...override },
        { createExecutor, isPricingKnown: () => true },
      ),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(createExecutor).not.toHaveBeenCalled();
    expect(
      validateReviewPlannerControlledLiveV4Preflight(
        { ...env, ...override },
        { isPricingKnown: () => true },
      ),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
  });

  it('maps the fixed stage only when trusted error and trace boundaries agree', () => {
    expect(
      mapV4ControlledLiveStructuredOutputStage(structuredOutputFailure()),
    ).toBe('provider_json_parse');
    expect(
      mapV4ControlledLiveStructuredOutputStage(
        structuredOutputFailure({ traceCategory: 'transport' }),
      ),
    ).toBeUndefined();
  });
});

function structuredOutputFailure(
  override: Readonly<{ traceCategory?: 'transport' }> = {},
): ModelAgentResult<never> {
  return {
    ok: false,
    error: {
      code: 'PROVIDER_ERROR',
      message: 'safe error',
      retryable: false,
      providerFailureCategory: 'structured_output',
    },
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 96,
      usedInputTokens: 96,
      maxOutputTokens: 32,
      usedOutputTokens: 32,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash: `sha256:${'0'.repeat(64)}`,
      task: 'review_suggestion',
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      status: 'failed',
      inputTokens: 0,
      outputTokens: 0,
      maxOutputTokens: 32,
      durationMs: 1,
      degraded: true,
      errorCode: 'PROVIDER_ERROR',
      providerFailureCategory: override.traceCategory ?? 'structured_output',
      structuredOutputStage: 'provider_json_parse',
    },
  };
}
