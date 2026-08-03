import type { StructuredModelExecutor } from '@repo/ai';
import {
  WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA,
} from '@repo/agent/wrong-question-organizer-v9';

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
              optionIndex: 0,
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
      schema: WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
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
      schema: WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
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

  it('uses the bounded sealed replay without constructing a Live executor', async () => {
    const createExecutor = jest.fn(() => {
      throw new Error('live_executor_must_not_be_constructed');
    });
    const bundle = createWrongQuestionOrganizerModelRuntime(validReplayEnv(), {
      createExecutor,
    });
    const reserved = reserveWrongQuestionOrganizerCandidateBudget();
    const projection = {
      version: 'wrong-question-organizer-model-projection-v9' as const,
      questions: [
        {
          questionIndex: 0,
          fields: { category: '函数', knowledgePoints: ['函数极限'] },
          options: [
            {
              optionIndex: 0,
              subjectLabel: 'math' as const,
              actionLabel: 'create_topic' as const,
              sourceLabel: 'knowledge_point' as const,
              targetLabel: '函数极限',
            },
          ],
        },
      ],
    };
    expect(
      WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA.parse(projection),
    ).toEqual(projection);

    const result = await bundle.runtime.invokeStructured({
      runId: 'organizer-sr6-replay',
      task: 'wrong_question_organization',
      schema: WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
      systemPrompt: 'Bounded Organizer replay test.',
      userPrompt: JSON.stringify(projection),
      estimatedInputTokens: 100,
      maxOutputTokens: 800,
      budget: reserved!.candidateBudget,
    });

    expect(createExecutor).not.toHaveBeenCalled();
    expect(bundle.config.runtimeAuthority).toBe('sr5_sealed_replay');
    expect(result).toMatchObject({
      ok: true,
      data: { decisions: [{ questionIndex: 0, optionIndex: 0 }] },
      trace: {
        mode: 'mock',
        provider: 'mock',
        model:
          'phase-6.9.7-sr6-sealed-replay-87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
        status: 'succeeded',
      },
    });
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

function validReplayEnv(): Record<string, unknown> {
  return {
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: false,
    TUTOR_AGENT_MODEL_ENABLED: false,
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: false,
    PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED: true,
    PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENT: 'organizer',
    PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIOR: 'success',
    PHASE_6_9_7_SR6_PRODUCT_REPLAY_MAX_REQUESTS: 1,
    PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256:
      '87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be',
  };
}
