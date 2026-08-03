import { z } from 'zod';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
} from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import { PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION } from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE =
  'phase-6.9.7-architecture-recovery-provider-canary-v2' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-contract-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-request-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-proxy-attestation-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-budget-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-report-v1' as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
  provider: 'deepseek' as const,
  model: 'deepseek-v4-pro' as const,
  endpointPolicy: 'deepseek-v4-pro-exact-chat-completions-v1' as const,
  responseContract: 'exact-ok-true-json-v1' as const,
  nonThinking: true as const,
  jsonObject: true as const,
  stream: false as const,
  tools: false as const,
  retry: false as const,
  timeoutMs: 5_000 as const,
  maxOutputTokens: 16 as const,
  systemPrompt:
    'Return exactly one JSON object with ok=true. Use no tools or external facts.' as const,
  userPrompt: 'Run the fact-free provider health canary.' as const,
});

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
  scope: 'per_invocation' as const,
  maxCalls: 1 as const,
  maxInputTokens: 512 as const,
  maxOutputTokens: 16 as const,
  hardCapCny: '0.00200000' as const,
});

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_DISPOSITIONS = Object.freeze([
  'preflight_rejected',
  'preflight_ready',
  'capability_consumed',
  'capability_rejected',
] as const);

export type Phase697ArchitectureRecoveryProviderCanaryV2C1Disposition =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_DISPOSITIONS)[number];

const PREFLIGHT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION),
    ok: z.boolean(),
    code: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES),
    mode: z.enum(['direct', 'loopback_proxy', 'undetermined']),
    configuredProxyVariables: z.number().int().min(0).max(6),
    listener: z.enum(['not_required', 'listening', 'unavailable', 'probe_failed', 'aborted']),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    const ready = value.code === 'direct_ready' || value.code === 'loopback_proxy_ready';
    if (value.ok !== ready) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'preflight_readiness_invalid' });
    }
    if (
      value.code === 'direct_ready' &&
      (value.mode !== 'direct' ||
        value.configuredProxyVariables !== 0 ||
        value.listener !== 'not_required' ||
        value.listenerProbeCalls !== 0)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'direct_preflight_invalid' });
    }
    if (
      value.code === 'loopback_proxy_ready' &&
      (value.mode !== 'loopback_proxy' ||
        value.configuredProxyVariables < 1 ||
        value.listener !== 'listening' ||
        value.listenerProbeCalls !== 1)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'loopback_preflight_invalid' });
    }
  });

const ZERO_DOWNSTREAM_SCHEMA = z
  .object({
    credentialReads: z.literal(0),
    sourceReads: z.literal(0),
    markerWrites: z.literal(0),
    providerDelegates: z.literal(0),
    providerCalls: z.literal(0),
  })
  .strict();

const NOT_STARTED_WIRE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION),
    state: z.literal('not_started'),
    lastCompletedStage: z.null(),
    failureCategory: z.null(),
    counters: z
      .object({
        executorInvocations: z.literal(0),
        providerDispatches: z.literal(0),
        providerResponses: z.literal(0),
        verifiedUsages: z.literal(0),
      })
      .strict(),
  })
  .strict();

const UNRESERVED_BUDGET_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION),
    scope: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.scope),
    maxCalls: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxCalls),
    maxInputTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens,
    ),
    maxOutputTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens,
    ),
    hardCapCny: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.hardCapCny),
    reservedCalls: z.literal(0),
    reservedInputTokens: z.literal(0),
    reservedOutputTokens: z.literal(0),
    actualInputTokens: z.null(),
    actualOutputTokens: z.null(),
    actualCostCny: z.null(),
    withinBudget: z.null(),
  })
  .strict();

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_VERSION),
    contractVersion: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
    ),
    namespace: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE),
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION),
    authority: z.literal('synthetic_test'),
    qualityAuthority: z.literal('none'),
    providerHealth: z.literal('unknown'),
    zeroNetwork: z.literal(true),
    provider: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.provider,
    ),
    model: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.model),
    timeoutMs: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.timeoutMs,
    ),
    disposition: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_DISPOSITIONS),
    preflight: PREFLIGHT_SCHEMA,
    attestation: z
      .object({
        version: z.literal(
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
        ),
        status: z.enum(['not_minted', 'available', 'consumed', 'rejected']),
      })
      .strict(),
    downstream: ZERO_DOWNSTREAM_SCHEMA,
    wire: NOT_STARTED_WIRE_SCHEMA,
    budget: UNRESERVED_BUDGET_SCHEMA,
    usage: z.null(),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedStatus = {
      preflight_rejected: 'not_minted',
      preflight_ready: 'available',
      capability_consumed: 'consumed',
      capability_rejected: 'rejected',
    }[value.disposition];
    if (value.attestation.status !== expectedStatus) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'attestation_status_invalid' });
    }
    if (value.preflight.ok !== (value.disposition !== 'preflight_rejected')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'admission_disposition_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C1Report = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA
>;

const BUILD_INPUT_SCHEMA = z
  .object({
    preflight: PREFLIGHT_SCHEMA,
    disposition: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_DISPOSITIONS),
  })
  .strict();

export function buildPhase697ArchitectureRecoveryProviderCanaryV2C1Report(input: {
  preflight: z.input<typeof PREFLIGHT_SCHEMA>;
  disposition: Phase697ArchitectureRecoveryProviderCanaryV2C1Disposition;
}): Phase697ArchitectureRecoveryProviderCanaryV2C1Report {
  try {
    const parsed = BUILD_INPUT_SCHEMA.parse(input);
    const report = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA.parse({
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_VERSION,
      contractVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
      namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
      requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
      authority: 'synthetic_test',
      qualityAuthority: 'none',
      providerHealth: 'unknown',
      zeroNetwork: true,
      provider: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.provider,
      model: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.model,
      timeoutMs: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.timeoutMs,
      disposition: parsed.disposition,
      preflight: parsed.preflight,
      attestation: {
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
        status: {
          preflight_rejected: 'not_minted',
          preflight_ready: 'available',
          capability_consumed: 'consumed',
          capability_rejected: 'rejected',
        }[parsed.disposition],
      },
      downstream: {
        credentialReads: 0,
        sourceReads: 0,
        markerWrites: 0,
        providerDelegates: 0,
        providerCalls: 0,
      },
      wire: {
        version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
        state: 'not_started',
        lastCompletedStage: null,
        failureCategory: null,
        counters: {
          executorInvocations: 0,
          providerDispatches: 0,
          providerResponses: 0,
          verifiedUsages: 0,
        },
      },
      budget: {
        ...PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET,
        reservedCalls: 0,
        reservedInputTokens: 0,
        reservedOutputTokens: 0,
        actualInputTokens: null,
        actualOutputTokens: null,
        actualCostCny: null,
        withinBudget: null,
      },
      usage: null,
    });
    return freezeReport(report);
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT');
  }
}

export function isPhase697ArchitectureRecoveryProviderCanaryV2C1Report(
  value: unknown,
): value is Phase697ArchitectureRecoveryProviderCanaryV2C1Report {
  try {
    return PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA.safeParse(value)
      .success;
  } catch {
    return false;
  }
}

function freezeReport(
  report: Phase697ArchitectureRecoveryProviderCanaryV2C1Report,
): Phase697ArchitectureRecoveryProviderCanaryV2C1Report {
  return Object.freeze({
    ...report,
    preflight: Object.freeze({ ...report.preflight }),
    attestation: Object.freeze({ ...report.attestation }),
    downstream: Object.freeze({ ...report.downstream }),
    wire: Object.freeze({
      ...report.wire,
      counters: Object.freeze({ ...report.wire.counters }),
    }),
    budget: Object.freeze({ ...report.budget }),
  });
}
