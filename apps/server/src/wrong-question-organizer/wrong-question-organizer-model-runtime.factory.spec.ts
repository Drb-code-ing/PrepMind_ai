import { WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA } from '@repo/agent/model-candidates';
import type { StructuredModelExecutor } from '@repo/ai';

import { reserveWrongQuestionOrganizerCandidateBudget } from './wrong-question-organizer-model-config';
import { createWrongQuestionOrganizerModelRuntime } from './wrong-question-organizer-model-runtime.factory';

describe('wrong-question organizer model runtime factory', () => {
  it('creates one fixed DeepSeek executor and passes the bounded request', async () => {
    const executor = jest
      .fn<
        ReturnType<StructuredModelExecutor>,
        Parameters<StructuredModelExecutor>
      >()
      .mockResolvedValue({
        object: {
          decisions: [
            {
              questionIndex: 0,
              subject: 'math',
              deck: { action: 'create_topic', topicLabel: '函数极限' },
              confidence: 'high',
              evidenceCodes: ['semantic_topic'],
            },
          ],
        },
        usage: { inputTokens: 20, outputTokens: 5 },
      });
    const createExecutor = jest.fn(() => executor);
    const bundle = createWrongQuestionOrganizerModelRuntime(validLiveEnv(), {
      createExecutor,
    });
    const reserved = reserveWrongQuestionOrganizerCandidateBudget();
    expect(reserved).not.toBeNull();

    const result = await bundle.runtime.invokeStructured({
      runId: 'organizer-runtime-test',
      task: 'wrong_question_organization',
      schema: WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
      systemPrompt: 'Return strict JSON.',
      userPrompt: '{"questions":[]}',
      estimatedInputTokens: 100,
      maxOutputTokens: 800,
      budget: reserved!.candidateBudget,
    });

    expect(result.ok).toBe(true);
    expect(createExecutor).toHaveBeenCalledTimes(1);
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'synthetic-organizer-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor.mock.calls[0]?.[0].maxOutputTokens).toBe(800);
    expect(executor.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('does not create an executor when the component gate or credential is absent', () => {
    const executor = jest.fn() as unknown as StructuredModelExecutor;
    const createExecutor = jest.fn(() => executor);
    const bundle = createWrongQuestionOrganizerModelRuntime(
      {
        ...validLiveEnv(),
        WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '',
        DEEPSEEK_API_KEY: 'generic-key-must-not-be-used',
      },
      { createExecutor },
    );

    expect(bundle.config).toMatchObject({ enabled: false, mode: 'mock' });
    expect(createExecutor).not.toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });

  it('propagates request abort to the executor without retry', async () => {
    let executorSignal: AbortSignal | undefined;
    const executor: StructuredModelExecutor = jest.fn(
      ({ signal }) =>
        new Promise(() => {
          executorSignal = signal;
        }),
    );
    const bundle = createWrongQuestionOrganizerModelRuntime(validLiveEnv(), {
      createExecutor: () => executor,
    });
    const reserved = reserveWrongQuestionOrganizerCandidateBudget();
    const controller = new AbortController();
    const pending = bundle.runtime.invokeStructured({
      runId: 'organizer-runtime-abort',
      task: 'wrong_question_organization',
      schema: WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
      systemPrompt: 'Return strict JSON.',
      userPrompt: '{"questions":[]}',
      estimatedInputTokens: 100,
      maxOutputTokens: 800,
      budget: reserved!.candidateBudget,
      signal: controller.signal,
    });

    controller.abort();
    const result = await pending;

    expect(result).toMatchObject({ ok: false, error: { code: 'ABORTED' } });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executorSignal?.aborted).toBe(true);
  });
});

function validLiveEnv(): Record<string, unknown> {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: true,
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: true,
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: 5000,
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-key',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
  };
}
