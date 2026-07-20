import type { ModelAgentResult } from '@repo/ai';
import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  createReviewPlannerControlledLiveV4Evaluator,
  mapV4ControlledLiveStructuredOutputStage,
  validateReviewPlannerControlledLiveV4Preflight,
} from './review-planner-controlled-live-eval-v4.factory';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v4-factory-private-key',
});

describe('review planner controlled Live v4 evaluator', () => {
  it('constructs a private V4 executor only after the closed-gate preflight and accounts for a positive-usage canary once', async () => {
    await withFakeJsonFetch(
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                focusIndexes: [0],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      },
      async (fetch) => {
        const evaluator = createReviewPlannerControlledLiveV4Evaluator(env, {
          isPricingKnown: () => true,
        });

        expect(evaluator).toMatchObject({ ok: true });
        if (!evaluator.ok) throw new Error('expected v4 evaluator');
        await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 1,
          usageKnown: true,
        });
        expect(fetch).toHaveBeenCalledTimes(1);
      },
    );
  });

  it('turns a rejecting private fetch into one safe attempted transport closure without retaining the raw canary', async () => {
    const rawCanary = 'RAW_V4_PRIVATE_FETCH_REJECTION_CANARY';
    await withFakeFetch(
      () => Promise.reject(new Error(rawCanary)),
      async (fetch) => {
        const evaluator = createReviewPlannerControlledLiveV4Evaluator(env, {
          isPricingKnown: () => true,
        });

        expect(evaluator).toMatchObject({ ok: true });
        if (!evaluator.ok) throw new Error('expected v4 evaluator');
        const diagnostic = await evaluator.value.runDiagnostic();

        expect(diagnostic).toEqual({
          status: 'invalid_attempted',
          canContinue: false,
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(diagnostic)).not.toContain(rawCanary);
      },
    );
  });

  it.each([
    {
      label: 'malformed JSON',
      content: '{"focusIndexes":[0],"diagnosis": RAW_V4_MALFORMED_JSON_CANARY',
      structuredOutputStage: 'provider_json_parse' as const,
    },
    {
      label: 'an invalid JSON fence',
      content:
        '```JSON\n{"focusIndexes":[0],"diagnosis":"review_pressure","raw":"RAW_V4_FENCE_CANARY"}\n```',
      structuredOutputStage: 'provider_json_parse' as const,
    },
    {
      label: 'a strict schema mismatch',
      content: JSON.stringify({
        focusIndexes: [0],
        diagnosis: 'review_pressure',
        raw: 'RAW_V4_SCHEMA_CANARY',
      }),
      structuredOutputStage: 'provider_type_validation' as const,
    },
  ])(
    'routes direct JSON %s through the trusted structured-output signal without retaining raw content',
    async ({ content, structuredOutputStage }) => {
      await withFakeJsonFetch(
        {
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        },
        async (fetch) => {
          const evaluator = createReviewPlannerControlledLiveV4Evaluator(env, {
            isPricingKnown: () => true,
          });

          expect(evaluator).toMatchObject({ ok: true });
          if (!evaluator.ok) throw new Error('expected v4 evaluator');

          const diagnostic = await evaluator.value.runDiagnostic();

          expect(diagnostic).toEqual({
            status: 'invalid_attempted',
            canContinue: false,
            providerAttemptCount: 1,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
            structuredOutputStage,
          });
          expect(fetch).toHaveBeenCalledTimes(1);
          expect(JSON.stringify(diagnostic)).not.toContain('RAW_V4_');
        },
      );
    },
  );

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
    { AI_MODEL: 'other-model' },
  ])('fails v4 preflight before direct fetch for %o', (override) => {
    expect(
      createReviewPlannerControlledLiveV4Evaluator(
        { ...env, ...override },
        { isPricingKnown: () => true },
      ),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(
      validateReviewPlannerControlledLiveV4Preflight(
        { ...env, ...override },
        { isPricingKnown: () => true },
      ),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
  });

  it('maps the fixed stage only when trusted error and trace boundaries agree', () => {
    expect(
      mapV4ControlledLiveStructuredOutputStage(structuredOutputFailure()),
    ).toBe('provider_json_parse');
    expect(
      mapV4ControlledLiveStructuredOutputStage(
        structuredOutputFailure({ traceCategory: 'transport' }),
      ),
    ).toBeUndefined();
  });
});

async function withFakeJsonFetch<T>(
  payload: unknown,
  run: (fetch: jest.MockedFunction<typeof globalThis.fetch>) => Promise<T>,
) {
  return withFakeFetch(
    () =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      } as Response),
    run,
  );
}

async function withFakeFetch<T>(
  implementation: () => Promise<Response>,
  run: (fetch: jest.MockedFunction<typeof globalThis.fetch>) => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const fetch = jest.fn(implementation) as jest.MockedFunction<
    typeof globalThis.fetch
  >;
  globalThis.fetch = fetch;
  try {
    return await run(fetch);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function structuredOutputFailure(
  override: Readonly<{ traceCategory?: 'transport' }> = {},
): ModelAgentResult<never> {
  return {
    ok: false,
    error: {
      code: 'PROVIDER_ERROR',
      message: 'safe error',
      retryable: false,
      providerFailureCategory: 'structured_output',
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
      runIdHash: `sha256:${'0'.repeat(64)}`,
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
      errorCode: 'PROVIDER_ERROR',
      providerFailureCategory: override.traceCategory ?? 'structured_output',
      structuredOutputStage: 'provider_json_parse',
    },
  };
}
