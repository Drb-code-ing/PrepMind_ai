import { describe, expect, test } from 'bun:test';

import {
  createPhase697TutorOrganizerV9MockHarness,
  type Phase697V9SyntheticFault,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts';
import { runPhase697TutorOrganizerPairedEvalV9 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';

const FIRST_TUTOR_CASE = 'tutor-v2-runtime-01';
const FIRST_ORGANIZER_CASE = 'organizer-v2-runtime-01';

describe('Phase 6.9.7 V9 R4 reviewed Mock fault matrix', () => {
  test('projects transport, HTTP, response, schema, and usage faults to exact wire prefixes', async () => {
    const matrix: readonly Readonly<{
      fault: Phase697V9SyntheticFault;
      privateCategory: string;
      lastStage: string;
      counters: readonly [number, number, number, number];
      usageDisposition: 'not_observed' | 'invalid';
    }>[] = [
      {
        fault: 'fetch_sync_throw',
        privateCategory: 'transport',
        lastStage: 'provider_dispatch_started',
        counters: [1, 1, 0, 0],
        usageDisposition: 'not_observed',
      },
      {
        fault: 'fetch_reject',
        privateCategory: 'transport',
        lastStage: 'provider_dispatch_started',
        counters: [1, 1, 0, 0],
        usageDisposition: 'not_observed',
      },
      ...(['http_auth', 'http_rate_limit', 'http_client', 'http_server'] as const).map((fault) => ({
        fault,
        privateCategory: fault,
        lastStage: 'provider_response_received',
        counters: [1, 1, 1, 0] as const,
        usageDisposition: 'not_observed' as const,
      })),
      ...(['abnormal_status', 'empty_response', 'malformed_response_json'] as const).map(
        (fault) => ({
          fault,
          privateCategory: 'invalid_response',
          lastStage: 'provider_response_received',
          counters: [1, 1, 1, 0] as const,
          usageDisposition: 'not_observed' as const,
        }),
      ),
      ...(['reasoning_content', 'positive_reasoning_tokens'] as const).map((fault) => ({
        fault,
        privateCategory: 'response_audit',
        lastStage: 'provider_response_received',
        counters: [1, 1, 1, 0] as const,
        usageDisposition: 'not_observed' as const,
      })),
      {
        fault: 'missing_completion',
        privateCategory: 'provider_object_missing',
        lastStage: 'response_audit_passed',
        counters: [1, 1, 1, 0],
        usageDisposition: 'not_observed',
      },
      {
        fault: 'malformed_completion_json',
        privateCategory: 'provider_json_parse',
        lastStage: 'response_audit_passed',
        counters: [1, 1, 1, 0],
        usageDisposition: 'not_observed',
      },
      {
        fault: 'schema_mismatch',
        privateCategory: 'provider_type_validation',
        lastStage: 'content_parsed',
        counters: [1, 1, 1, 0],
        usageDisposition: 'not_observed',
      },
      ...(
        [
          'usage_missing',
          'usage_zero',
          'usage_negative',
          'usage_fractional',
          'usage_overflow',
        ] as const
      ).map((fault) => ({
        fault,
        privateCategory: 'usage_validation',
        lastStage: 'schema_validated',
        counters: [1, 1, 1, 0] as const,
        usageDisposition: 'invalid' as const,
      })),
    ];

    for (const [index, expected] of matrix.entries()) {
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697TutorOrganizerV9MockHarness({
          runId: matrixRunId(index),
          runScope: 'branch',
          faults: { [FIRST_ORGANIZER_CASE]: expected.fault },
        }),
      );
      const entry = report.caseEntries.find(
        (candidate) => candidate.caseId === FIRST_ORGANIZER_CASE,
      );
      expect(entry, expected.fault).toBeDefined();
      expect(entry?.strictRuntimeSuccess, expected.fault).toBe(false);
      expect(entry?.usageDisposition, expected.fault).toBe('unknown_after_attempt');
      expect(entry?.usage, expected.fault).toBeNull();
      expect(entry?.semanticAxes, expected.fault).toBeNull();
      expect(entry?.modelOwnedDecision, expected.fault).toBeNull();
      expect(entry?.wireEvidence.disposition, expected.fault).toBe('observed');
      const snapshot = entry?.wireEvidence.snapshot;
      expect(snapshot?.state, expected.fault).toBe('failed');
      expect(snapshot?.failureCategory, expected.fault).toBe(expected.privateCategory);
      expect(snapshot?.lastCompletedStage, expected.fault).toBe(expected.lastStage);
      expect(snapshot?.usageDisposition, expected.fault).toBe(expected.usageDisposition);
      expect(snapshot?.counters, expected.fault).toEqual({
        executorInvocations: expected.counters[0],
        providerDispatches: expected.counters[1],
        providerResponses: expected.counters[2],
        verifiedUsages: expected.counters[3],
      });
      expect(report.scheduler, expected.fault).toMatchObject({
        breakerState: 'quality_gate_impossible',
        triggerCaseId: FIRST_ORGANIZER_CASE,
        triggerAgent: 'wrong_question_organizer',
        triggerPairedRunIndex: 0,
        dispatchedPairs: 1,
        completedPairs: 1,
      });
      expect(report.runtimeAccounting, expected.fault).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expect(report.metrics, expected.fault).toMatchObject({
        complete: false,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
      });
      expect(report.usage, expected.fault).toMatchObject({
        complete: false,
        inputTokens: null,
        outputTokens: null,
        estimatedCostCny: null,
      });
      assertSingleDispatch(report, expected.fault);
      const safeBytes = JSON.stringify(report);
      for (const forbidden of [
        'synthetic-v9-r4-key',
        'V9_R4_SYNTHETIC',
        'synthetic auth',
        'synthetic rate limit',
        'synthetic reasoning',
        '"unexpected":true',
      ]) {
        expect(safeBytes, `${expected.fault}:${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('rejects V9 selection drift with bounded no-raw diagnostics', async () => {
    const matrix: readonly Readonly<{
      fault: Phase697V9SyntheticFault;
      caseId: string;
      reason: string;
      dynamic: boolean;
    }>[] = [
      {
        fault: 'selection_wrapper',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'top_level_keys',
        dynamic: false,
      },
      {
        fault: 'selection_extra_field',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'decision_keys',
        dynamic: false,
      },
      {
        fault: 'selection_numeric_string',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'option_index',
        dynamic: false,
      },
      {
        fault: 'selection_missing_option',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'decision_keys',
        dynamic: false,
      },
      {
        fault: 'selection_duplicate_question',
        caseId: 'organizer-v2-runtime-21',
        reason: 'selection_coverage',
        dynamic: true,
      },
      {
        fault: 'selection_question_out_of_range',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'question_index',
        dynamic: false,
      },
      {
        fault: 'selection_option_out_of_range',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'option_index',
        dynamic: false,
      },
    ];

    for (const [index, expected] of matrix.entries()) {
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697TutorOrganizerV9MockHarness({
          runId: matrixRunId(100 + index),
          runScope: 'branch',
          faults: { [expected.caseId]: expected.fault },
        }),
      );
      const entry = report.caseEntries.find((candidate) => candidate.caseId === expected.caseId);
      expect(entry?.candidateDisposition, expected.fault).toBe('fallback_schema_invalid');
      expect(entry?.failureCategory, expected.fault).toBe(
        expected.dynamic ? 'dynamic_contract' : 'structured_output',
      );
      expect(entry?.providerFailureCategory, expected.fault).toBe(
        expected.dynamic ? null : 'structured_output',
      );
      expect(entry?.structuredOutputStage, expected.fault).toBe(
        expected.dynamic ? null : 'provider_type_validation',
      );
      expect(entry?.usageDisposition, expected.fault).toBe('unknown_after_attempt');
      expect(entry?.usage, expected.fault).toBeNull();
      expect(entry?.semanticAxes, expected.fault).toBeNull();
      expect(entry?.modelOwnedDecision, expected.fault).toBeNull();
      expect(entry?.boundedSchemaDiagnostic, expected.fault).toMatchObject({
        reason: expected.reason,
        rawDataRetained: false,
      });
      assertSingleDispatch(report, expected.fault);
      const safeBytes = JSON.stringify(entry);
      for (const forbidden of [
        'synthetic-v9-r4-key',
        'explanation',
        'forbidden',
        'shortlistFingerprint',
        'optionSetFingerprint',
        'writeCommand',
      ]) {
        expect(safeBytes, `${expected.fault}:${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('keeps first, middle, and last breaker positions fixed without retry or backfill', async () => {
    for (const [ordinal, pairedRunIndex] of [0, 11, 23].entries()) {
      const caseId = `organizer-v2-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`;
      const requests: string[] = [];
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697TutorOrganizerV9MockHarness({
          runId: matrixRunId(140 + ordinal),
          runScope: 'branch',
          faults: { [caseId]: 'selection_extra_field' },
          onRequest: (request) => requests.push(request.caseId),
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
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: (pairedRunIndex + 1) * 2,
        terminalEntries: (pairedRunIndex + 1) * 2,
        orphanedEntries: 0,
        notStartedEntries: (23 - pairedRunIndex) * 2,
      });
      expect(report.wire).toEqual({
        complete: pairedRunIndex === 23,
        executorInvocations: (pairedRunIndex + 1) * 2,
        providerDispatches: (pairedRunIndex + 1) * 2,
        providerResponses: (pairedRunIndex + 1) * 2,
        verifiedUsages: (pairedRunIndex + 1) * 2 - 1,
      });
      expect(report.metrics).toMatchObject({
        complete: false,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
      });
      expect(requests).toHaveLength((pairedRunIndex + 1) * 2);
      expect(new Set(requests).size).toBe(requests.length);
      assertSingleDispatch(report, caseId);
    }
  });

  test('attributes a cooperative or ignored sibling abort locally with bounded settlement', async () => {
    for (const [index, siblingFault] of (['wait_for_abort', 'ignore_abort'] as const).entries()) {
      const requests: string[] = [];
      const report = await runPhase697TutorOrganizerPairedEvalV9(
        createPhase697TutorOrganizerV9MockHarness({
          runId: matrixRunId(160 + index),
          runScope: 'branch',
          faults: {
            [FIRST_TUTOR_CASE]: 'fetch_reject',
            [FIRST_ORGANIZER_CASE]: siblingFault,
          },
          onRequest: (request) => requests.push(request.caseId),
        }),
        { siblingSettlementTimeoutMs: 20 },
      );
      const tutor = report.caseEntries.find((entry) => entry.caseId === FIRST_TUTOR_CASE);
      const organizer = report.caseEntries.find((entry) => entry.caseId === FIRST_ORGANIZER_CASE);

      expect(tutor, siblingFault).toMatchObject({
        executionOutcome: 'executed_failure',
        failureCategory: 'provider_runtime',
        providerFailureCategory: 'transport',
      });
      expect(organizer, siblingFault).toMatchObject({
        executionOutcome: 'attempted_aborted',
        failureCategory: 'post_dispatch_abort',
        providerFailureCategory: null,
        boundedSchemaDiagnostic: null,
        usageDisposition: 'unknown_after_attempt',
        usage: null,
      });
      expect(organizer?.wireEvidence.snapshot, siblingFault).toMatchObject({
        state: 'failed',
        failureCategory: 'post_dispatch_abort',
        counters: {
          executorInvocations: 1,
          providerDispatches: 1,
          providerResponses: 0,
          verifiedUsages: 0,
        },
      });
      expect(report.runtimeAccounting, siblingFault).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expect(report.usage, siblingFault).toMatchObject({
        complete: false,
        inputTokens: null,
        outputTokens: null,
        estimatedCostCny: null,
      });
      expect(requests, siblingFault).toHaveLength(2);
      expect(new Set(requests).size, siblingFault).toBe(2);
      assertSingleDispatch(report, siblingFault);
    }
  });
});

function assertSingleDispatch(
  report: Awaited<ReturnType<typeof runPhase697TutorOrganizerPairedEvalV9>>,
  label: string,
) {
  for (const entry of report.caseEntries) {
    const counters = entry.wireEvidence.snapshot?.counters;
    if (!counters) continue;
    expect(counters.executorInvocations, `${label}:${entry.caseId}:executor`).toBeLessThanOrEqual(
      1,
    );
    expect(counters.providerDispatches, `${label}:${entry.caseId}:dispatch`).toBeLessThanOrEqual(1);
    expect(counters.providerResponses, `${label}:${entry.caseId}:response`).toBeLessThanOrEqual(1);
    expect(counters.verifiedUsages, `${label}:${entry.caseId}:usage`).toBeLessThanOrEqual(1);
  }
}

function matrixRunId(index: number) {
  return `00000000-0000-4000-8009-${String(index + 1).padStart(12, '0')}`;
}
