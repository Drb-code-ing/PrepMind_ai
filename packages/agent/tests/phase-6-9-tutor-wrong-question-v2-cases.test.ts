import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
  computeTutorWrongQuestionDatasetSha256,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE,
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
  PHASE_6_9_7_V5_FROZEN_DETERMINISTIC_BASELINE_SHA256,
  runPhase697V2DeterministicBaseline,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_COHERENCE,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2Case,
  type Phase697V2OrganizerCase,
  type Phase697V2TutorCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  projectPhase697V2OrganizerFixture,
  projectPhase697V2TutorFixture,
  validatePhase697V2DatasetCoherence,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-coherence.ts';
import {
  PHASE_6_9_7_V5_EVAL_POLICY,
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
  PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256,
  computePhase697V5PolicySha256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-policy.ts';

describe('Phase 6.9.7 V5 R1 V2 dataset authority', () => {
  test('freezes a new 72-case identity while preserving the V1 authority', () => {
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION).toBe(
      'phase-6.9-tutor-wrong-question-v1',
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256).toBe(
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
    );
    expect(computeTutorWrongQuestionDatasetSha256(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES)).toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION).toBe(
      'phase-6.9-tutor-wrong-question-v2',
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).toBe(
      '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b',
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).not.toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_COHERENCE).toEqual({
      ok: true,
      issues: [],
      counts: {
        cases: 72,
        zeroCall: 24,
        runtime: 48,
        pairedRequests: 24,
        tutor: 36,
        organizer: 36,
        organizerDecisionUnits: 32,
      },
      tutorRuntimeLanguages: { zh: 12, en: 10, mixed: 2 },
    });
  });

  test('binds every Tutor runtime language and exercise family to a coherent context', () => {
    const runtime = phase697V2TutorCases.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    expect(runtime).toHaveLength(24);
    for (const testCase of runtime) {
      expect(testCase.tags).toContain(testCase.authority.language);
      expect(testCase.tags).toContain(testCase.authority.exerciseFamily);
      expect(testCase.input.activeStudyContext).toBe(testCase.authority.context.text);
      expect(testCase.authority.context.language).toBe(testCase.authority.language);
      expect(testCase.authority.context.exerciseFamily).toBe(testCase.authority.exerciseFamily);
    }

    const repairedIdentity = runtime.find((testCase) => testCase.id === 'tutor-v2-runtime-06');
    expect(repairedIdentity?.authority).toMatchObject({
      language: 'zh',
      exerciseFamily: 'algebra_linear_equation',
      context: {
        language: 'zh',
        exerciseFamily: 'algebra_linear_equation',
        source: 'synthetic',
      },
    });
    expect(repairedIdentity?.input.latestUserText).toContain('2x=6');
    expect(repairedIdentity?.input.activeStudyContext).toContain('线性方程');
    expect(repairedIdentity?.input.activeStudyContext).not.toContain('derivative');
  });

  test('freezes Organizer subject, taxonomy, topic candidates, ordinals, and batch relations', () => {
    const runtime = phase697V2OrganizerCases.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    expect(runtime).toHaveLength(24);
    expect(runtime.reduce((total, testCase) => total + testCase.expected.decisions.length, 0)).toBe(
      32,
    );
    expect(
      runtime.filter((testCase) => testCase.authority.batchRelation === 'single'),
    ).toHaveLength(20);
    expect(
      runtime.filter((testCase) => testCase.authority.batchRelation === 'same_subject_batch'),
    ).toHaveLength(1);
    expect(
      runtime.filter((testCase) => testCase.authority.batchRelation === 'cross_subject_batch'),
    ).toHaveLength(3);

    for (const testCase of runtime) {
      for (const expected of testCase.expected.decisions) {
        const authority = testCase.authority.decisions.find(
          (decision) => decision.questionIndex === expected.questionIndex,
        );
        expect(authority).toBeDefined();
        expect(authority?.subjectCandidates).toContain(expected.subject);
        expect(authority?.topicCandidates).toHaveLength(3);
        expect(authority?.topicCandidates[expected.topicCandidateIndex]?.label).toBe(
          expected.canonicalTopicLabel,
        );
        expect(
          authority?.topicCandidates.every((candidate) => candidate.subject === expected.subject),
        ).toBe(true);
      }
    }
  });

  test('projects prompt-safe fixture inputs without expected or historical authority fields', () => {
    const tutor = phase697V2TutorCases.find(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    const organizer = phase697V2OrganizerCases.find(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    if (!tutor || tutor.expectedRuntimeInvocations !== 1) throw new Error('TUTOR_V2_CASE_MISSING');
    if (!organizer || organizer.expectedRuntimeInvocations !== 1) {
      throw new Error('ORGANIZER_V2_CASE_MISSING');
    }

    const tutorProjection = projectPhase697V2TutorFixture(tutor);
    const organizerProjection = projectPhase697V2OrganizerFixture(organizer);
    const keys = recursiveKeys({ tutorProjection, organizerProjection });
    for (const forbiddenKey of [
      'expected',
      'acceptedTopicLabels',
      'canonicalTopicLabel',
      'topicCandidateIndex',
      'caseId',
      'ownerRef',
      'hasExistingItem',
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
    const serialized = JSON.stringify({ tutorProjection, organizerProjection });
    expect(serialized).not.toContain('tutor-runtime-06');
    expect(serialized).not.toContain(
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
    );
    expect(isDeepFrozen(tutorProjection)).toBe(true);
    expect(isDeepFrozen(organizerProjection)).toBe(true);
  });

  test('fails closed for language/context drift, invalid pair indexes, duplicate ids, and topic ordinal ABA', () => {
    const languageDrift = cloneDataset();
    const tutor = languageDrift.tutorCases.find(
      (testCase) => testCase.id === 'tutor-v2-runtime-06',
    );
    if (!tutor) throw new Error('TUTOR_V2_MUTATION_CASE_MISSING');
    tutor.authority.context.language = 'en';
    const languageReport = validateClone(languageDrift);
    expect(languageReport.ok).toBe(false);
    expect(languageReport.issues.map((issue) => issue.code)).toContain(
      'tutor_context_authority_mismatch',
    );

    const invalidPairIndex = cloneDataset();
    const runtimeWithInvalidIndex = invalidPairIndex.cases.find(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    if (!runtimeWithInvalidIndex || runtimeWithInvalidIndex.expectedRuntimeInvocations !== 1) {
      throw new Error('V2_PAIR_INDEX_MUTATION_CASE_MISSING');
    }
    runtimeWithInvalidIndex.pairedRunIndex = 24;
    const pairIndexReport = validateClone(invalidPairIndex);
    expect(pairIndexReport.ok).toBe(false);
    expect(pairIndexReport.issues.map((issue) => issue.code)).toContain(
      'paired_runtime_index_invalid',
    );

    const duplicateIds = cloneDataset();
    duplicateIds.cases[1]!.id = duplicateIds.cases[0]!.id;
    const duplicateReport = validateClone(duplicateIds);
    expect(duplicateReport.ok).toBe(false);
    expect(duplicateReport.issues.map((issue) => issue.code)).toContain('duplicate_case_id');

    const ordinalAba = cloneDataset();
    const organizer = ordinalAba.organizerCases.find(
      (testCase) => testCase.id === 'organizer-v2-runtime-01',
    );
    if (!organizer || organizer.expectedRuntimeInvocations !== 1) {
      throw new Error('ORGANIZER_V2_MUTATION_CASE_MISSING');
    }
    organizer.authority.decisions[0]!.topicCandidates.reverse();
    const ordinalReport = validateClone(ordinalAba);
    expect(ordinalReport.ok).toBe(false);
    expect(ordinalReport.issues.map((issue) => issue.code)).toContain(
      'organizer_topic_ordinal_mismatch',
    );
  });

  test('deep-freezes synthetic data and rejects credential-shaped material', () => {
    expect(isDeepFrozen(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES)).toBe(true);
    const serialized = JSON.stringify(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES);
    for (const forbidden of [
      /authorization\s*:\s*bearer/i,
      /cookie\s*:/i,
      /(?:sk|ds|AIza)[-_A-Za-z0-9]{16,}/,
      /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    ]) {
      expect(serialized).not.toMatch(forbidden);
    }
  });
});

describe('Phase 6.9.7 V5 R1 frozen policy and deterministic baseline', () => {
  test('freezes thresholds before any V5 candidate or Live result', () => {
    expect(PHASE_6_9_7_V5_EVAL_POLICY_VERSION).toBe('phase-6.9.7-v5-eval-policy-v1');
    expect(PHASE_6_9_7_V5_EVAL_POLICY_SHA256).toBe(PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256);
    expect(PHASE_6_9_7_V5_EVAL_POLICY_SHA256).toBe(
      'b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d',
    );
    expect(PHASE_6_9_7_V5_EVAL_POLICY.quality).toEqual({
      strictRuntimeSuccesses: 48,
      tutorSemanticScoreMin: 0.85,
      organizerSemanticScoreMin: 0.85,
      combinedSemanticScoreMin: 0.85,
      tutorAbsoluteImprovementMin: 0.15,
      organizerAbsoluteImprovementMin: 0.15,
    });
    expect(PHASE_6_9_7_V5_EVAL_POLICY.safety.verifiedZeroCalls).toBe(24);
    expect(PHASE_6_9_7_V5_EVAL_POLICY.safety).toEqual({
      verifiedZeroCalls: 24,
      criticalFailuresMax: 0,
      providerFailuresMax: 0,
      permissionFailuresMax: 0,
      mutationFailuresMax: 0,
      broaderFallbacksMax: 0,
    });
    expect(PHASE_6_9_7_V5_EVAL_POLICY.latencyMs).toEqual({
      tutorP95Max: 2_500,
      organizerP95Max: 4_500,
      pairedP95Max: 4_500,
      orchestrationP95Max: 6_500,
      requiredSamplesPerLane: 24,
    });
    expect(PHASE_6_9_7_V5_EVAL_POLICY.usage).toEqual({
      verifiedRuntimeCases: 48,
      providerInvocationsMax: 48,
      inputTokensMin: 1,
      inputTokensMax: 112_800,
      outputTokensMin: 1,
      outputTokensMax: 26_400,
      estimatedCostCnyExclusiveMin: 0,
      estimatedCostCnyMax: 0.55,
      incompleteAggregateMustBeNull: true,
    });
    expect(PHASE_6_9_7_V5_EVAL_POLICY.denominatorPolicy).toEqual({
      invalidOrMissingOutputRemainsInDenominator: true,
      semanticMismatchDoesNotOpenBreaker: true,
      firstRuntimeContractFailureOpensBreaker: true,
      noRetryResumeReplayOrBackfill: true,
    });
    expect(
      computePhase697V5PolicySha256({
        ...PHASE_6_9_7_V5_EVAL_POLICY,
        quality: {
          ...PHASE_6_9_7_V5_EVAL_POLICY.quality,
          tutorSemanticScoreMin: 0.84,
        },
      }),
    ).not.toBe(PHASE_6_9_7_V5_EVAL_POLICY_SHA256);
  });

  test('freezes a zero-provider deterministic baseline with all failures in the denominator', () => {
    const report = PHASE_6_9_7_V5_DETERMINISTIC_BASELINE;
    expect(PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256).toBe(
      PHASE_6_9_7_V5_FROZEN_DETERMINISTIC_BASELINE_SHA256,
    );
    expect(PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256).toBe(
      '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca',
    );
    expect(runPhase697V2DeterministicBaseline()).toEqual(report);
    expect(isDeepFrozen(report)).toBe(true);
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.summary).toEqual({
      passed: 12,
      failed: 36,
      criticalFailures: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      providerInvocations: 0,
    });
    expect(report.metrics.ok).toBe(true);
    if (!report.metrics.ok) return;
    expect(report.metrics.metrics.tutor.semanticScore).toBeCloseTo(0.6629642857142858, 12);
    expect(report.metrics.metrics.tutor.scoredCases).toBe(24);
    expect(report.metrics.metrics.organizer.semanticScore).toBeCloseTo(0.278125, 12);
    expect(report.metrics.metrics.organizer.scoredDecisions).toBe(32);
    expect(report.metrics.metrics.combinedSemanticScore).toBeCloseTo(0.4705446428571429, 12);
  });
});

type MutableClone = {
  cases: Mutable<Phase697V2Case>[];
  tutorCases: Mutable<Phase697V2TutorCase>[];
  organizerCases: Mutable<Phase697V2OrganizerCase>[];
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[]
    ? Mutable<U>[]
    : T[K] extends object
      ? Mutable<T[K]>
      : T[K];
};

function cloneDataset(): MutableClone {
  const cases = structuredClone(
    PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  ) as Mutable<Phase697V2Case>[];
  return {
    cases,
    tutorCases: cases.filter(
      (testCase) => testCase.agent === 'tutor',
    ) as Mutable<Phase697V2TutorCase>[],
    organizerCases: cases.filter(
      (testCase) => testCase.agent === 'wrong_question_organizer',
    ) as Mutable<Phase697V2OrganizerCase>[],
  };
}

function validateClone(clone: MutableClone) {
  return validatePhase697V2DatasetCoherence({
    version: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    cases: clone.cases as unknown as readonly Phase697V2Case[],
    tutorCases: clone.tutorCases as unknown as readonly Phase697V2TutorCase[],
    organizerCases: clone.organizerCases as unknown as readonly Phase697V2OrganizerCase[],
  });
}

function recursiveKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const child of value) recursiveKeys(child, keys);
    return keys;
  }
  if (typeof value !== 'object' || value === null) return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key);
    recursiveKeys(child, keys);
  }
  return keys;
}

function isDeepFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value !== 'object' || value === null) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => isDeepFrozen(child, seen));
}
