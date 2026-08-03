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
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import { clonePlainModelData } from './model-projection-safety.ts';
import {
  TUTOR_V5_MODEL_DECISION_SCHEMA,
  formatTutorV5ModelPolicyForPrompt,
  validateTutorV5ModelDecision,
  type TutorV5ModelDecision,
  type TutorV5ModelDecisionFailureCode,
} from './tutor-v5-model-contract.ts';
import {
  projectTutorV5ModelInput,
  type TutorV5ModelProjectionReasonCode,
} from './tutor-v5-model-projection.ts';
import {
  validateTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
} from './tutor-v5-local-signal-authority.ts';

const MAX_INPUT_TOKENS = 1_200;
const MAX_OUTPUT_TOKENS = 300;

const SYSTEM_PROMPT = [
  'Classify only the bounded Tutor strategy request supplied as JSON.',
  formatTutorV5ModelPolicyForPrompt(),
].join('\n');

const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"intent":"step_check|explain_solution|concept_bridge|socratic_hint|general_follow_up","depth":"brief|standard|deep","confidence":"medium|high"}. No extra fields.';

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

export type TutorV5ModelSafetyState = 'safe_for_model' | 'unsafe' | 'unknown';

export type TutorV5ModelCandidateInput = Readonly<{
  runId: string;
  finalRoute: RouterResult['name'];
  latestUserText: string;
  activeStudyContext?: string;
  deterministic: TutorStrategy;
  safety: Readonly<{
    latestUserText: TutorV5ModelSafetyState;
    activeStudyContext?: TutorV5ModelSafetyState;
  }>;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
}>;

export type TutorV5ModelCandidateReasonCode =
  | TutorV5ModelProjectionReasonCode
  | TutorV5ModelDecisionFailureCode
  | ModelAgentErrorCode
  | 'route_not_tutor'
  | 'local_authority_applied';

export type TutorV5ModelCandidateEnvelope = ModelCandidateEnvelope<
  TutorStrategy,
  TutorV5ModelCandidateReasonCode
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

export async function runTutorV5ModelCandidate(
  input: TutorV5ModelCandidateInput,
): Promise<TutorV5ModelCandidateEnvelope> {
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

  const projected = projectTutorV5ModelInput({
    latestUserText: valid.latestUserText,
    ...(valid.activeStudyContext !== undefined
      ? { activeStudyContext: valid.activeStudyContext }
      : {}),
    deterministicIntent: valid.deterministic.intent,
    deterministicDepth: valid.deterministic.depth,
    safety: valid.safety,
  });
  if (!projected.ok) {
    return projectionFailureEnvelope(valid.deterministic, valid.budget, projected.reasonCode);
  }

  const userPrompt = JSON.stringify(projected.value);
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
    const errorCode = toModelAgentErrorCode(reservation.code);
    return localEnvelope(
      valid.deterministic,
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

  const decision = validateTutorV5ModelDecision({
    decision: runtimeResult.data,
    authority: projected.value.localAuthority,
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
  const merged = mergeTutorV5ModelDecision({
    deterministic: valid.deterministic,
    authority: projected.value.localAuthority,
    decision: decision.value,
  });
  if (merged === null) {
    return attemptedEnvelope(
      valid.deterministic,
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
    ['local_authority_applied'],
  );
}

export function mergeTutorV5ModelDecision(
  input: Readonly<{
    deterministic: TutorStrategy;
    authority: TutorV5LocalSignalAuthority;
    decision: TutorV5ModelDecision;
  }>,
): TutorStrategy | null {
  try {
    const local = cloneTutorStrategy(input.deterministic);
    if (local === null) return null;
    const authority = validateTutorV5LocalSignalAuthority(input.authority);
    if (!authority.ok) return null;
    if (authority.value.input.activeContextAvailable !== local.shouldUseActiveStudyContext)
      return null;
    const decision = validateTutorV5ModelDecision({
      decision: input.decision,
      authority: authority.value,
    });
    if (!decision.ok) return null;

    const merged = buildTutorStrategyFromIntent({
      intent: decision.value.intent,
      depth: decision.value.depth,
      hasActiveStudyContext: authority.value.input.activeContextAvailable,
      debug: {
        reason: 'V5 local signal authority approved a bounded Tutor model choice.',
        matchedSignals: authority.value.evidenceCodes.map((code) => `local:${code}`),
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
    if (!source.ok) return { ok: false, value: safeFallback, budget: SAFE_INVALID_BUDGET };
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
): Readonly<{ ok: true; values: Record<string, unknown> }> | Readonly<{ ok: false }> {
  if (typeof input !== 'object' || input === null) return { ok: false };
  try {
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
  } catch {
    return { ok: false };
  }
}

function snapshotRuntime(value: unknown): Pick<ModelAgentRuntime, 'invokeStructured'> | null {
  try {
    if (typeof value !== 'object' || value === null) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, 'invokeStructured');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'function')
      return null;
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

function strategiesEqual(left: TutorStrategy, right: TutorStrategy) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readAbortState(signal: AbortSignal | undefined) {
  if (signal === undefined) return { ok: true as const, aborted: false };
  try {
    return { ok: true as const, aborted: signal.aborted };
  } catch {
    return { ok: false as const };
  }
}

function projectionFailureEnvelope(
  deterministic: TutorStrategy,
  budget: ModelAgentRunBudget,
  reasonCode: TutorV5ModelProjectionReasonCode,
): TutorV5ModelCandidateEnvelope {
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

async function invokeRuntime(
  input: Readonly<{
    input: ValidInput;
    userPrompt: string;
    estimatedInputTokens: number;
    reservationBudget: ModelAgentRunBudget;
  }>,
) {
  let rawResult: unknown;
  try {
    const request: ModelAgentRequest<TutorV5ModelDecision> = {
      runId: input.input.runId,
      task: 'tutor_strategy',
      schema: TUTOR_V5_MODEL_DECISION_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
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
    dataSchema: TUTOR_V5_MODEL_DECISION_SCHEMA,
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
  reasons: readonly TutorV5ModelCandidateReasonCode[],
): TutorV5ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorV5ModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  result: TutorStrategy,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<TutorV5ModelCandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly TutorV5ModelCandidateReasonCode[],
): TutorV5ModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<TutorV5ModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  result: TutorStrategy,
  budget: ModelAgentRunBudget,
): TutorV5ModelCandidateEnvelope {
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
