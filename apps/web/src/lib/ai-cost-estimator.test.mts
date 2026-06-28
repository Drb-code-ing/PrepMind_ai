import assert from 'node:assert/strict';

import { estimateAiCost, resolveModelPricing } from './ai-cost-estimator.ts';

assert.deepEqual(resolveModelPricing('mock-prepmind-chat'), {
  inputPerMillion: 0,
  outputPerMillion: 0,
  known: true,
});

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
