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
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
  createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator,
  validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.factory';
import {
  v9GateDiagnosticSchema,
  type V9GateDiagnostic,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

const readyEnv = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'false',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v9-private-test-key',
  REVIEW_AGENT_MODEL_TIMEOUT_MS: '4500',
  PLANNER_AGENT_MODEL_TIMEOUT_MS: '4500',
});

describe('review planner controlled Live V9 gate diagnostics factory', () => {
  it('owns an isolated V9 gate and never mutates the caller V8 gate', () => {
    const env = Object.freeze({ ...readyEnv });
    const harness = createExecutorHarness();

    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED,
    ).toBe('REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED');
    expect(
      validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight(env),
    ).toEqual({ ok: true });
    expect(
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(env, {
        createExecutor: harness.createExecutor,
      }).state,
    ).toBe('ready');
    expect(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED).toBe('false');
  });

  it.each([
    {
      name: 'missing V9 gate',
      env: {
        ...readyEnv,
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED:
          undefined,
      },
    },
    {
      name: 'false V9 gate',
      env: {
        ...readyEnv,
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED:
          'false',
      },
    },
    {
      name: 'external V8 true',
      env: {
        ...readyEnv,
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'true',
      },
    },
    {
      name: 'throwing V9 getter',
      env: Object.defineProperty(
        { ...readyEnv },
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED,
        {
          enumerable: true,
          get() {
            throw new Error('PRIVATE_V9_GATE');
          },
        },
      ),
    },
  ])('rejects $name before executor construction', ({ env }) => {
    const createExecutor = jest.fn();

    expect(
      validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight(env),
    ).toEqual({ ok: false, diagnosticCode: 'preflight_invalid' });
    expect(
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(env, {
        createExecutor,
      }),
    ).toMatchObject({
      state: 'closed',
      diagnosticCode: 'preflight_invalid',
      identity: null,
    });
    expect(createExecutor).not.toHaveBeenCalled();
  });

  it('captures exactly one strict aggregate from the existing 23-attempt run', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    const diagnostics: V9GateDiagnostic[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 22);
          return report;
        },
        onGateDiagnostic: (value) => diagnostics.push(value),
      });

    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID).toBe(
      'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics',
    );
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();
    const paired = await evaluator.runPaired();

    expect(diagnostics).toHaveLength(1);
    expect(paired.diagnostic).toEqual(diagnostics[0]);
    expect(paired.diagnostic).not.toBe(diagnostics[0]);
    expect(paired.diagnostic.gates).not.toBe(diagnostics[0]?.gates);
    expect(paired.diagnostic.report).not.toBe(diagnostics[0]?.report);
    expect(paired.result.kind).toBe('report');
    expect(paired.diagnostic.attempts).toEqual({
      providerCount: 23,
      expectedProviderCount: 23,
      pairedAdmissionCount: 22,
      expectedPairedAdmissionCount: 22,
      overflow: false,
      auditRecordCount: 23,
    });
    expect(evaluator.providerAttemptCount()).toBe(23);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.profileId).toBe(
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
    );
    const keys = collectKeys(diagnostics[0]);
    for (const forbidden of [
      'caseId',
      'prompt',
      'output',
      'response',
      'reasoning',
      'rawError',
      'stack',
      'header',
      'url',
      'key',
      'cookie',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('isolates a deep-frozen callback snapshot from hostile mutation', async () => {
    const harness = createExecutorHarness();
    const report = await validLiveReport();
    let callbackDiagnostic: V9GateDiagnostic | null = null;
    const mutationResults: boolean[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 22);
          return report;
        },
        onGateDiagnostic(value) {
          callbackDiagnostic = value;
          mutationResults.push(
            Reflect.set(value.gates, 'quality', 'failed'),
            Reflect.set(value.report, 'caseEntries', 1),
            Reflect.set(value as object, 'prompt', 'forbidden'),
            Reflect.set(value as object, 'output', 'forbidden'),
            Reflect.set(value as object, 'rawError', 'forbidden'),
          );
        },
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();

    const paired = await evaluator.runPaired();

    expect(mutationResults).toEqual([false, false, false, false, false]);
    expect(callbackDiagnostic).not.toBeNull();
    expect(Object.isFrozen(callbackDiagnostic)).toBe(true);
    expect(Object.isFrozen(callbackDiagnostic?.gates)).toBe(true);
    expect(Object.isFrozen(callbackDiagnostic?.report)).toBe(true);
    expect(paired.diagnostic).not.toBe(callbackDiagnostic);
    expect(paired.diagnostic.gates).not.toBe(callbackDiagnostic?.gates);
    expect(paired.diagnostic.report).not.toBe(callbackDiagnostic?.report);
    expect(() => v9GateDiagnosticSchema.parse(paired.diagnostic)).not.toThrow();
    expect(paired.diagnostic).toMatchObject({
      report: { caseEntries: 48 },
      gates: { quality: 'passed' },
    });
    for (const forbidden of ['prompt', 'output', 'rawError']) {
      expect(collectKeys(paired.diagnostic)).not.toContain(forbidden);
    }
  });

  it('marks usage unknown when a schema-invalid runtime entry reports zero usage', async () => {
    const harness = createExecutorHarness();
    const report = await schemaInvalidRuntimeLiveReport();
    const diagnostics: V9GateDiagnostic[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          await invokePairedRuntimeCalls(live, 22);
          return report;
        },
        onGateDiagnostic: (value) => diagnostics.push(value),
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();

    const paired = await evaluator.runPaired();

    expect(paired.result).toEqual({
      kind: 'failed',
      diagnosticCode: 'invalid_response',
    });
    expect(diagnostics).toHaveLength(1);
    expect(paired.diagnostic.usage).toEqual({
      known: false,
      reason: 'usage_unverifiable',
    });
    expect(paired.diagnostic.cost).toEqual({
      evaluated: false,
      reason: 'usage_unverifiable',
    });
  });

  it('contains a hostile report projection and still publishes exactly once', async () => {
    const harness = createExecutorHarness();
    const diagnostics: V9GateDiagnostic[] = [];
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => ['schemaVersion'],
        getOwnPropertyDescriptor: () => ({
          enumerable: true,
          configurable: true,
        }),
        get(_target, property) {
          if (property === 'then') return undefined;
          throw new Error('PRIVATE_HOSTILE_REPORT');
        },
      },
    ) as Phase695Report;
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: () => Promise.resolve(hostile),
        onGateDiagnostic: (value) => diagnostics.push(value),
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();

    const paired = await evaluator.runPaired();

    expect(paired.result).toEqual({
      kind: 'failed',
      diagnosticCode: 'transport',
    });
    expect(diagnostics).toHaveLength(1);
    expect(paired.diagnostic).toMatchObject({
      report: { schemaValid: false },
      usage: { known: false, reason: 'usage_unverifiable' },
      cost: { evaluated: false, reason: 'usage_unverifiable' },
    });
  });

  it('swallows callback failure without changing the V8 paired result', async () => {
    const harness = createExecutorHarness();
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: () => Promise.resolve({} as Phase695Report),
        onGateDiagnostic() {
          throw new Error('PRIVATE_CALLBACK_FAILURE');
        },
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await evaluator.runCanary();

    await expect(evaluator.runPaired()).resolves.toMatchObject({
      result: { kind: 'failed', diagnosticCode: 'invalid_response' },
      diagnostic: { report: { schemaValid: false } },
    });
  });

  it.each([
    'audit_failure',
    'audit_count_mismatch',
    'invalid_report',
    'reservation_exceeded',
    'admission_overflow',
    'runner_throw',
  ] as const)('publishes exactly once for paired branch %s', async (branch) => {
    const harness = createExecutorHarness({
      auditForCall:
        branch === 'audit_failure'
          ? (call) =>
              call === 1
                ? defaultAudit()
                : { ...defaultAudit(), usageState: 'missing' }
          : branch === 'audit_count_mismatch'
            ? (call) => (call === 1 ? defaultAudit() : null)
            : undefined,
      usageForCall:
        branch === 'reservation_exceeded'
          ? (call) =>
              call === 1
                ? { inputTokens: 97, outputTokens: 4 }
                : { inputTokens: 12, outputTokens: 4 }
          : undefined,
    });
    const report =
      branch === 'reservation_exceeded'
        ? await reservationExceededLiveReport()
        : await validLiveReport();
    const diagnostics: V9GateDiagnostic[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          if (branch === 'runner_throw')
            throw new Error('private runner failure');
          if (branch === 'invalid_report') return {} as Phase695Report;
          await invokePairedRuntimeCalls(
            live,
            branch === 'admission_overflow' ? 23 : 22,
          );
          return report;
        },
        onGateDiagnostic: (value) => diagnostics.push(value),
      });
    if (evaluator.state !== 'ready') throw new Error('expected ready');
    await expect(evaluator.runCanary()).resolves.toMatchObject({
      kind: 'complete',
    });

    const paired = await evaluator.runPaired();
    const repeated = await evaluator.runPaired();

    expect(diagnostics).toHaveLength(1);
    expect(paired).toBe(repeated);
    expect(paired.diagnostic).toEqual(diagnostics[0]);
    expect(paired.diagnostic).not.toBe(diagnostics[0]);
    expect(paired.result.kind).toBe('failed');
    expect(paired.diagnostic.state).toBe('diagnostic_candidate');
  });
});

function createExecutorHarness(
  input: {
    auditForCall?: (call: number) => Record<string, unknown> | null;
    usageForCall?: (call: number) => {
      inputTokens: number;
      outputTokens: number;
    };
  } = {},
) {
  let onAudit: ((audit: never) => void) | undefined;
  let call = 0;
  const executor = jest.fn(() => {
    call += 1;
    const audit = input.auditForCall
      ? input.auditForCall(call)
      : defaultAudit();
    if (audit) onAudit?.(audit as never);
    return Promise.resolve({
      object: { focusIndexes: [0], diagnosis: 'review_pressure' },
      usage: input.usageForCall?.(call) ?? {
        inputTokens: 12,
        outputTokens: 4,
      },
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

function defaultAudit(): Record<string, unknown> {
  return {
    reasoning: 'reported_zero',
    reasoningContentPresent: false,
    reportedReasoningTokens: 0,
    usageState: 'positive',
  };
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
    await live.runtime.invokeStructured(pairedRuntimeRequest(`v9-${index}`));
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

async function schemaInvalidRuntimeLiveReport(): Promise<Phase695Report> {
  const report = await validLiveReport();
  const targetIndex = report.caseEntries.findIndex(
    (entry) =>
      entry.executionKind === 'runtime' &&
      !entry.caseId.endsWith('_21') &&
      !entry.caseId.endsWith('_22'),
  );
  if (targetIndex < 0) throw new Error('expected non-critical runtime entry');
  const target = report.caseEntries[targetIndex];
  const caseEntries = report.caseEntries.map((entry, index) =>
    index === targetIndex
      ? {
          ...entry,
          strictSuccess: false,
          qualityPass: false,
          usage: { inputTokens: 0, outputTokens: 0 },
          gate: 'candidate_rejected' as const,
          diagnosticCode: 'structured_output' as const,
        }
      : entry,
  );
  return phase695ReportSchema.parse({
    ...report,
    caseEntries,
    counters: {
      ...report.counters,
      strictSuccesses: report.counters.strictSuccesses - 1,
      qualityPasses: report.counters.qualityPasses - 1,
      inputTokens: report.counters.inputTokens - target.usage.inputTokens,
      outputTokens: report.counters.outputTokens - target.usage.outputTokens,
    },
    metrics: {
      ...report.metrics,
      strictSchemaSuccessRate: 21 / 22,
      semanticQualityRate: 21 / 22,
    },
    productionDecision: 'strict_schema_incomplete',
  });
}

function collectKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
