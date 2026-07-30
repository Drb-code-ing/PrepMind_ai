import { z } from 'zod';

import { FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES } from './first-party-deepseek-v4-pro-transport-diagnostic.ts';
import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
} from './model-agent-contract.ts';
import {
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES,
  PHASE_6_9_7_V7_WIRE_STAGES,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION =
  'phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION =
  'phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION =
  'phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION =
  'phase-6.9.7-architecture-recovery-r2-provider-canary-artifact-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_PREFIX =
  'phase-6-9-7-architecture-recovery-r2-provider-canary' as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES = Object.freeze([
  'complete',
  'response_observed',
  'transport_failed',
  'response_invalid',
  'aborted',
  'timeout',
  'budget_exceeded',
  'config_invalid',
  'harness_internal',
] as const);

export type Phase697ArchitectureRecoveryR2CanaryOutcome =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES)[number];

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
  provider: 'deepseek' as const,
  model: 'deepseek-v4-pro' as const,
  endpointPolicy: 'deepseek-v4-pro-exact-chat-completions-v1' as const,
  responseContract: 'exact-ok-true-json-v1' as const,
  nonThinking: true as const,
  jsonObject: true as const,
  stream: false as const,
  tools: false as const,
  retry: false as const,
  maxOutputTokens: 16 as const,
  systemPrompt:
    'Return exactly one JSON object with ok=true. Use no tools or external facts.' as const,
  userPrompt: 'Run the fact-free provider health canary.' as const,
});

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
  scope: 'per_invocation' as const,
  maxCalls: 1 as const,
  maxInputTokens: 512 as const,
  maxOutputTokens: 16 as const,
  hardCapCny: '0.00200000' as const,
});

const POSITIVE_SAFE_INTEGER_SCHEMA = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const NULLABLE_PROVIDER_FAILURE_SCHEMA = z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).nullable();
const NULLABLE_STRUCTURED_STAGE_SCHEMA = z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES).nullable();
const NULLABLE_TRANSPORT_SUBTYPE_SCHEMA = z
  .enum(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES)
  .nullable();

const WIRE_COUNTERS_SCHEMA = z
  .object({
    executorInvocations: z.union([z.literal(0), z.literal(1)]),
    providerDispatches: z.union([z.literal(0), z.literal(1)]),
    providerResponses: z.union([z.literal(0), z.literal(1)]),
    verifiedUsages: z.union([z.literal(0), z.literal(1)]),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.verifiedUsages > value.providerResponses ||
      value.providerResponses > value.providerDispatches ||
      value.providerDispatches > value.executorInvocations
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_counter_order_invalid' });
    }
  });

const WIRE_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION),
    state: z.enum(['not_started', 'succeeded', 'failed']),
    lastCompletedStage: z.enum(PHASE_6_9_7_V7_WIRE_STAGES).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES).nullable(),
    counters: WIRE_COUNTERS_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const counters = value.counters;
    if (
      value.state === 'not_started' &&
      (value.lastCompletedStage !== null ||
        value.failureCategory !== null ||
        Object.values(counters).some((count) => count !== 0))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_not_started_invalid' });
    }
    if (
      value.state === 'succeeded' &&
      (value.lastCompletedStage !== 'usage_validated' ||
        value.failureCategory !== null ||
        Object.values(counters).some((count) => count !== 1))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_success_invalid' });
    }
    if (value.state === 'failed' && value.failureCategory === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_failure_invalid' });
    }
  });

const BUDGET_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION),
    scope: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.scope),
    maxCalls: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxCalls),
    maxInputTokens: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens),
    maxOutputTokens: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens),
    hardCapCny: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.hardCapCny),
    reservedCalls: z.union([z.literal(0), z.literal(1)]),
    reservedInputTokens: z.union([
      z.literal(0),
      z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens),
    ]),
    reservedOutputTokens: z.union([
      z.literal(0),
      z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens),
    ]),
    actualInputTokens: POSITIVE_SAFE_INTEGER_SCHEMA.nullable(),
    actualOutputTokens: POSITIVE_SAFE_INTEGER_SCHEMA.nullable(),
    withinBudget: z.boolean().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasActual = value.actualInputTokens !== null && value.actualOutputTokens !== null;
    const hasPartialActual = value.actualInputTokens !== null || value.actualOutputTokens !== null;
    if (hasPartialActual !== hasActual || hasActual !== (value.withinBudget !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_actual_invalid' });
    }
    const reserved = value.reservedCalls === 1;
    if (
      reserved !==
      (value.reservedInputTokens === value.maxInputTokens &&
        value.reservedOutputTokens === value.maxOutputTokens)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_reservation_invalid' });
    }
    if (
      value.withinBudget !== null &&
      value.withinBudget !==
        (value.actualInputTokens! <= value.maxInputTokens &&
          value.actualOutputTokens! <= value.maxOutputTokens)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_limit_invalid' });
    }
  });

const USAGE_SCHEMA = z
  .object({
    inputTokens: POSITIVE_SAFE_INTEGER_SCHEMA,
    outputTokens: POSITIVE_SAFE_INTEGER_SCHEMA,
  })
  .strict();

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION),
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION),
    authority: z.enum(['synthetic_test', 'controlled_live']),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    timeoutMs: POSITIVE_SAFE_INTEGER_SCHEMA.max(5_000),
    outcome: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES),
    responseObserved: z.boolean(),
    providerFailureCategory: NULLABLE_PROVIDER_FAILURE_SCHEMA,
    structuredOutputStage: NULLABLE_STRUCTURED_STAGE_SCHEMA,
    transportSubtype: NULLABLE_TRANSPORT_SUBTYPE_SCHEMA,
    wire: WIRE_REPORT_SCHEMA,
    budget: BUDGET_REPORT_SCHEMA,
    usage: USAGE_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const responseObserved = value.wire.counters.providerResponses === 1;
    if (value.responseObserved !== responseObserved) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'response_observation_invalid' });
    }
    if ((value.usage !== null) !== (value.budget.actualInputTokens !== null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'usage_presence_invalid' });
    }
    if (
      value.usage &&
      (value.usage.inputTokens !== value.budget.actualInputTokens ||
        value.usage.outputTokens !== value.budget.actualOutputTokens)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'usage_value_invalid' });
    }
    if (
      (value.providerFailureCategory === 'structured_output') !==
      (value.structuredOutputStage !== null)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'structured_stage_invalid' });
    }
    if (
      value.transportSubtype !== null &&
      value.providerFailureCategory !== 'transport' &&
      value.outcome !== 'aborted' &&
      value.outcome !== 'timeout'
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'transport_subtype_invalid' });
    }

    switch (value.outcome) {
      case 'complete':
        if (
          value.wire.state !== 'succeeded' ||
          value.usage === null ||
          value.budget.withinBudget !== true ||
          value.providerFailureCategory !== null ||
          value.structuredOutputStage !== null ||
          value.transportSubtype !== null
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'complete_outcome_invalid' });
        }
        break;
      case 'budget_exceeded':
        if (
          value.wire.state !== 'succeeded' ||
          value.usage === null ||
          value.budget.withinBudget !== false ||
          value.providerFailureCategory !== null
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_outcome_invalid' });
        }
        break;
      case 'transport_failed':
        if (
          value.responseObserved ||
          value.providerFailureCategory !== 'transport' ||
          value.transportSubtype === null ||
          value.wire.failureCategory !== 'transport'
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'transport_outcome_invalid' });
        }
        break;
      case 'response_invalid':
        if (
          value.responseObserved ||
          value.providerFailureCategory !== 'invalid_response' ||
          value.wire.failureCategory !== 'invalid_response'
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'response_invalid_outcome_invalid',
          });
        }
        break;
      case 'response_observed':
        if (
          !value.responseObserved ||
          value.wire.state !== 'failed' ||
          value.providerFailureCategory === null ||
          value.transportSubtype !== null ||
          value.usage !== null
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'response_outcome_invalid' });
        }
        break;
      case 'config_invalid':
        if (
          value.wire.state !== 'not_started' ||
          value.budget.reservedCalls !== 0 ||
          value.providerFailureCategory !== null ||
          value.transportSubtype !== null ||
          value.usage !== null
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'config_outcome_invalid' });
        }
        break;
      case 'aborted':
        if (
          value.providerFailureCategory !== null ||
          value.structuredOutputStage !== null ||
          value.usage !== null ||
          value.budget.withinBudget !== null ||
          !(
            (value.wire.state === 'not_started' &&
              value.wire.failureCategory === null &&
              value.budget.reservedCalls === 0 &&
              !value.responseObserved &&
              value.transportSubtype === null) ||
            (value.wire.state === 'failed' &&
              (value.wire.failureCategory === 'pre_dispatch_abort' ||
                value.wire.failureCategory === 'post_dispatch_abort') &&
              value.budget.reservedCalls === 1)
          )
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'abort_outcome_invalid' });
        }
        break;
      case 'timeout':
        if (
          value.wire.state !== 'failed' ||
          value.wire.failureCategory !== 'runtime_timeout' ||
          value.budget.reservedCalls !== 1 ||
          value.providerFailureCategory !== null ||
          value.structuredOutputStage !== null ||
          value.usage !== null ||
          value.budget.withinBudget !== null
        ) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'timeout_outcome_invalid' });
        }
        break;
      case 'harness_internal':
        if (value.usage !== null) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'terminal_usage_invalid' });
        }
        break;
      default:
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'outcome_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR2CanaryReport = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION),
    runId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: false }),
    authority: z.enum(['synthetic_test', 'controlled_live']),
    status: z.literal('diagnostic_only'),
    qualityAuthority: z.literal('none'),
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.authority !== value.report.authority) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact_authority_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR2CanaryArtifact = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA
>;

const ARTIFACT_INPUT_SCHEMA = z
  .object({
    runId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: false }),
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
  })
  .strict();
const ARTIFACT_PATH_INPUT_SCHEMA = z.object({ runId: z.string().uuid() }).strict();
const INVALID_ARTIFACT = 'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT';

export function buildPhase697ArchitectureRecoveryR2CanaryArtifact(
  input: z.input<typeof ARTIFACT_INPUT_SCHEMA>,
): Phase697ArchitectureRecoveryR2CanaryArtifact {
  try {
    const parsed = ARTIFACT_INPUT_SCHEMA.parse(input);
    return freezeArtifact(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION,
        runId: parsed.runId,
        generatedAt: parsed.generatedAt,
        authority: parsed.report.authority,
        status: 'diagnostic_only',
        qualityAuthority: 'none',
        report: parsed.report,
      }),
    );
  } catch {
    throw new Error(INVALID_ARTIFACT);
  }
}

export function phase697ArchitectureRecoveryR2CanaryArtifactPath(input: { runId: string }): string {
  try {
    const parsed = ARTIFACT_PATH_INPUT_SCHEMA.parse(input);
    return `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_PREFIX}-${parsed.runId}.json`;
  } catch {
    throw new Error(INVALID_ARTIFACT);
  }
}

function freezeArtifact(
  value: Phase697ArchitectureRecoveryR2CanaryArtifact,
): Phase697ArchitectureRecoveryR2CanaryArtifact {
  return Object.freeze({
    ...value,
    report: freezeReport(value.report),
  });
}

export function freezePhase697ArchitectureRecoveryR2CanaryReport(
  value: Phase697ArchitectureRecoveryR2CanaryReport,
): Phase697ArchitectureRecoveryR2CanaryReport {
  return freezeReport(value);
}

function freezeReport(
  value: Phase697ArchitectureRecoveryR2CanaryReport,
): Phase697ArchitectureRecoveryR2CanaryReport {
  return Object.freeze({
    ...value,
    wire: Object.freeze({
      ...value.wire,
      counters: Object.freeze({ ...value.wire.counters }),
    }),
    budget: Object.freeze({ ...value.budget }),
    usage: value.usage === null ? null : Object.freeze({ ...value.usage }),
  });
}

export function isPhase697ArchitectureRecoveryR2CanaryReport(
  value: unknown,
): value is Phase697ArchitectureRecoveryR2CanaryReport {
  try {
    return PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(value).success;
  } catch {
    return false;
  }
}

export function isPhase697ArchitectureRecoveryR2CanaryArtifact(
  value: unknown,
): value is Phase697ArchitectureRecoveryR2CanaryArtifact {
  try {
    return PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA.safeParse(value).success;
  } catch {
    return false;
  }
}
