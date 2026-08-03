import {
  MODEL_CANDIDATE_DISPOSITIONS,
  isPhase697Sr6ProductReplayTrace,
  type ModelCandidateDisposition,
} from '@repo/agent/model-candidates';
import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
} from '@repo/ai';

import { estimateTutorRequestCostCny } from './tutor-model-pricing.ts';

const MODEL_AGENT_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
] as const satisfies readonly ModelAgentErrorCode[]);

const DEFAULT_DISPOSITION: ModelCandidateDisposition = 'fallback_invalid_input';
const ABSENT_DISPOSITION = 'not_present';
const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;

export type SafeChatModelAgentObservation = {
  attempted: boolean;
  disposition: ModelCandidateDisposition;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  usageUnavailable?: boolean;
  errorCode?: ModelAgentErrorCode | 'UNKNOWN';
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};

export type SafeTutorModelAgentObservation = SafeChatModelAgentObservation & {
  reasonCode: TutorSafeReasonCode;
  pricingKnown: boolean;
  costCny?: number;
  currency?: 'CNY';
};

export type ChatModelAgentObservationAggregate = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function projectChatModelAgentObservation(value: unknown): SafeChatModelAgentObservation {
  try {
    const attempted = readOwnData(value, 'attempted') === true;
    const disposition = toDisposition(readOwnData(value, 'disposition'));
    const usageUnavailableState = readOwnDataState(value, 'usageUnavailable');
    const usageUnavailable =
      usageUnavailableState.kind === 'descriptor_error' ||
      (usageUnavailableState.kind === 'data' && usageUnavailableState.value === true);
    const usage = readOwnData(value, 'usage');
    const trace = readOwnData(value, 'trace');
    const errorCode = toErrorCode(readOwnData(trace, 'errorCode'));
    const providerFailureCategory = toProviderFailureCategory(
      readOwnData(trace, 'providerFailureCategory'),
    );

    return {
      attempted,
      disposition,
      durationMs: toSafeCount(readOwnData(trace, 'durationMs')),
      inputTokens: usageUnavailable ? 0 : toSafeCount(readOwnData(usage, 'inputTokens')),
      outputTokens: usageUnavailable ? 0 : toSafeCount(readOwnData(usage, 'outputTokens')),
      ...(usageUnavailable ? { usageUnavailable: true } : {}),
      ...(errorCode ? { errorCode } : {}),
      ...(providerFailureCategory ? { providerFailureCategory } : {}),
    };
  } catch {
    return emptyObservation();
  }
}

export function projectTutorModelAgentObservation(value: unknown): SafeTutorModelAgentObservation {
  const projected = projectChatModelAgentObservation(value);
  try {
    const reasonCodes = readOwnData(value, 'reasonCodes');
    const detailReason = toTutorSafeReasonCode(readOwnData(reasonCodes, '1'));
    const isZeroProviderReplay = isPhase697Sr6ProductReplayTrace(
      readOwnData(value, 'trace'),
      'tutor_strategy',
    );
    const costCny =
      projected.attempted && !isZeroProviderReplay
        ? estimateTutorRequestCostCny({
            inputTokens: projected.inputTokens,
            outputTokens: projected.outputTokens,
          })
        : null;
    return {
      ...projected,
      reasonCode: detailReason ?? projected.disposition,
      pricingKnown: costCny !== null,
      ...(costCny === null ? {} : { costCny, currency: 'CNY' as const }),
    };
  } catch {
    return {
      ...projected,
      reasonCode: projected.disposition,
      pricingKnown: false,
    };
  }
}

export function aggregateChatModelAgentObservations(
  router: unknown,
  verifier?: unknown,
  tutor?: unknown,
): ChatModelAgentObservationAggregate {
  const routerObservation = projectChatModelAgentObservation(router);
  const verifierObservation =
    verifier === undefined ? undefined : projectChatModelAgentObservation(verifier);
  const tutorObservation =
    tutor === undefined ? undefined : projectTutorModelAgentObservation(tutor);
  return aggregateProjectedObservations(routerObservation, verifierObservation, tutorObservation);
}

export function buildChatModelAgentObservationHeaders(input: {
  router: unknown;
  verifier?: unknown;
  tutor?: unknown;
}): Record<string, string> {
  const router = projectChatModelAgentObservation(input.router);
  const verifier =
    input.verifier === undefined ? undefined : projectChatModelAgentObservation(input.verifier);
  const tutor =
    input.tutor === undefined ? undefined : projectTutorModelAgentObservation(input.tutor);
  const aggregate = aggregateProjectedObservations(router, verifier, tutor);

  return {
    ...observationHeaders('router', router),
    ...observationHeaders('verifier', verifier),
    ...(tutor === undefined
      ? {}
      : {
          ...observationHeaders('tutor', tutor),
          'x-prepmind-tutor-model-reason-code': tutor.reasonCode,
          'x-prepmind-tutor-model-pricing-known': String(tutor.pricingKnown),
          'x-prepmind-tutor-model-cost-cny': formatSafeCost(tutor.costCny),
          'x-prepmind-tutor-model-currency': tutor.currency ?? 'none',
        }),
    'x-prepmind-model-agent-calls': String(aggregate.calls),
    'x-prepmind-model-agent-input-tokens': String(aggregate.inputTokens),
    'x-prepmind-model-agent-output-tokens': String(aggregate.outputTokens),
    'x-prepmind-model-agent-total-tokens': String(aggregate.totalTokens),
  };
}

function aggregateProjectedObservations(
  router: SafeChatModelAgentObservation,
  verifier?: SafeChatModelAgentObservation,
  tutor?: SafeTutorModelAgentObservation,
): ChatModelAgentObservationAggregate {
  const inputTokens = saturatingAdd(
    saturatingAdd(router.inputTokens, verifier?.inputTokens ?? 0),
    tutor?.inputTokens ?? 0,
  );
  const outputTokens = saturatingAdd(
    saturatingAdd(router.outputTokens, verifier?.outputTokens ?? 0),
    tutor?.outputTokens ?? 0,
  );
  return {
    calls:
      Number(router.attempted) +
      Number(verifier?.attempted === true) +
      Number(tutor?.attempted === true),
    inputTokens,
    outputTokens,
    totalTokens: saturatingAdd(inputTokens, outputTokens),
  };
}

function observationHeaders(
  agent: 'router' | 'verifier' | 'tutor',
  observation?: SafeChatModelAgentObservation,
): Record<string, string> {
  const prefix = `x-prepmind-${agent}-model`;
  return {
    [`${prefix}-attempted`]: String(observation?.attempted ?? false),
    [`${prefix}-disposition`]: observation?.disposition ?? ABSENT_DISPOSITION,
    [`${prefix}-duration-ms`]: String(observation?.durationMs ?? 0),
    [`${prefix}-input-tokens`]: String(observation?.inputTokens ?? 0),
    [`${prefix}-output-tokens`]: String(observation?.outputTokens ?? 0),
    [`${prefix}-error-code`]: observation?.errorCode ?? 'none',
    [`${prefix}-provider-failure`]: observation?.providerFailureCategory ?? 'none',
  };
}

const TUTOR_SAFE_REASON_CODES = Object.freeze([
  ...MODEL_CANDIDATE_DISPOSITIONS,
  ...MODEL_AGENT_ERROR_CODES,
  'route_not_tutor',
  'empty_input',
  'no_ambiguous_learning_intent',
  'incompatible_depth',
  'explicit_answer_direct',
  'explicit_socratic_hint',
  'explicit_step_check',
  'explicit_concept_bridge',
  'explicit_explain_solution',
  'contextual_reference',
  'implicit_learning_request',
  'implicit_hint_request',
  'submitted_step',
  'concept_gap',
  'conflicting_intent_signals',
  'general_follow_up',
  'full_explanation_request',
  'ambiguous_intent',
  'invalid_input',
  'field_too_large',
  'credential_material',
  'instruction_override',
  'system_prompt_exfiltration',
  'control_character',
  'unsafe_metadata',
  'no_safe_projection',
  'answer_direct_not_model_eligible',
  'input_budget_exceeded',
  'schema_invalid',
  'invalid_evidence_association',
] as const);

export type TutorSafeReasonCode = (typeof TUTOR_SAFE_REASON_CODES)[number];

export function isTutorSafeReasonCode(value: unknown): value is TutorSafeReasonCode {
  return (
    typeof value === 'string' && (TUTOR_SAFE_REASON_CODES as readonly string[]).includes(value)
  );
}

function toTutorSafeReasonCode(value: unknown): TutorSafeReasonCode | undefined {
  return isTutorSafeReasonCode(value) ? value : undefined;
}

function formatSafeCost(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value.toFixed(12).replace(/0+$/u, '').replace(/\.$/u, '')
    : '0';
}

type OwnDataState =
  { kind: 'missing' } | { kind: 'data'; value: unknown } | { kind: 'descriptor_error' };

function readOwnDataState(value: unknown, key: string): OwnDataState {
  try {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      return { kind: 'missing' };
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { kind: 'missing' };
    return 'value' in descriptor
      ? { kind: 'data', value: descriptor.value }
      : { kind: 'descriptor_error' };
  } catch {
    return { kind: 'descriptor_error' };
  }
}

function readOwnData(value: unknown, key: string): unknown {
  try {
    if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function toDisposition(value: unknown): ModelCandidateDisposition {
  return typeof value === 'string' &&
    (MODEL_CANDIDATE_DISPOSITIONS as readonly string[]).includes(value)
    ? (value as ModelCandidateDisposition)
    : DEFAULT_DISPOSITION;
}

function toErrorCode(value: unknown): ModelAgentErrorCode | 'UNKNOWN' | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' && (MODEL_AGENT_ERROR_CODES as readonly string[]).includes(value)
    ? (value as ModelAgentErrorCode)
    : 'UNKNOWN';
}

function toProviderFailureCategory(value: unknown): ModelAgentProviderFailureCategory | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'string' &&
    (MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES as readonly string[]).includes(value)
    ? (value as ModelAgentProviderFailureCategory)
    : 'unknown';
}

function toSafeCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_SAFE_COUNT, Math.trunc(value));
}

function saturatingAdd(left: number, right: number): number {
  if (left >= MAX_SAFE_COUNT - right) return MAX_SAFE_COUNT;
  return left + right;
}

function emptyObservation(): SafeChatModelAgentObservation {
  return {
    attempted: false,
    disposition: DEFAULT_DISPOSITION,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}
