import { resolveReviewPlannerModelConfig } from './review-planner-model-config';

describe('review planner model config', () => {
  it('enables only the gated live component with a matching DeepSeek credential', () => {
    const config = resolveReviewPlannerModelConfig({
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: 'true',
      REVIEW_AGENT_MODEL_ENABLED: 'true',
      PLANNER_AGENT_MODEL_ENABLED: 'false',
      AI_MODEL: 'deepseek-v4-flash',
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      DEEPSEEK_API_KEY: 'test-key',
      REVIEW_AGENT_MODEL_TIMEOUT_MS: '4200',
    });

    expect(config).toEqual({
      reviewEnabled: true,
      plannerEnabled: false,
      reviewTimeoutMs: 4200,
      plannerTimeoutMs: 4500,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    expect(JSON.stringify(config)).not.toMatch(/test-key|api\.deepseek\.com/i);
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'false' },
    { AI_BASE_URL: 'http://api.deepseek.com/v1' },
    { AI_BASE_URL: 'https://user:pass@api.deepseek.com/v1' },
    { DEEPSEEK_API_KEY: undefined },
    { AI_MODEL: 'invalid model name' },
  ])(
    'fails closed for unsafe or incomplete runtime configuration %#',
    (override) => {
      const config = resolveReviewPlannerModelConfig({
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        REVIEW_AGENT_MODEL_ENABLED: 'true',
        PLANNER_AGENT_MODEL_ENABLED: 'false',
        AI_MODEL: 'deepseek-v4-flash',
        AI_BASE_URL: 'https://api.deepseek.com/v1',
        DEEPSEEK_API_KEY: 'test-key',
        ...override,
      });

      expect(config).toMatchObject({
        reviewEnabled: false,
        plannerEnabled: false,
        mode: 'mock',
        provider: 'mock',
      });
    },
  );

  it('refuses mismatched provider credentials', () => {
    const config = resolveReviewPlannerModelConfig({
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: true,
      REVIEW_AGENT_MODEL_ENABLED: true,
      AI_BASE_URL: 'https://api.openai.com/v1',
      DEEPSEEK_API_KEY: 'wrong-provider-key',
    });

    expect(config.reviewEnabled).toBe(false);
    expect(config.mode).toBe('mock');
  });
});
