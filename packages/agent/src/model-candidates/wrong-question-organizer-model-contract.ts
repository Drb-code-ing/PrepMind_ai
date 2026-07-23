import { z } from 'zod';

import { clonePlainModelData, scanCompleteModelField } from './model-projection-safety.ts';

export const WRONG_QUESTION_ORGANIZER_SUBJECTS = [
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
] as const;

export const WRONG_QUESTION_ORGANIZER_MODEL_SUBJECTS = [
  'keep_local',
  ...WRONG_QUESTION_ORGANIZER_SUBJECTS,
] as const;

export const WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES = [
  'structured_subject',
  'semantic_topic',
  'existing_deck_overlap',
  'error_pattern',
  'insufficient_signal',
] as const;

const SAFE_TOPIC_LABEL_PATTERN = /^[\p{L}\p{N} ·()（）_-]+$/u;
const TOPIC_LABEL_SCHEMA = z
  .string()
  .regex(SAFE_TOPIC_LABEL_PATTERN)
  .superRefine((value, context) => {
    const scalarLength = Array.from(value).length;
    if (scalarLength < 2 || scalarLength > 24) {
      context.addIssue({ code: 'custom', message: 'topic label scalar length out of range' });
    }
  });
const EVIDENCE_CODES_SCHEMA = z
  .array(z.enum(WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES))
  .min(1)
  .max(5)
  .superRefine((codes, context) => {
    if (new Set(codes).size !== codes.length) {
      context.addIssue({ code: 'custom', message: 'duplicate evidence code' });
    }
  });

const REUSE_EXISTING_DECK_SCHEMA = z
  .object({
    action: z.literal('reuse_existing'),
    deckIndex: z.number().int().min(0).max(19),
  })
  .strict();
const CREATE_TOPIC_DECK_SCHEMA = z
  .object({
    action: z.literal('create_topic'),
    topicLabel: TOPIC_LABEL_SCHEMA,
  })
  .strict();

const WRONG_QUESTION_ORGANIZER_DECISION_SCHEMA = z
  .object({
    questionIndex: z.number().int().min(0).max(11),
    subject: z.enum(WRONG_QUESTION_ORGANIZER_MODEL_SUBJECTS),
    deck: z.discriminatedUnion('action', [
      REUSE_EXISTING_DECK_SCHEMA,
      CREATE_TOPIC_DECK_SCHEMA,
    ]),
    confidence: z.enum(['medium', 'high']),
    evidenceCodes: EVIDENCE_CODES_SCHEMA,
  })
  .strict();

export const WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA = z
  .object({
    decisions: z.array(WRONG_QUESTION_ORGANIZER_DECISION_SCHEMA).min(1).max(12),
  })
  .strict();

const WRONG_QUESTION_ORGANIZER_DECISION_CONTEXT_SCHEMA = z
  .object({
    questions: z
      .array(
        z
          .object({
            subjectHint: z.enum([...WRONG_QUESTION_ORGANIZER_SUBJECTS, 'unknown']),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    decks: z
      .array(
        z
          .object({
            subject: z.enum(WRONG_QUESTION_ORGANIZER_SUBJECTS),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type WrongQuestionOrganizerSubject = (typeof WRONG_QUESTION_ORGANIZER_SUBJECTS)[number];
export type WrongQuestionOrganizerModelDecision = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA
>;

export type WrongQuestionOrganizerDecisionContext = Readonly<{
  questions: readonly Readonly<{
    subjectHint: WrongQuestionOrganizerSubject | 'unknown';
  }>[];
  decks: readonly Readonly<{
    subject: WrongQuestionOrganizerSubject;
  }>[];
}>;

export type WrongQuestionOrganizerDecisionReasonCode =
  | 'schema_invalid'
  | 'context_invalid'
  | 'question_count_mismatch'
  | 'duplicate_question_index'
  | 'question_index_out_of_range'
  | 'subject_authority_violation'
  | 'deck_index_out_of_range'
  | 'cross_subject_deck'
  | 'unsafe_topic_label'
  | 'invalid_evidence_association';

export type WrongQuestionOrganizerDecisionValidationResult =
  | { ok: true; value: WrongQuestionOrganizerModelDecision }
  | { ok: false; reasonCode: WrongQuestionOrganizerDecisionReasonCode };

export function validateWrongQuestionOrganizerModelDecision(
  input: unknown,
  context: WrongQuestionOrganizerDecisionContext,
): WrongQuestionOrganizerDecisionValidationResult {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
  const parsed = WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const clonedContext = clonePlainModelData(context);
  if (!clonedContext.ok) return { ok: false, reasonCode: 'context_invalid' };
  const parsedContext = WRONG_QUESTION_ORGANIZER_DECISION_CONTEXT_SCHEMA.safeParse(
    clonedContext.value,
  );
  if (!parsedContext.success) {
    return { ok: false, reasonCode: 'context_invalid' };
  }
  const safeContext = parsedContext.data;

  const seen = new Set<number>();
  for (const decision of parsed.data.decisions) {
    if (decision.questionIndex >= safeContext.questions.length) {
      return { ok: false, reasonCode: 'question_index_out_of_range' };
    }
    if (seen.has(decision.questionIndex)) {
      return { ok: false, reasonCode: 'duplicate_question_index' };
    }
    seen.add(decision.questionIndex);
  }
  if (parsed.data.decisions.length !== safeContext.questions.length) {
    return { ok: false, reasonCode: 'question_count_mismatch' };
  }

  for (const decision of parsed.data.decisions) {
    const question = safeContext.questions[decision.questionIndex];
    if (question === undefined) {
      return { ok: false, reasonCode: 'question_index_out_of_range' };
    }
    if (
      (question.subjectHint === 'unknown' && decision.subject === 'keep_local') ||
      (question.subjectHint !== 'unknown' && decision.subject !== 'keep_local')
    ) {
      return { ok: false, reasonCode: 'subject_authority_violation' };
    }

    const resolvedSubject =
      decision.subject === 'keep_local' ? question.subjectHint : decision.subject;
    if (resolvedSubject === 'unknown') {
      return { ok: false, reasonCode: 'subject_authority_violation' };
    }

    if (decision.deck.action === 'reuse_existing') {
      const deck = safeContext.decks[decision.deck.deckIndex];
      if (deck === undefined) {
        return { ok: false, reasonCode: 'deck_index_out_of_range' };
      }
      if (deck.subject !== resolvedSubject) {
        return { ok: false, reasonCode: 'cross_subject_deck' };
      }
    } else if (!topicLabelIsSafe(decision.deck.topicLabel)) {
      return { ok: false, reasonCode: 'unsafe_topic_label' };
    }

    if (!evidenceAssociationIsValid(decision)) {
      return { ok: false, reasonCode: 'invalid_evidence_association' };
    }
  }

  return { ok: true, value: parsed.data };
}

function topicLabelIsSafe(value: string): boolean {
  const canonical = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (canonical !== value) return false;
  if (/https?:\/\/|www\.|<[^>]+>|[*`#\[\]{}]|api\s*key|access\s*token|password|密钥|密码/iu.test(value)) {
    return false;
  }
  if (new Set(['未分类', '未分类错题', '其他', 'other', 'default', 'uncategorized']).has(value.toLowerCase())) {
    return false;
  }
  return scanCompleteModelField(value, {
    maxUtf16CodeUnits: 24,
    rejectToolOrWriteInstruction: true,
  }).ok;
}

function evidenceAssociationIsValid(
  decision: WrongQuestionOrganizerModelDecision['decisions'][number],
): boolean {
  const evidence = new Set(decision.evidenceCodes);
  if (decision.confidence === 'high' && evidence.has('insufficient_signal')) return false;
  if (decision.subject === 'keep_local' && !evidence.has('structured_subject')) return false;
  if (decision.deck.action === 'reuse_existing') {
    return evidence.has('existing_deck_overlap');
  }
  return (
    evidence.has('semantic_topic') ||
    evidence.has('error_pattern') ||
    evidence.has('insufficient_signal')
  );
}
