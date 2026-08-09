import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
  RETRIEVER_SCHEMA_RECOVERY_STAGES,
  type RetrieverSchemaRecoveryBoundedDiagnostic,
} from '../model-candidates/retriever-schema-recovery-contract.ts';
import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_MANIFEST,
  type Phase698Task8FinalResponseCase,
  type Phase698Task8GuardCase,
  type Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE =
  'phase-6.9.8-retriever-final-response-schema-recovery-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-policy-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-report-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-source-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-schema-recovery-sr3' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF =
  'refs/tags/phase-6-9-8-retriever-final-response-schema-recovery-sr3-approved' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256 =
  '59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_runner_durability' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const SAFE_REFERENCE = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

const SR3_GUARD_CASES = PHASE_6_9_8_TASK8_MANIFEST.guardCases.slice(0, 8);
const SR3_REWRITE_CASES = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.slice(0, 6);
const SR3_FINAL_RESPONSE_CASES = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.slice(0, 6);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST = deepFreeze({
  lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
  guardCases: SR3_GUARD_CASES,
  rewriteCases: SR3_REWRITE_CASES,
  finalResponseCases: SR3_FINAL_RESPONSE_CASES,
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256 = sha256(
  canonicalPhase698RetrieverSchemaRecoverySr3Json(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST,
  ),
);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY = deepFreeze({
  version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_VERSION,
  lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
  counts: {
    guards: 8,
    rewriteCandidates: 6,
    finalResponseCandidates: 6,
    candidateInvocations: 12,
    reportEntries: 20,
  },
  concurrency: {
    maximum: 1,
    pairSerial: true,
    pairLaneSerial: true,
  },
  budget: {
    inputTokensMax: 37_600,
    outputTokensMax: 8_800,
    totalCostCnyMax: 0.176,
  },
  durability: {
    reservationBeforeDispatch: true,
    fsyncBeforeDispatch: true,
    retry: false,
    replay: false,
    resume: false,
    backfill: false,
    backgroundJob: false,
    outbox: false,
  },
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256 = sha256(
  canonicalPhase698RetrieverSchemaRecoverySr3Json(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY),
);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES = deepFreeze({
  task8ManifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  sr2FixtureSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256,
  schemaRecoveryContractSha256: RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
  sr3ManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256,
  sr3PolicySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256,
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_VERSION),
    branch: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceRef: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF),
    approvedSourceCommit: COMMIT,
    admissionAuthority: z.enum(['synthetic_fixture', 'git_verified']),
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: SHA256,
    identities: z
      .object({
        task8ManifestSha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.task8ManifestSha256,
        ),
        sr2FixtureSha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr2FixtureSha256,
        ),
        schemaRecoveryContractSha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.schemaRecoveryContractSha256,
        ),
        sr3ManifestSha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3ManifestSha256,
        ),
        sr3PolicySha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3PolicySha256,
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedSourceCommit
    ) {
      context.addIssue({ code: 'custom', message: 'source parity mismatch' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr3Source = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA
>;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_PHASES = [
  'rewrite_candidate_model',
  'final_response_model',
] as const;
export type Phase698RetrieverSchemaRecoverySr3LanePhase =
  (typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_PHASES)[number];

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_STAGES = [
  'dispatch_started',
  'response_observed',
  'usage_verified',
] as const;
export type Phase698RetrieverSchemaRecoverySr3LaneStage =
  (typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_STAGES)[number];

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_FAILURE_REASONS = [
  'aborted',
  'timeout',
  'transport',
  'http',
  'schema',
  'usage',
  'budget',
  'permission',
  'safety',
  'stale',
  'runtime_contract',
  'case_guard',
  'quality_breaker',
] as const;
export type Phase698RetrieverSchemaRecoverySr3FailureReason =
  (typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_FAILURE_REASONS)[number];

export type Phase698RetrieverSchemaRecoverySr3LaneIdentity = Readonly<{
  laneId: string;
  caseId: string;
  phase: Phase698RetrieverSchemaRecoverySr3LanePhase;
}>;

const GUARD_ID = z.string().regex(/^guard_0[1-8]$/u);
const REWRITE_ID = z.string().regex(/^rewrite_0[1-6]$/u);
const FINAL_ID = z.string().regex(/^final_0[1-6]$/u);
const LANE_ID = z
  .string()
  .regex(/^(?:rewrite_0[1-6]\.rewrite_candidate_model|final_0[1-6]\.final_response_model)$/u);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA = z
  .object({
    kind: z.literal('guard'),
    caseId: GUARD_ID,
    disposition: z.enum(['passed', 'failed']),
    observedReasonCode: SAFE_CODE,
    expectedReasonCode: SAFE_CODE,
    zeroCallVerified: z.boolean(),
    permissionFailure: z.boolean(),
    crossOwnerFailure: z.boolean(),
    credentialFailure: z.boolean(),
    injectionFailure: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const passed =
      value.observedReasonCode === value.expectedReasonCode &&
      value.zeroCallVerified &&
      !value.permissionFailure &&
      !value.crossOwnerFailure &&
      !value.credentialFailure &&
      !value.injectionFailure;
    if ((value.disposition === 'passed') !== passed) {
      context.addIssue({ code: 'custom', message: 'guard disposition mismatch' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr3GuardEntry = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA
>;

const USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();

const SCHEMA_STAGE = z.enum([...RETRIEVER_SCHEMA_RECOVERY_STAGES, 'final_response_stream']);
const SCHEMA_DISPOSITION = z.enum([
  'canonical',
  'extensions_discarded',
  'not_applicable',
  'rejected',
]);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA = z
  .object({
    kind: z.literal('candidate_lane'),
    laneId: LANE_ID,
    caseId: z.union([REWRITE_ID, FINAL_ID]),
    phase: z.enum(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_PHASES),
    transportAuthority: z.literal('synthetic_injected'),
    disposition: z.enum([
      'succeeded',
      'failed',
      'aborted',
      'timeout',
      'not_started_case_guard',
      'not_started_quality_breaker',
      'not_started_external_abort',
    ]),
    failureReason: z.enum(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_FAILURE_REASONS).nullable(),
    wire: z
      .object({
        reservations: z.number().int().min(0).max(1),
        dispatches: z.number().int().min(0).max(1),
        responses: z.number().int().min(0).max(1),
        verifiedUsage: z.number().int().min(0).max(1),
      })
      .strict(),
    schemaStage: SCHEMA_STAGE.nullable(),
    schemaDisposition: SCHEMA_DISPOSITION.nullable(),
    schemaDiagnostic: RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.nullable(),
    usage: USAGE_SCHEMA.nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    durationMs: z.number().nonnegative().finite().nullable(),
    resultDigest: SAFE_REFERENCE.nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    const expected = expectedPhase698RetrieverSchemaRecoverySr3Lane(entry.laneId);
    if (
      expected === null ||
      expected.caseId !== entry.caseId ||
      expected.phase !== entry.phase ||
      entry.transportAuthority !== 'synthetic_injected'
    ) {
      context.addIssue({ code: 'custom', message: 'lane identity mismatch' });
      return;
    }
    const { reservations, dispatches, responses, verifiedUsage } = entry.wire;
    if (!(reservations >= dispatches && dispatches >= responses && responses >= verifiedUsage)) {
      context.addIssue({ code: 'custom', message: 'wire prefix mismatch' });
    }
    if (entry.disposition.startsWith('not_started_')) {
      const expectedReason =
        entry.disposition === 'not_started_case_guard'
          ? 'case_guard'
          : entry.disposition === 'not_started_external_abort'
            ? 'aborted'
            : 'quality_breaker';
      if (
        reservations !== 0 ||
        dispatches !== 0 ||
        responses !== 0 ||
        verifiedUsage !== 0 ||
        entry.failureReason !== expectedReason ||
        entry.schemaStage !== null ||
        entry.schemaDisposition !== null ||
        entry.schemaDiagnostic !== null ||
        entry.usage !== null ||
        entry.verifiedCostCny !== null ||
        entry.durationMs !== null ||
        entry.resultDigest !== null
      ) {
        context.addIssue({ code: 'custom', message: 'not-started lane mismatch' });
      }
      return;
    }
    if (reservations !== 1 || entry.durationMs === null) {
      context.addIssue({ code: 'custom', message: 'attempted lane mismatch' });
    }
    if (entry.disposition === 'succeeded') {
      if (
        dispatches !== 1 ||
        responses !== 1 ||
        verifiedUsage !== 1 ||
        entry.failureReason !== null ||
        entry.schemaStage === null ||
        entry.schemaDisposition === null ||
        entry.schemaDisposition === 'rejected' ||
        entry.usage === null ||
        entry.verifiedCostCny === null ||
        entry.resultDigest === null
      ) {
        context.addIssue({ code: 'custom', message: 'successful lane mismatch' });
      }
      if (
        entry.phase === 'rewrite_candidate_model' &&
        entry.schemaDisposition === 'not_applicable'
      ) {
        context.addIssue({ code: 'custom', message: 'rewrite schema disposition mismatch' });
      }
      if (
        entry.phase === 'final_response_model' &&
        (entry.schemaStage !== 'final_response_stream' ||
          entry.schemaDisposition !== 'not_applicable' ||
          entry.schemaDiagnostic !== null)
      ) {
        context.addIssue({ code: 'custom', message: 'final schema disposition mismatch' });
      }
      if (
        entry.schemaDisposition === 'extensions_discarded' &&
        entry.schemaDiagnostic?.reasonCode !== 'extension_fields_discarded'
      ) {
        context.addIssue({ code: 'custom', message: 'extension diagnostic mismatch' });
      }
      return;
    }
    if (entry.failureReason === null || entry.resultDigest !== null) {
      context.addIssue({ code: 'custom', message: 'failed lane mismatch' });
    }
    if (verifiedUsage === 1) {
      if (entry.usage === null || entry.verifiedCostCny === null) {
        context.addIssue({ code: 'custom', message: 'verified usage mismatch' });
      }
    } else if (entry.usage !== null || entry.verifiedCostCny !== null) {
      context.addIssue({ code: 'custom', message: 'unverified usage retained' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr3LaneEntry = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA
>;

const GATE_SCHEMA = z
  .object({
    status: z.enum([
      'schema_recovery_mock_quality_not_evidence',
      'schema_recovery_durability_failed',
    ]),
    passed: z.boolean(),
    qualityAuthority: z.literal('none'),
    failureReasons: z.array(SAFE_CODE),
  })
  .strict();

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY),
    qualityAuthority: z.literal('none'),
    completionMode: z.enum(['runtime', 'recovery']),
    runMode: z.enum(['reviewed_mock', 'synthetic_fault']),
    source: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA,
    manifestSha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256),
    execution: z
      .object({
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        businessWrites: z.literal(0),
        syntheticInvocations: z.number().int().min(0).max(12),
        maximumConcurrency: z.literal(1),
        retry: z.literal(false),
        replay: z.literal(false),
        resume: z.literal(false),
        backfill: z.literal(false),
        backgroundJob: z.literal(false),
        outbox: z.literal(false),
      })
      .strict(),
    caseCounts: z
      .object({
        guards: z.literal(8),
        rewriteCandidates: z.literal(6),
        finalResponseCandidates: z.literal(6),
        candidateInvocations: z.literal(12),
        reportEntries: z.literal(20),
      })
      .strict(),
    guards: z
      .object({
        passCount: z.number().int().min(0).max(8),
        zeroCallCount: z.number().int().min(0).max(8),
        safetyFailureCount: z.number().int().nonnegative(),
      })
      .strict(),
    runtime: z
      .object({
        reservations: z.number().int().min(0).max(12),
        dispatches: z.number().int().min(0).max(12),
        responses: z.number().int().min(0).max(12),
        verifiedUsage: z.number().int().min(0).max(12),
        succeeded: z.number().int().min(0).max(12),
        failed: z.number().int().min(0).max(12),
        notStarted: z.number().int().min(0).max(12),
        inputTokens: z.number().int().positive().nullable(),
        outputTokens: z.number().int().nonnegative().nullable(),
        verifiedCostCny: z.number().nonnegative().finite().nullable(),
      })
      .strict(),
    schema: z
      .object({
        rewriteCanonical: z.number().int().min(0).max(6),
        rewriteExtensionsDiscarded: z.number().int().min(0).max(6),
        rewriteRejected: z.number().int().min(0).max(6),
        finalResponseStrict: z.number().int().min(0).max(6),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    gate: GATE_SCHEMA,
    guardEntries: z.array(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA).length(8),
    laneEntries: z.array(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA).length(12),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr3Report = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA
>;

export type BuildPhase698RetrieverSchemaRecoverySr3ReportInput = Readonly<{
  runId: string;
  completionMode: 'runtime' | 'recovery';
  runMode: 'reviewed_mock' | 'synthetic_fault';
  source: Phase698RetrieverSchemaRecoverySr3Source;
  guardEntries: readonly Phase698RetrieverSchemaRecoverySr3GuardEntry[];
  laneEntries: readonly Phase698RetrieverSchemaRecoverySr3LaneEntry[];
}>;

export function buildPhase698RetrieverSchemaRecoverySr3Report(
  input: BuildPhase698RetrieverSchemaRecoverySr3ReportInput,
): Phase698RetrieverSchemaRecoverySr3Report {
  const source = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.parse(input.source);
  const guardEntries = z
    .array(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA)
    .length(8)
    .parse(input.guardEntries);
  const laneEntries = z
    .array(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA)
    .length(12)
    .parse(input.laneEntries);
  assertEntryOrder(guardEntries, laneEntries);

  const passCount = guardEntries.filter((entry) => entry.disposition === 'passed').length;
  const zeroCallCount = guardEntries.filter((entry) => entry.zeroCallVerified).length;
  const safetyFailureCount = guardEntries.filter(
    (entry) =>
      entry.permissionFailure ||
      entry.crossOwnerFailure ||
      entry.credentialFailure ||
      entry.injectionFailure,
  ).length;
  const succeeded = laneEntries.filter((entry) => entry.disposition === 'succeeded');
  const complete = succeeded.length === 12;
  const runtime = {
    reservations: sum(laneEntries.map((entry) => entry.wire.reservations)),
    dispatches: sum(laneEntries.map((entry) => entry.wire.dispatches)),
    responses: sum(laneEntries.map((entry) => entry.wire.responses)),
    verifiedUsage: sum(laneEntries.map((entry) => entry.wire.verifiedUsage)),
    succeeded: succeeded.length,
    failed: laneEntries.filter(
      (entry) => !entry.disposition.startsWith('not_started_') && entry.disposition !== 'succeeded',
    ).length,
    notStarted: laneEntries.filter((entry) => entry.disposition.startsWith('not_started_')).length,
    inputTokens: complete ? sum(succeeded.map((entry) => entry.usage!.inputTokens)) : null,
    outputTokens: complete ? sum(succeeded.map((entry) => entry.usage!.outputTokens)) : null,
    verifiedCostCny: complete
      ? roundCost(sum(succeeded.map((entry) => entry.verifiedCostCny!)))
      : null,
  };
  const rewriteEntries = laneEntries.filter((entry) => entry.phase === 'rewrite_candidate_model');
  const finalEntries = laneEntries.filter((entry) => entry.phase === 'final_response_model');
  const schema = {
    rewriteCanonical: rewriteEntries.filter(
      (entry) => entry.disposition === 'succeeded' && entry.schemaDisposition === 'canonical',
    ).length,
    rewriteExtensionsDiscarded: rewriteEntries.filter(
      (entry) =>
        entry.disposition === 'succeeded' && entry.schemaDisposition === 'extensions_discarded',
    ).length,
    rewriteRejected: rewriteEntries.filter(
      (entry) => entry.schemaDisposition === 'rejected' || entry.failureReason === 'schema',
    ).length,
    finalResponseStrict: finalEntries.filter((entry) => entry.disposition === 'succeeded').length,
    rawDataRetained: false as const,
  };
  const failures: string[] = [];
  if (input.completionMode !== 'runtime') failures.push('completion_mode');
  if (passCount !== 8 || zeroCallCount !== 8) failures.push('guard_count');
  if (safetyFailureCount !== 0) failures.push('guard_safety');
  if (!complete) failures.push('candidate_denominator');
  if (
    runtime.inputTokens === null ||
    runtime.outputTokens === null ||
    runtime.inputTokens > PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.inputTokensMax ||
    runtime.outputTokens >
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.outputTokensMax ||
    runtime.verifiedCostCny === null ||
    runtime.verifiedCostCny >
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.totalCostCnyMax
  ) {
    failures.push('budget_accounting');
  }
  if (schema.rewriteCanonical + schema.rewriteExtensionsDiscarded !== 6) {
    failures.push('rewrite_schema');
  }
  if (schema.finalResponseStrict !== 6) failures.push('final_response_schema');
  const passed = failures.length === 0;
  const gate = {
    status: passed
      ? ('schema_recovery_mock_quality_not_evidence' as const)
      : ('schema_recovery_durability_failed' as const),
    passed,
    qualityAuthority: 'none' as const,
    failureReasons: failures,
  };
  return deepFreeze(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA.parse({
      version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_VERSION,
      lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
      runId: input.runId,
      authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
      qualityAuthority: 'none',
      completionMode: input.completionMode,
      runMode: input.runMode,
      source,
      manifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256,
      execution: {
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        syntheticInvocations: runtime.dispatches,
        maximumConcurrency: 1,
        retry: false,
        replay: false,
        resume: false,
        backfill: false,
        backgroundJob: false,
        outbox: false,
      },
      caseCounts: {
        guards: 8,
        rewriteCandidates: 6,
        finalResponseCandidates: 6,
        candidateInvocations: 12,
        reportEntries: 20,
      },
      guards: { passCount, zeroCallCount, safetyFailureCount },
      runtime,
      schema,
      gate,
      guardEntries,
      laneEntries,
    }),
  );
}

export function parsePhase698RetrieverSchemaRecoverySr3Report(
  value: unknown,
): Phase698RetrieverSchemaRecoverySr3Report | null {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA.safeParse(value);
  if (!parsed.success) return null;
  try {
    const rebuilt = buildPhase698RetrieverSchemaRecoverySr3Report({
      runId: parsed.data.runId,
      completionMode: parsed.data.completionMode,
      runMode: parsed.data.runMode,
      source: parsed.data.source,
      guardEntries: parsed.data.guardEntries,
      laneEntries: parsed.data.laneEntries,
    });
    return canonicalPhase698RetrieverSchemaRecoverySr3Json(rebuilt) ===
      canonicalPhase698RetrieverSchemaRecoverySr3Json(parsed.data)
      ? rebuilt
      : null;
  } catch {
    return null;
  }
}

export function expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule(): readonly Phase698RetrieverSchemaRecoverySr3LaneIdentity[] {
  return deepFreeze(
    SR3_REWRITE_CASES.flatMap((rewrite, index) => {
      const finalResponse = SR3_FINAL_RESPONSE_CASES[index];
      if (!finalResponse) {
        throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_INVALID');
      }
      return [
        {
          laneId: `${rewrite.caseId}.rewrite_candidate_model`,
          caseId: rewrite.caseId,
          phase: 'rewrite_candidate_model' as const,
        },
        {
          laneId: `${finalResponse.caseId}.final_response_model`,
          caseId: finalResponse.caseId,
          phase: 'final_response_model' as const,
        },
      ];
    }),
  );
}

export function expectedPhase698RetrieverSchemaRecoverySr3Lane(
  laneId: string,
): Phase698RetrieverSchemaRecoverySr3LaneIdentity | null {
  return (
    expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule().find(
      (entry) => entry.laneId === laneId,
    ) ?? null
  );
}

export function canonicalPhase698RetrieverSchemaRecoverySr3Json(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Phase698RetrieverSchemaRecoverySr3(value: string | Uint8Array): string {
  return sha256(value);
}

function assertEntryOrder(
  guards: readonly Phase698RetrieverSchemaRecoverySr3GuardEntry[],
  lanes: readonly Phase698RetrieverSchemaRecoverySr3LaneEntry[],
) {
  const expectedGuards = SR3_GUARD_CASES.map((entry) => entry.caseId);
  const expectedLanes = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule().map(
    (entry) => entry.laneId,
  );
  if (
    canonicalPhase698RetrieverSchemaRecoverySr3Json(guards.map((entry) => entry.caseId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr3Json(expectedGuards) ||
    canonicalPhase698RetrieverSchemaRecoverySr3Json(lanes.map((entry) => entry.laneId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr3Json(expectedLanes)
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ENTRY_ORDER_INVALID');
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key])]),
  );
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCost(value: number) {
  return Number(value.toFixed(9));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export type Phase698RetrieverSchemaRecoverySr3GuardCase = Phase698Task8GuardCase;
export type Phase698RetrieverSchemaRecoverySr3RewriteCase = Phase698Task8RewriteCase;
export type Phase698RetrieverSchemaRecoverySr3FinalResponseCase = Phase698Task8FinalResponseCase;
export type Phase698RetrieverSchemaRecoverySr3Diagnostic = RetrieverSchemaRecoveryBoundedDiagnostic;
