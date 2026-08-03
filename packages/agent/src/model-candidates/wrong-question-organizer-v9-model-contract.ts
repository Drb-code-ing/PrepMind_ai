import { z } from 'zod';

import { clonePlainModelData } from './model-projection-safety.ts';
import {
  validateWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6ValidatedDecision,
} from './wrong-question-organizer-v6-model-contract.ts';
import {
  validateWrongQuestionOrganizerV9OptionAuthority,
  type WrongQuestionOrganizerV9OptionAuthority,
} from './wrong-question-organizer-v9-option-authority.ts';

export const WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA = z
  .object({
    decisions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().safe().min(0).max(11),
            optionIndex: z.number().int().safe().min(0).max(23),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export type WrongQuestionOrganizerV9ModelDecision = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA
>;

export type WrongQuestionOrganizerV9DecisionFailureCode =
  | 'schema_invalid'
  | 'option_authority_invalid'
  | 'question_count_mismatch'
  | 'duplicate_question_index'
  | 'question_index_out_of_range'
  | 'option_index_out_of_range'
  | 'selection_authority_invalid';

export type WrongQuestionOrganizerV9DecisionValidationResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV6ValidatedDecision }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV9DecisionFailureCode }>;

export function validateWrongQuestionOrganizerV9ModelDecision(
  input: Readonly<{
    decision: unknown;
    authority: WrongQuestionOrganizerV9OptionAuthority;
  }>,
): WrongQuestionOrganizerV9DecisionValidationResult {
  try {
    const authority = validateWrongQuestionOrganizerV9OptionAuthority(input.authority);
    if (!authority.ok) return { ok: false, reasonCode: 'option_authority_invalid' };
    const cloned = clonePlainModelData(input.decision);
    if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
    const parsed = WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };
    const decision = parsed.data;
    if (decision.decisions.length !== authority.value.questions.length) {
      return { ok: false, reasonCode: 'question_count_mismatch' };
    }
    const questionIndexes = decision.decisions.map((entry) => entry.questionIndex);
    if (new Set(questionIndexes).size !== questionIndexes.length) {
      return { ok: false, reasonCode: 'duplicate_question_index' };
    }

    const mapped = [] as Array<{
      questionIndex: number;
      subjectDecision: WrongQuestionOrganizerV9OptionAuthority['questions'][number]['options'][number]['subjectDecision'];
      deckDecision: WrongQuestionOrganizerV9OptionAuthority['questions'][number]['options'][number]['deckDecision'];
    }>;
    for (const entry of decision.decisions) {
      const question = authority.value.questions[entry.questionIndex];
      if (!question) return { ok: false, reasonCode: 'question_index_out_of_range' };
      const option = question.options[entry.optionIndex];
      if (!option) return { ok: false, reasonCode: 'option_index_out_of_range' };
      mapped.push({
        questionIndex: entry.questionIndex,
        subjectDecision: option.subjectDecision,
        deckDecision: option.deckDecision,
      });
    }
    mapped.sort((left, right) => left.questionIndex - right.questionIndex);
    const validation = validateWrongQuestionOrganizerV6ModelDecision({
      authority: authority.value.shortlistAuthority,
      decision: {
        shortlistFingerprint: authority.value.sourceShortlistFingerprint,
        decisions: mapped,
      },
    });
    return validation.ok
      ? { ok: true, value: validation.value }
      : { ok: false, reasonCode: 'selection_authority_invalid' };
  } catch {
    return { ok: false, reasonCode: 'schema_invalid' };
  }
}
