import type { TutorAnswerSection, TutorDepth } from '../nodes/tutor.ts';
import type {
  OrganizerConfidence,
  OrganizerDeckAction,
  OrganizerEvidenceCode,
  OrganizerSubject,
  TutorModelIntent,
} from './phase-6-9-tutor-wrong-question-cases.ts';

export type TutorRuntimeObservation = Readonly<{
  caseId: string;
  expectedIntent: TutorModelIntent;
  actualIntent: TutorModelIntent | null;
  expectedDepth: TutorDepth;
  actualDepth: TutorDepth | null;
  expectedContextUse: boolean;
  actualContextUse: boolean | null;
  expectedGuidingQuestion: boolean;
  actualGuidingQuestion: boolean | null;
  expectedFinalAnswer: boolean;
  actualFinalAnswer: boolean | null;
  expectedAnswerStructure: readonly TutorAnswerSection[];
  actualAnswerStructure: readonly TutorAnswerSection[];
  validOutput: boolean;
}>;

export type OrganizerDecisionObservation = Readonly<{
  decisionId: string;
  expectedSubject: OrganizerSubject;
  actualSubject: OrganizerSubject | null;
  expectedDeckAction: OrganizerDeckAction;
  actualDeckAction: OrganizerDeckAction | null;
  expectedDeckIndex: number | null;
  actualDeckIndex: number | null;
  canonicalTopicLabel: string;
  acceptedTopicLabels: readonly string[];
  actualTopicLabel: string | null;
  expectedConfidence: OrganizerConfidence;
  actualConfidence: OrganizerConfidence | null;
  requiredEvidenceCodes: readonly OrganizerEvidenceCode[];
  allowedEvidenceCodes: readonly OrganizerEvidenceCode[];
  actualEvidenceCodes: readonly OrganizerEvidenceCode[];
  validOutput: boolean;
}>;

export type TutorSemanticScoreInput = Readonly<{
  intentMacroF1: number;
  depthAccuracy: number;
  contextUseAccuracy: number;
  pedagogyPolicyAccuracy: number;
}>;

export type OrganizerSemanticScoreInput = Readonly<{
  subjectAccuracy: number;
  deckActionAccuracy: number;
  existingDeckPrecision: number;
  topicLabelMacroF1: number;
  evidenceConfidenceAccuracy: number;
}>;

export type TutorWrongQuestionSemanticMetrics = Readonly<{
  tutor: TutorSemanticScoreInput &
    Readonly<{
      semanticScore: number;
      scoredCases: number;
      invalidCases: number;
    }>;
  organizer: OrganizerSemanticScoreInput &
    Readonly<{
      semanticScore: number;
      scoredDecisions: number;
      invalidDecisions: number;
    }>;
  combinedSemanticScore: number;
}>;

export type TutorWrongQuestionMetricsResult =
  | Readonly<{ ok: true; metrics: TutorWrongQuestionSemanticMetrics }>
  | Readonly<{ ok: false; errorCode: 'invalid_metrics' }>;

const TUTOR_INTENTS: readonly TutorModelIntent[] = [
  'explain_solution',
  'socratic_hint',
  'step_check',
  'concept_bridge',
  'general_follow_up',
];
const TUTOR_DEPTHS: readonly TutorDepth[] = ['brief', 'standard', 'deep'];
const ANSWER_SECTIONS: readonly TutorAnswerSection[] = [
  'known_conditions',
  'concept',
  'reasoning_steps',
  'common_mistake',
  'final_answer',
  'guiding_question',
];
const ORGANIZER_SUBJECTS: readonly OrganizerSubject[] = [
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
];
const DECK_ACTIONS: readonly OrganizerDeckAction[] = ['reuse_existing', 'create_topic'];
const CONFIDENCE_LEVELS: readonly OrganizerConfidence[] = ['medium', 'high'];
const EVIDENCE_CODES: readonly OrganizerEvidenceCode[] = [
  'structured_subject',
  'semantic_topic',
  'existing_deck_overlap',
  'error_pattern',
  'insufficient_signal',
];

export function computeTutorSemanticScore(input: TutorSemanticScoreInput): number {
  if (Object.values(input).some((value) => !isUnitInterval(value))) {
    throw new Error('TUTOR_SEMANTIC_METRICS_INVALID');
  }
  return (
    0.55 * input.intentMacroF1 +
    0.2 * input.depthAccuracy +
    0.15 * input.contextUseAccuracy +
    0.1 * input.pedagogyPolicyAccuracy
  );
}

export function computeOrganizerSemanticScore(input: OrganizerSemanticScoreInput): number {
  if (Object.values(input).some((value) => !isUnitInterval(value))) {
    throw new Error('ORGANIZER_SEMANTIC_METRICS_INVALID');
  }
  return (
    0.3 * input.subjectAccuracy +
    0.25 * input.deckActionAccuracy +
    0.2 * input.existingDeckPrecision +
    0.15 * input.topicLabelMacroF1 +
    0.1 * input.evidenceConfidenceAccuracy
  );
}

export function computeCombinedSemanticScore(
  tutorSemanticScore: number,
  organizerSemanticScore: number,
): number {
  if (!isUnitInterval(tutorSemanticScore) || !isUnitInterval(organizerSemanticScore)) {
    throw new Error('COMBINED_SEMANTIC_METRICS_INVALID');
  }
  return 0.5 * tutorSemanticScore + 0.5 * organizerSemanticScore;
}

export function nearestRankP95(values: readonly number[]): number | null {
  if (values.length !== 24 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    return null;
  }
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(0.95 * ordered.length) - 1] ?? null;
}

export function buildTutorWrongQuestionSemanticMetrics(
  tutorObservations: readonly TutorRuntimeObservation[],
  organizerObservations: readonly OrganizerDecisionObservation[],
): TutorWrongQuestionMetricsResult {
  if (
    !validTutorObservations(tutorObservations) ||
    !validOrganizerObservations(organizerObservations)
  ) {
    return { ok: false, errorCode: 'invalid_metrics' };
  }

  const normalizedTutor = tutorObservations.map((observation) =>
    observation.validOutput
      ? observation
      : {
          ...observation,
          actualIntent: null,
          actualDepth: null,
          actualContextUse: null,
          actualGuidingQuestion: null,
          actualFinalAnswer: null,
          actualAnswerStructure: [] as readonly TutorAnswerSection[],
        },
  );
  const normalizedOrganizer = organizerObservations.map((observation) =>
    observation.validOutput
      ? observation
      : {
          ...observation,
          actualSubject: null,
          actualDeckAction: null,
          actualDeckIndex: null,
          actualTopicLabel: null,
          actualConfidence: null,
          actualEvidenceCodes: [] as readonly OrganizerEvidenceCode[],
        },
  );

  const tutorInput: TutorSemanticScoreInput = {
    intentMacroF1: macroTutorIntentF1(normalizedTutor),
    depthAccuracy: ratio(
      normalizedTutor.filter((observation) => observation.actualDepth === observation.expectedDepth)
        .length,
      normalizedTutor.length,
    ),
    contextUseAccuracy: ratio(
      normalizedTutor.filter(
        (observation) => observation.actualContextUse === observation.expectedContextUse,
      ).length,
      normalizedTutor.length,
    ),
    pedagogyPolicyAccuracy: ratio(
      normalizedTutor.filter(tutorPedagogyMatches).length,
      normalizedTutor.length,
    ),
  };
  const organizerInput: OrganizerSemanticScoreInput = {
    subjectAccuracy: ratio(
      normalizedOrganizer.filter(
        (observation) => observation.actualSubject === observation.expectedSubject,
      ).length,
      normalizedOrganizer.length,
    ),
    deckActionAccuracy: ratio(
      normalizedOrganizer.filter(deckActionMatches).length,
      normalizedOrganizer.length,
    ),
    existingDeckPrecision: existingDeckPrecision(normalizedOrganizer),
    topicLabelMacroF1: topicLabelMacroF1(normalizedOrganizer),
    evidenceConfidenceAccuracy: ratio(
      normalizedOrganizer.filter(evidenceConfidenceMatches).length,
      normalizedOrganizer.length,
    ),
  };
  const tutorSemanticScore = computeTutorSemanticScore(tutorInput);
  const organizerSemanticScore = computeOrganizerSemanticScore(organizerInput);

  return {
    ok: true,
    metrics: {
      tutor: {
        ...tutorInput,
        semanticScore: tutorSemanticScore,
        scoredCases: normalizedTutor.length,
        invalidCases: normalizedTutor.filter(
          (observation) => !observation.validOutput || observation.actualIntent === null,
        ).length,
      },
      organizer: {
        ...organizerInput,
        semanticScore: organizerSemanticScore,
        scoredDecisions: normalizedOrganizer.length,
        invalidDecisions: normalizedOrganizer.filter(
          (observation) =>
            !observation.validOutput ||
            observation.actualSubject === null ||
            observation.actualDeckAction === null,
        ).length,
      },
      combinedSemanticScore: computeCombinedSemanticScore(
        tutorSemanticScore,
        organizerSemanticScore,
      ),
    },
  };
}

function macroTutorIntentF1(observations: readonly TutorRuntimeObservation[]) {
  return (
    TUTOR_INTENTS.reduce((total, intent) => {
      const truePositive = observations.filter(
        (item) => item.expectedIntent === intent && item.actualIntent === intent,
      ).length;
      const falsePositive = observations.filter(
        (item) => item.expectedIntent !== intent && item.actualIntent === intent,
      ).length;
      const falseNegative = observations.filter(
        (item) => item.expectedIntent === intent && item.actualIntent !== intent,
      ).length;
      return total + f1(truePositive, falsePositive, falseNegative);
    }, 0) / TUTOR_INTENTS.length
  );
}

function tutorPedagogyMatches(observation: TutorRuntimeObservation) {
  return (
    observation.actualGuidingQuestion === observation.expectedGuidingQuestion &&
    observation.actualFinalAnswer === observation.expectedFinalAnswer &&
    sameOrderedValues(observation.actualAnswerStructure, observation.expectedAnswerStructure)
  );
}

function deckActionMatches(observation: OrganizerDecisionObservation) {
  if (observation.actualDeckAction !== observation.expectedDeckAction) return false;
  if (observation.expectedDeckAction === 'reuse_existing') {
    return observation.actualDeckIndex === observation.expectedDeckIndex;
  }
  return true;
}

function existingDeckPrecision(observations: readonly OrganizerDecisionObservation[]) {
  const predictions = observations.filter(
    (observation) => observation.actualDeckAction === 'reuse_existing',
  );
  if (predictions.length === 0) return 0;
  return ratio(
    predictions.filter(
      (observation) =>
        observation.expectedDeckAction === 'reuse_existing' &&
        observation.actualDeckIndex === observation.expectedDeckIndex,
    ).length,
    predictions.length,
  );
}

function topicLabelMacroF1(observations: readonly OrganizerDecisionObservation[]) {
  const createTopic = observations.filter(
    (observation) => observation.expectedDeckAction === 'create_topic',
  );
  const expectedLabels = [
    ...new Set(createTopic.map((observation) => normalizeLabel(observation.canonicalTopicLabel))),
  ];
  if (expectedLabels.length === 0) return 0;
  const mapped = createTopic.map((observation) => ({
    expected: normalizeLabel(observation.canonicalTopicLabel),
    actual: mapAcceptedLabel(observation),
  }));
  return (
    expectedLabels.reduce((total, label) => {
      const truePositive = mapped.filter(
        (item) => item.expected === label && item.actual === label,
      ).length;
      const falsePositive = mapped.filter(
        (item) => item.expected !== label && item.actual === label,
      ).length;
      const falseNegative = mapped.filter(
        (item) => item.expected === label && item.actual !== label,
      ).length;
      return total + f1(truePositive, falsePositive, falseNegative);
    }, 0) / expectedLabels.length
  );
}

function mapAcceptedLabel(observation: OrganizerDecisionObservation) {
  if (!observation.validOutput || observation.actualTopicLabel === null) return null;
  const actual = normalizeLabel(observation.actualTopicLabel);
  const accepted = new Set(observation.acceptedTopicLabels.map(normalizeLabel));
  return accepted.has(actual) ? normalizeLabel(observation.canonicalTopicLabel) : actual;
}

function evidenceConfidenceMatches(observation: OrganizerDecisionObservation) {
  if (observation.actualConfidence !== observation.expectedConfidence) return false;
  const actual = new Set(observation.actualEvidenceCodes);
  const allowed = new Set(observation.allowedEvidenceCodes);
  return (
    observation.requiredEvidenceCodes.every((code) => actual.has(code)) &&
    observation.actualEvidenceCodes.every((code) => allowed.has(code))
  );
}

function validTutorObservations(observations: readonly TutorRuntimeObservation[]) {
  return (
    hasValidUniqueIds(observations, 'caseId') &&
    observations.every(
      (observation) =>
        TUTOR_INTENTS.includes(observation.expectedIntent) &&
        (observation.actualIntent === null || TUTOR_INTENTS.includes(observation.actualIntent)) &&
        TUTOR_DEPTHS.includes(observation.expectedDepth) &&
        (observation.actualDepth === null || TUTOR_DEPTHS.includes(observation.actualDepth)) &&
        typeof observation.expectedContextUse === 'boolean' &&
        (observation.actualContextUse === null ||
          typeof observation.actualContextUse === 'boolean') &&
        typeof observation.expectedGuidingQuestion === 'boolean' &&
        (observation.actualGuidingQuestion === null ||
          typeof observation.actualGuidingQuestion === 'boolean') &&
        typeof observation.expectedFinalAnswer === 'boolean' &&
        (observation.actualFinalAnswer === null ||
          typeof observation.actualFinalAnswer === 'boolean') &&
        validAnswerStructure(observation.expectedAnswerStructure) &&
        validAnswerStructure(observation.actualAnswerStructure) &&
        typeof observation.validOutput === 'boolean',
    )
  );
}

function validOrganizerObservations(observations: readonly OrganizerDecisionObservation[]) {
  return (
    hasValidUniqueIds(observations, 'decisionId') &&
    observations.every(
      (observation) =>
        ORGANIZER_SUBJECTS.includes(observation.expectedSubject) &&
        (observation.actualSubject === null ||
          ORGANIZER_SUBJECTS.includes(observation.actualSubject)) &&
        DECK_ACTIONS.includes(observation.expectedDeckAction) &&
        (observation.actualDeckAction === null ||
          DECK_ACTIONS.includes(observation.actualDeckAction)) &&
        validDeckIndex(observation.expectedDeckIndex) &&
        validDeckIndex(observation.actualDeckIndex) &&
        validLabel(observation.canonicalTopicLabel) &&
        validLabels(observation.acceptedTopicLabels) &&
        (observation.actualTopicLabel === null || validLabel(observation.actualTopicLabel)) &&
        CONFIDENCE_LEVELS.includes(observation.expectedConfidence) &&
        (observation.actualConfidence === null ||
          CONFIDENCE_LEVELS.includes(observation.actualConfidence)) &&
        validEvidenceCodes(observation.requiredEvidenceCodes) &&
        validEvidenceCodes(observation.allowedEvidenceCodes) &&
        validEvidenceCodes(observation.actualEvidenceCodes) &&
        observation.requiredEvidenceCodes.every((code) =>
          observation.allowedEvidenceCodes.includes(code),
        ) &&
        typeof observation.validOutput === 'boolean',
    )
  );
}

function hasValidUniqueIds<T extends Record<K, string>, K extends keyof T>(
  observations: readonly T[],
  key: K,
) {
  if (observations.length === 0) return false;
  const ids = observations.map((observation) => observation[key]);
  return ids.every((id) => /^[A-Za-z0-9_:-]{1,100}$/.test(id)) && new Set(ids).size === ids.length;
}

function validAnswerStructure(values: unknown) {
  return (
    Array.isArray(values) &&
    values.length <= ANSWER_SECTIONS.length &&
    values.every((value: unknown) => isTutorAnswerSection(value)) &&
    new Set(values).size === values.length
  );
}

function validDeckIndex(value: number | null) {
  return value === null || (Number.isSafeInteger(value) && value >= 0 && value <= 19);
}

function validEvidenceCodes(values: unknown) {
  return (
    Array.isArray(values) &&
    values.every((value: unknown) => isOrganizerEvidenceCode(value)) &&
    new Set(values).size === values.length
  );
}

function isTutorAnswerSection(value: unknown): value is TutorAnswerSection {
  return typeof value === 'string' && (ANSWER_SECTIONS as readonly string[]).includes(value);
}

function isOrganizerEvidenceCode(value: unknown): value is OrganizerEvidenceCode {
  return typeof value === 'string' && (EVIDENCE_CODES as readonly string[]).includes(value);
}

function validLabels(values: readonly string[]) {
  return (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every(validLabel) &&
    new Set(values.map(normalizeLabel)).size === values.length
  );
}

function validLabel(value: string) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
}

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function f1(truePositive: number, falsePositive: number, falseNegative: number) {
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isUnitInterval(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}
