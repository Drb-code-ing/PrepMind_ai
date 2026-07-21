import type { StructuredModelExecutor } from '@repo/ai';
import { KNOWLEDGE_DEDUP_MODEL_SCHEMA } from '@repo/agent/model-candidates';

import { reserveKnowledgeCandidateBudgets } from './knowledge-model-config';
import { createKnowledgeModelRuntimes } from './knowledge-model-runtime.factory';

describe('knowledge model runtime factory', () => {
  it('creates one DeepSeek V4 Pro non-thinking JSON executor with no retry-capable transport mode', async () => {
    const executor = jest
      .fn<
        ReturnType<StructuredModelExecutor>,
        Parameters<StructuredModelExecutor>
      >()
      .mockResolvedValue({
        object: { decisions: [] },
        usage: { inputTokens: 20, outputTokens: 5 },
      });
    const createExecutor = jest.fn(() => executor);
    const bundle = createKnowledgeModelRuntimes(validLiveEnv(), {
      createExecutor,
    });
    const budgets = reserveKnowledgeCandidateBudgets();
    expect(budgets).not.toBeNull();

    const result = await bundle.dedupRuntime.invokeStructured(
      requestFixture(budgets!.dedupBudget),
    );

    expect(result.ok).toBe(true);
    expect(createExecutor).toHaveBeenCalledTimes(1);
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'test-deepseek-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });
    const executorInput = executor.mock.calls[0]?.[0];
    expect(executorInput?.maxOutputTokens).toBe(500);
    expect(executorInput?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not create or invoke an executor when credentials or gates are missing', () => {
    const executor = jest.fn();
    const createExecutor = jest.fn(() => executor as StructuredModelExecutor);
    const bundle = createKnowledgeModelRuntimes(
      {
        ...validLiveEnv(),
        DEEPSEEK_API_KEY: '',
      },
      { createExecutor },
    );

    expect(bundle.config).toMatchObject({
      dedupEnabled: false,
      organizerEnabled: false,
      mode: 'mock',
    });
    expect(createExecutor).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });

  it('fails closed when provider usage is missing or zero', async () => {
    for (const usage of [undefined, { inputTokens: 0, outputTokens: 0 }]) {
      const executor: StructuredModelExecutor = jest.fn().mockResolvedValue({
        object: { decisions: [] },
        ...(usage ? { usage } : {}),
      });
      const bundle = createKnowledgeModelRuntimes(validLiveEnv(), {
        createExecutor: () => executor,
      });
      const budgets = reserveKnowledgeCandidateBudgets();
      const result = await bundle.dedupRuntime.invokeStructured(
        requestFixture(budgets!.dedupBudget),
      );

      expect(result.ok).toBe(false);
    }
  });

  it('propagates request abort to the in-flight executor without retry', async () => {
    let executorSignal: AbortSignal | undefined;
    const executor: StructuredModelExecutor = jest.fn(
      ({ signal }) =>
        new Promise(() => {
          executorSignal = signal;
        }),
    );
    const bundle = createKnowledgeModelRuntimes(validLiveEnv(), {
      createExecutor: () => executor,
    });
    const budgets = reserveKnowledgeCandidateBudgets();
    const controller = new AbortController();
    const pending = bundle.organizerRuntime.invokeStructured({
      ...requestFixture(budgets!.organizerBudget),
      task: 'knowledge_organizer',
      maxOutputTokens: 700,
      signal: controller.signal,
    });

    controller.abort();
    const result = await pending;

    expect(result).toMatchObject({ ok: false, error: { code: 'ABORTED' } });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executorSignal?.aborted).toBe(true);
  });
});

function requestFixture(
  budget: ReturnType<typeof reserveKnowledgeCandidateBudgets> extends infer R
    ? NonNullable<R>['dedupBudget']
    : never,
) {
  return {
    runId: 'knowledge-runtime-test',
    task: 'knowledge_dedup' as const,
    schema: KNOWLEDGE_DEDUP_MODEL_SCHEMA,
    systemPrompt: 'Return strict JSON.',
    userPrompt: '{"documents":[]}',
    estimatedInputTokens: 100,
    maxOutputTokens: 500,
    budget,
  };
}

function validLiveEnv(): Record<string, unknown> {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: true,
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: true,
    KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: 4500,
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 4500,
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: 'test-deepseek-key',
  };
}
