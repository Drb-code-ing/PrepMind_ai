import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_CONFIRMATION,
  runReviewPlannerControlledLiveV9GateDiagnosticsCli,
  serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary,
  type SafeReviewPlannerControlledLiveV9Summary,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.cli';
import { deriveV9GateDiagnostic } from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';
import { REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES } from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
  validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.factory';

const confirmation =
  '--confirm-controlled-live-v9-deepseek-v4-pro-gate-diagnostics';

describe('review planner controlled Live V9 gate diagnostics CLI', () => {
  it('exports the exact one-shot confirmation', () => {
    expect(REVIEW_PLANNER_CONTROLLED_LIVE_V9_CONFIRMATION).toBe(confirmation);
  });

  it.each([
    { argv: [] },
    { argv: [confirmation, '--extra'] },
    { argv: ['--confirm-controlled-live-v8'] },
  ])(
    'rejects non-exact argv before constructing the evaluator',
    async ({ argv }) => {
      const createEvaluator = jest.fn();

      await runReviewPlannerControlledLiveV9GateDiagnosticsCli(
        {
          argv,
          env: {},
          root: 'E:\\PrepMind',
          now: () => Date.parse('2026-07-19T12:00:00.000Z'),
          runId: 'v9-cli-red',
        },
        { createEvaluator } as never,
      );

      expect(createEvaluator).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'missing V9 gate', env: {} },
    {
      name: 'false V9 gate',
      env: {
        ...validPreflightEnv(),
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED:
          'false',
      },
    },
    {
      name: 'external V8 true',
      env: {
        ...validPreflightEnv(),
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'true',
      },
    },
    {
      name: 'throwing V9 getter',
      env: Object.defineProperty(
        { ...validPreflightEnv() },
        'REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED',
        {
          enumerable: true,
          get() {
            throw new Error('PRIVATE_V9_GATE');
          },
        },
      ),
    },
  ])('blocks $name at preflight before every capability', async ({ env }) => {
    const harness = createHarness({ realPreflight: true });

    await expect(runCli(harness, env)).resolves.toEqual(blocked());
    expect(harness.events).toEqual(['preflight']);
    expect(harness.createEvaluator).not.toHaveBeenCalled();
    expect(harness.runCanary).not.toHaveBeenCalled();
    expect(harness.runPaired).not.toHaveBeenCalled();
  });

  it('runs 010 through diagnostic commit 085 and failed validation 090 exactly once', async () => {
    const harness = createHarness();

    await expect(runCli(harness)).resolves.toEqual(failedSummary());
    expect(harness.events).toEqual([
      'preflight',
      'snapshot',
      'reserve',
      'markAttempted',
      'createEvaluator',
      '.stage-030-evaluator-ready',
      'verifyHistory',
      '.stage-040-provider-history-verified',
      '.stage-050-canary-started',
      'runCanary',
      '.stage-060-canary-returned',
      '.stage-070-paired-started',
      'runPaired',
      '.stage-080-paired-returned',
      'diagnostic-write',
      '.stage-085-safe-aggregate-committed.json',
      '.stage-090-validation-completed',
    ]);
    expect(harness.runCanary).toHaveBeenCalledTimes(1);
    expect(harness.runPaired).toHaveBeenCalledTimes(1);
    expect(harness.abort).not.toHaveBeenCalled();
    expect(harness.finalizeSuccess).not.toHaveBeenCalled();
  });

  it.each(
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(2, 8).flatMap((stage) => [
      { stage, mode: 'false' as const },
      { stage, mode: 'throw' as const },
    ]),
  )('aborts once when $stage returns $mode', async ({ stage, mode }) => {
    const harness = createHarness({ stageFailure: { stage, mode } });

    const summary = await runCli(harness);

    expect(summary).toEqual(attempted(harness.attempts()));
    expect(harness.abort).toHaveBeenCalledTimes(1);
    expect(harness.events.filter((entry) => entry === stage)).toHaveLength(1);
  });

  it.each(['evaluator', 'canary', 'paired'] as const)(
    'contains a %s throw without retry and aborts before 085',
    async (failure) => {
      const harness = createHarness({ failure: `${failure}_throw` });

      const summary = await runCli(harness);

      expect(summary).toEqual(attempted(harness.attempts()));
      expect(harness.runCanary).toHaveBeenCalledTimes(
        failure === 'evaluator' ? 0 : 1,
      );
      expect(harness.runPaired).toHaveBeenCalledTimes(
        failure === 'paired' ? 1 : 0,
      );
      expect(harness.abort).toHaveBeenCalledTimes(1);
    },
  );

  it('aborts a failed canary before paired work', async () => {
    const harness = createHarness({ failure: 'canary_failed' });

    await expect(runCli(harness)).resolves.toEqual(attempted(1));
    expect(harness.runCanary).toHaveBeenCalledTimes(1);
    expect(harness.runPaired).not.toHaveBeenCalled();
    expect(harness.abort).toHaveBeenCalledTimes(1);
  });

  it.each(['null', 'throw'] as const)(
    'aborts when diagnostic commit returns %s before 085',
    async (mode) => {
      const harness = createHarness({ failure: `commit_${mode}` });

      await expect(runCli(harness)).resolves.toEqual(attempted(23));
      expect(harness.commitDiagnostic).toHaveBeenCalledTimes(1);
      expect(harness.abort).toHaveBeenCalledTimes(1);
      expect(harness.completeValidation).not.toHaveBeenCalled();
    },
  );

  it.each(['false', 'throw'] as const)(
    'fails closed when validation 090 returns %s without a pre-085 abort',
    async (mode) => {
      const harness = createHarness({ failure: `validation_${mode}` });

      await expect(runCli(harness)).resolves.toEqual(attempted(23));
      expect(harness.abort).toHaveBeenCalledTimes(1);
      expect(harness.finalizeSuccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    'mark_false',
    'mark_throw',
    'history_throw',
    'evaluator_closed',
  ] as const)(
    'aborts the reserved capability on %s before 085',
    async (failure) => {
      const harness = createHarness({ failure });

      const summary = await runCli(harness);

      expect(summary).toEqual(attempted(harness.attempts()));
      expect(harness.abort).toHaveBeenCalledTimes(1);
      expect(harness.commitDiagnostic).not.toHaveBeenCalled();
    },
  );

  it('finalizes only a passed diagnostic and returns exact 23/22 counts', async () => {
    const harness = createHarness({ diagnostic: 'passed' });

    await expect(runCli(harness)).resolves.toEqual(completeSummary());
    expect(harness.finalizeSuccess).toHaveBeenCalledTimes(1);
    expect(harness.abort).not.toHaveBeenCalled();
  });

  it.each(['failed', 'hostile_kind'] as const)(
    'rejects passed diagnostic with %s paired result before evidence commit',
    async (pairedResult) => {
      const harness = createHarness({
        diagnostic: 'passed',
        pairedResult,
      });

      await expect(runCli(harness)).resolves.toEqual(attempted(23));
      expect(harness.commitDiagnostic).not.toHaveBeenCalled();
      expect(harness.finalizeSuccess).not.toHaveBeenCalled();
      expect(harness.abort).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['false', 'throw'] as const)(
    'fails closed when pass-only finalization returns %s',
    async (mode) => {
      const harness = createHarness({
        diagnostic: 'passed',
        failure: `finalizer_${mode}`,
      });

      await expect(runCli(harness)).resolves.toEqual(attempted(23));
      expect(harness.finalizeSuccess).toHaveBeenCalledTimes(1);
      expect(harness.abort).toHaveBeenCalledTimes(1);
    },
  );

  it('serializes only one strict safe summary line', () => {
    expect(
      serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(
        completeSummary(),
      ),
    ).toBe(`${JSON.stringify(completeSummary())}\n`);
    expect(() =>
      serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary({
        ...completeSummary(),
        prompt: 'forbidden',
      } as SafeReviewPlannerControlledLiveV9Summary),
    ).toThrow();
  });

  it('registers the exact package command and keeps both script paths behind the serializer', () => {
    const script = readFileSync(scriptPath(), 'utf8');
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../../package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };

    expect(
      packageJson.scripts?.['eval:review-planner:live:v9:gate-diagnostics'],
    ).toBe(
      'bun scripts/review-planner-controlled-live-eval-v9-gate-diagnostics.ts',
    );
    expect(script).toContain(
      'serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(summary)',
    );
    expect(script).toContain(
      'serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(\n      TOP_LEVEL_FAILURE,',
    );
    expect(script.match(/process\.stdout\.write\(/g)).toHaveLength(2);
    expect(script).not.toMatch(
      /console\.|process\.stderr|JSON\.stringify|rawError|stack|prompt|response|apiKey/i,
    );
  });

  it('runs the real negative command with zero unsafe output', () => {
    const result = spawnSync('bun', [scriptPath()], {
      cwd: resolve(__dirname, '../../..'),
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(blocked());
    expect(result.stdout).not.toMatch(
      /prompt|response|raw.?error|stack|api.?key|secret|url|header|cookie/i,
    );
  });
});

function scriptPath() {
  return resolve(
    __dirname,
    '../../scripts/review-planner-controlled-live-eval-v9-gate-diagnostics.ts',
  );
}

function blocked() {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: 'preflight_invalid',
  };
}

type Stage = (typeof REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES)[number];

function createHarness(
  options: Readonly<{
    stageFailure?: Readonly<{ stage: Stage; mode: 'false' | 'throw' }>;
    failure?:
      | 'mark_false'
      | 'mark_throw'
      | 'history_throw'
      | 'evaluator_closed'
      | 'evaluator_throw'
      | 'canary_throw'
      | 'canary_failed'
      | 'paired_throw'
      | 'commit_null'
      | 'commit_throw'
      | 'validation_false'
      | 'validation_throw'
      | 'finalizer_false'
      | 'finalizer_throw';
    diagnostic?: 'failed' | 'passed';
    pairedResult?: 'report' | 'failed' | 'hostile_kind';
    realPreflight?: boolean;
  }> = {},
) {
  const events: string[] = [];
  let attempts = 0;
  const abort = jest.fn(() => true);
  const reservation = Object.freeze({
    relativePath: 'docs/acceptance/evidence/v9/review-planner-live-test.json',
    markAttempted: jest.fn(() => {
      events.push('markAttempted');
      if (options.failure === 'mark_throw') {
        return Promise.reject(new Error('private mark'));
      }
      return Promise.resolve(options.failure !== 'mark_false');
    }),
    abort,
  });
  const runCanary = jest.fn(() => {
    events.push('runCanary');
    attempts = 1;
    if (options.failure === 'canary_throw') {
      return Promise.reject(new Error('private canary'));
    }
    if (options.failure === 'canary_failed') {
      return Promise.resolve({
        kind: 'failed' as const,
        diagnosticCode: 'transport' as const,
      });
    }
    return Promise.resolve({
      kind: 'complete' as const,
      providerAttemptCount: 1 as const,
      usageKnown: true as const,
    });
  });
  const runPaired = jest.fn(() => {
    events.push('runPaired');
    attempts = 23;
    if (options.failure === 'paired_throw') {
      return Promise.reject(new Error('private paired'));
    }
    const result =
      options.pairedResult === 'hostile_kind'
        ? Object.defineProperty({}, 'kind', {
            enumerable: true,
            get() {
              throw new Error('PRIVATE_PAIRED_KIND');
            },
          })
        : options.pairedResult === 'failed' ||
            (options.pairedResult === undefined &&
              options.diagnostic !== 'passed')
          ? {
              kind: 'failed' as const,
              diagnosticCode: 'invalid_response' as const,
            }
          : { kind: 'report' as const };
    return Promise.resolve({
      result,
      diagnostic:
        options.diagnostic === 'passed'
          ? passingDiagnostic()
          : failedDiagnostic(),
    });
  });
  const finalizeSuccess = jest.fn(() => {
    events.push('finalizeSuccess');
    if (options.failure === 'finalizer_throw') {
      return Promise.reject(new Error('private finalizer'));
    }
    return Promise.resolve(options.failure !== 'finalizer_false');
  });
  const dependencies = {
    validatePreflight: jest.fn((env: Record<string, unknown>) => {
      events.push('preflight');
      return options.realPreflight
        ? validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight(env)
        : { ok: true as const };
    }),
    snapshotHistoricalEvidence: jest.fn(() => {
      events.push('snapshot');
      return Promise.resolve(historicalSnapshot());
    }),
    verifyHistoricalEvidence: jest.fn(
      (input: { snapshot: ReturnType<typeof historicalSnapshot> }) => {
        events.push('verifyHistory');
        if (options.failure === 'history_throw') {
          return Promise.reject(new Error('private history'));
        }
        return Promise.resolve(input.snapshot);
      },
    ),
    reserveEvidence: jest.fn(() => {
      events.push('reserve');
      return Promise.resolve(reservation);
    }),
    advanceStage: jest.fn((_reservation: unknown, stage: Stage) => {
      events.push(stage);
      if (options.stageFailure?.stage !== stage) return true;
      if (options.stageFailure.mode === 'throw')
        throw new Error('private stage');
      return false;
    }),
    createEvaluator: jest.fn(() => {
      events.push('createEvaluator');
      if (options.failure === 'evaluator_throw') {
        throw new Error('private evaluator');
      }
      if (options.failure === 'evaluator_closed') {
        return {
          state: 'closed' as const,
          profileId:
            REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
          identity: null,
          diagnosticCode: 'transport' as const,
          providerAttemptCount: () => attempts,
        };
      }
      return {
        state: 'ready' as const,
        profileId:
          REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE_ID,
        identity: {
          provider: 'deepseek' as const,
          model: 'deepseek-v4-pro' as const,
          baseUrlIdentity: 'deepseek-v1' as const,
          structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' as const,
          timeoutMs: 4_500 as const,
          schemaId: 'review-model-candidate-v1' as const,
          priceProfileId:
            'deepseek-v4-pro-cny-noncached-2026-07-18-v8-stage-diagnostics' as const,
        },
        runCanary,
        runPaired,
        providerAttemptCount: () => attempts,
      };
    }),
    commitDiagnostic: jest.fn(() => {
      events.push('diagnostic-write');
      if (options.failure === 'commit_throw') {
        return Promise.reject(new Error('private commit'));
      }
      if (options.failure === 'commit_null') return Promise.resolve(null);
      events.push('.stage-085-safe-aggregate-committed.json');
      return Promise.resolve({ diagnosticSha256: 'a'.repeat(64) });
    }),
    completeValidation: jest.fn(() => {
      events.push('.stage-090-validation-completed');
      if (options.failure === 'validation_throw') {
        throw new Error('private validation');
      }
      if (options.failure === 'validation_false') return false;
      return true;
    }),
    finalizeSuccess,
  };
  return {
    dependencies,
    events,
    abort,
    runCanary,
    runPaired,
    createEvaluator: dependencies.createEvaluator,
    commitDiagnostic: dependencies.commitDiagnostic,
    completeValidation: dependencies.completeValidation,
    finalizeSuccess,
    attempts: () => attempts,
  };
}

function runCli(
  harness: ReturnType<typeof createHarness>,
  env: Record<string, unknown> = {},
) {
  return runReviewPlannerControlledLiveV9GateDiagnosticsCli(
    {
      argv: [confirmation],
      env,
      root: 'E:\\PrepMind',
      now: () => Date.parse('2026-07-19T12:00:00.000Z'),
      runId: 'v9-cli-test',
    },
    harness.dependencies as never,
  );
}

function validPreflightEnv() {
  return {
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
  };
}

function historicalSnapshot() {
  return {
    schemaVersion:
      'phase-6.9.5-review-planner-historical-integrity-v5' as const,
    treeHash:
      '6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6',
    entries: Object.freeze([]),
  };
}

function failedDiagnostic() {
  return diagnostic(4_501, 'latency_budget_exceeded');
}

function passingDiagnostic() {
  return diagnostic(4_500, 'quality_gate_passed');
}

function diagnostic(
  p95DurationMs: number,
  productionDecision: 'quality_gate_passed' | 'latency_budget_exceeded',
) {
  return deriveV9GateDiagnostic({
    attempts: {
      providerCount: 23,
      expectedProviderCount: 23,
      pairedAdmissionCount: 22,
      expectedPairedAdmissionCount: 22,
      overflow: false,
      auditRecordCount: 23,
    },
    report: {
      schemaValid: true,
      caseEntries: 48,
      zeroCallCases: 26,
      zeroCallVerified: 26,
      runtimeInvocations: 22,
      budgetExceededCases: 0,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      semanticPasses: 22,
      semanticTotal: 22,
      p95DurationMs,
      productionDecision,
    },
    usage: { known: true, inputTokens: 42_000, outputTokens: 9_000 },
    cost: { evaluated: true, amountCny: 0.18, hardCapCny: 1, withinCap: true },
  });
}

function attempted(providerAttemptCount: number) {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount,
    pairedAdmissionCount: 0,
    usageKnown: false,
    diagnosticCode: 'evidence_io',
  };
}

function failedSummary() {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 23,
    pairedAdmissionCount: 22,
    usageKnown: true,
    terminalReason: 'p95_exceeded',
  };
}

function completeSummary(): SafeReviewPlannerControlledLiveV9Summary {
  return {
    status: 'complete',
    gate: 'closed',
    providerAttemptCount: 23,
    pairedAdmissionCount: 22,
    usageKnown: true,
    terminalReason: 'passed',
  };
}
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
