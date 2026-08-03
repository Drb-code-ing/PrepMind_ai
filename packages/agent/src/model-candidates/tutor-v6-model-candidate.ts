import { z } from 'zod';

import {
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import type { RouterResult } from '@repo/types/api/agent';

import {
  buildTutorStrategy,
  buildTutorStrategyFromIntent,
  type TutorStrategy,
} from '../nodes/tutor.ts';
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
import { clonePlainModelData } from './model-projection-safety.ts';
import {
  TUTOR_V6_MODEL_DECISION_SCHEMA,
  formatTutorV6ModelPolicyForPrompt,
  validateTutorV6ModelDecision,
  type TutorV6ModelDecision,
  type TutorV6ModelDecisionFailureCode,
  type TutorV6ValidatedDecision,
} from './tutor-v6-model-contract.ts';
import {
  projectTutorV6ModelInput,
  type TutorV6ModelProjectionReasonCode,
} from './tutor-v6-model-projection.ts';
import type { TutorV5LocalSignalAuthority } from './tutor-v5-local-signal-authority.ts';
import type { TutorV6PreferredDepthAuthority } from './tutor-v6-preferred-depth-authority.ts';
import {
  V6_SAFE_INVALID_BUDGET,
  cloneV6Budget,
  invokeV6Structured,
  readV6AbortState,
  readV6PlainInputObject,
  snapshotV6Runtime,
  toV6ModelAgentErrorCode,
} from './v6-model-candidate-support.ts';

const MAX_INPUT_TOKENS = 1_200;
const MAX_OUTPUT_TOKENS = 300;

const SYSTEM_PROMPT = [
  'Classify only the bounded Tutor intent supplied as JSON.',
  formatTutorV6ModelPolicyForPrompt(),
].join('\n');

const SCHEMA_DESCRIPTOR = 'Output strict JSON: {"intentIndex":0}. No extra fields.';

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

export type TutorV6ModelSafetyState = 'safe_for_model' | 'unsafe' | 'unknown';

export type TutorV6ModelCandidateInput = Readonly<{
  runId: string;
  finalRoute: RouterResult['name'];
  latestUserText: string;
  activeStudyContext?: string;
  deterministic: TutorStrategy;
  safety: Readonly<{
    latestUserText: TutorV6ModelSafetyState;
    activeStudyContext?: TutorV6ModelSafetyState;
  }>;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
}>;

export type TutorV6ModelCandidateReasonCode =
  | TutorV6ModelProjectionReasonCode
  | TutorV6ModelDecisionFailureCode
  | ModelAgentErrorCode
  | 'route_not_tutor'
  | 'local_intent_and_preferred_depth_applied'
  | 'authority_merge_invalid';

export type TutorV6ModelCandidateEnvelope = ModelCandidateEnvelope<
  TutorStrategy,
  TutorV6ModelCandidateReasonCode
>;

type ValidInput = Readonly<{
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
}>;

type InvalidInput = Readonly<{
  ok: false;
  value: TutorStrategy;
  budget: ModelAgentRunBudget;
}>;

export async function runTutorV6ModelCandidate(
  input: TutorV6ModelCandidateInput,
): Promise<TutorV6ModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(valid.value, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }
  if (valid.finalRoute !== 'tutor') {
    return localEnvelope(valid.deterministic, 'not_eligible', valid.budget, ['route_not_tutor']);
  }

  const abort = readV6AbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(valid.deterministic, 'fallback_invalid_input', valid.budget, [
      'invalid_input',
    ]);
  }
  if (abort.aborted) {
    return localEnvelope(valid.deterministic, 'fallback_aborted', valid.budget, ['ABORTED']);
  }

  const projected = projectTutorV6ModelInput({
    latestUserText: valid.latestUserText,
    ...(valid.activeStudyContext !== undefined
      ? { activeStudyContext: valid.activeStudyContext }
      : {}),
    safety: valid.safety,
  });
  if (!projected.ok) {
    return projectionFailureEnvelope(valid.deterministic, valid.budget, projected.reasonCode);
  }

  const userPrompt = JSON.stringify(projected.value.prompt);
  const estimatedInputTokens = estimateCandidateInputTokens([
    SYSTEM_PROMPT,
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
    const errorCode = toV6ModelAgentErrorCode(reservation.code);
    return localEnvelope(
      valid.deterministic,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  const request: ModelAgentRequest<TutorV6ModelDecision> = {
    runId: valid.runId,
    task: 'tutor_strategy',
    schema: TUTOR_V6_MODEL_DECISION_SCHEMA,
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
    dataSchema: TUTOR_V6_MODEL_DECISION_SCHEMA,
    task: 'tutor_strategy',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: valid.budget,
    previewBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(valid.deterministic, reservation.budget);
  }
  const postRuntimeAbort = readV6AbortState(valid.signal);
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

  const decision = validateTutorV6ModelDecision({
    decision: runtimeResult.data,
    signalAuthority: projected.value.signalAuthority,
    preferredDepthAuthority: projected.value.preferredDepthAuthority,
  });
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
  const merged = mergeTutorV6ModelDecision({
    deterministic: valid.deterministic,
    signalAuthority: projected.value.signalAuthority,
    preferredDepthAuthority: projected.value.preferredDepthAuthority,
    decision: decision.value,
  });
  if (merged === null) {
    return attemptedEnvelope(
      valid.deterministic,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['authority_merge_invalid'],
    );
  }
  return attemptedEnvelope(
    merged,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    ['local_intent_and_preferred_depth_applied'],
  );
}

export function mergeTutorV6ModelDecision(
  input: Readonly<{
    deterministic: TutorStrategy;
    signalAuthority: TutorV5LocalSignalAuthority;
    preferredDepthAuthority: TutorV6PreferredDepthAuthority;
    decision: TutorV6ValidatedDecision | TutorV6ModelDecision;
  }>,
): TutorStrategy | null {
  try {
    const local = cloneTutorStrategy(input.deterministic);
    if (local === null) return null;
    const rawDecision = isTutorV6ValidatedDecision(input.decision)
      ? { intentIndex: input.decision.intentIndex }
      : input.decision;
    const decision = validateTutorV6ModelDecision({
      decision: rawDecision,
      signalAuthority: input.signalAuthority,
      preferredDepthAuthority: input.preferredDepthAuthority,
    });
    if (!decision.ok) return null;
    const choice = input.preferredDepthAuthority.choices[decision.value.intentIndex];
    if (choice === undefined || choice.intent !== decision.value.intent) return null;
    const merged = buildTutorStrategyFromIntent({
      intent: choice.intent,
      depth: choice.preferredDepth,
      hasActiveStudyContext: choice.shouldUseActiveStudyContext,
      debug: {
        reason: 'V6 local authorities resolved one model-owned intent ordinal.',
        matchedSignals: ['local:intent_ordinal', 'local:preferred_depth'],
      },
    });
    if (
      merged.intent === 'answer_direct' ||
      merged.depth !== choice.preferredDepth ||
      merged.shouldAskGuidingQuestion !== choice.shouldAskGuidingQuestion ||
      merged.shouldGiveFinalAnswer !== choice.shouldGiveFinalAnswer ||
      merged.shouldUseActiveStudyContext !== choice.shouldUseActiveStudyContext ||
      !sameValues(merged.answerStructure, choice.answerStructure) ||
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
    const source = readV6PlainInputObject(input, INPUT_KEYS, REQUIRED_INPUT_KEYS);
    if (!source.ok) {
      return { ok: false, value: safeFallback, budget: V6_SAFE_INVALID_BUDGET };
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
    const budget = cloneV6Budget(source.values.budget) ?? V6_SAFE_INVALID_BUDGET;
    const deterministic = cloneTutorStrategy(source.values.deterministic);
    const runtime = snapshotV6Runtime(source.values.runtime);
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
    return { ok: false, value: safeFallback, budget: V6_SAFE_INVALID_BUDGET };
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

function strategiesEqual(left: TutorStrategy, right: TutorStrategy) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isTutorV6ValidatedDecision(
  value: TutorV6ValidatedDecision | TutorV6ModelDecision,
): value is TutorV6ValidatedDecision {
  try {
    return typeof value === 'object' && value !== null && 'intent' in value;
  } catch {
    return false;
  }
}

function projectionFailureEnvelope(
  deterministic: TutorStrategy,
  budget: ModelAgentRunBudget,
  reasonCode: TutorV6ModelProjectionReasonCode,
): TutorV6ModelCandidateEnvelope {
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
  if (
    reasonCode === 'answer_direct_local_only' ||
    reasonCode === 'explicit_instruction_local_only' ||
    reasonCode === 'no_model_signal'
  ) {
    return localEnvelope(deterministic, 'not_eligible', budget, [reasonCode]);
  }
  return localEnvelope(deterministic, 'fallback_invalid_input', budget, [reasonCode]);
}

function sameValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function localEnvelope(
  result: TutorStrategy,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly TutorV6ModelCandidateReasonCode[],
): TutorV6ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorV6ModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: TutorStrategy,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<TutorV6ModelCandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly TutorV6ModelCandidateReasonCode[],
): TutorV6ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorV6ModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: TutorStrategy,
  budget: ModelAgentRunBudget,
): TutorV6ModelCandidateEnvelope {
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
