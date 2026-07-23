import { describe, expect, it } from 'bun:test';

import {
  buildTutorWrongQuestionSemanticMetrics,
  computeCombinedSemanticScore,
  computeOrganizerSemanticScore,
  computeTutorSemanticScore,
  nearestRankP95,
  type OrganizerDecisionObservation,
  type TutorRuntimeObservation,
} from '../src/evals/phase-6-9-tutor-wrong-question-metrics.ts';

describe('Phase 6.9.7 Tutor / WrongQuestionOrganizer metrics', () => {
  it('uses the frozen Tutor, Organizer, and combined formulas', () => {
    expect(
      computeTutorSemanticScore({
        intentMacroF1: 0.8,
        depthAccuracy: 0.9,
        contextUseAccuracy: 0.7,
        pedagogyPolicyAccuracy: 0.6,
      }),
    ).toBeCloseTo(0.785, 12);
    expect(
      computeOrganizerSemanticScore({
        subjectAccuracy: 0.8,
        deckActionAccuracy: 0.9,
        existingDeckPrecision: 0.7,
        topicLabelMacroF1: 0.6,
        evidenceConfidenceAccuracy: 0.5,
      }),
    ).toBeCloseTo(0.745, 12);
    expect(computeCombinedSemanticScore(0.8, 0.6)).toBeCloseTo(0.7, 12);
  });

  it('scores perfect canonical and accepted-label observations as one', () => {
    const result = buildTutorWrongQuestionSemanticMetrics(
      tutorIntents.map((intent, index) => tutorObservation(index, intent, intent)),
      [
        organizerObservation(0, 'math', 'math', 'reuse_existing', 'reuse_existing', 0, 0),
        organizerObservation(1, 'english', 'english', 'create_topic', 'create_topic'),
      ],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics.tutor).toMatchObject({
      intentMacroF1: 1,
      depthAccuracy: 1,
      contextUseAccuracy: 1,
      pedagogyPolicyAccuracy: 1,
      semanticScore: 1,
      scoredCases: 5,
      invalidCases: 0,
    });
    expect(result.metrics.organizer).toMatchObject({
      subjectAccuracy: 1,
      deckActionAccuracy: 1,
      existingDeckPrecision: 1,
      topicLabelMacroF1: 1,
      evidenceConfidenceAccuracy: 1,
      semanticScore: 1,
      scoredDecisions: 2,
      invalidDecisions: 0,
    });
    expect(result.metrics.combinedSemanticScore).toBe(1);
  });

  it('keeps invalid observations in applicable denominators', () => {
    const tutor = tutorIntents.map((intent, index) =>
      tutorObservation(index, intent, index === 0 ? null : intent, index !== 0),
    );
    const organizer = [
      organizerObservation(0, 'math', null, 'reuse_existing', null, 0, null, false),
      organizerObservation(1, 'english', 'english', 'create_topic', 'create_topic'),
    ];
    const result = buildTutorWrongQuestionSemanticMetrics(tutor, organizer);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics.tutor.invalidCases).toBe(1);
    expect(result.metrics.tutor.depthAccuracy).toBe(0.8);
    expect(result.metrics.organizer.invalidDecisions).toBe(1);
    expect(result.metrics.organizer.subjectAccuracy).toBe(0.5);
    expect(result.metrics.organizer.existingDeckPrecision).toBe(0);
    expect(result.metrics.tutor.semanticScore).toBeLessThan(1);
    expect(result.metrics.organizer.semanticScore).toBeLessThan(1);
  });

  it('uses nearest-rank P95 over exactly 24 finite nonnegative values', () => {
    expect(nearestRankP95(Array.from({ length: 24 }, (_, index) => index + 1))).toBe(23);
    expect(nearestRankP95([1, 2, 3])).toBeNull();
    expect(nearestRankP95([...Array.from({ length: 23 }, () => 1), -1])).toBeNull();
  });

  it('rejects duplicate, malformed, empty, or non-finite metrics', () => {
    expect(buildTutorWrongQuestionSemanticMetrics([], []).ok).toBe(false);
    const duplicate = tutorObservation(0, 'socratic_hint', 'socratic_hint');
    expect(
      buildTutorWrongQuestionSemanticMetrics(
        [duplicate, duplicate],
        [organizerObservation(0, 'math', 'math', 'create_topic', 'create_topic')],
      ).ok,
    ).toBe(false);
    expect(() =>
      computeTutorSemanticScore({
        intentMacroF1: Number.NaN,
        depthAccuracy: 1,
        contextUseAccuracy: 1,
        pedagogyPolicyAccuracy: 1,
      }),
    ).toThrow('TUTOR_SEMANTIC_METRICS_INVALID');
  });
});

const tutorIntents = [
  'explain_solution',
  'socratic_hint',
  'step_check',
  'concept_bridge',
  'general_follow_up',
] as const;

function tutorObservation(
  index: number,
  expectedIntent: TutorRuntimeObservation['expectedIntent'],
  actualIntent: TutorRuntimeObservation['actualIntent'],
  validOutput = true,
): TutorRuntimeObservation {
  return {
    caseId: `tutor_metric_${index}`,
    expectedIntent,
    actualIntent,
    expectedDepth: 'standard',
    actualDepth: validOutput ? 'standard' : null,
    expectedContextUse: true,
    actualContextUse: validOutput ? true : null,
    expectedGuidingQuestion: false,
    actualGuidingQuestion: validOutput ? false : null,
    expectedFinalAnswer: false,
    actualFinalAnswer: validOutput ? false : null,
    expectedAnswerStructure: ['known_conditions', 'reasoning_steps'],
    actualAnswerStructure: validOutput ? ['known_conditions', 'reasoning_steps'] : [],
    validOutput,
  };
}

function organizerObservation(
  index: number,
  expectedSubject: OrganizerDecisionObservation['expectedSubject'],
  actualSubject: OrganizerDecisionObservation['actualSubject'],
  expectedDeckAction: OrganizerDecisionObservation['expectedDeckAction'],
  actualDeckAction: OrganizerDecisionObservation['actualDeckAction'],
  expectedDeckIndex: number | null = null,
  actualDeckIndex: number | null = null,
  validOutput = true,
): OrganizerDecisionObservation {
  return {
    decisionId: `organizer_metric_${index}`,
    expectedSubject,
    actualSubject,
    expectedDeckAction,
    actualDeckAction,
    expectedDeckIndex,
    actualDeckIndex,
    canonicalTopicLabel: `topic-${index}`,
    acceptedTopicLabels: [`topic-${index}`, `Topic ${index}`],
    actualTopicLabel: validOutput ? `Topic ${index}` : null,
    expectedConfidence: 'medium',
    actualConfidence: validOutput ? 'medium' : null,
    requiredEvidenceCodes: ['semantic_topic'],
    allowedEvidenceCodes: ['semantic_topic', 'structured_subject'],
    actualEvidenceCodes: validOutput ? ['semantic_topic'] : [],
    validOutput,
  };
}
