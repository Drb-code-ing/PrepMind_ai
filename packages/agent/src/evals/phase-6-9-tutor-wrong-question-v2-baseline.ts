import { createHash } from 'node:crypto';

import { buildTutorStrategy } from '../nodes/tutor.ts';
import { organizeWrongQuestion } from '../nodes/wrong-question-organizer.ts';
import type {
  OrganizerConfidence,
  OrganizerDeckAction,
  OrganizerEvidenceCode,
  OrganizerExpectedDecision,
  OrganizerSubject,
  TutorModelIntent,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerExpectedDecision,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v5-policy.ts';
import {
  buildTutorWrongQuestionSemanticMetrics,
  type OrganizerDecisionObservation,
  type TutorRuntimeObservation,
  type TutorWrongQuestionMetricsResult,
} from './phase-6-9-tutor-wrong-question-metrics.ts';

export type Phase697V2DeterministicBaselineRun = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  passed: boolean;
  criticalFailure: boolean;
  expectedCode: string;
  actualCode: string;
}>;

export type Phase697V2DeterministicBaselineReport = Readonly<{
  datasetVersion: typeof PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION;
  datasetSha256: string;
  evalPolicyVersion: typeof PHASE_6_9_7_V5_EVAL_POLICY_VERSION;
  evalPolicySha256: string;
  mode: 'deterministic';
  counts: Readonly<{
    cases: number;
    zeroCallCases: number;
    runtimeCases: number;
    pairedRequests: number;
    organizerDecisionUnits: number;
  }>;
  runs: readonly Phase697V2DeterministicBaselineRun[];
  summary: Readonly<{
    passed: number;
    failed: number;
    criticalFailures: number;
    inputTokens: 0;
    outputTokens: 0;
    estimatedCostCny: 0;
    providerInvocations: 0;
  }>;
  metrics: TutorWrongQuestionMetricsResult;
}>;

export const PHASE_6_9_7_V5_DETERMINISTIC_BASELINE = runPhase697V2DeterministicBaseline();

export const PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 = computePhase697V5BaselineSha256(
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE,
);

export const PHASE_6_9_7_V5_FROZEN_DETERMINISTIC_BASELINE_SHA256 =
  '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca' as const;

if (
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 !==
  PHASE_6_9_7_V5_FROZEN_DETERMINISTIC_BASELINE_SHA256
) {
  throw new Error('PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA_MISMATCH');
}

export function runPhase697V2DeterministicBaseline(): Phase697V2DeterministicBaselineReport {
  const tutorResults = phase697V2TutorCases
    .filter(
      (testCase): testCase is Phase697V2TutorRuntimeCase =>
        testCase.expectedRuntimeInvocations === 1,
    )
    .map(runPhase697V2DeterministicTutorCase);
  const organizerResults = phase697V2OrganizerCases
    .filter(
      (testCase): testCase is Phase697V2OrganizerRuntimeCase =>
        testCase.expectedRuntimeInvocations === 1,
    )
    .map(runPhase697V2DeterministicOrganizerCase);
  const runs = deepFreeze([
    ...tutorResults.map((result) => result.run),
    ...organizerResults.map((result) => result.run),
  ]);
  const runtimeCases = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.filter(
    (testCase) => testCase.expectedRuntimeInvocations === 1,
  );
  const organizerObservations = organizerResults.flatMap((result) => result.observations);

  return deepFreeze({
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicyVersion: PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
    evalPolicySha256: PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
    mode: 'deterministic',
    counts: {
      cases: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.length,
      zeroCallCases: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.length - runtimeCases.length,
      runtimeCases: runtimeCases.length,
      pairedRequests: new Set(runtimeCases.map((testCase) => testCase.pairedRunIndex)).size,
      organizerDecisionUnits: organizerObservations.length,
    },
    runs,
    summary: {
      passed: runs.filter((run) => run.passed).length,
      failed: runs.filter((run) => !run.passed).length,
      criticalFailures: runs.filter((run) => run.criticalFailure).length,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostCny: 0,
      providerInvocations: 0,
    },
    metrics: buildTutorWrongQuestionSemanticMetrics(
      tutorResults.map((result) => result.observation),
      organizerObservations,
    ),
  });
}

export function computePhase697V5BaselineSha256(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

export function runPhase697V2DeterministicTutorCase(
  testCase: Phase697V2TutorRuntimeCase,
): Readonly<{
  run: Phase697V2DeterministicBaselineRun;
  observation: TutorRuntimeObservation;
}> {
  try {
    const strategy = buildTutorStrategy({
      latestUserText: testCase.input.latestUserText,
      activeStudyContext: testCase.input.activeStudyContext,
    });
    const actualIntent = asTutorModelIntent(strategy.intent);
    const observation: TutorRuntimeObservation = {
      caseId: testCase.id,
      expectedIntent: testCase.expected.intent,
      actualIntent,
      expectedDepth: testCase.expected.depth,
      actualDepth: strategy.depth,
      expectedContextUse: testCase.expected.contextUse,
      actualContextUse: strategy.shouldUseActiveStudyContext,
      expectedGuidingQuestion: testCase.expected.guidingQuestion,
      actualGuidingQuestion: strategy.shouldAskGuidingQuestion,
      expectedFinalAnswer: testCase.expected.finalAnswer,
      actualFinalAnswer: strategy.shouldGiveFinalAnswer,
      expectedAnswerStructure: testCase.expected.answerStructure,
      actualAnswerStructure: strategy.answerStructure,
      validOutput: actualIntent !== null,
    };
    const passed = tutorObservationMatches(observation);
    const criticalFailure =
      testCase.criticalSafetyCase &&
      (strategy.shouldGiveFinalAnswer || strategy.answerStructure.includes('final_answer'));
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'tutor',
        passed,
        criticalFailure,
        expectedCode: testCase.expected.intent + '/' + testCase.expected.depth,
        actualCode: strategy.intent + '/' + strategy.depth,
      },
      observation,
    });
  } catch {
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'tutor',
        passed: false,
        criticalFailure: testCase.criticalSafetyCase,
        expectedCode: testCase.expected.intent + '/' + testCase.expected.depth,
        actualCode: 'deterministic_error',
      },
      observation: {
        caseId: testCase.id,
        expectedIntent: testCase.expected.intent,
        actualIntent: null,
        expectedDepth: testCase.expected.depth,
        actualDepth: null,
        expectedContextUse: testCase.expected.contextUse,
        actualContextUse: null,
        expectedGuidingQuestion: testCase.expected.guidingQuestion,
        actualGuidingQuestion: null,
        expectedFinalAnswer: testCase.expected.finalAnswer,
        actualFinalAnswer: null,
        expectedAnswerStructure: testCase.expected.answerStructure,
        actualAnswerStructure: [],
        validOutput: false,
      },
    });
  }
}

export function runPhase697V2DeterministicOrganizerCase(
  testCase: Phase697V2OrganizerRuntimeCase,
): Readonly<{
  run: Phase697V2DeterministicBaselineRun;
  observations: readonly OrganizerDecisionObservation[];
}> {
  try {
    const observations = testCase.input.questions.map((question, questionIndex) => {
      const expected = testCase.expected.decisions.find(
        (decision) => decision.questionIndex === questionIndex,
      );
      if (!expected) throw new Error('ORGANIZER_V2_BASELINE_EXPECTED_DECISION_MISSING');
      const result = organizeWrongQuestion({
        wrongQuestion: question,
        existingDecks: testCase.input.existingDecks,
      });
      return organizerObservation(testCase, expected, questionIndex, result);
    });
    const passed = observations.every(organizerObservationMatches);
    const criticalFailure = organizerCriticalFailure(testCase, observations);
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'wrong_question_organizer',
        passed,
        criticalFailure,
        expectedCode: testCase.expected.decisions
          .map((decision) => decision.subject + ':' + decision.deckAction)
          .join('|'),
        actualCode: observations
          .map(
            (observation) =>
              (observation.actualSubject ?? 'none') +
              ':' +
              (observation.actualDeckAction ?? 'none'),
          )
          .join('|'),
      },
      observations,
    });
  } catch {
    const observations = testCase.expected.decisions.map((expected) =>
      invalidOrganizerObservation(testCase.id, expected),
    );
    return deepFreeze({
      run: {
        caseId: testCase.id,
        agent: 'wrong_question_organizer',
        passed: false,
        criticalFailure: testCase.criticalSafetyCase,
        expectedCode: testCase.expected.decisions
          .map((decision) => decision.subject + ':' + decision.deckAction)
          .join('|'),
        actualCode: 'deterministic_error',
      },
      observations,
    });
  }
}

function organizerObservation(
  testCase: Phase697V2OrganizerRuntimeCase,
  expected: Phase697V2OrganizerExpectedDecision,
  questionIndex: number,
  result: ReturnType<typeof organizeWrongQuestion>,
): OrganizerDecisionObservation {
  const actualSubject = inferSubject(result.subjectKey);
  const actualDeckIndex = result.matchedDeckId
    ? testCase.input.existingDecks.findIndex((deck) => deck.id === result.matchedDeckId)
    : null;
  const actualDeckAction: OrganizerDeckAction =
    actualDeckIndex !== null && actualDeckIndex >= 0 ? 'reuse_existing' : 'create_topic';
  return deepFreeze({
    decisionId: testCase.id + ':q' + questionIndex,
    expectedSubject: expected.subject,
    actualSubject,
    expectedDeckAction: expected.deckAction,
    actualDeckAction,
    expectedDeckIndex: expected.deckIndex ?? null,
    actualDeckIndex: actualDeckIndex !== null && actualDeckIndex >= 0 ? actualDeckIndex : null,
    canonicalTopicLabel: expected.canonicalTopicLabel,
    acceptedTopicLabels: expected.acceptedTopicLabels,
    actualTopicLabel: result.deckName,
    expectedConfidence: expected.confidence,
    actualConfidence: inferConfidence(result.confidence),
    requiredEvidenceCodes: expected.requiredEvidenceCodes,
    allowedEvidenceCodes: expected.allowedEvidenceCodes,
    actualEvidenceCodes: inferEvidenceCodes(
      testCase.input.questions[questionIndex],
      result.signals,
    ),
    validOutput: true,
  });
}

function invalidOrganizerObservation(
  caseId: string,
  expected: OrganizerExpectedDecision,
): OrganizerDecisionObservation {
  return deepFreeze({
    decisionId: caseId + ':q' + expected.questionIndex,
    expectedSubject: expected.subject,
    actualSubject: null,
    expectedDeckAction: expected.deckAction,
    actualDeckAction: null,
    expectedDeckIndex: expected.deckIndex ?? null,
    actualDeckIndex: null,
    canonicalTopicLabel: expected.canonicalTopicLabel,
    acceptedTopicLabels: expected.acceptedTopicLabels,
    actualTopicLabel: null,
    expectedConfidence: expected.confidence,
    actualConfidence: null,
    requiredEvidenceCodes: expected.requiredEvidenceCodes,
    allowedEvidenceCodes: expected.allowedEvidenceCodes,
    actualEvidenceCodes: [],
    validOutput: false,
  });
}

function tutorObservationMatches(observation: TutorRuntimeObservation) {
  return (
    observation.validOutput &&
    observation.actualIntent === observation.expectedIntent &&
    observation.actualDepth === observation.expectedDepth &&
    observation.actualContextUse === observation.expectedContextUse &&
    observation.actualGuidingQuestion === observation.expectedGuidingQuestion &&
    observation.actualFinalAnswer === observation.expectedFinalAnswer &&
    sameOrderedValues(observation.actualAnswerStructure, observation.expectedAnswerStructure)
  );
}

function organizerObservationMatches(observation: OrganizerDecisionObservation) {
  return (
    observation.validOutput &&
    observation.actualSubject === observation.expectedSubject &&
    observation.actualDeckAction === observation.expectedDeckAction &&
    (observation.expectedDeckAction !== 'reuse_existing' ||
      observation.actualDeckIndex === observation.expectedDeckIndex) &&
    acceptedTopicLabel(observation) &&
    observation.actualConfidence === observation.expectedConfidence &&
    evidenceMatches(observation)
  );
}

function organizerCriticalFailure(
  testCase: Phase697V2OrganizerRuntimeCase,
  observations: readonly OrganizerDecisionObservation[],
) {
  if (!testCase.criticalSafetyCase) return false;
  if (testCase.tags.includes('critical_no_write_command')) return false;
  if (!testCase.tags.includes('critical_locked_name')) return false;
  return observations.some((observation, index) => {
    if (observation.actualDeckIndex === null) return false;
    const deck = testCase.input.existingDecks[observation.actualDeckIndex];
    const question = testCase.input.questions[index];
    if (!deck?.nameLocked || !question) return false;
    const result = organizeWrongQuestion({
      wrongQuestion: question,
      existingDecks: testCase.input.existingDecks,
    });
    return result.matchedDeckId === deck.id && result.deckName !== deck.name;
  });
}

function acceptedTopicLabel(observation: OrganizerDecisionObservation) {
  if (observation.actualTopicLabel === null) return false;
  const actual = normalizeLabel(observation.actualTopicLabel);
  return observation.acceptedTopicLabels.map(normalizeLabel).includes(actual);
}

function evidenceMatches(observation: OrganizerDecisionObservation) {
  const actual = new Set(observation.actualEvidenceCodes);
  const allowed = new Set(observation.allowedEvidenceCodes);
  return (
    observation.requiredEvidenceCodes.every((code) => actual.has(code)) &&
    observation.actualEvidenceCodes.every((code) => allowed.has(code))
  );
}

function inferSubject(value: string): OrganizerSubject {
  const normalized = normalizeLabel(value).replace(/\s+/g, '');
  const mapping: Readonly<Record<string, OrganizerSubject>> = {
    math: 'math',
    数学: 'math',
    english: 'english',
    英语: 'english',
    politics: 'politics',
    政治: 'politics',
    computer: 'computer',
    计算机: 'computer',
    major: 'major',
    专业课: 'major',
    other: 'other',
    其他: 'other',
    其它: 'other',
  };
  return mapping[normalized] ?? 'other';
}

function inferConfidence(value: number): OrganizerConfidence {
  return value >= 0.8 ? 'high' : 'medium';
}

function inferEvidenceCodes(
  question: Phase697V2OrganizerRuntimeCase['input']['questions'][number],
  signals: readonly string[],
) {
  const evidence: OrganizerEvidenceCode[] = [];
  if (question.subject?.trim()) evidence.push('structured_subject');
  if (signals.includes('existingDeck')) evidence.push('existing_deck_overlap');
  if (signals.includes('errorType')) evidence.push('error_pattern');
  if (signals.includes('fallback')) evidence.push('insufficient_signal');
  return deepFreeze([...new Set(evidence)]);
}

function asTutorModelIntent(value: string): TutorModelIntent | null {
  if (
    value === 'explain_solution' ||
    value === 'socratic_hint' ||
    value === 'step_check' ||
    value === 'concept_bridge' ||
    value === 'general_follow_up'
  ) {
    return value;
  }
  return null;
}

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
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
