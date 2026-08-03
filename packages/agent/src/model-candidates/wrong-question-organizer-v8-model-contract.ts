import { createHash } from 'node:crypto';

import { z } from 'zod';

import { WRONG_QUESTION_ORGANIZER_DECISION_POLICY } from '../policies/wrong-question-organizer-policy.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5Subject,
} from './wrong-question-organizer-v5-shortlist.ts';
import type { WrongQuestionOrganizerV6ValidatedDecision } from './wrong-question-organizer-v6-model-contract.ts';

export const WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION =
  'wrong-question-organizer-model-candidate-v8' as const;

export const WRONG_QUESTION_ORGANIZER_V8_DECK_ACTIONS = ['reuse_existing', 'create_topic'] as const;

export const WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA = z
  .object({
    shortlistFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    decisions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(11),
            subjectIndex: z.number().int().min(0).max(5).nullable(),
            deckAction: z.enum(WRONG_QUESTION_ORGANIZER_V8_DECK_ACTIONS),
            targetIndex: z.number().int().min(0).max(19),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export type WrongQuestionOrganizerV8ModelDecision = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA
>;

export type WrongQuestionOrganizerV8DecisionFailureCode =
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

export type WrongQuestionOrganizerV8DecisionValidationResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV6ValidatedDecision }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV8DecisionFailureCode }>;

const FIXED_SHAPE_CONTRACT_SOURCE = deepFreezeModelValue({
  version: 'wrong-question-organizer-v8-fixed-shape-contract-v1',
  topLevelExactKeys: ['shortlistFingerprint', 'decisions'],
  fingerprint: 'sha256:<64 lowercase hex>',
  decisions: {
    min: 1,
    max: 12,
    exactKeys: ['questionIndex', 'subjectIndex', 'deckAction', 'targetIndex'],
    questionIndex: { type: 'json_number_safe_integer', min: 0, max: 11 },
    subjectIndex: { type: 'json_null_or_safe_integer', min: 0, max: 5 },
    deckAction: WRONG_QUESTION_ORGANIZER_V8_DECK_ACTIONS,
    targetIndex: { type: 'json_number_safe_integer', min: 0, max: 19 },
  },
  interpretation: {
    structuredSubject: 'subjectIndex must be null; local subject remains authoritative',
    taxonomySubject: 'subjectIndex selects only the question-scoped exposed subject ordinal',
    reuseExisting: 'targetIndex selects only an exposed same-subject deck ordinal',
    createTopic: 'targetIndex selects only a question-scoped same-subject topic ordinal',
  },
});

export const WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256 = sha256Canonical(
  FIXED_SHAPE_CONTRACT_SOURCE,
);
export const WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256 =
  'b21a6dd357ecc19e87869541c7ae6cb52adff130ce32173fd8422ad2f6506545' as const;

const PROMPT_POLICY_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION,
  fixedShapeContractSha256: WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256,
  exactOutput:
    '{shortlistFingerprint,decisions:[{questionIndex,subjectIndex,deckAction,targetIndex}]}',
  rules: {
    complete: 'return exactly one decision for every projected questionIndex',
    fingerprint: 'echo shortlistFingerprint exactly',
    subject:
      'always include subjectIndex; use JSON null for structured subject, otherwise a supplied JSON-number ordinal',
    target:
      'reuse_existing resolves targetIndex as deck ordinal; create_topic resolves targetIndex as topic ordinal',
    types: 'numbers are JSON numbers; no numeric strings or coercion',
    exactKeys: 'no wrapper, snake_case, markdown, prose, or extra fields',
  },
  subjectTaxonomy: WRONG_QUESTION_ORGANIZER_DECISION_POLICY.subjectTaxonomy,
  localAuthority:
    'confidence, identifiers, names, owner snapshot, stale fences, trace admission, and writes stay local',
  forbidden:
    'free subject, free deck name, free topic label, identifier, confidence, evidence, answer, route, tool, permission, write command',
});

export const WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256 =
  sha256Canonical(PROMPT_POLICY_SOURCE);
export const WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256 =
  '9b85b0a9a310f128d35250e83b3927df8de87f159dac8aac8f412d1189ca6af9' as const;

if (
  WRONG_QUESTION_ORGANIZER_V8_FIXED_SHAPE_CONTRACT_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V8_FROZEN_FIXED_SHAPE_CONTRACT_SHA256 ||
  WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V8_FROZEN_MODEL_PROMPT_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V8_CONTRACT_SHA_MISMATCH');
}

export function formatWrongQuestionOrganizerV8ModelPolicyForPrompt() {
  return [
    `policyVersion=${WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION}`,
    'Return only exact JSON keys shortlistFingerprint,decisions; every decision has exactly questionIndex,subjectIndex,deckAction,targetIndex.',
    'Echo the fingerprint and return one decision per projected questionIndex.',
    'subjectIndex:null is required for structuredSubject; otherwise use one exposed JSON-number ordinal.',
    'reuse_existing targetIndex means same-subject deck; create_topic targetIndex means same-subject topic.',
    'Numbers must be JSON numbers, never strings. No markdown, prose, wrapper, snake_case, extra field, free label, identifier, confidence, evidence, answer, route, tool, permission, or write command.',
    'Example: {"shortlistFingerprint":"sha256:0000000000000000000000000000000000000000000000000000000000000000","decisions":[{"questionIndex":0,"subjectIndex":null,"deckAction":"reuse_existing","targetIndex":0}]}',
    'Subject taxonomy:',
    ...WRONG_QUESTION_ORGANIZER_DECISION_POLICY.subjectTaxonomy.map(
      (entry) => `- ${entry.subject}: ${entry.guidance}.`,
    ),
  ].join('\n');
}

export const WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT = [
  'Select only bounded WrongQuestionOrganizer ordinals from the supplied JSON.',
  formatWrongQuestionOrganizerV8ModelPolicyForPrompt(),
].join('\n');

export function validateWrongQuestionOrganizerV8ModelDecision(
  input: Readonly<{
    decision: unknown;
    authority: WrongQuestionOrganizerV5ShortlistAuthority;
  }>,
): WrongQuestionOrganizerV8DecisionValidationResult {
  try {
    const authority = validateWrongQuestionOrganizerV5Shortlist(input.authority);
    if (!authority.ok) return { ok: false, reasonCode: 'authority_invalid' };
    const cloned = clonePlainModelData(input.decision);
    if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
    const parsed = WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
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
      const subject = resolveSubject(entry.subjectIndex, question);
      if (!subject.ok) return subject;
      if (!question.eligibleDeckActions.includes(entry.deckAction)) {
        return { ok: false, reasonCode: 'deck_action_not_eligible' };
      }

      const subjectDecision =
        entry.subjectIndex === null
          ? ({ action: 'keep_local' } as const)
          : ({ action: 'select_subject', subjectIndex: entry.subjectIndex } as const);
      const deckDecision =
        entry.deckAction === 'reuse_existing'
          ? ({ action: 'reuse_existing', deckIndex: entry.targetIndex } as const)
          : ({ action: 'create_topic', topicIndex: entry.targetIndex } as const);

      if (deckDecision.action === 'reuse_existing') {
        const deck = authority.value.decks[deckDecision.deckIndex];
        if (!deck) return { ok: false, reasonCode: 'deck_index_out_of_range' };
        if (deck.subject !== subject.value) {
          return { ok: false, reasonCode: 'cross_subject_deck' };
        }
      } else {
        const topic = question.topicCandidates[deckDecision.topicIndex];
        if (!topic) return { ok: false, reasonCode: 'topic_index_out_of_range' };
        if (topic.subject !== subject.value) {
          return { ok: false, reasonCode: 'cross_subject_topic' };
        }
      }

      validated.push({
        questionIndex: entry.questionIndex,
        resolvedSubject: subject.value,
        subjectDecision,
        deckDecision,
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

export function convertWrongQuestionOrganizerV8DecisionToV6Shape(
  decision: WrongQuestionOrganizerV8ModelDecision,
) {
  return {
    shortlistFingerprint: decision.shortlistFingerprint,
    decisions: decision.decisions.map((entry) => ({
      questionIndex: entry.questionIndex,
      subjectDecision:
        entry.subjectIndex === null
          ? ({ action: 'keep_local' } as const)
          : ({ action: 'select_subject', subjectIndex: entry.subjectIndex } as const),
      deckDecision:
        entry.deckAction === 'reuse_existing'
          ? ({ action: 'reuse_existing', deckIndex: entry.targetIndex } as const)
          : ({ action: 'create_topic', topicIndex: entry.targetIndex } as const),
    })),
  };
}

function resolveSubject(
  subjectIndex: number | null,
  question: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number],
):
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV5Subject }>
  | Readonly<{
      ok: false;
      reasonCode: 'subject_authority_violation' | 'subject_index_out_of_range';
    }> {
  if (question.structuredSubject !== null) {
    return subjectIndex === null
      ? { ok: true, value: question.structuredSubject }
      : { ok: false, reasonCode: 'subject_authority_violation' };
  }
  if (subjectIndex === null) {
    return { ok: false, reasonCode: 'subject_authority_violation' };
  }
  const subject = question.subjectCandidates[subjectIndex];
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
