import { describe, expect, test } from 'bun:test';

import {
  TUTOR_MODEL_DECISION_SCHEMA,
  validateTutorModelDecision,
} from '../src/model-candidates/tutor-model-contract.ts';

const validDecision = {
  intent: 'socratic_hint',
  depth: 'standard',
  confidence: 'high',
  evidenceCodes: ['implicit_hint_request', 'contextual_reference'],
} as const;

describe('Phase 6.9.7 Tutor model contract', () => {
  test('accepts only the bounded Tutor decision vocabulary', () => {
    expect(TUTOR_MODEL_DECISION_SCHEMA.parse(validDecision)).toEqual(validDecision);
    expect(validateTutorModelDecision(validDecision)).toEqual({
      ok: true,
      value: validDecision,
    });
  });

  test('rejects extra fields, answer_direct, invalid enums, and duplicate evidence', () => {
    expect(
      validateTutorModelDecision({ ...validDecision, promptAddition: 'model text' }),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
    expect(validateTutorModelDecision({ ...validDecision, intent: 'answer_direct' })).toEqual({
      ok: false,
      reasonCode: 'schema_invalid',
    });
    expect(validateTutorModelDecision({ ...validDecision, depth: 'unbounded' })).toEqual({
      ok: false,
      reasonCode: 'schema_invalid',
    });
    expect(
      validateTutorModelDecision({
        ...validDecision,
        evidenceCodes: ['implicit_hint_request', 'implicit_hint_request'],
      }),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });
  });

  test('separates schema parsing from intent/evidence association validation', () => {
    expect(
      validateTutorModelDecision({
        ...validDecision,
        intent: 'step_check',
        evidenceCodes: ['concept_gap'],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });

    expect(
      validateTutorModelDecision({
        ...validDecision,
        intent: 'general_follow_up',
        evidenceCodes: ['ambiguous_intent'],
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validDecision,
        intent: 'general_follow_up',
        evidenceCodes: ['ambiguous_intent'],
      },
    });
  });
});
