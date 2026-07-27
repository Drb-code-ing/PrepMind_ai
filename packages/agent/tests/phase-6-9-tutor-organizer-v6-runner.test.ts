import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
  PHASE_6_9_7_V6_LANE_POLICY,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  createPhase697V6DispatchLedger,
  runPhase697TutorOrganizerPairedEvalV6,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  createPhase697V6SyntheticHarness,
  failedRuntimeResult,
  successfulOrganizerResult,
  successfulTutorResult,
  unknownUsageRuntimeResult,
} from './fixtures/phase-6-9-tutor-organizer-v6-runner.ts';

describe('Phase 6.9.7 V6 R3 paired runner', () => {
  test('keeps the fixed 72/24/48 denominator and completes one pair at a time', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV6(createPhase697V6SyntheticHarness());

    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(report).success).toBe(true);
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.caseEntries).toHaveLength(72);
    expect(report.safety.verifiedZeroCalls).toBe(24);
    expect(report.metrics.strictRuntimeSuccesses).toBe(48);
    expect(report.metrics.complete).toBe(true);
    expect(report.modelOwnedMetrics).toMatchObject({
      tutorIntent: { correct: 24, denominator: 24, complete: true, passed: true },
      organizerSubjectDecision: { correct: 32, denominator: 32, complete: true, passed: true },
      organizerDeckAction: { correct: 32, denominator: 32, complete: true, passed: true },
      organizerTargetOrdinal: { correct: 32, denominator: 32, complete: true, passed: true },
      qualityGatePassed: true,
    });
    expect(report.pairedDurationEvidence).toHaveLength(24);
    expect(report.latency.complete).toBe(true);
    expect(report.usage.providerInvocations).toBe(48);
    expect(report.usage.verifiedRuntimeCases).toBe(48);
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: true,
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
      maxConcurrentPairs: 1,
      maxConcurrentLaneOperations: 2,
    });
    expect(report.ledger).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      duplicateDispatchRejected: 0,
    });
    expect(report.gate).toBe('mock_quality_not_evidence');
    expect(report.lanePolicy).toEqual(PHASE_6_9_7_V6_LANE_POLICY);
    expect(report.lanePolicy.tutor.componentScope).not.toBe(
      report.lanePolicy.organizer.componentScope,
    );
  });

  test('keeps non-tutor and pre-abort guards provider-zero-call', async () => {
    let runtimeStarts = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulTutorResult(entry));
          },
          organizer(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulOrganizerResult(entry));
          },
        },
      }),
    );
    const routeGuard = report.caseEntries.find(
      (entry) => entry.caseId === 'tutor-v2-zero-route-not-tutor',
    );
    const preAbort = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-zero-aborted');
    expect(routeGuard).toMatchObject({
      runtimeInvocations: 0,
      candidateDisposition: 'not_eligible',
      zeroCallVerified: true,
    });
    expect(preAbort).toMatchObject({
      runtimeInvocations: 0,
      candidateDisposition: 'fallback_aborted',
      failureCategory: 'pre_dispatch_abort',
      zeroCallVerified: true,
    });
    expect(runtimeStarts).toBe(48);
  });

  test('keeps semantic/model-owned mismatches in the fixed denominator without opening the contract breaker', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry) {
            const success = successfulTutorResult(entry);
            if (entry.pairedRunIndex > 3) return Promise.resolve(success);
            const wrongIntent =
              entry.expected.intent === 'socratic_hint' ? 'step_check' : 'socratic_hint';
            return Promise.resolve({
              ...success,
              semanticAxes: { ...success.semanticAxes!, intent: false },
              modelOwnedDecision: { agent: 'tutor', intent: wrongIntent },
            });
          },
        },
      }),
    );

    expect(report.scheduler).toMatchObject({
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
    });
    expect(report.metrics.complete).toBe(true);
    expect(report.metrics.strictRuntimeSuccesses).toBe(48);
    expect(report.modelOwnedMetrics.tutorIntent).toMatchObject({
      correct: 20,
      denominator: 24,
      complete: true,
      passed: false,
    });
    expect(report.modelOwnedMetrics.qualityGatePassed).toBe(false);
  });

  test('opens on the first hard-deadline contract failure and nulls every formal aggregate', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry) {
            const success = successfulTutorResult(entry);
            if (entry.pairedRunIndex !== 0) return null;
            return Promise.resolve({
              ...success,
              durationEvidence: {
                ...success.durationEvidence,
                executor: {
                  stage: 'executor',
                  durationMs: 3_501,
                  deadlineMs: 3_500,
                  deadlineExceeded: true,
                  deadlineOvershootMs: 1,
                },
              },
            });
          },
        },
      }),
    );

    const trigger = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01');
    expect(trigger).toMatchObject({
      executionOutcome: 'executed_failure',
      failureCategory: 'runtime_timeout',
      strictRuntimeSuccess: false,
    });
    expect(report.caseEntries).toHaveLength(72);
    expect(report.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    expect(report.metrics).toMatchObject({
      complete: false,
      tutorSemanticScore: null,
      organizerSemanticScore: null,
      combinedSemanticScore: null,
    });
    expect(report.latency).toEqual({
      complete: false,
      tutorCandidateP95Ms: null,
      organizerCandidateP95Ms: null,
      pairedCandidateP95Ms: null,
      tutorOrchestrationP95Ms: null,
    });
    expect(report.usage).toMatchObject({
      complete: false,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCny: null,
    });
  });

  test('opens before runtime when a guard attempts a provider call', async () => {
    let runtimeStarts = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          zeroCall(entryId) {
            if (entryId !== 'tutor-v2-zero-route-not-tutor') return null;
            return {
              criticalFailure: false,
              permissionFailure: false,
              mutationFailure: false,
              broaderThanDeterministicFallback: false,
              runtimeInvocations: 1,
              candidateDisposition: 'fallback_runtime_error',
              zeroCallVerified: false,
              failureCategory: 'harness_internal',
            };
          },
          tutor(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulTutorResult(entry));
          },
          organizer(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulOrganizerResult(entry));
          },
        },
      }),
    );

    expect(runtimeStarts).toBe(0);
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: false,
      breakerState: 'guard_failed',
      dispatchedPairs: 0,
      completedPairs: 0,
    });
    expect(report.usage.providerInvocations).toBe(1);
    expect(report.metrics.complete).toBe(false);
    expect(report.metrics.tutorSemanticScore).toBeNull();
    expect(report.usage.complete).toBe(false);
    expect(report.usage.estimatedCostCny).toBeNull();
  });

  test('records post-dispatch abort and bounds an unresolved sibling as orphaned', async () => {
    let organizerStarts = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry) {
            if (entry.pairedRunIndex === 0) return Promise.resolve(failedRuntimeResult());
            return null;
          },
          organizer(entry) {
            organizerStarts += 1;
            if (entry.pairedRunIndex === 0) return new Promise(() => undefined);
            return null;
          },
        },
      }),
      { siblingSettlementTimeoutMs: 5 },
    );

    const firstTutor = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01');
    const firstOrganizer = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-01',
    );
    expect(firstTutor).toMatchObject({
      executionOutcome: 'executed_failure',
      usageDisposition: 'verified',
      failureCategory: 'dynamic_contract',
    });
    expect(firstOrganizer).toMatchObject({
      executionOutcome: 'attempted_orphaned',
      usageDisposition: 'unknown_after_attempt',
      usage: null,
      failureCategory: 'orphaned',
    });
    expect(organizerStarts).toBe(1);
    expect(report.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    expect(report.usage.complete).toBe(false);
    expect(report.usage.inputTokens).toBeNull();
    expect(report.latency.complete).toBe(false);
    expect(report.latency.pairedCandidateP95Ms).toBeNull();
  });

  test('attributes stale shortlist only to Organizer and stops new pairs', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry, signal) {
            if (entry.pairedRunIndex !== 0) return null;
            return new Promise((resolve) => {
              signal.addEventListener(
                'abort',
                () =>
                  resolve({
                    ...unknownUsageRuntimeResult(),
                    terminalHint: 'attempted_aborted',
                  }),
                { once: true },
              );
            });
          },
          organizer(entry) {
            if (entry.pairedRunIndex !== 0) return null;
            return Promise.resolve(failedRuntimeResult('stale_shortlist'));
          },
        },
      }),
      { siblingSettlementTimeoutMs: 20 },
    );
    const organizer = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-01',
    );
    const tutor = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01');
    expect(organizer).toMatchObject({
      executionOutcome: 'executed_failure',
      failureCategory: 'stale_shortlist',
      runtimeInvocations: 1,
    });
    expect(tutor).toMatchObject({
      executionOutcome: 'attempted_aborted',
      failureCategory: 'post_dispatch_abort',
      usageDisposition: 'unknown_after_attempt',
    });
    expect(report.caseEntries.filter((entry) => entry.dispatchRecorded)).toHaveLength(2);
    expect(
      report.caseEntries.filter(
        (entry) => entry.executionOutcome === 'not_started_quality_breaker',
      ),
    ).toHaveLength(46);
  });

  test('rejects duplicate dispatch keys before a second winner exists', () => {
    const ledger = createPhase697V6DispatchLedger('00000000-0000-4000-8000-000000000502');
    const reservation = ledger.reserve('tutor', 0);
    expect(() => ledger.reserve('tutor', 0)).toThrow('PHASE_6_9_7_V6_DUPLICATE_DISPATCH');
    expect(ledger.summary()).toEqual({
      reservedEntries: 1,
      terminalEntries: 0,
      duplicateDispatchRejected: 1,
    });
    ledger.complete(reservation);
    expect(ledger.summary().terminalEntries).toBe(1);
  });

  test('does not enter either lane when dispatch durability fails', async () => {
    let runtimeStarts = 0;
    let dispatchRecords = 0;
    const operation = runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({
        hooks: {
          tutor(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulTutorResult(entry));
          },
          organizer(entry) {
            runtimeStarts += 1;
            return Promise.resolve(successfulOrganizerResult(entry));
          },
        },
      }),
      {
        lifecycle: {
          async recordDispatchStarted() {
            dispatchRecords += 1;
            throw new Error('synthetic fsync failure');
          },
        },
      },
    );
    await expect(operation).rejects.toThrow('synthetic fsync failure');
    expect(dispatchRecords).toBe(1);
    expect(runtimeStarts).toBe(0);
  });

  test('recomputes canonical identity, aggregate fields, and Live provenance before gating', async () => {
    const mockReport = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness(),
    );
    const clone = () => JSON.parse(JSON.stringify(mockReport)) as Record<string, unknown>;

    const metricTamper = clone();
    (metricTamper.metrics as Record<string, unknown>).tutorSemanticScore = 0.5;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(metricTamper).success).toBe(
      false,
    );

    const usageTamper = clone();
    (usageTamper.usage as Record<string, unknown>).inputTokens = 1;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(usageTamper).success).toBe(false);

    const modelMetricTamper = clone();
    (
      (modelMetricTamper.modelOwnedMetrics as Record<string, unknown>).tutorIntent as Record<
        string,
        unknown
      >
    ).correct = 0;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(modelMetricTamper).success).toBe(
      false,
    );

    const identityTamper = clone();
    const identityEntries = identityTamper.caseEntries as Array<Record<string, unknown>>;
    identityEntries[0]!.agent =
      identityEntries[0]!.agent === 'tutor' ? 'wrong_question_organizer' : 'tutor';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(identityTamper).success).toBe(
      false,
    );

    const denominatorTamper = clone();
    const organizerBatch = (denominatorTamper.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.caseId === 'organizer-v2-runtime-21',
    );
    if (!organizerBatch) throw new Error('organizer batch case unavailable');
    (organizerBatch.semanticAxes as Record<string, unknown>).decisionUnits = 1;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(denominatorTamper).success).toBe(
      false,
    );

    const syntheticLive = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ mode: 'live' }),
    );
    expect(syntheticLive.gate).toBe('quality_gate_failed');
    const gateTamper = JSON.parse(JSON.stringify(syntheticLive)) as Record<string, unknown>;
    gateTamper.gate = 'quality_gate_passed';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(gateTamper).success).toBe(false);
  });
});
