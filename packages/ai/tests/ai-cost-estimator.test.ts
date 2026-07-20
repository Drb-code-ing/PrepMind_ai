import { describe, expect, it } from 'bun:test';

import { estimateAiCost, resolveModelPricing } from '../src/index';

describe('AI cost estimator', () => {
  it('uses the governed DeepSeek controlled-Live USD snapshot', () => {
    expect(resolveModelPricing('deepseek-v4-flash')).toEqual({
      inputPerMillion: 0.147119403,
      outputPerMillion: 0.294238805,
      known: true,
    });
    expect(
      estimateAiCost({
        model: 'deepseek-v4-flash',
        inputTokens: 949,
        outputTokens: 1200,
      }),
    ).toEqual({
      pricingKnown: true,
      inputCostEstimate: 0.00014,
      outputCostEstimate: 0.000353,
      totalCostEstimate: 0.000493,
    });
  });

  it('fails closed for unknown model pricing', () => {
    expect(
      estimateAiCost({
        model: 'unknown-model',
        inputTokens: 1000,
        outputTokens: 2000,
      }),
    ).toEqual({
      pricingKnown: false,
      inputCostEstimate: 0,
      outputCostEstimate: 0,
      totalCostEstimate: 0,
    });
  });
});
