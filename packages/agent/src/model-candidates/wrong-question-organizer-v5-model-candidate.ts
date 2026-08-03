import {
  isModelAgentRunBudget,
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
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_MODEL_DECISION_SCHEMA,
  formatWrongQuestionOrganizerV5ModelPolicyForPrompt,
  validateWrongQuestionOrganizerV5ModelDecision,
  type WrongQuestionOrganizerV5DecisionFailureCode,
  type WrongQuestionOrganizerV5ModelDecision,
  type WrongQuestionOrganizerV5ValidatedDecision,
} from './wrong-question-organizer-v5-model-contract.ts';
import {
  projectWrongQuestionOrganizerV5ModelInput,
  type WrongQuestionOrganizerV5ModelProjection,
} from './wrong-question-organizer-v5-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
  deriveWrongQuestionOrganizerV5Shortlist,
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistFailureCode,
  type WrongQuestionOrganizerV5ShortlistSource,
  type WrongQuestionOrganizerV5Subject,
} from './wrong-question-organizer-v5-shortlist.ts';

const MAX_INPUT_TOKENS = 3_500;
const MAX_OUTPUT_TOKENS = 800;

const SYSTEM_PROMPT = [
  'Select only bounded WrongQuestionOrganizer ordinals from the supplied JSON.',
  formatWrongQuestionOrganizerV5ModelPolicyForPrompt(),
].join('\n');

const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {shortlistFingerprint,decisions:[{questionIndex,subjectDecision:{action:keep_local|select_subject,subjectIndex?},deckDecision:{action:reuse_existing|create_topic,deckIndex?|topicIndex?},confidence:medium|high}]}. No extra fields.';

const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

const SUBJECT_DISPLAY_NAMES: Readonly<Record<WrongQuestionOrganizerV5Subject, string>> =
  deepFreezeModelValue({
    math: '数学',
    english: '英语',
    politics: '政治',
    computer: '计算机',
    major: '专业课',
    other: '其他',
  });

export type WrongQuestionOrganizerV5CommandBinding = Readonly<{
  ownerDomain: string;
  ownerSnapshotVersion: string;
  ownerSnapshotFingerprint: string;
  shortlistVersion: typeof WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION;
  shortlistFingerprint: string;
  questionIds: readonly string[];
}>;

export type WrongQuestionOrganizerV5Suggestion = Readonly<{
  questionId: string;
  organization: WrongQuestionOrganizerResult;
  selection:
    | Readonly<{ source: 'deterministic' }>
    | Readonly<{
        source: 'model_ordinal';
        resolvedSubject: WrongQuestionOrganizerV5Subject;
        confidence: 'medium' | 'high';
        deckDecision:
          | Readonly<{ action: 'reuse_existing'; deckIndex: number; deckId: string }>
          | Readonly<{ action: 'create_topic'; topicIndex: number; topicLabel: string }>;
      }>;
}>;

export type WrongQuestionOrganizerV5CandidateResult = Readonly<{
  binding: WrongQuestionOrganizerV5CommandBinding | null;
  suggestions: readonly WrongQuestionOrganizerV5Suggestion[];
}>;

export type WrongQuestionOrganizerV5ModelCandidateInput = Readonly<{
  runId: string;
  shortlistSource: WrongQuestionOrganizerV5ShortlistSource;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

export type WrongQuestionOrganizerV5CandidateReasonCode =
  | WrongQuestionOrganizerV5ShortlistFailureCode
  | WrongQuestionOrganizerV5DecisionFailureCode
  | ModelAgentErrorCode
  | 'candidate_shortlist_empty'
  | 'stale_shortlist'
  | 'local_shortlist_applied';

export type WrongQuestionOrganizerV5ModelCandidateEnvelope = ModelCandidateEnvelope<
  WrongQuestionOrganizerV5CandidateResult,
  WrongQuestionOrganizerV5CandidateReasonCode
>;

type ValidInput = Readonly<{
  ok: true;
  runId: string;
  authority: WrongQuestionOrganizerV5ShortlistAuthority;
  localResult: WrongQuestionOrganizerV5CandidateResult;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

type InvalidInput = Readonly<{
  ok: false;
  value: WrongQuestionOrganizerV5CandidateResult;
  budget: ModelAgentRunBudget;
  reasonCode: WrongQuestionOrganizerV5CandidateReasonCode;
}>;

const EMPTY_RESULT: WrongQuestionOrganizerV5CandidateResult = deepFreezeModelValue({
  binding: null,
  suggestions: [],
});

export async function runWrongQuestionOrganizerV5ModelCandidate(
  input: WrongQuestionOrganizerV5ModelCandidateInput,
): Promise<WrongQuestionOrganizerV5ModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(valid.value, 'fallback_invalid_input', valid.budget, [valid.reasonCode]);
  }

  const abort = readAbortState(valid.signal);
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

  const projection = projectWrongQuestionOrganizerV5ModelInput(valid.authority);
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
    const errorCode = toModelAgentErrorCode(reservation.code);
    return localEnvelope(
      valid.localResult,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  const runtimeResult = await invokeRuntime({
    input: valid,
    projection: projection.value,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(valid.localResult, reservation.budget);
  }
  const postRuntimeAbort = readAbortState(valid.signal);
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

  const decision = validateWrongQuestionOrganizerV5ModelDecision({
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
  const merged = mergeWrongQuestionOrganizerV5ModelDecision({
    authority: valid.authority,
    decision: decision.value,
  });
  if (merged === null) {
    return attemptedEnvelope(
      valid.localResult,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['authority_invalid'],
    );
  }
  return attemptedEnvelope(
    merged,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    ['local_shortlist_applied'],
  );
}

export function mergeWrongQuestionOrganizerV5ModelDecision(
  input: Readonly<{
    authority: WrongQuestionOrganizerV5ShortlistAuthority;
    decision: WrongQuestionOrganizerV5ValidatedDecision | WrongQuestionOrganizerV5ModelDecision;
  }>,
): WrongQuestionOrganizerV5CandidateResult | null {
  try {
    const authority = validateWrongQuestionOrganizerV5Shortlist(input.authority);
    if (!authority.ok) return null;
    const validation = isValidatedDecision(input.decision)
      ? ({ ok: true, value: input.decision } as const)
      : validateWrongQuestionOrganizerV5ModelDecision({
          decision: input.decision,
          authority: authority.value,
        });
    const decision = validation.ok ? validation.value : null;
    if (
      decision === null ||
      decision.shortlistFingerprint !== authority.value.shortlistFingerprint
    ) {
      return null;
    }
    const suggestions = decision.decisions.map((entry) => {
      const question = authority.value.questions[entry.questionIndex];
      if (!question) throw new Error('missing question authority');
      const displayName = SUBJECT_DISPLAY_NAMES[entry.resolvedSubject];
      if (entry.deckDecision.action === 'reuse_existing') {
        const deck = authority.value.decks[entry.deckDecision.deckIndex];
        if (!deck || deck.subject !== entry.resolvedSubject) throw new Error('stale deck ordinal');
        return {
          questionId: question.questionId,
          organization: {
            subjectKey: entry.resolvedSubject,
            subjectDisplayName: displayName,
            deckName: deck.name,
            deckDescription: `用于整理${displayName}中的${deck.name}相关错题。`,
            matchedDeckId: deck.deckId,
            reason: `V5 本地 shortlist 将模型 ordinal 解析到同一 owner 快照中的已有专题「${deck.name}」，专题名称保持本地权威。`,
            confidence: entry.confidence === 'high' ? 0.9 : 0.72,
            signals: ['v5LocalShortlist', 'existingDeck'],
          },
          selection: {
            source: 'model_ordinal' as const,
            resolvedSubject: entry.resolvedSubject,
            confidence: entry.confidence,
            deckDecision: {
              action: 'reuse_existing' as const,
              deckIndex: deck.deckIndex,
              deckId: deck.deckId,
            },
          },
        };
      }
      const topic = question.topicCandidates[entry.deckDecision.topicIndex];
      if (!topic || topic.subject !== entry.resolvedSubject) throw new Error('stale topic ordinal');
      return {
        questionId: question.questionId,
        organization: {
          subjectKey: entry.resolvedSubject,
          subjectDisplayName: displayName,
          deckName: topic.label,
          deckDescription: `用于整理${displayName}中的${topic.label}相关错题。`,
          reason: `V5 本地 shortlist 将模型 ordinal 解析到本地候选「${topic.label}」，仍需用户授权后由 model-free command 写入。`,
          confidence: entry.confidence === 'high' ? 0.9 : 0.72,
          signals: ['v5LocalShortlist', topic.source],
        },
        selection: {
          source: 'model_ordinal' as const,
          resolvedSubject: entry.resolvedSubject,
          confidence: entry.confidence,
          deckDecision: {
            action: 'create_topic' as const,
            topicIndex: topic.topicIndex,
            topicLabel: topic.label,
          },
        },
      };
    });
    return deepFreezeModelValue({
      binding: buildBinding(authority.value),
      suggestions,
    });
  } catch {
    return null;
  }
}

function validateInput(input: unknown): ValidInput | InvalidInput {
  try {
    const plain = readPlainInputObject(input);
    if (!plain.ok) {
      return {
        ok: false,
        value: EMPTY_RESULT,
        budget: SAFE_INVALID_BUDGET,
        reasonCode: 'invalid_input',
      };
    }
    const runId = plain.values.runId;
    const budget = cloneBudget(plain.values.budget) ?? SAFE_INVALID_BUDGET;
    const runtime = snapshotRuntime(plain.values.runtime);
    const revalidateSource = snapshotFunction(plain.values.revalidateSource);
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
      budget: SAFE_INVALID_BUDGET,
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

function readPlainInputObject(
  input: unknown,
): Readonly<{ ok: true; values: Record<string, unknown> }> | Readonly<{ ok: false }> {
  if (typeof input !== 'object' || input === null) return { ok: false };
  try {
    const prototype = Object.getPrototypeOf(input) as unknown;
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
  } catch {
    return { ok: false };
  }
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

function snapshotFunction(value: unknown): (() => unknown) | null {
  if (typeof value !== 'function') return null;
  const callable = value as () => unknown;
  return () => callable();
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

async function revalidateAuthority(input: ValidInput) {
  try {
    const current = deriveWrongQuestionOrganizerV5Shortlist(await input.revalidateSource());
    return (
      current.ok && current.value.shortlistFingerprint === input.authority.shortlistFingerprint
    );
  } catch {
    return false;
  }
}

function buildLocalResult(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV5CandidateResult {
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
): WrongQuestionOrganizerV5CommandBinding {
  return {
    ownerDomain: authority.source.ownerDomain,
    ownerSnapshotVersion: authority.source.ownerSnapshotVersion,
    ownerSnapshotFingerprint: authority.source.ownerSnapshotFingerprint,
    shortlistVersion: authority.version,
    shortlistFingerprint: authority.shortlistFingerprint,
    questionIds: authority.questions.map((question) => question.questionId),
  };
}

function isValidatedDecision(
  value: WrongQuestionOrganizerV5ValidatedDecision | WrongQuestionOrganizerV5ModelDecision,
): value is WrongQuestionOrganizerV5ValidatedDecision {
  return value.decisions.every((entry) => 'resolvedSubject' in entry);
}

function readAbortState(signal: AbortSignal | undefined) {
  if (signal === undefined) return { ok: true as const, aborted: false };
  try {
    return { ok: true as const, aborted: signal.aborted };
  } catch {
    return { ok: false as const };
  }
}

async function invokeRuntime(
  input: Readonly<{
    input: ValidInput;
    projection: WrongQuestionOrganizerV5ModelProjection;
    userPrompt: string;
    estimatedInputTokens: number;
    reservationBudget: ModelAgentRunBudget;
  }>,
) {
  let rawResult: unknown;
  try {
    const request: ModelAgentRequest<WrongQuestionOrganizerV5ModelDecision> = {
      runId: input.input.runId,
      task: 'wrong_question_organization',
      schema: WRONG_QUESTION_ORGANIZER_V5_MODEL_DECISION_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: input.userPrompt,
      estimatedInputTokens: input.estimatedInputTokens,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // The candidate reservation above is a fail-fast preview. ModelAgentRuntime owns the
      // actual reservation, so it must receive the untouched caller budget exactly once.
      budget: safeCandidateBudgetSnapshot(input.input.budget),
      ...(input.input.signal ? { signal: input.input.signal } : {}),
    };
    rawResult = await input.input.runtime.invokeStructured(request);
  } catch {
    return null;
  }
  return sanitizeModelCandidateRuntimeResult({
    value: rawResult,
    dataSchema: WRONG_QUESTION_ORGANIZER_V5_MODEL_DECISION_SCHEMA,
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
  result: WrongQuestionOrganizerV5CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly WrongQuestionOrganizerV5CandidateReasonCode[],
): WrongQuestionOrganizerV5ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV5CandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: WrongQuestionOrganizerV5CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<WrongQuestionOrganizerV5CandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly WrongQuestionOrganizerV5CandidateReasonCode[],
): WrongQuestionOrganizerV5ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV5CandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: WrongQuestionOrganizerV5CandidateResult,
  budget: ModelAgentRunBudget,
): WrongQuestionOrganizerV5ModelCandidateEnvelope {
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
