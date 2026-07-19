import type { ModelAgentResult, StructuredModelExecutor } from '@repo/ai';

import {
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import {
  createReviewPlannerControlledLiveEvaluator,
  mapV3ControlledLiveStructuredOutputStage,
  mapControlledLiveDiagnosticCode,
} from './review-planner-controlled-live-eval.factory';

const liveDiagnosticEnv = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'factory-private-canary',
});

const CONTROLLED_REVIEW_SCHEMA_CANARY = Object.freeze({
  focusIndexes: [0],
});
describe('review planner controlled Live evaluator factory', () => {
  it('creates one JSON-object executor and runs an exact valid review-schema canary once', async () => {
    const executor: StructuredModelExecutor = jest.fn((input) => {
      expect(input.systemPrompt).not.toMatch(/factory-private-canary/i);
      expect(input.userPrompt).not.toMatch(/factory-private-canary/i);
      expect(input.schema).toBe(REVIEW_MODEL_CANDIDATE_SCHEMA);
      return Promise.resolve({
        object: CONTROLLED_REVIEW_SCHEMA_CANARY,
        usage: { inputTokens: 12, outputTokens: 4 },
      });
    });
    const createExecutor = jest.fn(() => executor);

    const evaluator = createReviewPlannerControlledLiveEvaluator(
      liveDiagnosticEnv,
      { createExecutor, isPricingKnown: () => true },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected enabled evaluator');
    expect(JSON.stringify(evaluator)).not.toMatch(
      /factory-private-canary|api\.deepseek\.com/i,
    );
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'factory-private-canary',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'json_object',
    });
    expect(createExecutor.mock.calls[0]?.[0]).not.toHaveProperty(
      'schemaProfiles',
    );
    expect(createExecutor.mock.calls[0]?.[0]).not.toHaveProperty('tools');

    const first = await evaluator.value.runDiagnostic();
    const second = await evaluator.value.runDiagnostic();

    expect(first).toEqual({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(second).toEqual(first);
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'missing exact confirmation gate',
      { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'false' },
    ],
    ['mock mode', { AI_PROVIDER_MODE: 'mock' }],
    ['global gate disabled', { AI_ENABLE_LIVE_CALLS: 'false' }],
    ['review production gate enabled', { REVIEW_AGENT_MODEL_ENABLED: 'true' }],
    [
      'planner production gate enabled',
      { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    ],
    ['unknown model price', { AI_MODEL: 'unknown-model-v1' }],
  ])('fails closed before executor construction for %s', (_name, override) => {
    const createExecutor = jest.fn();
    const evaluator = createReviewPlannerControlledLiveEvaluator(
      { ...liveDiagnosticEnv, ...override },
      {
        createExecutor,
        isPricingKnown: (model) => model === 'deepseek-v4-flash',
      },
    );

    expect(evaluator).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it.each([
    ['acknowledgement', { acknowledged: 'CONTROLLED_LIVE_RAW_SUMMARY_CANARY' }],
    ['missing required focus indexes', {}],
    ['wrong focus index type', { focusIndexes: ['0'] }],
    [
      'extra acknowledgement field',
      {
        ...CONTROLLED_REVIEW_SCHEMA_CANARY,
        acknowledgement: 'CONTROLLED_LIVE_RAW_EVIDENCE_CANARY',
      },
    ],
  ])(
    'keeps v2 legal but non-schema %s JSON at the generic structured-output boundary without retaining raw content',
    async (_label, object) => {
      const executor: StructuredModelExecutor = jest.fn(() =>
        Promise.resolve({
          object,
          usage: { inputTokens: 12, outputTokens: 4 },
        }),
      );
      const evaluator = createReviewPlannerControlledLiveEvaluator(
        liveDiagnosticEnv,
        { createExecutor: () => executor, isPricingKnown: () => true },
      );

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected enabled evaluator');

      const diagnostic = await evaluator.value.runDiagnostic();
      expect(diagnostic).toEqual({
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      });
      expect(JSON.stringify(diagnostic)).not.toMatch(
        /CONTROLLED_LIVE_RAW_(SUMMARY|EVIDENCE)_CANARY/,
      );
      expect(executor).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['http_auth', ReviewPlannerDiagnosticCode.HttpAuth],
    ['http_rate_limit', ReviewPlannerDiagnosticCode.HttpRateLimit],
    ['http_client', ReviewPlannerDiagnosticCode.HttpClient],
    ['http_server', ReviewPlannerDiagnosticCode.HttpServer],
    ['structured_output', ReviewPlannerDiagnosticCode.StructuredOutput],
    ['invalid_response', ReviewPlannerDiagnosticCode.InvalidResponse],
    ['transport', ReviewPlannerDiagnosticCode.Transport],
    ['unknown', ReviewPlannerDiagnosticCode.Transport],
  ] as const)(
    'maps provider category %s to the fixed safe enum',
    (category, expected) => {
      expect(
        mapControlledLiveDiagnosticCode({
          errorCode: 'PROVIDER_ERROR',
          providerFailureCategory: category,
        }),
      ).toBe(expected);
    },
  );

  it('keeps the v2 controlled diagnostic generic when the private runtime trace has a detailed stage', () => {
    expect(
      mapControlledLiveDiagnosticCode({
        errorCode: 'PROVIDER_ERROR',
        providerFailureCategory: 'structured_output',
        structuredOutputStage: 'provider_type_validation',
      } as never),
    ).toBe(ReviewPlannerDiagnosticCode.StructuredOutput);
  });

  it.each([
    'provider_json_parse',
    'provider_type_validation',
    'provider_object_missing',
  ] as const)(
    'retains only the trusted structured-output stage %s for the v3 diagnostic mapper',
    (structuredOutputStage) => {
      const result = structuredOutputFailure(structuredOutputStage);

      expect(mapV3ControlledLiveStructuredOutputStage(result)).toBe(
        structuredOutputStage,
      );
      expect(
        JSON.stringify(mapV3ControlledLiveStructuredOutputStage(result)),
      ).not.toMatch(
        /RAW_PROVIDER_STAGE_CANARY|api[_-]?key|authorization|cookie|stack/i,
      );
    },
  );

  it.each([
    [
      'local schema failure',
      structuredOutputFailure('provider_json_parse', {
        errorCode: 'SCHEMA_INVALID',
      }),
    ],
    ['missing trace stage', structuredOutputFailure(undefined)],
    [
      'mismatched trace category',
      structuredOutputFailure('provider_json_parse', {
        traceCategory: 'transport',
      }),
    ],
    [
      'mismatched error category',
      structuredOutputFailure('provider_json_parse', {
        errorCategory: 'transport',
      }),
    ],
    [
      'malformed stage',
      structuredOutputFailure('provider_json_parse_canary' as never),
    ],
  ])('does not retain a forged v3 stage for %s', (_label, result) => {
    expect(mapV3ControlledLiveStructuredOutputStage(result)).toBeUndefined();
  });
});

function structuredOutputFailure(
  stage:
    | 'provider_json_parse'
    | 'provider_type_validation'
    | 'provider_object_missing'
    | undefined,
  override: Readonly<{
    errorCode?: 'SCHEMA_INVALID';
    errorCategory?: 'transport';
    traceCategory?: 'transport';
  }> = {},
): ModelAgentResult<never> {
  const errorCode = override.errorCode ?? 'PROVIDER_ERROR';
  const errorCategory = override.errorCategory ?? 'structured_output';
  const traceCategory = override.traceCategory ?? 'structured_output';
  return {
    ok: false,
    error: {
      code: errorCode,
      message: 'fixed runtime failure',
      retryable: false,
      ...(errorCode === 'PROVIDER_ERROR'
        ? { providerFailureCategory: errorCategory }
        : {}),
    },
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 96,
      usedInputTokens: 96,
      maxOutputTokens: 32,
      usedOutputTokens: 32,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash:
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      task: 'review_suggestion',
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      status: 'failed',
      inputTokens: 0,
      outputTokens: 0,
      maxOutputTokens: 32,
      durationMs: 1,
      degraded: true,
      errorCode,
      providerFailureCategory: traceCategory,
      ...(stage ? { structuredOutputStage: stage } : {}),
    },
  };
}
