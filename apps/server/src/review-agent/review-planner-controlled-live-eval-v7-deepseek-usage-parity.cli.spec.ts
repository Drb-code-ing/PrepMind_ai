import {
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  PHASE_695_SHARED_BUDGET,
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  phase695ReviewPlannerCases,
} from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_CONFIRMATION,
  runReviewPlannerControlledLiveV7DeepSeekUsageParityCli,
  serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
  type ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';

const credentialSentinel = 'V7_CLI_PRIVATE_CREDENTIAL';
const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: credentialSentinel,
});

const historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot =
  Object.freeze({
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v3',
    treeHash: 'a'.repeat(64),
    entries: Object.freeze([]),
  });

describe('Review/Planner controlled Live V7 usage-parity CLI', () => {
  it.each([
    { argv: [] },
    {
      argv: [
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_CONFIRMATION,
        '--extra',
      ],
    },
    { argv: ['--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking'] },
  ])(
    'rejects invalid confirmation before preflight and evidence',
    async ({ argv }) => {
      const validatePreflight = jest.fn();
      const snapshotHistoricalEvidence = jest.fn();

      await expect(
        runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
          baseInput(argv),
          { validatePreflight, snapshotHistoricalEvidence },
        ),
      ).resolves.toEqual(blocked());
      expect(validatePreflight).not.toHaveBeenCalled();
      expect(snapshotHistoricalEvidence).not.toHaveBeenCalled();
    },
  );

  it('contains a credential-bearing preflight throw before evidence reservation', async () => {
    const snapshotHistoricalEvidence = jest.fn();
    const privateCanary = 'V7_PREFLIGHT_PRIVATE_CREDENTIAL';
    const summary =
      await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
        baseInput(),
        {
          validatePreflight: () => {
            throw new Error(privateCanary);
          },
          snapshotHistoricalEvidence,
        },
      );

    expect(summary).toEqual(blocked());
    expect(JSON.stringify(summary)).not.toContain(privateCanary);
    expect(snapshotHistoricalEvidence).not.toHaveBeenCalled();
  });

  it.each(['snapshot', 'reserve'] as const)(
    'closes a %s failure before evaluator construction',
    async (stage) => {
      const createEvaluator = jest.fn();
      const summary =
        await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
          baseInput(),
          {
            validatePreflight: () => ({ ok: true }),
            snapshotHistoricalEvidence: () =>
              stage === 'snapshot'
                ? Promise.reject(new Error('private snapshot failure'))
                : Promise.resolve(historicalSnapshot),
            reserveEvidence: () =>
              stage === 'reserve'
                ? Promise.reject(new Error('private reserve failure'))
                : Promise.reject(new Error('unreachable reserve')),
            createEvaluator,
          },
        );

      expect(summary).toEqual({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
      });
      expect(createEvaluator).not.toHaveBeenCalled();
    },
  );

  it.each([
    'verify_before_mark',
    'mark_false',
    'mark_throw',
    'verify_after_mark',
    'create_throw',
    'verify_before_canary',
    'paired_throw',
    'final_verify',
    'finalize_false',
    'finalize_throw',
  ] as const)(
    'terminal-seals a post-reservation %s failure exactly once',
    async (stage) => {
      let verifyCalls = 0;
      let attempts = 1;
      const runPairedEvaluation = jest.fn(() => {
        attempts = 23;
        return stage === 'paired_throw'
          ? Promise.reject(new Error('private paired failure'))
          : Promise.resolve({
              kind: 'report' as const,
              report: qualityReport(),
              cost: qualityCost(),
            });
      });
      const reservation = {
        relativePath: 'temporary-v7-boundary-evidence.json',
        markAttempted: jest.fn(() => {
          if (stage === 'mark_throw') {
            return Promise.reject(new Error('private mark failure'));
          }
          return Promise.resolve(stage !== 'mark_false');
        }),
      };
      const finalizeEvidence = jest.fn(() => {
        if (stage === 'finalize_throw') {
          return Promise.reject(new Error('private finalize failure'));
        }
        return Promise.resolve(stage !== 'finalize_false');
      });
      const summary =
        await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
          baseInput(),
          {
            validatePreflight: () => ({ ok: true }),
            snapshotHistoricalEvidence: () =>
              Promise.resolve(historicalSnapshot),
            reserveEvidence: () => Promise.resolve(reservation),
            verifyHistoricalEvidence: () => {
              verifyCalls += 1;
              const failingCall =
                stage === 'verify_before_mark'
                  ? 1
                  : stage === 'verify_after_mark'
                    ? 2
                    : stage === 'verify_before_canary'
                      ? 3
                      : stage === 'final_verify'
                        ? 4
                        : -1;
              return verifyCalls === failingCall
                ? Promise.reject(new Error('private verify failure'))
                : Promise.resolve(historicalSnapshot);
            },
            createEvaluator: () => {
              if (stage === 'create_throw') {
                throw new Error('private evaluator failure');
              }
              return {
                ok: true,
                value: {
                  runDiagnostic: () => Promise.resolve(successfulCanary()),
                  runPairedEvaluation,
                  readCanaryUsage: () => ({
                    inputTokens: 10,
                    outputTokens: 5,
                  }),
                  providerAttemptCount: () => attempts,
                },
              };
            },
            finalizeEvidence,
          },
        );

      expect(summary).toMatchObject({
        status: 'invalid_attempted',
        gate: 'closed',
        usageKnown: false,
        diagnosticCode:
          stage === 'create_throw'
            ? ReviewPlannerDiagnosticCode.ExecutorInit
            : ReviewPlannerDiagnosticCode.EvidenceIo,
      });
      expect(finalizeEvidence).toHaveBeenCalledTimes(1);
      if (
        stage === 'verify_before_mark' ||
        stage === 'mark_false' ||
        stage === 'mark_throw'
      ) {
        expect(runPairedEvaluation).not.toHaveBeenCalled();
      }
    },
  );

  it('runs the exact one-shot capability order and returns only a strict complete aggregate', async () => {
    const events: string[] = [];
    let attempts = 1;
    let finalizedSummary: unknown;
    const reservation = {
      relativePath: 'temporary-v7-evidence.json',
      markAttempted: jest.fn(() => {
        events.push('markAttempted');
        return Promise.resolve(true);
      }),
    };
    const summary =
      await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
        baseInput(),
        {
          validatePreflight: () => {
            events.push('validatePreflight');
            return { ok: true };
          },
          snapshotHistoricalEvidence: () => {
            events.push('snapshotHistoricalEvidence');
            return Promise.resolve(historicalSnapshot);
          },
          reserveEvidence: () => {
            events.push('reserveEvidence');
            return Promise.resolve(reservation);
          },
          verifyHistoricalEvidence: () => {
            events.push('verifyHistoricalEvidence');
            return Promise.resolve(historicalSnapshot);
          },
          createEvaluator: () => {
            events.push('createEvaluator');
            return {
              ok: true,
              value: {
                runDiagnostic() {
                  events.push('runDiagnostic');
                  return Promise.resolve({
                    status: 'complete' as const,
                    canContinue: true,
                    providerAttemptCount: 1,
                    usageKnown: true,
                  });
                },
                runPairedEvaluation() {
                  events.push('runPairedEvaluation');
                  attempts = 23;
                  return Promise.resolve({
                    kind: 'report' as const,
                    report: qualityReport(),
                    cost: qualityCost(),
                  });
                },
                readCanaryUsage: () => ({ inputTokens: 10, outputTokens: 5 }),
                providerAttemptCount: () => attempts,
              },
            };
          },
          finalizeEvidence: (input) => {
            events.push('finalizeEvidence');
            finalizedSummary = input.summary;
            return Promise.resolve(true);
          },
        },
      );

    expect(events).toEqual([
      'validatePreflight',
      'snapshotHistoricalEvidence',
      'reserveEvidence',
      'verifyHistoricalEvidence',
      'markAttempted',
      'verifyHistoricalEvidence',
      'createEvaluator',
      'verifyHistoricalEvidence',
      'runDiagnostic',
      'runPairedEvaluation',
      'verifyHistoricalEvidence',
      'finalizeEvidence',
    ]);
    expect(finalizedSummary).toEqual(completeSummary());
    expect(summary).toEqual(completeSummary());
    expect(
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary(summary),
    ).toBe(JSON.stringify(completeSummary()));
  });

  it('never runs paired evaluation after a failed canary and finalizes a value-free closure', async () => {
    const events: string[] = [];
    const runPairedEvaluation = jest.fn();
    const summary =
      await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
        baseInput(),
        successfulEvidenceOverrides(events, {
          runDiagnostic: () => {
            events.push('runDiagnostic');
            return Promise.resolve({
              status: 'invalid_attempted' as const,
              canContinue: false,
              providerAttemptCount: 1,
              usageKnown: false,
              diagnosticCode: 'provider_usage_missing' as const,
            });
          },
          runPairedEvaluation,
          providerAttemptCount: () => 1,
        }),
      );

    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(events.slice(-3)).toEqual([
      'runDiagnostic',
      'verifyHistoricalEvidence',
      'finalizeEvidence',
    ]);
    expect(summary).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: 'provider_usage_missing',
    });
    const serialized =
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary(summary);
    expect(serialized).not.toMatch(
      /aggregate|observedCost|priceProfile|prompt|response|api.?key|url|header|stack|raw.?error/i,
    );
  });

  it('contains credential-bearing dependency failures as evidence_io without leaking details', async () => {
    const hostile =
      'prompt response token=123 api_key=secret https://private.invalid Authorization header stack raw error';
    const summary =
      await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
        baseInput(),
        successfulEvidenceOverrides([], {
          runDiagnostic: () => Promise.reject(new Error(hostile)),
          runPairedEvaluation: jest.fn(),
          providerAttemptCount: () => 0,
        }),
      );
    const serialized =
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary(summary);

    expect(summary).toMatchObject({
      status: 'invalid_attempted',
      gate: 'closed',
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(serialized).not.toContain(hostile);
    expect(serialized).not.toContain(credentialSentinel);
  });

  it('fails closed when the paired report or aggregate counters are not exact', async () => {
    let attempts = 1;
    const summary =
      await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli(
        baseInput(),
        successfulEvidenceOverrides([], {
          runDiagnostic: () => Promise.resolve(successfulCanary()),
          runPairedEvaluation: () => {
            attempts = 23;
            return Promise.resolve({
              kind: 'report' as const,
              report: {
                ...qualityReport(),
                counters: { ...qualityReport().counters, strictSuccesses: 47 },
              },
              cost: qualityCost(),
            });
          },
          providerAttemptCount: () => attempts,
        }),
      );

    expect(summary).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 23,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
  });
});

function baseInput(
  argv: readonly string[] = [
    REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_CONFIRMATION,
  ],
) {
  return {
    argv,
    env,
    root: 'injected-temporary-root',
    now: () => Date.parse('2026-07-17T12:00:00.000Z'),
    randomUUID: () => 'v7-cli-injected-run',
  };
}

function successfulEvidenceOverrides(
  events: string[],
  evaluator: {
    runDiagnostic: () => Promise<unknown>;
    runPairedEvaluation: () => Promise<unknown>;
    providerAttemptCount: () => number;
  },
) {
  const reservation = {
    relativePath: 'temporary-v7-evidence.json',
    markAttempted: () => {
      events.push('markAttempted');
      return Promise.resolve(true);
    },
  };
  return {
    validatePreflight: () => {
      events.push('validatePreflight');
      return { ok: true as const };
    },
    snapshotHistoricalEvidence: () => {
      events.push('snapshotHistoricalEvidence');
      return Promise.resolve(historicalSnapshot);
    },
    reserveEvidence: () => {
      events.push('reserveEvidence');
      return Promise.resolve(reservation);
    },
    verifyHistoricalEvidence: () => {
      events.push('verifyHistoricalEvidence');
      return Promise.resolve(historicalSnapshot);
    },
    createEvaluator: () => {
      events.push('createEvaluator');
      return {
        ok: true as const,
        value: {
          ...evaluator,
          readCanaryUsage: () => null,
        },
      };
    },
    finalizeEvidence: () => {
      events.push('finalizeEvidence');
      return Promise.resolve(true);
    },
  } as never;
}

function successfulCanary() {
  return {
    status: 'complete' as const,
    canContinue: true,
    providerAttemptCount: 1,
    usageKnown: true,
  };
}

function blocked() {
  return {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  };
}

function completeSummary() {
  return {
    status: 'complete',
    gate: 'eligible_for_separate_product_acceptance',
    providerAttemptCount: 23,
    usageKnown: true,
    aggregateInputTokens: 2_210,
    aggregateOutputTokens: 225,
    observedCostCny: 0.00798,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
    caseEntries: 48,
    zeroCallCases: 26,
    runtimeInvocations: 22,
    strictSuccesses: 48,
    qualityPasses: 48,
    criticalFailures: 0,
  };
}

function qualityReport() {
  const caseEntries = phase695ReviewPlannerCases.map((testCase) =>
    testCase.executionKind === 'zero_call'
      ? {
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
        }
      : {
          caseId: testCase.id,
          lane: testCase.lane,
          executionKind: 'runtime' as const,
          zeroCallVerified: false,
          runtimeInvocations: 1 as const,
          strictSuccess: true,
          qualityPass: true,
          criticalFailure: false,
          durationMs: 1,
          usage: { inputTokens: 100, outputTokens: 10 },
          budget: { ...PHASE_695_SHARED_BUDGET },
          gate: 'candidate_evaluated' as const,
        },
  );
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
      qualityPasses: 48,
      criticalFailures: 0,
      inputTokens: 2_200,
      outputTokens: 220,
    },
    metrics: {
      strictSchemaSuccessRate: 1,
      semanticQualityRate: 1,
      criticalFailures: 0,
      p95DurationMs: 1,
    },
    productionDecision: 'quality_gate_passed',
  });
}

function qualityCost() {
  return {
    currency: 'CNY' as const,
    nonCachedInputCnyPerMillionTokens: 3,
    outputCnyPerMillionTokens: 6,
    hardCapCny: 1,
    maxPairedProviderAttempts: 22,
    maxProviderAttempts: 23,
    reservedInputTokens: 42_996,
    reservedOutputTokens: 9_712,
    reservedCostCny: 0.18726,
    observedInputTokens: 2_210,
    observedOutputTokens: 225,
    observedCostCny: 0.00798,
    withinHardCap: true,
  };
}
