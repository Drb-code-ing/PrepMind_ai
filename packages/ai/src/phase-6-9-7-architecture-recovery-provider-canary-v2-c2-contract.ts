import { createHash } from 'node:crypto';

import { z } from 'zod';

import { FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES } from './first-party-deepseek-v4-pro-transport-diagnostic.ts';
import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
} from './model-agent-contract.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';
import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION } from './phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import {
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES,
  PHASE_6_9_7_V7_WIRE_STAGES,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-contract-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-source-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-report-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-marker-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-journal-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-artifact-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-recovery-claim-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-price-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX =
  'phase-6-9-7-architecture-recovery-provider-canary-v2' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}.once.json` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}.journal.jsonl` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}.recovery.json` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTROLLED_LIVE_BRANCH =
  'codex/phase-6-9-7-tutor-wrong-question-agents' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV =
  'PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_APPROVED' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV =
  'PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_ONCE' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_INTERRUPTED_ATTEMPT_WITHOUT_PROVIDER' as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY = Object.freeze({
  runId: '253a5df5-c443-4950-b517-849efb941728' as const,
  markerSha256: '6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a' as const,
  journalSha256: '426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b' as const,
  artifactSha256: '56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4' as const,
});

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_PROFILE = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_VERSION,
  currency: 'CNY' as const,
  nonCachedInputCnyPerMillionTokens: '3.00000000' as const,
  outputCnyPerMillionTokens: '6.00000000' as const,
  hardCapCny: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.hardCapCny,
});

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_OUTCOMES = Object.freeze([
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
export type Phase697ArchitectureRecoveryProviderCanaryV2C2Outcome =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_OUTCOMES)[number];

const SHA256_SCHEMA = z.string().regex(/^[a-f0-9]{64}$/u);
const COMMIT_SCHEMA = z.string().regex(/^[a-f0-9]{40}$/u);
const POSITIVE_SAFE_INTEGER_SCHEMA = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const CNY_SCHEMA = z.string().regex(/^\d+\.\d{8}$/u);
const AUTHORITY_SCHEMA = z.enum(['synthetic_test', 'controlled_live']);

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION),
    branch: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTROLLED_LIVE_BRANCH,
    ),
    commit: COMMIT_SCHEMA,
    trackingCommit: COMMIT_SCHEMA,
    remoteCommit: COMMIT_SCHEMA,
    trackedWorktreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    r3BundleValid: z.literal(true),
    r3RunId: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.runId),
    r3MarkerSha256: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.markerSha256,
    ),
    r3JournalSha256: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.journalSha256,
    ),
    r3ArtifactSha256: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.artifactSha256,
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.commit !== value.trackingCommit || value.commit !== value.remoteCommit) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_parity_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Source = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA = z
  .object({
    version: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
    ),
    preflightVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION),
    mode: z.enum(['direct', 'loopback_proxy']),
    configuredProxyVariables: z.number().int().min(0).max(6),
    listener: z.enum(['not_required', 'listening']),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.mode === 'direct' &&
      (value.configuredProxyVariables !== 0 ||
        value.listener !== 'not_required' ||
        value.listenerProbeCalls !== 0)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'direct_attestation_invalid' });
    }
    if (
      value.mode === 'loopback_proxy' &&
      (value.configuredProxyVariables < 1 ||
        value.listener !== 'listening' ||
        value.listenerProbeCalls !== 1)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'loopback_attestation_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA
>;

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

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION),
    state: z.enum(['not_started', 'succeeded', 'failed']),
    lastCompletedStage: z.enum(PHASE_6_9_7_V7_WIRE_STAGES).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES).nullable(),
    counters: WIRE_COUNTERS_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.state === 'not_started' &&
      (value.lastCompletedStage !== null ||
        value.failureCategory !== null ||
        Object.values(value.counters).some((counter) => counter !== 0))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_not_started_invalid' });
    }
    if (
      value.state === 'succeeded' &&
      (value.lastCompletedStage !== 'usage_validated' ||
        value.failureCategory !== null ||
        Object.values(value.counters).some((counter) => counter !== 1))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_success_invalid' });
    }
    if (value.state === 'failed' && value.failureCategory === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'wire_failure_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Wire = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_SCHEMA
>;

const USAGE_SCHEMA = z
  .object({
    inputTokens: POSITIVE_SAFE_INTEGER_SCHEMA,
    outputTokens: POSITIVE_SAFE_INTEGER_SCHEMA,
  })
  .strict();

const BUDGET_REPORT_SCHEMA = z
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
    reservedCalls: z.union([z.literal(0), z.literal(1)]),
    reservedInputTokens: z.union([
      z.literal(0),
      z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens),
    ]),
    reservedOutputTokens: z.union([
      z.literal(0),
      z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens),
    ]),
    actualInputTokens: POSITIVE_SAFE_INTEGER_SCHEMA.nullable(),
    actualOutputTokens: POSITIVE_SAFE_INTEGER_SCHEMA.nullable(),
    withinBudget: z.boolean().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const reserved = value.reservedCalls === 1;
    if (
      reserved !==
      (value.reservedInputTokens === value.maxInputTokens &&
        value.reservedOutputTokens === value.maxOutputTokens)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_reservation_invalid' });
    }
    const hasActual = value.actualInputTokens !== null && value.actualOutputTokens !== null;
    if (
      hasActual !== (value.withinBudget !== null) ||
      (value.actualInputTokens !== null) !== (value.actualOutputTokens !== null)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'budget_actual_invalid' });
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

const COST_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_VERSION),
    currency: z.literal('CNY'),
    nonCachedInputCnyPerMillionTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_PROFILE.nonCachedInputCnyPerMillionTokens,
    ),
    outputCnyPerMillionTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_PROFILE.outputCnyPerMillionTokens,
    ),
    hardCapCny: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_PROFILE.hardCapCny,
    ),
    estimatedCostCny: CNY_SCHEMA.nullable(),
    withinHardCap: z.boolean().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.estimatedCostCny === null) !== (value.withinHardCap === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'cost_presence_invalid' });
    }
  });

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_VERSION),
    contractVersion: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION,
    ),
    c1ContractVersion: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
    ),
    namespace: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE),
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION),
    budgetVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION),
    authority: AUTHORITY_SCHEMA,
    executorProvenance: z.enum(['synthetic_test', 'deepseek_network']),
    qualityAuthority: z.literal('none'),
    providerHealth: z.enum(['unknown', 'strict_response_with_verified_usage']),
    provider: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.provider,
    ),
    model: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.model),
    timeoutMs: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.timeoutMs,
    ),
    outcome: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_OUTCOMES),
    responseObserved: z.boolean(),
    strictResponseObserved: z.boolean(),
    providerFailureCategory: z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).nullable(),
    structuredOutputStage: z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES).nullable(),
    transportSubtype: z.enum(FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES).nullable(),
    wire: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_WIRE_SCHEMA,
    budget: BUDGET_REPORT_SCHEMA,
    usage: USAGE_SCHEMA.nullable(),
    cost: COST_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const controlled = value.authority === 'controlled_live';
    if (controlled !== (value.executorProvenance === 'deepseek_network')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'executor_provenance_invalid' });
    }
    const confirmed = controlled && value.outcome === 'complete';
    if (
      (value.providerHealth === 'strict_response_with_verified_usage') !== confirmed ||
      value.responseObserved !== (value.wire.counters.providerResponses === 1) ||
      value.strictResponseObserved !== (value.wire.state === 'succeeded') ||
      (value.usage !== null) !== (value.wire.counters.verifiedUsages === 1) ||
      (value.usage !== null) !== (value.budget.actualInputTokens !== null)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_observation_invalid' });
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
    const expectedCost = calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost(value.usage);
    if (
      value.cost.estimatedCostCny !== expectedCost.estimatedCostCny ||
      value.cost.withinHardCap !== expectedCost.withinHardCap
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_cost_invalid' });
    }
    refineOutcome(value, context);
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Report = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_VERSION),
    namespace: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE),
    runId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: false }),
    authority: z.literal('controlled_live'),
    ownerProcessId: POSITIVE_SAFE_INTEGER_SCHEMA,
    ownerToken: z.string().uuid(),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
    proxyAttestation:
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA,
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION),
    budgetVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION),
    maxProviderCalls: z.literal(1),
    retry: z.literal(false),
    resume: z.literal(false),
    replay: z.literal(false),
  })
  .strict();

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Marker = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_EVENTS = Object.freeze(
  [
    'attempt_reserved',
    'wire_stage',
    'recovery_claimed',
    'runtime_terminal',
    'publication_started',
    'evidence_published',
  ] as const,
);

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_VERSION),
    runId: z.string().uuid(),
    sequence: POSITIVE_SAFE_INTEGER_SCHEMA,
    recordedAt: z.string().datetime({ offset: false }),
    event: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_EVENTS),
    previousHash: SHA256_SCHEMA.nullable(),
    markerSha256: SHA256_SCHEMA,
    sourceSha256: SHA256_SCHEMA,
    proxyAttestationSha256: SHA256_SCHEMA,
    wireStage: z.enum(PHASE_6_9_7_V7_WIRE_STAGES).nullable(),
    outcome: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_OUTCOMES).nullable(),
    reportSha256: SHA256_SCHEMA.nullable(),
    evidenceSha256: SHA256_SCHEMA.nullable(),
    recoveryClaimSha256: SHA256_SCHEMA.nullable(),
    completionMode: z.enum(['runtime', 'recovery']).nullable(),
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA.nullable(),
    recordHash: SHA256_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const only = (fields: readonly string[]) => {
      const optional = {
        wireStage: value.wireStage,
        outcome: value.outcome,
        reportSha256: value.reportSha256,
        evidenceSha256: value.evidenceSha256,
        recoveryClaimSha256: value.recoveryClaimSha256,
        completionMode: value.completionMode,
        report: value.report,
      } as const;
      return Object.entries(optional).every(
        ([key, fieldValue]) => fields.includes(key) === (fieldValue !== null),
      );
    };
    const valid =
      (value.event === 'attempt_reserved' && only([])) ||
      (value.event === 'wire_stage' && only(['wireStage'])) ||
      (value.event === 'recovery_claimed' && only(['recoveryClaimSha256'])) ||
      (value.event === 'runtime_terminal' &&
        only(['outcome', 'reportSha256', 'completionMode', 'report']) &&
        value.report?.outcome === value.outcome &&
        sha256Canonical(value.report) === value.reportSha256) ||
      (value.event === 'publication_started' && only([])) ||
      (value.event === 'evidence_published' && only(['evidenceSha256']));
    if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, message: 'journal_event_invalid' });
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_VERSION,
    ),
    runId: z.string().uuid(),
    claimedAt: z.string().datetime({ offset: false }),
    ownerProcessId: POSITIVE_SAFE_INTEGER_SCHEMA,
    ownerToken: z.string().uuid(),
    markerSha256: SHA256_SCHEMA,
    journalTailRecordHash: SHA256_SCHEMA,
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697ArchitectureRecoveryProviderCanaryV2C2RecoveryClaim = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA
>;

const DURABILITY_SCHEMA = z
  .object({
    markerSha256: SHA256_SCHEMA,
    sourceSha256: SHA256_SCHEMA,
    proxyAttestationSha256: SHA256_SCHEMA,
    terminalSequence: POSITIVE_SAFE_INTEGER_SCHEMA,
    terminalRecordHash: SHA256_SCHEMA,
    terminalReportSha256: SHA256_SCHEMA,
    completionMode: z.enum(['runtime', 'recovery']),
    publicationMode: z.enum(['runtime', 'recovery']),
    recoveryClaimSha256: SHA256_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.publicationMode === 'recovery') !== (value.recoveryClaimSha256 !== null) ||
      (value.completionMode === 'recovery' && value.publicationMode !== 'recovery')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'durability_mode_invalid' });
    }
  });

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_VERSION),
    namespace: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE),
    runId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: false }),
    authority: AUTHORITY_SCHEMA,
    status: z.enum(['synthetic_test_only', 'diagnostic_only']),
    qualityAuthority: z.literal('none'),
    attemptDisposition: z.enum(['not_dispatched', 'dispatched_no_response', 'response_observed']),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
    proxyAttestation:
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA,
    durability: DURABILITY_SCHEMA,
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.authority !== value.report.authority ||
      (value.authority === 'controlled_live') !== (value.status === 'diagnostic_only') ||
      value.attemptDisposition !== deriveAttemptDisposition(value.report) ||
      value.durability.sourceSha256 !== sha256Canonical(value.source) ||
      value.durability.proxyAttestationSha256 !== sha256Canonical(value.proxyAttestation) ||
      value.durability.terminalReportSha256 !== sha256Canonical(value.report)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact_authority_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA
>;

export function buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report(input: {
  authority: 'synthetic_test' | 'controlled_live';
  executorProvenance: 'synthetic_test' | 'deepseek_network';
  outcome: Phase697ArchitectureRecoveryProviderCanaryV2C2Outcome;
  responseObserved: boolean;
  strictResponseObserved: boolean;
  providerFailureCategory: (typeof MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)[number] | null;
  structuredOutputStage: (typeof MODEL_AGENT_STRUCTURED_OUTPUT_STAGES)[number] | null;
  transportSubtype:
    (typeof FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES)[number] | null;
  wire: Phase697ArchitectureRecoveryProviderCanaryV2C2Wire;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Report {
  try {
    const usage = input.usage ? Object.freeze({ ...input.usage }) : null;
    const reserved = input.wire.state === 'not_started' ? 0 : 1;
    const withinBudget = usage
      ? usage.inputTokens <=
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens &&
        usage.outputTokens <=
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens
      : null;
    const cost = calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost(usage);
    const report = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA.parse({
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_VERSION,
      contractVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION,
      c1ContractVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
      namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
      requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
      budgetVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
      authority: input.authority,
      executorProvenance: input.executorProvenance,
      qualityAuthority: 'none',
      providerHealth:
        input.authority === 'controlled_live' && input.outcome === 'complete'
          ? 'strict_response_with_verified_usage'
          : 'unknown',
      provider: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.provider,
      model: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.model,
      timeoutMs: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE.timeoutMs,
      outcome: input.outcome,
      responseObserved: input.responseObserved,
      strictResponseObserved: input.strictResponseObserved,
      providerFailureCategory: input.providerFailureCategory,
      structuredOutputStage: input.structuredOutputStage,
      transportSubtype: input.transportSubtype,
      wire: input.wire,
      budget: {
        ...PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET,
        reservedCalls: reserved,
        reservedInputTokens:
          reserved === 1
            ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxInputTokens
            : 0,
        reservedOutputTokens:
          reserved === 1
            ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET.maxOutputTokens
            : 0,
        actualInputTokens: usage?.inputTokens ?? null,
        actualOutputTokens: usage?.outputTokens ?? null,
        withinBudget,
      },
      usage,
      cost: {
        ...PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PRICE_PROFILE,
        ...cost,
      },
    });
    return freezeReport(report);
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT');
  }
}

export function buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker(input: {
  runId: string;
  createdAt: string;
  ownerProcessId: number;
  ownerToken: string;
  source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
  proxyAttestation: Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Marker {
  try {
    return deepFreeze(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_VERSION,
        namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
        runId: input.runId,
        createdAt: input.createdAt,
        authority: 'controlled_live',
        ownerProcessId: input.ownerProcessId,
        ownerToken: input.ownerToken,
        source: input.source,
        proxyAttestation: input.proxyAttestation,
        requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
        budgetVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
        maxProviderCalls: 1,
        retry: false,
        resume: false,
        replay: false,
      }),
    );
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER');
  }
}

export function buildPhase697ArchitectureRecoveryProviderCanaryV2C2Artifact(input: {
  runId: string;
  generatedAt: string;
  source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
  proxyAttestation: Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation;
  markerSha256: string;
  terminalSequence: number;
  terminalRecordHash: string;
  completionMode: 'runtime' | 'recovery';
  publicationMode: 'runtime' | 'recovery';
  recoveryClaimSha256: string | null;
  report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report;
}): Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact {
  try {
    return deepFreeze(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_VERSION,
        namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
        runId: input.runId,
        generatedAt: input.generatedAt,
        authority: input.report.authority,
        status:
          input.report.authority === 'controlled_live' ? 'diagnostic_only' : 'synthetic_test_only',
        qualityAuthority: 'none',
        attemptDisposition: deriveAttemptDisposition(input.report),
        source: input.source,
        proxyAttestation: input.proxyAttestation,
        durability: {
          markerSha256: input.markerSha256,
          sourceSha256: sha256Canonical(input.source),
          proxyAttestationSha256: sha256Canonical(input.proxyAttestation),
          terminalSequence: input.terminalSequence,
          terminalRecordHash: input.terminalRecordHash,
          terminalReportSha256: sha256Canonical(input.report),
          completionMode: input.completionMode,
          publicationMode: input.publicationMode,
          recoveryClaimSha256: input.recoveryClaimSha256,
        },
        report: input.report,
      }),
    );
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT');
  }
}

export function phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath(input: {
  runId: string;
}) {
  const runId = z.string().uuid().parse(input.runId);
  return `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}-${runId}.json` as const;
}

export function calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost(
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null,
): Readonly<{ estimatedCostCny: string | null; withinHardCap: boolean | null }> {
  if (!usage) return Object.freeze({ estimatedCostCny: null, withinHardCap: null });
  if (
    !Number.isSafeInteger(usage.inputTokens) ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.inputTokens <= 0 ||
    usage.outputTokens <= 0
  ) {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_USAGE');
  }
  const units = BigInt(usage.inputTokens) * 300n + BigInt(usage.outputTokens) * 600n;
  const estimatedCostCny = formatCnyUnits(units);
  return Object.freeze({
    estimatedCostCny,
    withinHardCap: units <= 200_000n,
  });
}

export function sha256Canonical(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function deriveAttemptDisposition(report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report) {
  if (report.responseObserved) return 'response_observed' as const;
  if (report.wire.counters.providerDispatches === 1) return 'dispatched_no_response' as const;
  return 'not_dispatched' as const;
}

function refineOutcome(
  value: Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  context: z.RefinementCtx,
) {
  switch (value.outcome) {
    case 'complete':
      if (
        value.wire.state !== 'succeeded' ||
        !value.responseObserved ||
        !value.strictResponseObserved ||
        value.usage === null ||
        value.budget.withinBudget !== true ||
        value.cost.withinHardCap !== true ||
        value.providerFailureCategory !== null ||
        value.transportSubtype !== null
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'complete_outcome_invalid' });
      }
      break;
    case 'budget_exceeded':
      if (
        value.wire.state !== 'succeeded' ||
        value.usage === null ||
        value.budget.withinBudget !== false
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
    case 'response_observed':
      if (!value.responseObserved || value.wire.state !== 'failed') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'response_observed_invalid' });
      }
      break;
    case 'response_invalid':
      if (value.wire.state !== 'failed' || value.providerFailureCategory === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'response_invalid_outcome_invalid',
        });
      }
      break;
    case 'aborted':
      if (
        (value.wire.state !== 'not_started' && value.wire.state !== 'failed') ||
        (value.wire.state === 'failed' &&
          value.wire.failureCategory !== 'pre_dispatch_abort' &&
          value.wire.failureCategory !== 'post_dispatch_abort')
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'aborted_outcome_invalid' });
      }
      break;
    case 'timeout':
      if (value.wire.state !== 'failed' || value.wire.failureCategory !== 'runtime_timeout') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'timeout_outcome_invalid' });
      }
      break;
    case 'config_invalid':
      if (value.wire.state !== 'not_started' || value.budget.reservedCalls !== 0) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'config_outcome_invalid' });
      }
      break;
    case 'harness_internal':
      if (value.wire.state === 'succeeded') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'harness_outcome_invalid' });
      }
      break;
  }
}

function freezeReport(
  report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
): Phase697ArchitectureRecoveryProviderCanaryV2C2Report {
  return Object.freeze({
    ...report,
    wire: Object.freeze({
      ...report.wire,
      counters: Object.freeze({ ...report.wire.counters }),
    }),
    budget: Object.freeze({ ...report.budget }),
    usage: report.usage ? Object.freeze({ ...report.usage }) : null,
    cost: Object.freeze({ ...report.cost }),
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}

function formatCnyUnits(units: bigint) {
  const whole = units / 100_000_000n;
  const fraction = (units % 100_000_000n).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}
