import { z } from 'zod';

import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  scanCompleteModelField,
  truncateUnicodeScalars,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_SUBJECTS,
  type WrongQuestionOrganizerSubject,
} from './wrong-question-organizer-model-contract.ts';

export const WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION =
  'wrong-question-organizer-model-projection-v1' as const;

const MAX_FIELD_UTF16 = 16_384;
const MAX_QUESTION_EXCERPT_SCALARS = 480;
const MAX_ANALYSIS_EXCERPT_SCALARS = 320;
const MAX_STRUCTURED_LABEL_SCALARS = 80;
const MAX_PROJECTED_KNOWLEDGE_POINTS = 3;
const MAX_DECK_NAME_SCALARS = 80;
const MAX_PROJECTED_DECK_KEYWORDS = 8;
const MAX_DECK_KEYWORD_SCALARS = 60;
const MAX_PROJECTED_INPUT_TOKENS = 3_500;

const SAFETY_STATE_SCHEMA = z.enum(['safe_for_model', 'unsafe', 'unknown']);
const NULLABLE_TEXT_SCHEMA = z.string().nullable();
const SOURCE_QUESTION_SCHEMA = z
  .object({
    questionId: z.string().min(1).max(256),
    subject: NULLABLE_TEXT_SCHEMA,
    subjectHint: z.enum([...WRONG_QUESTION_ORGANIZER_SUBJECTS, 'unknown']),
    category: NULLABLE_TEXT_SCHEMA,
    knowledgePoints: z.array(z.string()).max(20),
    errorType: NULLABLE_TEXT_SCHEMA,
    questionText: NULLABLE_TEXT_SCHEMA,
    analysis: NULLABLE_TEXT_SCHEMA,
    answer: NULLABLE_TEXT_SCHEMA,
    userNote: NULLABLE_TEXT_SCHEMA,
    safety: SAFETY_STATE_SCHEMA,
  })
  .strict();
const SOURCE_DECK_SCHEMA = z
  .object({
    deckId: z.string().min(1).max(256),
    subject: z.enum(WRONG_QUESTION_ORGANIZER_SUBJECTS),
    name: z.string(),
    nameLocked: z.boolean(),
    keywords: z.array(z.string()).max(20),
    safety: SAFETY_STATE_SCHEMA,
  })
  .strict();
const WRONG_QUESTION_ORGANIZER_PROJECTION_SOURCE_SCHEMA = z
  .object({
    questions: z.array(SOURCE_QUESTION_SCHEMA).min(1).max(12),
    existingDecks: z.array(SOURCE_DECK_SCHEMA).max(20),
  })
  .strict();

type OrganizerProjectionSource = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_PROJECTION_SOURCE_SCHEMA
>;

export type WrongQuestionOrganizerModelProjection = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION;
  questions: readonly Readonly<{
    ordinal: `q${number}`;
    subjectHint: WrongQuestionOrganizerSubject | 'unknown';
    category?: string;
    knowledgePoints: readonly string[];
    errorType?: string;
    questionExcerpt?: string;
    analysisExcerpt?: string;
  }>[];
  decks: readonly Readonly<{
    ordinal: `d${number}`;
    subject: WrongQuestionOrganizerSubject;
    name: string;
    keywords: readonly string[];
  }>[];
}>;

export type WrongQuestionOrganizerProjectionReasonCode =
  | ModelProjectionSafetyReasonCode
  | 'unsafe_metadata'
  | 'no_safe_projection'
  | 'no_semantic_text'
  | 'input_budget_exceeded';

export type WrongQuestionOrganizerProjectionResult =
  | { ok: true; value: WrongQuestionOrganizerModelProjection }
  | { ok: false; reasonCode: WrongQuestionOrganizerProjectionReasonCode };

export type InternalWrongQuestionOrganizerProjectionResult =
  | {
      ok: true;
      value: WrongQuestionOrganizerModelProjection;
      questionIdsByOrdinal: readonly string[];
      deckIdsByOrdinal: readonly string[];
    }
  | { ok: false; reasonCode: WrongQuestionOrganizerProjectionReasonCode };

type PreparedQuestion = Readonly<{
  questionId: string;
  subjectHint: WrongQuestionOrganizerSubject | 'unknown';
  category?: string;
  knowledgePoints: readonly string[];
  errorType?: string;
  questionText?: string;
  analysis?: string;
}>;

type PreparedDeck = Readonly<{
  deckId: string;
  subject: WrongQuestionOrganizerSubject;
  name: string;
  keywords: readonly string[];
}>;

export function projectWrongQuestionOrganizerSnapshot(
  input: unknown,
): WrongQuestionOrganizerProjectionResult {
  const projected = projectWrongQuestionOrganizerSnapshotForCandidate(input);
  return projected.ok
    ? { ok: true, value: projected.value }
    : { ok: false, reasonCode: projected.reasonCode };
}

/** @internal Only the local candidate/merger boundary may retain ordinal-to-ID maps. */
export function projectWrongQuestionOrganizerSnapshotForCandidate(
  input: unknown,
): InternalWrongQuestionOrganizerProjectionResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = WRONG_QUESTION_ORGANIZER_PROJECTION_SOURCE_SCHEMA.safeParse(cloned.value);
    if (!parsed.success || !sourceAssociationsAreValid(parsed.data)) {
      return { ok: false, reasonCode: 'invalid_input' };
    }

    const prepared = prepareCompleteSource(parsed.data);
    if (!prepared.ok) return prepared;

    const projection = buildProjection(prepared.questions, prepared.decks);
    if (estimateCandidateInputTokens([JSON.stringify(projection)]) > MAX_PROJECTED_INPUT_TOKENS) {
      return { ok: false, reasonCode: 'input_budget_exceeded' };
    }

    return {
      ok: true,
      value: deepFreezeModelValue(projection),
      questionIdsByOrdinal: deepFreezeModelValue(
        prepared.questions.map((question) => question.questionId),
      ),
      deckIdsByOrdinal: deepFreezeModelValue(prepared.decks.map((deck) => deck.deckId)),
    };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}

function prepareCompleteSource(
  source: OrganizerProjectionSource,
):
  | { ok: true; questions: readonly PreparedQuestion[]; decks: readonly PreparedDeck[] }
  | { ok: false; reasonCode: WrongQuestionOrganizerProjectionReasonCode } {
  let firstFailure: WrongQuestionOrganizerProjectionReasonCode | undefined;
  const preparedQuestions: PreparedQuestion[] = [];

  for (const question of source.questions) {
    const fields = {
      subject: scanNullableField(question.subject),
      category: scanNullableField(question.category),
      errorType: scanNullableField(question.errorType),
      questionText: scanNullableField(question.questionText),
      analysis: scanNullableField(question.analysis),
      answer: scanNullableField(question.answer),
      userNote: scanNullableField(question.userNote),
    };
    const knowledgePoints = question.knowledgePoints.map((value) => scanRequiredField(value));

    for (const result of [...Object.values(fields), ...knowledgePoints]) {
      if (!result.ok) firstFailure ??= result.reasonCode;
    }
    if (question.safety !== 'safe_for_model') firstFailure ??= 'unsafe_metadata';

    if (
      fields.subject.ok &&
      ((Boolean(fields.subject.value) && question.subjectHint === 'unknown') ||
        (!fields.subject.value && question.subjectHint !== 'unknown'))
    ) {
      firstFailure ??= 'invalid_input';
    }
    if (
      fields.questionText.ok &&
      fields.analysis.ok &&
      !fields.questionText.value &&
      !fields.analysis.value
    ) {
      firstFailure ??= 'no_semantic_text';
    }

    if (
      Object.values(fields).every((result) => result.ok) &&
      knowledgePoints.every((result) => result.ok)
    ) {
      preparedQuestions.push({
        questionId: question.questionId,
        subjectHint: question.subjectHint,
        category: fields.category.ok ? fields.category.value || undefined : undefined,
        knowledgePoints: knowledgePoints.flatMap((result) =>
          result.ok && result.value ? [result.value] : [],
        ),
        errorType: fields.errorType.ok ? fields.errorType.value || undefined : undefined,
        questionText: fields.questionText.ok
          ? fields.questionText.value || undefined
          : undefined,
        analysis: fields.analysis.ok ? fields.analysis.value || undefined : undefined,
      });
    }
  }

  const preparedDecks: PreparedDeck[] = [];
  for (const deck of source.existingDecks) {
    const name = scanRequiredField(deck.name);
    const keywords = deck.keywords.map((value) => scanRequiredField(value));
    if (!name.ok) firstFailure ??= name.reasonCode;
    for (const keyword of keywords) {
      if (!keyword.ok) firstFailure ??= keyword.reasonCode;
    }
    if (deck.safety !== 'safe_for_model') firstFailure ??= 'unsafe_metadata';
    if (name.ok && !name.value) firstFailure ??= 'no_safe_projection';

    if (name.ok && name.value && keywords.every((keyword) => keyword.ok)) {
      preparedDecks.push({
        deckId: deck.deckId,
        subject: deck.subject,
        name: name.value,
        keywords: keywords.flatMap((keyword) =>
          keyword.ok && keyword.value ? [keyword.value] : [],
        ),
      });
    }
  }

  if (firstFailure !== undefined) return { ok: false, reasonCode: firstFailure };
  if (preparedQuestions.length === 0) {
    return { ok: false, reasonCode: 'no_safe_projection' };
  }
  return { ok: true, questions: preparedQuestions, decks: preparedDecks };
}

function scanNullableField(value: string | null) {
  return value === null
    ? ({ ok: true, value: '' } as const)
    : scanRequiredField(value);
}

function scanRequiredField(value: string) {
  return scanCompleteModelField(value, {
    maxUtf16CodeUnits: MAX_FIELD_UTF16,
    rejectToolOrWriteInstruction: true,
  });
}

function sourceAssociationsAreValid(source: OrganizerProjectionSource): boolean {
  const questionIds = new Set<string>();
  for (const question of source.questions) {
    if (questionIds.has(question.questionId)) return false;
    questionIds.add(question.questionId);
  }
  const deckIds = new Set<string>();
  for (const deck of source.existingDecks) {
    if (deckIds.has(deck.deckId)) return false;
    deckIds.add(deck.deckId);
  }
  return true;
}

function buildProjection(
  questions: readonly PreparedQuestion[],
  decks: readonly PreparedDeck[],
): WrongQuestionOrganizerModelProjection {
  return {
    version: WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION,
    questions: questions.map((question, index) => ({
      ordinal: `q${index}` as const,
      subjectHint: question.subjectHint,
      ...(question.category
        ? {
            category: truncateUnicodeScalars(
              question.category,
              MAX_STRUCTURED_LABEL_SCALARS,
            ),
          }
        : {}),
      knowledgePoints: question.knowledgePoints
        .slice(0, MAX_PROJECTED_KNOWLEDGE_POINTS)
        .map((value) => truncateUnicodeScalars(value, MAX_STRUCTURED_LABEL_SCALARS)),
      ...(question.errorType
        ? {
            errorType: truncateUnicodeScalars(
              question.errorType,
              MAX_STRUCTURED_LABEL_SCALARS,
            ),
          }
        : {}),
      ...(question.questionText
        ? {
            questionExcerpt: truncateUnicodeScalars(
              question.questionText,
              MAX_QUESTION_EXCERPT_SCALARS,
            ),
          }
        : {}),
      ...(question.analysis
        ? {
            analysisExcerpt: truncateUnicodeScalars(
              question.analysis,
              MAX_ANALYSIS_EXCERPT_SCALARS,
            ),
          }
        : {}),
    })),
    decks: decks.map((deck, index) => ({
      ordinal: `d${index}` as const,
      subject: deck.subject,
      name: truncateUnicodeScalars(deck.name, MAX_DECK_NAME_SCALARS),
      keywords: deck.keywords
        .slice(0, MAX_PROJECTED_DECK_KEYWORDS)
        .map((value) => truncateUnicodeScalars(value, MAX_DECK_KEYWORD_SCALARS)),
    })),
  };
}
