import { describe, expect, test } from 'bun:test';

import {
  WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY,
  WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
  WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
  formatWrongQuestionOrganizerAssociationPolicyForPrompt,
  validateWrongQuestionOrganizerModelDecision,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';
import { phase69WrongQuestionOrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';

const context = {
  questions: [{ subjectHint: 'math' }, { subjectHint: 'unknown' }],
  decks: [{ subject: 'math' }, { subject: 'english' }],
} as const;

const validDecision = {
  decisions: [
    {
      questionIndex: 0,
      subject: 'keep_local',
      deck: { action: 'reuse_existing', deckIndex: 0 },
      confidence: 'high',
      evidenceCodes: ['structured_subject', 'existing_deck_overlap'],
    },
    {
      questionIndex: 1,
      subject: 'english',
      deck: { action: 'create_topic', topicLabel: '阅读理解' },
      confidence: 'medium',
      evidenceCodes: ['semantic_topic'],
    },
  ],
} as const;

describe('Phase 6.9.7 WrongQuestionOrganizer model contract', () => {
  test('deep-freezes one association policy and formats byte-stable v2 prompt rules', () => {
    expect(WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION).toBe(
      'wrong-question-organizer-model-candidate-v2',
    );
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY)).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject)).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.evidence)).toBe(
      true,
    );
    expect(
      Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.evidence.codes),
    ).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.unknownSubject)).toBe(true);
    expect(
      Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.unknownSubject.allowedSubjects),
    ).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.deckActions)).toBe(true);
    for (const policy of WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.deckActions) {
      expect(Object.isFrozen(policy), policy.action).toBe(true);
      expect(Object.isFrozen(policy.evidence), policy.action).toBe(true);
      expect(Object.isFrozen(policy.evidence.codes), policy.action).toBe(true);
    }
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.evidenceTaxonomy)).toBe(
      true,
    );
    for (const evidence of WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.evidenceTaxonomy) {
      expect(Object.isFrozen(evidence), evidence.code).toBe(true);
    }
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.highConfidence)).toBe(true);
    expect(
      Object.isFrozen(
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.highConfidence.forbiddenEvidenceCodes,
      ),
    ).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.subjectTaxonomy)).toBe(true);
    for (const taxonomy of WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.subjectTaxonomy) {
      expect(Object.isFrozen(taxonomy), taxonomy.subject).toBe(true);
    }
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel)).toBe(true);
    expect(
      Object.isFrozen(
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel.forbiddenGenericLabels,
      ),
    ).toBe(true);
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel.guidance)).toBe(
      true,
    );

    const formatted = formatWrongQuestionOrganizerAssociationPolicyForPrompt();
    expect(formatWrongQuestionOrganizerAssociationPolicyForPrompt()).toBe(formatted);
    expect(formatted).toBe(
      [
        'policyVersion=wrong-question-organizer-model-candidate-v2',
        'subjectAuthority:',
        '- subjectHint!=unknown: subject=keep_local; requiredEvidenceAll=[structured_subject].',
        '- subjectHint=unknown: subjectAnyOf=[math,english,politics,computer,major,other]; keep_local=forbidden.',
        'deckRules:',
        '- reuse_existing: sameResolvedSubject=true; requiredEvidenceAll=[existing_deck_overlap]; use=select only when projected deck name or keywords directly overlap the question topic.',
        '- create_topic: sameResolvedSubject=false; requiredEvidenceAnyOf=[semantic_topic,error_pattern,insufficient_signal]; use=select when no same-subject projected deck directly matches; propose one bounded topic.',
        'evidenceTaxonomy:',
        '- structured_subject: known subjectHint or another projected structured subject or topic field supports the decision.',
        '- semantic_topic: projected question meaning supports the selected topic or deck.',
        '- existing_deck_overlap: selected same-subject deck name or keywords directly overlap.',
        '- error_pattern: projected errorType or analysis exposes a specific error pattern.',
        '- insufficient_signal: projected content cannot ground a more precise topic.',
        'confidenceRules:',
        '- high: forbiddenEvidence=[insufficient_signal]; use=only for explicit same-subject deck overlap or a structured category, knowledge point, or error pattern that directly pins the decision.',
        '- medium: use=default for semantic inference from question text; use insufficient_signal when no precise topic is grounded.',
        'subjectTaxonomy:',
        '- math: explicit mathematics signal.',
        '- english: explicit English-language subject signal.',
        '- politics: explicit politics subject signal.',
        '- computer: general computer foundations, software, algorithms, networks, databases, or operating systems.',
        '- major: explicit non-general-computer major course or professional exam domain.',
        '- other: insufficient exam-subject signal or outside the preceding subjects.',
        'topicRules:',
        '- Return one short, precise, source-grounded concept or error pattern from the projected question.',
        '- Do not combine unrelated concepts into one label.',
        '- forbiddenGenericLabels=[未分类,未分类错题,其他,other,default,uncategorized,知识点,综合题,学习资料,错题整理].',
      ].join('\n'),
    );
  });

  test('keeps the generic policy prompt free of frozen case ids and answer labels', () => {
    const formatted = formatWrongQuestionOrganizerAssociationPolicyForPrompt();
    for (const fixture of phase69WrongQuestionOrganizerCases) {
      expect(formatted).not.toContain(fixture.id);
      for (const question of fixture.input.questions) {
        expect(formatted).not.toContain(question.id);
        expect(formatted).not.toContain(question.questionText);
      }
      if (fixture.subset === 'runtime') {
        for (const decision of fixture.expected.decisions) {
          expect(formatted).not.toContain(decision.canonicalTopicLabel);
          for (const label of decision.acceptedTopicLabels) {
            expect(formatted).not.toContain(label);
          }
        }
      }
    }
    expect(formatted).not.toMatch(/expected(?:Output|Subject|Confidence)|caseId/iu);
  });

  test('accepts a complete ordinal-only batch decision', () => {
    expect(WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA.parse(validDecision)).toEqual(validDecision);
    expect(validateWrongQuestionOrganizerModelDecision(validDecision, context)).toEqual({
      ok: true,
      value: validDecision,
    });
  });

  test('rejects extra fields, invalid enums/actions, and duplicate evidence', () => {
    expect(
      validateWrongQuestionOrganizerModelDecision(
        { ...validDecision, writeCommand: 'upsert' },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            { ...validDecision.decisions[0], subject: 'physics' },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            {
              ...validDecision.decisions[0],
              deck: { action: 'delete_existing', deckIndex: 0 },
            },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            {
              ...validDecision.decisions[0],
              evidenceCodes: ['structured_subject', 'structured_subject'],
            },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
  });

  test('requires every projected question exactly once', () => {
    expect(
      validateWrongQuestionOrganizerModelDecision(
        { decisions: [validDecision.decisions[0]] },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'question_count_mismatch' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        { decisions: [validDecision.decisions[0], validDecision.decisions[0]] },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'duplicate_question_index' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            validDecision.decisions[0],
            { ...validDecision.decisions[1], questionIndex: 2 },
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'question_index_out_of_range' });
  });

  test('enforces local subject authority and same-subject deck ordinals', () => {
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            { ...validDecision.decisions[0], subject: 'math' },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'subject_authority_violation' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            {
              ...validDecision.decisions[0],
              deck: { action: 'reuse_existing', deckIndex: 1 },
            },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'cross_subject_deck' });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            validDecision.decisions[0],
            { ...validDecision.decisions[1], subject: 'keep_local' },
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'subject_authority_violation' });
  });

  test('rejects unsafe/reserved labels and invalid evidence associations', () => {
    for (const topicLabel of [
      'https://evil.test',
      '<b>topic</b>',
      '未分类',
      'api key secret',
      '知识点',
      '综合题',
      '学习资料',
      '错题整理',
    ]) {
      expect(
        validateWrongQuestionOrganizerModelDecision(
          {
            decisions: [
              validDecision.decisions[0],
              {
                ...validDecision.decisions[1],
                deck: { action: 'create_topic', topicLabel },
              },
            ],
          },
          context,
        ).ok,
      ).toBe(false);
    }

    expect(
      validateWrongQuestionOrganizerModelDecision(
        {
          decisions: [
            {
              ...validDecision.decisions[0],
              evidenceCodes: ['structured_subject'],
            },
            validDecision.decisions[1],
          ],
        },
        context,
      ),
    ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });

    const invalidEvidenceDecisions = [
      {
        ...validDecision.decisions[0],
        deck: { action: 'create_topic', topicLabel: '函数极限' },
        evidenceCodes: ['semantic_topic'],
      },
      {
        ...validDecision.decisions[1],
        evidenceCodes: ['structured_subject'],
      },
      {
        ...validDecision.decisions[1],
        confidence: 'high',
        evidenceCodes: ['insufficient_signal'],
      },
    ] as const;
    for (const invalidDecision of invalidEvidenceDecisions) {
      const decisions = [validDecision.decisions[0], validDecision.decisions[1]].map((decision) =>
        decision.questionIndex === invalidDecision.questionIndex ? invalidDecision : decision,
      );
      expect(validateWrongQuestionOrganizerModelDecision({ decisions }, context)).toEqual({
        ok: false,
        reasonCode: 'invalid_evidence_association',
      });
    }
  });

  test('contains hostile local association context without invoking accessors', () => {
    let getterCalls = 0;
    const hostileContext = { ...context } as Record<string, unknown>;
    Object.defineProperty(hostileContext, 'questions', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return context.questions;
      },
    });
    expect(
      validateWrongQuestionOrganizerModelDecision(
        validDecision,
        hostileContext as typeof context,
      ),
    ).toEqual({ ok: false, reasonCode: 'context_invalid' });
    expect(getterCalls).toBe(0);
  });
});
