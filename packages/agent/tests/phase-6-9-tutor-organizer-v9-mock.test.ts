import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V9_FROZEN_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION,
  createPhase697TutorOrganizerV9MockHarness,
  type Phase697V9MockRequestAudit,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts';
import { runPhase697TutorOrganizerPairedEvalV9 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';

describe('Phase 6.9.7 V9 R4 reviewed Mock', () => {
  test('crosses the reviewed candidate chain with fixed denominators and complete wire evidence', async () => {
    const requests: Phase697V9MockRequestAudit[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697TutorOrganizerV9MockHarness({
        runId: randomUUID(),
        runScope: 'branch',
        onRequest: (request) => requests.push(request),
      }),
    );

    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
    );
    expect(PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION).toBe(
      'phase-6.9.7-v9-reviewed-mock-factory-v1',
    );
    expect(PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_SHA256).toBe(
      PHASE_6_9_7_V9_FROZEN_REVIEWED_MOCK_FACTORY_SHA256,
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
      maxConcurrentLaneOperations: 2,
    });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      orphanedEntries: 0,
      notStartedEntries: 0,
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
    expect(report.gate).toBe('mock_quality_not_evidence');
    expect(report.executorProvenance).toBe('mock_synthetic');
    expect(report.structuredOutputMode).toBe('mock_json_v9');

    const runtimeCases = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.filter(
      (entry) => entry.subset === 'runtime',
    );
    expect(requests).toHaveLength(48);
    expect(new Set(requests.map((entry) => entry.caseId))).toEqual(
      new Set(runtimeCases.map((entry) => entry.id)),
    );
    for (const request of requests) {
      expect(request.url).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(request.maxOutputTokens).toBe(request.agent === 'tutor' ? 300 : 800);
      expect(request.systemPrompt).toContain(
        request.agent === 'tutor'
          ? 'policyVersion=tutor-model-candidate-v6'
          : 'policyVersion=wrong-question-organizer-model-candidate-v9',
      );
      const bytes = `${request.systemPrompt}\n${request.userPrompt}`;
      for (const forbidden of [
        'organizer-v2-runtime',
        'owner-a',
        'shortlistFingerprint',
        'optionSetFingerprint',
        '合成答案，不含真实用户资料',
        'synthetic-v9-r4-key',
      ]) {
        expect(bytes).not.toContain(forbidden);
      }
    }
  });

  test('keeps the responder independent from dataset expected values and production answer builders', async () => {
    const source = await Bun.file(
      new URL('../src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts', import.meta.url),
    ).text();
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import ') || line.startsWith('} from '))
      .join('\n');

    expect(source).not.toContain('.expected');
    expect(source).not.toContain('PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES');
    expect(imports).not.toMatch(/validateWrongQuestionOrganizerV9ModelDecision/);
    expect(imports).not.toMatch(/mergeWrongQuestionOrganizerV6ModelDecision/);
    expect(imports).not.toMatch(/wrong-question-organizer-v9-option-authority/);
  });
});
