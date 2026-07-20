import type {
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';

import { createReviewPlannerModelRuntimes } from './review-planner-model-runtime.factory';

describe('review planner model runtime factory', () => {
  const enabledEnv = {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    REVIEW_AGENT_MODEL_ENABLED: true,
    PLANNER_AGENT_MODEL_ENABLED: false,
    AI_MODEL: 'deepseek-v4-flash',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: 'private-review-key',
    REVIEW_AGENT_MODEL_TIMEOUT_MS: 4100,
    PLANNER_AGENT_MODEL_TIMEOUT_MS: 4300,
  };

  it('creates a JSON-object executor only for an effective live gate and never exposes its credential', () => {
    const executor: StructuredModelExecutor = () =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
      });
    const createExecutor = jest.fn(() => executor);

    const bundle = createReviewPlannerModelRuntimes(enabledEnv, {
      createExecutor,
    });

    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'private-review-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'json_object',
    });
    expect(bundle.config).toMatchObject({
      reviewEnabled: true,
      plannerEnabled: false,
      mode: 'live',
      provider: 'deepseek',
      reviewTimeoutMs: 4100,
      plannerTimeoutMs: 4300,
    });
    expect(JSON.stringify(bundle)).not.toMatch(
      /private-review-key|api\.deepseek\.com/i,
    );
  });

  it.each([
    {
      label: 'absent',
      gates: {
        REVIEW_AGENT_MODEL_ENABLED: undefined,
        PLANNER_AGENT_MODEL_ENABLED: undefined,
      },
    },
    {
      label: 'false',
      gates: {
        REVIEW_AGENT_MODEL_ENABLED: false,
        PLANNER_AGENT_MODEL_ENABLED: false,
      },
    },
  ])(
    'creates no executor when both V4 Pro business gates are $label even if the V7 eval gate is true',
    ({ gates }) => {
      const createExecutor = jest.fn<
        StructuredModelExecutor,
        [OpenAICompatibleExecutorConfig]
      >(
        () => () =>
          Promise.resolve({
            object: { focusIndexes: [0], diagnosis: 'review_pressure' },
          }),
      );

      const bundle = createReviewPlannerModelRuntimes(
        {
          ...enabledEnv,
          ...gates,
          REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: true,
          AI_MODEL: 'deepseek-v4-pro',
        },
        { createExecutor },
      );

      expect(createExecutor).not.toHaveBeenCalled();
      expect(bundle.config).toEqual({
        reviewEnabled: false,
        plannerEnabled: false,
        reviewTimeoutMs: 4100,
        plannerTimeoutMs: 4300,
        mode: 'mock',
        provider: 'mock',
        model: 'disabled-review-planner',
      });
      expect(JSON.stringify(bundle.config)).not.toMatch(
        /private-review-key|api\.deepseek\.com/i,
      );
    },
  );

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
  ])('does not construct a V4 Pro executor for $label', (override) => {
    const createExecutor = jest.fn<
      StructuredModelExecutor,
      [OpenAICompatibleExecutorConfig]
    >();

    const bundle = createReviewPlannerModelRuntimes(
      {
        ...enabledEnv,
        AI_MODEL: 'deepseek-v4-pro',
        ...override,
      },
      { createExecutor },
    );

    expect(createExecutor).not.toHaveBeenCalled();
    expect(bundle.config).toMatchObject({
      reviewEnabled: false,
      plannerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
  });

  it('fails closed to disabled mock candidates when executor initialization fails', () => {
    const bundle = createReviewPlannerModelRuntimes(enabledEnv, {
      createExecutor: () => {
        throw new Error('private provider failure');
      },
    });

    expect(bundle.config).toMatchObject({
      reviewEnabled: false,
      plannerEnabled: false,
      mode: 'mock',
      provider: 'mock',
    });
  });
});
