import {
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  PHASE_695_SHARED_BUDGET,
  phase695ReportSchema,
  phase695ReviewPlannerCases,
  ReviewPlannerDiagnosticCode,
  type Phase695Report,
} from '@repo/agent';

import { executeReviewPlannerControlledLiveV3Cli } from './review-planner-controlled-live-eval-cli';

const liveV3Env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v3-cli-private-canary',
});

describe('review planner controlled Live v3 CLI', () => {
  it.each([
    { argv: [] },
    { argv: ['--confirm-controlled-live'] },
    { argv: ['--confirm-controlled-live-v3', '--extra'] },
  ])(
    'requires the v3 exact confirmation grammar %# before reservation or executor',
    async ({ argv }) => {
      const reserveEvidence = jest.fn();
      const createEvaluator = jest.fn();

      await expect(
        executeReviewPlannerControlledLiveV3Cli({
          argv,
          env: liveV3Env,
          root: 'never-opened-for-invalid-v3-confirmation',
          reserveEvidence,
          createEvaluator,
        }),
      ).resolves.toEqual({
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(reserveEvidence).not.toHaveBeenCalled();
      expect(createEvaluator).not.toHaveBeenCalled();
    },
  );

  it('reserves and marks v3 evidence before constructing the executor, retains a safe stage, and skips the paired runner', async () => {
    const events: string[] = [];
    const runPairedEvaluation = jest.fn();
    const reservation = reservationFixture(events);
    const runDiagnostic = jest.fn().mockResolvedValue({
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_json_parse',
    });
    const createEvaluator = jest.fn(() => {
      events.push('evaluator');
      return {
        ok: true,
        value: {
          runDiagnostic,
          runPairedEvaluation,
          providerAttemptCount: () => 1,
        },
      };
    });

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        dependencies: {
          createExecutor: () => {
            throw new Error('MUST_USE_INJECTED_EVALUATOR');
          },
        },
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_json_parse',
    });
    expect(events.slice(0, 2)).toEqual(['mark_attempted', 'evaluator']);
    expect(runDiagnostic).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(reservation.finalize).toHaveBeenCalledWith({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_json_parse',
    });
  });

  it('preserves the diagnostic observed attempt and legal stage when the later evaluator count getter throws', async () => {
    const events: string[] = [];
    const reservation = reservationFixture(events);
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
          structuredOutputStage: 'provider_object_missing',
        }),
        runPairedEvaluation,
        providerAttemptCount: () => {
          throw new Error('POST_DIAGNOSTIC_COUNT_GETTER_FAILURE');
        },
      },
    }));

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_object_missing',
    });
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(reservation.finalize).toHaveBeenCalledWith({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_object_missing',
    });
  });

  it('keeps a post-reservation mark failure conservative and does not construct an evaluator', async () => {
    const events: string[] = [];
    const reservation = {
      ...reservationFixture(events),
      markAttempted: jest
        .fn()
        .mockRejectedValue(new Error('MARK_CLOSE_FAILURE_CANARY')),
    };
    const createEvaluator = jest.fn();

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(createEvaluator).not.toHaveBeenCalled();
    expect(reservation.finalize).toHaveBeenCalledWith({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
  });

  it('opens only after one canary plus the canonical 48-case paired report accounts for all 23 attempts', async () => {
    const events: string[] = [];
    const firstReservation = reservationFixture(events);
    const reserveEvidence = jest
      .fn()
      .mockResolvedValueOnce(firstReservation)
      .mockRejectedValueOnce(new Error('V3_ALREADY_CONSUMED'));
    const runDiagnostic = jest.fn().mockResolvedValue({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    const validQualityReport = qualityGatePassedReport();
    const runPairedEvaluation = jest.fn().mockResolvedValue({
      kind: 'report',
      report: validQualityReport,
    });
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic,
        runPairedEvaluation,
        providerAttemptCount: () => 23,
      },
    }));
    const input = {
      argv: ['--confirm-controlled-live-v3'],
      env: liveV3Env,
      root: 'injected-v3-safe-reservation',
      dependencies: {
        createExecutor: () => {
          throw new Error('MUST_USE_INJECTED_EVALUATOR');
        },
      },
      reserveEvidence,
      createEvaluator,
    } as never;

    await expect(
      executeReviewPlannerControlledLiveV3Cli(input),
    ).resolves.toEqual({
      status: 'complete',
      gate: 'open',
      providerAttemptCount: 23,
      usageKnown: true,
    });
    expect(runDiagnostic).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(createEvaluator).toHaveBeenCalledTimes(1);
    expect(phase695ReportSchema.parse(validQualityReport)).toEqual(
      validQualityReport,
    );

    await expect(
      executeReviewPlannerControlledLiveV3Cli(input),
    ).resolves.toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(runDiagnostic).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(createEvaluator).toHaveBeenCalledTimes(1);
  });

  it('closes a forged incomplete paired report instead of treating one runtime entry as a canonical quality gate', async () => {
    const events: string[] = [];
    const reservation = reservationFixture(events);
    const runPairedEvaluation = jest.fn().mockResolvedValue({
      kind: 'report',
      report: {
        productionDecision: 'quality_gate_passed',
        counters: { runtimeInvocations: 1, inputTokens: 1, outputTokens: 1 },
      },
    });
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 1,
          usageKnown: true,
        }),
        runPairedEvaluation,
        providerAttemptCount: () => 2,
      },
    }));

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 2,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
  });

  it('closes before paired evaluation when a complete canary reports zero attempts, even with a valid 48-case quality report and total 22', async () => {
    const events: string[] = [];
    const reservation = reservationFixture(events);
    const validQualityReport = qualityGatePassedReport();
    const runPairedEvaluation = jest.fn().mockResolvedValue({
      kind: 'report',
      report: validQualityReport,
    });
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 0,
          usageKnown: true,
        }),
        runPairedEvaluation,
        providerAttemptCount: () => 22,
      },
    }));

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 22,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
    });
    expect(phase695ReportSchema.parse(validQualityReport)).toEqual(
      validQualityReport,
    );
    expect(runPairedEvaluation).not.toHaveBeenCalled();
  });

  it('fails closed rather than trusting an impossible diagnostic-plus-paired attempt aggregate', async () => {
    const events: string[] = [];
    const reservation = reservationFixture(events);
    const validQualityReport = qualityGatePassedReport();
    const overflowedPairedReport = {
      ...validQualityReport,
      counters: {
        ...validQualityReport.counters,
        runtimeInvocations: 48,
      },
    };
    const runPairedEvaluation = jest.fn().mockResolvedValue({
      kind: 'report',
      report: overflowedPairedReport,
    });
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 1,
          usageKnown: true,
        }),
        runPairedEvaluation,
        providerAttemptCount: () => 48,
      },
    }));

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 48,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
    expect(phase695ReportSchema.safeParse(overflowedPairedReport).success).toBe(
      false,
    );
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
  });

  it('fails closed with the additive canary plus paired lower bound when the authoritative total getter fails after paired execution', async () => {
    const events: string[] = [];
    const reservation = reservationFixture(events);
    const runDiagnostic = jest.fn().mockResolvedValue({
      status: 'complete',
      canContinue: true,
      providerAttemptCount: 1,
      usageKnown: true,
    });
    const runPairedEvaluation = jest.fn().mockResolvedValue({
      kind: 'report',
      report: qualityGatePassedReport(),
    });
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic,
        runPairedEvaluation,
        providerAttemptCount: () => {
          throw new Error('POST_PAIRED_TOTAL_GETTER_FAILURE');
        },
      },
    }));

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'injected-v3-safe-reservation',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
        createEvaluator,
      } as never),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 23,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
    });
    expect(runDiagnostic).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(reservation.finalize).toHaveBeenCalledWith({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 23,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
    });
  });

  it('returns a conservative attempted evidence failure when finalization rejects after one diagnostic attempt', async () => {
    const executor = jest.fn(() =>
      Promise.reject(new Error('RAW_V3_PROVIDER_FAILURE_CANARY')),
    );
    const runPairedEvaluation = jest.fn();
    const reservation = {
      relativePath:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/test.json',
      markAttempted: jest.fn().mockResolvedValue(true),
      finalize: jest
        .fn()
        .mockRejectedValue(new Error('FINALIZER_CLOSE_FAILURE_CANARY')),
      discard: jest.fn(),
    };

    await expect(
      executeReviewPlannerControlledLiveV3Cli({
        argv: ['--confirm-controlled-live-v3'],
        env: liveV3Env,
        root: 'must-not-be-opened-by-injected-reservation',
        dependencies: {
          createExecutor: () => executor,
          runPairedEvaluation,
        },
        now: () => Date.parse('2026-07-17T00:00:00.000Z'),
        randomUUID: () => 'v3-finalizer-rejection-run',
        reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(reservation.finalize).toHaveBeenCalledWith({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
  });
});

function reservationFixture(events: string[]) {
  return {
    relativePath:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/test.json',
    markAttempted: jest.fn().mockImplementation(() => {
      events.push('mark_attempted');
      return Promise.resolve(true);
    }),
    finalize: jest.fn().mockImplementation(() => {
      events.push('finalize');
      return Promise.resolve(true);
    }),
    discard: jest.fn(),
  };
}

function qualityGatePassedReport(): Phase695Report {
  const caseEntries = phase695ReviewPlannerCases.map((testCase) =>
    testCase.executionKind === 'zero_call'
      ? {
          caseId: testCase.id,
          lane: testCase.lane,
          executionKind: 'zero_call' as const,
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
          runtimeInvocations: 1 as const,
          strictSuccess: true,
          qualityPass: true,
          criticalFailure: false,
          durationMs: 1,
          usage: { inputTokens: 1, outputTokens: 1 },
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
      inputTokens: 22,
      outputTokens: 22,
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
