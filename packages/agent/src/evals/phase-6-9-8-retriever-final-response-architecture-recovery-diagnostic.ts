import { z } from 'zod';

import {
  clonePlainModelData,
  deepFreezeModelValue,
} from '../model-candidates/model-projection-safety.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION =
  'phase-6.9.8-retriever-final-response-bounded-diagnostic-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-diagnostic-capability-v1' as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_PHASES = [
  'rewrite_original_retrieval',
  'rewrite_candidate_model',
  'rewrite_candidate_retrieval',
  'final_response_model',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES = [
  'admission',
  'request_contract',
  'provider_dispatch',
  'provider_response',
  'provider_envelope',
  'runtime_result',
  'rewrite_candidate_projection',
  'rewrite_local_authority',
  'embedding_contract',
  'ranking_contract',
  'stream_event_contract',
  'terminal_ledger',
  'citation_ledger',
  'trace_contract',
  'usage_contract',
  'cost_contract',
  'delivery_contract',
  'call_result_contract',
  'applied',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_REASON_CODES = [
  'invalid_input',
  'principal_binding_invalid',
  'capability_invalid',
  'aborted_before_dispatch',
  'aborted_after_dispatch',
  'timeout',
  'transport_failure',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_not_observed',
  'provider_envelope_invalid',
  'runtime_result_invalid',
  'provenance_invalid',
  'trace_missing',
  'trace_status_invalid',
  'trace_identity_invalid',
  'dispatch_count_invalid',
  'response_count_invalid',
  'usage_missing',
  'usage_invalid',
  'cost_mismatch',
  'result_shape_invalid',
  'phase_mismatch',
  'candidate_not_applied',
  'candidate_rejected',
  'fallback_original',
  'rewrite_authority_invalid',
  'unsafe_rewrite',
  'embedding_count_invalid',
  'embedding_dimension_invalid',
  'embedding_value_invalid',
  'ranking_invalid',
  'stream_event_invalid',
  'terminal_missing',
  'terminal_duplicate',
  'terminal_not_last',
  'citation_ledger_invalid',
  'grounding_invalid',
  'critical_notice_missing',
  'false_tool_success',
  'delivery_invalid',
  'applied',
  'unknown',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_PROVIDER_BOUNDARIES = [
  'not_dispatched',
  'dispatched_no_response',
  'response_observed',
  'response_and_usage_observed',
  'not_applicable',
  'unknown',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_TOP_LEVEL_TYPE_BUCKETS = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
  'not_observed',
  'unknown',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_COUNT_BUCKETS = [
  '0',
  '1',
  '2_4',
  '5_plus',
  'not_observed',
  'unknown',
] as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_TERMINAL_COUNT_BUCKETS = [
  '0',
  '1',
  '2_plus',
  'not_applicable',
  'unknown',
] as const;

export type Phase698ArchitectureRecoveryCallPhase =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_PHASES)[number];
export type Phase698ArchitectureRecoveryDiagnosticStage =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES)[number];
export type Phase698ArchitectureRecoveryDiagnosticReasonCode =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_REASON_CODES)[number];
export type Phase698ArchitectureRecoveryProviderBoundary =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_PROVIDER_BOUNDARIES)[number];
export type Phase698ArchitectureRecoveryTopLevelTypeBucket =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_TOP_LEVEL_TYPE_BUCKETS)[number];
export type Phase698ArchitectureRecoveryFieldCountBucket =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_COUNT_BUCKETS)[number];
export type Phase698ArchitectureRecoveryTerminalCountBucket =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_TERMINAL_COUNT_BUCKETS)[number];

const STAGE_SEQUENCES = deepFreezeModelValue({
  rewrite_original_retrieval: [
    'admission',
    'request_contract',
    'provider_dispatch',
    'provider_response',
    'provider_envelope',
    'embedding_contract',
    'usage_contract',
    'cost_contract',
    'ranking_contract',
    'call_result_contract',
    'applied',
  ],
  rewrite_candidate_model: [
    'admission',
    'request_contract',
    'provider_dispatch',
    'provider_response',
    'provider_envelope',
    'runtime_result',
    'rewrite_candidate_projection',
    'rewrite_local_authority',
    'trace_contract',
    'usage_contract',
    'cost_contract',
    'call_result_contract',
    'applied',
  ],
  rewrite_candidate_retrieval: [
    'admission',
    'request_contract',
    'provider_dispatch',
    'provider_response',
    'provider_envelope',
    'embedding_contract',
    'usage_contract',
    'cost_contract',
    'ranking_contract',
    'call_result_contract',
    'applied',
  ],
  final_response_model: [
    'admission',
    'request_contract',
    'provider_dispatch',
    'provider_response',
    'stream_event_contract',
    'terminal_ledger',
    'citation_ledger',
    'trace_contract',
    'usage_contract',
    'cost_contract',
    'delivery_contract',
    'call_result_contract',
    'applied',
  ],
} as const satisfies Record<
  Phase698ArchitectureRecoveryCallPhase,
  readonly Phase698ArchitectureRecoveryDiagnosticStage[]
>);

const REASONS_BY_STAGE = deepFreezeModelValue({
  admission: [
    'invalid_input',
    'principal_binding_invalid',
    'capability_invalid',
    'aborted_before_dispatch',
    'unknown',
  ],
  request_contract: ['invalid_input', 'aborted_before_dispatch', 'unknown'],
  provider_dispatch: ['aborted_before_dispatch', 'capability_invalid', 'unknown'],
  provider_response: [
    'aborted_after_dispatch',
    'timeout',
    'transport_failure',
    'http_auth',
    'http_rate_limit',
    'http_client',
    'http_server',
    'response_not_observed',
    'unknown',
  ],
  provider_envelope: ['provider_envelope_invalid', 'unknown'],
  runtime_result: ['runtime_result_invalid', 'provenance_invalid', 'unknown'],
  rewrite_candidate_projection: [
    'candidate_not_applied',
    'candidate_rejected',
    'fallback_original',
    'unsafe_rewrite',
    'unknown',
  ],
  rewrite_local_authority: ['rewrite_authority_invalid', 'unsafe_rewrite', 'unknown'],
  embedding_contract: [
    'embedding_count_invalid',
    'embedding_dimension_invalid',
    'embedding_value_invalid',
    'unknown',
  ],
  ranking_contract: ['ranking_invalid', 'unknown'],
  stream_event_contract: ['stream_event_invalid', 'unknown'],
  terminal_ledger: ['terminal_missing', 'terminal_duplicate', 'terminal_not_last', 'unknown'],
  citation_ledger: [
    'citation_ledger_invalid',
    'grounding_invalid',
    'critical_notice_missing',
    'false_tool_success',
    'unknown',
  ],
  trace_contract: ['trace_missing', 'trace_status_invalid', 'trace_identity_invalid', 'unknown'],
  usage_contract: [
    'dispatch_count_invalid',
    'response_count_invalid',
    'usage_missing',
    'usage_invalid',
    'unknown',
  ],
  cost_contract: ['cost_mismatch', 'unknown'],
  delivery_contract: ['delivery_invalid', 'unknown'],
  call_result_contract: ['result_shape_invalid', 'phase_mismatch', 'unknown'],
  applied: ['applied'],
} as const satisfies Record<
  Phase698ArchitectureRecoveryDiagnosticStage,
  readonly Phase698ArchitectureRecoveryDiagnosticReasonCode[]
>);

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA = z
  .object({
    diagnosticVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION),
    callPhase: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_PHASES),
    stage: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES),
    reasonCode: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_REASON_CODES),
    providerBoundary: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_PROVIDER_BOUNDARIES),
    topLevelTypeBucket: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_TOP_LEVEL_TYPE_BUCKETS),
    fieldCountBucket: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_COUNT_BUCKETS),
    terminalCountBucket: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_TERMINAL_COUNT_BUCKETS),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    const stageSequence: readonly Phase698ArchitectureRecoveryDiagnosticStage[] =
      STAGE_SEQUENCES[value.callPhase];
    const allowedReasons: readonly Phase698ArchitectureRecoveryDiagnosticReasonCode[] =
      REASONS_BY_STAGE[value.stage];
    if (!stageSequence.includes(value.stage)) {
      context.addIssue({ code: 'custom', message: 'stage is not valid for call phase' });
    }
    if (!allowedReasons.includes(value.reasonCode)) {
      context.addIssue({ code: 'custom', message: 'reason is not valid for stage' });
    }
    if (
      value.callPhase !== 'final_response_model' &&
      value.terminalCountBucket !== 'not_applicable'
    ) {
      context.addIssue({ code: 'custom', message: 'terminal count is not applicable' });
    }
    if (value.topLevelTypeBucket === 'not_observed') {
      if (value.fieldCountBucket !== 'not_observed') {
        context.addIssue({ code: 'custom', message: 'unobserved shape mismatch' });
      }
    } else if (
      value.topLevelTypeBucket !== 'object' &&
      value.topLevelTypeBucket !== 'unknown' &&
      value.fieldCountBucket !== '0'
    ) {
      context.addIssue({ code: 'custom', message: 'non-object field count mismatch' });
    }
    const stageIndex = stageSequence.indexOf(value.stage);
    const dispatchIndex = stageSequence.indexOf('provider_dispatch');
    const responseIndex = stageSequence.indexOf('provider_response');
    const usageIndex = stageSequence.indexOf('usage_contract');
    if (stageIndex < dispatchIndex && value.providerBoundary !== 'not_dispatched') {
      context.addIssue({ code: 'custom', message: 'pre-dispatch boundary mismatch' });
    }
    if (
      stageIndex > responseIndex &&
      value.providerBoundary !== 'response_observed' &&
      value.providerBoundary !== 'response_and_usage_observed'
    ) {
      context.addIssue({ code: 'custom', message: 'post-response boundary mismatch' });
    }
    if (stageIndex > usageIndex && value.providerBoundary !== 'response_and_usage_observed') {
      context.addIssue({ code: 'custom', message: 'post-usage boundary mismatch' });
    }
  });

export type Phase698ArchitectureRecoveryBoundedDiagnostic = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA
>;

export type Phase698ArchitectureRecoveryDiagnosticCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryDiagnosticSnapshot = Readonly<{
  callPhase: Phase698ArchitectureRecoveryCallPhase;
  completedStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
  providerBoundary: Phase698ArchitectureRecoveryProviderBoundary;
  topLevelTypeBucket: Phase698ArchitectureRecoveryTopLevelTypeBucket;
  fieldCountBucket: Phase698ArchitectureRecoveryFieldCountBucket;
  terminalCountBucket: Phase698ArchitectureRecoveryTerminalCountBucket;
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic | null;
}>;

type InternalDiagnosticState = {
  callPhase: Phase698ArchitectureRecoveryCallPhase;
  completedStages: Phase698ArchitectureRecoveryDiagnosticStage[];
  providerBoundary: Phase698ArchitectureRecoveryProviderBoundary;
  topLevelTypeBucket: Phase698ArchitectureRecoveryTopLevelTypeBucket;
  fieldCountBucket: Phase698ArchitectureRecoveryFieldCountBucket;
  terminalCountBucket: Phase698ArchitectureRecoveryTerminalCountBucket;
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic | null;
};

const diagnosticStates = new WeakMap<object, InternalDiagnosticState>();
const BOUNDARY_ORDER = new Map<Phase698ArchitectureRecoveryProviderBoundary, number>([
  ['not_dispatched', 0],
  ['dispatched_no_response', 1],
  ['response_observed', 2],
  ['response_and_usage_observed', 3],
]);

export function parsePhase698ArchitectureRecoveryDiagnostic(
  input: unknown,
): Phase698ArchitectureRecoveryBoundedDiagnostic | null {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return null;
    const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse(
      cloned.value,
    );
    return parsed.success ? deepFreezeModelValue(parsed.data) : null;
  } catch {
    return null;
  }
}

/** Internal recovery state factory. It is intentionally not re-exported from @repo/agent. */
export function createPhase698ArchitectureRecoveryDiagnosticState(
  callPhase: Phase698ArchitectureRecoveryCallPhase,
): Phase698ArchitectureRecoveryDiagnosticCapability {
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_CAPABILITY_VERSION,
  });
  diagnosticStates.set(capability, {
    callPhase,
    completedStages: [],
    providerBoundary: 'not_dispatched',
    topLevelTypeBucket: 'not_observed',
    fieldCountBucket: 'not_observed',
    terminalCountBucket: callPhase === 'final_response_model' ? 'unknown' : 'not_applicable',
    diagnostic: null,
  });
  return capability;
}

/** Internal recovery transition. It is intentionally not re-exported from @repo/agent. */
export function advancePhase698ArchitectureRecoveryDiagnosticStage(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
): boolean {
  const state = readState(capability);
  if (!state || state.diagnostic) return false;
  const expected = expectedStage(state);
  if (stage !== expected || stage === 'applied') {
    terminate(state, expected, 'unknown');
    return false;
  }
  state.completedStages.push(stage);
  return true;
}

/** Internal recovery terminal. It is intentionally not re-exported from @repo/agent. */
export function failPhase698ArchitectureRecoveryDiagnosticStage(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
  reasonCode: Phase698ArchitectureRecoveryDiagnosticReasonCode,
): boolean {
  const state = readState(capability);
  if (!state || state.diagnostic) return false;
  const expected = expectedStage(state);
  const allowedReasons: readonly Phase698ArchitectureRecoveryDiagnosticReasonCode[] =
    REASONS_BY_STAGE[stage];
  if (stage !== expected || stage === 'applied' || !allowedReasons.includes(reasonCode)) {
    terminate(state, expected, 'unknown');
    return false;
  }
  terminate(state, stage, reasonCode);
  return true;
}

/** Internal recovery completion. It is intentionally not re-exported from @repo/agent. */
export function completePhase698ArchitectureRecoveryDiagnosticState(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
): boolean {
  const state = readState(capability);
  if (!state || state.diagnostic) return false;
  const expected = expectedStage(state);
  if (expected !== 'applied') {
    terminate(state, expected, 'unknown');
    return false;
  }
  state.completedStages.push('applied');
  terminate(state, 'applied', 'applied');
  return true;
}

export function isPhase698ArchitectureRecoveryExpectedStage(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
): boolean {
  const state = readState(capability);
  return Boolean(state && !state.diagnostic && expectedStage(state) === stage);
}

export function setPhase698ArchitectureRecoveryProviderBoundary(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  boundary: Phase698ArchitectureRecoveryProviderBoundary,
): boolean {
  const state = readState(capability);
  if (!state || state.diagnostic) return false;
  const currentOrder = BOUNDARY_ORDER.get(state.providerBoundary);
  const nextOrder = BOUNDARY_ORDER.get(boundary);
  if (currentOrder === undefined || nextOrder === undefined || nextOrder !== currentOrder + 1) {
    return false;
  }
  state.providerBoundary = boundary;
  return true;
}

export function setPhase698ArchitectureRecoveryShapeBuckets(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
  shape: Readonly<{
    topLevelTypeBucket: Phase698ArchitectureRecoveryTopLevelTypeBucket;
    fieldCountBucket: Phase698ArchitectureRecoveryFieldCountBucket;
  }>,
): boolean {
  const state = readState(capability);
  if (
    !state ||
    state.diagnostic ||
    state.topLevelTypeBucket !== 'not_observed' ||
    state.fieldCountBucket !== 'not_observed'
  ) {
    return false;
  }
  state.topLevelTypeBucket = shape.topLevelTypeBucket;
  state.fieldCountBucket = shape.fieldCountBucket;
  return true;
}

export function readPhase698ArchitectureRecoveryDiagnostic(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
): Phase698ArchitectureRecoveryBoundedDiagnostic | null {
  return readState(capability)?.diagnostic ?? null;
}

export function readPhase698ArchitectureRecoveryDiagnosticSnapshot(
  capability: Phase698ArchitectureRecoveryDiagnosticCapability,
): Phase698ArchitectureRecoveryDiagnosticSnapshot | null {
  const state = readState(capability);
  if (!state) return null;
  return deepFreezeModelValue({
    callPhase: state.callPhase,
    completedStages: [...state.completedStages],
    providerBoundary: state.providerBoundary,
    topLevelTypeBucket: state.topLevelTypeBucket,
    fieldCountBucket: state.fieldCountBucket,
    terminalCountBucket: state.terminalCountBucket,
    diagnostic: state.diagnostic,
  });
}

function readState(capability: unknown): InternalDiagnosticState | null {
  if ((typeof capability !== 'object' && typeof capability !== 'function') || capability === null) {
    return null;
  }
  return diagnosticStates.get(capability) ?? null;
}

function expectedStage(
  state: InternalDiagnosticState,
): Phase698ArchitectureRecoveryDiagnosticStage {
  return STAGE_SEQUENCES[state.callPhase][state.completedStages.length] ?? 'applied';
}

function terminate(
  state: InternalDiagnosticState,
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
  reasonCode: Phase698ArchitectureRecoveryDiagnosticReasonCode,
) {
  const diagnostic = {
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase: state.callPhase,
    stage,
    reasonCode,
    providerBoundary: state.providerBoundary,
    topLevelTypeBucket: state.topLevelTypeBucket,
    fieldCountBucket: state.fieldCountBucket,
    terminalCountBucket: state.terminalCountBucket,
    rawDataRetained: false as const,
  };
  const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse(diagnostic);
  if (!parsed.success) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_INTERNAL');
  state.diagnostic = deepFreezeModelValue(parsed.data);
}
