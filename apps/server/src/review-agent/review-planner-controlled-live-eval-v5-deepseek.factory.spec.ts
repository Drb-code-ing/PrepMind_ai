import {
  createModelAgentBudget,
  type ModelAgentRuntime,
  type ModelAgentResult,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
  runPhase695ReviewPlannerPaired,
} from '@repo/agent';

import {
  DEEPSEEK_V4_PRO_V5_PRICING,
  createReviewPlannerControlledLiveV5DeepSeekEvaluator,
  resolveReviewPlannerControlledLiveV5DeepSeekPricing,
  validateReviewPlannerControlledLiveV5DeepSeekPreflight,
} from './review-planner-controlled-live-eval-v5-deepseek.factory';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v5-private-test-key',
});

describe('Review/Planner controlled Live V5 DeepSeek evaluator', () => {
  it('binds V4 Pro to the standard JSON executor with no schema profile or tool transport', async () => {
    const createExecutor = jest.fn<
      StructuredModelExecutor,
      [OpenAICompatibleExecutorConfig]
    >(() => validExecutor());

    const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
      env,
      {
        createExecutor,
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V5 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(createExecutor).toHaveBeenCalledTimes(1);
    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'v5-private-test-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'json_object',
    });
    const [config] = createExecutor.mock.calls[0] ?? [];
    expect(config).toBeDefined();
    expect('schemaProfiles' in (config ?? {})).toBe(false);
  });

  it.each([
    { label: 'zero', usage: { inputTokens: 0, outputTokens: 4 } },
    { label: 'missing', usage: {} },
    { label: 'fractional', usage: { inputTokens: 12.5, outputTokens: 4 } },
    { label: 'negative', usage: { inputTokens: -1, outputTokens: 4 } },
    {
      label: 'over the reserved canary cap',
      usage: { inputTokens: 97, outputTokens: 32 },
    },
  ])(
    'fails closed with one consumed provider attempt when V5 canary usage is $label',
    async ({ usage }) => {
      const executor = jest.fn<
        ReturnType<StructuredModelExecutor>,
        Parameters<StructuredModelExecutor>
      >(() =>
        Promise.resolve({
          object: { focusIndexes: [0], diagnosis: 'review_pressure' },
          usage,
        }),
      );
      const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
        env,
        {
          createExecutor: () => executor,
        },
      );

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V5 evaluator');
      await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
      });
      expect(executor).toHaveBeenCalledTimes(1);
      expect(evaluator.value.providerAttemptCount()).toBe(1);
    },
  );

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
  ])(
    'rejects a gate, model, or base mismatch before constructing V5 executor: %o',
    (override) => {
      const createExecutor = jest.fn<
        StructuredModelExecutor,
        [OpenAICompatibleExecutorConfig]
      >(() => validExecutor());
      const actual = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
        { ...env, ...override },
        { createExecutor },
      );

      expect(actual).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(
        validateReviewPlannerControlledLiveV5DeepSeekPreflight({
          ...env,
          ...override,
        }),
      ).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(createExecutor).not.toHaveBeenCalled();
    },
  );

  it('rejects a V5 price mismatch before constructing the executor', () => {
    const createExecutor = jest.fn<
      StructuredModelExecutor,
      [OpenAICompatibleExecutorConfig]
    >(() => validExecutor());

    expect(
      createReviewPlannerControlledLiveV5DeepSeekEvaluator(env, {
        createExecutor,
        pricing: {
          ...DEEPSEEK_V4_PRO_V5_PRICING,
          outputCnyPerMillionTokens: 7,
        },
      }),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it('returns the frozen twenty-two-call paired cap and CNY-safe reservation aggregate', async () => {
    const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
      env,
      {
        createExecutor: () => validExecutor(),
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V5 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      canContinue: true,
    });
    const paired = await evaluator.value.runPairedEvaluation();
    expect(paired).toMatchObject({
      kind: 'report',
      cost: {
        currency: 'CNY',
        maxPairedProviderAttempts: 22,
        maxProviderAttempts: 23,
        reservedInputTokens: 42_996,
        reservedOutputTokens: 9_712,
        reservedCostCny: 0.18726,
        observedInputTokens: 276,
        observedOutputTokens: 92,
        observedCostCny: 0.00138,
        withinHardCap: true,
      },
    });
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('blocks a twenty-fourth provider attempt before the delegate and fails the paired return closed', async () => {
    const executor = jest.fn<
      ReturnType<StructuredModelExecutor>,
      Parameters<StructuredModelExecutor>
    >(validExecutor());
    let overflow: ModelAgentResult<unknown> | undefined;
    const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
      env,
      {
        createExecutor: () => executor,
        runPairedEvaluation: async ({ live }) => {
          const report = await runPhase695ReviewPlannerPaired({
            mode: 'live',
            live,
          });
          overflow = await live.runtime.invokeStructured({
            runId: 'phase-6.9.5-v5-overflow-regression',
            task: 'review_suggestion',
            schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
            systemPrompt: 'safe test',
            userPrompt: 'safe test',
            estimatedInputTokens: 1,
            maxOutputTokens: 1,
            budget: createModelAgentBudget({
              maxCalls: 1,
              maxInputTokens: 1,
              maxOutputTokens: 1,
            }),
          });
          return report;
        },
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V5 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      canContinue: true,
    });
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(overflow).toMatchObject({
      ok: false,
      error: { code: 'CALL_BUDGET_EXCEEDED' },
    });
    expect(executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('keeps the delegate at twenty-three attempts when two paired invocations race at the cap', async () => {
    const executor = jest.fn<
      ReturnType<StructuredModelExecutor>,
      Parameters<StructuredModelExecutor>
    >(validExecutor());
    let race: readonly ModelAgentResult<unknown>[] = [];
    const evaluator = createReviewPlannerControlledLiveV5DeepSeekEvaluator(
      env,
      {
        createExecutor: () => executor,
        runPairedEvaluation: async ({ live }) => {
          for (let index = 0; index < 21; index += 1) {
            await invokeControlledReview(live.runtime);
          }
          race = await Promise.all([
            invokeControlledReview(live.runtime),
            invokeControlledReview(live.runtime),
          ]);
          return {} as never;
        },
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V5 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      canContinue: true,
    });
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(race.filter((result) => result.ok).length).toBe(1);
    expect(race.filter((result) => !result.ok).length).toBe(1);
    expect(executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('resolves the frozen CNY price profile without placing it in the USD trace contract', () => {
    expect(resolveReviewPlannerControlledLiveV5DeepSeekPricing()).toEqual({
      currency: 'CNY',
      nonCachedInputCnyPerMillionTokens: 3,
      outputCnyPerMillionTokens: 6,
      hardCapCny: 1,
      maxPairedProviderAttempts: 22,
      maxProviderAttempts: 23,
      reservedInputTokens: 42_996,
      reservedOutputTokens: 9_712,
      reservedCostCny: 0.18726,
    });
  });
});

function validExecutor(): StructuredModelExecutor {
  return (input) =>
    Promise.resolve({
      object: input.systemPrompt.includes('study-plan')
        ? { blockOrder: [0], strategy: 'steady_progress' }
        : { focusIndexes: [0], diagnosis: 'review_pressure' },
      usage: { inputTokens: 12, outputTokens: 4 },
    });
}

function invokeControlledReview(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
) {
  return runtime.invokeStructured({
    runId: 'phase-6.9.5-v5-concurrent-cap-regression',
    task: 'review_suggestion',
    schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
    systemPrompt: 'safe test',
    userPrompt: 'safe test',
    estimatedInputTokens: 1,
    maxOutputTokens: 1,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 1,
      maxOutputTokens: 1,
    }),
  });
}
