import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_MANIFEST,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_WIRE_STAGES,
  canonicalPhase698Task9Json,
  expectedPhase698Task9CallSchedule,
  type Phase698Task9CallEntry,
  type Phase698Task9CallIdentity,
  type Phase698Task9FinalEntry,
  type Phase698Task9GuardEntry,
  type Phase698Task9RewriteEntry,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import { PHASE_6_9_8_TASK9_EVAL_POLICY } from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
  type Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-manifest.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA as LIVE_SOURCE_SCHEMA,
  type Phase698RetrieverSchemaRecoverySr5LiveSource,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-schema.ts';

export { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE };

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-report-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-policy-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY =
  'controlled_live_retriever_final_response_schema_recovery_sr5' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY =
  'synthetic_test_retriever_final_response_schema_recovery_sr5' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QUALITY_AUTHORITY =
  'schema_recovery_sr5_branch_semantic_gate' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V8_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORIZATION_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V8_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT =
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORIZATION_CONFIRMATION;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT =
  'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_BUNDLE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVER_ARGUMENT =
  'RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CRASH_ONLY_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_QWEN_API_KEY' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1' as const;

const UUID = z.string().uuid();
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);

const guardCases = Object.freeze(PHASE_6_9_8_TASK8_MANIFEST.guardCases.slice(0, 8));
const rewriteCases = Object.freeze(PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.slice(0, 6));
const finalResponseCases = Object.freeze(PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.slice(0, 6));
const selectedCaseIds = new Set([
  ...rewriteCases.map((entry) => entry.caseId),
  ...finalResponseCases.map((entry) => entry.caseId),
]);
const callSchedule = Object.freeze(
  expectedPhase698Task9CallSchedule().filter((entry) => selectedCaseIds.has(entry.caseId)),
);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST = deepFreeze({
  lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  upstreamTask8ManifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  approvedBranch: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  approvedTag: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
  approvedSourceRef: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  guardCases,
  rewriteCases,
  finalResponseCases,
  callSchedule,
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST_SHA256 = sha256(
  canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST,
  ),
);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY = deepFreeze({
  version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY_VERSION,
  lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  counts: {
    guards: 8,
    rewritePairs: 6,
    finalResponseCases: 6,
    deepseekCalls: 12,
    qwenEmbeddingCalls: 12,
    providerCalls: 24,
  },
  budget: {
    inputTokensMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxInputTokens,
    outputTokensMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxOutputTokens,
    totalCostCnyMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxCostMicrosCny / 1_000_000,
  },
  thresholds: {
    retrieverRecallAt5: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.retrieverRecallAt5,
    retrieverNdcgAt5: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.retrieverNdcgAt5,
    eligibleSubsetNdcgUplift: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.eligibleSubsetNdcgUplift,
    criticalTargetRecall: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.criticalTargetRecall,
    rewriteIntentPreservation: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.rewriteIntentPreservation,
    finalResponseGroundedRubric:
      PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.finalResponseGroundedRubric,
    citationPrecision: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.citationPrecision,
    requiredCitationRecall: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.requiredCitationRecall,
    criticalNoticeRecall: PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.criticalNoticeRecall,
  },
  execution: {
    maximumConcurrency: 1,
    guardFirst: true,
    pairSerial: true,
    singleDispatchPerCall: true,
    credentialReads: 3,
    retry: false,
    resume: false,
    replay: false,
    backfill: false,
    backgroundJob: false,
    outbox: false,
  },
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY_SHA256 = sha256(
  canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY,
  ),
);

const PROVIDER_AGGREGATE_SCHEMA = z
  .object({
    expectedCalls: z.number().int().positive(),
    attempts: z.number().int().nonnegative(),
    dispatches: z.number().int().nonnegative(),
    responses: z.number().int().nonnegative(),
    verifiedUsage: z.number().int().nonnegative(),
    inputTokens: z.number().int().positive().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
  })
  .strict();

const GATE_SCHEMA = z
  .object({
    status: z.enum([
      'schema_recovery_sr5_branch_semantic_gate_passed',
      'schema_recovery_sr5_branch_quality_gate_failed',
    ]),
    passed: z.boolean(),
    qualityAuthority: z.enum([
      'none',
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QUALITY_AUTHORITY,
    ]),
    failureReasons: z.array(SAFE_CODE),
  })
  .strict()
  .superRefine((value, context) => {
    const passed =
      value.status === 'schema_recovery_sr5_branch_semantic_gate_passed' &&
      value.qualityAuthority === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QUALITY_AUTHORITY &&
      value.failureReasons.length === 0;
    if (value.passed !== passed) {
      context.addIssue({ code: 'custom', message: 'gate authority mismatch' });
    }
  });

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    runId: UUID,
    authority: z.enum([
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY,
    ]),
    qualityAuthority: z.enum([
      'none',
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QUALITY_AUTHORITY,
    ]),
    completionMode: z.enum(['runtime', 'recovery']),
    source: LIVE_SOURCE_SCHEMA,
    sourceBinding: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
    manifestSha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY_SHA256),
    execution: z
      .object({
        mode: z.enum(['live', 'reviewed_mock']),
        sourceAdmissionExecuted: z.boolean(),
        credentialReads: z.union([z.literal(0), z.literal(3)]),
        transportInvocations: z.number().int().min(0).max(24),
        externalProviderCalls: z.number().int().min(0).max(24),
        deepseekCalls: z.number().int().min(0).max(12),
        qwenEmbeddingCalls: z.number().int().min(0).max(12),
        maximumConcurrency: z.literal(1),
        retry: z.literal(false),
        resume: z.literal(false),
        replay: z.literal(false),
        backfill: z.literal(false),
        backgroundJob: z.literal(false),
        outbox: z.literal(false),
        businessWrites: z.literal(0),
      })
      .strict(),
    caseCounts: z
      .object({
        guards: z.literal(8),
        rewritePairs: z.literal(6),
        finalResponseCases: z.literal(6),
        deepseekCalls: z.literal(12),
        qwenEmbeddingCalls: z.literal(12),
        providerCalls: z.literal(24),
      })
      .strict(),
    guards: z
      .object({
        passCount: z.number().int().min(0).max(8),
        zeroCallCount: z.number().int().min(0).max(8),
        safetyFailureCount: z.number().int().nonnegative(),
      })
      .strict(),
    providers: z
      .object({
        deepseek: PROVIDER_AGGREGATE_SCHEMA,
        qwen: PROVIDER_AGGREGATE_SCHEMA,
        aggregateVerifiedCostCny: z.number().nonnegative().finite().nullable(),
      })
      .strict(),
    rewrite: z
      .object({
        strictCount: z.number().int().min(0).max(6),
        originalRecallAt5: z.number().min(0).max(1).nullable(),
        originalNdcgAt5: z.number().min(0).max(1).nullable(),
        candidateRecallAt5: z.number().min(0).max(1).nullable(),
        candidateNdcgAt5: z.number().min(0).max(1).nullable(),
        candidateNdcgUplift: z.number().min(-1).max(1).nullable(),
        criticalTargetRecall: z.number().min(0).max(1).nullable(),
        intentPreservation: z.number().min(0).max(1).nullable(),
        unsafeRewriteCount: z.number().int().nonnegative(),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    finalResponse: z
      .object({
        strictCount: z.number().int().min(0).max(6),
        groundedRubric: z.number().min(0).max(1).nullable(),
        citationPrecision: z.number().min(0).max(1).nullable(),
        requiredCitationRecall: z.number().min(0).max(1).nullable(),
        criticalNoticeRecall: z.number().min(0).max(1).nullable(),
        noticeRecall: z.number().min(0).max(1).nullable(),
        falseToolSuccessCount: z.number().int().nonnegative(),
        falseCitationCount: z.number().int().nonnegative(),
      })
      .strict(),
    budget: z
      .object({
        inputTokens: z.number().int().positive().nullable(),
        outputTokens: z.number().int().nonnegative().nullable(),
        verifiedCostCny: z.number().nonnegative().finite().nullable(),
        inputTokensMax: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxInputTokens),
        outputTokensMax: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxOutputTokens,
        ),
        totalCostCnyMax: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxCostMicrosCny / 1_000_000,
        ),
      })
      .strict(),
    gate: GATE_SCHEMA,
    guardEntries: z.array(PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA).length(8),
    callEntries: z.array(PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA).length(24),
    rewriteEntries: z.array(PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA).length(6),
    finalResponseEntries: z.array(PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA).length(6),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr5LiveReport = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA
>;
export type Phase698RetrieverSchemaRecoverySr5LiveCallIdentity = Phase698Task9CallIdentity;
export type Phase698RetrieverSchemaRecoverySr5LiveCallEntry = Phase698Task9CallEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveGuardEntry = Phase698Task9GuardEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry = Phase698Task9RewriteEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveFinalEntry = Phase698Task9FinalEntry;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA = LIVE_SOURCE_SCHEMA;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES =
  PHASE_6_9_8_TASK9_WIRE_STAGES;
export type Phase698RetrieverSchemaRecoverySr5LiveWireStage =
  (typeof PHASE_6_9_8_TASK9_WIRE_STAGES)[number];

export type BuildPhase698RetrieverSchemaRecoverySr5LiveReportInput = Readonly<{
  runId: string;
  authority:
    | typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY
    | typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY;
  completionMode: 'runtime' | 'recovery';
  source: Phase698RetrieverSchemaRecoverySr5LiveSource;
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding;
  guardEntries: readonly Phase698Task9GuardEntry[];
  callEntries: readonly Phase698Task9CallEntry[];
  rewriteEntries: readonly Phase698Task9RewriteEntry[];
  finalResponseEntries: readonly Phase698Task9FinalEntry[];
}>;

export function buildPhase698RetrieverSchemaRecoverySr5LiveReport(
  input: BuildPhase698RetrieverSchemaRecoverySr5LiveReportInput,
): Phase698RetrieverSchemaRecoverySr5LiveReport {
  const source = LIVE_SOURCE_SCHEMA.parse(input.source);
  const sourceBinding = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA.parse(
    input.sourceBinding,
  );
  if (sourceBinding.sourceCommit !== source.head) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_INVALID');
  }
  const guardEntries = z
    .array(PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA)
    .length(8)
    .parse(input.guardEntries);
  const callEntries = z
    .array(PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA)
    .length(24)
    .parse(input.callEntries);
  const rewriteEntries = z
    .array(PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA)
    .length(6)
    .parse(input.rewriteEntries);
  const finalResponseEntries = z
    .array(PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA)
    .length(6)
    .parse(input.finalResponseEntries);
  assertEntryOrder(guardEntries, callEntries, rewriteEntries, finalResponseEntries);
  const live = input.authority === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY;
  const expectedTransportAuthority = live ? 'external_provider' : 'synthetic_injected';
  if (callEntries.some((entry) => entry.transportAuthority !== expectedTransportAuthority)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_TRANSPORT_AUTHORITY_INVALID');
  }

  const passCount = guardEntries.filter((entry) => entry.disposition === 'passed').length;
  const zeroCallCount = guardEntries.filter((entry) => entry.zeroCallVerified).length;
  const safetyFailureCount = guardEntries.filter(
    (entry) =>
      entry.permissionFailure ||
      entry.crossOwnerFailure ||
      entry.credentialFailure ||
      entry.injectionFailure,
  ).length;
  const providers = aggregateProviders(callEntries);
  const rewrite = aggregateRewrite(rewriteEntries);
  const finalResponse = aggregateFinal(finalResponseEntries);
  const complete = callEntries.every((entry) => entry.disposition === 'succeeded');
  const succeeded = callEntries.filter((entry) => entry.disposition === 'succeeded');
  const budget = {
    inputTokens: complete ? sum(succeeded.map((entry) => entry.usage!.inputTokens)) : null,
    outputTokens: complete ? sum(succeeded.map((entry) => entry.usage!.outputTokens)) : null,
    verifiedCostCny: complete
      ? roundCost(sum(succeeded.map((entry) => entry.verifiedCostCny!)))
      : null,
    inputTokensMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxInputTokens,
    outputTokensMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxOutputTokens,
    totalCostCnyMax: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxCostMicrosCny / 1_000_000,
  };
  const failures: string[] = [];
  if (input.completionMode !== 'runtime') failures.push('completion_mode');
  if (passCount !== 8 || zeroCallCount !== 8) failures.push('guard_count');
  if (safetyFailureCount !== 0) failures.push('guard_safety');
  if (!complete) failures.push('provider_denominator');
  if (rewrite.strictCount !== 6) failures.push('rewrite_strict');
  compareMinimum(
    failures,
    'rewrite_recall',
    rewrite.candidateRecallAt5,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.retrieverRecallAt5,
  );
  compareMinimum(
    failures,
    'rewrite_ndcg',
    rewrite.candidateNdcgAt5,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.retrieverNdcgAt5,
  );
  compareMinimum(
    failures,
    'rewrite_uplift',
    rewrite.candidateNdcgUplift,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.eligibleSubsetNdcgUplift,
  );
  compareExact(
    failures,
    'rewrite_critical_recall',
    rewrite.criticalTargetRecall,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.criticalTargetRecall,
  );
  compareMinimum(
    failures,
    'rewrite_intent',
    rewrite.intentPreservation,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.rewriteIntentPreservation,
  );
  if (rewrite.unsafeRewriteCount !== 0) {
    failures.push('rewrite_safety');
  }
  if (finalResponse.strictCount !== 6) failures.push('final_response_strict');
  if (finalResponse.falseToolSuccessCount !== 0 || finalResponse.falseCitationCount !== 0) {
    failures.push('final_response_quality');
  }
  compareMinimum(
    failures,
    'final_grounding',
    finalResponse.groundedRubric,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.finalResponseGroundedRubric,
  );
  compareExact(
    failures,
    'citation_precision',
    finalResponse.citationPrecision,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.citationPrecision,
  );
  compareMinimum(
    failures,
    'citation_recall',
    finalResponse.requiredCitationRecall,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.requiredCitationRecall,
  );
  compareExact(
    failures,
    'critical_notice',
    finalResponse.criticalNoticeRecall,
    PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds.criticalNoticeRecall,
  );
  if (
    budget.inputTokens === null ||
    budget.outputTokens === null ||
    budget.verifiedCostCny === null ||
    budget.inputTokens > budget.inputTokensMax ||
    budget.outputTokens > budget.outputTokensMax ||
    budget.verifiedCostCny > budget.totalCostCnyMax
  ) {
    failures.push('budget_accounting');
  }
  if (!live) failures.push('synthetic_authority');
  const passed = live && failures.length === 0;
  const qualityAuthority = passed
    ? PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QUALITY_AUTHORITY
    : ('none' as const);

  return deepFreeze(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA.parse({
      version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_VERSION,
      lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
      runId: input.runId,
      authority: input.authority,
      qualityAuthority,
      completionMode: input.completionMode,
      source,
      sourceBinding,
      manifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_POLICY_SHA256,
      execution: {
        mode: live ? 'live' : 'reviewed_mock',
        sourceAdmissionExecuted: live,
        credentialReads: live ? 3 : 0,
        transportInvocations: sum(callEntries.map((entry) => entry.wire.attempts)),
        externalProviderCalls: live ? sum(callEntries.map((entry) => entry.wire.dispatches)) : 0,
        deepseekCalls: sum(
          live
            ? callEntries
                .filter((entry) => entry.provider === 'deepseek')
                .map((entry) => entry.wire.dispatches)
            : [],
        ),
        qwenEmbeddingCalls: sum(
          live
            ? callEntries
                .filter((entry) => entry.provider === 'qwen')
                .map((entry) => entry.wire.dispatches)
            : [],
        ),
        maximumConcurrency: 1,
        retry: false,
        resume: false,
        replay: false,
        backfill: false,
        backgroundJob: false,
        outbox: false,
        businessWrites: 0,
      },
      caseCounts: {
        guards: 8,
        rewritePairs: 6,
        finalResponseCases: 6,
        deepseekCalls: 12,
        qwenEmbeddingCalls: 12,
        providerCalls: 24,
      },
      guards: { passCount, zeroCallCount, safetyFailureCount },
      providers,
      rewrite,
      finalResponse,
      budget,
      gate: {
        status: passed
          ? 'schema_recovery_sr5_branch_semantic_gate_passed'
          : 'schema_recovery_sr5_branch_quality_gate_failed',
        passed,
        qualityAuthority,
        failureReasons: failures,
      },
      guardEntries,
      callEntries,
      rewriteEntries,
      finalResponseEntries,
    }),
  );
}

export function parsePhase698RetrieverSchemaRecoverySr5LiveReport(
  value: unknown,
): Phase698RetrieverSchemaRecoverySr5LiveReport | null {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA.safeParse(value);
  if (!parsed.success) return null;
  try {
    const rebuilt = buildPhase698RetrieverSchemaRecoverySr5LiveReport({
      runId: parsed.data.runId,
      authority: parsed.data.authority,
      completionMode: parsed.data.completionMode,
      source: parsed.data.source,
      sourceBinding: parsed.data.sourceBinding,
      guardEntries: parsed.data.guardEntries,
      callEntries: parsed.data.callEntries,
      rewriteEntries: parsed.data.rewriteEntries,
      finalResponseEntries: parsed.data.finalResponseEntries,
    });
    return canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(rebuilt) ===
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(parsed.data)
      ? rebuilt
      : null;
  } catch {
    return null;
  }
}

export function expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule(): readonly Phase698Task9CallIdentity[] {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MANIFEST.callSchedule;
}

export function canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(value: unknown): string {
  return canonicalPhase698Task9Json(value);
}

export function sha256Phase698RetrieverSchemaRecoverySr5Live(value: string | Uint8Array): string {
  return sha256(value);
}

function aggregateProviders(entries: readonly Phase698Task9CallEntry[]) {
  const aggregate = (provider: 'deepseek' | 'qwen', expectedCalls: 12) => {
    const selected = entries.filter((entry) => entry.provider === provider);
    const complete =
      selected.length === expectedCalls &&
      selected.every((entry) => entry.disposition === 'succeeded');
    return {
      expectedCalls,
      attempts: sum(selected.map((entry) => entry.wire.attempts)),
      dispatches: sum(selected.map((entry) => entry.wire.dispatches)),
      responses: sum(selected.map((entry) => entry.wire.responses)),
      verifiedUsage: sum(selected.map((entry) => entry.wire.verifiedUsage)),
      inputTokens: complete ? sum(selected.map((entry) => entry.usage!.inputTokens)) : null,
      outputTokens: complete ? sum(selected.map((entry) => entry.usage!.outputTokens)) : null,
      verifiedCostCny: complete
        ? roundCost(sum(selected.map((entry) => entry.verifiedCostCny!)))
        : null,
    };
  };
  const deepseek = aggregate('deepseek', 12);
  const qwen = aggregate('qwen', 12);
  return {
    deepseek,
    qwen,
    aggregateVerifiedCostCny:
      deepseek.verifiedCostCny === null || qwen.verifiedCostCny === null
        ? null
        : roundCost(deepseek.verifiedCostCny + qwen.verifiedCostCny),
  };
}

function aggregateRewrite(entries: readonly Phase698Task9RewriteEntry[]) {
  const complete = entries.length === 6 && entries.every((entry) => entry.strict);
  const average = (values: readonly number[]) =>
    values.length === 0 ? null : Number((sum(values) / values.length).toFixed(12));
  const originalRecallAt5 = complete
    ? average(entries.map((entry) => entry.originalRecallAt5!))
    : null;
  const originalNdcgAt5 = complete ? average(entries.map((entry) => entry.originalNdcgAt5!)) : null;
  const candidateRecallAt5 = complete
    ? average(entries.map((entry) => entry.candidateRecallAt5!))
    : null;
  const candidateNdcgAt5 = complete
    ? average(entries.map((entry) => entry.candidateNdcgAt5!))
    : null;
  const critical = entries.filter((entry) => entry.critical);
  return {
    strictCount: entries.filter((entry) => entry.strict).length,
    originalRecallAt5,
    originalNdcgAt5,
    candidateRecallAt5,
    candidateNdcgAt5,
    candidateNdcgUplift:
      originalNdcgAt5 === null || candidateNdcgAt5 === null
        ? null
        : Number((candidateNdcgAt5 - originalNdcgAt5).toFixed(12)),
    criticalTargetRecall:
      complete && critical.length > 0
        ? average(critical.map((entry) => entry.candidateRecallAt5!))
        : complete
          ? 1
          : null,
    intentPreservation: complete
      ? average(entries.map((entry) => (entry.intentPreserved ? 1 : 0)))
      : null,
    unsafeRewriteCount: entries.filter((entry) => entry.unsafeRewrite === true).length,
    rawDataRetained: false as const,
  };
}

function aggregateFinal(entries: readonly Phase698Task9FinalEntry[]) {
  const complete = entries.length === 6 && entries.every((entry) => entry.strict);
  if (!complete) {
    return {
      strictCount: entries.filter((entry) => entry.strict).length,
      groundedRubric: null,
      citationPrecision: null,
      requiredCitationRecall: null,
      criticalNoticeRecall: null,
      noticeRecall: null,
      falseToolSuccessCount: entries.filter((entry) => entry.falseToolSuccess === true).length,
      falseCitationCount: entries.filter((entry) => entry.falseCitation === true).length,
    };
  }
  const required = sum(entries.map((entry) => entry.requiredCitationCount!));
  const observed = sum(entries.map((entry) => entry.observedCitationCount!));
  const truePositive = sum(entries.map((entry) => entry.citationTruePositiveCount!));
  const critical = entries.filter(
    (entry) => entry.evidenceStatus === 'conflict' || entry.evidenceStatus === 'insufficient',
  );
  return {
    strictCount: 6,
    groundedRubric: averageBoolean(entries.map((entry) => entry.grounded!)),
    citationPrecision: observed === 0 ? 1 : Number((truePositive / observed).toFixed(12)),
    requiredCitationRecall: required === 0 ? 1 : Number((truePositive / required).toFixed(12)),
    criticalNoticeRecall:
      critical.length === 0 ? 1 : averageBoolean(critical.map((entry) => entry.noticeSatisfied!)),
    noticeRecall: averageBoolean(entries.map((entry) => entry.noticeSatisfied!)),
    falseToolSuccessCount: entries.filter((entry) => entry.falseToolSuccess).length,
    falseCitationCount: entries.filter((entry) => entry.falseCitation).length,
  };
}

function assertEntryOrder(
  guards: readonly Phase698Task9GuardEntry[],
  calls: readonly Phase698Task9CallEntry[],
  rewrites: readonly Phase698Task9RewriteEntry[],
  finals: readonly Phase698Task9FinalEntry[],
) {
  const expectedGuards = guardCases.map((entry) => entry.caseId);
  const expectedCalls = callSchedule.map((entry) => entry.callId);
  const expectedRewrites = rewriteCases.map((entry) => entry.caseId);
  const expectedFinals = finalResponseCases.map((entry) => entry.caseId);
  if (
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(guards.map((entry) => entry.caseId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expectedGuards) ||
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(calls.map((entry) => entry.callId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expectedCalls) ||
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(rewrites.map((entry) => entry.caseId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expectedRewrites) ||
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(finals.map((entry) => entry.caseId)) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expectedFinals)
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ENTRY_ORDER_INVALID');
  }
}

function averageBoolean(values: readonly boolean[]) {
  return Number((values.filter(Boolean).length / values.length).toFixed(12));
}

function compareMinimum(failures: string[], reason: string, value: number | null, minimum: number) {
  if (value === null || value < minimum) failures.push(reason);
}

function compareExact(failures: string[], reason: string, value: number | null, expected: number) {
  if (value === null || value !== expected) failures.push(reason);
}

function roundCost(value: number) {
  return Number(value.toFixed(9));
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
