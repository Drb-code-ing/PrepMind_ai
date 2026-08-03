import { describe, expect, test } from 'bun:test';

import {
  WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY,
  formatWrongQuestionOrganizerAssociationPolicyForPrompt,
  validateWrongQuestionOrganizerModelDecisionV4,
  type WrongQuestionOrganizerDecisionContext,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';

const semanticContext = {
  questions: [
    {
      subjectHint: 'unknown',
      knowledgePoints: [],
      questionExcerpt: '利用等价无穷小判断函数极限。',
      analysisExcerpt: '需要识别极限变形。',
    },
  ],
  decks: [{ subject: 'math', name: '函数极限', keywords: ['等价无穷小'] }],
} as const satisfies WrongQuestionOrganizerDecisionContext;

function decision(overrides: Record<string, unknown> = {}) {
  return {
    decisions: [
      {
        questionIndex: 0,
        subject: 'math',
        deck: { action: 'create_topic', topicLabel: '函数极限' },
        confidence: 'medium',
        evidenceCodes: ['semantic_topic'],
        ...overrides,
      },
    ],
  };
}

function failed(
  axis: 'subject' | 'deck' | 'topic' | 'evidence' | 'confidence',
  reasonCode: string,
) {
  return {
    ok: false,
    diagnostic: { stage: 'dynamic_contract', axis, reasonCode },
  };
}

describe('Phase 6.9.7 WrongQuestionOrganizer V4 semantic authority', () => {
  test('deep-freezes the subject, deck, evidence, confidence, and topic decision matrix', () => {
    const policy = WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY;
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.knownSubject)).toBe(true);
    expect(Object.isFrozen(policy.unknownSubject.allowedSubjects)).toBe(true);
    expect(Object.isFrozen(policy.deckActions)).toBe(true);
    expect(Object.isFrozen(policy.deckActions[0]?.forbiddenEvidenceCodes)).toBe(true);
    expect(Object.isFrozen(policy.insufficientSignal)).toBe(true);
    expect(Object.isFrozen(policy.insufficientSignal.forbiddenWith)).toBe(true);
    expect(Object.isFrozen(policy.highConfidence.supportingEvidenceAnyOf)).toBe(true);
    expect(Object.isFrozen(policy.topicLabel.forbiddenGenericLabels)).toBe(true);
  });

  test('keeps known subject local and requires unknown subject inference', () => {
    const knownContext = {
      ...semanticContext,
      questions: [{ ...semanticContext.questions[0], subjectHint: 'math' as const }],
    };
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(decision({ subject: 'math' }), knownContext),
    ).toEqual(failed('subject', 'known_subject_requires_keep_local'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ subject: 'keep_local' }),
        semanticContext,
      ),
    ).toEqual(failed('subject', 'unknown_subject_requires_bounded_subject'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({
          subject: 'keep_local',
          evidenceCodes: ['structured_subject', 'semantic_topic'],
        }),
        knownContext,
      ).ok,
    ).toBe(true);
  });

  test.each(['computer', 'major', 'other'] as const)(
    'keeps unknown-subject %s inside the bounded taxonomy',
    (subject) => {
      expect(
        validateWrongQuestionOrganizerModelDecisionV4(decision({ subject }), semanticContext).ok,
      ).toBe(true);
    },
  );

  test('requires semantic and explicit error evidence instead of repairing omissions', () => {
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ evidenceCodes: ['insufficient_signal'] }),
        semanticContext,
      ),
    ).toEqual(failed('evidence', 'deck_action_evidence_missing'));

    const errorContext = {
      ...semanticContext,
      questions: [{ ...semanticContext.questions[0], errorType: '符号错误' }],
    };
    expect(validateWrongQuestionOrganizerModelDecisionV4(decision(), errorContext)).toEqual(
      failed('evidence', 'deck_action_evidence_missing'),
    );
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ evidenceCodes: ['semantic_topic', 'error_pattern'] }),
        errorContext,
      ).ok,
    ).toBe(true);
  });

  test('keeps insufficient_signal medium-only and mutually exclusive with positive evidence', () => {
    const insufficientContext = {
      questions: [{ subjectHint: 'unknown' as const, knowledgePoints: [] }],
      decks: [],
    };
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ subject: 'other', evidenceCodes: ['insufficient_signal'] }),
        insufficientContext,
      ).ok,
    ).toBe(true);
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ evidenceCodes: ['semantic_topic', 'insufficient_signal'] }),
        semanticContext,
      ),
    ).toEqual(failed('confidence', 'confidence_evidence_conflict'));
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({
          subject: 'other',
          confidence: 'high',
          evidenceCodes: ['insufficient_signal'],
        }),
        insufficientContext,
      ),
    ).toEqual(failed('confidence', 'confidence_evidence_conflict'));
  });

  test('allows high confidence only with bounded structured, error, or overlap support', () => {
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({ confidence: 'high' }),
        semanticContext,
      ),
    ).toEqual(failed('confidence', 'confidence_evidence_conflict'));

    const structuredContext = {
      ...semanticContext,
      questions: [
        {
          ...semanticContext.questions[0],
          category: '高等数学',
          knowledgePoints: ['函数极限'],
        },
      ],
    };
    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({
          confidence: 'high',
          evidenceCodes: ['structured_subject', 'semantic_topic'],
        }),
        structuredContext,
      ).ok,
    ).toBe(true);

    expect(
      validateWrongQuestionOrganizerModelDecisionV4(
        decision({
          deck: { action: 'reuse_existing', deckIndex: 0 },
          confidence: 'high',
          evidenceCodes: ['existing_deck_overlap'],
        }),
        semanticContext,
      ).ok,
    ).toBe(true);
  });

  test('keeps prompt policy generic and free of frozen oracle or mutation authority', () => {
    const prompt = formatWrongQuestionOrganizerAssociationPolicyForPrompt();
    expect(prompt).toContain('policyVersion=wrong-question-organizer-model-candidate-v4');
    expect(prompt).toContain('computer: general computer foundations');
    expect(prompt).toContain('major: explicit non-general-computer major course');
    expect(prompt).toContain('other: insufficient exam-subject signal');
    expect(prompt).not.toMatch(/organizer-(?:zero|runtime)-\d+/u);
    expect(prompt).not.toMatch(/canonicalTopicLabel|acceptedTopicLabels|expectedSubject/iu);
    expect(prompt).not.toMatch(/userId|writeCommand|database operation|tool call/iu);
  });
});
