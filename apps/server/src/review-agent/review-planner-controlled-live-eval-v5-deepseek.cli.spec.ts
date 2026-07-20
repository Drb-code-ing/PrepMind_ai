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
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
  type ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot,
} from './review-planner-controlled-live-eval-v5-deepseek.evidence';
import {
  executeReviewPlannerControlledLiveV5DeepSeekCli,
  serializeReviewPlannerControlledLiveV5DeepSeekSummary,
} from './review-planner-controlled-live-eval-v5-deepseek.cli';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'V5_CLI_PRIVATE_KEY',
});

const historicalSnapshot: ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot =
  Object.freeze({
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v1',
    treeHash: 'a'.repeat(64),
    entries: Object.freeze([]),
  });

describe('Review/Planner controlled Live V5 DeepSeek CLI', () => {
  it.each([
    { argv: [] },
    { argv: ['--confirm-controlled-live-v5-deepseek-v4-pro', '--extra'] },
  ])(
    'rejects confirmation grammar %o before snapshot, reservation, or evaluator construction',
    async ({ argv }) => {
      const snapshotHistoricalEvidence = jest.fn();
      const reserveEvidence = jest.fn();
      const createEvaluator = jest.fn();

      await expect(
        executeReviewPlannerControlledLiveV5DeepSeekCli({
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

  it('closes failed preflight before historical evidence access', async () => {
    const snapshotHistoricalEvidence = jest.fn();
    const reserveEvidence = jest.fn();
    const createEvaluator = jest.fn();

    await expect(
      executeReviewPlannerControlledLiveV5DeepSeekCli({
        argv: ['--confirm-controlled-live-v5-deepseek-v4-pro'],
        env,
        root: 'safe-root',
        validatePreflight: jest.fn(() => ({
          ok: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
        })) as never,
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
  });

  it('reserves V5 evidence but closes a historical mismatch before evaluator construction', async () => {
    const reservation = fixtureReservation();
    const createEvaluator = jest.fn();
    const verifyHistoricalEvidence = jest
      .fn()
      .mockRejectedValue(new Error('history changed'));

    const result = await executeReviewPlannerControlledLiveV5DeepSeekCli(
      baseInput({
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator: createEvaluator as never,
        verifyHistoricalEvidence: verifyHistoricalEvidence as never,
      }),
    );

    expect(result).toEqual(
      closedBlocked(ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(reservation.markAttempted).not.toHaveBeenCalled();
    expect(reservation.finalize).not.toHaveBeenCalled();
    expect(createEvaluator).not.toHaveBeenCalled();
    expect(verifyHistoricalEvidence).toHaveBeenCalledTimes(1);
  });

  it('marks the evidence then closes a failed canary without running paired evaluation', async () => {
    const reservation = fixtureReservation();
    const runPairedEvaluation = jest.fn();
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'invalid_attempted',
          canContinue: false,
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
        }),
        runPairedEvaluation,
        providerAttemptCount: () => 1,
      },
    }));

    const result = await executeReviewPlannerControlledLiveV5DeepSeekCli(
      baseInput({
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator: createEvaluator as never,
      }),
    );

    expect(result).toEqual(
      closedAttempted(1, ReviewPlannerDiagnosticCode.StructuredOutput),
    );
    expect(reservation.markAttempted).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(reservation.finalize).toHaveBeenLastCalledWith(result);
  });

  it('opens only after exactly one positive canary and the frozen 48-case report total 23 attempts', async () => {
    const reservation = fixtureReservation();
    let attempts = 1;
    const report = qualityReport();
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 1,
          usageKnown: true,
        }),
        runPairedEvaluation: jest.fn().mockImplementation(() => {
          attempts = 23;
          return Promise.resolve({
            kind: 'report',
            report,
            cost: qualityCost(),
          });
        }),
        providerAttemptCount: () => attempts,
      },
    }));

    const result = await executeReviewPlannerControlledLiveV5DeepSeekCli(
      baseInput({
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator: createEvaluator as never,
      }),
    );

    expect(result).toEqual({
      status: 'complete',
      gate: 'open',
      providerAttemptCount: 23,
      usageKnown: true,
      priceProfileId:
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
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
        strictSuccesses: 22,
        qualityPasses: 22,
        criticalFailures: 0,
        p95DurationMs: 1,
        productionDecision: 'quality_gate_passed',
      },
    });
    expect(reservation.finalize).toHaveBeenLastCalledWith(result);
    const serialized =
      serializeReviewPlannerControlledLiveV5DeepSeekSummary(result);
    expect(serialized).not.toContain('V5_CLI_PRIVATE_KEY');
    expect(serialized).not.toContain('RAW_V5_CLI_CANDIDATE');
  });

  it('closes paired reports exceeding the P95 or CNY hard-cap gates', async () => {
    for (const paired of [
      {
        kind: 'report' as const,
        report: latencyExceededReport(),
        cost: qualityCost(),
      },
      { kind: 'report' as const, report: qualityReport(), cost: overCapCost() },
    ]) {
      const reservation = fixtureReservation();
      let attempts = 1;
      const createEvaluator = jest.fn(() => ({
        ok: true,
        value: {
          runDiagnostic: jest.fn().mockResolvedValue({
            status: 'complete',
            canContinue: true,
            providerAttemptCount: 1,
            usageKnown: true,
          }),
          runPairedEvaluation: jest.fn().mockImplementation(() => {
            attempts = 23;
            return Promise.resolve(paired);
          }),
          providerAttemptCount: () => attempts,
        },
      }));

      await expect(
        executeReviewPlannerControlledLiveV5DeepSeekCli(
          baseInput({
            reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
            createEvaluator: createEvaluator as never,
          }),
        ),
      ).resolves.toEqual(
        closedAttempted(23, ReviewPlannerDiagnosticCode.InvalidResponse),
      );
    }
  });

  it('closes an already-reserved second attempt without constructing an evaluator', async () => {
    const reservation = fixtureReservation({ markAttempted: false });
    const createEvaluator = jest.fn();

    const result = await executeReviewPlannerControlledLiveV5DeepSeekCli(
      baseInput({
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator: createEvaluator as never,
      }),
    );

    expect(result).toEqual(
      closedAttempted(0, ReviewPlannerDiagnosticCode.EvidenceIo),
    );
    expect(createEvaluator).not.toHaveBeenCalled();
  });
});

function baseInput(overrides: Record<string, unknown>) {
  return {
    argv: ['--confirm-controlled-live-v5-deepseek-v4-pro'],
    env,
    root: 'safe-root',
    now: () => 0,
    randomUUID: () => 'v5-cli-run',
    validatePreflight: jest.fn(() => ({ ok: true })) as never,
    snapshotHistoricalEvidence: jest
      .fn()
      .mockResolvedValue(historicalSnapshot) as never,
    verifyHistoricalEvidence: jest
      .fn()
      .mockResolvedValue(historicalSnapshot) as never,
    ...overrides,
  };
}

function fixtureReservation(input: { markAttempted?: boolean } = {}) {
  return {
    relativePath:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro/test.json',
    markAttempted: jest.fn().mockResolvedValue(input.markAttempted ?? true),
    finalize: jest.fn().mockResolvedValue(true),
    seal: jest.fn(),
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

function qualityReport(durationMs = 1): Phase695Report {
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
          durationMs,
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
      p95DurationMs: durationMs,
    },
    productionDecision:
      durationMs > 4_500 ? 'latency_budget_exceeded' : 'quality_gate_passed',
  });
}

function latencyExceededReport() {
  return qualityReport(4_501);
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
  return {
    ...qualityCost(),
    observedCostCny: 1.00001,
    withinHardCap: false,
  };
}
