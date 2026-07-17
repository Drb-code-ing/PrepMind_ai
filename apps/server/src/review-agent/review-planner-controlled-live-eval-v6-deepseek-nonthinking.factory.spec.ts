import type {
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';
import {
  phase695ReportSchema,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  runPhase695ReviewPlannerPaired,
  type Phase695Report,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import {
  DEEPSEEK_V4_PRO_V6_PRICING,
  createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator,
  resolveReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing,
  validateReviewPlannerControlledLiveV6DeepSeekNonThinkingPreflight,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory';

const v6Env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v6-private-test-key',
});

describe('Review/Planner controlled Live V6 DeepSeek non-thinking evaluator', () => {
  it('constructs only the exact V6 non-thinking executor and accounts for one valid fact-free canary', async () => {
    const harness = createExecutorHarness({
      reasoning: 'not_reported',
      reasoningContentPresent: false,
    });
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      { createExecutor: harness.createExecutor },
    );

    expect(evaluator).toMatchObject({ ok: true });
    expect(harness.createExecutor).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
        onNonThinkingAudit: expect.any(Function),
      }),
    );
    if (!evaluator.ok) throw new Error('expected V6 evaluator');

    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(harness.executor).toHaveBeenCalledTimes(1);
    expect(evaluator.value.providerAttemptCount()).toBe(1);
    expect(
      resolveReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing(),
    ).toEqual({
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

  it.each([
    {},
    { inputTokens: 0, outputTokens: 4 },
    { inputTokens: 12, outputTokens: 0 },
    { inputTokens: 12.5, outputTokens: 4 },
    { inputTokens: 12, outputTokens: -4 },
  ])(
    'closes missing, zero, fractional, or negative canary aggregate usage without paired evaluation: %o',
    async (usage) => {
      const harness = createExecutorHarness(undefined, usage);
      const runPairedEvaluation = jest.fn(async () => validLiveReport());
      const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
        v6Env,
        { createExecutor: harness.createExecutor, runPairedEvaluation },
      );

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V6 evaluator');
      await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
      });
      await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      });
      expect(runPairedEvaluation).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      label: 'positive reasoning tokens',
      audit: {
        reasoning: 'reported_positive',
        reasoningContentPresent: true,
        reportedReasoningTokens: 1,
      },
    },
    {
      label: 'reasoning content presence',
      audit: {
        reasoning: 'reported_zero',
        reasoningContentPresent: true,
        reportedReasoningTokens: 0,
      },
    },
    {
      label: 'invalid reasoning detail',
      audit: { reasoning: 'invalid_detail', reasoningContentPresent: false },
    },
  ])('closes a V6 non-thinking audit violation: $label', async ({ audit }) => {
    const harness = createExecutorHarness(audit);
    const runPairedEvaluation = jest.fn(async () => validLiveReport());
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      { createExecutor: harness.createExecutor, runPairedEvaluation },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V6 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: 'thinking_not_disabled',
    });
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
    expect(runPairedEvaluation).not.toHaveBeenCalled();
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { AI_PROVIDER_MODE: undefined },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { AI_ENABLE_LIVE_CALLS: undefined },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: undefined },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
  ])('rejects a missing or closed gate, model, or base mismatch before executor construction: %o', (override) => {
    const harness = createExecutorHarness();
    const actual = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      { ...v6Env, ...override },
      { createExecutor: harness.createExecutor },
    );

    expect(actual).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(
      validateReviewPlannerControlledLiveV6DeepSeekNonThinkingPreflight({
        ...v6Env,
        ...override,
      }),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'positive reasoning tokens',
      audit: {
        reasoning: 'reported_positive',
        reasoningContentPresent: true,
        reportedReasoningTokens: 1,
      },
    },
    {
      label: 'reasoning content presence',
      audit: {
        reasoning: 'reported_zero',
        reasoningContentPresent: true,
        reportedReasoningTokens: 0,
      },
    },
    {
      label: 'invalid audit detail',
      audit: { reasoning: 'invalid_detail', reasoningContentPresent: false },
    },
  ])(
    'closes paired evaluation locally when the initially clean transport emits $label',
    async ({ audit }) => {
      const cleanAudit = {
        reasoning: 'not_reported',
        reasoningContentPresent: false,
      };
      const harness = createExecutorHarness(
        undefined,
        undefined,
        [cleanAudit, audit],
      );
      const report = await validLiveReport();
      const runPairedEvaluation = jest.fn(async ({ live }) => {
        await live.runtime.invokeStructured(pairedRuntimeRequest('paired-audit'));
        return report;
      });
      const evaluator =
        createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(v6Env, {
          createExecutor: harness.createExecutor,
          runPairedEvaluation,
        });

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V6 evaluator');
      await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
        status: 'complete',
        providerAttemptCount: 1,
      });
      await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
        kind: 'failed',
        diagnosticCode: 'thinking_not_disabled',
      });
      expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
      expect(harness.executor).toHaveBeenCalledTimes(2);
    },
  );

  it('rejects a mismatched CNY price profile before executor construction', () => {
    const harness = createExecutorHarness();
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      {
        createExecutor: harness.createExecutor,
        pricing: {
          ...DEEPSEEK_V4_PRO_V6_PRICING,
          outputCnyPerMillionTokens: 7,
        },
      },
    );

    expect(evaluator).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'not reported reasoning',
      audit: { reasoning: 'not_reported', reasoningContentPresent: false },
    },
    {
      label: 'zero reported reasoning',
      audit: {
        reasoning: 'reported_zero',
        reasoningContentPresent: false,
        reportedReasoningTokens: 0,
      },
    },
  ])('$label retains all completion tokens in the private CNY aggregate', async ({ audit }) => {
    const harness = createExecutorHarness(audit);
    const report = await validLiveReport();
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: jest.fn(async ({ live }) => {
          await invokePairedRuntimeCalls(live, 'cny-cost');
          return report;
        }),
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V6 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      providerAttemptCount: 1,
    });
    const paired = await evaluator.value.runPairedEvaluation();

    expect(paired).toMatchObject({ kind: 'report' });
    if (paired.kind !== 'report') throw new Error('expected V6 report');
    expect(paired.cost.observedOutputTokens).toBe(
      report.counters.outputTokens + 4,
    );
    expect(paired.cost.observedCostCny).toBe(
      calculateCnyCost(
        report.counters.inputTokens + 12,
        report.counters.outputTokens + 4,
      ),
    );
  });

  it('accepts only the complete 48/26/22/22 report under the CNY cap', async () => {
    const harness = createExecutorHarness({
      reasoning: 'not_reported',
      reasoningContentPresent: false,
    });
    const report = await validLiveReport();
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: jest.fn(async ({ live }) => {
          await invokePairedRuntimeCalls(live, 'complete-report');
          return report;
        }),
      },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V6 evaluator');
    await evaluator.value.runDiagnostic();
    const actual = await evaluator.value.runPairedEvaluation();

    expect(actual).toMatchObject({ kind: 'report' });
    expect(report.counters).toEqual({
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      inputTokens: report.counters.inputTokens,
      outputTokens: report.counters.outputTokens,
    });
    expect(report.metrics.p95DurationMs).toBeLessThanOrEqual(4_500);
    expect(report.metrics.semanticQualityRate).toBeGreaterThanOrEqual(0.9);
    expect(
      report.counters.strictSuccesses - report.counters.zeroCallCases,
    ).toBe(22);
    expect(report.counters.inputTokens + report.counters.outputTokens).toBeGreaterThan(
      0,
    );
  });

  it('rejects a schema-valid paired report that claims 22 runtime cases without invoking the paired runtime', async () => {
    const harness = createExecutorHarness({
      reasoning: 'not_reported',
      reasoningContentPresent: false,
    });
    const report = await validLiveReport();
    const runPairedEvaluation = jest.fn(async () => report);
    const evaluator =
      createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(v6Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V6 evaluator');
    await evaluator.value.runDiagnostic();
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(harness.executor).toHaveBeenCalledTimes(1);
    expect(evaluator.value.providerAttemptCount()).toBe(1);
  });

  it('blocks the 24th delegate call and closes paired evaluation without executing it', async () => {
    const harness = createExecutorHarness({
      reasoning: 'not_reported',
      reasoningContentPresent: false,
    });
    const report = await validLiveReport();
    const runPairedEvaluation = jest.fn(async ({ live }) => {
      for (let index = 0; index < 23; index += 1) {
        await live.runtime.invokeStructured({
          runId: `v6-limit-${index}`,
          task: 'review_suggestion',
          schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
          systemPrompt: 'return JSON',
          userPrompt: 'return JSON',
          estimatedInputTokens: 12,
          maxOutputTokens: 4,
          budget: {
            maxCalls: 1,
            usedCalls: 0,
            maxInputTokens: 12,
            usedInputTokens: 0,
            maxOutputTokens: 4,
            usedOutputTokens: 0,
          },
        });
      }
      return report;
    });
    const evaluator = createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
      v6Env,
      { createExecutor: harness.createExecutor, runPairedEvaluation },
    );

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V6 evaluator');
    await evaluator.value.runDiagnostic();
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });
});

function createExecutorHarness(
  audit?: unknown,
  usage: Readonly<{ inputTokens?: number; outputTokens?: number }> | undefined = {
    inputTokens: 12,
    outputTokens: 4,
  },
  auditSequence?: readonly unknown[],
) {
  let invocation = 0;
  const executor = jest.fn(async () => {
    const currentAudit = auditSequence?.[invocation] ?? audit;
    invocation += 1;
    if (currentAudit !== undefined && typeof onAudit === 'function') {
      onAudit(currentAudit as never);
    }
    return {
      object: { focusIndexes: [0], diagnosis: 'review_pressure' },
      ...(usage === undefined ? {} : { usage }),
    };
  }) as jest.MockedFunction<StructuredModelExecutor>;
  let onAudit: ((audit: unknown) => void) | undefined;
  const createExecutor = jest.fn((config: OpenAICompatibleExecutorConfig) => {
    onAudit =
      config.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json'
        ? (config.onNonThinkingAudit as ((audit: unknown) => void) | undefined)
        : undefined;
    return executor;
  });
  return { createExecutor, executor };
}

function pairedRuntimeRequest(runId: string) {
  return {
    runId,
    task: 'review_suggestion' as const,
    schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
    systemPrompt: 'return JSON',
    userPrompt: 'return JSON',
    estimatedInputTokens: 12,
    maxOutputTokens: 4,
    budget: {
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: 12,
      usedInputTokens: 0,
      maxOutputTokens: 4,
      usedOutputTokens: 0,
    },
  };
}

async function invokePairedRuntimeCalls(
  live: Readonly<{
    runtime: Readonly<{
      invokeStructured: (input: ReturnType<typeof pairedRuntimeRequest>) => Promise<unknown>;
    }>;
  }>,
  prefix: string,
) {
  for (let index = 0; index < 22; index += 1) {
    await live.runtime.invokeStructured(pairedRuntimeRequest(`${prefix}-${index}`));
  }
}

async function validLiveReport(): Promise<Phase695Report> {
  const mock = await runPhase695ReviewPlannerPaired({ mode: 'mock', now: () => 0 });
  const caseEntries = mock.caseEntries.map((entry) =>
    entry.executionKind === 'runtime'
      ? { ...entry, usage: { ...entry.usage, outputTokens: 10 } }
      : entry,
  );
  const inputTokens = caseEntries.reduce(
    (total, entry) => total + entry.usage.inputTokens,
    0,
  );
  const outputTokens = caseEntries.reduce(
    (total, entry) => total + entry.usage.outputTokens,
    0,
  );
  return phase695ReportSchema.parse({
    ...mock,
    mode: 'live',
    caseEntries,
    counters: { ...mock.counters, inputTokens, outputTokens },
    productionDecision: 'quality_gate_passed',
  });
}

function calculateCnyCost(inputTokens: number, outputTokens: number) {
  return (
    Math.round(
      ((inputTokens * 3 + outputTokens * 6) / 1_000_000) * 100_000_000,
    ) / 100_000_000
  );
}
