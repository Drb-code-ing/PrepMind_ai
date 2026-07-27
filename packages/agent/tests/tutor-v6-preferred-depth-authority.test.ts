import { describe, expect, test } from 'bun:test';

import { TUTOR_BOUNDED_INTENTS } from '../src/policies/tutor-strategy-policy.ts';
import {
  TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256,
  TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION,
  TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
  deriveTutorV6PreferredDepthAuthority,
  validateTutorV6PreferredDepthAuthority,
} from '../src/model-candidates/tutor-v6-preferred-depth-authority.ts';

describe('Tutor V6 preferred-depth local authority', () => {
  test('binds every eligible intent to one local strategy without active context', () => {
    const result = deriveTutorV6PreferredDepthAuthority({
      activeContextAvailable: false,
      eligibleIntents: [...TUTOR_BOUNDED_INTENTS],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('TUTOR_V6_AUTHORITY_MISSING');
    expect(result.value.version).toBe(TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION);
    expect(result.value.rulesSha256).toBe(TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256);
    expect(TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256).toBe(
      TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256,
    );
    expect(result.value.choices.map((choice) => [choice.ordinal, choice.intent])).toEqual(
      TUTOR_BOUNDED_INTENTS.map((intent, ordinal) => [ordinal, intent]),
    );
    expect(result.value.choices.map((choice) => choice.preferredDepth)).toEqual([
      'standard',
      'standard',
      'standard',
      'standard',
      'standard',
    ]);
    expect(result.value.choices.every((choice) => !choice.shouldUseActiveStudyContext)).toBe(true);
    expect(isDeepFrozen(result.value)).toBe(true);
    expect(validateTutorV6PreferredDepthAuthority(result.value)).toEqual(result);
  });

  test('uses active context only for local depth and structure invariants', () => {
    const result = deriveTutorV6PreferredDepthAuthority({
      activeContextAvailable: true,
      eligibleIntents: ['explain_solution', 'general_follow_up', 'socratic_hint'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('TUTOR_V6_ACTIVE_AUTHORITY_MISSING');
    expect(result.value.choices).toMatchObject([
      {
        ordinal: 0,
        intent: 'explain_solution',
        preferredDepth: 'deep',
        shouldAskGuidingQuestion: false,
        shouldGiveFinalAnswer: true,
        shouldUseActiveStudyContext: true,
        answerStructure: ['known_conditions', 'concept', 'reasoning_steps', 'final_answer'],
      },
      {
        ordinal: 1,
        intent: 'general_follow_up',
        preferredDepth: 'standard',
        shouldAskGuidingQuestion: false,
        shouldGiveFinalAnswer: false,
        shouldUseActiveStudyContext: true,
        answerStructure: ['known_conditions', 'reasoning_steps', 'guiding_question'],
      },
      {
        ordinal: 2,
        intent: 'socratic_hint',
        preferredDepth: 'standard',
        shouldAskGuidingQuestion: true,
        shouldGiveFinalAnswer: false,
        shouldUseActiveStudyContext: true,
      },
    ]);
  });

  test('fails closed on duplicate, answer-direct, extra fields, and authority tampering', () => {
    expect(
      deriveTutorV6PreferredDepthAuthority({
        activeContextAvailable: true,
        eligibleIntents: ['socratic_hint', 'socratic_hint'],
      }),
    ).toEqual({ ok: false, reasonCode: 'duplicate_intent' });
    expect(
      deriveTutorV6PreferredDepthAuthority({
        activeContextAvailable: false,
        eligibleIntents: ['answer_direct'],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_input' });
    expect(
      deriveTutorV6PreferredDepthAuthority({
        activeContextAvailable: false,
        eligibleIntents: ['general_follow_up'],
        finalAnswer: true,
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_input' });

    const valid = deriveTutorV6PreferredDepthAuthority({
      activeContextAvailable: true,
      eligibleIntents: ['explain_solution'],
    });
    if (!valid.ok) throw new Error('TUTOR_V6_TAMPER_FIXTURE_MISSING');
    const tampered = structuredClone(valid.value);
    tampered.choices[0]!.preferredDepth = 'brief';
    expect(validateTutorV6PreferredDepthAuthority(tampered)).toEqual({
      ok: false,
      reasonCode: 'authority_contract_invalid',
    });
  });
});

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}
