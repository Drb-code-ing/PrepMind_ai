import { z } from 'zod';
import { createHash } from 'node:crypto';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
  freezePhase697ArchitectureRecoveryR2CanaryReport,
  type Phase697ArchitectureRecoveryR2CanaryReport,
} from './phase-6-9-7-architecture-recovery-r2-canary-contract.ts';
import {
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_STAGES,
  type Phase697V7WireStage,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-report-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-artifact-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-marker-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-journal-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-recovery-claim-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_VERSION =
  'phase-6.9.7-architecture-recovery-r3-deepseek-v4-pro-price-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX =
  'phase-6-9-7-architecture-recovery-r3-provider-canary' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX}.once.json` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX}.journal.jsonl` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH =
  `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX}.recovery-claim.json` as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH =
  'codex/phase-6-9-7-tutor-wrong-question-agents' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV =
  'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_APPROVED' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV =
  'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_INTERRUPTED_ATTEMPT_WITHOUT_PROVIDER' as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_VERSION,
  currency: 'CNY' as const,
  nonCachedInputCnyPerMillionTokens: '3.00000000' as const,
  outputCnyPerMillionTokens: '6.00000000' as const,
  hardCapCny: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.hardCapCny,
});

const SHA256_SCHEMA = z.string().regex(/^[a-f0-9]{64}$/u);
const COMMIT_SCHEMA = z.string().regex(/^[a-f0-9]{40}$/u);
const POSITIVE_SAFE_INTEGER_SCHEMA = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const CNY_SCHEMA = z.string().regex(/^\d+\.\d{8}$/u);

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA = z
  .object({
    branch: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH),
    commit: COMMIT_SCHEMA,
    trackingCommit: COMMIT_SCHEMA,
    trackedWorktreeClean: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.commit !== value.trackingCommit) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_tracking_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR3CanarySource = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA
>;

const COST_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_VERSION),
    currency: z.literal('CNY'),
    nonCachedInputCnyPerMillionTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE.nonCachedInputCnyPerMillionTokens,
    ),
    outputCnyPerMillionTokens: z.literal(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE.outputCnyPerMillionTokens,
    ),
    hardCapCny: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE.hardCapCny),
    estimatedCostCny: CNY_SCHEMA.nullable(),
    withinHardCap: z.boolean().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.estimatedCostCny === null) !== (value.withinHardCap === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'cost_presence_invalid' });
    }
  });

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION),
    authority: z.enum(['synthetic_test', 'controlled_live']),
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION),
    budgetVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION),
    providerReport: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
    cost: COST_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.authority !== value.providerReport.authority) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_authority_invalid' });
    }
    const expected = calculateCost(value.providerReport.usage);
    if (
      value.cost.estimatedCostCny !== expected.estimatedCostCny ||
      value.cost.withinHardCap !== expected.withinHardCap
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_cost_invalid' });
    }
    if (value.providerReport.outcome === 'complete' && value.cost.withinHardCap !== true) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'complete_cost_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR3CanaryReport = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION),
    runId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: false }),
    authority: z.literal('controlled_live'),
    ownerProcessId: POSITIVE_SAFE_INTEGER_SCHEMA,
    ownerToken: z.string().uuid(),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA,
    requestVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION),
    budgetVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION),
    maxProviderCalls: z.literal(1),
    retry: z.literal(false),
    resume: z.literal(false),
    replay: z.literal(false),
  })
  .strict();

export type Phase697ArchitectureRecoveryR3CanaryMarker = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_EVENTS = Object.freeze([
  'attempt_reserved',
  'wire_stage',
  'recovery_claimed',
  'runtime_terminal',
  'publication_started',
  'evidence_published',
] as const);

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RECORD_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION),
    runId: z.string().uuid(),
    sequence: POSITIVE_SAFE_INTEGER_SCHEMA,
    recordedAt: z.string().datetime({ offset: false }),
    event: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_EVENTS),
    wireStage: z.enum(PHASE_6_9_7_V7_WIRE_STAGES).nullable(),
    outcome: z
      .enum([
        'complete',
        'response_observed',
        'transport_failed',
        'response_invalid',
        'aborted',
        'timeout',
        'budget_exceeded',
        'config_invalid',
        'harness_internal',
      ])
      .nullable(),
    reportSha256: SHA256_SCHEMA.nullable(),
    evidenceSha256: SHA256_SCHEMA.nullable(),
    markerSha256: SHA256_SCHEMA.nullable(),
    recoveryClaimSha256: SHA256_SCHEMA.nullable(),
    completionMode: z.enum(['runtime_terminal', 'crash_only_seal']).nullable(),
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.nullable(),
    previousHash: SHA256_SCHEMA.nullable(),
    recordHash: SHA256_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.sequence === 1) !== (value.previousHash === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'journal_previous_hash_invalid' });
    }
    const validEventFields =
      (value.event === 'attempt_reserved' &&
        value.wireStage === null &&
        value.outcome === null &&
        value.reportSha256 === null &&
        value.evidenceSha256 === null &&
        value.markerSha256 !== null &&
        value.recoveryClaimSha256 === null &&
        value.completionMode === null &&
        value.report === null) ||
      (value.event === 'wire_stage' &&
        value.wireStage !== null &&
        value.outcome === null &&
        value.reportSha256 === null &&
        value.evidenceSha256 === null &&
        value.markerSha256 === null &&
        value.recoveryClaimSha256 === null &&
        value.completionMode === null &&
        value.report === null) ||
      (value.event === 'recovery_claimed' &&
        value.wireStage === null &&
        value.outcome === null &&
        value.reportSha256 === null &&
        value.evidenceSha256 === null &&
        value.markerSha256 === null &&
        value.recoveryClaimSha256 !== null &&
        value.completionMode === null &&
        value.report === null) ||
      (value.event === 'runtime_terminal' &&
        value.wireStage === null &&
        value.outcome !== null &&
        value.reportSha256 !== null &&
        value.evidenceSha256 === null &&
        value.markerSha256 === null &&
        value.recoveryClaimSha256 === null &&
        value.completionMode !== null &&
        value.report !== null &&
        value.report.providerReport.outcome === value.outcome &&
        sha256Canonical(value.report) === value.reportSha256) ||
      (value.event === 'publication_started' &&
        value.wireStage === null &&
        value.outcome === null &&
        value.reportSha256 === null &&
        value.evidenceSha256 === null &&
        value.markerSha256 === null &&
        value.recoveryClaimSha256 === null &&
        value.completionMode === null &&
        value.report === null) ||
      (value.event === 'evidence_published' &&
        value.wireStage === null &&
        value.outcome === null &&
        value.reportSha256 === null &&
        value.evidenceSha256 !== null &&
        value.markerSha256 === null &&
        value.recoveryClaimSha256 === null &&
        value.completionMode === null &&
        value.report === null);
    if (!validEventFields) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'journal_event_fields_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR3CanaryJournalRecord = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RECORD_SCHEMA
>;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION),
    runId: z.string().uuid(),
    claimedAt: z.string().datetime({ offset: false }),
    ownerProcessId: POSITIVE_SAFE_INTEGER_SCHEMA,
    ownerToken: z.string().uuid(),
    markerSha256: SHA256_SCHEMA,
    journalTailRecordHash: SHA256_SCHEMA,
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697ArchitectureRecoveryR3CanaryRecoveryClaim = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA
>;

const DURABILITY_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION),
    journalVersion: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION),
    markerSha256: SHA256_SCHEMA,
    terminalSequence: POSITIVE_SAFE_INTEGER_SCHEMA,
    terminalRecordHash: SHA256_SCHEMA,
    terminalReportSha256: SHA256_SCHEMA,
    completionMode: z.enum(['runtime_terminal', 'crash_only_seal']),
    publicationMode: z.enum(['runtime', 'recovery']),
    recoveryClaimSha256: SHA256_SCHEMA.nullable(),
    publication: z.literal('exclusive_hard_link'),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.publicationMode === 'recovery') !== (value.recoveryClaimSha256 !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'durability_recovery_claim_invalid',
      });
    }
    if (value.completionMode === 'crash_only_seal' && value.publicationMode !== 'recovery') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'durability_crash_seal_invalid' });
    }
  });

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_VERSION),
    runId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: false }),
    authority: z.literal('controlled_live'),
    status: z.literal('diagnostic_only'),
    qualityAuthority: z.literal('none'),
    attemptDisposition: z.enum(['not_dispatched', 'dispatched_no_response', 'response_observed']),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA,
    durability: DURABILITY_SCHEMA,
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.report.authority !== 'controlled_live') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact_authority_invalid' });
    }
    if (value.attemptDisposition !== attemptDisposition(value.report.providerReport)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact_attempt_invalid' });
    }
  });

export type Phase697ArchitectureRecoveryR3CanaryArtifact = z.infer<
  typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA
>;

const MARKER_INPUT_SCHEMA = z
  .object({
    runId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: false }),
    ownerProcessId: POSITIVE_SAFE_INTEGER_SCHEMA,
    ownerToken: z.string().uuid(),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA,
  })
  .strict();

const ARTIFACT_INPUT_SCHEMA = z
  .object({
    runId: z.string().uuid(),
    generatedAt: z.string().datetime({ offset: false }),
    source: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_SOURCE_SCHEMA,
    markerSha256: SHA256_SCHEMA,
    terminalSequence: POSITIVE_SAFE_INTEGER_SCHEMA,
    terminalRecordHash: SHA256_SCHEMA,
    completionMode: z.enum(['runtime_terminal', 'crash_only_seal']),
    publicationMode: z.enum(['runtime', 'recovery']),
    recoveryClaimSha256: SHA256_SCHEMA.nullable(),
    report: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  })
  .strict();

const INVALID_REPORT = 'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT';
const INVALID_MARKER = 'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER';
const INVALID_ARTIFACT = 'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT';

export function buildPhase697ArchitectureRecoveryR3CanaryReport(
  providerReport: Phase697ArchitectureRecoveryR2CanaryReport,
): Phase697ArchitectureRecoveryR3CanaryReport {
  try {
    const parsedProvider =
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.parse(providerReport);
    const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.parse({
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION,
      authority: parsedProvider.authority,
      requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
      budgetVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
      providerReport: parsedProvider,
      cost: calculateCost(parsedProvider.usage),
    });
    return freezeReport(parsed);
  } catch {
    throw new Error(INVALID_REPORT);
  }
}

export function buildPhase697ArchitectureRecoveryR3CanaryMarker(
  input: z.input<typeof MARKER_INPUT_SCHEMA>,
): Phase697ArchitectureRecoveryR3CanaryMarker {
  try {
    const parsed = MARKER_INPUT_SCHEMA.parse(input);
    return freezeMarker(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION,
        runId: parsed.runId,
        createdAt: parsed.createdAt,
        authority: 'controlled_live',
        ownerProcessId: parsed.ownerProcessId,
        ownerToken: parsed.ownerToken,
        source: parsed.source,
        requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
        budgetVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
        maxProviderCalls: 1,
        retry: false,
        resume: false,
        replay: false,
      }),
    );
  } catch {
    throw new Error(INVALID_MARKER);
  }
}

export function buildPhase697ArchitectureRecoveryR3CanaryArtifact(
  input: z.input<typeof ARTIFACT_INPUT_SCHEMA>,
): Phase697ArchitectureRecoveryR3CanaryArtifact {
  try {
    const parsed = ARTIFACT_INPUT_SCHEMA.parse(input);
    if (parsed.report.authority !== 'controlled_live') throw new Error();
    return freezeArtifact(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_VERSION,
        runId: parsed.runId,
        generatedAt: parsed.generatedAt,
        authority: 'controlled_live',
        status: 'diagnostic_only',
        qualityAuthority: 'none',
        attemptDisposition: attemptDisposition(parsed.report.providerReport),
        source: parsed.source,
        durability: {
          markerVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION,
          journalVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION,
          markerSha256: parsed.markerSha256,
          terminalSequence: parsed.terminalSequence,
          terminalRecordHash: parsed.terminalRecordHash,
          terminalReportSha256: sha256Canonical(parsed.report),
          completionMode: parsed.completionMode,
          publicationMode: parsed.publicationMode,
          recoveryClaimSha256: parsed.recoveryClaimSha256,
          publication: 'exclusive_hard_link',
        },
        report: parsed.report,
      }),
    );
  } catch {
    throw new Error(INVALID_ARTIFACT);
  }
}

export function buildPhase697ArchitectureRecoveryR3CrashSealReport(
  stages: readonly Phase697V7WireStage[],
): Phase697ArchitectureRecoveryR3CanaryReport {
  try {
    const parsedStages = z.array(z.enum(PHASE_6_9_7_V7_WIRE_STAGES)).max(8).parse(stages);
    if (parsedStages.some((stage, index) => stage !== PHASE_6_9_7_V7_WIRE_STAGES[index])) {
      throw new Error();
    }
    const hasExecutor = parsedStages.includes('executor_entered');
    const counters = {
      executorInvocations: hasExecutor ? (1 as const) : (0 as const),
      providerDispatches: parsedStages.includes('provider_dispatch_started')
        ? (1 as const)
        : (0 as const),
      providerResponses: parsedStages.includes('provider_response_received')
        ? (1 as const)
        : (0 as const),
      verifiedUsages: parsedStages.includes('usage_validated') ? (1 as const) : (0 as const),
    };
    const providerReport = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.parse({
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
      requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
      authority: 'controlled_live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      timeoutMs: 5_000,
      outcome: 'harness_internal',
      responseObserved: counters.providerResponses === 1,
      providerFailureCategory: null,
      structuredOutputStage: null,
      transportSubtype: null,
      wire:
        parsedStages.length === 0
          ? {
              version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
              state: 'not_started',
              lastCompletedStage: null,
              failureCategory: null,
              counters,
            }
          : {
              version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
              state: 'failed',
              lastCompletedStage: parsedStages.at(-1) ?? null,
              failureCategory: 'harness_internal',
              counters,
            },
      budget: {
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
        scope: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.scope,
        maxCalls: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxCalls,
        maxInputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens,
        maxOutputTokens: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens,
        hardCapCny: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.hardCapCny,
        reservedCalls: hasExecutor ? 1 : 0,
        reservedInputTokens: hasExecutor
          ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxInputTokens
          : 0,
        reservedOutputTokens: hasExecutor
          ? PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET.maxOutputTokens
          : 0,
        actualInputTokens: null,
        actualOutputTokens: null,
        withinBudget: null,
      },
      usage: null,
    });
    return buildPhase697ArchitectureRecoveryR3CanaryReport(providerReport);
  } catch {
    throw new Error(INVALID_REPORT);
  }
}

export function phase697ArchitectureRecoveryR3CanaryArtifactPath(input: { runId: string }): string {
  try {
    const runId = z.string().uuid().parse(input.runId);
    return `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX}-${runId}.json`;
  } catch {
    throw new Error(INVALID_ARTIFACT);
  }
}

function calculateCost(usage: Readonly<{ inputTokens: number; outputTokens: number }> | null) {
  if (usage === null) {
    return Object.freeze({
      ...PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE,
      estimatedCostCny: null,
      withinHardCap: null,
    });
  }
  const units = BigInt(usage.inputTokens * 3 + usage.outputTokens * 6) * 100n;
  const hardCapUnits = 200_000n;
  return Object.freeze({
    ...PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE,
    estimatedCostCny: formatCnyUnits(units),
    withinHardCap: units <= hardCapUnits,
  });
}

function formatCnyUnits(units: bigint) {
  const whole = units / 100_000_000n;
  const fractional = (units % 100_000_000n).toString().padStart(8, '0');
  return `${whole}.${fractional}`;
}

function sha256Canonical(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function attemptDisposition(
  report: Phase697ArchitectureRecoveryR2CanaryReport,
): Phase697ArchitectureRecoveryR3CanaryArtifact['attemptDisposition'] {
  if (report.wire.counters.providerDispatches === 0) return 'not_dispatched';
  return report.responseObserved ? 'response_observed' : 'dispatched_no_response';
}

function freezeReport(
  value: Phase697ArchitectureRecoveryR3CanaryReport,
): Phase697ArchitectureRecoveryR3CanaryReport {
  return Object.freeze({
    ...value,
    providerReport: freezePhase697ArchitectureRecoveryR2CanaryReport(value.providerReport),
    cost: Object.freeze({ ...value.cost }),
  });
}

function freezeMarker(
  value: Phase697ArchitectureRecoveryR3CanaryMarker,
): Phase697ArchitectureRecoveryR3CanaryMarker {
  return Object.freeze({ ...value, source: Object.freeze({ ...value.source }) });
}

function freezeArtifact(
  value: Phase697ArchitectureRecoveryR3CanaryArtifact,
): Phase697ArchitectureRecoveryR3CanaryArtifact {
  return Object.freeze({
    ...value,
    source: Object.freeze({ ...value.source }),
    durability: Object.freeze({ ...value.durability }),
    report: freezeReport(value.report),
  });
}
