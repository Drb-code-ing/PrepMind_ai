import {
  resolveReviewPlannerLiveExecutorConfig,
  resolveReviewPlannerModelConfig,
} from './review-planner-model-config';

describe('review planner model config', () => {
  const v4ProEnv = {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    REVIEW_AGENT_MODEL_ENABLED: false,
    PLANNER_AGENT_MODEL_ENABLED: false,
    AI_MODEL: 'deepseek-v4-pro',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: 'private-v4-pro-key',
  };

  it('selects the closed non-thinking transport only for exact V4 Pro /v1', () => {
    expect(resolveReviewPlannerLiveExecutorConfig(v4ProEnv)).toEqual({
      provider: 'deepseek',
      apiKey: 'private-v4-pro-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });

    const publicConfig = resolveReviewPlannerModelConfig(v4ProEnv);
    expect(publicConfig).toMatchObject({
      reviewEnabled: false,
      plannerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
    expect(JSON.stringify(publicConfig)).not.toMatch(
      /private-v4-pro-key|api\.deepseek\.com/i,
    );
  });

  it('does not accept the V7 evaluation gate as a production business gate', () => {
    const publicConfig = resolveReviewPlannerModelConfig({
      ...v4ProEnv,
      REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: true,
    });

    expect(publicConfig).toEqual({
      reviewEnabled: false,
      plannerEnabled: false,
      reviewTimeoutMs: 4_500,
      plannerTimeoutMs: 4_500,
      mode: 'mock',
      provider: 'mock',
      model: 'disabled-review-planner',
    });
    expect(JSON.stringify(publicConfig)).not.toMatch(
      /V7|private-v4-pro-key|api\.deepseek\.com/i,
    );
  });

  it('keeps V4 Flash on the generic JSON-object transport', () => {
    expect(
      resolveReviewPlannerLiveExecutorConfig({
        ...v4ProEnv,
        AI_MODEL: 'deepseek-v4-flash',
      }),
    ).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'json_object',
    });
  });

  it.each([
    { label: 'trailing slash', AI_BASE_URL: 'https://api.deepseek.com/v1/' },
    { label: 'explicit port', AI_BASE_URL: 'https://api.deepseek.com:443/v1' },
    { label: 'query', AI_BASE_URL: 'https://api.deepseek.com/v1?source=test' },
    {
      label: 'wrong DeepSeek host',
      AI_BASE_URL: 'https://beta.deepseek.com/v1',
    },
    {
      label: 'wrong provider credential',
      DEEPSEEK_API_KEY: undefined,
      OPENAI_API_KEY: 'openai-key',
    },
    { label: 'schema profiles', schemaProfiles: [] },
    {
      label: 'non-thinking audit callback',
      onNonThinkingAudit: () => undefined,
    },
  ])('fails closed for V4 Pro $label', (override) => {
    expect(
      resolveReviewPlannerLiveExecutorConfig({ ...v4ProEnv, ...override }),
    ).toBeNull();
  });

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

  it.each([
    ['DeepSeek', { DEEPSEEK_API_KEY: 'only-deepseek-key' }],
    ['OpenAI', { OPENAI_API_KEY: 'only-openai-key' }],
  ])(
    'fails closed for an unallowlisted HTTPS host with only a %s credential',
    (_provider, credential) => {
      const config = resolveReviewPlannerModelConfig({
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: true,
        REVIEW_AGENT_MODEL_ENABLED: true,
        PLANNER_AGENT_MODEL_ENABLED: true,
        AI_MODEL: 'deepseek-v4-flash',
        AI_BASE_URL: 'https://unexpected.example/v1',
        ...credential,
      });

      expect(config).toMatchObject({
        reviewEnabled: false,
        plannerEnabled: false,
        mode: 'mock',
        provider: 'mock',
      });
    },
  );
});
