import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES,
  WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
  WRONG_QUESTION_ORGANIZER_SUBJECTS,
  formatWrongQuestionOrganizerAssociationPolicyForPrompt,
  formatWrongQuestionOrganizerAssociationPolicyForPromptV2,
  validateWrongQuestionOrganizerModelDecision,
  validateWrongQuestionOrganizerModelDecisionV2,
  type WrongQuestionOrganizerDecisionContext,
  type WrongQuestionOrganizerDecisionValidationResult,
  type WrongQuestionOrganizerDecisionReasonCode,
  type WrongQuestionOrganizerModelDecision,
  type WrongQuestionOrganizerSubject,
} from './wrong-question-organizer-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION,
  projectWrongQuestionOrganizerSnapshotForCandidate,
  type WrongQuestionOrganizerDeckAuthority,
  type WrongQuestionOrganizerModelProjection,
  type WrongQuestionOrganizerProjectionReasonCode,
  type WrongQuestionOrganizerQuestionAuthority,
} from './wrong-question-organizer-model-projection.ts';
import {
  ZERO_CANDIDATE_USAGE,
  canonicalCandidateReasonCodes,
  estimateCandidateInputTokens,
  mapModelAgentErrorDisposition,
  safeCandidateBudgetSnapshot,
  type ModelCandidateDisposition,
  type ModelCandidateEnvelope,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import { clonePlainModelData, truncateUnicodeScalars } from './model-projection-safety.ts';
import {
  organizeWrongQuestion,
  type WrongQuestionOrganizerExistingDeck,
  type WrongQuestionOrganizerInput,
  type WrongQuestionOrganizerResult,
} from '../nodes/wrong-question-organizer.ts';

const MAX_INPUT_TOKENS = 3_500;
const MAX_OUTPUT_TOKENS = 800;
const MAX_QUESTIONS = 12;
const MAX_DECKS = 20;
const MAX_PROJECTED_DECK_NAME_SCALARS = 80;
const MAX_PROJECTED_DECK_KEYWORDS = 8;
const MAX_PROJECTED_DECK_KEYWORD_SCALARS = 60;

const SYSTEM_PROMPT_V4 = [
  'Classify only the bounded wrong-question organization batch supplied as JSON.',
  formatWrongQuestionOrganizerAssociationPolicyForPrompt(),
  'Return exactly one decision for every projected question and use only q/d ordinal indexes.',
  'Never output IDs, user identity, write commands, database operations, tools, URLs, Markdown, or explanations.',
].join('\n');
const SYSTEM_PROMPT_V2 = [
  'Classify only the bounded wrong-question organization batch supplied as JSON.',
  formatWrongQuestionOrganizerAssociationPolicyForPromptV2(),
  'Return exactly one decision for every projected question and use only q/d ordinal indexes.',
  'Never output IDs, user identity, write commands, database operations, tools, URLs, Markdown, or explanations.',
].join('\n');
const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"decisions":[{"questionIndex":0,"subject":"keep_local|math|english|politics|computer|major|other","deck":{"action":"reuse_existing","deckIndex":0}|{"action":"create_topic","topicLabel":"safe label"},"confidence":"medium|high","evidenceCodes":["structured_subject|semantic_topic|existing_deck_overlap|error_pattern|insufficient_signal"]}]}. No extra fields.';

const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});
const SAFE_INVALID_RESULTS: readonly WrongQuestionOrganizerResult[] = Object.freeze([]);

const NULLABLE_OPTIONAL_TEXT = z.string().nullable().optional();
const WRONG_QUESTION_SCHEMA = z
  .object({
    id: z.string().min(1).max(256),
    subject: NULLABLE_OPTIONAL_TEXT,
    category: NULLABLE_OPTIONAL_TEXT,
    knowledgePoints: z.array(z.string()).max(20).nullable().optional(),
    errorType: NULLABLE_OPTIONAL_TEXT,
    questionText: NULLABLE_OPTIONAL_TEXT,
    analysis: NULLABLE_OPTIONAL_TEXT,
    answer: NULLABLE_OPTIONAL_TEXT,
    userNote: NULLABLE_OPTIONAL_TEXT,
  })
  .strict();
const EXISTING_DECK_SCHEMA = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string(),
    nameLocked: z.boolean().optional(),
    keywords: z.array(z.string()).max(20).optional(),
  })
  .strict();
const DETERMINISTIC_INPUT_SCHEMA = z
  .object({
    wrongQuestion: WRONG_QUESTION_SCHEMA,
    existingDecks: z.array(EXISTING_DECK_SCHEMA).max(MAX_DECKS).optional(),
  })
  .strict();
const CANDIDATE_ITEM_SCHEMA = z
  .object({
    deterministicInput: DETERMINISTIC_INPUT_SCHEMA,
    hasExistingItem: z.boolean(),
  })
  .strict();
const CANDIDATE_ITEMS_SCHEMA = z.array(CANDIDATE_ITEM_SCHEMA).min(1).max(MAX_QUESTIONS);

const PROJECTION_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_MODEL_PROJECTION_VERSION),
    questions: z
      .array(
        z
          .object({
            ordinal: z.string().regex(/^q\d+$/),
            subjectHint: z.enum([...WRONG_QUESTION_ORGANIZER_SUBJECTS, 'unknown']),
            category: z.string().optional(),
            knowledgePoints: z.array(z.string()).max(3),
            errorType: z.string().optional(),
            questionExcerpt: z.string().optional(),
            analysisExcerpt: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_QUESTIONS),
    decks: z
      .array(
        z
          .object({
            ordinal: z.string().regex(/^d\d+$/),
            subject: z.enum(WRONG_QUESTION_ORGANIZER_SUBJECTS),
            name: z.string(),
            keywords: z.array(z.string()).max(MAX_PROJECTED_DECK_KEYWORDS),
          })
          .strict(),
      )
      .max(MAX_DECKS),
  })
  .strict();
const STRING_MAP_SCHEMA = z.array(z.string().min(1).max(256)).max(MAX_DECKS);
const QUESTION_AUTHORITY_SCHEMA = z
  .array(
    z
      .object({
        questionId: z.string().min(1).max(256),
        subject: z.string().nullable(),
      })
      .strict(),
  )
  .min(1)
  .max(MAX_QUESTIONS);
const DECK_AUTHORITY_SCHEMA = z
  .array(
    z
      .object({
        deckId: z.string().min(1).max(256),
        subject: z.enum(WRONG_QUESTION_ORGANIZER_SUBJECTS),
        name: z.string(),
        nameLocked: z.boolean(),
        keywords: z.array(z.string()).max(20),
      })
      .strict(),
  )
  .max(MAX_DECKS);

const SUBJECT_AUTHORITY: Readonly<
  Record<WrongQuestionOrganizerSubject, { key: string; displayName: string }>
> = Object.freeze({
  math: Object.freeze({ key: '数学', displayName: '数学' }),
  english: Object.freeze({ key: '英语', displayName: '英语' }),
  politics: Object.freeze({ key: '政治', displayName: '政治' }),
  computer: Object.freeze({ key: '计算机', displayName: '计算机' }),
  major: Object.freeze({ key: '专业课', displayName: '专业课' }),
  other: Object.freeze({ key: '其他', displayName: '其他' }),
});

export type WrongQuestionOrganizerModelCandidateItem = Readonly<{
  deterministicInput: WrongQuestionOrganizerInput;
  hasExistingItem: boolean;
}>;

export type WrongQuestionOrganizerModelCandidateReasonCode =
  | WrongQuestionOrganizerProjectionReasonCode
  | WrongQuestionOrganizerDecisionReasonCode
  | (typeof WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES)[number]
  | ModelAgentErrorCode
  | 'no_candidate_items'
  | 'owner_ineligible'
  | 'stale_snapshot'
  | 'existing_item'
  | 'exact_deck_match'
  | 'high_confidence_knowledge_point'
  | 'high_confidence_category_error'
  | 'projection_association_invalid'
  | 'semantic_organization';

export type WrongQuestionOrganizerModelCandidateInput = Readonly<{
  runId: string;
  items: readonly WrongQuestionOrganizerModelCandidateItem[];
  force: boolean;
  ownerEligible: boolean;
  snapshotCurrent: boolean;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
}>;

export type WrongQuestionOrganizerModelCandidateEnvelope = ModelCandidateEnvelope<
  readonly WrongQuestionOrganizerResult[],
  WrongQuestionOrganizerModelCandidateReasonCode
>;

type SafeCandidateItem = z.infer<typeof CANDIDATE_ITEM_SCHEMA>;
type ValidInput = Readonly<{
  ok: true;
  runId: string;
  items: readonly SafeCandidateItem[];
  localResults: readonly WrongQuestionOrganizerResult[];
  force: boolean;
  ownerEligible: boolean;
  snapshotCurrent: boolean;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
}>;
type InvalidInput = Readonly<{
  ok: false;
  value: readonly WrongQuestionOrganizerResult[];
  budget: ModelAgentRunBudget;
}>;

type WrongQuestionOrganizerCandidatePolicy = Readonly<{
  systemPrompt: string;
  buildDecisionContext: (
    projection: WrongQuestionOrganizerModelProjection,
  ) => WrongQuestionOrganizerDecisionContext;
  validateDecision: (
    input: unknown,
    context: WrongQuestionOrganizerDecisionContext,
  ) => WrongQuestionOrganizerDecisionValidationResult;
}>;

const WRONG_QUESTION_ORGANIZER_CANDIDATE_POLICY_V4: WrongQuestionOrganizerCandidatePolicy =
  Object.freeze({
    systemPrompt: SYSTEM_PROMPT_V4,
    buildDecisionContext: buildV4DecisionContext,
    validateDecision: validateWrongQuestionOrganizerModelDecision,
  });

const WRONG_QUESTION_ORGANIZER_CANDIDATE_POLICY_V2: WrongQuestionOrganizerCandidatePolicy =
  Object.freeze({
    systemPrompt: SYSTEM_PROMPT_V2,
    buildDecisionContext: buildV2DecisionContext,
    validateDecision: validateWrongQuestionOrganizerModelDecisionV2,
  });

export async function runWrongQuestionOrganizerModelCandidate(
  input: WrongQuestionOrganizerModelCandidateInput,
): Promise<WrongQuestionOrganizerModelCandidateEnvelope> {
  return runWrongQuestionOrganizerModelCandidateWithPolicy(
    input,
    WRONG_QUESTION_ORGANIZER_CANDIDATE_POLICY_V4,
  );
}

export async function runWrongQuestionOrganizerModelCandidateV2(
  input: WrongQuestionOrganizerModelCandidateInput,
): Promise<WrongQuestionOrganizerModelCandidateEnvelope> {
  return runWrongQuestionOrganizerModelCandidateWithPolicy(
    input,
    WRONG_QUESTION_ORGANIZER_CANDIDATE_POLICY_V2,
  );
}

async function runWrongQuestionOrganizerModelCandidateWithPolicy(
  input: WrongQuestionOrganizerModelCandidateInput,
  policy: WrongQuestionOrganizerCandidatePolicy,
): Promise<WrongQuestionOrganizerModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(valid.value, 'fallback_invalid_input', valid.budget, [
      'no_candidate_items',
    ]);
  }

  if (!valid.ownerEligible) {
    return localEnvelope(valid.localResults, 'not_eligible', valid.budget, ['owner_ineligible']);
  }
  if (!valid.snapshotCurrent) {
    return localEnvelope(valid.localResults, 'not_eligible', valid.budget, ['stale_snapshot']);
  }

  const abort = readAbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(valid.localResults, 'fallback_invalid_input', valid.budget, [
      'INVALID_REQUEST',
    ]);
  }
  if (abort.aborted) {
    return localEnvelope(valid.localResults, 'fallback_aborted', valid.budget, ['ABORTED']);
  }
  if (!valid.force && valid.items.some((item) => item.hasExistingItem)) {
    return localEnvelope(valid.localResults, 'not_eligible', valid.budget, ['existing_item']);
  }

  const projected = projectWrongQuestionOrganizerSnapshotForCandidate(valid.projectionSource);
  if (!projected.ok) {
    return projectionFailureEnvelope(valid.localResults, valid.budget, projected.reasonCode);
  }
  if (
    !projectionAssociationIsValid({
      items: valid.items,
      projection: projected.value,
      questionIdsByOrdinal: projected.questionIdsByOrdinal,
      deckIdsByOrdinal: projected.deckIdsByOrdinal,
      questionAuthoritiesByOrdinal: projected.questionAuthoritiesByOrdinal,
      deckAuthoritiesByOrdinal: projected.deckAuthoritiesByOrdinal,
    })
  ) {
    return localEnvelope(valid.localResults, 'fallback_invalid_input', valid.budget, [
      'projection_association_invalid',
    ]);
  }

  if (
    hasExactStructuredDeckMatch({
      items: valid.items,
      localResults: valid.localResults,
      projection: projected.value,
      deckIdsByOrdinal: projected.deckIdsByOrdinal,
    })
  ) {
    return localEnvelope(valid.localResults, 'not_eligible', valid.budget, ['exact_deck_match']);
  }

  const highConfidenceReason = highConfidenceLocalReason(valid.items, valid.localResults);
  if (highConfidenceReason !== null) {
    return localEnvelope(valid.localResults, 'not_eligible', valid.budget, [highConfidenceReason]);
  }

  const userPrompt = JSON.stringify(projected.value);
  const estimatedInputTokens = estimateCandidateInputTokens([
    policy.systemPrompt,
    userPrompt,
    SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return localEnvelope(valid.localResults, 'fallback_budget_exceeded', valid.budget, [
      'INPUT_BUDGET_EXCEEDED',
    ]);
  }

  const reservation = reserveModelAgentBudget(valid.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    const errorCode = toModelAgentErrorCode(reservation.code);
    return localEnvelope(
      valid.localResults,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  const runtimeResult = await invokeRuntime({
    input: valid,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
    systemPrompt: policy.systemPrompt,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(valid.localResults, reservation.budget);
  }
  const postRuntimeAbort = readAbortState(valid.signal);
  if (!postRuntimeAbort.ok) {
    return unavailableEnvelope(valid.localResults, runtimeResult.budget);
  }
  if (postRuntimeAbort.aborted) {
    return attemptedEnvelope(
      valid.localResults,
      'fallback_aborted',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['ABORTED'],
    );
  }
  if (!runtimeResult.ok) {
    return attemptedEnvelope(
      valid.localResults,
      mapModelAgentErrorDisposition(runtimeResult.error.code),
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }

  const context = policy.buildDecisionContext(projected.value);
  const decision = policy.validateDecision(runtimeResult.data, context);
  if (!decision.ok) {
    return attemptedEnvelope(
      valid.localResults,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [decision.reasonCode],
    );
  }

  const merged = mergeValidatedWrongQuestionOrganizerModelDecision({
    items: valid.items,
    projection: projected.value,
    questionIdsByOrdinal: projected.questionIdsByOrdinal,
    deckIdsByOrdinal: projected.deckIdsByOrdinal,
    questionAuthoritiesByOrdinal: projected.questionAuthoritiesByOrdinal,
    deckAuthoritiesByOrdinal: projected.deckAuthoritiesByOrdinal,
    validation: decision,
  });
  if (merged === null) {
    return attemptedEnvelope(
      valid.localResults,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['projection_association_invalid'],
    );
  }

  return attemptedEnvelope(
    merged,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    uniqueEvidenceCodes(decision.value),
  );
}

export function mergeWrongQuestionOrganizerModelDecision(input: {
  items: readonly WrongQuestionOrganizerModelCandidateItem[];
  projection: WrongQuestionOrganizerModelProjection;
  questionIdsByOrdinal: readonly string[];
  deckIdsByOrdinal: readonly string[];
  questionAuthoritiesByOrdinal: readonly WrongQuestionOrganizerQuestionAuthority[];
  deckAuthoritiesByOrdinal: readonly WrongQuestionOrganizerDeckAuthority[];
  decision: WrongQuestionOrganizerModelDecision;
}): readonly WrongQuestionOrganizerResult[] | null {
  return mergeWrongQuestionOrganizerModelDecisionInternal({
    ...input,
    validation: null,
  });
}

export function mergeWrongQuestionOrganizerModelDecisionV2(input: {
  items: readonly WrongQuestionOrganizerModelCandidateItem[];
  projection: WrongQuestionOrganizerModelProjection;
  questionIdsByOrdinal: readonly string[];
  deckIdsByOrdinal: readonly string[];
  questionAuthoritiesByOrdinal: readonly WrongQuestionOrganizerQuestionAuthority[];
  deckAuthoritiesByOrdinal: readonly WrongQuestionOrganizerDeckAuthority[];
  decision: WrongQuestionOrganizerModelDecision;
}): readonly WrongQuestionOrganizerResult[] | null {
  const validation = validateWrongQuestionOrganizerModelDecisionV2(
    input.decision,
    buildV2DecisionContext(input.projection),
  );
  return mergeWrongQuestionOrganizerModelDecisionInternal({
    ...input,
    decision: null,
    validation,
  });
}

function mergeValidatedWrongQuestionOrganizerModelDecision(input: {
  items: readonly WrongQuestionOrganizerModelCandidateItem[];
  projection: WrongQuestionOrganizerModelProjection;
  questionIdsByOrdinal: readonly string[];
  deckIdsByOrdinal: readonly string[];
  questionAuthoritiesByOrdinal: readonly WrongQuestionOrganizerQuestionAuthority[];
  deckAuthoritiesByOrdinal: readonly WrongQuestionOrganizerDeckAuthority[];
  validation: WrongQuestionOrganizerDecisionValidationResult;
}): readonly WrongQuestionOrganizerResult[] | null {
  return mergeWrongQuestionOrganizerModelDecisionInternal({
    ...input,
    decision: null,
  });
}

function mergeWrongQuestionOrganizerModelDecisionInternal(input: {
  items: readonly WrongQuestionOrganizerModelCandidateItem[];
  projection: WrongQuestionOrganizerModelProjection;
  questionIdsByOrdinal: readonly string[];
  deckIdsByOrdinal: readonly string[];
  questionAuthoritiesByOrdinal: readonly WrongQuestionOrganizerQuestionAuthority[];
  deckAuthoritiesByOrdinal: readonly WrongQuestionOrganizerDeckAuthority[];
  decision: WrongQuestionOrganizerModelDecision | null;
  validation: WrongQuestionOrganizerDecisionValidationResult | null;
}): readonly WrongQuestionOrganizerResult[] | null {
  try {
    const items = cloneCandidateItems(input.items);
    const projection = cloneProjection(input.projection);
    const questionIdsByOrdinal = cloneStringMap(input.questionIdsByOrdinal, MAX_QUESTIONS);
    const deckIdsByOrdinal = cloneStringMap(input.deckIdsByOrdinal, MAX_DECKS);
    const questionAuthoritiesByOrdinal = cloneQuestionAuthorities(
      input.questionAuthoritiesByOrdinal,
    );
    const deckAuthoritiesByOrdinal = cloneDeckAuthorities(input.deckAuthoritiesByOrdinal);
    if (
      items === null ||
      projection === null ||
      questionIdsByOrdinal === null ||
      deckIdsByOrdinal === null ||
      questionAuthoritiesByOrdinal === null ||
      deckAuthoritiesByOrdinal === null ||
      !projectionAssociationIsValid({
        items,
        projection,
        questionIdsByOrdinal,
        deckIdsByOrdinal,
        questionAuthoritiesByOrdinal,
        deckAuthoritiesByOrdinal,
      })
    ) {
      return null;
    }

    const validation = input.validation
      ? input.validation
      : input.decision === null
        ? null
        : validateWrongQuestionOrganizerModelDecision(input.decision, {
            ...buildV4DecisionContext(projection),
          });
    if (validation === null) return null;
    if (!validation.ok) return null;

    const deckAuthorityById = new Map(
      deckAuthoritiesByOrdinal.map((deck) => [deck.deckId, deck] as const),
    );
    const decisionsByQuestion = new Map(
      validation.value.decisions.map((decision) => [decision.questionIndex, decision] as const),
    );

    return items.map((item, questionIndex) => {
      const decision = decisionsByQuestion.get(questionIndex);
      const questionProjection = projection.questions[questionIndex];
      const local = organizeWrongQuestion(item.deterministicInput);
      if (decision === undefined || questionProjection === undefined) {
        throw new Error('missing bounded decision');
      }

      const resolvedSubject =
        decision.subject === 'keep_local' ? questionProjection.subjectHint : decision.subject;
      if (resolvedSubject === 'unknown') throw new Error('unresolved subject');
      const subject =
        decision.subject === 'keep_local'
          ? {
              key: local.subjectKey,
              displayName: local.subjectDisplayName,
            }
          : SUBJECT_AUTHORITY[resolvedSubject];

      if (decision.deck.action === 'reuse_existing') {
        const deckId = deckIdsByOrdinal[decision.deck.deckIndex];
        const deck = deckId ? deckAuthorityById.get(deckId) : undefined;
        if (deck === undefined || deck.subject !== resolvedSubject) {
          throw new Error('invalid local deck authority');
        }
        const boundedDeckDisplay = truncateUnicodeScalars(
          normalizeNullableLocalText(deck.name),
          MAX_PROJECTED_DECK_NAME_SCALARS,
        );
        return {
          subjectKey: subject.key,
          subjectDisplayName: subject.displayName,
          deckName: deck.name,
          deckDescription: buildDeckDescription(subject.displayName, boundedDeckDisplay),
          matchedDeckId: deck.deckId,
          reason: `语义候选识别到当前错题与已有专题「${boundedDeckDisplay}」重合，建议保持该专题名称并继续归入。`,
          confidence: fixedConfidence(decision.confidence),
          signals: buildSignals(decision, resolvedSubject),
        };
      }

      const deckName = decision.deck.topicLabel;
      return {
        subjectKey: subject.key,
        subjectDisplayName: subject.displayName,
        deckName,
        deckDescription: buildDeckDescription(subject.displayName, deckName),
        reason: `语义候选在受限分类中识别出「${deckName}」专题，仍需由本地授权流程确认写入。`,
        confidence: fixedConfidence(decision.confidence),
        signals: buildSignals(decision, resolvedSubject),
      };
    });
  } catch {
    return null;
  }
}

function validateInput(input: unknown): ValidInput | InvalidInput {
  try {
    const source = readPlainInputObject(input);
    if (!source.ok) {
      return { ok: false, value: SAFE_INVALID_RESULTS, budget: SAFE_INVALID_BUDGET };
    }
    const items = cloneCandidateItems(source.values.items);
    const localResults =
      items?.map((item) => organizeWrongQuestion(item.deterministicInput)) ?? SAFE_INVALID_RESULTS;
    const budget = cloneBudget(source.values.budget) ?? SAFE_INVALID_BUDGET;
    const runtime = snapshotRuntime(source.values.runtime);
    const signal = source.values.signal;
    if (
      items === null ||
      typeof source.values.runId !== 'string' ||
      !source.values.runId.trim() ||
      typeof source.values.force !== 'boolean' ||
      typeof source.values.ownerEligible !== 'boolean' ||
      typeof source.values.snapshotCurrent !== 'boolean' ||
      runtime === null ||
      cloneBudget(source.values.budget) === null ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return { ok: false, value: localResults, budget };
    }

    return {
      ok: true,
      runId: source.values.runId,
      items,
      localResults,
      force: source.values.force,
      ownerEligible: source.values.ownerEligible,
      snapshotCurrent: source.values.snapshotCurrent,
      projectionSource: source.values.projectionSource,
      runtime,
      budget,
      ...(signal instanceof AbortSignal ? { signal } : {}),
    };
  } catch {
    return { ok: false, value: SAFE_INVALID_RESULTS, budget: SAFE_INVALID_BUDGET };
  }
}

const INPUT_KEYS = new Set([
  'runId',
  'items',
  'force',
  'ownerEligible',
  'snapshotCurrent',
  'projectionSource',
  'runtime',
  'budget',
  'signal',
]);
const REQUIRED_INPUT_KEYS = [
  'runId',
  'items',
  'force',
  'ownerEligible',
  'snapshotCurrent',
  'projectionSource',
  'runtime',
  'budget',
] as const;

function readPlainInputObject(
  input: unknown,
): { ok: true; values: Record<string, unknown> } | { ok: false } {
  if (typeof input !== 'object' || input === null) return { ok: false };
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return { ok: false };
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== 'string' || !INPUT_KEYS.has(key)) ||
    REQUIRED_INPUT_KEYS.some((key) => !keys.includes(key))
  ) {
    return { ok: false };
  }

  const values: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string') return { ok: false };
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) return { ok: false };
    values[key] = descriptor.value;
  }
  return { ok: true, values };
}

function cloneCandidateItems(value: unknown): readonly SafeCandidateItem[] | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = CANDIDATE_ITEMS_SCHEMA.safeParse(cloned.value);
  return parsed.success ? parsed.data : null;
}

function cloneProjection(value: unknown): WrongQuestionOrganizerModelProjection | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = PROJECTION_SCHEMA.safeParse(cloned.value);
  return parsed.success ? (parsed.data as WrongQuestionOrganizerModelProjection) : null;
}

function cloneStringMap(value: unknown, max: number): readonly string[] | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = STRING_MAP_SCHEMA.max(max).safeParse(cloned.value);
  return parsed.success ? parsed.data : null;
}

function cloneQuestionAuthorities(
  value: unknown,
): readonly WrongQuestionOrganizerQuestionAuthority[] | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = QUESTION_AUTHORITY_SCHEMA.safeParse(cloned.value);
  return parsed.success ? parsed.data : null;
}

function cloneDeckAuthorities(
  value: unknown,
): readonly WrongQuestionOrganizerDeckAuthority[] | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = DECK_AUTHORITY_SCHEMA.safeParse(cloned.value);
  return parsed.success ? parsed.data : null;
}

function snapshotRuntime(value: unknown): Pick<ModelAgentRuntime, 'invokeStructured'> | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'invokeStructured');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'function') {
      return null;
    }
    const invokeStructured = descriptor.value as ModelAgentRuntime['invokeStructured'];
    return {
      invokeStructured<T>(request: ModelAgentRequest<T>) {
        return Reflect.apply(invokeStructured, value, [request]);
      },
    };
  } catch {
    return null;
  }
}

function cloneBudget(value: unknown): ModelAgentRunBudget | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok || !isModelAgentRunBudget(cloned.value)) return null;
  return {
    maxCalls: cloned.value.maxCalls,
    usedCalls: cloned.value.usedCalls,
    maxInputTokens: cloned.value.maxInputTokens,
    usedInputTokens: cloned.value.usedInputTokens,
    maxOutputTokens: cloned.value.maxOutputTokens,
    usedOutputTokens: cloned.value.usedOutputTokens,
  };
}

function projectionAssociationIsValid(input: {
  items: readonly SafeCandidateItem[];
  projection: WrongQuestionOrganizerModelProjection;
  questionIdsByOrdinal: readonly string[];
  deckIdsByOrdinal: readonly string[];
  questionAuthoritiesByOrdinal: readonly WrongQuestionOrganizerQuestionAuthority[];
  deckAuthoritiesByOrdinal: readonly WrongQuestionOrganizerDeckAuthority[];
}): boolean {
  if (
    input.items.length !== input.projection.questions.length ||
    input.items.length !== input.questionIdsByOrdinal.length ||
    input.items.length !== input.questionAuthoritiesByOrdinal.length ||
    input.projection.decks.length !== input.deckIdsByOrdinal.length ||
    input.projection.decks.length !== input.deckAuthoritiesByOrdinal.length ||
    new Set(input.questionIdsByOrdinal).size !== input.questionIdsByOrdinal.length ||
    new Set(input.deckIdsByOrdinal).size !== input.deckIdsByOrdinal.length
  ) {
    return false;
  }

  const localDecks = buildLocalDeckMap(input.items);
  if (localDecks === null) return false;
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    const projection = input.projection.questions[index];
    const questionId = input.questionIdsByOrdinal[index];
    const authority = input.questionAuthoritiesByOrdinal[index];
    if (
      item === undefined ||
      projection === undefined ||
      questionId === undefined ||
      authority === undefined ||
      projection.ordinal !== `q${index}` ||
      questionId !== item.deterministicInput.wrongQuestion.id ||
      authority.questionId !== questionId ||
      normalizeNullableLocalText(item.deterministicInput.wrongQuestion.subject) !==
        normalizeNullableLocalText(authority.subject) ||
      localSubjectHint(authority.subject) !== projection.subjectHint
    ) {
      return false;
    }
  }

  for (let index = 0; index < input.projection.decks.length; index += 1) {
    const projection = input.projection.decks[index];
    const deckId = input.deckIdsByOrdinal[index];
    const authority = input.deckAuthoritiesByOrdinal[index];
    const local = deckId ? localDecks.get(deckId) : undefined;
    if (
      projection === undefined ||
      deckId === undefined ||
      authority === undefined ||
      local === undefined ||
      projection.ordinal !== `d${index}` ||
      authority.deckId !== deckId ||
      authority.subject !== projection.subject ||
      !sameLocalDeck(local, authority) ||
      projection.name !==
        truncateUnicodeScalars(
          normalizeProjectionText(authority.name),
          MAX_PROJECTED_DECK_NAME_SCALARS,
        ) ||
      !sameOrderedValues(
        projection.keywords,
        authority.keywords
          .slice(0, MAX_PROJECTED_DECK_KEYWORDS)
          .map((keyword) =>
            truncateUnicodeScalars(
              normalizeProjectionText(keyword),
              MAX_PROJECTED_DECK_KEYWORD_SCALARS,
            ),
          ),
      )
    ) {
      return false;
    }
  }
  return true;
}

function buildLocalDeckMap(
  items: readonly SafeCandidateItem[],
): Map<string, Required<WrongQuestionOrganizerExistingDeck>> | null {
  const result = new Map<string, Required<WrongQuestionOrganizerExistingDeck>>();
  for (const item of items) {
    for (const deck of item.deterministicInput.existingDecks ?? []) {
      const canonical = {
        id: deck.id,
        name: deck.name,
        nameLocked: deck.nameLocked ?? false,
        keywords: [...(deck.keywords ?? [])],
      };
      const existing = result.get(deck.id);
      if (existing !== undefined && !sameLocalDeck(existing, canonical)) return null;
      result.set(deck.id, canonical);
    }
  }
  return result;
}

function sameLocalDeck(
  left: Required<WrongQuestionOrganizerExistingDeck>,
  right: WrongQuestionOrganizerDeckAuthority | Required<WrongQuestionOrganizerExistingDeck>,
): boolean {
  return (
    left.id === ('deckId' in right ? right.deckId : right.id) &&
    left.name === right.name &&
    left.nameLocked === right.nameLocked &&
    sameOrderedValues(left.keywords, right.keywords)
  );
}

function hasExactStructuredDeckMatch(input: {
  items: readonly SafeCandidateItem[];
  localResults: readonly WrongQuestionOrganizerResult[];
  projection: WrongQuestionOrganizerModelProjection;
  deckIdsByOrdinal: readonly string[];
}): boolean {
  return input.items.some((_, index) => {
    const local = input.localResults[index];
    const question = input.projection.questions[index];
    if (!local?.matchedDeckId || !question || question.subjectHint === 'unknown') return false;
    const structuredLabel = question.knowledgePoints[0] || question.category;
    if (!structuredLabel) return false;
    const deckIndex = input.deckIdsByOrdinal.indexOf(local.matchedDeckId);
    const deck = input.projection.decks[deckIndex];
    if (!deck || deck.subject !== question.subjectHint) return false;
    const expected = normalizeMatchLabel(structuredLabel);
    return [deck.name, ...deck.keywords].some((value) => normalizeMatchLabel(value) === expected);
  });
}

function highConfidenceLocalReason(
  items: readonly SafeCandidateItem[],
  localResults: readonly WrongQuestionOrganizerResult[],
): 'high_confidence_knowledge_point' | 'high_confidence_category_error' | null {
  for (let index = 0; index < items.length; index += 1) {
    const wrongQuestion = items[index]?.deterministicInput.wrongQuestion;
    const local = localResults[index];
    if (!wrongQuestion || !local || !normalizeNullableLocalText(wrongQuestion.subject)) continue;
    if (local.confidence < 0.72) continue;
    if ((wrongQuestion.knowledgePoints ?? []).some((value) => Boolean(value.trim()))) {
      return 'high_confidence_knowledge_point';
    }
    if (wrongQuestion.category?.trim() && wrongQuestion.errorType?.trim()) {
      return 'high_confidence_category_error';
    }
  }
  return null;
}

function localSubjectHint(
  value: string | null | undefined,
): WrongQuestionOrganizerSubject | 'unknown' {
  const normalized = normalizeMatchLabel(value ?? '');
  if (!normalized) return 'unknown';
  if (normalized === 'math' || normalized.includes('数学')) return 'math';
  if (normalized === 'english' || normalized.includes('英语')) return 'english';
  if (normalized === 'politics' || normalized.includes('政治')) return 'politics';
  if (normalized === 'computer' || normalized.includes('计算机')) return 'computer';
  if (normalized === 'major' || normalized.includes('专业课')) return 'major';
  return 'other';
}

function normalizeNullableLocalText(value: string | null | undefined): string {
  return value?.normalize('NFKC').trim().replace(/\s+/gu, ' ') ?? '';
}

function normalizeProjectionText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function normalizeMatchLabel(value: string): string {
  return normalizeProjectionText(value).replace(/\s+/gu, '');
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function uniqueEvidenceCodes(
  decision: WrongQuestionOrganizerModelDecision,
): WrongQuestionOrganizerModelCandidateReasonCode[] {
  return [
    'semantic_organization',
    ...new Set(decision.decisions.flatMap((entry) => entry.evidenceCodes)),
  ];
}

function buildSignals(
  decision: WrongQuestionOrganizerModelDecision['decisions'][number],
  subject: WrongQuestionOrganizerSubject,
): string[] {
  return [
    'semanticOrganization',
    `modelSubject:${subject}`,
    decision.deck.action === 'reuse_existing' ? 'existingDeck' : 'semanticTopic',
    ...decision.evidenceCodes.map((code) => `modelEvidence:${code}`),
  ];
}

function fixedConfidence(value: 'medium' | 'high'): number {
  return value === 'high' ? 0.86 : 0.78;
}

function buildDeckDescription(subjectDisplayName: string, deckName: string): string {
  return `用于整理${subjectDisplayName}中的${deckName}相关错题。`;
}

function buildV2DecisionContext(
  projection: WrongQuestionOrganizerModelProjection,
): WrongQuestionOrganizerDecisionContext {
  return {
    questions: projection.questions.map((question) => ({
      subjectHint: question.subjectHint,
    })),
    decks: projection.decks.map((deck) => ({ subject: deck.subject })),
  };
}

function buildV4DecisionContext(
  projection: WrongQuestionOrganizerModelProjection,
): WrongQuestionOrganizerDecisionContext {
  return {
    questions: projection.questions.map((question) => ({
      subjectHint: question.subjectHint,
      ...(question.category ? { category: question.category } : {}),
      knowledgePoints: [...question.knowledgePoints],
      ...(question.errorType ? { errorType: question.errorType } : {}),
      ...(question.questionExcerpt ? { questionExcerpt: question.questionExcerpt } : {}),
      ...(question.analysisExcerpt ? { analysisExcerpt: question.analysisExcerpt } : {}),
    })),
    decks: projection.decks.map((deck) => ({
      subject: deck.subject,
      name: deck.name,
      keywords: [...deck.keywords],
    })),
  };
}

function projectionFailureEnvelope(
  results: readonly WrongQuestionOrganizerResult[],
  budget: ModelAgentRunBudget,
  reasonCode: WrongQuestionOrganizerProjectionReasonCode,
): WrongQuestionOrganizerModelCandidateEnvelope {
  if (reasonCode === 'input_budget_exceeded') {
    return localEnvelope(results, 'fallback_budget_exceeded', budget, [reasonCode]);
  }
  if (
    reasonCode === 'credential_material' ||
    reasonCode === 'instruction_override' ||
    reasonCode === 'system_prompt_exfiltration' ||
    reasonCode === 'control_character' ||
    reasonCode === 'unsafe_metadata'
  ) {
    return localEnvelope(results, 'safety_blocked', budget, [reasonCode]);
  }
  if (reasonCode === 'no_safe_projection' || reasonCode === 'no_semantic_text') {
    return localEnvelope(results, 'not_eligible', budget, [reasonCode]);
  }
  return localEnvelope(results, 'fallback_invalid_input', budget, [reasonCode]);
}

function readAbortState(
  signal: AbortSignal | undefined,
): { ok: true; aborted: boolean } | { ok: false } {
  if (signal === undefined) return { ok: true, aborted: false };
  try {
    return typeof signal.aborted === 'boolean'
      ? { ok: true, aborted: signal.aborted }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function invokeRuntime(input: {
  input: ValidInput;
  userPrompt: string;
  estimatedInputTokens: number;
  reservationBudget: ModelAgentRunBudget;
  systemPrompt: string;
}) {
  let rawResult: unknown;
  try {
    const request: ModelAgentRequest<WrongQuestionOrganizerModelDecision> = {
      runId: input.input.runId,
      task: 'wrong_question_organization',
      schema: WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      estimatedInputTokens: input.estimatedInputTokens,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      budget: safeCandidateBudgetSnapshot(input.input.budget),
      ...(input.input.signal ? { signal: input.input.signal } : {}),
    };
    rawResult = await input.input.runtime.invokeStructured(request);
  } catch {
    return null;
  }
  return sanitizeModelCandidateRuntimeResult({
    value: rawResult,
    dataSchema: WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA,
    task: 'wrong_question_organization',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: input.input.budget,
    previewBudget: input.reservationBudget,
  });
}

function toModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : (code as ModelAgentErrorCode);
}

function localEnvelope(
  result: readonly WrongQuestionOrganizerResult[],
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly WrongQuestionOrganizerModelCandidateReasonCode[],
): WrongQuestionOrganizerModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: readonly WrongQuestionOrganizerResult[],
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<WrongQuestionOrganizerModelCandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly WrongQuestionOrganizerModelCandidateReasonCode[],
): WrongQuestionOrganizerModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: readonly WrongQuestionOrganizerResult[],
  budget: ModelAgentRunBudget,
): WrongQuestionOrganizerModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
      disposition: 'fallback_runtime_error',
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes('fallback_runtime_error', []),
    },
  };
}
