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
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
  type ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence';
import {
  executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli,
  serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli';

const confirmation = '--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking';
const auditFixtureCanary = 'AUDIT_FIXTURE_CANARY_MUST_NOT_SERIALIZE';
const credentialFixture = 'V6_CLI_PRIVATE_CREDENTIAL_MUST_NOT_SERIALIZE';
const candidateFixture = 'V6_CLI_CANDIDATE_MUST_NOT_SERIALIZE';
const urlFixture = 'https://private.invalid/v6-cli-must-not-serialize';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: credentialFixture,
});

const historicalSnapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot =
  Object.freeze({
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v2',
    treeHash: 'a'.repeat(64),
    entries: Object.freeze([]),
  });

describe('Review/Planner controlled Live V6 DeepSeek non-thinking CLI', () => {
  it.each([
    { argv: [] },
    { argv: [confirmation, '--extra'] },
    { argv: ['--confirm-controlled-live-v5-deepseek-v4-pro'] },
  ])(
    'rejects invalid confirmation grammar before evidence operations',
    async ({ argv }) => {
      const snapshotHistoricalEvidence = jest.fn();
      const reserveEvidence = jest.fn();
      const createEvaluator = jest.fn();

      await expect(
        executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli({
          argv,
          env,
          root: 'safe-root',
          snapshotHistoricalEvidence: snapshotHistoricalEvidence as never,
          reserveEvidence: reserveEvidence as never,
          createEvaluator: createEvaluator as never,
        }),
      ).resolves.toEqual(
        closedBlocked(ReviewPlannerDiagnosticCode.PreflightInvalid),
      );
      expect(snapshotHistoricalEvidence).not.toHaveBeenCalled();
      expect(reserveEvidence).not.toHaveBeenCalled();
      expect(createEvaluator).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { AI_PROVIDER_MODE: 'mock' },
    { AI_ENABLE_LIVE_CALLS: 'false' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'deepseek-v4-flash' },
    { AI_BASE_URL: 'https://api.deepseek.com' },
  ])(
    'closes any missing or false preflight value before snapshot %o',
    async (override) => {
      const snapshotHistoricalEvidence = jest.fn();
      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli({
          argv: [confirmation],
          env: { ...env, ...override },
          root: 'safe-root',
          validatePreflight: jest.fn(() => ({
            ok: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
          })) as never,
          snapshotHistoricalEvidence: snapshotHistoricalEvidence as never,
        });
      expect(result).toEqual(
        closedBlocked(ReviewPlannerDiagnosticCode.PreflightInvalid),
      );
      expect(snapshotHistoricalEvidence).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'snapshot',
      {
        snapshotHistoricalEvidence: jest
          .fn()
          .mockRejectedValue(new Error('history')),
      },
    ],
    [
      'reservation',
      {
        reserveEvidence: jest
          .fn()
          .mockRejectedValue(new Error('reused marker')),
      },
    ],
  ] as const)(
    'closes %s failure with zero attempts',
    async (_name, override) => {
      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
          baseInput(override),
        );
      expect(result).toEqual(
        closedAttempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
      );
      expect(result.providerAttemptCount).toBe(0);
    },
  );

  it('closes a V1--V5 mismatch before it marks attempted or constructs an evaluator', async () => {
    const reservation = fixtureReservation();
    const createEvaluator = jest.fn();
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          verifyHistoricalEvidence: jest
            .fn()
            .mockRejectedValue(new Error('history changed')) as never,
          createEvaluator: createEvaluator as never,
        }),
      );
    expect(result).toEqual(
      closedAttempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(reservation.markAttempted).not.toHaveBeenCalled();
    expect(createEvaluator).not.toHaveBeenCalled();
  });

  it('rechecks V1--V5 history after evaluator construction and before the canary', async () => {
    const reservation = fixtureReservation();
    const flow: string[] = [];
    const runDiagnostic = jest.fn().mockResolvedValue(successfulCanary());
    const finalizeEvidence = jest.fn(() => {
      flow.push('controlled_safe_finalizer');
      return Promise.resolve(true);
    });
    const verifyHistoricalEvidence = jest.fn(() => {
      flow.push('history_verification');
      return flow.filter((entry) => entry === 'history_verification').length ===
        2
        ? Promise.reject(new Error('history changed after construction'))
        : Promise.resolve(historicalSnapshot);
    });
    const createEvaluator = jest.fn(() => {
      flow.push('evaluator_constructed');
      return {
        ok: true,
        value: {
          runDiagnostic,
          runPairedEvaluation: jest.fn().mockResolvedValue({
            kind: 'failed',
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          }),
          providerAttemptCount: () => 0,
        },
      };
    });

    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          verifyHistoricalEvidence: verifyHistoricalEvidence as never,
          finalizeEvidence: finalizeEvidence as never,
          createEvaluator: createEvaluator as never,
        }),
      );

    expect(result).toEqual(
      closedAttempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(runDiagnostic).not.toHaveBeenCalled();
    expect(finalizeEvidence).toHaveBeenCalledTimes(1);
    expect(flow).toEqual([
      'history_verification',
      'evaluator_constructed',
      'history_verification',
      'history_verification',
      'controlled_safe_finalizer',
    ]);
  });

  it('uses the post-reservation terminal finalizer for an unexpected canary throw with its observed attempt count', async () => {
    const reservation = fixtureReservation();
    const runPairedEvaluation = jest.fn();
    const finalizeEvidence = jest.fn().mockResolvedValue(true);
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn(() => {
          throw new Error('unexpected canary throw');
        }),
        runPairedEvaluation,
        providerAttemptCount: () => 1,
      },
    }));

    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          finalizeEvidence: finalizeEvidence as never,
          createEvaluator: createEvaluator as never,
        }),
      );

    expect(result).toEqual(
      closedAttempted(1, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(finalizeEvidence).toHaveBeenCalledTimes(1);
    expect(finalizeEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation,
        summary: closedAttempted(1, ReviewPlannerDiagnosticCode.EvidenceIo),
      }),
    );
  });

  it.each([
    ['audit violation', 'thinking_not_disabled' as const],
    ['canary failure', ReviewPlannerDiagnosticCode.StructuredOutput],
  ])(
    'closes %s after exactly the canary and never runs paired evaluation',
    async (_name, diagnosticCode) => {
      const reservation = fixtureReservation();
      const runPairedEvaluation = jest.fn();
      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
          baseInput({
            reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
            createEvaluator: evaluatorFactory({
              diagnostic: failedCanary(diagnosticCode),
              runPairedEvaluation,
              attempts: () => 1,
            }) as never,
          }),
        );
      expect(result).toMatchObject({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode,
      });
      expect(result.providerAttemptCount).toBe(1);
      expect(runPairedEvaluation).not.toHaveBeenCalled();
    },
  );

  it.each([
    { providerAttemptCount: 0, usageKnown: true },
    { providerAttemptCount: 1, usageKnown: false },
    { providerAttemptCount: 2, usageKnown: true },
  ])('closes a canary with unverifiable usage %o', async (diagnostic) => {
    const reservation = fixtureReservation();
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          createEvaluator: evaluatorFactory({
            diagnostic: {
              status: 'complete',
              canContinue: true,
              ...diagnostic,
            },
            attempts: () => diagnostic.providerAttemptCount,
          }) as never,
        }),
      );
    expect(result).toEqual(
      closedAttempted(
        diagnostic.providerAttemptCount,
        ReviewPlannerDiagnosticCode.UsageUnverifiable,
      ),
    );
  });

  it.each([
    ['CNY overflow', qualityReport(), overCapCost()],
    [
      'quality failure',
      qualityReport({ runtimeQualityFailures: 3 }),
      qualityCost(),
    ],
    ['P95 failure', qualityReport({ p95DurationMs: 4_501 }), qualityCost()],
  ] as const)(
    'closes %s after the frozen paired run',
    async (_name, report, cost) => {
      const reservation = fixtureReservation();
      let attempts = 1;
      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
          baseInput({
            reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
            createEvaluator: evaluatorFactory({
              diagnostic: successfulCanary(),
              attempts: () => attempts,
              runPairedEvaluation: jest.fn().mockImplementation(() => {
                attempts = 23;
                return Promise.resolve({ kind: 'report', report, cost });
              }),
            }) as never,
          }),
        );
      expect(result).toEqual(
        closedAttempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
      expect(result.providerAttemptCount).toBeLessThanOrEqual(23);
    },
  );

  it('overwrites a final candidate with terminal evidence_io after the post-finalization history check changes', async () => {
    const reservation = fixtureReservation();
    const flow: string[] = [];
    const verifyHistoricalEvidence = jest.fn(() => {
      flow.push('history_verification');
      return Promise.resolve(historicalSnapshot);
    });
    const finalizeEvidence = jest.fn(() => {
      flow.push('controlled_safe_finalizer');
      // A false result represents the finalizer's own post-provisional-write
      // history verification failure. It must follow the CLI's final check.
      return Promise.resolve(false);
    });
    let attempts = 1;
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          verifyHistoricalEvidence: verifyHistoricalEvidence as never,
          finalizeEvidence: finalizeEvidence as never,
          createEvaluator: evaluatorFactory({
            diagnostic: successfulCanary(),
            attempts: () => attempts,
            runPairedEvaluation: jest.fn().mockImplementation(() => {
              attempts = 23;
              return Promise.resolve({
                kind: 'report',
                report: qualityReport(),
                cost: qualityCost(),
              });
            }),
          }) as never,
        }),
      );
    expect(result).toEqual(
      closedAttempted(23, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(finalizeEvidence).toHaveBeenCalledTimes(1);
    expect(verifyHistoricalEvidence).toHaveBeenCalledTimes(3);
    expect(flow).toEqual([
      'history_verification',
      'history_verification',
      'history_verification',
      'controlled_safe_finalizer',
    ]);
  });

  it('closes a reused V6 marker through reservation without a provider attempt', async () => {
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest
            .fn()
            .mockRejectedValue(new Error('already consumed')) as never,
        }),
      );
    expect(result).toEqual(
      closedAttempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(result.providerAttemptCount).toBe(0);
  });

  it('only opens for the fully safe 48 case result and serializes a strict redacted summary', async () => {
    const reservation = fixtureReservation();
    let attempts = 1;
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          createEvaluator: evaluatorFactory({
            diagnostic: successfulCanary(),
            attempts: () => attempts,
            runPairedEvaluation: jest.fn().mockImplementation(() => {
              attempts = 23;
              return Promise.resolve({
                kind: 'report',
                report: qualityReport(),
                cost: qualityCost(),
              });
            }),
          }) as never,
        }),
      );
    expect(result).toEqual({
      status: 'complete',
      gate: 'open',
      providerAttemptCount: 23,
      usageKnown: true,
      priceProfileId:
        REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
      currency: 'CNY',
      aggregateInputTokens: 2_210,
      aggregateOutputTokens: 225,
      observedCostCny: 0.00798,
      hardCapCny: 1,
      withinHardCap: true,
      quality: {
        caseEntries: 48,
        zeroCallCases: 26,
        runtimeInvocations: 22,
        strictSuccesses: 48,
        qualityPasses: 48,
        criticalFailures: 0,
        p95DurationMs: 1,
        productionDecision: 'quality_gate_passed',
      },
      nonThinkingAudit: {
        reasoning: 'not_reported',
        reasoningContentPresent: false,
      },
    });
    const serialized =
      serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary(result);
    for (const forbidden of [
      credentialFixture,
      candidateFixture,
      auditFixtureCanary,
      urlFixture,
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('preserves a reported-zero audit in complete evidence without reducing CNY output accounting', async () => {
    const reservation = fixtureReservation();
    let attempts = 1;
    const result =
      await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli(
        baseInput({
          reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
          createEvaluator: evaluatorFactory({
            diagnostic: successfulCanary(),
            attempts: () => attempts,
            nonThinkingAudit: {
              reasoning: 'reported_zero',
              reasoningContentPresent: false,
              reportedReasoningTokens: 0,
            },
            runPairedEvaluation: jest.fn().mockImplementation(() => {
              attempts = 23;
              return Promise.resolve({
                kind: 'report',
                report: qualityReport(),
                cost: qualityCost(),
              });
            }),
          }) as never,
        }),
      );

    expect(result).toMatchObject({
      status: 'complete',
      aggregateOutputTokens: 225,
      observedCostCny: 0.00798,
      nonThinkingAudit: {
        reasoning: 'reported_zero',
        reasoningContentPresent: false,
        reportedReasoningTokens: 0,
      },
    });
  });
});

function baseInput(overrides: Record<string, unknown>) {
  return {
    argv: [confirmation],
    env,
    root: 'safe-root',
    now: () => 0,
    randomUUID: () => 'v6-cli-run',
    validatePreflight: jest.fn(() => ({ ok: true })) as never,
    snapshotHistoricalEvidence: jest
      .fn()
      .mockResolvedValue(historicalSnapshot) as never,
    verifyHistoricalEvidence: jest
      .fn()
      .mockResolvedValue(historicalSnapshot) as never,
    finalizeEvidence: jest.fn().mockResolvedValue(true) as never,
    ...overrides,
  };
}

function fixtureReservation() {
  return {
    relativePath:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking/test.json',
    markAttempted: jest.fn().mockResolvedValue(true),
  };
}

function evaluatorFactory(input: Record<string, unknown>) {
  return jest.fn(() => ({
    ok: true,
    value: {
      runDiagnostic: jest.fn().mockResolvedValue(input.diagnostic),
      runPairedEvaluation: input.runPairedEvaluation ?? jest.fn(),
      providerAttemptCount: input.attempts ?? (() => 0),
      readEvidenceNonThinkingAudit: () =>
        input.nonThinkingAudit ?? {
          reasoning: 'not_reported' as const,
          reasoningContentPresent: false,
        },
    },
  }));
}

function successfulCanary() {
  return {
    status: 'complete' as const,
    canContinue: true,
    providerAttemptCount: 1,
    usageKnown: true,
  };
}

function failedCanary(
  diagnosticCode: ReviewPlannerDiagnosticCode | 'thinking_not_disabled',
) {
  return {
    status: 'invalid_attempted' as const,
    canContinue: false,
    providerAttemptCount: 1,
    usageKnown: false,
    diagnosticCode,
  };
}

function closedBlocked(diagnosticCode: ReviewPlannerDiagnosticCode) {
  return {
    status: 'diagnostic_blocked' as const,
    gate: 'closed' as const,
    providerAttemptCount: 0,
    usageKnown: false as const,
    diagnosticCode,
  };
}

function closedAttempted(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerDiagnosticCode,
) {
  return {
    status: 'invalid_attempted' as const,
    gate: 'closed' as const,
    providerAttemptCount,
    usageKnown: false as const,
    diagnosticCode,
  };
}

function qualityReport(
  overrides: Readonly<{
    p95DurationMs?: number;
    runtimeQualityFailures?: number;
  }> = {},
): Phase695Report {
  const runtimeQualityFailures = overrides.runtimeQualityFailures ?? 0;
  const durationMs = overrides.p95DurationMs ?? 1;
  let selectedQualityFailures = 0;
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
      : (() => {
          const qualityFailure =
            !testCase.criticalSemanticCase &&
            selectedQualityFailures++ < runtimeQualityFailures;
          return {
            caseId: testCase.id,
            lane: testCase.lane,
            executionKind: 'runtime' as const,
            zeroCallVerified: false,
            runtimeInvocations: 1 as const,
            strictSuccess: true,
            qualityPass: !qualityFailure,
            criticalFailure: false,
            durationMs,
            usage: { inputTokens: 100, outputTokens: 10 },
            budget: { ...PHASE_695_SHARED_BUDGET },
            gate: qualityFailure
              ? ('candidate_rejected' as const)
              : ('candidate_evaluated' as const),
          };
        })(),
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
      qualityPasses: 48 - runtimeQualityFailures,
      criticalFailures: 0,
      inputTokens: 2_200,
      outputTokens: 220,
    },
    metrics: {
      strictSchemaSuccessRate: 1,
      semanticQualityRate: (22 - runtimeQualityFailures) / 22,
      criticalFailures: 0,
      p95DurationMs: durationMs,
    },
    productionDecision:
      runtimeQualityFailures >= 3
        ? 'semantic_quality_below_threshold'
        : durationMs > 4_500
          ? 'latency_budget_exceeded'
          : 'quality_gate_passed',
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

function overCapCost() {
  return { ...qualityCost(), observedCostCny: 1.00001, withinHardCap: false };
}
