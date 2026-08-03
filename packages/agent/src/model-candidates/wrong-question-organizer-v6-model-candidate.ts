import {
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  organizeWrongQuestion,
  type WrongQuestionOrganizerResult,
} from '../nodes/wrong-question-organizer.ts';
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
import { deepFreezeModelValue } from './model-projection-safety.ts';
import {
  V6_SAFE_INVALID_BUDGET,
  cloneV6Budget,
  invokeV6Structured,
  readV6AbortState,
  readV6PlainInputObject,
  snapshotV6Function,
  snapshotV6Runtime,
  toV6ModelAgentErrorCode,
} from './v6-model-candidate-support.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
  deriveWrongQuestionOrganizerV5Shortlist,
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistFailureCode,
  type WrongQuestionOrganizerV5ShortlistSource,
  type WrongQuestionOrganizerV5Subject,
} from './wrong-question-organizer-v5-shortlist.ts';
import {
  deriveWrongQuestionOrganizerV6ConfidenceAuthority,
  type WrongQuestionOrganizerV6ConfidenceFailureCode,
} from './wrong-question-organizer-v6-confidence-authority.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
  formatWrongQuestionOrganizerV6ModelPolicyForPrompt,
  validateWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6DecisionFailureCode,
  type WrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6ValidatedDecision,
} from './wrong-question-organizer-v6-model-contract.ts';
import { projectWrongQuestionOrganizerV6ModelInput } from './wrong-question-organizer-v6-model-projection.ts';

const MAX_INPUT_TOKENS = 3_500;
const MAX_OUTPUT_TOKENS = 800;

const SYSTEM_PROMPT = [
  'Select only bounded WrongQuestionOrganizer ordinals from the supplied JSON.',
  formatWrongQuestionOrganizerV6ModelPolicyForPrompt(),
].join('\n');

const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {shortlistFingerprint,decisions:[{questionIndex,subjectDecision:{action:keep_local|select_subject,subjectIndex?},deckDecision:{action:reuse_existing|create_topic,deckIndex?|topicIndex?}}]}. No extra fields.';

const SUBJECT_DISPLAY_NAMES: Readonly<Record<WrongQuestionOrganizerV5Subject, string>> =
  deepFreezeModelValue({
    math: '数学',
    english: '英语',
    politics: '政治',
    computer: '计算机',
    major: '专业课',
    other: '其他',
  });

const V6_BOUNDED_TOPIC_EQUIVALENCE_GROUPS: readonly (readonly string[])[] = deepFreezeModelValue([
  [
    '阅读推断',
    '作者态度',
    '作者立场',
    'reading inference',
    'author attitude',
    'author stance',
    'writer attitude',
    'writer stance',
  ],
]);

export type WrongQuestionOrganizerV6CommandBinding = Readonly<{
  candidateVersion: typeof WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION;
  ownerDomain: string;
  ownerSnapshotVersion: string;
  ownerSnapshotFingerprint: string;
  shortlistVersion: typeof WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION;
  shortlistFingerprint: string;
  questionIds: readonly string[];
}>;

export type WrongQuestionOrganizerV6Suggestion = Readonly<{
  questionId: string;
  organization: WrongQuestionOrganizerResult;
  selection:
    | Readonly<{ source: 'deterministic' }>
    | Readonly<{
        source: 'model_ordinal';
        resolvedSubject: WrongQuestionOrganizerV5Subject;
        confidence: 'medium' | 'high';
        confidenceAuthoritySha256: string;
        deckDecision:
          | Readonly<{ action: 'reuse_existing'; deckIndex: number; deckId: string }>
          | Readonly<{ action: 'create_topic'; topicIndex: number; topicLabel: string }>;
      }>;
}>;

export type WrongQuestionOrganizerV6CandidateResult = Readonly<{
  binding: WrongQuestionOrganizerV6CommandBinding | null;
  suggestions: readonly WrongQuestionOrganizerV6Suggestion[];
}>;

export type WrongQuestionOrganizerV6ModelCandidateInput = Readonly<{
  runId: string;
  shortlistSource: WrongQuestionOrganizerV5ShortlistSource;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

export type WrongQuestionOrganizerV6MergeFailureCode =
  | 'authority_merge_invalid'
  | 'confidence_authority_invalid'
  | 'locked_name_violation'
  | 'duplicate_local_topic';

export type WrongQuestionOrganizerV6CandidateReasonCode =
  | WrongQuestionOrganizerV5ShortlistFailureCode
  | WrongQuestionOrganizerV6DecisionFailureCode
  | WrongQuestionOrganizerV6ConfidenceFailureCode
  | WrongQuestionOrganizerV6MergeFailureCode
  | ModelAgentErrorCode
  | 'candidate_shortlist_empty'
  | 'stale_shortlist'
  | 'local_shortlist_and_confidence_applied';

export type WrongQuestionOrganizerV6ModelCandidateEnvelope = ModelCandidateEnvelope<
  WrongQuestionOrganizerV6CandidateResult,
  WrongQuestionOrganizerV6CandidateReasonCode
>;

export type WrongQuestionOrganizerV6MergeResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV6CandidateResult }>
  | Readonly<{ ok: false; reasonCode: WrongQuestionOrganizerV6MergeFailureCode }>;

type ValidInput = Readonly<{
  ok: true;
  runId: string;
  authority: WrongQuestionOrganizerV5ShortlistAuthority;
  localResult: WrongQuestionOrganizerV6CandidateResult;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

type InvalidInput = Readonly<{
  ok: false;
  value: WrongQuestionOrganizerV6CandidateResult;
  budget: ModelAgentRunBudget;
  reasonCode: WrongQuestionOrganizerV6CandidateReasonCode;
}>;

const EMPTY_RESULT: WrongQuestionOrganizerV6CandidateResult = deepFreezeModelValue({
  binding: null,
  suggestions: [],
});

export async function runWrongQuestionOrganizerV6ModelCandidate(
  input: WrongQuestionOrganizerV6ModelCandidateInput,
): Promise<WrongQuestionOrganizerV6ModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(valid.value, 'fallback_invalid_input', valid.budget, [valid.reasonCode]);
  }

  const abort = readV6AbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(valid.localResult, 'fallback_invalid_input', valid.budget, [
      'invalid_input',
    ]);
  }
  if (abort.aborted) {
    return localEnvelope(valid.localResult, 'fallback_aborted', valid.budget, ['ABORTED']);
  }
  if (valid.authority.questions.some((question) => question.eligibleDeckActions.length === 0)) {
    return localEnvelope(valid.localResult, 'not_eligible', valid.budget, [
      'candidate_shortlist_empty',
    ]);
  }
  if (!(await revalidateAuthority(valid))) {
    return localEnvelope(valid.localResult, 'fallback_invalid_input', valid.budget, [
      'stale_shortlist',
    ]);
  }

  const projection = projectWrongQuestionOrganizerV6ModelInput(valid.authority);
  if (!projection.ok) {
    return localEnvelope(valid.localResult, 'fallback_invalid_input', valid.budget, [
      projection.reasonCode,
    ]);
  }
  const userPrompt = JSON.stringify(projection.value);
  const estimatedInputTokens = estimateCandidateInputTokens([
    SYSTEM_PROMPT,
    userPrompt,
    SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return localEnvelope(valid.localResult, 'fallback_budget_exceeded', valid.budget, [
      'INPUT_BUDGET_EXCEEDED',
    ]);
  }
  const reservation = reserveModelAgentBudget(valid.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    const errorCode = toV6ModelAgentErrorCode(reservation.code);
    return localEnvelope(
      valid.localResult,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  const request: ModelAgentRequest<WrongQuestionOrganizerV6ModelDecision> = {
    runId: valid.runId,
    task: 'wrong_question_organization',
    schema: WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    estimatedInputTokens,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    budget: safeCandidateBudgetSnapshot(valid.budget),
    ...(valid.signal ? { signal: valid.signal } : {}),
  };
  const runtimeResult = await invokeV6Structured({
    runtime: valid.runtime,
    request,
    dataSchema: WRONG_QUESTION_ORGANIZER_V6_MODEL_DECISION_SCHEMA,
    task: 'wrong_question_organization',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: valid.budget,
    previewBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(valid.localResult, reservation.budget);
  }
  const postRuntimeAbort = readV6AbortState(valid.signal);
  if (!postRuntimeAbort.ok) {
    return unavailableEnvelope(valid.localResult, runtimeResult.budget);
  }
  if (postRuntimeAbort.aborted) {
    return attemptedEnvelope(
      valid.localResult,
      'fallback_aborted',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['ABORTED'],
    );
  }
  if (!runtimeResult.ok) {
    return attemptedEnvelope(
      valid.localResult,
      mapModelAgentErrorDisposition(runtimeResult.error.code),
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }
  if (!(await revalidateAuthority(valid))) {
    return attemptedEnvelope(
      valid.localResult,
      'fallback_invalid_input',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['stale_shortlist'],
    );
  }

  const decision = validateWrongQuestionOrganizerV6ModelDecision({
    decision: runtimeResult.data,
    authority: valid.authority,
  });
  if (!decision.ok) {
    return attemptedEnvelope(
      valid.localResult,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [decision.reasonCode],
    );
  }
  const merged = mergeWrongQuestionOrganizerV6ModelDecision({
    authority: valid.authority,
    decision: decision.value,
    snapshotStable: true,
  });
  if (!merged.ok) {
    return attemptedEnvelope(
      valid.localResult,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [merged.reasonCode],
    );
  }
  return attemptedEnvelope(
    merged.value,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    ['local_shortlist_and_confidence_applied'],
  );
}

export function mergeWrongQuestionOrganizerV6ModelDecision(
  input: Readonly<{
    authority: WrongQuestionOrganizerV5ShortlistAuthority;
    decision: WrongQuestionOrganizerV6ValidatedDecision | WrongQuestionOrganizerV6ModelDecision;
    snapshotStable: boolean;
  }>,
): WrongQuestionOrganizerV6MergeResult {
  try {
    const authority = validateWrongQuestionOrganizerV5Shortlist(input.authority);
    if (!authority.ok || input.snapshotStable !== true) {
      return { ok: false, reasonCode: 'authority_merge_invalid' };
    }
    const rawDecision = isValidatedDecision(input.decision)
      ? {
          shortlistFingerprint: input.decision.shortlistFingerprint,
          decisions: input.decision.decisions.map((entry) => ({
            questionIndex: entry.questionIndex,
            subjectDecision: entry.subjectDecision,
            deckDecision: entry.deckDecision,
          })),
        }
      : input.decision;
    const validation = validateWrongQuestionOrganizerV6ModelDecision({
      decision: rawDecision,
      authority: authority.value,
    });
    if (
      !validation.ok ||
      validation.value.shortlistFingerprint !== authority.value.shortlistFingerprint
    ) {
      return { ok: false, reasonCode: 'authority_merge_invalid' };
    }

    const sourceById = new Map(
      authority.value.source.questions.map((question) => [question.id, question]),
    );
    const suggestions: WrongQuestionOrganizerV6Suggestion[] = [];
    for (const entry of validation.value.decisions) {
      const question = authority.value.questions[entry.questionIndex];
      if (!question) return { ok: false, reasonCode: 'authority_merge_invalid' };
      const source = sourceById.get(question.questionId);
      if (!source) return { ok: false, reasonCode: 'authority_merge_invalid' };
      const displayName = SUBJECT_DISPLAY_NAMES[entry.resolvedSubject];

      if (entry.deckDecision.action === 'reuse_existing') {
        const deck = authority.value.decks[entry.deckDecision.deckIndex];
        if (!deck || deck.subject !== entry.resolvedSubject) {
          return { ok: false, reasonCode: 'authority_merge_invalid' };
        }
        const confidence = deriveWrongQuestionOrganizerV6ConfidenceAuthority({
          shortlistFingerprint: authority.value.shortlistFingerprint,
          snapshotStable: true,
          questionIndex: question.questionIndex,
          resolvedSubject: entry.resolvedSubject,
          structuredSubject: question.structuredSubject,
          knowledgePointCount: countNonEmpty(source.knowledgePoints),
          categoryPresent: hasText(source.category),
          errorTypePresent: hasText(source.errorType),
          deckDecision: {
            action: 'reuse_existing',
            deckIndex: deck.deckIndex,
            targetSubject: deck.subject,
            directTopicOverlap: hasDirectTopicOverlap(source, question, deck),
          },
        });
        if (!confidence.ok) {
          return { ok: false, reasonCode: 'confidence_authority_invalid' };
        }
        suggestions.push({
          questionId: question.questionId,
          organization: {
            subjectKey: entry.resolvedSubject,
            subjectDisplayName: displayName,
            deckName: deck.name,
            deckDescription: `用于整理${displayName}中的${deck.name}相关错题。`,
            matchedDeckId: deck.deckId,
            reason: `V6 本地 shortlist 将模型 ordinal 解析到同一 owner 快照中的已有专题「${deck.name}」，名称与置信度均保持本地权威。`,
            confidence: confidence.value.confidence === 'high' ? 0.9 : 0.72,
            signals: ['v6LocalShortlist', 'v6LocalConfidence', 'existingDeck'],
          },
          selection: {
            source: 'model_ordinal',
            resolvedSubject: entry.resolvedSubject,
            confidence: confidence.value.confidence,
            confidenceAuthoritySha256: confidence.value.authoritySha256,
            deckDecision: {
              action: 'reuse_existing',
              deckIndex: deck.deckIndex,
              deckId: deck.deckId,
            },
          },
        });
        continue;
      }

      const topic = question.topicCandidates[entry.deckDecision.topicIndex];
      if (!topic || topic.subject !== entry.resolvedSubject) {
        return { ok: false, reasonCode: 'authority_merge_invalid' };
      }
      const duplicateDeck = authority.value.decks.find(
        (deck) =>
          deck.subject === entry.resolvedSubject && deck.normalizedName === topic.normalizedLabel,
      );
      if (duplicateDeck?.nameLocked) {
        return { ok: false, reasonCode: 'locked_name_violation' };
      }
      if (duplicateDeck !== undefined) {
        return { ok: false, reasonCode: 'duplicate_local_topic' };
      }
      const confidence = deriveWrongQuestionOrganizerV6ConfidenceAuthority({
        shortlistFingerprint: authority.value.shortlistFingerprint,
        snapshotStable: true,
        questionIndex: question.questionIndex,
        resolvedSubject: entry.resolvedSubject,
        structuredSubject: question.structuredSubject,
        knowledgePointCount: countNonEmpty(source.knowledgePoints),
        categoryPresent: hasText(source.category),
        errorTypePresent: hasText(source.errorType),
        deckDecision: {
          action: 'create_topic',
          topicIndex: topic.topicIndex,
          targetSubject: topic.subject,
          topicSource: topic.source,
        },
      });
      if (!confidence.ok) {
        return { ok: false, reasonCode: 'confidence_authority_invalid' };
      }
      suggestions.push({
        questionId: question.questionId,
        organization: {
          subjectKey: entry.resolvedSubject,
          subjectDisplayName: displayName,
          deckName: topic.label,
          deckDescription: `用于整理${displayName}中的${topic.label}相关错题。`,
          reason: `V6 本地 shortlist 将模型 ordinal 解析到本地候选「${topic.label}」，置信度由本地证据重建，写入仍需用户授权。`,
          confidence: confidence.value.confidence === 'high' ? 0.9 : 0.72,
          signals: ['v6LocalShortlist', 'v6LocalConfidence', topic.source],
        },
        selection: {
          source: 'model_ordinal',
          resolvedSubject: entry.resolvedSubject,
          confidence: confidence.value.confidence,
          confidenceAuthoritySha256: confidence.value.authoritySha256,
          deckDecision: {
            action: 'create_topic',
            topicIndex: topic.topicIndex,
            topicLabel: topic.label,
          },
        },
      });
    }
    return {
      ok: true,
      value: deepFreezeModelValue({
        binding: buildBinding(authority.value),
        suggestions,
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'authority_merge_invalid' };
  }
}

function validateInput(input: unknown): ValidInput | InvalidInput {
  try {
    const plain = readV6PlainInputObject(input, INPUT_KEYS, REQUIRED_INPUT_KEYS);
    if (!plain.ok) {
      return {
        ok: false,
        value: EMPTY_RESULT,
        budget: V6_SAFE_INVALID_BUDGET,
        reasonCode: 'invalid_input',
      };
    }
    const runId = plain.values.runId;
    const budget = cloneV6Budget(plain.values.budget) ?? V6_SAFE_INVALID_BUDGET;
    const runtime = snapshotV6Runtime(plain.values.runtime);
    const revalidateSource = snapshotV6Function(plain.values.revalidateSource);
    const signal = plain.values.signal;
    const shortlist = deriveWrongQuestionOrganizerV5Shortlist(plain.values.shortlistSource);
    if (!shortlist.ok) {
      return {
        ok: false,
        value: EMPTY_RESULT,
        budget,
        reasonCode: shortlist.reasonCode,
      };
    }
    const localResult = buildLocalResult(shortlist.value);
    if (
      typeof runId !== 'string' ||
      !runId.trim() ||
      runtime === null ||
      revalidateSource === null ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return { ok: false, value: localResult, budget, reasonCode: 'invalid_input' };
    }
    return {
      ok: true,
      runId,
      authority: shortlist.value,
      localResult,
      runtime,
      budget,
      revalidateSource,
      ...(signal instanceof AbortSignal ? { signal } : {}),
    };
  } catch {
    return {
      ok: false,
      value: EMPTY_RESULT,
      budget: V6_SAFE_INVALID_BUDGET,
      reasonCode: 'invalid_input',
    };
  }
}

const INPUT_KEYS = new Set([
  'runId',
  'shortlistSource',
  'runtime',
  'budget',
  'revalidateSource',
  'signal',
]);
const REQUIRED_INPUT_KEYS = [
  'runId',
  'shortlistSource',
  'runtime',
  'budget',
  'revalidateSource',
] as const;

async function revalidateAuthority(input: ValidInput) {
  try {
    const current = deriveWrongQuestionOrganizerV5Shortlist(await input.revalidateSource());
    return (
      current.ok &&
      current.value.shortlistFingerprint === input.authority.shortlistFingerprint &&
      current.value.source.ownerDomain === input.authority.source.ownerDomain &&
      current.value.source.ownerSnapshotVersion === input.authority.source.ownerSnapshotVersion &&
      current.value.source.ownerSnapshotFingerprint ===
        input.authority.source.ownerSnapshotFingerprint
    );
  } catch {
    return false;
  }
}

function buildLocalResult(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV6CandidateResult {
  const questionById = new Map(
    authority.source.questions.map((question) => [question.id, question]),
  );
  const suggestions = authority.questions.map((question) => {
    const source = questionById.get(question.questionId);
    if (!source) throw new Error('missing local question');
    const localSubject = question.structuredSubject ?? question.subjectCandidates[0] ?? 'other';
    const existingDecks = authority.decks
      .filter((deck) => deck.subject === localSubject)
      .map((deck) => ({
        id: deck.deckId,
        name: deck.name,
        nameLocked: deck.nameLocked,
        keywords: deck.keywords,
      }));
    return {
      questionId: question.questionId,
      organization: organizeWrongQuestion({
        wrongQuestion: {
          id: question.questionId,
          subject: SUBJECT_DISPLAY_NAMES[localSubject],
          category: source.category,
          knowledgePoints: source.knowledgePoints,
          errorType: source.errorType,
          questionText: source.questionText,
          analysis: source.analysis,
        },
        existingDecks,
      }),
      selection: { source: 'deterministic' as const },
    };
  });
  return deepFreezeModelValue({ binding: buildBinding(authority), suggestions });
}

function buildBinding(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV6CommandBinding {
  return {
    candidateVersion: WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
    ownerDomain: authority.source.ownerDomain,
    ownerSnapshotVersion: authority.source.ownerSnapshotVersion,
    ownerSnapshotFingerprint: authority.source.ownerSnapshotFingerprint,
    shortlistVersion: authority.version,
    shortlistFingerprint: authority.shortlistFingerprint,
    questionIds: authority.questions.map((question) => question.questionId),
  };
}

function isValidatedDecision(
  value: WrongQuestionOrganizerV6ValidatedDecision | WrongQuestionOrganizerV6ModelDecision,
): value is WrongQuestionOrganizerV6ValidatedDecision {
  try {
    return value.decisions.every((entry) => 'resolvedSubject' in entry);
  } catch {
    return false;
  }
}

function countNonEmpty(values: readonly string[] | null | undefined) {
  return values?.filter((value) => value.trim().length > 0).length ?? 0;
}

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDirectTopicOverlap(
  question: WrongQuestionOrganizerV5ShortlistSource['questions'][number],
  shortlistQuestion: WrongQuestionOrganizerV5ShortlistAuthority['questions'][number],
  deck: WrongQuestionOrganizerV5ShortlistAuthority['decks'][number],
) {
  const questionSignals = [
    ...(question.knowledgePoints ?? []),
    question.category,
    question.errorType,
    question.questionText,
    question.analysis,
    ...shortlistQuestion.topicCandidates.map((topic) => topic.label),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(normalizeText);
  const deckSignals = [deck.name, ...deck.keywords].map(normalizeText);
  const directMatch = deckSignals.some((deckSignal) =>
    questionSignals.some(
      (questionSignal) =>
        boundedContains(questionSignal, deckSignal) || boundedContains(deckSignal, questionSignal),
    ),
  );
  if (directMatch) return true;

  return V6_BOUNDED_TOPIC_EQUIVALENCE_GROUPS.some((group) => {
    const aliases = group.map(normalizeText);
    return (
      questionSignals.some((signal) => aliases.some((alias) => signalsOverlap(signal, alias))) &&
      deckSignals.some((signal) => aliases.some((alias) => signalsOverlap(signal, alias)))
    );
  });
}

function signalsOverlap(left: string, right: string) {
  return boundedContains(left, right) || boundedContains(right, left);
}

function boundedContains(left: string, right: string) {
  if (right.length < 2) return false;
  if (left.includes(right)) return true;
  const leftTokens = new Set(left.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 3));
  return right
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3)
    .some((token) => leftTokens.has(token));
}

function normalizeText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function localEnvelope(
  result: WrongQuestionOrganizerV6CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly WrongQuestionOrganizerV6CandidateReasonCode[],
): WrongQuestionOrganizerV6ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV6CandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: WrongQuestionOrganizerV6CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<WrongQuestionOrganizerV6CandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly WrongQuestionOrganizerV6CandidateReasonCode[],
): WrongQuestionOrganizerV6ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV6CandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: WrongQuestionOrganizerV6CandidateResult,
  budget: ModelAgentRunBudget,
): WrongQuestionOrganizerV6ModelCandidateEnvelope {
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
