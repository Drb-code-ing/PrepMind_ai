import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { runPhase697TutorOrganizerPairedEvalV9 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import {
  createPhase697V9FaultHarness,
  createPhase697V9SyntheticHarness,
  type Phase697V9SyntheticFault,
} from './fixtures/phase-6-9-tutor-organizer-v9-runner.ts';

const FIRST_TUTOR_CASE = 'tutor-v2-runtime-01';
const FIRST_ORGANIZER_CASE = 'organizer-v2-runtime-01';

describe('Phase 6.9.7 V9 R3 zero-provider fault matrix', () => {
  test('turns one failed guard into 48 not-started runtime entries without reserving a lane', async () => {
    const base = createPhase697V9SyntheticHarness({ runId: matrixRunId(0) });
    const firstGuard = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
      (entry) => entry.expectedRuntimeInvocations === 0,
    );
    if (!firstGuard) throw new Error('V9 guard fixture unavailable');
    let runtimeOperations = 0;
    let reservedEntries = 0;
    let terminalEntries = 0;
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      Object.freeze({
        ...base,
        async runZeroCall(entry) {
          const result = await base.runZeroCall(entry);
          return entry.id === firstGuard.id ? { ...result, zeroCallVerified: false } : result;
        },
        async runTutor(entry, signal, capability) {
          runtimeOperations += 1;
          return base.runTutor(entry, signal, capability);
        },
        async runOrganizer(entry, signal, capability) {
          runtimeOperations += 1;
          return base.runOrganizer(entry, signal, capability);
        },
      }),
      {
        lifecycle: {
          recordLaneReserved() {
            reservedEntries += 1;
            return Promise.resolve();
          },
          recordRuntimeTerminal() {
            terminalEntries += 1;
            return Promise.resolve();
          },
        },
      },
    );

    const runtime = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
    expect(runtime).toHaveLength(48);
    expect(runtime.every((entry) => entry.executionOutcome === 'not_started_case_guard')).toBe(
      true,
    );
    expect(runtime.every((entry) => entry.boundedSchemaDiagnostic === null)).toBe(true);
    expect(runtimeOperations).toBe(0);
    expect(reservedEntries).toBe(0);
    expect(terminalEntries).toBe(0);
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: false,
      breakerState: 'guard_failed',
      dispatchedPairs: 0,
      completedPairs: 0,
    });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 48,
    });
    expect(report.wire).toEqual({
      complete: false,
      executorInvocations: 0,
      providerDispatches: 0,
      providerResponses: 0,
      verifiedUsages: 0,
    });
    expectFormalAggregatesNull(report);
  });

  test('records exact terminal wire stages and only bounded selection diagnostics', async () => {
    const matrix: readonly Readonly<{
      fault: Phase697V9SyntheticFault;
      wireFailure: string | null;
      lastStage: string;
      counters: readonly [number, number, number, number];
      diagnosticReason: string | null;
    }>[] = [
      {
        fault: 'transport',
        wireFailure: 'transport',
        lastStage: 'provider_dispatch_started',
        counters: [1, 1, 0, 0],
        diagnosticReason: null,
      },
      {
        fault: 'http_server',
        wireFailure: 'http_server',
        lastStage: 'provider_response_received',
        counters: [1, 1, 1, 0],
        diagnosticReason: null,
      },
      {
        fault: 'schema',
        wireFailure: 'provider_type_validation',
        lastStage: 'content_parsed',
        counters: [1, 1, 1, 0],
        diagnosticReason: 'top_level_keys',
      },
      {
        fault: 'usage',
        wireFailure: 'usage_validation',
        lastStage: 'schema_validated',
        counters: [1, 1, 1, 0],
        diagnosticReason: null,
      },
      {
        fault: 'selection_authority',
        wireFailure: null,
        lastStage: 'usage_validated',
        counters: [1, 1, 1, 1],
        diagnosticReason: 'selection_authority',
      },
      {
        fault: 'option_authority',
        wireFailure: null,
        lastStage: 'usage_validated',
        counters: [1, 1, 1, 1],
        diagnosticReason: 'option_authority',
      },
    ];

    for (const [index, expected] of matrix.entries()) {
      const delegateCounts = new Map<string, number>();
      const terminals: string[] = [];
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697V9FaultHarness({
          runId: matrixRunId(20 + index),
          faults: { [FIRST_ORGANIZER_CASE]: expected.fault },
          onDelegate(caseId) {
            delegateCounts.set(caseId, (delegateCounts.get(caseId) ?? 0) + 1);
          },
        }),
        {
          lifecycle: {
            recordRuntimeTerminal(_reservation, entry) {
              terminals.push(entry.caseId);
              return Promise.resolve();
            },
          },
        },
      );
      const entry = report.caseEntries.find(
        (candidate) => candidate.caseId === FIRST_ORGANIZER_CASE,
      );
      expect(entry, expected.fault).toBeDefined();
      expect(entry?.strictRuntimeSuccess, expected.fault).toBe(false);
      expect(entry?.wireEvidence.disposition, expected.fault).toBe('observed');
      expect(entry?.wireEvidence.snapshot, expected.fault).toMatchObject({
        state: expected.wireFailure === null ? 'succeeded' : 'failed',
        failureCategory: expected.wireFailure,
        lastCompletedStage: expected.lastStage,
        counters: {
          executorInvocations: expected.counters[0],
          providerDispatches: expected.counters[1],
          providerResponses: expected.counters[2],
          verifiedUsages: expected.counters[3],
        },
      });
      expect(entry?.boundedSchemaDiagnostic?.reason ?? null, expected.fault).toBe(
        expected.diagnosticReason,
      );
      if (entry?.boundedSchemaDiagnostic) {
        expect(entry.boundedSchemaDiagnostic.rawDataRetained).toBe(false);
      }
      expect(delegateCounts.get(FIRST_ORGANIZER_CASE), expected.fault).toBe(1);
      expect(terminals.filter((caseId) => caseId === FIRST_ORGANIZER_CASE)).toHaveLength(1);
      expect(
        report.caseEntries.filter((candidate) => candidate.executionKind === 'runtime'),
      ).toHaveLength(48);
      expect(
        report.caseEntries.filter(
          (candidate) => candidate.executionOutcome === 'not_started_quality_breaker',
        ),
      ).toHaveLength(46);
      expect(
        report.caseEntries
          .filter((candidate) => candidate.executionOutcome.startsWith('not_started_'))
          .every((candidate) => candidate.boundedSchemaDiagnostic === null),
      ).toBe(true);
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expectFormalAggregatesNull(report);
      expect(JSON.stringify(report)).not.toContain('V9_R3_SYNTHETIC');
    }
  });

  test('keeps first, middle, and last breaker positions fixed with single dispatch and no backfill', async () => {
    for (const [ordinal, pairedRunIndex] of [0, 11, 23].entries()) {
      const caseId = `organizer-v2-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`;
      const delegateCounts = new Map<string, number>();
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697V9FaultHarness({
          runId: matrixRunId(40 + ordinal),
          faults: { [caseId]: 'selection_coverage' },
          onDelegate(currentCaseId) {
            delegateCounts.set(currentCaseId, (delegateCounts.get(currentCaseId) ?? 0) + 1);
          },
        }),
      );

      expect(report.scheduler).toMatchObject({
        breakerState: 'quality_gate_impossible',
        triggerCaseId: caseId,
        triggerAgent: 'wrong_question_organizer',
        triggerPairedRunIndex: pairedRunIndex,
        dispatchedPairs: pairedRunIndex + 1,
        completedPairs: pairedRunIndex + 1,
      });
      expect(report.caseEntries).toHaveLength(72);
      expect(
        report.caseEntries.filter(
          (entry) => entry.executionOutcome === 'not_started_quality_breaker',
        ),
      ).toHaveLength((23 - pairedRunIndex) * 2);
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: (pairedRunIndex + 1) * 2,
        terminalEntries: (pairedRunIndex + 1) * 2,
        orphanedEntries: 0,
        notStartedEntries: (23 - pairedRunIndex) * 2,
      });
      expect([...delegateCounts.values()].every((count) => count === 1)).toBe(true);
      expect(delegateCounts.size).toBe((pairedRunIndex + 1) * 2);
      expect(delegateCounts.get(caseId)).toBe(1);
      expectFormalAggregatesNull(report);
    }
  });

  test('attributes sibling post-dispatch abort locally without copying transport or diagnostics', async () => {
    const delegateCounts = new Map<string, number>();
    const terminals: string[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9FaultHarness({
        runId: matrixRunId(60),
        faults: {
          [FIRST_TUTOR_CASE]: 'transport',
          [FIRST_ORGANIZER_CASE]: 'wait_for_abort',
        },
        onDelegate(caseId) {
          delegateCounts.set(caseId, (delegateCounts.get(caseId) ?? 0) + 1);
        },
      }),
      {
        siblingSettlementTimeoutMs: 20,
        lifecycle: {
          recordRuntimeTerminal(_reservation, entry) {
            terminals.push(entry.caseId);
            return Promise.resolve();
          },
        },
      },
    );
    const tutor = report.caseEntries.find((entry) => entry.caseId === FIRST_TUTOR_CASE);
    const organizer = report.caseEntries.find((entry) => entry.caseId === FIRST_ORGANIZER_CASE);

    expect(tutor).toMatchObject({
      executionOutcome: 'executed_failure',
      failureCategory: 'provider_runtime',
      providerFailureCategory: 'transport',
      boundedSchemaDiagnostic: null,
    });
    expect(tutor?.wireEvidence.snapshot).toMatchObject({
      state: 'failed',
      failureCategory: 'transport',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 0,
        verifiedUsages: 0,
      },
    });
    expect(organizer).toMatchObject({
      executionOutcome: 'attempted_aborted',
      failureCategory: 'post_dispatch_abort',
      providerFailureCategory: null,
      structuredOutputStage: null,
      boundedSchemaDiagnostic: null,
    });
    expect(organizer?.wireEvidence.snapshot).toMatchObject({
      state: 'failed',
      failureCategory: 'post_dispatch_abort',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 0,
        verifiedUsages: 0,
      },
    });
    expect(delegateCounts).toEqual(
      new Map([
        [FIRST_TUTOR_CASE, 1],
        [FIRST_ORGANIZER_CASE, 1],
      ]),
    );
    expect(terminals.sort()).toEqual([FIRST_ORGANIZER_CASE, FIRST_TUTOR_CASE].sort());
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expectFormalAggregatesNull(report);
  });
});

function expectFormalAggregatesNull(
  report: Awaited<ReturnType<typeof runPhase697TutorOrganizerPairedEvalV9>>,
) {
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
}

function matrixRunId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}
