import type {
  KnowledgeOrganizerSubject,
  KnowledgeSemanticRelation,
} from './phase-6-9-knowledge-agent-cases.ts';

export type KnowledgeDedupRuntimeObservation = Readonly<{
  caseId: string;
  expectedRelation: KnowledgeSemanticRelation;
  actualRelation: KnowledgeSemanticRelation | null;
  revisionExpected: boolean;
  validOutput: boolean;
}>;

export type KnowledgeOrganizerRuntimeObservation = Readonly<{
  caseId: string;
  expectedSubject: KnowledgeOrganizerSubject;
  actualSubject: KnowledgeOrganizerSubject | null;
  expectedTopicLabels: readonly string[];
  actualTopicLabels: readonly string[];
  expectedCollectionPairs: readonly (readonly [string, string])[];
  actualCollectionPairs: readonly (readonly [string, string])[];
  validOutput: boolean;
}>;

export type KnowledgeSemanticScoreInput = Readonly<{
  dedupSemanticMacroF1: number;
  revisionRecall: number;
  organizerSubjectTop1: number;
  organizerTagMicroF1: number;
  organizerCollectionPairwiseF1: number;
}>;

export type KnowledgeAgentSemanticMetrics = KnowledgeSemanticScoreInput &
  Readonly<{
    unrelatedFalsePositiveRate: number;
    semanticScore: number;
    scoredRuntimeCases: number;
    invalidRuntimeCases: number;
  }>;

export type KnowledgeAgentMetricsResult =
  | Readonly<{ ok: true; metrics: KnowledgeAgentSemanticMetrics }>
  | Readonly<{ ok: false; errorCode: 'invalid_metrics' }>;

const RELATIONS: readonly KnowledgeSemanticRelation[] = [
  'semantic_duplicate',
  'possible_revision',
  'complementary',
  'unrelated',
];
const SUBJECTS: readonly KnowledgeOrganizerSubject[] = [
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
];

export function computeKnowledgeSemanticScore(
  input: KnowledgeSemanticScoreInput,
): number {
  const values = Object.values(input);
  if (values.some((value) => !isUnitInterval(value))) {
    throw new Error('KNOWLEDGE_SEMANTIC_METRICS_INVALID');
  }
  return (
    0.35 * input.dedupSemanticMacroF1 +
    0.15 * input.revisionRecall +
    0.2 * input.organizerSubjectTop1 +
    0.15 * input.organizerTagMicroF1 +
    0.15 * input.organizerCollectionPairwiseF1
  );
}

export function nearestRankP95(values: readonly number[]): number | null {
  if (
    values.length !== 24 ||
    values.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    return null;
  }
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(0.95 * ordered.length) - 1] ?? null;
}

export function buildKnowledgeAgentSemanticMetrics(
  dedupObservations: readonly KnowledgeDedupRuntimeObservation[],
  organizerObservations: readonly KnowledgeOrganizerRuntimeObservation[],
): KnowledgeAgentMetricsResult {
  if (
    !validDedupObservations(dedupObservations) ||
    !validOrganizerObservations(organizerObservations)
  ) {
    return { ok: false, errorCode: 'invalid_metrics' };
  }

  const normalizedDedup = dedupObservations.map((observation) => ({
    ...observation,
    actualRelation:
      observation.validOutput && observation.actualRelation !== null
        ? observation.actualRelation
        : null,
  }));
  const normalizedOrganizer = organizerObservations.map((observation) => ({
    ...observation,
    actualSubject:
      observation.validOutput && observation.actualSubject !== null
        ? observation.actualSubject
        : null,
    actualTopicLabels: observation.validOutput
      ? observation.actualTopicLabels
      : ([] as readonly string[]),
    actualCollectionPairs: observation.validOutput
      ? observation.actualCollectionPairs
      : ([] as readonly (readonly [string, string])[]),
  }));

  const revisionCases = normalizedDedup.filter(
    (observation) => observation.revisionExpected,
  );
  const unrelatedCases = normalizedDedup.filter(
    (observation) => observation.expectedRelation === 'unrelated',
  );
  const scoreInput: KnowledgeSemanticScoreInput = {
    dedupSemanticMacroF1: macroRelationF1(normalizedDedup),
    revisionRecall: ratio(
      revisionCases.filter(
        (observation) => observation.actualRelation === 'possible_revision',
      ).length,
      revisionCases.length,
    ),
    organizerSubjectTop1: ratio(
      normalizedOrganizer.filter(
        (observation) =>
          observation.actualSubject === observation.expectedSubject,
      ).length,
      normalizedOrganizer.length,
    ),
    organizerTagMicroF1: setMicroF1(
      normalizedOrganizer.flatMap((observation) =>
        observation.expectedTopicLabels.map(
          (label) => `${observation.caseId}:${normalizeLabel(label)}`,
        ),
      ),
      normalizedOrganizer.flatMap((observation) =>
        observation.actualTopicLabels.map(
          (label) => `${observation.caseId}:${normalizeLabel(label)}`,
        ),
      ),
    ),
    organizerCollectionPairwiseF1: setMicroF1(
      normalizedOrganizer.flatMap((observation) =>
        observation.expectedCollectionPairs.map(
          (pair) => `${observation.caseId}:${canonicalPair(pair)}`,
        ),
      ),
      normalizedOrganizer.flatMap((observation) =>
        observation.actualCollectionPairs.map(
          (pair) => `${observation.caseId}:${canonicalPair(pair)}`,
        ),
      ),
    ),
  };

  return {
    ok: true,
    metrics: {
      ...scoreInput,
      unrelatedFalsePositiveRate: ratio(
        unrelatedCases.filter(
          (observation) =>
            observation.actualRelation !== null &&
            observation.actualRelation !== 'unrelated',
        ).length,
        unrelatedCases.length,
      ),
      semanticScore: computeKnowledgeSemanticScore(scoreInput),
      scoredRuntimeCases:
        normalizedDedup.length + normalizedOrganizer.length,
      invalidRuntimeCases:
        normalizedDedup.filter(
          (observation) =>
            !observation.validOutput || observation.actualRelation === null,
        ).length +
        normalizedOrganizer.filter(
          (observation) =>
            !observation.validOutput || observation.actualSubject === null,
        ).length,
    },
  };
}

function macroRelationF1(
  observations: readonly (KnowledgeDedupRuntimeObservation & {
    actualRelation: KnowledgeSemanticRelation | null;
  })[],
) {
  return (
    RELATIONS.reduce((total, relation) => {
      const truePositive = observations.filter(
        (item) =>
          item.expectedRelation === relation && item.actualRelation === relation,
      ).length;
      const falsePositive = observations.filter(
        (item) =>
          item.expectedRelation !== relation && item.actualRelation === relation,
      ).length;
      const falseNegative = observations.filter(
        (item) =>
          item.expectedRelation === relation && item.actualRelation !== relation,
      ).length;
      return total + f1(truePositive, falsePositive, falseNegative);
    }, 0) / RELATIONS.length
  );
}

function setMicroF1(expectedValues: readonly string[], actualValues: readonly string[]) {
  const expected = new Set(expectedValues);
  const actual = new Set(actualValues);
  const truePositive = [...actual].filter((value) => expected.has(value)).length;
  const falsePositive = [...actual].filter((value) => !expected.has(value)).length;
  const falseNegative = [...expected].filter((value) => !actual.has(value)).length;
  if (expected.size === 0 && actual.size === 0) return 1;
  return f1(truePositive, falsePositive, falseNegative);
}

function f1(truePositive: number, falsePositive: number, falseNegative: number) {
  const precision = ratio(truePositive, truePositive + falsePositive);
  const recall = ratio(truePositive, truePositive + falseNegative);
  return precision + recall === 0
    ? 0
    : (2 * precision * recall) / (precision + recall);
}

function validDedupObservations(
  observations: readonly KnowledgeDedupRuntimeObservation[],
) {
  return (
    hasValidUniqueIds(observations) &&
    observations.every(
      (observation) =>
        RELATIONS.includes(observation.expectedRelation) &&
        (observation.actualRelation === null ||
          RELATIONS.includes(observation.actualRelation)) &&
        typeof observation.revisionExpected === 'boolean' &&
        typeof observation.validOutput === 'boolean',
    )
  );
}

function validOrganizerObservations(
  observations: readonly KnowledgeOrganizerRuntimeObservation[],
) {
  return (
    hasValidUniqueIds(observations) &&
    observations.every(
      (observation) =>
        SUBJECTS.includes(observation.expectedSubject) &&
        (observation.actualSubject === null ||
          SUBJECTS.includes(observation.actualSubject)) &&
        validLabels(observation.expectedTopicLabels) &&
        validLabels(observation.actualTopicLabels) &&
        validPairs(observation.expectedCollectionPairs) &&
        validPairs(observation.actualCollectionPairs) &&
        typeof observation.validOutput === 'boolean',
    )
  );
}

function hasValidUniqueIds(observations: readonly { caseId: string }[]) {
  if (observations.length === 0) return false;
  const ids = observations.map((observation) => observation.caseId);
  return (
    ids.every((id) => /^[A-Za-z0-9_:-]{1,80}$/.test(id)) &&
    new Set(ids).size === ids.length
  );
}

function validLabels(values: readonly string[]) {
  return (
    Array.isArray(values) &&
    values.every(
      (value) =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= 40,
    )
  );
}

function validPairs(values: unknown) {
  if (!Array.isArray(values)) return false;
  return values.every((pair: unknown) => {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    const left: unknown = pair[0];
    const right: unknown = pair[1];
    return (
      typeof left === 'string' &&
      typeof right === 'string' &&
      left.length > 0 &&
      right.length > 0 &&
      left !== right
    );
  });
}

function canonicalPair(pair: readonly [string, string]) {
  return [...pair].sort().join('|');
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function isUnitInterval(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}
