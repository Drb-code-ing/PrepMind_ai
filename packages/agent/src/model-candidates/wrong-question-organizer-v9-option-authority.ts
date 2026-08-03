import { createHash } from 'node:crypto';

import { deepFreezeModelValue, truncateUnicodeScalars } from './model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5Subject,
  type WrongQuestionOrganizerV5TopicSource,
} from './wrong-question-organizer-v5-shortlist.ts';
import {
  validateWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6ModelDecision,
} from './wrong-question-organizer-v6-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
  buildWrongQuestionOrganizerV9PromptParts,
  type WrongQuestionOrganizerV9ModelProjection,
} from './wrong-question-organizer-v9-model-projection.ts';

export const WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION =
  'wrong-question-organizer-option-authority-v9' as const;
export const WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION =
  'wrong-question-organizer-option-authority-rules-v1' as const;

const MAX_OPTIONS_PER_QUESTION = 24;
const MAX_OPTIONS_PER_REQUEST = 144;
const MAX_TARGET_LABEL_SCALARS = 80;

const OPTION_AUTHORITY_RULE_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
  source: {
    shortlistVersion: WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
    validator: 'validateWrongQuestionOrganizerV5Shortlist',
  },
  subject: {
    structured: 'keep_local only',
    taxonomy: 'question-scoped subjectCandidates only',
  },
  actions: {
    reuse: 'same resolved subject existing deck only',
    create: 'same resolved subject topic candidate only',
    duplicateTopic: 'exclude same-subject canonical existing deck collision',
    lockedName: 'exclude create collision; reuse keeps local locked name',
  },
  ordering: 'questionIndex,subjectOrdinal,actionRank,targetOrdinal',
  canonicalDedupe: 'resolvedSubject,subjectDecision,deckDecision',
  allocation: {
    mandatoryBucket: 'question,resolvedSubject,action',
    perQuestion: MAX_OPTIONS_PER_QUESTION,
    perRequest: MAX_OPTIONS_PER_REQUEST,
    inputTokens: WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
    optional: 'stable-fit-without-removing-mandatory-buckets',
  },
  validation: {
    everyOption: 'full V6 decision validation with local shortlist fingerprint',
    selection: 'option ordinal only; no clamp, repair, default, or partial batch',
  },
});

export const WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256 = sha256Canonical(
  OPTION_AUTHORITY_RULE_SOURCE,
);
export const WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256 =
  '1013c43950c4b351e5ffa77286ec732ef522b38a4f294dd507ecac7a42c28eec' as const;

if (
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256 !==
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA_MISMATCH');
}

export type WrongQuestionOrganizerV9Option = Readonly<{
  optionIndex: number;
  resolvedSubject: WrongQuestionOrganizerV5Subject;
  subjectDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['subjectDecision'];
  deckDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['deckDecision'];
  projection: Readonly<{
    optionIndex: number;
    subjectLabel: WrongQuestionOrganizerV5Subject;
    actionLabel: 'reuse_existing' | 'create_topic';
    sourceLabel: 'existing_deck' | WrongQuestionOrganizerV5TopicSource;
    targetLabel?: string;
  }>;
}>;

export type WrongQuestionOrganizerV9OptionAuthority = Readonly<{
  version: typeof WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION;
  rulesVersion: typeof WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION;
  rulesSha256: string;
  sourceShortlistFingerprint: string;
  optionSetFingerprint: string;
  provenance: 'local_deterministic';
  shortlistAuthority: WrongQuestionOrganizerV5ShortlistAuthority;
  questions: readonly Readonly<{
    questionIndex: number;
    options: readonly WrongQuestionOrganizerV9Option[];
  }>[];
  projection: WrongQuestionOrganizerV9ModelProjection;
  estimatedInputTokens: number;
}>;

export type WrongQuestionOrganizerV9OptionAuthorityFailureCode =
  | 'candidate_option_authority_empty'
  | 'candidate_option_authority_budget_exceeded'
  | 'candidate_option_authority_invalid';

export type WrongQuestionOrganizerV9OptionAuthorityResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV9OptionAuthority }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV9OptionAuthorityFailureCode }>;

type RawOption = Readonly<{
  questionIndex: number;
  subjectOrdinal: number;
  actionRank: number;
  targetOrdinal: number;
  resolvedSubject: WrongQuestionOrganizerV5Subject;
  subjectDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['subjectDecision'];
  deckDecision: WrongQuestionOrganizerV6ModelDecision['decisions'][number]['deckDecision'];
  sourceLabel: 'existing_deck' | WrongQuestionOrganizerV5TopicSource;
  targetLabel: string;
}>;

export function deriveWrongQuestionOrganizerV9OptionAuthority(
  input: unknown,
): WrongQuestionOrganizerV9OptionAuthorityResult {
  try {
    const validated = validateWrongQuestionOrganizerV5Shortlist(input);
    if (!validated.ok) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }
    const shortlistAuthority = validated.value;
    const rawByQuestion = shortlistAuthority.questions.map((question) =>
      enumerateQuestionOptions(shortlistAuthority, question.questionIndex),
    );
    if (rawByQuestion.some((options) => options.length === 0)) {
      return { ok: false, reasonCode: 'candidate_option_authority_empty' };
    }

    const allocated = allocateOptions(shortlistAuthority, rawByQuestion);
    if (!allocated.ok) return allocated;
    if (!everyOptionPassesV6(shortlistAuthority, allocated.questions)) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }

    const withoutFingerprint = {
      version: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
      rulesVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
      rulesSha256: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
      sourceShortlistFingerprint: shortlistAuthority.shortlistFingerprint,
      provenance: 'local_deterministic' as const,
      shortlistAuthority,
      questions: allocated.questions,
      projection: allocated.projection,
      estimatedInputTokens: allocated.estimatedInputTokens,
    };
    return {
      ok: true,
      value: deepFreezeModelValue({
        ...withoutFingerprint,
        optionSetFingerprint: `sha256:${sha256Canonical({
          rulesVersion: withoutFingerprint.rulesVersion,
          rulesSha256: withoutFingerprint.rulesSha256,
          sourceShortlistFingerprint: withoutFingerprint.sourceShortlistFingerprint,
          questions: withoutFingerprint.questions,
          projection: withoutFingerprint.projection,
        })}`,
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
  }
}

export function validateWrongQuestionOrganizerV9OptionAuthority(
  input: unknown,
): WrongQuestionOrganizerV9OptionAuthorityResult {
  try {
    if (!isPlainRecord(input)) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, 'shortlistAuthority');
    if (!descriptor || !('value' in descriptor)) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }
    const rebuilt = deriveWrongQuestionOrganizerV9OptionAuthority(descriptor.value);
    if (!rebuilt.ok || JSON.stringify(rebuilt.value) !== JSON.stringify(input)) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }
    return rebuilt;
  } catch {
    return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
  }
}

function enumerateQuestionOptions(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  questionIndex: number,
): readonly RawOption[] {
  const question = authority.questions[questionIndex];
  if (!question) return [];
  const subjectRows =
    question.structuredSubject === null
      ? question.subjectCandidates.map((resolvedSubject, subjectIndex) => ({
          resolvedSubject,
          subjectOrdinal: subjectIndex,
          subjectDecision: { action: 'select_subject', subjectIndex } as const,
        }))
      : [
          {
            resolvedSubject: question.structuredSubject,
            subjectOrdinal: 0,
            subjectDecision: { action: 'keep_local' } as const,
          },
        ];
  const raw: RawOption[] = [];
  for (const subject of subjectRows) {
    if (question.eligibleDeckActions.includes('reuse_existing')) {
      for (const deck of authority.decks) {
        if (deck.subject !== subject.resolvedSubject) continue;
        raw.push({
          questionIndex,
          subjectOrdinal: subject.subjectOrdinal,
          actionRank: 0,
          targetOrdinal: deck.deckIndex,
          resolvedSubject: subject.resolvedSubject,
          subjectDecision: subject.subjectDecision,
          deckDecision: { action: 'reuse_existing', deckIndex: deck.deckIndex },
          sourceLabel: 'existing_deck',
          targetLabel: truncateUnicodeScalars(deck.name, MAX_TARGET_LABEL_SCALARS),
        });
      }
    }
    if (question.eligibleDeckActions.includes('create_topic')) {
      for (const topic of question.topicCandidates) {
        if (topic.subject !== subject.resolvedSubject) continue;
        const collidingDeck = authority.decks.some(
          (deck) =>
            deck.subject === subject.resolvedSubject &&
            deck.normalizedName === topic.normalizedLabel,
        );
        if (collidingDeck) continue;
        raw.push({
          questionIndex,
          subjectOrdinal: subject.subjectOrdinal,
          actionRank: 1,
          targetOrdinal: topic.topicIndex,
          resolvedSubject: subject.resolvedSubject,
          subjectDecision: subject.subjectDecision,
          deckDecision: { action: 'create_topic', topicIndex: topic.topicIndex },
          sourceLabel: topic.source,
          targetLabel: truncateUnicodeScalars(topic.label, MAX_TARGET_LABEL_SCALARS),
        });
      }
    }
  }
  const sorted = raw.sort(compareRawOption);
  const unique = new Map<string, RawOption>();
  for (const option of sorted) {
    const key = canonicalOptionKey(option);
    if (!unique.has(key)) unique.set(key, option);
  }
  return [...unique.values()];
}

function allocateOptions(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  rawByQuestion: readonly (readonly RawOption[])[],
):
  | Readonly<{
      ok: true;
      questions: WrongQuestionOrganizerV9OptionAuthority['questions'];
      projection: WrongQuestionOrganizerV9ModelProjection;
      estimatedInputTokens: number;
    }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'candidate_option_authority_budget_exceeded'
        | 'candidate_option_authority_invalid';
    }> {
  const mandatoryKeys = rawByQuestion.map((options) => {
    const firstByBucket = new Map<string, RawOption>();
    for (const option of options) {
      const key = `${option.questionIndex}|${option.resolvedSubject}|${option.deckDecision.action}`;
      if (!firstByBucket.has(key)) firstByBucket.set(key, option);
    }
    return new Set([...firstByBucket.values()].map(canonicalOptionKey));
  });
  const selected = rawByQuestion.map((options, questionIndex) =>
    options.filter((option) => mandatoryKeys[questionIndex].has(canonicalOptionKey(option))),
  );
  if (
    selected.some((options) => options.length > MAX_OPTIONS_PER_QUESTION) ||
    selected.reduce((sum, options) => sum + options.length, 0) > MAX_OPTIONS_PER_REQUEST
  ) {
    return { ok: false, reasonCode: 'candidate_option_authority_budget_exceeded' };
  }

  let built = buildProjectedAllocation(authority, selected);
  if (!built.ok) return built;
  if (built.estimatedInputTokens > WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS) {
    return { ok: false, reasonCode: 'candidate_option_authority_budget_exceeded' };
  }

  const optional = rawByQuestion.flatMap((options, questionIndex) =>
    options
      .filter((option) => !mandatoryKeys[questionIndex].has(canonicalOptionKey(option)))
      .map((option) => ({ questionIndex, option })),
  );
  for (const candidate of optional) {
    const currentTotal = selected.reduce((sum, options) => sum + options.length, 0);
    if (
      currentTotal >= MAX_OPTIONS_PER_REQUEST ||
      selected[candidate.questionIndex].length >= MAX_OPTIONS_PER_QUESTION
    ) {
      continue;
    }
    const tentative = selected.map((options) => [...options]);
    tentative[candidate.questionIndex].push(candidate.option);
    tentative[candidate.questionIndex].sort(compareRawOption);
    const tentativeBuilt = buildProjectedAllocation(authority, tentative);
    if (!tentativeBuilt.ok) return tentativeBuilt;
    if (tentativeBuilt.estimatedInputTokens > WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS) {
      continue;
    }
    selected[candidate.questionIndex] = tentative[candidate.questionIndex]!;
    built = tentativeBuilt;
  }
  return built;
}

function buildProjectedAllocation(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  selected: readonly (readonly RawOption[])[],
) {
  const questions: WrongQuestionOrganizerV9OptionAuthority['questions'] = selected.map(
    (options, questionIndex) => ({
      questionIndex,
      options: options.map((option, optionIndex) => ({
        optionIndex,
        resolvedSubject: option.resolvedSubject,
        subjectDecision: option.subjectDecision,
        deckDecision: option.deckDecision,
        projection: {
          optionIndex,
          subjectLabel: option.resolvedSubject,
          actionLabel: option.deckDecision.action,
          sourceLabel: option.sourceLabel,
          ...(option.targetLabel ? { targetLabel: option.targetLabel } : {}),
        },
      })),
    }),
  );
  const projection: WrongQuestionOrganizerV9ModelProjection = {
    version: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
    questions: authority.questions.map((question) => {
      const optionQuestion = questions[question.questionIndex];
      if (!optionQuestion || optionQuestion.options.length === 0) {
        throw new Error('V9_OPTION_ALLOCATION_EMPTY');
      }
      return {
        questionIndex: question.questionIndex,
        fields: copyProjectedFields(question.projected),
        options: optionQuestion.options.map((option) => option.projection),
      };
    }),
  };
  const prompt = buildWrongQuestionOrganizerV9PromptParts(projection);
  if (!prompt.ok) return prompt;
  return {
    ok: true as const,
    questions: deepFreezeModelValue(questions),
    projection: prompt.value.projection,
    estimatedInputTokens: prompt.value.estimatedInputTokens,
  };
}

function everyOptionPassesV6(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  questions: WrongQuestionOrganizerV9OptionAuthority['questions'],
) {
  const defaults = questions.map((question) => question.options[0]);
  for (const question of questions) {
    for (const option of question.options) {
      const selected = defaults.map((entry, questionIndex) =>
        questionIndex === question.questionIndex ? option : entry,
      );
      const validation = validateWrongQuestionOrganizerV6ModelDecision({
        authority,
        decision: {
          shortlistFingerprint: authority.shortlistFingerprint,
          decisions: selected.map((entry, questionIndex) => ({
            questionIndex,
            subjectDecision: entry.subjectDecision,
            deckDecision: entry.deckDecision,
          })),
        },
      });
      if (!validation.ok) return false;
    }
  }
  return true;
}

function copyProjectedFields(
  fields: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number]['projected'],
) {
  return {
    ...(fields.category === undefined ? {} : { category: fields.category }),
    ...(fields.knowledgePoints === undefined
      ? {}
      : { knowledgePoints: [...fields.knowledgePoints] }),
    ...(fields.errorType === undefined ? {} : { errorType: fields.errorType }),
    ...(fields.questionExcerpt === undefined ? {} : { questionExcerpt: fields.questionExcerpt }),
    ...(fields.analysisExcerpt === undefined ? {} : { analysisExcerpt: fields.analysisExcerpt }),
  };
}

function compareRawOption(left: RawOption, right: RawOption) {
  return (
    left.questionIndex - right.questionIndex ||
    left.subjectOrdinal - right.subjectOrdinal ||
    left.actionRank - right.actionRank ||
    left.targetOrdinal - right.targetOrdinal ||
    compareText(canonicalOptionKey(left), canonicalOptionKey(right))
  );
}

function canonicalOptionKey(option: RawOption) {
  return JSON.stringify({
    resolvedSubject: option.resolvedSubject,
    subjectDecision: option.subjectDecision,
    deckDecision: option.deckDecision,
  });
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null)
    );
  } catch {
    return false;
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
