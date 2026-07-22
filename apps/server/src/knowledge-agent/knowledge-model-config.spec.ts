import {
  KNOWLEDGE_DEDUP_RESERVATION,
  KNOWLEDGE_MODEL_PRICE_CNY,
  KNOWLEDGE_ORGANIZER_RESERVATION,
  KNOWLEDGE_REQUEST_BUDGET,
  estimateKnowledgeRequestCostCny,
  reserveKnowledgeCandidateBudgets,
  resolveKnowledgeLiveExecutorConfig,
  resolveKnowledgeModelConfig,
} from './knowledge-model-config';

describe('knowledge model config', () => {
  it('defaults both gates off and timeouts to 4500ms', () => {
    expect(resolveKnowledgeModelConfig({})).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      dedupTimeoutMs: 4500,
      organizerTimeoutMs: 4500,
      mode: 'mock',
      provider: 'mock',
      model: 'deepseek-v4-pro',
      promptVersion: 'knowledge-agents-v1',
      pricingKnown: true,
    });
  });

  it('requires the global live gates, exact component gates, credential, and known price', () => {
    expect(resolveKnowledgeModelConfig(validLiveEnv())).toMatchObject({
      dedupEnabled: true,
      organizerEnabled: true,
      mode: 'live',
      provider: 'deepseek',
    });

    for (const override of [
      { AI_PROVIDER_MODE: 'mock' },
      { AI_ENABLE_LIVE_CALLS: false },
      { DEEPSEEK_API_KEY: '' },
      { AI_BASE_URL: 'https://untrusted.example/v1' },
    ]) {
      expect(
        resolveKnowledgeModelConfig({ ...validLiveEnv(), ...override }),
      ).toMatchObject({
        dedupEnabled: false,
        organizerEnabled: false,
        mode: 'mock',
      });
    }

    expect(
      resolveKnowledgeModelConfig(validLiveEnv(), {
        ...KNOWLEDGE_MODEL_PRICE_CNY,
        model: 'unknown-model',
      }),
    ).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      pricingKnown: false,
    });
  });

  it('treats malformed gates as false and malformed timeouts as safe defaults', () => {
    expect(
      resolveKnowledgeModelConfig({
        ...validLiveEnv(),
        KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'yes',
        KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: 1,
        KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 999,
        KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 15_001,
      }),
    ).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      dedupTimeoutMs: 4500,
      organizerTimeoutMs: 4500,
    });
  });

  it('reserves both candidate ceilings from one immutable request budget', () => {
    const before = structuredClone(KNOWLEDGE_REQUEST_BUDGET);
    const reserved = reserveKnowledgeCandidateBudgets(KNOWLEDGE_REQUEST_BUDGET);

    expect(reserved).not.toBeNull();
    expect(KNOWLEDGE_REQUEST_BUDGET).toEqual(before);
    expect(reserved?.requestBudget).toEqual({
      ...KNOWLEDGE_REQUEST_BUDGET,
      usedCalls: 2,
      usedInputTokens: 6000,
      usedOutputTokens: 1200,
    });
    expect(reserved?.dedupBudget).toMatchObject({
      maxCalls: 1,
      maxInputTokens: KNOWLEDGE_DEDUP_RESERVATION.inputTokens,
      maxOutputTokens: KNOWLEDGE_DEDUP_RESERVATION.outputTokens,
      usedCalls: 0,
      usedInputTokens: 0,
      usedOutputTokens: 0,
    });
    expect(reserved?.organizerBudget).toMatchObject({
      maxCalls: 1,
      maxInputTokens: KNOWLEDGE_ORGANIZER_RESERVATION.inputTokens,
      maxOutputTokens: KNOWLEDGE_ORGANIZER_RESERVATION.outputTokens,
    });
    expect(Object.isFrozen(reserved)).toBe(true);
    expect(Object.isFrozen(reserved?.requestBudget)).toBe(true);
    expect(Object.isFrozen(reserved?.dedupBudget)).toBe(true);
    expect(Object.isFrozen(reserved?.organizerBudget)).toBe(true);
  });

  it('fails both reservations closed when the shared budget cannot prove both ceilings', () => {
    expect(
      reserveKnowledgeCandidateBudgets({
        ...KNOWLEDGE_REQUEST_BUDGET,
        maxOutputTokens: 1199,
      }),
    ).toBeNull();
    expect(
      reserveKnowledgeCandidateBudgets({
        ...KNOWLEDGE_REQUEST_BUDGET,
        usedCalls: 1,
      }),
    ).toBeNull();
  });

  it('uses the frozen exact price and rejects unknown pricing', () => {
    expect(
      estimateKnowledgeRequestCostCny({
        inputTokens: 6000,
        outputTokens: 1200,
      }),
    ).toBe(0.0252);
    expect(
      estimateKnowledgeRequestCostCny({
        inputTokens: 6000,
        outputTokens: 1200,
      }),
    ).toBeLessThanOrEqual(KNOWLEDGE_MODEL_PRICE_CNY.requestCap);
    expect(
      estimateKnowledgeRequestCostCny(
        { inputTokens: 1, outputTokens: 1 },
        { ...KNOWLEDGE_MODEL_PRICE_CNY, inputPerMillion: 0 },
      ),
    ).toBeNull();
    expect(
      estimateKnowledgeRequestCostCny({
        inputTokens: 6001,
        outputTokens: 1200,
      }),
    ).toBeNull();
  });

  it('fails hostile env and pricing getters closed without propagating', () => {
    const hostileEnv = new Proxy(validLiveEnv(), {
      get() {
        throw new Error('secret-bearing getter body');
      },
    });
    const hostilePrice = new Proxy(KNOWLEDGE_MODEL_PRICE_CNY, {
      get() {
        throw new Error('pricing getter body');
      },
    });

    expect(() => resolveKnowledgeModelConfig(hostileEnv)).not.toThrow();
    expect(resolveKnowledgeModelConfig(hostileEnv)).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      mode: 'mock',
    });
    expect(
      resolveKnowledgeModelConfig(validLiveEnv(), hostilePrice),
    ).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      pricingKnown: false,
    });
    expect(resolveKnowledgeLiveExecutorConfig(hostileEnv)).toBeNull();
    expect(
      estimateKnowledgeRequestCostCny(
        { inputTokens: 1, outputTokens: 1 },
        hostilePrice,
      ),
    ).toBeNull();
  });
});

function validLiveEnv(): Record<string, unknown> {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: true,
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: 'test-deepseek-key',
  };
}
