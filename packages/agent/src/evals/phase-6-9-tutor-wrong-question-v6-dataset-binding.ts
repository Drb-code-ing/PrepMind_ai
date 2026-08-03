import { createHash } from 'node:crypto';

import { PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 } from './phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';

export const PHASE_6_9_7_V6_DATASET_BINDING_VERSION = 'phase-6.9.7-v6-dataset-binding-v1' as const;

export const PHASE_6_9_7_V6_SOURCE_DATASET_SHA256 =
  '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b' as const;
export const PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256 =
  '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca' as const;

if (PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256 !== PHASE_6_9_7_V6_SOURCE_DATASET_SHA256) {
  throw new Error('PHASE_6_9_7_V6_SOURCE_DATASET_SHA_MISMATCH');
}
if (PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 !== PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256) {
  throw new Error('PHASE_6_9_7_V6_SOURCE_BASELINE_SHA_MISMATCH');
}

export type Phase697V6SubjectDecision =
  | Readonly<{ action: 'keep_local' }>
  | Readonly<{ action: 'select_subject'; subjectIndex: number }>;

export type Phase697V6TutorModelOwnedExpectation = Readonly<{
  caseId: string;
  pairedRunIndex: number;
  intent: Phase697V2TutorRuntimeCase['expected']['intent'];
}>;

export type Phase697V6OrganizerModelOwnedExpectation = Readonly<{
  decisionId: string;
  caseId: string;
  pairedRunIndex: number;
  questionIndex: number;
  subjectDecision: Phase697V6SubjectDecision;
  deckAction: 'reuse_existing' | 'create_topic';
  targetOrdinal: number;
}>;

export type Phase697V6DatasetBinding = Readonly<{
  version: typeof PHASE_6_9_7_V6_DATASET_BINDING_VERSION;
  source: Readonly<{
    datasetVersion: typeof PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION;
    datasetSha256: typeof PHASE_6_9_7_V6_SOURCE_DATASET_SHA256;
    deterministicBaselineSha256: typeof PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256;
    expectedBytesPolicy: 'reuse_without_modification';
  }>;
  counts: Readonly<{
    cases: 72;
    zeroCallCases: 24;
    runtimeCases: 48;
    pairedRequests: 24;
    tutorRuntimeCases: 24;
    organizerRuntimeCases: 24;
    organizerDecisionUnits: 32;
  }>;
  tutorModelOwnedExpectations: readonly Phase697V6TutorModelOwnedExpectation[];
  organizerModelOwnedExpectations: readonly Phase697V6OrganizerModelOwnedExpectation[];
}>;

export const PHASE_6_9_7_V6_DATASET_BINDING = buildPhase697V6DatasetBinding();
export const PHASE_6_9_7_V6_DATASET_BINDING_SHA256 = computePhase697V6CanonicalSha256(
  PHASE_6_9_7_V6_DATASET_BINDING,
);
export const PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256 =
  '3306cc399730f85b3281c90f226f629873d9755325415b69a0263a0f57b96153' as const;

if (PHASE_6_9_7_V6_DATASET_BINDING_SHA256 !== PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256) {
  throw new Error('PHASE_6_9_7_V6_DATASET_BINDING_SHA_MISMATCH');
}

export function computePhase697V6CanonicalSha256(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function buildPhase697V6DatasetBinding(): Phase697V6DatasetBinding {
  const tutorRuntimeCases = phase697V2TutorCases.filter(
    (testCase): testCase is Phase697V2TutorRuntimeCase => testCase.expectedRuntimeInvocations === 1,
  );
  const organizerRuntimeCases = phase697V2OrganizerCases.filter(
    (testCase): testCase is Phase697V2OrganizerRuntimeCase =>
      testCase.expectedRuntimeInvocations === 1,
  );

  const tutorModelOwnedExpectations = tutorRuntimeCases.map((testCase) => ({
    caseId: testCase.id,
    pairedRunIndex: testCase.pairedRunIndex,
    intent: testCase.expected.intent,
  }));
  const organizerModelOwnedExpectations = organizerRuntimeCases.flatMap((testCase) =>
    testCase.expected.decisions.map((expected) => {
      const question = testCase.input.questions[expected.questionIndex];
      const authority = testCase.authority.decisions.find(
        (entry) => entry.questionIndex === expected.questionIndex,
      );
      if (!question || !authority) {
        throw new Error('PHASE_6_9_7_V6_ORGANIZER_EXPECTATION_AUTHORITY_MISSING');
      }
      const subjectDecision = expectedSubjectDecision(question, authority, expected.subject);
      const targetOrdinal =
        expected.deckAction === 'reuse_existing'
          ? expected.deckIndex
          : expected.topicCandidateIndex;
      if (
        typeof targetOrdinal !== 'number' ||
        !Number.isSafeInteger(targetOrdinal) ||
        targetOrdinal < 0
      ) {
        throw new Error('PHASE_6_9_7_V6_ORGANIZER_TARGET_ORDINAL_INVALID');
      }
      return {
        decisionId: `${testCase.id}:q${expected.questionIndex}`,
        caseId: testCase.id,
        pairedRunIndex: testCase.pairedRunIndex,
        questionIndex: expected.questionIndex,
        subjectDecision,
        deckAction: expected.deckAction,
        targetOrdinal,
      };
    }),
  );

  if (
    tutorRuntimeCases.length !== 24 ||
    organizerRuntimeCases.length !== 24 ||
    tutorModelOwnedExpectations.length !== 24 ||
    organizerModelOwnedExpectations.length !== 32 ||
    new Set(tutorModelOwnedExpectations.map((entry) => entry.caseId)).size !== 24 ||
    new Set(organizerModelOwnedExpectations.map((entry) => entry.decisionId)).size !== 32
  ) {
    throw new Error('PHASE_6_9_7_V6_DATASET_BINDING_COUNT_MISMATCH');
  }

  return deepFreeze({
    version: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    source: {
      datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
      datasetSha256: PHASE_6_9_7_V6_SOURCE_DATASET_SHA256,
      deterministicBaselineSha256: PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256,
      expectedBytesPolicy: 'reuse_without_modification',
    },
    counts: {
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      tutorRuntimeCases: 24,
      organizerRuntimeCases: 24,
      organizerDecisionUnits: 32,
    },
    tutorModelOwnedExpectations,
    organizerModelOwnedExpectations,
  });
}

function expectedSubjectDecision(
  question: Phase697V2OrganizerRuntimeCase['input']['questions'][number],
  authority: Phase697V2OrganizerRuntimeCase['authority']['decisions'][number],
  expectedSubject: Phase697V2OrganizerRuntimeCase['expected']['decisions'][number]['subject'],
): Phase697V6SubjectDecision {
  if (question.structuredSubjectAuthority !== null) {
    if (question.structuredSubjectAuthority !== expectedSubject) {
      throw new Error('PHASE_6_9_7_V6_STRUCTURED_SUBJECT_EXPECTATION_MISMATCH');
    }
    return { action: 'keep_local' };
  }
  const subjectIndex = authority.subjectCandidates.indexOf(expectedSubject);
  if (subjectIndex < 0) {
    throw new Error('PHASE_6_9_7_V6_SUBJECT_ORDINAL_EXPECTATION_MISSING');
  }
  return { action: 'select_subject', subjectIndex };
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
