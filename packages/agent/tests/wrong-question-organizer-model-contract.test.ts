import { describe, expect, test } from 'bun:test';

import {
  WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
  validateWrongQuestionOrganizerModelDecision,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';

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
  });

  test('rejects unsafe/reserved labels and invalid evidence associations', () => {
    for (const topicLabel of ['https://evil.test', '<b>topic</b>', '未分类', 'api key secret']) {
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
