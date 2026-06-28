export type AiModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  known: boolean;
};

export type EstimateAiCostInput = {
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export type EstimateAiCostResult = {
  pricingKnown: boolean;
  inputCostEstimate: number;
  outputCostEstimate: number;
  totalCostEstimate: number;
};

const MODEL_PRICING: Record<string, Omit<AiModelPricing, 'known'>> = {
  'mock-prepmind-chat': { inputPerMillion: 0, outputPerMillion: 0 },
};

export function resolveModelPricing(model: string): AiModelPricing {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return { inputPerMillion: 0, outputPerMillion: 0, known: false };
  }

  return { ...pricing, known: true };
}

export function estimateAiCost(input: EstimateAiCostInput): EstimateAiCostResult {
  const pricing = resolveModelPricing(input.model);
  const inputTokens = normalizeTokenCount(input.inputTokens);
  const outputTokens = normalizeTokenCount(input.outputTokens);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    pricingKnown: pricing.known,
    inputCostEstimate: roundCost(inputCost),
    outputCostEstimate: roundCost(outputCost),
    totalCostEstimate: roundCost(inputCost + outputCost),
  };
}

function normalizeTokenCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
