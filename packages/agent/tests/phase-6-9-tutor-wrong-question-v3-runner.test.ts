import { describe, expect, test } from 'bun:test';

import {
  createPhase697TutorOrganizerMockHarness,
  type Phase697OrganizerEvalResult,
  type Phase697TutorEvalResult,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  createPhase697V3DispatchLedger,
  runPhase697TutorOrganizerPairedEvalV3,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';

describe('Phase 6.9.7 Tutor/Organizer V3 paired scheduler', () => {
  test('runs all guards first and completes all 24 pairs with at most two lane operations', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000401',
    });
    let activeLaneOperations = 0;
    let maximumActiveLaneOperations = 0;
    const withDelay = async <T>(operation: () => Promise<T>) => {
      activeLaneOperations += 1;
      maximumActiveLaneOperations = Math.max(maximumActiveLaneOperations, activeLaneOperations);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return await operation();
      } finally {
        activeLaneOperations -= 1;
      }
    };

    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      runTutor: (entry, recorder, signal) =>
        withDelay(() => base.runTutor(entry, recorder, signal)),
      runOrganizer: (entry, recorder, signal) =>
        withDelay(() => base.runOrganizer(entry, recorder, signal)),
    });

    expect(maximumActiveLaneOperations).toBe(2);
    expect(report.caseEntries).toHaveLength(72);
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: true,
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
      maxConcurrentPairs: 1,
      maxConcurrentLaneOperations: 2,
    });
    expect(report.ledger).toEqual({ reservedEntries: 48, terminalEntries: 48 });
    expect(report.lanes.tutor.budget).toEqual({
      maxCallsPerCase: 1,
      maxInputTokensPerCase: 1_200,
      maxOutputTokensPerCase: 300,
    });
    expect(report.lanes.organizer.budget).toEqual({
      maxCallsPerCase: 1,
      maxInputTokensPerCase: 3_500,
      maxOutputTokensPerCase: 800,
    });
    expect(report.execution).toMatchObject({
      executorStartedCases: 48,
      usageVerifiedCases: 48,
      usageUnknownCases: 0,
      notStartedCases: 24,
    });
    expect(report.latency.latencySampleComplete).toBe(true);
    expect(report.safety.strictRuntimeSuccesses).toBe(48);
    expect(report.gate).toBe('quality_gate_failed');
  });

  test.each([
    { pairedRunIndex: 0, expectedCallsPerLane: 1, remainingRuntime: 46 },
    { pairedRunIndex: 5, expectedCallsPerLane: 6, remainingRuntime: 36 },
    { pairedRunIndex: 23, expectedCallsPerLane: 24, remainingRuntime: 0 },
  ])(
    'opens the breaker at pair $pairedRunIndex and preserves the fixed denominator',
    async ({ pairedRunIndex, expectedCallsPerLane, remainingRuntime }) => {
      const base = createPhase697TutorOrganizerMockHarness({
        runId: `00000000-0000-4000-8000-0000000004${String(pairedRunIndex).padStart(2, '0')}`,
      });
      let tutorCalls = 0;
      let organizerCalls = 0;
      const report = await runPhase697TutorOrganizerPairedEvalV3({
        ...base,
        async runTutor(entry, recorder, signal) {
          tutorCalls += 1;
          const result = await base.runTutor(entry, recorder, signal);
          return entry.pairedRunIndex === pairedRunIndex ? schemaFailure(result) : result;
        },
        async runOrganizer(entry, recorder, signal) {
          organizerCalls += 1;
          return base.runOrganizer(entry, recorder, signal);
        },
      });

      expect(tutorCalls).toBe(expectedCallsPerLane);
      expect(organizerCalls).toBe(expectedCallsPerLane);
      expect(report.caseEntries).toHaveLength(72);
      expect(report.caseEntries.filter((entry) => entry.executionKind === 'runtime')).toHaveLength(
        48,
      );
      expect(report.scheduler.breakerState).toBe('quality_gate_impossible');
      expect(report.scheduler.triggerAgent).toBe('tutor');
      expect(report.scheduler.triggerPairedRunIndex).toBe(pairedRunIndex);
      expect(
        report.caseEntries.filter(
          (entry) => entry.executionOutcome === 'not_started_quality_breaker',
        ),
      ).toHaveLength(remainingRuntime);
      expect(report.latency.latencySampleComplete).toBe(false);
      expect(report.usage.pricingKnown).toBe(false);
      expect(report.gate).toBe('quality_gate_failed');
    },
  );

  test('aborts an in-flight sibling without copying the triggering lane failure category', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000405',
    });
    let organizerSawAbort = false;
    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      async runTutor(entry, recorder, signal) {
        const result = await base.runTutor(entry, recorder, signal);
        return entry.pairedRunIndex === 0
          ? schemaFailure(result, 'structured_output', 'provider_type_validation')
          : result;
      },
      async runOrganizer(entry, recorder, signal) {
        if (entry.pairedRunIndex !== 0) return base.runOrganizer(entry, recorder, signal);
        recorder?.completeStage('config_validated');
        recorder?.completeStage('executor_ready');
        recorder?.completeStage('request_validated');
        recorder?.startDelegate();
        await new Promise<void>((resolve) => {
          if (signal?.aborted) {
            organizerSawAbort = true;
            resolve();
            return;
          }
          signal?.addEventListener(
            'abort',
            () => {
              organizerSawAbort = true;
              resolve();
            },
            { once: true },
          );
        });
        return abortedOrganizerResult();
      },
    });

    const tutor = runtimeEntry(report, 'tutor', 0);
    const organizer = runtimeEntry(report, 'wrong_question_organizer', 0);
    expect(organizerSawAbort).toBe(true);
    expect(tutor.providerFailureCategory).toBe('structured_output');
    expect(tutor.structuredOutputStage).toBe('provider_type_validation');
    expect(organizer.executionOutcome).toBe('attempted_aborted');
    expect(organizer.providerFailureCategory).toBeNull();
    expect(organizer.structuredOutputStage).toBeNull();
    expect(report.caseEntries).toHaveLength(72);
  });

  test('keeps Organizer-first failure attribution separate from an aborted Tutor sibling', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000410',
    });
    let tutorSawAbort = false;
    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      async runTutor(entry, recorder, signal) {
        if (entry.pairedRunIndex !== 0) return base.runTutor(entry, recorder, signal);
        recorder?.completeStage('config_validated');
        recorder?.completeStage('executor_ready');
        recorder?.completeStage('request_validated');
        recorder?.startDelegate();
        await new Promise<void>((resolve) => {
          if (signal?.aborted) {
            tutorSawAbort = true;
            resolve();
            return;
          }
          signal?.addEventListener(
            'abort',
            () => {
              tutorSawAbort = true;
              resolve();
            },
            { once: true },
          );
        });
        return abortedTutorResult(entry.id);
      },
      async runOrganizer(entry, recorder, signal) {
        const result = await base.runOrganizer(entry, recorder, signal);
        return entry.pairedRunIndex === 0 ? organizerSchemaFailure(result) : result;
      },
    });

    const tutor = runtimeEntry(report, 'tutor', 0);
    const organizer = runtimeEntry(report, 'wrong_question_organizer', 0);
    expect(tutorSawAbort).toBe(true);
    expect(report.scheduler.triggerAgent).toBe('wrong_question_organizer');
    expect(organizer.providerFailureCategory).toBe('structured_output');
    expect(tutor.executionOutcome).toBe('attempted_aborted');
    expect(tutor.providerFailureCategory).toBeNull();
  });

  test('bounds a sibling that ignores abort and records its own orphaned usage state', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000411',
    });
    const report = await runPhase697TutorOrganizerPairedEvalV3(
      {
        ...base,
        async runTutor(entry, recorder, signal) {
          const result = await base.runTutor(entry, recorder, signal);
          return entry.pairedRunIndex === 0 ? schemaFailure(result) : result;
        },
        async runOrganizer(entry, recorder) {
          if (entry.pairedRunIndex !== 0) return base.runOrganizer(entry, recorder);
          recorder?.completeStage('config_validated');
          recorder?.completeStage('executor_ready');
          recorder?.completeStage('request_validated');
          recorder?.startDelegate();
          return new Promise<Phase697OrganizerEvalResult>(() => undefined);
        },
      },
      { siblingSettlementTimeoutMs: 5 },
    );

    const organizer = runtimeEntry(report, 'wrong_question_organizer', 0);
    expect(organizer.executionOutcome).toBe('attempted_orphaned');
    expect(organizer.usageDisposition).toBe('unknown_after_attempt');
    expect(organizer.providerFailureCategory).toBeNull();
    expect(report.ledger).toEqual({ reservedEntries: 2, terminalEntries: 2 });
    expect(report.scheduler.completedPairs).toBe(1);
  });

  test('fails closed on unverified or cross-lane-sized usage without leaking raw harness fields', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000412',
    });
    const rawCanary = 'Authorization: Bearer V3_R2_RAW_CANARY';
    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      async runTutor(entry, recorder, signal) {
        const result = await base.runTutor(entry, recorder, signal);
        if (entry.pairedRunIndex !== 0) return result;
        return {
          ...result,
          usage: {
            inputTokens: 1_201,
            outputTokens: 80,
            estimatedCostCny: (1_201 * 3 + 80 * 6) / 1_000_000,
          },
          rawError: rawCanary,
        };
      },
    });

    expect(report.scheduler.breakerState).toBe('quality_gate_impossible');
    expect(report.scheduler.triggerAgent).toBe('tutor');
    expect(runtimeEntry(report, 'tutor', 0)).toMatchObject({
      runtimeInvocations: 1,
      lastCompletedStage: 'applied',
      executionOutcome: 'harness_internal_error',
      usageDisposition: 'unknown_after_attempt',
      usage: null,
      strictRuntimeSuccess: false,
    });
    expect(report.usage.pricingKnown).toBe(false);
    expect(report.usage.unknownCases).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toContain(rawCanary);
  });

  test('does not break on a strict applied semantic mismatch', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000406',
    });
    let tutorCalls = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      async runTutor(entry, recorder, signal) {
        tutorCalls += 1;
        const result = await base.runTutor(entry, recorder, signal);
        if (entry.pairedRunIndex !== 0) return result;
        return {
          ...result,
          observation: {
            ...result.observation,
            actualIntent:
              result.observation.actualIntent === 'explain_solution'
                ? 'general_follow_up'
                : 'explain_solution',
          },
        };
      },
    });

    expect(tutorCalls).toBe(24);
    expect(report.scheduler.breakerState).toBe('closed');
    expect(report.safety.strictRuntimeSuccesses).toBe(48);
    expect(report.metrics.tutor.semanticScore).toBeLessThan(1);
    expect(report.caseEntries).toHaveLength(72);
  });

  test('stops all runtime dispatch when any guard case fails', async () => {
    const base = createPhase697TutorOrganizerMockHarness({
      runId: '00000000-0000-4000-8000-000000000407',
    });
    let changed = false;
    let runtimeCalls = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV3({
      ...base,
      async runZeroCall(entry, recorder) {
        const result = await base.runZeroCall(entry, recorder);
        if (changed) return result;
        changed = true;
        return { ...result, observedReason: 'guard_mismatch' as const };
      },
      async runTutor(entry, recorder, signal) {
        runtimeCalls += 1;
        return base.runTutor(entry, recorder, signal);
      },
      async runOrganizer(entry, recorder, signal) {
        runtimeCalls += 1;
        return base.runOrganizer(entry, recorder, signal);
      },
    });

    expect(runtimeCalls).toBe(0);
    expect(report.scheduler.breakerState).toBe('guard_failed');
    expect(report.scheduler.dispatchedPairs).toBe(0);
    expect(report.caseEntries.filter((entry) => entry.executionKind === 'runtime')).toHaveLength(
      48,
    );
    expect(
      report.caseEntries.filter(
        (entry) =>
          entry.executionKind === 'runtime' && entry.executionOutcome === 'not_started_case_guard',
      ),
    ).toHaveLength(48);
    expect(report.execution.executorStartedCases).toBe(0);
  });

  test('rejects duplicate dispatch keys and derived completeness tampering', async () => {
    const ledger = createPhase697V3DispatchLedger('00000000-0000-4000-8000-000000000408');
    const reservation = ledger.reserve('tutor', 0);
    expect(() => ledger.reserve('tutor', 0)).toThrow('PHASE_6_9_7_V3_DUPLICATE_DISPATCH');
    ledger.complete(reservation);

    const report = await runPhase697TutorOrganizerPairedEvalV3(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000409',
      }),
    );
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse({
        ...report,
        latency: { ...report.latency, latencySampleComplete: false },
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse({
        ...report,
        lanes: {
          ...report.lanes,
          tutor: {
            ...report.lanes.tutor,
            budget: {
              ...report.lanes.tutor.budget,
              maxInputTokensPerCase: 3_500,
            },
          },
        },
      }).success,
    ).toBe(false);
  });
});

function schemaFailure(
  result: Phase697TutorEvalResult,
  providerFailureCategory: 'structured_output' | null = null,
  structuredOutputStage: 'provider_type_validation' | null = null,
): Phase697TutorEvalResult {
  return {
    ...result,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_schema_invalid',
    canonicalSchemaSuccess: false,
    canonicalDiagnostic: {
      canonicalValidationStage: 'raw_schema',
      canonicalFailureReason: 'schema_invalid',
    },
    observation: { ...result.observation, validOutput: false },
    v3RuntimeEvidence: {
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory,
      structuredOutputStage,
      lastCompletedStage: 'structured_object_captured',
      executionOutcome: 'executed_failure',
      usageDisposition: 'verified',
    },
  };
}

function abortedOrganizerResult(): Phase697OrganizerEvalResult {
  return {
    criticalFailure: false,
    permissionFailure: false,
    mutationFailure: false,
    broaderThanDeterministicFallback: false,
    runtimeInvocations: 1,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_aborted',
    canonicalSchemaSuccess: false,
    canonicalDiagnostic: {
      canonicalValidationStage: null,
      canonicalFailureReason: null,
    },
    observations: [],
    latencyMs: 1,
    usage: null,
    v3RuntimeEvidence: {
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: null,
      structuredOutputStage: null,
      lastCompletedStage: 'delegate_started',
      executionOutcome: 'attempted_aborted',
      usageDisposition: 'unknown_after_attempt',
    },
  };
}

function organizerSchemaFailure(result: Phase697OrganizerEvalResult): Phase697OrganizerEvalResult {
  return {
    ...result,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_schema_invalid',
    canonicalSchemaSuccess: false,
    canonicalDiagnostic: {
      canonicalValidationStage: 'raw_schema',
      canonicalFailureReason: 'schema_invalid',
    },
    observations: result.observations.map((observation) => ({
      ...observation,
      validOutput: false,
    })),
    v3RuntimeEvidence: {
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: 'structured_output',
      structuredOutputStage: 'provider_type_validation',
      lastCompletedStage: 'structured_object_captured',
      executionOutcome: 'executed_failure',
      usageDisposition: 'verified',
    },
  };
}

function abortedTutorResult(caseId: string): Phase697TutorEvalResult {
  return {
    criticalFailure: false,
    permissionFailure: false,
    mutationFailure: false,
    broaderThanDeterministicFallback: false,
    runtimeInvocations: 1,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_aborted',
    canonicalSchemaSuccess: false,
    canonicalDiagnostic: {
      canonicalValidationStage: null,
      canonicalFailureReason: null,
    },
    observation: {
      caseId,
      expectedIntent: 'general_follow_up',
      actualIntent: null,
      expectedDepth: 'brief',
      actualDepth: null,
      expectedContextUse: false,
      actualContextUse: null,
      expectedGuidingQuestion: false,
      actualGuidingQuestion: null,
      expectedFinalAnswer: false,
      actualFinalAnswer: null,
      expectedAnswerStructure: [],
      actualAnswerStructure: [],
      validOutput: false,
    },
    latencyMs: 1,
    tutorOrchestrationLatencyMs: 1,
    usage: null,
    v3RuntimeEvidence: {
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: null,
      structuredOutputStage: null,
      lastCompletedStage: 'delegate_started',
      executionOutcome: 'attempted_aborted',
      usageDisposition: 'unknown_after_attempt',
    },
  };
}

function runtimeEntry(
  report: Awaited<ReturnType<typeof runPhase697TutorOrganizerPairedEvalV3>>,
  agent: 'tutor' | 'wrong_question_organizer',
  pairedRunIndex: number,
) {
  const entry = report.caseEntries.find(
    (candidate) =>
      candidate.executionKind === 'runtime' &&
      candidate.agent === agent &&
      candidate.pairedRunIndex === pairedRunIndex,
  );
  if (!entry) throw new Error(`missing runtime entry: ${agent}:${pairedRunIndex}`);
  return entry;
}
