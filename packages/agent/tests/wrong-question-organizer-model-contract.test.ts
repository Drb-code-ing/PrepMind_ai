import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import {
  WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY,
  WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_V2,
  WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
  WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION_V2,
  WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
  formatWrongQuestionOrganizerAssociationPolicyForPrompt,
  formatWrongQuestionOrganizerAssociationPolicyForPromptV2,
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
  test('deep-freezes one V4 association policy and keeps the V2 formatter byte-stable', () => {
    expect(WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION).toBe(
      'wrong-question-organizer-model-candidate-v4',
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
    expect(formatted).toContain('policyVersion=wrong-question-organizer-model-candidate-v4');
    expect(formatted).toContain('projected errorType requires error_pattern');
    expect(formatted).toContain('supportingEvidenceAnyOf=');
    expect(formatted).toContain('computer: general computer foundations');
    expect(formatted).toContain('major: explicit non-general-computer major course');
    expect(formatted).toContain('other: insufficient exam-subject signal');

    const legacy = formatWrongQuestionOrganizerAssociationPolicyForPromptV2();
    expect(WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION_V2).toBe(
      'wrong-question-organizer-model-candidate-v2',
    );
    expect(Object.isFrozen(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_V2)).toBe(true);
    expect(createHash('sha256').update(legacy).digest('hex')).toBe(
      'e1489fb8b41d635471243b863ea59cd89db08ea5a52e4919ae7e265c5174c257',
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
      validateWrongQuestionOrganizerModelDecision(validDecision, hostileContext as typeof context),
    ).toEqual({ ok: false, reasonCode: 'context_invalid' });
    expect(getterCalls).toBe(0);
  });
});
