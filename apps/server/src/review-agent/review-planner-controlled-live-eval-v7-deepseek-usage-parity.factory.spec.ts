import type {
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';
import {
  phase695ReportSchema,
  PLANNER_MODEL_CANDIDATE_SCHEMA,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
  type Phase695Report,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import {
  DEEPSEEK_V4_PRO_V7_PRICING,
  createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator,
  resolveReviewPlannerControlledLiveV7DeepSeekUsageParityCompositionIdentity,
  resolveReviewPlannerControlledLiveV7DeepSeekUsageParityPricing,
  validateReviewPlannerControlledLiveV7DeepSeekUsageParityPreflight,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.factory';
import {
  resolveReviewPlannerLiveExecutorConfig,
  resolveReviewPlannerModelConfig,
} from './review-planner-model-config';

const v7Env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v7-private-test-key',
});

describe('Review/Planner controlled Live V7 usage parity evaluator', () => {
  it('exposes only the sanitized production-composition identity', async () => {
    const identity =
      resolveReviewPlannerControlledLiveV7DeepSeekUsageParityCompositionIdentity(
        v7Env,
      );
    const productionExecutor = resolveReviewPlannerLiveExecutorConfig(v7Env);
    const productionConfig = resolveReviewPlannerModelConfig(v7Env);
    if (!productionExecutor) throw new Error('expected production config');

    expect(identity).toEqual({
      provider: productionExecutor.provider,
      model: productionExecutor.model,
      baseUrlIdentity: 'deepseek-v1',
      structuredOutputMode: productionExecutor.structuredOutputMode,
      timeoutMs: productionConfig.reviewTimeoutMs,
      schemaId: 'review-model-candidate-v1',
    });
    expect(productionExecutor.baseURL).toBe('https://api.deepseek.com/v1');
    expect(Object.isFrozen(identity)).toBe(true);
    expect(JSON.stringify(identity)).not.toMatch(
      /v7-private-test-key|api\.deepseek\.com|https?:\/\//i,
    );
    expect(
      REVIEW_MODEL_CANDIDATE_SCHEMA.safeParse({
        focusIndexes: [0],
        diagnosis: 'review_pressure',
        minutes: 30,
        targetHref: '/today',
        writePermission: true,
      }).success,
    ).toBe(false);

    const harness = createExecutorHarness();
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await evaluator.value.runDiagnostic();
    expect(harness.executor.mock.calls[0]?.[0].schema).toBe(
      REVIEW_MODEL_CANDIDATE_SCHEMA,
    );
  });

  it('validates exact V7 preflight without constructing an executor', () => {
    expect(
      validateReviewPlannerControlledLiveV7DeepSeekUsageParityPreflight(v7Env),
    ).toEqual({ ok: true });
    expect(
      validateReviewPlannerControlledLiveV7DeepSeekUsageParityPreflight({
        ...v7Env,
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: 'false',
      }),
    ).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
  });

  it('accepts provider actual input 97 above the 96-token preview and accounts it unchanged', async () => {
    const harness = createExecutorHarness({
      usage: { inputTokens: 97, outputTokens: 4 },
    });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    expect(harness.createExecutor).toHaveBeenCalledTimes(1);
    expect(harness.createExecutor.mock.calls[0]?.[0]).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');

    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(evaluator.value.readCanaryUsage()).toEqual({
      inputTokens: 97,
      outputTokens: 4,
    });
    const pricing =
      resolveReviewPlannerControlledLiveV7DeepSeekUsageParityPricing();
    expect(pricing).toMatchObject({
      maxProviderAttempts: 23,
      reservedInputTokens: 42_996,
      reservedOutputTokens: 9_712,
      hardCapCny: 1,
    });
    expect(pricing?.reservedCostCny).toBe(0.18726);
    expect(pricing?.reservedCostCny).toBeLessThanOrEqual(
      pricing?.hardCapCny ?? 0,
    );
  });

  it.each([
    { inputTokens: 96, outputTokens: 1 },
    { inputTokens: 97, outputTokens: 4 },
    { inputTokens: 42_996, outputTokens: 32 },
  ])(
    'accepts positive safe actual usage inside full-run reservation: %o',
    async (usage) => {
      const harness = createExecutorHarness({ usage });
      const evaluator =
        createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
          createExecutor: harness.createExecutor,
        });

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V7 evaluator');
      await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
        status: 'complete',
        canContinue: true,
        usageKnown: true,
      });
      expect(evaluator.value.readCanaryUsage()).toEqual(usage);
    },
  );

  it.each([
    {
      label: 'input beyond full-run reservation',
      usage: { inputTokens: 42_997, outputTokens: 4 },
      diagnosticCode: 'usage_reservation_exceeded',
    },
    {
      label: 'output beyond canary request cap',
      usage: { inputTokens: 97, outputTokens: 33 },
      diagnosticCode: 'output_limit_exceeded',
    },
  ])(
    'closes $label with actual usage hidden from the diagnostic',
    async ({ usage, diagnosticCode }) => {
      const harness = createExecutorHarness({ usage });
      const evaluator =
        createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
          createExecutor: harness.createExecutor,
        });

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V7 evaluator');
      const diagnostic = await evaluator.value.runDiagnostic();
      expect(diagnostic).toEqual({
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode,
      });
      expect(JSON.stringify(diagnostic)).not.toContain(
        String(usage.inputTokens),
      );
      expect(evaluator.value.readCanaryUsage()).toBeNull();
    },
  );

  it.each([
    {
      label: 'missing raw usage',
      audit: { usageState: 'missing' as const },
      diagnosticCode: 'provider_usage_missing',
    },
    {
      label: 'invalid raw usage',
      audit: { usageState: 'invalid' as const },
      diagnosticCode: 'provider_usage_invalid',
    },
  ])(
    'distinguishes $label without exposing raw values',
    async ({ audit, diagnosticCode }) => {
      const harness = createExecutorHarness({ audit });
      const evaluator =
        createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
          createExecutor: harness.createExecutor,
        });

      expect(evaluator).toMatchObject({ ok: true });
      if (!evaluator.ok) throw new Error('expected V7 evaluator');
      await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode,
      });
    },
  );

  it('maps raw positive usage lost by runtime normalization to sdk_usage_lost', async () => {
    const harness = createExecutorHarness({ usage: undefined });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: 'sdk_usage_lost',
    });
  });

  it('closes a successful runtime result when the raw response audit was never observed', async () => {
    const harness = createExecutorHarness({ emitAudit: false });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toEqual({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: 'sdk_usage_lost',
    });
  });

  it('keeps schema failure distinct from positive raw usage telemetry', async () => {
    const harness = createExecutorHarness({ object: { unexpected: true } });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
    });
  });

  it('gives a non-thinking violation priority over otherwise valid usage', async () => {
    const harness = createExecutorHarness({
      audit: {
        reasoning: 'reported_positive',
        reasoningContentPresent: true,
        reportedReasoningTokens: 7,
      },
    });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      diagnosticCode: 'thinking_not_disabled',
    });
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
  ])(
    'rejects a mismatched V7 preflight before executor construction: %o',
    (override) => {
      const harness = createExecutorHarness();
      const evaluator =
        createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(
          { ...v7Env, ...override },
          { createExecutor: harness.createExecutor },
        );

      expect(evaluator).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(harness.createExecutor).not.toHaveBeenCalled();
    },
  );

  it('rejects pricing drift before executor construction', () => {
    const harness = createExecutorHarness();
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        pricing: {
          ...DEEPSEEK_V4_PRO_V7_PRICING,
          outputCnyPerMillionTokens: 7,
        },
      });

    expect(evaluator).toEqual({
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it('accounts for exactly one canary plus 22 paired runtime attempts', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    const runPairedEvaluation = jest.fn(
      async ({ live }: { live: Phase695LiveDependencies }) => {
        await invokePairedRuntimeCalls(live, 'v7-paired');
        return report;
      },
    );
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await expect(evaluator.value.runDiagnostic()).resolves.toMatchObject({
      status: 'complete',
      providerAttemptCount: 1,
    });
    const paired = await evaluator.value.runPairedEvaluation();
    expect(paired).toMatchObject({
      kind: 'report',
      report: {
        counters: {
          caseEntries: 48,
          zeroCallCases: 26,
          runtimeInvocations: 22,
          strictSuccesses: 48,
          qualityPasses: 48,
          criticalFailures: 0,
        },
      },
      cost: {
        observedInputTokens: report.counters.inputTokens + 12,
        observedOutputTokens: report.counters.outputTokens + 4,
        withinHardCap: true,
      },
    });
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('binds the strict-fake V7 evaluator run to an offline-only acceptance label', async () => {
    const harness = createExecutorHarness({ dynamicFixtureCandidates: true });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: runPhase695ReviewPlannerPaired,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await evaluator.value.runDiagnostic();
    const paired = await evaluator.value.runPairedEvaluation();
    const acceptance = Object.freeze({
      evidenceClassification: 'mock_quality_not_live_evidence' as const,
      result: paired,
    });

    expect(acceptance).toMatchObject({
      evidenceClassification: 'mock_quality_not_live_evidence',
      result: {
        kind: 'report',
        report: {
          mode: 'live',
          counters: {
            caseEntries: 48,
            zeroCallCases: 26,
            runtimeInvocations: 22,
            strictSuccesses: 48,
            qualityPasses: 48,
            criticalFailures: 0,
          },
          productionDecision: 'quality_gate_passed',
        },
      },
    });
    // The inner report is deliberately Live-shaped to exercise the evaluator
    // contract; the outer label forbids treating injected calls as provider evidence.
    if (paired.kind !== 'report') throw new Error('expected V7 paired report');
    expect(
      paired.report.caseEntries
        .filter((entry) => entry.executionKind === 'zero_call')
        .every((entry) => entry.zeroCallVerified),
    ).toBe(true);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('labels the canonical 48-case fake-only acceptance as Mock, never Live evidence', async () => {
    const report = await runPhase695ReviewPlannerPaired({
      mode: 'mock',
      now: () => 0,
    });

    expect(report).toMatchObject({
      mode: 'mock',
      counters: {
        caseEntries: 48,
        zeroCallCases: 26,
        runtimeInvocations: 22,
        strictSuccesses: 48,
        qualityPasses: 48,
        criticalFailures: 0,
      },
      productionDecision: 'mock_quality_not_evidence',
    });
    expect(
      report.caseEntries
        .filter((entry) => entry.executionKind === 'zero_call')
        .every((entry) => entry.zeroCallVerified),
    ).toBe(true);
  });

  it('closes paired evaluation when a later raw response reports missing usage', async () => {
    const harness = createExecutorHarness({
      auditSequence: [{ usageState: 'positive' }, { usageState: 'missing' }],
    });
    const report = await validLiveReport();
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 'v7-missing-usage');
          return report;
        },
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await evaluator.value.runDiagnostic();
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: 'provider_usage_missing',
    });
    expect(harness.executor).toHaveBeenCalledTimes(2);
  });

  it('closes when actual aggregate input exceeds the frozen full-run reservation', async () => {
    const harness = createExecutorHarness({
      usage: { inputTokens: 97, outputTokens: 4 },
    });
    const report = await maxInputLiveReport();
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 'v7-reservation');
          return report;
        },
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await evaluator.value.runDiagnostic();
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: 'usage_reservation_exceeded',
    });
  });

  it('blocks the 24th delegate call and records no extra provider attempt', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          for (let index = 0; index < 23; index += 1) {
            await live.runtime.invokeStructured(
              pairedRuntimeRequest(`v7-attempt-limit-${index}`),
            );
          }
          return report;
        },
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    await evaluator.value.runDiagnostic();
    await expect(evaluator.value.runPairedEvaluation()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.value.providerAttemptCount()).toBe(23);
  });

  it('contains a credential-bearing executor failure behind a fixed diagnostic', async () => {
    const privateCanary = 'V7_PRIVATE_KEY_MUST_NOT_ESCAPE';
    const harness = createExecutorHarness({
      executorError: new Error(privateCanary),
      emitAudit: false,
    });
    const evaluator =
      createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(v7Env, {
        createExecutor: harness.createExecutor,
      });

    expect(evaluator).toMatchObject({ ok: true });
    if (!evaluator.ok) throw new Error('expected V7 evaluator');
    const diagnostic = await evaluator.value.runDiagnostic();
    expect(diagnostic).toMatchObject({
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
    expect(JSON.stringify(diagnostic)).not.toContain(privateCanary);
  });
});

function createExecutorHarness(
  input: {
    usage?: { inputTokens?: number; outputTokens?: number };
    audit?: Record<string, unknown>;
    auditSequence?: readonly Record<string, unknown>[];
    object?: unknown;
    emitAudit?: boolean;
    executorError?: Error;
    dynamicFixtureCandidates?: boolean;
  } = {},
) {
  let onAudit: ((audit: unknown) => void) | undefined;
  let invocation = 0;
  const executor = jest.fn((request) => {
    const audit = input.auditSequence?.[invocation] ?? input.audit;
    invocation += 1;
    if (input.emitAudit !== false) {
      onAudit?.({
        reasoning: 'reported_zero',
        reasoningContentPresent: false,
        reportedReasoningTokens: 0,
        usageState: 'positive',
        ...audit,
      });
    }
    if (input.executorError) return Promise.reject(input.executorError);
    return Promise.resolve({
      object: input.dynamicFixtureCandidates
        ? fixtureCandidateFor(request.userPrompt, request.schema)
        : (input.object ?? {
            focusIndexes: [0],
          }),
      ...(Object.hasOwn(input, 'usage')
        ? input.usage === undefined
          ? {}
          : { usage: input.usage }
        : { usage: { inputTokens: 12, outputTokens: 4 } }),
    });
  }) as jest.MockedFunction<StructuredModelExecutor>;
  const createExecutor = jest.fn((config: OpenAICompatibleExecutorConfig) => {
    onAudit =
      config.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json'
        ? config.onNonThinkingAudit
        : undefined;
    return executor;
  });
  return { createExecutor, executor };
}

const reviewRuntimeProfiles = [
  { focusIndexes: [1] },
  { focusIndexes: [0] },
  { focusIndexes: [0, 1] },
  { focusIndexes: [1] },
  { focusIndexes: [0] },
  { focusIndexes: [0, 1] },
  { focusIndexes: [2] },
  { focusIndexes: [0, 2] },
  { focusIndexes: [0, 1, 2] },
  { focusIndexes: [2, 1] },
  { focusIndexes: [0] },
] as const;

const plannerRuntimeProfiles = [
  { blockOrder: [1, 0] },
  { blockOrder: [0, 1] },
  { blockOrder: [1, 0, 2] },
  { blockOrder: [2, 0, 1] },
  { blockOrder: [0, 1, 2] },
  { blockOrder: [2, 1, 0] },
  { blockOrder: [1, 0] },
  { blockOrder: [0, 1] },
  { blockOrder: [1, 2, 0] },
  { blockOrder: [0, 2, 1] },
  { blockOrder: [2, 1, 0] },
] as const;

function fixtureCandidateFor(
  userPrompt: string,
  schema: Parameters<StructuredModelExecutor>[0]['schema'],
) {
  const reviewOrdinal = readSyntheticOrdinal(userPrompt, 'review');
  if (reviewOrdinal !== null) {
    return reviewRuntimeProfiles[reviewOrdinal - 14];
  }
  const plannerOrdinal = readSyntheticOrdinal(userPrompt, 'plan');
  if (plannerOrdinal !== null) {
    return plannerRuntimeProfiles[plannerOrdinal - 14];
  }
  const plannerCanary = {
    blockOrder: [0],
  } as const;
  if (
    PLANNER_MODEL_CANDIDATE_SCHEMA.safeParse(plannerCanary).success &&
    schema.safeParse(plannerCanary).success
  ) {
    return plannerCanary;
  }
  return { focusIndexes: [0] };
}

function readSyntheticOrdinal(
  value: string,
  lane: 'review' | 'plan',
): number | null {
  const match = value.match(new RegExp(`synthetic-${lane}-(\\d+)-a`, 'i'));
  if (!match?.[1]) return null;
  const ordinal = Number(match[1]);
  return Number.isSafeInteger(ordinal) && ordinal >= 14 && ordinal <= 24
    ? ordinal
    : null;
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
      invokeStructured: (
        input: ReturnType<typeof pairedRuntimeRequest>,
      ) => Promise<unknown>;
    }>;
  }>,
  prefix: string,
) {
  for (let index = 0; index < 22; index += 1) {
    await live.runtime.invokeStructured(
      pairedRuntimeRequest(`${prefix}-${index}`),
    );
  }
}

async function validLiveReport(): Promise<Phase695Report> {
  const mock = await runPhase695ReviewPlannerPaired({
    mode: 'mock',
    now: () => 0,
  });
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

async function maxInputLiveReport(): Promise<Phase695Report> {
  const report = await validLiveReport();
  const caseEntries = report.caseEntries.map((entry) =>
    entry.executionKind === 'runtime'
      ? { ...entry, usage: { inputTokens: 1_950, outputTokens: 10 } }
      : entry,
  );
  return phase695ReportSchema.parse({
    ...report,
    caseEntries,
    counters: {
      ...report.counters,
      inputTokens: 1_950 * 22,
      outputTokens: 10 * 22,
    },
  });
}
