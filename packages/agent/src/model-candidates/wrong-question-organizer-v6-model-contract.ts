import { createHash } from 'node:crypto';

import { z } from 'zod';

import { WRONG_QUESTION_ORGANIZER_DECISION_POLICY } from '../policies/wrong-question-organizer-policy.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5Subject,
} from './wrong-question-organizer-v5-shortlist.ts';

export const WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION =
  'wrong-question-organizer-model-candidate-v6' as const;

const SUBJECT_DECISION_SCHEMA = z.discriminatedUnion('action', [
  z.object({ action: z.literal('keep_local') }).strict(),
  z
    .object({
      action: z.literal('select_subject'),
      subjectIndex: z.number().int().min(0).max(5),
    })
    .strict(),
]);

const DECK_DECISION_SCHEMA = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('reuse_existing'),
      deckIndex: z.number().int().min(0).max(19),
    })
    .strict(),
  z
    .object({
      action: z.literal('create_topic'),
      topicIndex: z.number().int().min(0).max(7),
    })
    .strict(),
]);

export const WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA = z
  .object({
    shortlistFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    decisions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(11),
            subjectDecision: SUBJECT_DECISION_SCHEMA,
            deckDecision: DECK_DECISION_SCHEMA,
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export type WrongQuestionOrganizerV6ModelDecision = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA
>;

export type WrongQuestionOrganizerV6ValidatedDecision = Readonly<{
  shortlistFingerprint: string;
  decisions: readonly Readonly<{
    questionIndex: number;
    resolvedSubject: WrongQuestionOrganizerV5Subject;
    subjectDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['subjectDecision'];
    deckDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['deckDecision'];
  }>[];
}>;

export type WrongQuestionOrganizerV6DecisionFailureCode =
  | 'schema_invalid'
  | 'authority_invalid'
  | 'shortlist_fingerprint_mismatch'
  | 'question_count_mismatch'
  | 'duplicate_question_index'
  | 'question_index_out_of_range'
  | 'subject_authority_violation'
  | 'subject_index_out_of_range'
  | 'deck_action_not_eligible'
  | 'deck_index_out_of_range'
  | 'cross_subject_deck'
  | 'topic_index_out_of_range'
  | 'cross_subject_topic';

export type WrongQuestionOrganizerV6DecisionValidationResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV6ValidatedDecision }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV6DecisionFailureCode }>;

const PROMPT_POLICY_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
  outputAuthority: {
    allowedFields: 'shortlistFingerprint,decisions(questionIndex,subjectDecision,deckDecision)',
    forbidden:
      'confidence,free subject,free deck name,free topic label,evidence code,identifier,write command,answer,route,tool',
  },
  subjectAuthority: {
    structured: 'keep_local only',
    taxonomy: 'select only subjectIndex exposed for that question',
    definitions: WRONG_QUESTION_ORGANIZER_DECISION_POLICY.subjectTaxonomy,
  },
  deckAuthority: {
    reuse: 'same resolved subject and exposed deckIndex only',
    create: 'same resolved subject and exposed topicIndex only',
    tieBreak:
      'structured signal, then knowledge point overlap, then category or error type, then generic topic',
    lockedName: 'never rename, replace, or recreate a locked local deck name',
  },
  localAuthority: 'confidence, identifiers, names, snapshot binding, and writes stay local',
  safety: 'classify only; no mutation, no retry, no free text output',
});

export const WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256 =
  sha256Canonical(PROMPT_POLICY_SOURCE);
export const WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256 =
  'c5f1f662ba380283aa08ffe2dc194874c9420b1c6b34ffc86107e476101f3450' as const;

if (
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256 !==
  WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA_MISMATCH');
}

export function formatWrongQuestionOrganizerV6ModelPolicyForPrompt() {
  return [
    `policyVersion=${WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION}`,
    `policySha256=${WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256}`,
    'Return exactly one decision for every projected questionIndex.',
    'Echo the supplied shortlistFingerprint exactly.',
    'For a structured subject return only {action:"keep_local"}; otherwise select one exposed subjectIndex.',
    'Choose only an exposed same-subject deckIndex or topicIndex.',
    'Prefer structured signal, then knowledge point overlap, then category or error type, then generic topic.',
    'Never output confidence, subject names, deck names, topic labels, evidence, identifiers, prose, answers, routes, tools, permissions, or write commands.',
    'Subject taxonomy:',
    ...WRONG_QUESTION_ORGANIZER_DECISION_POLICY.subjectTaxonomy.map(
      (entry) => `- ${entry.subject}: ${entry.guidance}.`,
    ),
    'computer means general CS, software, algorithms, networks, databases, or operating systems; major means a non-general-computer professional course. The boundary is identical in Chinese and English.',
  ].join('\n');
}

export function validateWrongQuestionOrganizerV6ModelDecision(
  input: Readonly<{
    decision: unknown;
    authority: WrongQuestionOrganizerV5ShortlistAuthority;
  }>,
): WrongQuestionOrganizerV6DecisionValidationResult {
  try {
    const authority = validateWrongQuestionOrganizerV5Shortlist(input.authority);
    if (!authority.ok) return { ok: false, reasonCode: 'authority_invalid' };
    const cloned = clonePlainModelData(input.decision);
    if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
    const parsed = WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };
    const decision = parsed.data;
    if (decision.shortlistFingerprint !== authority.value.shortlistFingerprint) {
      return { ok: false, reasonCode: 'shortlist_fingerprint_mismatch' };
    }
    if (decision.decisions.length !== authority.value.questions.length) {
      return { ok: false, reasonCode: 'question_count_mismatch' };
    }
    const indexes = decision.decisions.map((entry) => entry.questionIndex);
    if (new Set(indexes).size !== indexes.length) {
      return { ok: false, reasonCode: 'duplicate_question_index' };
    }

    const validated: WrongQuestionOrganizerV6ValidatedDecision['decisions'][number][] = [];
    for (const entry of decision.decisions) {
      const question = authority.value.questions[entry.questionIndex];
      if (!question) return { ok: false, reasonCode: 'question_index_out_of_range' };
      const resolvedSubject = resolveSubject(entry.subjectDecision, question);
      if (!resolvedSubject.ok) return resolvedSubject;
      if (!question.eligibleDeckActions.includes(entry.deckDecision.action)) {
        return { ok: false, reasonCode: 'deck_action_not_eligible' };
      }
      if (entry.deckDecision.action === 'reuse_existing') {
        const deck = authority.value.decks[entry.deckDecision.deckIndex];
        if (!deck) return { ok: false, reasonCode: 'deck_index_out_of_range' };
        if (deck.subject !== resolvedSubject.value) {
          return { ok: false, reasonCode: 'cross_subject_deck' };
        }
      } else {
        const topic = question.topicCandidates[entry.deckDecision.topicIndex];
        if (!topic) return { ok: false, reasonCode: 'topic_index_out_of_range' };
        if (topic.subject !== resolvedSubject.value) {
          return { ok: false, reasonCode: 'cross_subject_topic' };
        }
      }
      validated.push({
        questionIndex: entry.questionIndex,
        resolvedSubject: resolvedSubject.value,
        subjectDecision: entry.subjectDecision,
        deckDecision: entry.deckDecision,
      });
    }
    validated.sort((left, right) => left.questionIndex - right.questionIndex);
    return {
      ok: true,
      value: deepFreezeModelValue({
        shortlistFingerprint: decision.shortlistFingerprint,
        decisions: validated,
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'schema_invalid' };
  }
}

function resolveSubject(
  decision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['subjectDecision'],
  question: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number],
):
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV5Subject }>
  | Readonly<{
      ok: false;
      reasonCode: 'subject_authority_violation' | 'subject_index_out_of_range';
    }> {
  if (question.structuredSubject !== null) {
    return decision.action === 'keep_local'
      ? { ok: true, value: question.structuredSubject }
      : { ok: false, reasonCode: 'subject_authority_violation' };
  }
  if (decision.action !== 'select_subject') {
    return { ok: false, reasonCode: 'subject_authority_violation' };
  }
  const subject = question.subjectCandidates[decision.subjectIndex];
  return subject === undefined
    ? { ok: false, reasonCode: 'subject_index_out_of_range' }
    : { ok: true, value: subject };
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
