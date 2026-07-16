import type { StructuredModelExecutor } from '@repo/ai';

import {
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import {
  createReviewPlannerControlledLiveEvaluator,
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
  diagnosis: 'review_pressure',
});
const CONTROLLED_REVIEW_SCHEMA_CANARY_JSON = JSON.stringify(
  CONTROLLED_REVIEW_SCHEMA_CANARY,
);
const CONTROLLED_REVIEW_SCHEMA_CANARY_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const CONTROLLED_REVIEW_SCHEMA_CANARY_USER_PROMPT = `Return exactly ${CONTROLLED_REVIEW_SCHEMA_CANARY_JSON}.`;

describe('review planner controlled Live evaluator factory', () => {
  it('creates one JSON-object executor and runs an exact valid review-schema canary once', async () => {
    const executor: StructuredModelExecutor = jest.fn((input) => {
      expect(input.systemPrompt).not.toMatch(/factory-private-canary/i);
      expect(input.schema).toBe(REVIEW_MODEL_CANDIDATE_SCHEMA);
      expect(input.systemPrompt).toBe(
        CONTROLLED_REVIEW_SCHEMA_CANARY_SYSTEM_PROMPT,
      );
      expect(input.userPrompt).toBe(
        CONTROLLED_REVIEW_SCHEMA_CANARY_USER_PROMPT,
      );
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
    ['missing required diagnosis', { focusIndexes: [0] }],
    [
      'wrong focus index type',
      { focusIndexes: ['0'], diagnosis: 'review_pressure' },
    ],
    [
      'extra acknowledgement field',
      {
        ...CONTROLLED_REVIEW_SCHEMA_CANARY,
        acknowledgement: 'CONTROLLED_LIVE_RAW_EVIDENCE_CANARY',
      },
    ],
  ])(
    'maps legal but non-schema %s JSON to one closed structured-output attempt without retaining raw content',
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
});
