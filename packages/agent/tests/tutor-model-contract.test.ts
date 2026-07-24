import { describe, expect, test } from 'bun:test';

import {
  TUTOR_MODEL_DECISION_SCHEMA,
  TUTOR_MODEL_EVIDENCE_CODES,
  TUTOR_MODEL_INTENT_POLICY,
  TUTOR_MODEL_PROMPT_VERSION,
  formatTutorModelIntentPolicyForPrompt,
  isTutorModelDepthCompatible,
  validateTutorModelDecision,
} from '../src/model-candidates/tutor-model-contract.ts';
import { phase69TutorCases } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';

const validDecision = {
  intent: 'socratic_hint',
  depth: 'standard',
  confidence: 'high',
  evidenceCodes: ['implicit_hint_request', 'contextual_reference'],
} as const;

describe('Phase 6.9.7 Tutor model contract', () => {
  test('deep-freezes one intent policy and formats byte-stable v2 prompt rules', () => {
    expect(TUTOR_MODEL_PROMPT_VERSION).toBe('tutor-model-candidate-v2');
    expect(Object.isFrozen(TUTOR_MODEL_INTENT_POLICY)).toBe(true);
    for (const policy of TUTOR_MODEL_INTENT_POLICY) {
      expect(Object.isFrozen(policy), policy.intent).toBe(true);
      expect(Object.isFrozen(policy.primaryEvidenceCodes), policy.intent).toBe(true);
      expect(Object.isFrozen(policy.allowedEvidenceCodes), policy.intent).toBe(true);
      expect(Object.isFrozen(policy.compatibleDepths), policy.intent).toBe(true);
    }

    const formatted = formatTutorModelIntentPolicyForPrompt();
    expect(formatTutorModelIntentPolicyForPrompt()).toBe(formatted);
    expect(formatted).toBe(
      [
        'policyVersion=tutor-model-candidate-v2',
        'intentRules:',
        '- explain_solution: primaryAnyOf=[full_explanation_request]; allowed=[full_explanation_request,contextual_reference,ambiguous_intent]; compatibleDepths=[standard,deep]; use=complete worked solution or derivation.',
        '- socratic_hint: primaryAnyOf=[implicit_hint_request,contextual_reference]; allowed=[implicit_hint_request,contextual_reference,ambiguous_intent]; compatibleDepths=[brief,standard]; use=hint or next step before a full solution.',
        '- step_check: primaryAnyOf=[submitted_step]; allowed=[submitted_step,contextual_reference,ambiguous_intent]; compatibleDepths=[brief,standard]; use=check a step the learner already submitted.',
        '- concept_bridge: primaryAnyOf=[concept_gap]; allowed=[concept_gap,contextual_reference,ambiguous_intent]; compatibleDepths=[standard,deep]; use=explain why a concept holds or how concepts connect.',
        '- general_follow_up: primaryAnyOf=[contextual_reference,ambiguous_intent]; allowed=[contextual_reference,ambiguous_intent]; compatibleDepths=[brief,standard]; use=contextual follow-up with no more specific teaching signal.',
      ].join('\n'),
    );
  });

  test('derives evidence and compatible depth decisions from the exported policy', () => {
    for (const policy of TUTOR_MODEL_INTENT_POLICY) {
      const primary = policy.primaryEvidenceCodes[0]!;
      const compatibleDepth = policy.compatibleDepths[0]!;
      for (const evidenceCode of policy.allowedEvidenceCodes) {
        const evidenceCodes = [...new Set([primary, evidenceCode])];
        expect(
          validateTutorModelDecision({
            intent: policy.intent,
            depth: compatibleDepth,
            confidence: 'high',
            evidenceCodes,
          }),
          `${policy.intent}:${evidenceCode}`,
        ).toMatchObject({ ok: true });
      }

      const disallowed = TUTOR_MODEL_EVIDENCE_CODES.find(
        (code) => !policy.allowedEvidenceCodes.includes(code),
      );
      if (disallowed !== undefined) {
        expect(
          validateTutorModelDecision({
            intent: policy.intent,
            depth: compatibleDepth,
            confidence: 'high',
            evidenceCodes: [primary, disallowed],
          }),
          `${policy.intent}:${disallowed}`,
        ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });
      }

      for (const depth of ['brief', 'standard', 'deep'] as const) {
        expect(isTutorModelDepthCompatible(policy.intent, depth), `${policy.intent}:${depth}`).toBe(
          policy.compatibleDepths.includes(depth),
        );
      }
    }
  });

  test('keeps the generic policy prompt free of frozen case ids and fixture text', () => {
    const formatted = formatTutorModelIntentPolicyForPrompt();
    for (const fixture of phase69TutorCases) {
      expect(formatted).not.toContain(fixture.id);
      expect(formatted).not.toContain(fixture.input.latestUserText);
      if (fixture.input.activeStudyContext) {
        expect(formatted).not.toContain(fixture.input.activeStudyContext);
      }
    }
    expect(formatted).not.toMatch(/expected(?:Output|Intent|Depth)|canonicalTopicLabel/iu);
  });

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
