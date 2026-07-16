import { ReviewPlannerDiagnosticCode } from '@repo/agent';

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

  it('runs the fixed paired evaluator once after a complete v3 diagnostic and makes a second invocation before no additional executor call', async () => {
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
        runDiagnostic,
        runPairedEvaluation,
        providerAttemptCount: () => 2,
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
      providerAttemptCount: 2,
      usageKnown: true,
    });
    expect(runDiagnostic).toHaveBeenCalledTimes(1);
    expect(runPairedEvaluation).toHaveBeenCalledTimes(1);
    expect(createEvaluator).toHaveBeenCalledTimes(1);

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
      report: {
        productionDecision: 'quality_gate_passed',
        counters: {
          runtimeInvocations: 22,
          inputTokens: 1,
          outputTokens: 1,
        },
      },
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
