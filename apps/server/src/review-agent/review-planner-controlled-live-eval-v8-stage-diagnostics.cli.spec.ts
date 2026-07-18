import {
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  PHASE_695_SHARED_BUDGET,
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  phase695ReviewPlannerCases,
  type Phase695Report,
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_CONFIRMATION,
  runReviewPlannerControlledLiveV8StageDiagnosticsCli,
  serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary,
  type ReviewPlannerControlledLiveV8CliDependencies,
  type ReviewPlannerControlledLiveV8EvaluatorPort,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.cli';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES,
  type ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot,
  type ReviewPlannerControlledLiveV8Stage,
  type SafeReviewPlannerControlledLiveV8Summary,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

const confirmation =
  '--confirm-controlled-live-v8-deepseek-v4-pro-stage-diagnostics';
const historicalSnapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot =
  Object.freeze({
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v4',
    treeHash: 'a'.repeat(64),
    entries: Object.freeze([]),
  });

describe('review planner controlled Live V8 stage diagnostics CLI', () => {
  it('exports the exact one-shot confirmation', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V8_CONFIRMATION).toBe(confirmation);
  });

  it.each([
    { argv: [] },
    { argv: [confirmation, '--extra'] },
    { argv: ['--confirm-controlled-live-v7'] },
  ])(
    'rejects a non-exact confirmation before preflight and all capabilities',
    async ({ argv }) => {
      const harness = createHarness();

      await expect(runCli(harness, argv)).resolves.toEqual(blocked());
      expect(harness.events).toEqual([]);
    },
  );

  it.each(['closed', 'throw'] as const)(
    'blocks a %s preflight with zero attempts before snapshot/reserve/evaluator',
    async (mode) => {
      const harness = createHarness({ preflight: mode });

      await expect(runCli(harness)).resolves.toEqual(blocked());
      expect(harness.events).toEqual(['preflight']);
    },
  );

  it('contains a throwing preflight result getter before every capability', async () => {
    const harness = createHarness({ preflight: 'getter' });

    await expect(runCli(harness)).resolves.toEqual(blocked());
    expect(harness.events).toEqual(['preflight']);
  });

  it('runs the exact stage order, one canary Promise, one paired Promise, one finalizer, and a fresh committed read', async () => {
    const harness = createHarness();

    await expect(runCli(harness)).resolves.toEqual(completeSummary());
    expect(harness.events).toEqual([
      'preflight',
      'snapshot',
      'reserve',
      'markAttempted',
      'createEvaluator',
      'providerAttemptCount',
      '.stage-030-evaluator-ready',
      'verifyHistory',
      'providerAttemptCount',
      '.stage-040-provider-history-verified',
      'providerAttemptCount',
      '.stage-050-canary-started',
      'runCanary',
      'providerAttemptCount',
      '.stage-060-canary-returned',
      'providerAttemptCount',
      '.stage-070-paired-started',
      'runPaired',
      'providerAttemptCount',
      '.stage-080-paired-returned',
      'providerAttemptCount',
      '.stage-090-report-validated',
      'finalize',
      'read',
    ]);
    expect(harness.runCanary).toHaveBeenCalledTimes(1);
    expect(harness.runPaired).toHaveBeenCalledTimes(1);
    expect(harness.finalizeEvidence).toHaveBeenCalledTimes(1);
    expect(harness.readEvidence).toHaveBeenCalledTimes(1);
    expect(harness.finalizeEvidence).toHaveBeenCalledWith({
      reservation: harness.reservation,
      summary: completeSummary(),
    });
  });

  it.each(['snapshot', 'reserve', 'mark_false', 'mark_throw'] as const)(
    'fails a %s boundary without constructing an evaluator or retrying',
    async (failure) => {
      const harness = createHarness({ failure });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.events).not.toContain('createEvaluator');
      expect(harness.runCanary).not.toHaveBeenCalled();
      expect(harness.runPaired).not.toHaveBeenCalled();
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
      expect(harness.readEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(['closed', 'throw'] as const)(
    'stops a %s evaluator before stage 030 and provider work',
    async (mode) => {
      const harness = createHarness({ evaluator: mode });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(
          0,
          mode === 'closed'
            ? ReviewPlannerDiagnosticCode.Transport
            : ReviewPlannerDiagnosticCode.ExecutorInit,
        ),
      );
      expect(harness.events.at(-1)).toBe('createEvaluator');
      expect(harness.runCanary).not.toHaveBeenCalled();
      expect(harness.runPaired).not.toHaveBeenCalled();
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['state getter', 'state_getter'],
    ['closed diagnostic getter', 'diagnostic_getter'],
    ['ready identity getter', 'identity_getter'],
  ] as const)(
    'contains an evaluator %s as a safe executor-init closure',
    async (_name, evaluator) => {
      const harness = createHarness({ evaluator });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(0, ReviewPlannerDiagnosticCode.ExecutorInit),
      );
      expect(harness.runCanary).not.toHaveBeenCalled();
      expect(harness.runPaired).not.toHaveBeenCalled();
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(
    REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.slice(2, 9).flatMap((stage) => [
      { stage, mode: 'false' as const },
      { stage, mode: 'throw' as const },
    ]),
  )(
    'stops after $stage $mode without a retry or any later dependency',
    async ({ stage, mode }) => {
      const harness = createHarness({ stageFailure: { stage, mode } });

      const summary = await runCli(harness);

      expect(summary).toEqual(
        attempted(harness.attempts(), ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.events.at(-1)).toBe(stage);
      expect(harness.events.filter((event) => event === stage)).toHaveLength(1);
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
      expect(harness.readEvidence).not.toHaveBeenCalled();
    },
  );

  it('stops safely when the attempt getter throws before a stage and calls nothing later', async () => {
    const harness = createHarness({ getterThrowAt: 3 });

    await expect(runCli(harness)).resolves.toEqual(
      attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(harness.events.at(-1)).toBe('providerAttemptCount');
    expect(harness.events).not.toContain('.stage-050-canary-started');
    expect(harness.runCanary).not.toHaveBeenCalled();
    expect(harness.runPaired).not.toHaveBeenCalled();
    expect(harness.finalizeEvidence).not.toHaveBeenCalled();
  });

  it('stops history drift before stage 040 and provider work', async () => {
    const harness = createHarness({ historyFailure: true });

    await expect(runCli(harness)).resolves.toEqual(
      attempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(harness.events.at(-1)).toBe('verifyHistory');
    expect(harness.runCanary).not.toHaveBeenCalled();
    expect(harness.runPaired).not.toHaveBeenCalled();
  });

  it.each(['throw', 'diagnostic', 'malformed'] as const)(
    'stops a canary %s after the single canary boundary and never starts paired',
    async (canary) => {
      const harness = createHarness({ canary });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(
          1,
          canary === 'diagnostic'
            ? 'provider_usage_missing'
            : canary === 'throw'
              ? ReviewPlannerDiagnosticCode.EvidenceIo
              : ReviewPlannerDiagnosticCode.InvalidResponse,
        ),
      );
      expect(harness.runCanary).toHaveBeenCalledTimes(1);
      expect(harness.runPaired).not.toHaveBeenCalled();
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(['kind_getter', 'diagnostic_getter'] as const)(
    'contains a canary %s proxy as safe invalid_response',
    async (canary) => {
      const harness = createHarness({ canary });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(1, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
      expect(harness.runCanary).toHaveBeenCalledTimes(1);
      expect(harness.runPaired).not.toHaveBeenCalled();
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(['throw', 'diagnostic'] as const)(
    'stops a paired %s after one paired Promise without report validation',
    async (paired) => {
      const harness = createHarness({ paired });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(
          23,
          paired === 'throw'
            ? ReviewPlannerDiagnosticCode.EvidenceIo
            : ReviewPlannerDiagnosticCode.StructuredOutput,
        ),
      );
      expect(harness.runCanary).toHaveBeenCalledTimes(1);
      expect(harness.runPaired).toHaveBeenCalledTimes(1);
      expect(harness.events).not.toContain('.stage-090-report-validated');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'initial one', sequence: [1], expected: 0 },
    { name: 'initial twenty-three', sequence: [23], expected: 0 },
    { name: 'zero to invalid regression', sequence: [0, -1], expected: 0 },
    { name: 'one to zero regression', sequence: [0, 0, 0, 1, 0], expected: 1 },
    {
      name: 'twenty-three to one regression',
      sequence: [0, 0, 0, 1, 1, 23, 1],
      expected: 23,
    },
  ])(
    'stops an inexact attempt checkpoint: $name',
    async ({ sequence, expected }) => {
      const harness = createHarness({ attemptSequence: sequence });

      const summary = await runCli(harness);

      expect(summary).toEqual(
        attempted(expected, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
      expect(harness.readEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'canary', canary: 'throw' as const, expected: 1 },
    { name: 'paired', paired: 'throw' as const, expected: 23 },
  ])(
    'refreshes exactly once after a rejected $name Promise and does not under-report',
    async ({ canary, paired, expected }) => {
      const harness = createHarness({ canary, paired });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(expected, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.events.at(-1)).toBe('providerAttemptCount');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'canary', canary: 'throw' as const, getterThrowAt: 4, expected: 0 },
    { name: 'paired', paired: 'throw' as const, getterThrowAt: 6, expected: 1 },
  ])(
    'keeps the maximum trusted lower bound when the $name rejection checkpoint getter throws',
    async ({ canary, paired, getterThrowAt, expected }) => {
      const harness = createHarness({ canary, paired, getterThrowAt });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(expected, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.events.at(-1)).toBe('providerAttemptCount');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['caseEntries', { counters: { caseEntries: 47 } }],
    ['zeroCallCases', { counters: { zeroCallCases: 25 } }],
    ['runtimeInvocations', { counters: { runtimeInvocations: 21 } }],
  ] as const)(
    'rejects a bad %s aggregate before stage 090/finalization',
    async (_name, mutation) => {
      const report = qualityReport() as unknown as Record<string, unknown>;
      const harness = createHarness({
        report: {
          ...report,
          counters: {
            ...(report.counters as Record<string, unknown>),
            ...mutation.counters,
          },
        },
      });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
      expect(harness.events.at(-1)).toBe('.stage-080-paired-returned');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['semantic below 90%', semanticFailureReport()],
    ['P95 above 4500ms', latencyFailureReport()],
    ['Mock mode', { ...qualityReport(), mode: 'mock' }],
    ['unknown field', { ...qualityReport(), prompt: 'private prompt' }],
  ])('rejects a strict/quality-invalid %s report', async (_name, report) => {
    const harness = createHarness({ report });

    await expect(runCli(harness)).resolves.toEqual(
      attempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
    );
    expect(harness.events).not.toContain('.stage-090-report-validated');
    expect(harness.finalizeEvidence).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'null cost',
      report: qualityReport(),
      cost: null,
    },
    {
      name: 'throwing cost proxy',
      report: qualityReport(),
      cost: new Proxy(qualityCost(), {
        get() {
          throw new Error('PRIVATE_COST_GETTER');
        },
      }),
    },
    {
      name: 'throwing report proxy',
      report: new Proxy(
        {},
        {
          get() {
            throw new Error('PRIVATE_REPORT_GETTER');
          },
        },
      ),
      cost: qualityCost(),
    },
  ])(
    'contains a hostile paired $name as safe invalid_response',
    async ({ report, cost }) => {
      const harness = createHarness({ report, rawCost: cost });

      const summary = await runCli(harness);

      expect(summary).toEqual(
        attempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
      expect(
        serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(summary),
      ).not.toMatch(
        /PRIVATE_|"(?:prompt|response|rawError|stack|apiKey)"\s*:/i,
      );
      expect(harness.events).not.toContain('.stage-090-report-validated');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'attempts', attemptsAfterPaired: 22, cost: {} },
    {
      name: 'zero input usage',
      attemptsAfterPaired: 23,
      cost: { observedInputTokens: 0 },
    },
    {
      name: 'input usage cap',
      attemptsAfterPaired: 23,
      cost: { observedInputTokens: 42_997 },
    },
    {
      name: 'output usage cap',
      attemptsAfterPaired: 23,
      cost: { observedOutputTokens: 9_713 },
    },
    {
      name: 'price profile',
      attemptsAfterPaired: 23,
      cost: { priceProfileId: 'wrong-profile' },
    },
    {
      name: 'calculated cost',
      attemptsAfterPaired: 23,
      cost: { observedCostCny: 0.01 },
    },
    {
      name: 'hard cap',
      attemptsAfterPaired: 23,
      cost: { observedCostCny: 1.01 },
    },
  ])(
    'rejects invalid $name without completing',
    async ({ attemptsAfterPaired, cost }) => {
      const harness = createHarness({
        attemptsAfterPaired,
        cost,
      });

      await expect(runCli(harness)).resolves.toEqual(
        attemptsAfterPaired === 22
          ? attempted(1, ReviewPlannerDiagnosticCode.EvidenceIo)
          : attempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
      expect(harness.events).not.toContain('.stage-090-report-validated');
      expect(harness.finalizeEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(['false', 'throw'] as const)(
    'returns evidence_io when finalization %s and does not read/retry',
    async (finalizeFailure) => {
      const harness = createHarness({ finalizeFailure });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(23, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.finalizeEvidence).toHaveBeenCalledTimes(1);
      expect(harness.readEvidence).not.toHaveBeenCalled();
    },
  );

  it.each(['throw', 'mismatch'] as const)(
    'returns evidence_io after a fresh committed reader %s without rewriting',
    async (readFailure) => {
      const harness = createHarness({ readFailure });

      await expect(runCli(harness)).resolves.toEqual(
        attempted(23, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(harness.finalizeEvidence).toHaveBeenCalledTimes(1);
      expect(harness.readEvidence).toHaveBeenCalledTimes(1);
    },
  );

  it('serializes only the strict safe summary with a fixed JSON newline', () => {
    expect(
      serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(
        completeSummary(),
      ),
    ).toBe(`${JSON.stringify(completeSummary())}\n`);
    expect(() =>
      serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary({
        ...completeSummary(),
        prompt: 'private prompt',
      } as never),
    ).toThrow();
    expect(
      serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(
        attempted(1, ReviewPlannerDiagnosticCode.Transport),
      ),
    ).not.toMatch(
      /prompt|response|raw.?error|env|api.?key|secret|url|header|cookie|stack|path/i,
    );
  });
});

type HarnessOptions = Readonly<{
  preflight?: 'ready' | 'closed' | 'throw' | 'getter';
  failure?: 'snapshot' | 'reserve' | 'mark_false' | 'mark_throw';
  evaluator?:
    | 'ready'
    | 'closed'
    | 'throw'
    | 'state_getter'
    | 'diagnostic_getter'
    | 'identity_getter';
  stageFailure?: Readonly<{
    stage: ReviewPlannerControlledLiveV8Stage;
    mode: 'false' | 'throw';
  }>;
  historyFailure?: boolean;
  canary?:
    | 'complete'
    | 'throw'
    | 'diagnostic'
    | 'malformed'
    | 'kind_getter'
    | 'diagnostic_getter';
  paired?: 'report' | 'throw' | 'diagnostic';
  report?: unknown;
  attemptsAfterPaired?: number;
  cost?: Readonly<Record<string, unknown>>;
  rawCost?: unknown;
  getterThrowAt?: number;
  attemptSequence?: readonly number[];
  finalizeFailure?: 'false' | 'throw';
  readFailure?: 'throw' | 'mismatch';
}>;

function createHarness(options: HarnessOptions = {}) {
  const events: string[] = [];
  let providerAttempts = 0;
  let getterCalls = 0;
  let finalizedSummary: SafeReviewPlannerControlledLiveV8Summary | undefined;
  const reservation = {
    relativePath: 'docs/acceptance/evidence/v8/review-planner-live-run.json',
    markAttempted: jest.fn(() => {
      events.push('markAttempted');
      if (options.failure === 'mark_throw') {
        return Promise.reject(new Error('private mark failure'));
      }
      return Promise.resolve(options.failure !== 'mark_false');
    }),
  };
  const runCanary = jest.fn(() => {
    events.push('runCanary');
    providerAttempts = 1;
    if (options.canary === 'throw') {
      return Promise.reject(new Error('private canary failure'));
    }
    if (options.canary === 'kind_getter') {
      return Promise.resolve(
        new Proxy(
          {},
          {
            get(_target, property) {
              if (property === 'then') return undefined;
              throw new Error('PRIVATE_CANARY_KIND_GETTER');
            },
          },
        ) as never,
      );
    }
    if (options.canary === 'diagnostic_getter') {
      return Promise.resolve({
        kind: 'failed' as const,
        get diagnosticCode() {
          throw new Error('PRIVATE_CANARY_DIAGNOSTIC_GETTER');
        },
      } as never);
    }
    if (options.canary === 'diagnostic') {
      return Promise.resolve({
        kind: 'failed' as const,
        diagnosticCode: 'provider_usage_missing' as const,
      });
    }
    if (options.canary === 'malformed') {
      return Promise.resolve({ kind: 'complete' as const, usageKnown: false });
    }
    return Promise.resolve({
      kind: 'complete' as const,
      providerAttemptCount: 1 as const,
      usageKnown: true as const,
    });
  });
  const runPaired = jest.fn(() => {
    events.push('runPaired');
    providerAttempts = options.attemptsAfterPaired ?? 23;
    if (options.paired === 'throw') {
      return Promise.reject(new Error('private paired failure'));
    }
    if (options.paired === 'diagnostic') {
      return Promise.resolve({
        kind: 'failed' as const,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      });
    }
    return Promise.resolve({
      kind: 'report' as const,
      report: options.report ?? qualityReport(),
      cost:
        options.rawCost === undefined
          ? { ...qualityCost(), ...options.cost }
          : options.rawCost,
    });
  });
  const evaluator: ReviewPlannerControlledLiveV8EvaluatorPort = {
    state: 'ready',
    identity: evaluatorIdentity(),
    runCanary,
    runPaired,
    providerAttemptCount: () => {
      events.push('providerAttemptCount');
      getterCalls += 1;
      if (getterCalls === options.getterThrowAt) {
        throw new Error('PRIVATE_ATTEMPT_GETTER');
      }
      return options.attemptSequence?.[getterCalls - 1] ?? providerAttempts;
    },
  };
  const finalizeEvidence = jest.fn(
    (input: { summary: SafeReviewPlannerControlledLiveV8Summary }) => {
      events.push('finalize');
      finalizedSummary = input.summary;
      if (options.finalizeFailure === 'throw') {
        return Promise.reject(new Error('private finalize failure'));
      }
      return Promise.resolve(options.finalizeFailure !== 'false');
    },
  );
  const readEvidence = jest.fn(() => {
    events.push('read');
    if (options.readFailure === 'throw') {
      return Promise.reject(new Error('private read failure'));
    }
    const summary = finalizedSummary ?? completeSummary();
    return Promise.resolve(
      options.readFailure === 'mismatch'
        ? committedRecord({ ...summary, providerAttemptCount: 22 } as never)
        : committedRecord(summary),
    );
  });
  const dependencies: ReviewPlannerControlledLiveV8CliDependencies = {
    validatePreflight: () => {
      events.push('preflight');
      if (options.preflight === 'throw') throw new Error('private preflight');
      if (options.preflight === 'getter') {
        return new Proxy(
          {},
          {
            get() {
              throw new Error('PRIVATE_PREFLIGHT_GETTER');
            },
          },
        ) as never;
      }
      return options.preflight === 'closed'
        ? {
            ok: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
          }
        : { ok: true };
    },
    snapshotHistoricalEvidence: () => {
      events.push('snapshot');
      return options.failure === 'snapshot'
        ? Promise.reject(new Error('private snapshot'))
        : Promise.resolve(historicalSnapshot);
    },
    verifyHistoricalEvidence: () => {
      events.push('verifyHistory');
      return options.historyFailure
        ? Promise.reject(new Error('private history drift'))
        : Promise.resolve(historicalSnapshot);
    },
    reserveEvidence: () => {
      events.push('reserve');
      return options.failure === 'reserve'
        ? Promise.reject(new Error('private reserve'))
        : Promise.resolve(reservation);
    },
    advanceStage: (_reservation, stage) => {
      events.push(stage);
      if (options.stageFailure?.stage === stage) {
        if (options.stageFailure.mode === 'throw') {
          throw new Error('private stage failure');
        }
        return false;
      }
      return true;
    },
    createEvaluator: () => {
      events.push('createEvaluator');
      if (options.evaluator === 'throw') {
        throw new Error('private evaluator failure');
      }
      if (options.evaluator === 'state_getter') {
        return new Proxy(
          {},
          {
            get() {
              throw new Error('PRIVATE_EVALUATOR_STATE_GETTER');
            },
          },
        ) as never;
      }
      if (options.evaluator === 'diagnostic_getter') {
        return {
          state: 'closed' as const,
          identity: evaluatorIdentity(),
          get diagnosticCode() {
            throw new Error('PRIVATE_EVALUATOR_DIAGNOSTIC_GETTER');
          },
          providerAttemptCount: () => 0,
        } as never;
      }
      if (options.evaluator === 'identity_getter') {
        return {
          state: 'ready' as const,
          get identity() {
            throw new Error('PRIVATE_EVALUATOR_IDENTITY_GETTER');
          },
          runCanary,
          runPaired,
          providerAttemptCount: () => 0,
        } as never;
      }
      return options.evaluator === 'closed'
        ? {
            state: 'closed',
            identity: evaluatorIdentity(),
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
            providerAttemptCount: () => 0,
          }
        : evaluator;
    },
    finalizeEvidence,
    readEvidence,
  };
  return {
    dependencies,
    events,
    reservation,
    runCanary,
    runPaired,
    finalizeEvidence,
    readEvidence,
    attempts: () => providerAttempts,
  };
}

function runCli(
  harness: ReturnType<typeof createHarness>,
  argv: readonly string[] = [confirmation],
) {
  return runReviewPlannerControlledLiveV8StageDiagnosticsCli(
    {
      argv,
      env: Object.freeze({ PRIVATE_API_KEY: 'never-serialize-me' }),
      root: 'injected-v8-root',
      now: () => Date.parse('2026-07-18T12:00:00.000Z'),
      runId: 'v8-cli-injected-run',
    },
    harness.dependencies,
  );
}

function evaluatorIdentity() {
  return {
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro' as const,
    baseUrlIdentity: 'deepseek-v1' as const,
    structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' as const,
    timeoutMs: 4_500 as const,
    schemaId: 'review-model-candidate-v1' as const,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  };
}

function blocked(): SafeReviewPlannerControlledLiveV8Summary {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function attempted(
  providerAttemptCount: number,
  diagnosticCode: Extract<
    SafeReviewPlannerControlledLiveV8Summary,
    { status: 'invalid_attempted' }
  >['diagnosticCode'],
): SafeReviewPlannerControlledLiveV8Summary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount,
    usageKnown: false,
    diagnosticCode,
  };
}

function completeSummary(): SafeReviewPlannerControlledLiveV8Summary {
  return {
    status: 'complete',
    gate: 'closed',
    providerAttemptCount: 23,
    usageKnown: true,
    aggregateInputTokens: 2_210,
    aggregateOutputTokens: 225,
    observedCostCny: 0.00798,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    caseEntries: 48,
    zeroCallCases: 26,
    runtimeInvocations: 22,
    strictSuccesses: 48,
    qualityPasses: 48,
    criticalFailures: 0,
  };
}

function committedRecord(summary: SafeReviewPlannerControlledLiveV8Summary) {
  return {
    schemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v8-stage-diagnostics',
    state: 'finalized',
    ...summary,
    lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.at(-1),
  };
}

function qualityCost() {
  return {
    currency: 'CNY' as const,
    nonCachedInputCnyPerMillionTokens: 3 as const,
    outputCnyPerMillionTokens: 6 as const,
    hardCapCny: 1 as const,
    maxPairedProviderAttempts: 22 as const,
    maxProviderAttempts: 23 as const,
    reservedInputTokens: 42_996 as const,
    reservedOutputTokens: 9_712 as const,
    reservedCostCny: 0.18726 as const,
    observedInputTokens: 2_210,
    observedOutputTokens: 225,
    observedCostCny: 0.00798,
    withinHardCap: true as const,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  };
}

function qualityReport(): Phase695Report {
  return buildReport();
}

function semanticFailureReport(): Phase695Report {
  return buildReport({ semanticFailures: 3 });
}

function latencyFailureReport(): Phase695Report {
  return buildReport({ slowRuntimeCases: 2 });
}

function buildReport(
  options: Readonly<{
    semanticFailures?: number;
    slowRuntimeCases?: number;
  }> = {},
): Phase695Report {
  let semanticFailures = options.semanticFailures ?? 0;
  let slowRuntimeCases = options.slowRuntimeCases ?? 0;
  const caseEntries = phase695ReviewPlannerCases.map((testCase) => {
    if (testCase.executionKind === 'zero_call') {
      return {
        caseId: testCase.id,
        lane: testCase.lane,
        executionKind: 'zero_call' as const,
        zeroCallVerified: true,
        runtimeInvocations: 0 as const,
        strictSuccess: true,
        qualityPass: true,
        criticalFailure: false,
        durationMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
        budget: { ...PHASE_695_SHARED_BUDGET },
        gate: 'zero_call' as const,
      };
    }
    const qualityPass = testCase.criticalSemanticCase || semanticFailures === 0;
    if (!qualityPass) semanticFailures -= 1;
    const durationMs = slowRuntimeCases > 0 ? 4_501 : 1;
    if (slowRuntimeCases > 0) slowRuntimeCases -= 1;
    return {
      caseId: testCase.id,
      lane: testCase.lane,
      executionKind: 'runtime' as const,
      zeroCallVerified: false,
      runtimeInvocations: 1 as const,
      strictSuccess: true,
      qualityPass,
      criticalFailure: false,
      durationMs,
      usage: { inputTokens: 100, outputTokens: 10 },
      budget: { ...PHASE_695_SHARED_BUDGET },
      gate: qualityPass
        ? ('candidate_evaluated' as const)
        : ('candidate_rejected' as const),
    };
  });
  const qualityPasses = caseEntries.filter((entry) => entry.qualityPass).length;
  const runtimeEntries = caseEntries.filter(
    (entry) => entry.executionKind === 'runtime',
  );
  const semanticQualityRate =
    runtimeEntries.filter((entry) => entry.qualityPass).length /
    runtimeEntries.length;
  const p95DurationMs =
    runtimeEntries.filter((entry) => entry.durationMs > 4_500).length >= 2
      ? 4_501
      : 1;
  return phase695ReportSchema.parse({
    schemaVersion: PHASE_695_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
    mode: 'live',
    caseEntries,
    counters: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses,
      criticalFailures: 0,
      inputTokens: 2_200,
      outputTokens: 220,
    },
    metrics: {
      strictSchemaSuccessRate: 1,
      semanticQualityRate,
      criticalFailures: 0,
      p95DurationMs,
    },
    productionDecision:
      semanticQualityRate < 0.9
        ? 'semantic_quality_below_threshold'
        : p95DurationMs > 4_500
          ? 'latency_budget_exceeded'
          : 'quality_gate_passed',
  });
}
