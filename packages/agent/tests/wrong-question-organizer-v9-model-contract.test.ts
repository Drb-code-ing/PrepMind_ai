import { describe, expect, test } from 'bun:test';

import * as OrganizerV9Public from '@repo/agent/wrong-question-organizer-v9';

import { mergeWrongQuestionOrganizerV6ModelDecision } from '../src/model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import { deriveWrongQuestionOrganizerV5Shortlist } from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
  validateWrongQuestionOrganizerV9ModelDecision,
  type WrongQuestionOrganizerV9ModelDecision,
} from '../src/model-candidates/wrong-question-organizer-v9-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  buildWrongQuestionOrganizerV9PromptParts,
} from '../src/model-candidates/wrong-question-organizer-v9-model-projection.ts';
import {
  deriveWrongQuestionOrganizerV9OptionAuthority,
  type WrongQuestionOrganizerV9OptionAuthority,
} from '../src/model-candidates/wrong-question-organizer-v9-option-authority.ts';
import {
  diagnoseWrongQuestionOrganizerV9Schema,
  WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA,
} from '../src/model-candidates/wrong-question-organizer-v9-schema-diagnostic.ts';
import { createV9R1Source } from './fixtures/phase-6-9-wrong-question-organizer-v9-r1.ts';

describe('Phase 6.9.7 WrongQuestionOrganizer V9 exact selection contract', () => {
  test('freezes the public prompt, estimator, and exact two-field selection schema', () => {
    expect(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION).toBe(
      'wrong-question-organizer-model-candidate-v9',
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256,
    );
    expect(OrganizerV9Public.validateWrongQuestionOrganizerV9ModelDecision).toBe(
      validateWrongQuestionOrganizerV9ModelDecision,
    );

    const authority = optionAuthorityForTest();
    const decision = canonicalDecision(authority);
    expect(WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA.safeParse(decision).success).toBe(
      true,
    );
    const invalid = [
      { ...decision, shortlistFingerprint: authority.sourceShortlistFingerprint },
      {
        decisions: decision.decisions.map((entry) => ({ ...entry, questionIndex: '0' })),
      },
      { decisions: decision.decisions.map((entry) => ({ ...entry, optionIndex: 0.5 })) },
      { decisions: decision.decisions.map((entry) => ({ ...entry, subjectIndex: 0 })) },
      { data: decision },
    ];
    for (const value of invalid) {
      expect(WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA.safeParse(value).success).toBe(
        false,
      );
    }
  });

  test('maps optionIndex locally, injects the shortlist fingerprint, and reruns V6 merger', () => {
    const authority = optionAuthorityForTest();
    const validated = validateWrongQuestionOrganizerV9ModelDecision({
      decision: canonicalDecision(authority),
      authority,
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.reasonCode);
    expect(validated.value.shortlistFingerprint).toBe(authority.sourceShortlistFingerprint);
    const selected = authority.questions[0]!.options[1] ?? authority.questions[0]!.options[0]!;
    expect(validated.value.decisions[0]!.subjectDecision).toEqual(selected.subjectDecision);
    expect(validated.value.decisions[0]!.deckDecision).toEqual(selected.deckDecision);

    const merged = mergeWrongQuestionOrganizerV6ModelDecision({
      authority: authority.shortlistAuthority,
      decision: validated.value,
      snapshotStable: true,
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) throw new Error(merged.reasonCode);
    expect(merged.value.suggestions[0]!.selection.source).toBe('model_ordinal');

    const outOfRange = validateWrongQuestionOrganizerV9ModelDecision({
      decision: { decisions: [{ questionIndex: 0, optionIndex: 23 }] },
      authority,
    });
    expect(outOfRange).toEqual({ ok: false, reasonCode: 'option_index_out_of_range' });
  });

  test('uses one canonical three-part estimator input', () => {
    const authority = optionAuthorityForTest();
    const prompt = buildWrongQuestionOrganizerV9PromptParts(authority.projection);
    expect(prompt.ok).toBe(true);
    if (!prompt.ok) throw new Error(prompt.reasonCode);
    expect(prompt.value.parts).toHaveLength(3);
    expect(prompt.value.parts[1]).toBe(prompt.value.userPrompt);
    expect(prompt.value.userPrompt).toBe(JSON.stringify(authority.projection));
    expect(prompt.value.estimatedInputTokens).toBe(authority.estimatedInputTokens);
  });
});

describe('Phase 6.9.7 WrongQuestionOrganizer V9 bounded schema diagnostic', () => {
  test('classifies fixed reasons without retaining keys, indexes, or values', () => {
    const valid = canonicalDecision(optionAuthorityForTest());
    const validEntry = valid.decisions[0]!;
    const cases: readonly [unknown, string][] = [
      [null, 'top_level_shape'],
      [{ extra: true, decisions: valid.decisions }, 'top_level_keys'],
      [{ decisions: {} }, 'decisions_type'],
      [{ decisions: [] }, 'decisions_count'],
      [{ decisions: [null] }, 'decision_shape'],
      [{ decisions: [{ ...validEntry, secretOrdinal: 17 }] }, 'decision_keys'],
      [{ decisions: [{ ...validEntry, questionIndex: '0' }] }, 'question_index'],
      [{ decisions: [{ ...validEntry, optionIndex: '1' }] }, 'option_index'],
    ];
    for (const [value, reason] of cases) {
      const diagnostic = diagnoseWrongQuestionOrganizerV9Schema(value);
      expect(diagnostic?.reason).toBe(reason);
      expect(
        WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse(diagnostic).success,
      ).toBe(true);
      expect(diagnostic?.rawDataRetained).toBe(false);
      expect(JSON.stringify(diagnostic)).not.toMatch(/secretOrdinal|sk-|Bearer|optionIndex":17/);
    }
    expect(diagnoseWrongQuestionOrganizerV9Schema(valid)).toBeNull();
  });
});

function optionAuthorityForTest(): WrongQuestionOrganizerV9OptionAuthority {
  const shortlist = deriveWrongQuestionOrganizerV5Shortlist(createV9R1Source());
  if (!shortlist.ok) throw new Error(shortlist.reasonCode);
  const authority = deriveWrongQuestionOrganizerV9OptionAuthority(shortlist.value);
  if (!authority.ok) throw new Error(authority.reasonCode);
  return authority.value;
}

function canonicalDecision(
  authority: WrongQuestionOrganizerV9OptionAuthority,
): WrongQuestionOrganizerV9ModelDecision {
  return {
    decisions: authority.questions.map((question) => ({
      questionIndex: question.questionIndex,
      optionIndex: Math.min(1, question.options.length - 1),
    })),
  };
}
