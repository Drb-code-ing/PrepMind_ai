import {
  WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
  WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET,
  WRONG_QUESTION_ORGANIZER_RESERVATION,
  estimateWrongQuestionOrganizerRequestCostCny,
  reserveWrongQuestionOrganizerCandidateBudget,
  resolveWrongQuestionOrganizerLiveExecutorConfig,
  resolveWrongQuestionOrganizerModelConfig,
} from './wrong-question-organizer-model-config';

describe('wrong-question organizer model config', () => {
  it('defaults the component gate off and timeout to 5000ms', () => {
    expect(resolveWrongQuestionOrganizerModelConfig({})).toMatchObject({
      enabled: false,
      timeoutMs: 5000,
      mode: 'mock',
      provider: 'mock',
      model: 'deepseek-v4-pro',
      promptVersion: 'wrong-question-organizer-model-candidate-v9',
      pricingKnown: true,
      runtimeAuthority: 'disabled',
    });
  });

  it('enables only the exact sealed replay boundary and rejects hostile credential accessors', () => {
    const env = validReplayEnv();
    expect(resolveWrongQuestionOrganizerModelConfig(env)).toMatchObject({
      enabled: true,
      mode: 'mock',
      provider: 'mock',
      promptVersion: 'wrong-question-organizer-model-candidate-v9',
      pricingKnown: false,
      runtimeAuthority: 'sr5_sealed_replay',
      replay: {
        enabled: true,
        component: 'organizer',
        behavior: 'success',
        maxRequests: 1,
        totalMaxRequests: 1,
      },
    });
    expect(resolveWrongQuestionOrganizerLiveExecutorConfig(env)).toBeNull();

    let credentialGetterCalls = 0;
    const hostileEnv = Object.defineProperty(
      validReplayEnv(),
      'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY',
      {
        enumerable: true,
        get() {
          credentialGetterCalls += 1;
          throw new Error('credential_accessor_must_not_run');
        },
      },
    );
    expect(resolveWrongQuestionOrganizerModelConfig(hostileEnv)).toMatchObject({
      enabled: false,
      runtimeAuthority: 'disabled',
    });
    expect(
      resolveWrongQuestionOrganizerLiveExecutorConfig(hostileEnv),
    ).toBeNull();
    expect(credentialGetterCalls).toBe(0);

    for (const override of [
      { PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED: false },
      { AI_PROVIDER_MODE: 'live' },
      { AI_ENABLE_LIVE_CALLS: true },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: true },
      { PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENT: 'tutor' },
      { PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIOR: 'unknown' },
      { PHASE_6_9_7_SR6_PRODUCT_REPLAY_MAX_REQUESTS: 3 },
      {
        PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256: `sha256:${'0'.repeat(64)}`,
      },
    ]) {
      expect(
        resolveWrongQuestionOrganizerModelConfig({
          ...validReplayEnv(),
          ...override,
        }),
      ).toMatchObject({ enabled: false, runtimeAuthority: 'disabled' });
    }
  });

  it('requires the exact live conjunction and the component credential', () => {
    expect(
      resolveWrongQuestionOrganizerModelConfig(validLiveEnv()),
    ).toMatchObject({
      enabled: true,
      mode: 'live',
      provider: 'deepseek',
    });

    for (const override of [
      { AI_PROVIDER_MODE: 'mock' },
      { AI_ENABLE_LIVE_CALLS: false },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: false },
      { WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '' },
      { AI_BASE_URL: 'https://untrusted.example/v1' },
    ]) {
      expect(
        resolveWrongQuestionOrganizerModelConfig({
          ...validLiveEnv(),
          ...override,
        }),
      ).toMatchObject({ enabled: false, mode: 'mock' });
    }

    expect(
      resolveWrongQuestionOrganizerModelConfig({
        ...validLiveEnv(),
        WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '',
        DEEPSEEK_API_KEY: 'generic-key-must-not-be-used',
      }),
    ).toMatchObject({ enabled: false, mode: 'mock' });
    expect(
      resolveWrongQuestionOrganizerModelConfig({
        ...validLiveEnv(),
        WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '',
        TUTOR_AGENT_DEEPSEEK_API_KEY: 'tutor-key-must-not-be-used',
      }),
    ).toMatchObject({ enabled: false, mode: 'mock' });
    expect(
      resolveWrongQuestionOrganizerModelConfig(validLiveEnv(), {
        ...WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY,
        requestCap: 0.02,
      }),
    ).toMatchObject({ enabled: false, pricingKnown: false });
  });

  it('creates only the fixed DeepSeek V4 Pro non-thinking executor config', () => {
    expect(
      resolveWrongQuestionOrganizerLiveExecutorConfig(validLiveEnv()),
    ).toEqual({
      provider: 'deepseek',
      apiKey: 'synthetic-organizer-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });
    expect(
      resolveWrongQuestionOrganizerLiveExecutorConfig({
        ...validLiveEnv(),
        WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '',
        DEEPSEEK_API_KEY: 'generic-key-must-not-be-used',
      }),
    ).toBeNull();
    expect(
      resolveWrongQuestionOrganizerLiveExecutorConfig({
        ...validLiveEnv(),
        WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: '',
        TUTOR_AGENT_DEEPSEEK_API_KEY: 'tutor-key-must-not-be-used',
      }),
    ).toBeNull();
  });

  it('reserves the immutable one-call 3500/800 ceiling before dispatch', () => {
    const before = structuredClone(WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET);
    const reserved = reserveWrongQuestionOrganizerCandidateBudget();

    expect(WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET).toEqual(before);
    expect(reserved).not.toBeNull();
    expect(reserved?.requestBudget).toEqual({
      ...WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET,
      usedCalls: 1,
      usedInputTokens: 3500,
      usedOutputTokens: 800,
    });
    expect(reserved?.candidateBudget).toEqual({
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: WRONG_QUESTION_ORGANIZER_RESERVATION.inputTokens,
      usedInputTokens: 0,
      maxOutputTokens: WRONG_QUESTION_ORGANIZER_RESERVATION.outputTokens,
      usedOutputTokens: 0,
    });
    expect(Object.isFrozen(reserved)).toBe(true);
    expect(Object.isFrozen(reserved?.requestBudget)).toBe(true);
    expect(Object.isFrozen(reserved?.candidateBudget)).toBe(true);
    expect(
      reserveWrongQuestionOrganizerCandidateBudget({
        ...WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET,
        maxOutputTokens: 799,
      }),
    ).toBeNull();
  });

  it('uses exact CNY pricing, positive usage, ceilings, and the 0.016 cap', () => {
    expect(
      estimateWrongQuestionOrganizerRequestCostCny({
        inputTokens: 3500,
        outputTokens: 800,
      }),
    ).toBe(0.0153);
    expect(
      estimateWrongQuestionOrganizerRequestCostCny({
        inputTokens: 3500,
        outputTokens: 800,
      }),
    ).toBeLessThanOrEqual(WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY.requestCap);
    expect(
      estimateWrongQuestionOrganizerRequestCostCny({
        inputTokens: 0,
        outputTokens: 1,
      }),
    ).toBeNull();
    expect(
      estimateWrongQuestionOrganizerRequestCostCny({
        inputTokens: 3501,
        outputTokens: 800,
      }),
    ).toBeNull();
    expect(
      estimateWrongQuestionOrganizerRequestCostCny(
        { inputTokens: 1, outputTokens: 1 },
        { ...WRONG_QUESTION_ORGANIZER_MODEL_PRICE_CNY, inputPerMillion: 0 },
      ),
    ).toBeNull();
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
