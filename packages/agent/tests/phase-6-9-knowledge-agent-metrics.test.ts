import { describe, expect, it } from 'bun:test';

import {
  buildKnowledgeAgentSemanticMetrics,
  computeKnowledgeSemanticScore,
  nearestRankP95,
  type KnowledgeDedupRuntimeObservation,
  type KnowledgeOrganizerRuntimeObservation,
} from '../src/evals/phase-6-9-knowledge-agent-metrics.ts';

describe('Phase 6.9.6 Knowledge Agent metrics', () => {
  it('uses the frozen weighted semantic score formula', () => {
    expect(
      computeKnowledgeSemanticScore({
        dedupSemanticMacroF1: 0.8,
        revisionRecall: 0.9,
        organizerSubjectTop1: 0.9,
        organizerTagMicroF1: 0.8,
        organizerCollectionPairwiseF1: 0.7,
      }),
    ).toBeCloseTo(0.82, 10);
  });

  it('uses nearest-rank P95 over exactly 24 finite nonnegative values', () => {
    expect(nearestRankP95(Array.from({ length: 24 }, (_, index) => index + 1))).toBe(
      23,
    );
    expect(nearestRankP95([1, 2, 3])).toBeNull();
    expect(nearestRankP95([...Array.from({ length: 23 }, () => 1), -1])).toBeNull();
  });

  it('scores perfect relation, subject, tag, and collection predictions as one', () => {
    const result = buildKnowledgeAgentSemanticMetrics(
      relationLabels.map((relation, index) => dedupObservation(index, relation, relation)),
      subjectLabels.map((subject, index) =>
        organizerObservation(index, subject, subject, [`topic-${index}`], [`topic-${index}`]),
      ),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics).toMatchObject({
      dedupSemanticMacroF1: 1,
      revisionRecall: 1,
      unrelatedFalsePositiveRate: 0,
      organizerSubjectTop1: 1,
      organizerTagMicroF1: 1,
      organizerCollectionPairwiseF1: 1,
      semanticScore: 1,
      invalidRuntimeCases: 0,
    });
  });

  it('keeps invalid attempted predictions in every applicable denominator', () => {
    const dedup: KnowledgeDedupRuntimeObservation[] = [
      dedupObservation(0, 'possible_revision', null, false),
      dedupObservation(1, 'unrelated', null, false),
    ];
    const organizer: KnowledgeOrganizerRuntimeObservation[] = [
      organizerObservation(0, 'math', null, ['极限'], [], false),
      organizerObservation(1, 'english', 'english', ['阅读'], ['阅读']),
    ];
    const result = buildKnowledgeAgentSemanticMetrics(dedup, organizer);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics.scoredRuntimeCases).toBe(4);
    expect(result.metrics.invalidRuntimeCases).toBe(3);
    expect(result.metrics.revisionRecall).toBe(0);
    expect(result.metrics.organizerSubjectTop1).toBe(0.5);
    expect(result.metrics.organizerTagMicroF1).toBeCloseTo(2 / 3, 10);
    expect(result.metrics.organizerCollectionPairwiseF1).toBeCloseTo(2 / 3, 10);
  });

  it('rejects empty, duplicate, malformed, or non-finite observations', () => {
    expect(buildKnowledgeAgentSemanticMetrics([], []).ok).toBe(false);
    const duplicate = dedupObservation(0, 'unrelated', 'unrelated');
    expect(buildKnowledgeAgentSemanticMetrics([duplicate, duplicate], [
      organizerObservation(0, 'math', 'math', ['极限'], ['极限']),
    ]).ok).toBe(false);
    expect(() =>
      computeKnowledgeSemanticScore({
        dedupSemanticMacroF1: Number.NaN,
        revisionRecall: 1,
        organizerSubjectTop1: 1,
        organizerTagMicroF1: 1,
        organizerCollectionPairwiseF1: 1,
      }),
    ).toThrow('KNOWLEDGE_SEMANTIC_METRICS_INVALID');
  });
});

const relationLabels = [
  'semantic_duplicate',
  'possible_revision',
  'complementary',
  'unrelated',
] as const;
const subjectLabels = ['math', 'english', 'politics', 'computer', 'major', 'other'] as const;

function dedupObservation(
  index: number,
  expectedRelation: KnowledgeDedupRuntimeObservation['expectedRelation'],
  actualRelation: KnowledgeDedupRuntimeObservation['actualRelation'],
  validOutput = true,
): KnowledgeDedupRuntimeObservation {
  return {
    caseId: `knowledge_dedup_metric_${index}`,
    expectedRelation,
    actualRelation,
    revisionExpected: expectedRelation === 'possible_revision',
    validOutput,
  };
}

function organizerObservation(
  index: number,
  expectedSubject: KnowledgeOrganizerRuntimeObservation['expectedSubject'],
  actualSubject: KnowledgeOrganizerRuntimeObservation['actualSubject'],
  expectedTopicLabels: readonly string[],
  actualTopicLabels: readonly string[],
  validOutput = true,
): KnowledgeOrganizerRuntimeObservation {
  return {
    caseId: `knowledge_organizer_metric_${index}`,
    expectedSubject,
    actualSubject,
    expectedTopicLabels,
    actualTopicLabels,
    expectedCollectionPairs: [[`left-${index}`, `right-${index}`]],
    actualCollectionPairs: validOutput ? [[`right-${index}`, `left-${index}`]] : [],
    validOutput,
  };
}
