import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';
import {
  phase695ReportSchema,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
  type Phase695Report,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import {
  DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE_ID,
  createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator,
  resolveReviewPlannerControlledLiveV8StageDiagnosticsCompositionIdentity,
  resolveReviewPlannerControlledLiveV8StageDiagnosticsPricing,
  validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.factory';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  safeReviewPlannerControlledLiveV8SummarySchema,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

const readyEnv = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v8-private-test-key',
  REVIEW_AGENT_MODEL_TIMEOUT_MS: '4500',
  PLANNER_AGENT_MODEL_TIMEOUT_MS: '4500',
});

describe('review planner controlled Live V8 stage diagnostics factory', () => {
  it('publishes only the frozen V8 identity and exact price profile', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE_ID).toBe(
      'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
    );
    const identity =
      resolveReviewPlannerControlledLiveV8StageDiagnosticsCompositionIdentity(
        readyEnv,
      );
    expect(identity).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      baseUrlIdentity: 'deepseek-v1',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      timeoutMs: 4500,
      schemaId: 'review-model-candidate-v1',
      priceProfileId:
        REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(JSON.stringify(identity)).not.toMatch(
      /v8-private-test-key|api\.deepseek\.com|https?:\/\//i,
    );
    expect(
      resolveReviewPlannerControlledLiveV8StageDiagnosticsPricing(),
    ).toEqual(
      expect.objectContaining({
        currency: 'CNY',
        nonCachedInputCnyPerMillionTokens: 3,
        outputCnyPerMillionTokens: 6,
        hardCapCny: 1,
        maxPairedProviderAttempts: 22,
        maxProviderAttempts: 23,
        reservedInputTokens: 42_996,
        reservedOutputTokens: 9_712,
        reservedCostCny: 0.18726,
        priceProfileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
      }),
    );
  });

  it('validates the exact ready preflight as a pure zero-network operation', () => {
    const harness = createExecutorHarness();
    expect(
      validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight(readyEnv),
    ).toEqual({ ok: true });
    expect(harness.createExecutor).not.toHaveBeenCalled();
    expect(JSON.stringify(readyEnv)).toContain('v8-private-test-key');
  });

  it.each([
    { AI_PROVIDER_MODE: undefined },
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: undefined },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: undefined },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: undefined },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: undefined },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { DEEPSEEK_API_KEY: undefined },
    { AI_MODEL: undefined },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: undefined },
    { AI_BASE_URL: 'https://api.deepseek.com' },
    { REVIEW_AGENT_MODEL_TIMEOUT_MS: '4501' },
    { PLANNER_AGENT_MODEL_TIMEOUT_MS: '4499' },
  ])(
    'closes mismatched preflight before executor construction: %o',
    (override) => {
      const harness = createExecutorHarness();
      const env = { ...readyEnv, ...override };
      expect(
        validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight(env),
      ).toEqual({
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(
        createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(env, {
          createExecutor: harness.createExecutor,
        }),
      ).toMatchObject({
        state: 'closed',
        identity: null,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(harness.createExecutor).not.toHaveBeenCalled();
    },
  );

  it('rejects price drift before executor construction', () => {
    const harness = createExecutorHarness();
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        pricing: {
          ...DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING,
          outputCnyPerMillionTokens: 7,
        },
      });
    expect(evaluator).toMatchObject({
      state: 'closed',
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
    expect(harness.createExecutor).not.toHaveBeenCalled();
  });

  it('creates one strict non-thinking executor with no tools/schema/reasoning transport fields', async () => {
    const harness = createExecutorHarness();
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
      });
    expect(evaluator.state).toBe('ready');
    expect(evaluator).not.toHaveProperty('profileId');
    expect(harness.createExecutor).toHaveBeenCalledTimes(1);
    const config = harness.createExecutor.mock.calls[0]?.[0];
    expect(config).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    });
    expect(Object.keys(config ?? {})).not.toEqual(
      expect.arrayContaining([
        'tools',
        'tool_choice',
        'json_schema',
        'reasoning',
        'maxRetries',
      ]),
    );
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();
    const request = harness.executor.mock.calls[0]?.[0];
    expect(request.schema).toBe(REVIEW_MODEL_CANDIDATE_SCHEMA);
    expect(Object.keys(request)).not.toEqual(
      expect.arrayContaining([
        'tools',
        'tool_choice',
        'json_schema',
        'reasoning',
      ]),
    );
    expect(`${request.systemPrompt}\n${request.userPrompt}`).not.toMatch(
      /email|userId|wrongQuestion|reviewLog|password|api[_ -]?key/i,
    );
  });

  it('returns the complete 48/26/22 report with 23 attempts and verified cost', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    const runPairedEvaluation = jest.fn(
      async ({ live }: { live: Phase695LiveDependencies }) => {
        await invokePairedRuntimeCalls(live, 22);
        return report;
      },
    );
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation,
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    expect(evaluator.providerAttemptCount()).toBe(0);
    await expect(evaluator.runCanary()).resolves.toEqual({
      kind: 'complete',
      providerAttemptCount: 1,
      usageKnown: true,
    });
    expect(evaluator.providerAttemptCount()).toBe(1);
    const paired = await evaluator.runPaired();
    expect(paired).not.toHaveProperty('diagnostic');
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
        observedCostCny: Number(
          (
            ((report.counters.inputTokens + 12) * 3 +
              (report.counters.outputTokens + 4) * 6) /
            1_000_000
          ).toFixed(8),
        ),
        withinHardCap: true,
      },
    });
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.providerAttemptCount()).toBe(23);
    await evaluator.runPaired();
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
  });

  it('increments synchronously before a rejected provider dispatch', async () => {
    const harness = createExecutorHarness({
      executorError: new Error('PRIVATE_PROVIDER_FAILURE'),
      emitAudit: false,
    });
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    const pending = evaluator.runCanary();
    expect(evaluator.providerAttemptCount()).toBe(1);
    await expect(pending).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
  });

  it('blocks the 24th call before provider dispatch and keeps the count monotonic', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 23);
          return report;
        },
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();
    await expect(evaluator.runPaired()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.providerAttemptCount()).toBe(23);
  });

  it('atomically rejects the 23rd concurrent paired admission even when an earlier admission stays local', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    let concurrentResults: Awaited<
      ReturnType<Phase695LiveDependencies['runtime']['invokeStructured']>
    >[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          concurrentResults = await Promise.all(
            Array.from({ length: 23 }, (_, index) =>
              live.runtime.invokeStructured(
                index === 0
                  ? {
                      ...pairedRuntimeRequest('v8-concurrent-local'),
                      budget: {
                        ...pairedRuntimeRequest('v8-concurrent-local').budget,
                        usedCalls: 1,
                      },
                    }
                  : pairedRuntimeRequest(`v8-concurrent-${index}`),
              ),
            ),
          );
          return report;
        },
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();
    await expect(evaluator.runPaired()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(concurrentResults).toHaveLength(23);
    expect(concurrentResults[0]).toMatchObject({
      ok: false,
      error: { code: 'CALL_BUDGET_EXCEEDED' },
    });
    expect(concurrentResults[22]).toMatchObject({
      ok: false,
      error: { code: 'CALL_BUDGET_EXCEEDED' },
    });
    expect(harness.executor).toHaveBeenCalledTimes(22);
    expect(evaluator.providerAttemptCount()).toBe(22);
  });

  it.each([
    {
      label: 'missing usage',
      input: { usage: undefined, audit: { usageState: 'missing' } },
      code: 'provider_usage_missing',
    },
    {
      label: 'zero usage',
      input: {
        usage: { inputTokens: 0, outputTokens: 0 },
        audit: { usageState: 'invalid' },
      },
      code: 'provider_usage_invalid',
    },
    {
      label: 'lost audit',
      input: { emitAudit: false },
      code: 'sdk_usage_lost',
    },
    {
      label: 'thinking present',
      input: {
        audit: {
          reasoning: 'reported_positive',
          reasoningContentPresent: true,
          reportedReasoningTokens: 1,
        },
      },
      code: 'thinking_not_disabled',
    },
    {
      label: 'schema invalid',
      input: { object: { tool_calls: [{ name: 'unsafe' }] } },
      code: ReviewPlannerDiagnosticCode.StructuredOutput,
    },
  ])('fails safely when $label', async ({ input, code }) => {
    const harness = createExecutorHarness(input);
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await expect(evaluator.runCanary()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: code,
    });
    expect(evaluator.providerAttemptCount()).toBe(1);
  });

  it('closes aggregate usage and price-cap violations', async () => {
    const harness = createExecutorHarness({
      usage: { inputTokens: 97, outputTokens: 4 },
    });
    const report = await reservationExceededLiveReport();
    const evaluator =
      createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 22);
          return report;
        },
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();
    await expect(evaluator.runPaired()).resolves.toEqual({
      kind: 'failed',
      diagnosticCode: 'usage_reservation_exceeded',
    });
  });

  it('keeps the V8 eval gate CLI-local and the script/package output safe', () => {
    const root = resolve(__dirname, '../../../..');
    const packageJson = readFileSync(
      resolve(root, 'apps/server/package.json'),
      'utf8',
    );
    const script = readFileSync(
      resolve(
        root,
        'apps/server/scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts',
      ),
      'utf8',
    );
    const scripts = (JSON.parse(packageJson) as { scripts?: unknown }).scripts;
    expect(scripts).toMatchObject({
      'eval:review-planner:live:v8:stage-diagnostics':
        'bun scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts',
    });
    expect(script).toContain(
      'serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary',
    );
    expect(script).not.toMatch(
      /console\.|JSON\.stringify\(process\.env|DEEPSEEK_API_KEY/,
    );
    for (const relative of [
      'apps/server/src/config/env.ts',
      'docker/docker-compose.dev.yml',
      'apps/web',
      'apps/server/src/worker-readiness',
    ]) {
      if (relative.endsWith('.ts') || relative.endsWith('.yml')) {
        expect(readFileSync(resolve(root, relative), 'utf8')).not.toContain(
          'REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED',
        );
      }
    }
  });

  it('serializes the fixed top-level failure through the safe V8 serializer', () => {
    const root = resolve(__dirname, '../../../..');
    const script = readFileSync(
      resolve(
        root,
        'apps/server/scripts/review-planner-controlled-live-eval-v8-stage-diagnostics.ts',
      ),
      'utf8',
    );
    expect(script).not.toContain('FIXED_FAILURE');
    expect(script).not.toMatch(
      /['"]\{\\?"status\\?":\\?"invalid_attempted\\?"/,
    );
    expect(script).toMatch(
      /main\(\)\.catch\(\(\)\s*=>\s*\{[\s\S]*process\.stdout\.write\(\s*serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary\(\s*TOP_LEVEL_FAILURE,?\s*\)/,
    );
    expect(script).toMatch(/process\.exitCode\s*=\s*1/);
    expect(
      safeReviewPlannerControlledLiveV8SummarySchema.parse({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
      }),
    ).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
  });
});

function createExecutorHarness(
  input: {
    usage?: { inputTokens?: number; outputTokens?: number };
    audit?: Record<string, unknown>;
    object?: unknown;
    emitAudit?: boolean;
    executorError?: Error;
  } = {},
) {
  let onAudit: ((audit: never) => void) | undefined;
  const executor = jest.fn(() => {
    if (input.emitAudit !== false) {
      onAudit?.({
        reasoning: 'reported_zero',
        reasoningContentPresent: false,
        reportedReasoningTokens: 0,
        usageState: 'positive',
        ...input.audit,
      } as never);
    }
    if (input.executorError) return Promise.reject(input.executorError);
    return Promise.resolve({
      object: input.object ?? {
        focusIndexes: [0],
        diagnosis: 'review_pressure',
      },
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
  live: Phase695LiveDependencies,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    await live.runtime.invokeStructured(pairedRuntimeRequest(`v8-${index}`));
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
  return phase695ReportSchema.parse({
    ...mock,
    mode: 'live',
    caseEntries,
    counters: {
      ...mock.counters,
      inputTokens: caseEntries.reduce(
        (sum, entry) => sum + entry.usage.inputTokens,
        0,
      ),
      outputTokens: caseEntries.reduce(
        (sum, entry) => sum + entry.usage.outputTokens,
        0,
      ),
    },
    productionDecision: 'quality_gate_passed',
  });
}

async function reservationExceededLiveReport(): Promise<Phase695Report> {
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
      inputTokens: caseEntries.reduce(
        (sum, entry) => sum + entry.usage.inputTokens,
        0,
      ),
      outputTokens: caseEntries.reduce(
        (sum, entry) => sum + entry.usage.outputTokens,
        0,
      ),
    },
  });
}
