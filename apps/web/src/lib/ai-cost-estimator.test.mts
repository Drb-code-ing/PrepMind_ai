import assert from 'node:assert/strict';

import { estimateAiCost, resolveModelPricing } from './ai-cost-estimator.ts';

assert.deepEqual(resolveModelPricing('mock-prepmind-chat'), {
  inputPerMillion: 0,
  outputPerMillion: 0,
  known: true,
});

assert.deepEqual(resolveModelPricing('deepseek-v4-flash'), {
  inputPerMillion: 0.147119403,
  outputPerMillion: 0.294238805,
  known: true,
});

assert.deepEqual(
  estimateAiCost({
    model: 'deepseek-v4-flash',
    inputTokens: 949,
    outputTokens: 1200,
  }),
  {
    pricingKnown: true,
    inputCostEstimate: 0.00014,
    outputCostEstimate: 0.000353,
    totalCostEstimate: 0.000493,
  },
);

assert.equal(resolveModelPricing('unknown-model').known, false);

assert.equal(
  estimateAiCost({
    model: 'mock-prepmind-chat',
    inputTokens: 1000,
    outputTokens: 2000,
  }).totalCostEstimate,
  0,
);

assert.equal(
  estimateAiCost({
    model: 'unknown-model',
    inputTokens: 1000,
    outputTokens: 2000,
  }).pricingKnown,
  false,
);
