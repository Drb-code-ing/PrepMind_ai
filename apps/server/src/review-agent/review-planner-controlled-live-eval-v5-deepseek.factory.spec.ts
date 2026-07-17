import type { StructuredModelExecutor } from '@repo/ai';
import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  DEEPSEEK_V4_PRO_V5_PRICING,
  createReviewPlannerControlledLiveV5DeepSeekEvaluator,
  resolveReviewPlannerControlledLiveV5DeepSeekPricing,
  validateReviewPlannerControlledLiveV5DeepSeekPreflight,
} from './review-planner-controlled-live-eval-v5-deepseek.factory';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v5-private-test-key',
});

describe('Review/Planner controlled Live V5 DeepSeek evaluator', () => {
  it('closes the exact old V5 environment at preflight after V6 transport binding without constructing an executor', () => {
    const createExecutor = jest.fn((): StructuredModelExecutor => {
      throw new Error('V5 executor must not be constructed');
    });

    const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
      env,
      {
        createExecutor,
      },
    );

    expect(evaluator).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(validateReviewPlannerControlledLiveV5DeepSeekPreflight(env)).toEqual(
      {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      },
    );
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
  ])(
    'rejects a gate, model, or base mismatch before constructing V5 executor: %o',
    (override) => {
      const createExecutor = jest.fn((): StructuredModelExecutor => {
        throw new Error('V5 executor must not be constructed');
      });
      const actual = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
        { ...env, ...override },
        { createExecutor },
      );

      expect(actual).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(
        validateReviewPlannerControlledLiveV5DeepSeekPreflight({
          ...env,
          ...override,
        }),
      ).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(createExecutor).not.toHaveBeenCalled();
    },
  );

  it('resolves the frozen CNY price profile without placing it in the USD trace contract', () => {
    expect(resolveReviewPlannerControlledLiveV5DeepSeekPricing()).toEqual({
      currency: 'CNY',
      nonCachedInputCnyPerMillionTokens: 3,
      outputCnyPerMillionTokens: 6,
      hardCapCny: 1,
      maxPairedProviderAttempts: 22,
      maxProviderAttempts: 23,
      reservedInputTokens: 42_996,
      reservedOutputTokens: 9_712,
      reservedCostCny: 0.18726,
    });
    expect(
      resolveReviewPlannerControlledLiveV5DeepSeekPricing({
        ...DEEPSEEK_V4_PRO_V5_PRICING,
        outputCnyPerMillionTokens: 7,
      }),
    ).toBeNull();
  });
});
