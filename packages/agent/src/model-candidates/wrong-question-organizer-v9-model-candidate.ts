import {
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';

import { organizeWrongQuestion } from '../nodes/wrong-question-organizer.ts';
import {
  ZERO_CANDIDATE_USAGE,
  canonicalCandidateReasonCodes,
  mapModelAgentErrorDisposition,
  safeCandidateBudgetSnapshot,
  type ModelCandidateDisposition,
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
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistFailureCode,
  type WrongQuestionOrganizerV5ShortlistSource,
  type WrongQuestionOrganizerV5Subject,
} from './wrong-question-organizer-v5-shortlist.ts';
import {
  mergeWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6CandidateReasonCode,
  type WrongQuestionOrganizerV6CandidateResult,
  type WrongQuestionOrganizerV6MergeFailureCode,
} from './wrong-question-organizer-v6-model-candidate.ts';
import {
  validateWrongQuestionOrganizerV9ModelDecision,
  type WrongQuestionOrganizerV9DecisionFailureCode,
  type WrongQuestionOrganizerV9ModelDecision,
} from './wrong-question-organizer-v9-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  buildWrongQuestionOrganizerV9PromptParts,
} from './wrong-question-organizer-v9-model-projection.ts';
import {
  deriveWrongQuestionOrganizerV9OptionAuthority,
  type WrongQuestionOrganizerV9OptionAuthority,
  type WrongQuestionOrganizerV9OptionAuthorityFailureCode,
} from './wrong-question-organizer-v9-option-authority.ts';
import { createWrongQuestionOrganizerV9RuntimeAdapter } from './wrong-question-organizer-v9-runtime-adapter.ts';
import {
  createWrongQuestionOrganizerV9SchemaDiagnosticCollector,
  type WrongQuestionOrganizerV9BoundedSchemaDiagnostic,
} from './wrong-question-organizer-v9-schema-diagnostic.ts';

const MAX_OUTPUT_TOKENS = 800;

const SUBJECT_DISPLAY_NAMES: Readonly<Record<WrongQuestionOrganizerV5Subject, string>> =
  deepFreezeModelValue({
    math: '数学',
    english: '英语',
    politics: '政治',
    computer: '计算机',
    major: '专业课',
    other: '其他',
  });

export type WrongQuestionOrganizerV9CommandBinding = Readonly<{
  candidateVersion: typeof WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION;
  ownerDomain: string;
  ownerSnapshotVersion: string;
  ownerSnapshotFingerprint: string;
  shortlistVersion: typeof WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION;
  shortlistFingerprint: string;
  questionIds: readonly string[];
}>;

export type WrongQuestionOrganizerV9CandidateResult = Readonly<{
  binding: WrongQuestionOrganizerV9CommandBinding | null;
  suggestions: WrongQuestionOrganizerV6CandidateResult['suggestions'];
}>;

export type WrongQuestionOrganizerV9ModelCandidateInput = Readonly<{
  runId: string;
  shortlistSource: WrongQuestionOrganizerV5ShortlistSource;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

export type WrongQuestionOrganizerV9CandidateReasonCode =
  | WrongQuestionOrganizerV5ShortlistFailureCode
  | WrongQuestionOrganizerV6CandidateReasonCode
  | WrongQuestionOrganizerV6MergeFailureCode
  | WrongQuestionOrganizerV9OptionAuthorityFailureCode
  | WrongQuestionOrganizerV9DecisionFailureCode
  | ModelAgentErrorCode
  | 'stale_shortlist'
  | 'local_option_authority_and_confidence_applied';

export type WrongQuestionOrganizerV9ModelCandidateEnvelope = Readonly<{
  result: WrongQuestionOrganizerV9CandidateResult;
  observation: ModelCandidateObservation<WrongQuestionOrganizerV9CandidateReasonCode>;
  boundedSchemaDiagnostic: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null;
}>;

type ValidBaseInput = Readonly<{
  ok: true;
  runId: string;
  authority: WrongQuestionOrganizerV5ShortlistAuthority;
  localResult: WrongQuestionOrganizerV9CandidateResult;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  revalidateSource: () => unknown;
  signal?: AbortSignal;
}>;

type InvalidBaseInput = Readonly<{
  ok: false;
  result: WrongQuestionOrganizerV9CandidateResult;
  budget: ModelAgentRunBudget;
  reasonCode: WrongQuestionOrganizerV9CandidateReasonCode;
}>;

const EMPTY_RESULT: WrongQuestionOrganizerV9CandidateResult = deepFreezeModelValue({
  binding: null,
  suggestions: [],
});

export async function runWrongQuestionOrganizerV9ModelCandidate(
  input: WrongQuestionOrganizerV9ModelCandidateInput,
): Promise<WrongQuestionOrganizerV9ModelCandidateEnvelope> {
  const diagnosticCollector = createWrongQuestionOrganizerV9SchemaDiagnosticCollector();
  const base = validateBaseInput(input);
  if (!base.ok) {
    return localEnvelope(
      base.result,
      'fallback_invalid_input',
      base.budget,
      [base.reasonCode],
      null,
    );
  }

  const abort = readV6AbortState(base.signal);
  if (!abort.ok) {
    return localEnvelope(
      base.localResult,
      'fallback_invalid_input',
      base.budget,
      ['invalid_input'],
      null,
    );
  }
  if (abort.aborted) {
    return localEnvelope(base.localResult, 'fallback_aborted', base.budget, ['ABORTED'], null);
  }

  const optionAuthority = deriveWrongQuestionOrganizerV9OptionAuthority(base.authority);
  if (!optionAuthority.ok) {
    return optionAuthorityFailureEnvelope(base, optionAuthority.reasonCode, diagnosticCollector);
  }
  if (!(await revalidateAuthority(base, optionAuthority.value))) {
    return localEnvelope(
      base.localResult,
      'fallback_invalid_input',
      base.budget,
      ['stale_shortlist'],
      null,
    );
  }

  const prompt = buildWrongQuestionOrganizerV9PromptParts(optionAuthority.value.projection);
  if (
    !prompt.ok ||
    prompt.value.estimatedInputTokens !== optionAuthority.value.estimatedInputTokens ||
    prompt.value.estimatedInputTokens > WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS
  ) {
    diagnosticCollector.recordOptionAuthorityFailure();
    return localEnvelope(
      base.localResult,
      'fallback_invalid_input',
      base.budget,
      ['candidate_option_authority_invalid'],
      diagnosticCollector.read(),
    );
  }

  const adapter = createWrongQuestionOrganizerV9RuntimeAdapter({
    runtime: base.runtime,
    projection: optionAuthority.value.projection,
    diagnosticCollector,
  });
  if (adapter === null || adapter.estimatedInputTokens !== prompt.value.estimatedInputTokens) {
    diagnosticCollector.recordOptionAuthorityFailure();
    return localEnvelope(
      base.localResult,
      'fallback_invalid_input',
      base.budget,
      ['candidate_option_authority_invalid'],
      diagnosticCollector.read(),
    );
  }

  const reservation = reserveModelAgentBudget(base.budget, {
    inputTokens: prompt.value.estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    const errorCode = toV6ModelAgentErrorCode(reservation.code);
    return localEnvelope(
      base.localResult,
      mapModelAgentErrorDisposition(errorCode),
      base.budget,
      [errorCode],
      null,
    );
  }

  const request: ModelAgentRequest<WrongQuestionOrganizerV9ModelDecision> = {
    runId: base.runId,
    task: 'wrong_question_organization',
    schema: diagnosticCollector.schema,
    systemPrompt: prompt.value.parts[0],
    userPrompt: prompt.value.userPrompt,
    estimatedInputTokens: prompt.value.estimatedInputTokens,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    budget: safeCandidateBudgetSnapshot(base.budget),
    ...(base.signal ? { signal: base.signal } : {}),
  };
  const runtimeResult = await invokeV6Structured({
    runtime: adapter.runtime,
    request,
    dataSchema: diagnosticCollector.schema,
    task: 'wrong_question_organization',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: base.budget,
    previewBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(base.localResult, reservation.budget, diagnosticCollector.read());
  }

  const postRuntimeAbort = readV6AbortState(base.signal);
  if (!postRuntimeAbort.ok) {
    return unavailableEnvelope(base.localResult, runtimeResult.budget, diagnosticCollector.read());
  }
  if (postRuntimeAbort.aborted) {
    return attemptedEnvelope(
      base.localResult,
      'fallback_aborted',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['ABORTED'],
      diagnosticCollector.read(),
    );
  }
  if (!runtimeResult.ok) {
    if (
      runtimeResult.trace.structuredOutputStage === 'provider_type_validation' &&
      diagnosticCollector.read() === null
    ) {
      diagnosticCollector.recordUnknownFailure();
    }
    return attemptedEnvelope(
      base.localResult,
      mapModelAgentErrorDisposition(runtimeResult.error.code),
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
      diagnosticCollector.read(),
    );
  }
  if (!(await revalidateAuthority(base, optionAuthority.value))) {
    return attemptedEnvelope(
      base.localResult,
      'fallback_invalid_input',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['stale_shortlist'],
      diagnosticCollector.read(),
    );
  }

  const decision = validateWrongQuestionOrganizerV9ModelDecision({
    decision: runtimeResult.data,
    authority: optionAuthority.value,
  });
  if (!decision.ok) {
    diagnosticCollector.recordSelectionFailure(runtimeResult.data, decision.reasonCode);
    return attemptedEnvelope(
      base.localResult,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [decision.reasonCode],
      diagnosticCollector.read(),
    );
  }
  const merged = mergeWrongQuestionOrganizerV6ModelDecision({
    authority: base.authority,
    decision: decision.value,
    snapshotStable: true,
  });
  if (!merged.ok) {
    diagnosticCollector.recordSelectionFailure(runtimeResult.data, 'selection_authority_invalid');
    return attemptedEnvelope(
      base.localResult,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [merged.reasonCode],
      diagnosticCollector.read(),
    );
  }
  return attemptedEnvelope(
    liftV6Result(merged.value),
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    ['local_option_authority_and_confidence_applied'],
    null,
  );
}

function validateBaseInput(input: unknown): ValidBaseInput | InvalidBaseInput {
  try {
    const plain = readV6PlainInputObject(input, INPUT_KEYS, REQUIRED_INPUT_KEYS);
    if (!plain.ok) {
      return {
        ok: false,
        result: EMPTY_RESULT,
        budget: V6_SAFE_INVALID_BUDGET,
        reasonCode: 'invalid_input',
      };
    }
    const budget = cloneV6Budget(plain.values.budget) ?? V6_SAFE_INVALID_BUDGET;
    const shortlist = deriveWrongQuestionOrganizerV5Shortlist(plain.values.shortlistSource);
    if (!shortlist.ok) {
      return {
        ok: false,
        result: EMPTY_RESULT,
        budget,
        reasonCode: shortlist.reasonCode,
      };
    }
    const localResult = buildLocalResult(shortlist.value);
    const runtime = snapshotV6Runtime(plain.values.runtime);
    const revalidateSource = snapshotV6Function(plain.values.revalidateSource);
    const signal = plain.values.signal;
    if (
      typeof plain.values.runId !== 'string' ||
      plain.values.runId.trim().length === 0 ||
      runtime === null ||
      revalidateSource === null ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return {
        ok: false,
        result: localResult,
        budget,
        reasonCode: 'invalid_input',
      };
    }
    return {
      ok: true,
      runId: plain.values.runId,
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
      result: EMPTY_RESULT,
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

async function revalidateAuthority(
  input: ValidBaseInput,
  expected: WrongQuestionOrganizerV9OptionAuthority,
) {
  try {
    const currentShortlist = deriveWrongQuestionOrganizerV5Shortlist(
      await input.revalidateSource(),
    );
    if (!currentShortlist.ok) return false;
    const currentOptions = deriveWrongQuestionOrganizerV9OptionAuthority(currentShortlist.value);
    return (
      currentOptions.ok &&
      currentShortlist.value.shortlistFingerprint === expected.sourceShortlistFingerprint &&
      currentOptions.value.optionSetFingerprint === expected.optionSetFingerprint &&
      currentShortlist.value.source.ownerDomain === input.authority.source.ownerDomain &&
      currentShortlist.value.source.ownerSnapshotVersion ===
        input.authority.source.ownerSnapshotVersion &&
      currentShortlist.value.source.ownerSnapshotFingerprint ===
        input.authority.source.ownerSnapshotFingerprint
    );
  } catch {
    return false;
  }
}

function buildLocalResult(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV9CandidateResult {
  const questionById = new Map(
    authority.source.questions.map((question) => [question.id, question]),
  );
  const suggestions = authority.questions.map((question) => {
    const source = questionById.get(question.questionId);
    if (!source) throw new Error('V9_LOCAL_QUESTION_MISSING');
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
): WrongQuestionOrganizerV9CommandBinding {
  return {
    candidateVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
    ownerDomain: authority.source.ownerDomain,
    ownerSnapshotVersion: authority.source.ownerSnapshotVersion,
    ownerSnapshotFingerprint: authority.source.ownerSnapshotFingerprint,
    shortlistVersion: authority.version,
    shortlistFingerprint: authority.shortlistFingerprint,
    questionIds: authority.questions.map((question) => question.questionId),
  };
}

function liftV6Result(result: WrongQuestionOrganizerV6CandidateResult) {
  return deepFreezeModelValue({
    binding: result.binding
      ? {
          candidateVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
          ownerDomain: result.binding.ownerDomain,
          ownerSnapshotVersion: result.binding.ownerSnapshotVersion,
          ownerSnapshotFingerprint: result.binding.ownerSnapshotFingerprint,
          shortlistVersion: result.binding.shortlistVersion,
          shortlistFingerprint: result.binding.shortlistFingerprint,
          questionIds: result.binding.questionIds,
        }
      : null,
    suggestions: result.suggestions,
  });
}

function optionAuthorityFailureEnvelope(
  input: ValidBaseInput,
  reason: WrongQuestionOrganizerV9OptionAuthorityFailureCode,
  diagnosticCollector: ReturnType<typeof createWrongQuestionOrganizerV9SchemaDiagnosticCollector>,
) {
  if (reason === 'candidate_option_authority_empty') {
    return localEnvelope(input.localResult, 'not_eligible', input.budget, [reason], null);
  }
  if (reason === 'candidate_option_authority_budget_exceeded') {
    return localEnvelope(
      input.localResult,
      'fallback_budget_exceeded',
      input.budget,
      [reason],
      null,
    );
  }
  diagnosticCollector.recordOptionAuthorityFailure();
  return localEnvelope(
    input.localResult,
    'fallback_invalid_input',
    input.budget,
    [reason],
    diagnosticCollector.read(),
  );
}

function localEnvelope(
  result: WrongQuestionOrganizerV9CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly WrongQuestionOrganizerV9CandidateReasonCode[],
  diagnostic: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null,
): WrongQuestionOrganizerV9ModelCandidateEnvelope {
  return deepFreezeModelValue({
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV9CandidateReasonCode>,
    boundedSchemaDiagnostic: diagnostic,
  });
}

function attemptedEnvelope(
  result: WrongQuestionOrganizerV9CandidateResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<WrongQuestionOrganizerV9CandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly WrongQuestionOrganizerV9CandidateReasonCode[],
  diagnostic: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null,
): WrongQuestionOrganizerV9ModelCandidateEnvelope {
  return deepFreezeModelValue({
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<WrongQuestionOrganizerV9CandidateReasonCode>,
    boundedSchemaDiagnostic: diagnostic,
  });
}

function unavailableEnvelope(
  result: WrongQuestionOrganizerV9CandidateResult,
  budget: ModelAgentRunBudget,
  diagnostic: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null,
): WrongQuestionOrganizerV9ModelCandidateEnvelope {
  return deepFreezeModelValue({
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
    boundedSchemaDiagnostic: diagnostic,
  });
}
