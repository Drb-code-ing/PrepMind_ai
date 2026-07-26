import { deepFreezeModelValue } from './model-projection-safety.ts';
import {
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
} from './wrong-question-organizer-v5-shortlist.ts';

export const WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION =
  'wrong-question-organizer-model-projection-v5' as const;

export type WrongQuestionOrganizerV5ModelProjection = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION;
  shortlistFingerprint: string;
  questions: readonly Readonly<{
    questionIndex: number;
    subjectAuthority:
      | Readonly<{ mode: 'keep_local'; subject: string }>
      | Readonly<{
          mode: 'select_subject';
          candidates: readonly Readonly<{ subjectIndex: number; subject: string }>[];
        }>;
    eligibleDeckActions: readonly ('reuse_existing' | 'create_topic')[];
    topicCandidates: readonly Readonly<{
      topicIndex: number;
      label: string;
      subject: string;
      source: string;
    }>[];
    fields: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number]['projected'];
  }>[];
  decks: readonly Readonly<{
    deckIndex: number;
    subject: string;
    name: string;
    nameLocked: boolean;
    keywords: readonly string[];
  }>[];
}>;

export type WrongQuestionOrganizerV5ProjectionResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV5ModelProjection }>
  | Readonly<{ ok: false; reasonCode: 'authority_invalid' }>;

export function projectWrongQuestionOrganizerV5ModelInput(
  input: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV5ProjectionResult {
  const authority = validateWrongQuestionOrganizerV5Shortlist(input);
  if (!authority.ok) return { ok: false, reasonCode: 'authority_invalid' };
  return {
    ok: true,
    value: deepFreezeModelValue({
      version: WRONG_QUESTION_ORGANIZER_V5_MODEL_PROJECTION_VERSION,
      shortlistFingerprint: authority.value.shortlistFingerprint,
      questions: authority.value.questions.map((question) => ({
        questionIndex: question.questionIndex,
        subjectAuthority:
          question.structuredSubject === null
            ? {
                mode: 'select_subject' as const,
                candidates: question.subjectCandidates.map((subject, subjectIndex) => ({
                  subjectIndex,
                  subject,
                })),
              }
            : { mode: 'keep_local' as const, subject: question.structuredSubject },
        eligibleDeckActions: [...question.eligibleDeckActions],
        topicCandidates: question.topicCandidates.map((topic) => ({
          topicIndex: topic.topicIndex,
          label: topic.label,
          subject: topic.subject,
          source: topic.source,
        })),
        fields: { ...question.projected },
      })),
      decks: authority.value.decks.map((deck) => ({
        deckIndex: deck.deckIndex,
        subject: deck.subject,
        name: deck.name,
        nameLocked: deck.nameLocked,
        keywords: [...deck.keywords],
      })),
    }),
  };
}
