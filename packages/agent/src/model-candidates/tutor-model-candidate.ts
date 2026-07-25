import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import type { RouterResult } from '@repo/types/api/agent';

import {
  TUTOR_MODEL_DECISION_SCHEMA,
  formatTutorModelIntentPolicyForPrompt,
  formatTutorModelIntentPolicyForPromptV2,
  isTutorModelDepthCompatible,
  isTutorModelDepthCompatibleV2,
  isTutorModelIntentAtLeastAsSpecific,
  validateTutorModelDecision,
  validateTutorModelDecisionV2,
  type TutorModelDecision,
  type TutorModelDecisionValidationResult,
} from './tutor-model-contract.ts';
import {
  TUTOR_AMBIGUITY_SIGNAL_CODES,
  projectTutorModelInput,
  type TutorModelProjectionReasonCode,
} from './tutor-model-projection.ts';
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
import { clonePlainModelData } from './model-projection-safety.ts';
import {
  buildTutorStrategy,
  buildTutorStrategyFromIntent,
  detectTutorSignals,
  type TutorIntent,
  type TutorIntentSignalMatch,
  type TutorStrategy,
} from '../nodes/tutor.ts';

const MAX_INPUT_TOKENS = 1_200;
const MAX_OUTPUT_TOKENS = 300;

const SYSTEM_PROMPT_V4 = [
  'Classify only the bounded Tutor strategy request supplied as JSON.',
  formatTutorModelIntentPolicyForPrompt(),
  'Choose the most specific supported intent. Primary evidence is mandatory; allowed evidence is exhaustive; depth must be compatible.',
  'Never choose answer_direct, write an answer, reveal a final answer, execute tools, alter routing, or create permissions.',
].join('\n');
const SYSTEM_PROMPT_V2 = [
  'Classify only the bounded Tutor strategy request supplied as JSON.',
  formatTutorModelIntentPolicyForPromptV2(),
  'Choose the most specific supported intent. Primary evidence is mandatory; allowed evidence is exhaustive; depth must be compatible.',
  'Never choose answer_direct, write an answer, reveal a final answer, execute tools, alter routing, or create permissions.',
].join('\n');
const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"intent":"explain_solution|socratic_hint|step_check|concept_bridge|general_follow_up","depth":"brief|standard|deep","confidence":"medium|high","evidenceCodes":["allowed_code"]}. No extra fields.';

const ROUTE_NAMES = new Set<RouterResult['name']>([
  'chat',
  'tutor',
  'rag_answer',
  'study_plan',
  'review_analysis',
  'wrong_question_organize',
]);

const TUTOR_STRATEGY_SCHEMA = z
  .object({
    intent: z.enum([
      'explain_solution',
      'socratic_hint',
      'step_check',
      'concept_bridge',
      'answer_direct',
      'general_follow_up',
    ]),
    depth: z.enum(['brief', 'standard', 'deep']),
    shouldAskGuidingQuestion: z.boolean(),
    shouldGiveFinalAnswer: z.boolean(),
    shouldUseActiveStudyContext: z.boolean(),
    answerStructure: z
      .array(
        z.enum([
          'known_conditions',
          'concept',
          'reasoning_steps',
          'common_mistake',
          'final_answer',
          'guiding_question',
        ]),
      )
      .max(6),
    promptAddition: z.string().min(1).max(4_096),
    debug: z
      .object({
        reason: z.string().max(512),
        matchedSignals: z.array(z.string().max(128)).max(32),
      })
      .strict(),
  })
  .strict();

const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

const EXPLICIT_REASON_BY_INTENT = {
  answer_direct: 'explicit_answer_direct',
  socratic_hint: 'explicit_socratic_hint',
  step_check: 'explicit_step_check',
  concept_bridge: 'explicit_concept_bridge',
  explain_solution: 'explicit_explain_solution',
} as const;

type TutorAmbiguitySignal = (typeof TUTOR_AMBIGUITY_SIGNAL_CODES)[number];
type ExplicitTutorReason =
  (typeof EXPLICIT_REASON_BY_INTENT)[keyof typeof EXPLICIT_REASON_BY_INTENT];

export type TutorModelCandidateReasonCode =
  | TutorModelProjectionReasonCode
  | TutorAmbiguitySignal
  | TutorModelDecision['evidenceCodes'][number]
  | ExplicitTutorReason
  | ModelAgentErrorCode
  | Extract<TutorModelDecisionValidationResult, { ok: false }>['reasonCode']
  | 'route_not_tutor'
  | 'empty_input'
  | 'no_ambiguous_learning_intent'
  | 'incompatible_depth';

export type TutorModelSafetyState = 'safe_for_model' | 'unsafe' | 'unknown';

export type TutorModelCandidateInput = {
  runId: string;
  finalRoute: RouterResult['name'];
  latestUserText: string;
  activeStudyContext?: string;
  deterministic: TutorStrategy;
  safety: {
    latestUserText: TutorModelSafetyState;
    activeStudyContext?: TutorModelSafetyState;
  };
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type TutorModelCandidateEnvelope = ModelCandidateEnvelope<
  TutorStrategy,
  TutorModelCandidateReasonCode
>;

type ValidInput = {
  ok: true;
  runId: string;
  finalRoute: RouterResult['name'];
  latestUserText: string;
  activeStudyContext?: string;
  deterministic: TutorStrategy;
  safety: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

type InvalidInput = {
  ok: false;
  value: TutorStrategy;
  budget: ModelAgentRunBudget;
};

type TutorCandidatePolicy = Readonly<{
  systemPrompt: string;
  validateDecision: (input: unknown) => TutorModelDecisionValidationResult;
  isDepthCompatible: (
    intent: TutorModelDecision['intent'],
    depth: TutorModelDecision['depth'],
  ) => boolean;
  enforceIntentPrecedence: boolean;
}>;

const TUTOR_CANDIDATE_POLICY_V4: TutorCandidatePolicy = Object.freeze({
  systemPrompt: SYSTEM_PROMPT_V4,
  validateDecision: validateTutorModelDecision,
  isDepthCompatible: isTutorModelDepthCompatible,
  enforceIntentPrecedence: true,
});

const TUTOR_CANDIDATE_POLICY_V2: TutorCandidatePolicy = Object.freeze({
  systemPrompt: SYSTEM_PROMPT_V2,
  validateDecision: validateTutorModelDecisionV2,
  isDepthCompatible: isTutorModelDepthCompatibleV2,
  enforceIntentPrecedence: false,
});

export async function runTutorModelCandidate(
  input: TutorModelCandidateInput,
): Promise<TutorModelCandidateEnvelope> {
  return runTutorModelCandidateWithPolicy(input, TUTOR_CANDIDATE_POLICY_V4);
}

export async function runTutorModelCandidateV2(
  input: TutorModelCandidateInput,
): Promise<TutorModelCandidateEnvelope> {
  return runTutorModelCandidateWithPolicy(input, TUTOR_CANDIDATE_POLICY_V2);
}

async function runTutorModelCandidateWithPolicy(
  input: TutorModelCandidateInput,
  policy: TutorCandidatePolicy,
): Promise<TutorModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(valid.value, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }

  if (valid.finalRoute !== 'tutor') {
    return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, ['route_not_tutor']);
  }

  const abort = readAbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(valid.deterministic, 'fallback_invalid_input', valid.budget, [
      'invalid_input',
    ]);
  }
  if (abort.aborted) {
    return localEnvelope(valid.deterministic, 'fallback_aborted', valid.budget, ['ABORTED']);
  }

  const detection = detectTutorSignals(valid.latestUserText);
  if (!detection.normalizedText) {
    return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, ['empty_input']);
  }

  const meaningfulMatches = meaningfulIntentMatches(detection.intentMatches);
  const ambiguitySignals = deriveAmbiguitySignals({
    text: detection.normalizedText,
    hasActiveStudyContext: Boolean(valid.activeStudyContext?.trim()),
    deterministicIntent: valid.deterministic.intent,
    meaningfulMatches,
  });
  const projected = projectTutorModelInput({
    latestUserText: valid.latestUserText,
    ...(valid.activeStudyContext !== undefined
      ? { activeStudyContext: valid.activeStudyContext }
      : {}),
    deterministicIntent: valid.deterministic.intent,
    deterministicDepth: valid.deterministic.depth,
    ambiguitySignals,
    safety: valid.safety,
  });
  if (!projected.ok) {
    return projectionFailureEnvelope(valid.deterministic, valid.budget, projected.reasonCode);
  }

  if (valid.deterministic.intent === 'answer_direct') {
    return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, [
      'explicit_answer_direct',
    ]);
  }

  if (meaningfulMatches.length === 1) {
    const explicitReason = explicitReasonForIntent(meaningfulMatches[0]?.intent);
    if (explicitReason) {
      return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, [explicitReason]);
    }
  }
  if (meaningfulMatches.length === 0 && ambiguitySignals.length === 0) {
    return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, [
      'no_ambiguous_learning_intent',
    ]);
  }

  const userPrompt = JSON.stringify(projected.value);
  const estimatedInputTokens = estimateCandidateInputTokens([
    policy.systemPrompt,
    userPrompt,
    SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return localEnvelope(valid.deterministic, 'fallback_budget_exceeded', valid.budget, [
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
      valid.deterministic,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  // This immutable preview proves admission. The shared runtime receives the
  // caller snapshot and performs the single authoritative reservation itself.
  const runtimeResult = await invokeRuntime({
    input: valid,
    systemPrompt: policy.systemPrompt,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(valid.deterministic, reservation.budget);
  }
  const postRuntimeAbort = readAbortState(valid.signal);
  if (!postRuntimeAbort.ok) {
    return unavailableEnvelope(valid.deterministic, runtimeResult.budget);
  }
  if (postRuntimeAbort.aborted) {
    return attemptedEnvelope(
      valid.deterministic,
      'fallback_aborted',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['ABORTED'],
    );
  }
  if (!runtimeResult.ok) {
    return attemptedEnvelope(
      valid.deterministic,
      mapModelAgentErrorDisposition(runtimeResult.error.code),
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }

  const decision = policy.validateDecision(runtimeResult.data);
  if (!decision.ok) {
    return attemptedEnvelope(
      valid.deterministic,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [decision.reasonCode],
    );
  }
  if (
    policy.enforceIntentPrecedence &&
    !isTutorModelIntentAtLeastAsSpecific(decision.value.intent, valid.deterministic.intent)
  ) {
    return attemptedEnvelope(
      valid.deterministic,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['invalid_evidence_association'],
    );
  }
  const merged = mergeTutorModelDecisionWithPolicy(valid.deterministic, decision.value, policy);
  if (merged === null) {
    return attemptedEnvelope(
      valid.deterministic,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['incompatible_depth'],
    );
  }

  return attemptedEnvelope(
    merged,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    ambiguitySignals.length > 0 ? ambiguitySignals : decision.value.evidenceCodes,
  );
}

export function mergeTutorModelDecision(
  deterministic: TutorStrategy,
  decision: TutorModelDecision,
): TutorStrategy | null {
  return mergeTutorModelDecisionWithPolicy(deterministic, decision, TUTOR_CANDIDATE_POLICY_V4);
}

function mergeTutorModelDecisionWithPolicy(
  deterministic: TutorStrategy,
  decision: TutorModelDecision,
  policy: TutorCandidatePolicy,
): TutorStrategy | null {
  try {
    const local = cloneTutorStrategy(deterministic);
    if (local === null) return null;
    if (local.intent === 'answer_direct') return null;
    const validated = policy.validateDecision(decision);
    if (!validated.ok) return null;
    if (
      policy.enforceIntentPrecedence &&
      !isTutorModelIntentAtLeastAsSpecific(validated.value.intent, local.intent)
    ) {
      return null;
    }
    if (!policy.isDepthCompatible(validated.value.intent, validated.value.depth)) return null;

    const merged = buildTutorStrategyFromIntent({
      intent: validated.value.intent,
      depth: validated.value.depth,
      hasActiveStudyContext: local.shouldUseActiveStudyContext,
      debug: {
        reason: 'Governed Tutor candidate selected a bounded strategy.',
        matchedSignals: validated.value.evidenceCodes.map((code) => `model:${code}`),
      },
    });
    if (
      merged.intent === 'answer_direct' ||
      (merged.intent === 'socratic_hint' &&
        (merged.shouldGiveFinalAnswer || merged.answerStructure.includes('final_answer')))
    ) {
      return null;
    }
    return merged;
  } catch {
    return null;
  }
}

function validateInput(input: unknown): ValidInput | InvalidInput {
  const safeFallback = buildTutorStrategy({ latestUserText: '' });
  try {
    const source = readPlainInputObject(input);
    if (!source.ok) {
      return { ok: false, value: safeFallback, budget: SAFE_INVALID_BUDGET };
    }

    const runId = source.values.runId;
    const finalRoute = source.values.finalRoute;
    const latestUserText = source.values.latestUserText;
    const activeStudyContext = source.values.activeStudyContext;
    const signal = source.values.signal;
    const localFallback =
      typeof latestUserText === 'string' &&
      (activeStudyContext === undefined || typeof activeStudyContext === 'string')
        ? buildTutorStrategy({
            latestUserText,
            ...(typeof activeStudyContext === 'string' ? { activeStudyContext } : {}),
          })
        : safeFallback;
    const budget = cloneBudget(source.values.budget) ?? SAFE_INVALID_BUDGET;
    const deterministic = cloneTutorStrategy(source.values.deterministic);
    const runtime = snapshotRuntime(source.values.runtime);
    if (
      typeof runId !== 'string' ||
      !runId.trim() ||
      typeof finalRoute !== 'string' ||
      !ROUTE_NAMES.has(finalRoute as RouterResult['name']) ||
      typeof latestUserText !== 'string' ||
      (activeStudyContext !== undefined && typeof activeStudyContext !== 'string') ||
      deterministic === null ||
      !strategiesEqual(deterministic, localFallback) ||
      runtime === null ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return { ok: false, value: localFallback, budget };
    }

    return {
      ok: true,
      runId,
      finalRoute: finalRoute as RouterResult['name'],
      latestUserText,
      ...(typeof activeStudyContext === 'string' ? { activeStudyContext } : {}),
      deterministic,
      safety: source.values.safety,
      runtime,
      budget,
      ...(signal instanceof AbortSignal ? { signal } : {}),
    };
  } catch {
    return { ok: false, value: safeFallback, budget: SAFE_INVALID_BUDGET };
  }
}

const INPUT_KEYS = new Set([
  'runId',
  'finalRoute',
  'latestUserText',
  'activeStudyContext',
  'deterministic',
  'safety',
  'runtime',
  'budget',
  'signal',
]);
const REQUIRED_INPUT_KEYS = [
  'runId',
  'finalRoute',
  'latestUserText',
  'deterministic',
  'safety',
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

function cloneTutorStrategy(value: unknown): TutorStrategy | null {
  const cloned = clonePlainModelData(value);
  if (!cloned.ok) return null;
  const parsed = TUTOR_STRATEGY_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return null;
  const candidate = parsed.data;
  const canonical = buildTutorStrategyFromIntent({
    intent: candidate.intent,
    depth: candidate.depth,
    hasActiveStudyContext: candidate.shouldUseActiveStudyContext,
    debug: candidate.debug,
  });
  return strategiesEqual(candidate, canonical) ? candidate : null;
}

function strategiesEqual(left: TutorStrategy, right: TutorStrategy): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function meaningfulIntentMatches(
  matches: readonly TutorIntentSignalMatch[],
): readonly TutorIntentSignalMatch[] {
  const selected = matches[0];
  if (!selected) return [];
  return matches.filter((match) => {
    if (
      selected.intent === 'concept_bridge' &&
      match.intent === 'explain_solution' &&
      match.matchedSignals.every((signal) => signal === 'explain' || signal === '解释')
    ) {
      return false;
    }
    return true;
  });
}

function deriveAmbiguitySignals(input: {
  text: string;
  hasActiveStudyContext: boolean;
  deterministicIntent: TutorIntent;
  meaningfulMatches: readonly TutorIntentSignalMatch[];
}): TutorAmbiguitySignal[] {
  const signals: TutorAmbiguitySignal[] = [];
  const push = (signal: TutorAmbiguitySignal) => {
    if (!signals.includes(signal)) signals.push(signal);
  };
  const text = input.text;

  if (input.meaningfulMatches.length > 1) push('conflicting_intent_signals');
  if (
    input.hasActiveStudyContext &&
    /(?:这里|这一步|那接下来|接下来|继续|where we left off|next part|this part|that move)/iu.test(
      text,
    )
  ) {
    push('contextual_reference');
  }
  if (
    /(?:卡住|没跟上|不懂|别.{0,12}(?:说完|讲完|揭晓)|nudge|\bstuck\b|without revealing|one nudge at a time|let me work it out)/iu.test(
      text,
    )
  ) {
    push('implicit_learning_request');
  }
  if (
    /(?:我(?:把|算|写|得到|推到|代入)|有没有算偏|帮我判断|i reached|my substitution|inspect (?:that|this) move|verify (?:that|this) move)/iu.test(
      text,
    )
  ) {
    push('submitted_step');
  }
  if (
    /(?:背后|核心依据|没串起来|不明白.{0,16}(?:联系|结论|依据)|underlying idea|principle behind|fuzzy|connect.{0,16}(?:idea|principle))/iu.test(
      text,
    )
  ) {
    push('concept_gap');
  }
  if (
    /(?:完整|不要省略|完整推导|complete chain|whole derivation|intermediate transitions|from the givens)/iu.test(
      text,
    )
  ) {
    push('implicit_learning_request');
  }
  if (input.deterministicIntent === 'general_follow_up' && input.hasActiveStudyContext) {
    push('general_follow_up');
  }
  return signals;
}

function explicitReasonForIntent(intent: TutorIntent | undefined): ExplicitTutorReason | null {
  if (intent === undefined || intent === 'general_follow_up') return null;
  return EXPLICIT_REASON_BY_INTENT[intent];
}

function projectionFailureEnvelope(
  deterministic: TutorStrategy,
  budget: ModelAgentRunBudget,
  reasonCode: TutorModelProjectionReasonCode,
): TutorModelCandidateEnvelope {
  if (reasonCode === 'input_budget_exceeded') {
    return localEnvelope(deterministic, 'fallback_budget_exceeded', budget, [reasonCode]);
  }
  if (
    reasonCode === 'credential_material' ||
    reasonCode === 'instruction_override' ||
    reasonCode === 'system_prompt_exfiltration' ||
    reasonCode === 'control_character' ||
    reasonCode === 'unsafe_metadata'
  ) {
    return localEnvelope(deterministic, 'safety_blocked', budget, [reasonCode]);
  }
  if (reasonCode === 'no_safe_projection' || reasonCode === 'answer_direct_not_model_eligible') {
    return localEnvelope(deterministic, 'not_eligible', budget, [reasonCode]);
  }
  return localEnvelope(deterministic, 'fallback_invalid_input', budget, [reasonCode]);
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
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  reservationBudget: ModelAgentRunBudget;
}) {
  let rawResult: unknown;
  try {
    const request: ModelAgentRequest<TutorModelDecision> = {
      runId: input.input.runId,
      task: 'tutor_strategy',
      schema: TUTOR_MODEL_DECISION_SCHEMA,
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
    dataSchema: TUTOR_MODEL_DECISION_SCHEMA,
    task: 'tutor_strategy',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: input.input.budget,
    previewBudget: input.reservationBudget,
  });
}

function toModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET' ? 'INVALID_REQUEST' : (code as ModelAgentErrorCode);
}

function localEnvelope(
  result: TutorStrategy,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly TutorModelCandidateReasonCode[],
): TutorModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: TutorStrategy,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<
    Exclude<ModelCandidateObservation<TutorModelCandidateReasonCode>, { attempted: false }>['trace']
  >,
  reasons: readonly TutorModelCandidateReasonCode[],
): TutorModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: TutorStrategy,
  budget: ModelAgentRunBudget,
): TutorModelCandidateEnvelope {
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
