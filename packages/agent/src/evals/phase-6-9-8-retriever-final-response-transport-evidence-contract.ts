import { z } from 'zod';

import {
  clonePlainModelData,
  deepFreezeModelValue,
} from '../model-candidates/model-projection-safety.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE =
  'phase-6.9.8-retriever-final-response-transport-evidence-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-diagnostic-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-capability-v1' as const;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES = [
  'rewrite',
  'qwen',
  'final_response',
] as const;
export type Phase698TransportEvidenceFamily =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_PHASES = PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES;
export type Phase698TransportEvidencePhase = (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_PHASES)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES = [
  'preflight',
  'dispatch_started',
  'response_observed',
  'usage_observed',
  'terminal',
] as const;
export type Phase698TransportEvidenceStage = (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_REASON_CODES = [
  'applied',
  'aborted',
  'timeout',
  'dns',
  'tls',
  'proxy',
  'connection_refused',
  'connection_reset',
  'network_unreachable',
  'http_status',
  'envelope_invalid',
  'schema_invalid',
  'stream_event_invalid',
  'usage_invalid',
  'unknown',
] as const;
export type Phase698TransportEvidenceReasonCode =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_REASON_CODES)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_BOUNDARIES = [
  'not_dispatched',
  'dispatched_no_response',
  'response_observed',
  'response_and_usage_observed',
  'unknown',
] as const;
export type Phase698TransportEvidenceProviderBoundary =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_BOUNDARIES)[number];

const WIRE_BIT = z.union([z.literal(0), z.literal(1)]);

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_RUNNER_WIRE_SCHEMA = z
  .object({
    reservations: WIRE_BIT,
    dispatches: WIRE_BIT,
    harnessReturns: WIRE_BIT,
    verifiedResults: WIRE_BIT,
  })
  .strict();
export type Phase698TransportEvidenceRunnerWire = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_RUNNER_WIRE_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_WIRE_SCHEMA = z
  .object({
    executions: WIRE_BIT,
    dispatches: WIRE_BIT,
    responses: WIRE_BIT,
    verifiedUsage: WIRE_BIT,
  })
  .strict();
export type Phase698TransportEvidenceProviderWire = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_WIRE_SCHEMA
>;

const REASONS_BY_STAGE: Record<
  Phase698TransportEvidenceStage,
  readonly Phase698TransportEvidenceReasonCode[]
> = {
  preflight: ['aborted', 'unknown'],
  dispatch_started: [
    'aborted',
    'timeout',
    'dns',
    'tls',
    'proxy',
    'connection_refused',
    'connection_reset',
    'network_unreachable',
    'unknown',
  ],
  response_observed: [
    'http_status',
    'envelope_invalid',
    'schema_invalid',
    'stream_event_invalid',
    'unknown',
  ],
  usage_observed: ['usage_invalid', 'schema_invalid', 'unknown'],
  terminal: [
    'applied',
    'aborted',
    'timeout',
    'schema_invalid',
    'stream_event_invalid',
    'usage_invalid',
    'unknown',
  ],
};

const STAGE_INDEX = new Map<Phase698TransportEvidenceStage, number>(
  PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES.map((stage, index) => [stage, index]),
);
const BOUNDARY_INDEX = new Map<Phase698TransportEvidenceProviderBoundary, number>([
  ['not_dispatched', 0],
  ['dispatched_no_response', 1],
  ['response_observed', 2],
  ['response_and_usage_observed', 3],
]);

const CALL_ID = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA = z
  .object({
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    callId: CALL_ID,
    family: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_FAMILIES),
    phase: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_PHASES),
    stage: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES),
    reasonCode: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_REASON_CODES),
    providerBoundary: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_BOUNDARIES),
    runnerWire: PHASE_6_9_8_TRANSPORT_EVIDENCE_RUNNER_WIRE_SCHEMA,
    providerWire: PHASE_6_9_8_TRANSPORT_EVIDENCE_PROVIDER_WIRE_SCHEMA,
    diagnosticStages: z
      .array(z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES))
      .max(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES.length),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.family !== value.phase) {
      context.addIssue({ code: 'custom', message: 'family and phase mismatch' });
    }

    const stageIndex = STAGE_INDEX.get(value.stage);
    if (stageIndex === undefined) {
      context.addIssue({ code: 'custom', message: 'stage is unknown' });
      return;
    }
    const allowedReasons = REASONS_BY_STAGE[value.stage];
    if (!allowedReasons.includes(value.reasonCode)) {
      context.addIssue({ code: 'custom', message: 'reason is not valid for stage' });
    }

    const expectedLength =
      value.reasonCode === 'applied' ? PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES.length : stageIndex;
    if (
      value.diagnosticStages.length !== expectedLength ||
      value.diagnosticStages.some(
        (stage, index) => stage !== PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES[index],
      )
    ) {
      context.addIssue({ code: 'custom', message: 'diagnostic stage prefix mismatch' });
    }
    if (
      value.reasonCode === 'applied' &&
      (value.stage !== 'terminal' ||
        value.diagnosticStages[value.diagnosticStages.length - 1] !== 'terminal')
    ) {
      context.addIssue({ code: 'custom', message: 'applied must terminate at terminal' });
    }

    validateStageBoundary(value.stage, value.providerBoundary, context);
    validateWire(value.runnerWire, value.providerWire, value.providerBoundary, context);
  });

export type Phase698TransportEvidenceDiagnostic = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA
>;

export type Phase698TransportEvidenceCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  family: Phase698TransportEvidenceFamily;
  phase: Phase698TransportEvidencePhase;
  callId: string;
}>;

export type Phase698TransportEvidenceObservation = Phase698TransportEvidenceDiagnostic;

export function parsePhase698TransportEvidenceDiagnostic(
  input: unknown,
): Phase698TransportEvidenceDiagnostic | null {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return null;
    const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA.safeParse(cloned.value);
    return parsed.success ? deepFreezeModelValue(parsed.data) : null;
  } catch {
    return null;
  }
}

export function assertPhase698TransportEvidenceCallId(callId: string): string {
  const parsed = CALL_ID.safeParse(callId);
  if (!parsed.success) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_CALL_ID_INVALID');
  }
  return parsed.data;
}

export function phase698TransportEvidenceStagesBefore(
  stage: Phase698TransportEvidenceStage,
): readonly Phase698TransportEvidenceStage[] {
  const index = STAGE_INDEX.get(stage);
  if (index === undefined) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGE_INVALID');
  }
  return Object.freeze(PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES.slice(0, index));
}

export function phase698TransportEvidenceWireForBoundary(
  boundary: Exclude<Phase698TransportEvidenceProviderBoundary, 'unknown'>,
): Readonly<{
  runnerWire: Phase698TransportEvidenceRunnerWire;
  providerWire: Phase698TransportEvidenceProviderWire;
}> {
  const level = BOUNDARY_INDEX.get(boundary);
  if (level === undefined) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_BOUNDARY_INVALID');
  }
  const bit = (condition: boolean): 0 | 1 => (condition ? 1 : 0);
  const wire = {
    runnerWire: {
      reservations: bit(level > 0),
      dispatches: bit(level > 0),
      harnessReturns: bit(level > 1),
      verifiedResults: bit(level > 2),
    },
    providerWire: {
      executions: bit(level > 0),
      dispatches: bit(level > 0),
      responses: bit(level > 1),
      verifiedUsage: bit(level > 2),
    },
  };
  return deepFreezeModelValue(wire);
}

function validateStageBoundary(
  stage: Phase698TransportEvidenceStage,
  boundary: Phase698TransportEvidenceProviderBoundary,
  context: z.RefinementCtx,
) {
  if (boundary === 'unknown') return;
  const boundaryIndex = BOUNDARY_INDEX.get(boundary);
  if (boundaryIndex === undefined) {
    context.addIssue({ code: 'custom', message: 'boundary is unknown' });
    return;
  }
  const stageIndex = STAGE_INDEX.get(stage)!;
  if (stageIndex <= 1 && boundaryIndex > 1) {
    context.addIssue({ code: 'custom', message: 'response boundary before response stage' });
  }
  if (stageIndex >= 2 && boundaryIndex < 2) {
    context.addIssue({ code: 'custom', message: 'response stage without response boundary' });
  }
  if (stageIndex >= 3 && boundaryIndex < 2) {
    context.addIssue({ code: 'custom', message: 'usage stage without response boundary' });
  }
  if (stageIndex >= 3 && boundaryIndex === 1) {
    context.addIssue({ code: 'custom', message: 'usage stage without observed response' });
  }
}

function validateWire(
  runnerWire: Phase698TransportEvidenceRunnerWire,
  providerWire: Phase698TransportEvidenceProviderWire,
  boundary: Phase698TransportEvidenceProviderBoundary,
  context: z.RefinementCtx,
) {
  if (
    runnerWire.reservations < runnerWire.dispatches ||
    runnerWire.dispatches < runnerWire.harnessReturns ||
    runnerWire.harnessReturns < runnerWire.verifiedResults
  ) {
    context.addIssue({ code: 'custom', message: 'runner wire is not monotonic' });
  }
  if (
    providerWire.executions < providerWire.dispatches ||
    providerWire.dispatches < providerWire.responses ||
    providerWire.responses < providerWire.verifiedUsage
  ) {
    context.addIssue({ code: 'custom', message: 'provider wire is not monotonic' });
  }
  if (boundary === 'unknown') return;
  const expected = phase698TransportEvidenceWireForBoundary(boundary);
  if (
    JSON.stringify(runnerWire) !== JSON.stringify(expected.runnerWire) ||
    JSON.stringify(providerWire) !== JSON.stringify(expected.providerWire)
  ) {
    context.addIssue({ code: 'custom', message: 'wire does not match provider boundary' });
  }
}
