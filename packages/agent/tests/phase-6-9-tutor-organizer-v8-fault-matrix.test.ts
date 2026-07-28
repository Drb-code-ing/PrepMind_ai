import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import {
  createPhase697TutorOrganizerV8MockHarness,
  type Phase697V8SyntheticFault,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-mock.ts';
import { runPhase697TutorOrganizerPairedEvalV8 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import {
  TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
} from '../src/model-candidates/tutor-v6-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256,
} from '../src/model-candidates/wrong-question-organizer-v8-model-contract.ts';

const SUCCESS_RUN_ID = '00000000-0000-4000-8000-000000000804';
const FIRST_TUTOR_CASE = 'tutor-v2-runtime-01';
const FIRST_ORGANIZER_CASE = 'organizer-v2-runtime-01';

describe('Phase 6.9.7 V8 R4 reviewed direct-adapter Mock and fault matrix', () => {
  test('crosses the frozen Tutor and V8 fixed-shape Organizer chains for all 48 runtime cases', async () => {
    const runtimeCases = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.filter(
      (entry) => entry.subset === 'runtime',
    );
    const requestAudits: Parameters<
      NonNullable<Parameters<typeof createPhase697TutorOrganizerV8MockHarness>[0]['onRequest']>
    >[0][] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV8(
      createPhase697TutorOrganizerV8MockHarness({
        runId: SUCCESS_RUN_ID,
        runScope: 'branch',
        onRequest(request) {
          requestAudits.push(request);
        },
      }),
    );

    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
    );
    expect(PHASE_6_9_7_V6_DATASET_BINDING_SHA256).toBe(
      PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256,
    );
    expect(TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256).toBe(TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256);
    expect(WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256,
    );
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: true,
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
      maxConcurrentPairs: 1,
      maxConcurrentLaneOperations: 2,
    });
    expect(report.wire).toEqual({
      complete: true,
      executorInvocations: 48,
      providerDispatches: 48,
      providerResponses: 48,
      verifiedUsages: 48,
    });
    expect(report.metrics).toEqual({
      complete: true,
      strictRuntimeSuccesses: 48,
      tutorSemanticScore: 1,
      organizerSemanticScore: 1,
      combinedSemanticScore: 1,
    });
    expect(report.modelOwnedMetrics).toMatchObject({
      tutorIntent: { correct: 24, denominator: 24, accuracy: 1, passed: true },
      organizerSubjectDecision: { correct: 32, denominator: 32, accuracy: 1, passed: true },
      organizerDeckAction: { correct: 32, denominator: 32, accuracy: 1, passed: true },
      organizerTargetOrdinal: { correct: 32, denominator: 32, accuracy: 1, passed: true },
      qualityGatePassed: true,
    });
    expect(report.safety).toEqual({
      verifiedZeroCalls: 24,
      criticalFailures: 0,
      providerFailures: 0,
      permissionFailures: 0,
      mutationFailures: 0,
      broaderFallbacks: 0,
    });
    expect(report.gate).toBe('mock_quality_not_evidence');

    expect(requestAudits).toHaveLength(48);
    expect(new Set(requestAudits.map((entry) => entry.caseId))).toEqual(
      new Set(runtimeCases.map((entry) => entry.id)),
    );
    for (const audit of requestAudits) {
      expect(audit.url).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(audit.maxOutputTokens).toBe(audit.agent === 'tutor' ? 300 : 800);
      expect(audit.systemPrompt).toContain(
        audit.agent === 'tutor'
          ? 'policyVersion=tutor-model-candidate-v6'
          : 'policyVersion=wrong-question-organizer-model-candidate-v8',
      );
      const promptBytes = `${audit.systemPrompt}\n${audit.userPrompt}`;
      for (const forbidden of [
        audit.caseId,
        'expectedRuntimeInvocations',
        'acceptedTopicLabels',
        'canonicalTopicLabel',
        'writeCommand',
        'owner-a',
        '合成答案，不含真实用户资料',
      ]) {
        expect(promptBytes).not.toContain(forbidden);
      }
    }
  });

  test('projects transport, HTTP, response, schema, and usage failures to exact wire prefixes', async () => {
    const matrix: readonly Readonly<{
      fault: Phase697V8SyntheticFault;
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
      const report = await runPhase697TutorOrganizerPairedEvalV8(
        createPhase697TutorOrganizerV8MockHarness({
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
      });
      expect(report.metrics).toMatchObject({
        complete: false,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
      });
      expect(report.usage).toMatchObject({
        complete: false,
        inputTokens: null,
        outputTokens: null,
        estimatedCostCny: null,
      });
      const safeBytes = JSON.stringify(report);
      for (const forbidden of [
        'v8-r4-zero-network-synthetic-key',
        'V8_R4_SYNTHETIC',
        'synthetic auth',
        'synthetic rate limit',
        'synthetic reasoning',
        '"unexpected":true',
      ]) {
        expect(safeBytes, `${expected.fault}:${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('rejects common fixed-shape drift and records only bounded no-raw diagnostics', async () => {
    const cases: readonly Readonly<{
      fault: Phase697V8SyntheticFault;
      caseId: string;
      reason: string;
      dynamic: boolean;
    }>[] = [
      {
        fault: 'v6_nested_shape',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'decision_keys',
        dynamic: false,
      },
      {
        fault: 'fixed_shape_extra_field',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'decision_keys',
        dynamic: false,
      },
      {
        fault: 'fixed_shape_numeric_string',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'target_index',
        dynamic: false,
      },
      {
        fault: 'fixed_shape_missing_subject',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'decision_keys',
        dynamic: false,
      },
      {
        fault: 'fixed_shape_null_target',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'target_index',
        dynamic: false,
      },
      {
        fault: 'dynamic_fingerprint',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'dynamic_authority',
        dynamic: true,
      },
      {
        fault: 'dynamic_duplicate_question',
        caseId: 'organizer-v2-runtime-21',
        reason: 'dynamic_authority',
        dynamic: true,
      },
      {
        fault: 'dynamic_subject_authority',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'dynamic_authority',
        dynamic: true,
      },
      {
        fault: 'dynamic_target_authority',
        caseId: FIRST_ORGANIZER_CASE,
        reason: 'dynamic_authority',
        dynamic: true,
      },
    ];

    for (const [index, expected] of cases.entries()) {
      const report = await runPhase697TutorOrganizerPairedEvalV8(
        createPhase697TutorOrganizerV8MockHarness({
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
      expect(entry?.structuredOutputStage, expected.fault).toBe(
        expected.dynamic ? null : 'provider_type_validation',
      );
      expect(entry?.boundedSchemaDiagnostic, expected.fault).toMatchObject({
        reason: expected.reason,
        rawDataRetained: false,
      });
      const diagnosticBytes = JSON.stringify(entry?.boundedSchemaDiagnostic);
      for (const forbidden of ['explanation', 'forbidden', 'subjectDecision', 'deckDecision']) {
        expect(diagnosticBytes, `${expected.fault}:${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test('keeps first, middle, and last breaker positions deterministic without retry or backfill', async () => {
    const positions = [0, 11, 23] as const;
    for (const [ordinal, pairedRunIndex] of positions.entries()) {
      const caseId = `organizer-v2-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`;
      const report = await runPhase697TutorOrganizerPairedEvalV8(
        createPhase697TutorOrganizerV8MockHarness({
          runId: matrixRunId(140 + ordinal),
          runScope: 'branch',
          faults: { [caseId]: 'fixed_shape_extra_field' },
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
      expect(
        report.caseEntries.filter(
          (entry) =>
            entry.executionKind === 'runtime' && entry.executionOutcome.startsWith('not_started_'),
        ),
      ).toHaveLength((23 - pairedRunIndex) * 2);
    }
  });

  test('attributes sibling abort locally and never copies the triggering lane failure', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV8(
      createPhase697TutorOrganizerV8MockHarness({
        runId: matrixRunId(160),
        runScope: 'branch',
        faults: {
          [FIRST_TUTOR_CASE]: 'fetch_reject',
          [FIRST_ORGANIZER_CASE]: 'wait_for_abort',
        },
      }),
      { siblingSettlementTimeoutMs: 20 },
    );
    const tutor = report.caseEntries.find((entry) => entry.caseId === FIRST_TUTOR_CASE);
    const organizer = report.caseEntries.find((entry) => entry.caseId === FIRST_ORGANIZER_CASE);

    expect(tutor).toMatchObject({
      executionOutcome: 'executed_failure',
      failureCategory: 'provider_runtime',
      providerFailureCategory: 'transport',
    });
    expect(organizer).toMatchObject({
      executionOutcome: 'attempted_aborted',
      failureCategory: 'post_dispatch_abort',
      providerFailureCategory: null,
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
  });
});

function matrixRunId(index: number) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}
