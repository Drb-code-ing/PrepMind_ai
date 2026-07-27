import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  clonePlainModelData,
  deepFreezeModelValue,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';

export const WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION =
  'wrong-question-organizer-confidence-authority-v1' as const;
export const WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_VERSION =
  'wrong-question-organizer-confidence-rules-v1' as const;

export const WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_EVIDENCE_CODES = [
  'structured_subject',
  'knowledge_point',
  'category',
  'error_type',
  'same_subject_deck_overlap',
  'bounded_topic_provenance',
] as const;

const SUBJECTS = ['math', 'english', 'politics', 'computer', 'major', 'other'] as const;
const TOPIC_SOURCES = [
  'structured_category',
  'structured_knowledge_point',
  'existing_deck',
  'question_semantic',
  'category',
  'knowledge_point',
  'error_type',
] as const;

const WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULE_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_VERSION,
  highWhenAny: [
    'knowledge_point_present',
    'category_present',
    'error_type_present',
    'same_subject_deck_direct_overlap',
  ],
  mediumOtherwise: 'valid_bounded_selection',
  structuredSubjectPolicy: 'authority_binding_not_high_by_itself',
  staleOrCrossSubjectPolicy: 'fail_closed',
  modelConfidencePolicy: 'ignored_for_final_authority',
});

export const WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256 = sha256Canonical(
  WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULE_SOURCE,
);
export const WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256 =
  'a46eda402e8c39cdc965277375e8a2aeea27e41c98cda7fd4ba513a9cb520475' as const;

if (
  WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256 !==
  WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA_MISMATCH');
}

export type WrongQuestionOrganizerV6ConfidenceAuthority = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION;
  rulesVersion: typeof WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_VERSION;
  rulesSha256: string;
  input: Readonly<{
    shortlistFingerprint: string;
    snapshotStable: true;
    questionIndex: number;
    resolvedSubject: (typeof SUBJECTS)[number];
    structuredSubject: (typeof SUBJECTS)[number] | null;
    knowledgePointCount: number;
    categoryPresent: boolean;
    errorTypePresent: boolean;
    deckDecision:
      | Readonly<{
          action: 'reuse_existing';
          deckIndex: number;
          targetSubject: (typeof SUBJECTS)[number];
          directTopicOverlap: boolean;
        }>
      | Readonly<{
          action: 'create_topic';
          topicIndex: number;
          targetSubject: (typeof SUBJECTS)[number];
          topicSource: (typeof TOPIC_SOURCES)[number];
        }>;
  }>;
  confidence: 'medium' | 'high';
  evidenceCodes: readonly (typeof WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_EVIDENCE_CODES)[number][];
  authoritySha256: string;
}>;

export type WrongQuestionOrganizerV6ConfidenceFailureCode =
  | ModelProjectionSafetyReasonCode
  | 'stale_snapshot'
  | 'subject_authority_violation'
  | 'target_authority_violation'
  | 'authority_contract_invalid';

export type WrongQuestionOrganizerV6ConfidenceResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV6ConfidenceAuthority }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV6ConfidenceFailureCode }>;

const DECK_DECISION_SCHEMA = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('reuse_existing'),
      deckIndex: z.number().int().min(0).max(19),
      targetSubject: z.enum(SUBJECTS),
      directTopicOverlap: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal('create_topic'),
      topicIndex: z.number().int().min(0).max(7),
      targetSubject: z.enum(SUBJECTS),
      topicSource: z.enum(TOPIC_SOURCES),
    })
    .strict(),
]);

const AUTHORITY_INPUT_SCHEMA = z
  .object({
    shortlistFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    snapshotStable: z.boolean(),
    questionIndex: z.number().int().min(0).max(11),
    resolvedSubject: z.enum(SUBJECTS),
    structuredSubject: z.enum(SUBJECTS).nullable(),
    knowledgePointCount: z.number().int().min(0).max(32),
    categoryPresent: z.boolean(),
    errorTypePresent: z.boolean(),
    deckDecision: DECK_DECISION_SCHEMA,
  })
  .strict();

export function deriveWrongQuestionOrganizerV6ConfidenceAuthority(
  input: unknown,
): WrongQuestionOrganizerV6ConfidenceResult {
  const derived = deriveWithoutValidation(input);
  if (!derived.ok) return derived;
  const validated = validateWrongQuestionOrganizerV6ConfidenceAuthority(derived.value);
  return validated.ok ? derived : { ok: false, reasonCode: 'authority_contract_invalid' };
}

export function validateWrongQuestionOrganizerV6ConfidenceAuthority(
  input: unknown,
): WrongQuestionOrganizerV6ConfidenceResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok || typeof cloned.value !== 'object' || cloned.value === null) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    const candidate = cloned.value as Record<string, unknown>;
    if (
      candidate.version !== WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION ||
      candidate.rulesVersion !== WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_VERSION ||
      candidate.rulesSha256 !== WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256
    ) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    const rebuilt = deriveWithoutValidation(candidate.input);
    if (!rebuilt.ok || JSON.stringify(rebuilt.value) !== JSON.stringify(candidate)) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    return { ok: true, value: deepFreezeModelValue(rebuilt.value) };
  } catch {
    return { ok: false, reasonCode: 'authority_contract_invalid' };
  }
}

function deriveWithoutValidation(input: unknown): WrongQuestionOrganizerV6ConfidenceResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = AUTHORITY_INPUT_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    const source = parsed.data;
    if (!source.snapshotStable) return { ok: false, reasonCode: 'stale_snapshot' };
    if (source.structuredSubject !== null && source.structuredSubject !== source.resolvedSubject) {
      return { ok: false, reasonCode: 'subject_authority_violation' };
    }
    if (source.deckDecision.targetSubject !== source.resolvedSubject) {
      return { ok: false, reasonCode: 'target_authority_violation' };
    }

    const evidenceCodes: WrongQuestionOrganizerV6ConfidenceAuthority['evidenceCodes'][number][] =
      [];
    if (source.structuredSubject !== null) evidenceCodes.push('structured_subject');
    if (source.knowledgePointCount > 0) evidenceCodes.push('knowledge_point');
    if (source.categoryPresent) evidenceCodes.push('category');
    if (source.errorTypePresent) evidenceCodes.push('error_type');
    if (source.deckDecision.action === 'reuse_existing' && source.deckDecision.directTopicOverlap) {
      evidenceCodes.push('same_subject_deck_overlap');
    }
    if (source.deckDecision.action === 'create_topic') {
      evidenceCodes.push('bounded_topic_provenance');
    }
    const confidence =
      source.knowledgePointCount > 0 ||
      source.categoryPresent ||
      source.errorTypePresent ||
      (source.deckDecision.action === 'reuse_existing' && source.deckDecision.directTopicOverlap)
        ? ('high' as const)
        : ('medium' as const);
    const withoutHash = {
      version: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_AUTHORITY_VERSION,
      rulesVersion: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_VERSION,
      rulesSha256: WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256,
      input: {
        ...source,
        snapshotStable: true as const,
      },
      confidence,
      evidenceCodes,
    };
    return {
      ok: true,
      value: deepFreezeModelValue({
        ...withoutHash,
        authoritySha256: sha256Canonical(withoutHash),
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'authority_contract_invalid' };
  }
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
