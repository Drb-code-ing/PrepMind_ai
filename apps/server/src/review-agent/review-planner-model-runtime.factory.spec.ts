import type { StructuredModelExecutor } from '@repo/ai';

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
