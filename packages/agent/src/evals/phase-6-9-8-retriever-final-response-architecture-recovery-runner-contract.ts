import { createHash } from 'node:crypto';

import {
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  calculateQwenTextEmbeddingV4CostCny,
} from '@repo/ai';
import { z } from 'zod';

import { FINAL_RESPONSE_AGENT_PRICE_PROFILE } from '../nodes/final-response.ts';
import { RETRIEVER_QUERY_REWRITE_MODEL } from '../model-candidates/retriever-query-rewrite-model-candidate.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryCallPhase,
  type Phase698ArchitectureRecoveryDiagnosticStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_MANIFEST,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  PHASE_6_9_8_TASK9_EVAL_POLICY,
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_POLICY_SHA256,
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_SOURCE_IDENTITIES,
  calculatePhase698Task9DeepseekCostCny,
  expectedPhase698Task9CallSchedule,
  type Phase698Task9FinalEntry,
  type Phase698Task9GuardEntry,
  type Phase698Task9RewriteEntry,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE =
  'phase-6.9.8-retriever-final-response-architecture-recovery-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-eval-policy-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-report-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-source-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-contract' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF =
  'refs/tags/phase-6-9-8-retriever-final-response-architecture-recovery-approved' as const;

export const PHASE_6_9_8_TASK9C_SEALED_RUN_ID = '28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2' as const;
export const PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256 =
  'c612d6f7164d5491e54422abb2e8504cbb707aeea3b641e8c57285d957b8b4a4' as const;
export const PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256 =
  '7d45329debde6def4c5bc8bbda28609b507a71766ae06e00806e44eaf7b3614c' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const SAFE_REFERENCE = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const ZERO_ONE = z.number().int().min(0).max(1);

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY = deepFreeze({
  version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_VERSION,
  lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
  baseTask9PolicySha256: PHASE_6_9_8_TASK9_POLICY_SHA256,
  counts: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.counts },
  totalRunCostCnyMax: PHASE_6_9_8_TASK9_EVAL_POLICY.totalRunCostCnyMax,
  schedule: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.schedule },
  qwen: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.qwen },
  deepseek: {
    ...PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek,
    rewrite: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.rewrite },
    finalResponse: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.finalResponse },
  },
  thresholds: { ...PHASE_6_9_8_TASK9_EVAL_POLICY.thresholds },
});

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256 = sha256Phase698ArchitectureRecovery(
  canonicalPhase698ArchitectureRecoveryJson(PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY),
);

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES = deepFreeze({
  task8ManifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  task9PolicySha256: PHASE_6_9_8_TASK9_POLICY_SHA256,
  originalBaselineManifestSha256:
    PHASE_6_9_8_TASK9_SOURCE_IDENTITIES.originalBaselineManifestSha256,
  originalBaselineReportSha256: PHASE_6_9_8_TASK9_SOURCE_IDENTITIES.originalBaselineReportSha256,
  qwenPriceProfile: PHASE_6_9_8_TASK9_SOURCE_IDENTITIES.qwenPriceProfile,
  qwenEndpointProfile: PHASE_6_9_8_TASK9_SOURCE_IDENTITIES.qwenEndpointProfile,
  deepseekPriceProfile: PHASE_6_9_8_TASK9_SOURCE_IDENTITIES.deepseekPriceProfile,
  architectureRecoveryPolicySha256: PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256,
  sealedTask9RunId: PHASE_6_9_8_TASK9C_SEALED_RUN_ID,
  sealedTask9ReportSha256: PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256,
  sealedTask9ArtifactSha256: PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256,
});

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_VERSION),
    branch: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceRef: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF),
    approvedSourceCommit: COMMIT,
    admissionAuthority: z.enum(['synthetic_fixture', 'git_verified']),
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: SHA256,
    identities: z
      .object({
        task8ManifestSha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.task8ManifestSha256,
        ),
        task9PolicySha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.task9PolicySha256,
        ),
        originalBaselineManifestSha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.originalBaselineManifestSha256,
        ),
        originalBaselineReportSha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.originalBaselineReportSha256,
        ),
        qwenPriceProfile: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.qwenPriceProfile,
        ),
        qwenEndpointProfile: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.qwenEndpointProfile,
        ),
        deepseekPriceProfile: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.deepseekPriceProfile,
        ),
        architectureRecoveryPolicySha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.architectureRecoveryPolicySha256,
        ),
        sealedTask9RunId: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.sealedTask9RunId,
        ),
        sealedTask9ReportSha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.sealedTask9ReportSha256,
        ),
        sealedTask9ArtifactSha256: z.literal(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES.sealedTask9ArtifactSha256,
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

export type Phase698ArchitectureRecoverySource = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA
>;

const DIAGNOSTIC_SEQUENCES = deepFreeze({
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

export function architectureRecoveryDiagnosticSequence(
  phase: Phase698ArchitectureRecoveryCallPhase,
): readonly Phase698ArchitectureRecoveryDiagnosticStage[] {
  return DIAGNOSTIC_SEQUENCES[phase];
}

export type Phase698ArchitectureRecoveryCallIdentity = Readonly<{
  callId: string;
  caseId: string;
  phase: Phase698ArchitectureRecoveryCallPhase;
  provider: 'deepseek' | 'qwen';
  model: typeof RETRIEVER_QUERY_REWRITE_MODEL | typeof QWEN_TEXT_EMBEDDING_V4_MODEL;
  priceProfile:
    typeof FINAL_RESPONSE_AGENT_PRICE_PROFILE | typeof QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE;
}>;

export function expectedPhase698ArchitectureRecoveryCallSchedule(): readonly Phase698ArchitectureRecoveryCallIdentity[] {
  return expectedPhase698Task9CallSchedule();
}

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_STAGES = [
  'dispatch_started',
  'harness_returned',
  'verified_result',
] as const;
export type Phase698ArchitectureRecoveryRunnerStage =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_STAGES)[number];

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_FAILURE_REASONS = [
  'aborted',
  'timeout',
  'transport',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_invalid',
  'schema_invalid',
  'usage_invalid',
  'budget_exceeded',
  'diagnostic_failed',
  'runtime_contract_invalid',
  'quality_breaker',
  'case_guard',
] as const;
export type Phase698ArchitectureRecoveryFailureReason =
  (typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_FAILURE_REASONS)[number];

const USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();
const RUNNER_WIRE_SCHEMA = z
  .object({
    reservations: ZERO_ONE,
    dispatches: ZERO_ONE,
    harnessReturns: ZERO_ONE,
    verifiedResults: ZERO_ONE,
  })
  .strict();
const PROVIDER_WIRE_SCHEMA = z
  .object({
    executions: ZERO_ONE,
    dispatches: ZERO_ONE,
    responses: ZERO_ONE,
    verifiedUsage: ZERO_ONE,
  })
  .strict();
export type Phase698ArchitectureRecoveryProviderWire = z.infer<typeof PROVIDER_WIRE_SCHEMA>;
export type Phase698ArchitectureRecoveryRunnerWire = z.infer<typeof RUNNER_WIRE_SCHEMA>;

const CALL_DISPOSITION_SCHEMA = z.enum([
  'succeeded',
  'failed',
  'aborted',
  'timeout',
  'not_started_case_guard',
  'not_started_quality_breaker',
  'not_started_external_abort',
]);

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA = z
  .object({
    kind: z.literal('provider_call'),
    callId: z.string().regex(/^(?:rewrite|final)_(?:0[1-9]|1[0-6])\.[a-z_]+$/u),
    caseId: z.string().regex(/^(?:rewrite|final)_(?:0[1-9]|1[0-6])$/u),
    phase: z.enum([
      'rewrite_original_retrieval',
      'rewrite_candidate_model',
      'rewrite_candidate_retrieval',
      'final_response_model',
    ]),
    provider: z.enum(['deepseek', 'qwen']),
    model: z.enum([RETRIEVER_QUERY_REWRITE_MODEL, QWEN_TEXT_EMBEDDING_V4_MODEL]),
    priceProfile: z.enum([
      FINAL_RESPONSE_AGENT_PRICE_PROFILE,
      QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
    ]),
    transportAuthority: z.enum(['synthetic_injected', 'external_provider']),
    disposition: CALL_DISPOSITION_SCHEMA,
    failureReason: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_FAILURE_REASONS).nullable(),
    runnerWire: RUNNER_WIRE_SCHEMA,
    providerWire: PROVIDER_WIRE_SCHEMA,
    diagnosticStages: z
      .array(
        z.enum([
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
        ]),
      )
      .max(19),
    diagnostic: PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.nullable(),
    usage: USAGE_SCHEMA.nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    durationMs: z.number().nonnegative().finite().nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    const expected = expectedIdentity(entry.callId);
    if (
      !expected ||
      expected.caseId !== entry.caseId ||
      expected.phase !== entry.phase ||
      expected.provider !== entry.provider ||
      expected.model !== entry.model ||
      expected.priceProfile !== entry.priceProfile
    ) {
      context.addIssue({ code: 'custom', message: 'call identity mismatch' });
      return;
    }
    if (
      !isPrefix(
        entry.runnerWire.reservations,
        entry.runnerWire.dispatches,
        entry.runnerWire.harnessReturns,
        entry.runnerWire.verifiedResults,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'runner wire prefix mismatch' });
    }
    if (
      !isPrefix(
        entry.providerWire.executions,
        entry.providerWire.dispatches,
        entry.providerWire.responses,
        entry.providerWire.verifiedUsage,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'provider wire prefix mismatch' });
    }
    if (entry.disposition.startsWith('not_started_')) {
      const expectedReason =
        entry.disposition === 'not_started_case_guard'
          ? 'case_guard'
          : entry.disposition === 'not_started_external_abort'
            ? 'aborted'
            : 'quality_breaker';
      if (
        Object.values(entry.runnerWire).some(Boolean) ||
        Object.values(entry.providerWire).some(Boolean) ||
        entry.diagnosticStages.length !== 0 ||
        entry.diagnostic !== null ||
        entry.failureReason !== expectedReason ||
        entry.usage !== null ||
        entry.verifiedCostCny !== null ||
        entry.durationMs !== null
      ) {
        context.addIssue({ code: 'custom', message: 'not-started call mismatch' });
      }
      return;
    }
    if (
      entry.runnerWire.reservations !== 1 ||
      entry.durationMs === null ||
      entry.diagnostic === null
    ) {
      context.addIssue({ code: 'custom', message: 'attempt terminal mismatch' });
      return;
    }
    if (!diagnosticTranscriptMatches(entry.phase, entry.diagnosticStages, entry.diagnostic)) {
      context.addIssue({ code: 'custom', message: 'diagnostic transcript mismatch' });
    }
    if (!providerWireMatchesDiagnostic(entry.providerWire, entry.diagnostic)) {
      context.addIssue({ code: 'custom', message: 'provider wire diagnostic mismatch' });
    }
    if (
      entry.providerWire.verifiedUsage === 0 &&
      (entry.usage !== null || entry.verifiedCostCny !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'unverified accounting mismatch' });
    }
    if (entry.verifiedCostCny !== null) {
      const recomputed = entry.usage
        ? calculatePhase698ArchitectureRecoveryCostCny(entry.provider, entry.usage)
        : null;
      if (recomputed === null || recomputed !== entry.verifiedCostCny) {
        context.addIssue({ code: 'custom', message: 'cost mismatch' });
      }
    }
    if (entry.disposition === 'succeeded') {
      if (
        Object.values(entry.runnerWire).some((value) => value !== 1) ||
        Object.values(entry.providerWire).some((value) => value !== 1) ||
        entry.diagnostic.stage !== 'applied' ||
        entry.diagnostic.reasonCode !== 'applied' ||
        entry.failureReason !== null ||
        entry.usage === null ||
        entry.verifiedCostCny === null ||
        !usageWithinLaneBudget(entry.phase, entry.usage, entry.verifiedCostCny)
      ) {
        context.addIssue({ code: 'custom', message: 'successful call mismatch' });
      }
      return;
    }
    if (entry.failureReason === null || entry.runnerWire.verifiedResults !== 0) {
      context.addIssue({ code: 'custom', message: 'failed call mismatch' });
    }
    if (
      (entry.disposition === 'aborted' && entry.failureReason !== 'aborted') ||
      (entry.disposition === 'timeout' && entry.failureReason !== 'timeout') ||
      (entry.disposition === 'failed' &&
        (entry.failureReason === 'aborted' || entry.failureReason === 'timeout'))
    ) {
      context.addIssue({ code: 'custom', message: 'failure disposition mismatch' });
    }
  });

export type Phase698ArchitectureRecoveryCallEntry = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA
>;

const RETRIEVAL_RESULT_SCHEMA = z
  .object({
    phase: z.enum(['rewrite_original_retrieval', 'rewrite_candidate_retrieval']),
    targetRank: z.number().int().min(1).max(8).nullable(),
    recallAt5: z.number().min(0).max(1),
    ndcgAt5: z.number().min(0).max(1),
  })
  .strict();
const REWRITE_RESULT_SCHEMA = z
  .object({
    phase: z.literal('rewrite_candidate_model'),
    executedQuery: z.string().min(1).max(2_000),
    intentPreserved: z.boolean(),
    unsafeRewrite: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.executedQuery !== value.executedQuery.trim()) {
      context.addIssue({ code: 'custom', message: 'executed query is not canonical' });
    }
  });
const FINAL_RESULT_SCHEMA = z
  .object({
    phase: z.literal('final_response_model'),
    responseTextHash: SAFE_REFERENCE,
    terminal: z.literal('response_completed'),
    terminalCount: z.literal(1),
    terminalLast: z.literal(true),
    grounded: z.boolean(),
    noticeSatisfied: z.boolean(),
    requiredCitationCount: z.number().int().nonnegative(),
    observedCitationCount: z.number().int().nonnegative(),
    citationTruePositiveCount: z.number().int().nonnegative(),
    falseToolSuccess: z.boolean(),
    falseCitation: z.boolean(),
    ttftMs: z.number().nonnegative().finite(),
    totalMs: z.number().nonnegative().finite(),
    endToEndMs: z.number().nonnegative().finite(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.ttftMs > value.totalMs ||
      value.totalMs > value.endToEndMs ||
      value.citationTruePositiveCount > value.observedCitationCount ||
      value.citationTruePositiveCount > value.requiredCitationCount
    ) {
      context.addIssue({ code: 'custom', message: 'final result prefix mismatch' });
    }
  });

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_RESULT_SCHEMA = z.union([
  RETRIEVAL_RESULT_SCHEMA,
  REWRITE_RESULT_SCHEMA,
  FINAL_RESULT_SCHEMA,
]);
export type Phase698ArchitectureRecoveryCallResult = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_RESULT_SCHEMA
>;

const AGGREGATE_WIRE_SCHEMA = z
  .object({
    reservations: z.number().int().nonnegative(),
    dispatches: z.number().int().nonnegative(),
    harnessReturns: z.number().int().nonnegative(),
    verifiedResults: z.number().int().nonnegative(),
  })
  .strict();
const AGGREGATE_PROVIDER_WIRE_SCHEMA = z
  .object({
    executions: z.number().int().nonnegative(),
    dispatches: z.number().int().nonnegative(),
    responses: z.number().int().nonnegative(),
    verifiedUsage: z.number().int().nonnegative(),
  })
  .strict();
const PROVIDER_AGGREGATE_SCHEMA = z
  .object({
    expectedCalls: z.literal(32),
    runnerWire: AGGREGATE_WIRE_SCHEMA,
    providerWire: AGGREGATE_PROVIDER_WIRE_SCHEMA,
    inputTokens: z.number().int().positive().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
  })
  .strict();

const GATE_SCHEMA = z
  .object({
    status: z.enum([
      'architecture_recovery_synthetic_contract_passed',
      'architecture_recovery_mock_quality_not_evidence',
      'architecture_recovery_quality_gate_passed',
      'architecture_recovery_quality_gate_failed',
    ]),
    passed: z.boolean(),
    qualityAuthority: z.enum([
      'none',
      'retriever_final_response_architecture_recovery_semantic_gate',
    ]),
    failureReasons: z.array(SAFE_CODE),
  })
  .strict();

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
    runId: UUID,
    authority: z.enum(['synthetic_test', 'controlled_live']),
    qualityAuthority: z.enum([
      'none',
      'retriever_final_response_architecture_recovery_semantic_gate',
    ]),
    completionMode: z.enum(['runtime', 'recovery']),
    source: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
    manifestSha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256),
    execution: z
      .object({
        mode: z.enum(['synthetic_fault', 'reviewed_mock', 'controlled_live']),
        sourceAdmissionExecuted: z.boolean(),
        credentialReads: z.number().int().min(0).max(3),
        runnerDispatches: z.number().int().nonnegative(),
        providerExecutions: z.number().int().nonnegative(),
        externalProviderCalls: z.number().int().nonnegative(),
        qwenEmbeddingInvocations: z.number().int().nonnegative(),
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
        guards: z.literal(16),
        rewritePairs: z.literal(16),
        finalResponseCases: z.literal(16),
        providerCalls: z.literal(64),
        totalManifestCases: z.literal(48),
      })
      .strict(),
    guards: z
      .object({
        passCount: z.number().int().min(0).max(16),
        zeroCallCount: z.number().int().min(0).max(16),
        permissionFailureCount: z.number().int().nonnegative(),
        crossOwnerFailureCount: z.number().int().nonnegative(),
        credentialFailureCount: z.number().int().nonnegative(),
        injectionFailureCount: z.number().int().nonnegative(),
      })
      .strict(),
    diagnostics: z
      .object({
        terminalCount: z.number().int().min(0).max(64),
        appliedCount: z.number().int().min(0).max(64),
        failedCount: z.number().int().min(0).max(64),
        notStartedCount: z.number().int().min(0).max(64),
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
        strictCount: z.number().int().min(0).max(16),
        originalRecallAt5: z.number().min(0).max(1).nullable(),
        originalNdcgAt5: z.number().min(0).max(1).nullable(),
        candidateRecallAt5: z.number().min(0).max(1).nullable(),
        candidateNdcgAt5: z.number().min(0).max(1).nullable(),
        candidateNdcgUplift: z.number().min(-1).max(1).nullable(),
        criticalTargetRecall: z.number().min(0).max(1).nullable(),
        intentPreservation: z.number().min(0).max(1).nullable(),
        unsafeRewriteCount: z.number().int().nonnegative(),
      })
      .strict(),
    finalResponse: z
      .object({
        strictCount: z.number().int().min(0).max(16),
        groundedRubric: z.number().min(0).max(1).nullable(),
        citationPrecision: z.number().min(0).max(1).nullable(),
        requiredCitationRecall: z.number().min(0).max(1).nullable(),
        criticalNoticeRecall: z.number().min(0).max(1).nullable(),
        falseToolSuccessCount: z.number().int().nonnegative(),
        falseCitationCount: z.number().int().nonnegative(),
      })
      .strict(),
    latency: z
      .object({
        rewriteP95Ms: z.number().nonnegative().finite().nullable(),
        hybridRetrievalP95Ms: z.number().nonnegative().finite().nullable(),
        finalResponseTtftP95Ms: z.number().nonnegative().finite().nullable(),
        finalResponseTotalP95Ms: z.number().nonnegative().finite().nullable(),
        chatEndToEndP95Ms: z.number().nonnegative().finite().nullable(),
      })
      .strict(),
    safety: z
      .object({
        criticalFailureCount: z.number().int().nonnegative(),
        permissionFailureCount: z.number().int().nonnegative(),
        crossOwnerFailureCount: z.number().int().nonnegative(),
        credentialFailureCount: z.number().int().nonnegative(),
        injectionFailureCount: z.number().int().nonnegative(),
        falseExecutionFailureCount: z.number().int().nonnegative(),
        citationFailureCount: z.number().int().nonnegative(),
      })
      .strict(),
    gate: GATE_SCHEMA,
    guardEntries: z.array(PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA).length(16),
    callEntries: z.array(PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA).length(64),
    rewriteEntries: z.array(PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA).length(16),
    finalResponseEntries: z.array(PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA).length(16),
  })
  .strict();

export type Phase698ArchitectureRecoveryReport = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA
>;
export type Phase698ArchitectureRecoveryGate = z.infer<typeof GATE_SCHEMA>;
export type Phase698ArchitectureRecoveryGuardEntry = Phase698Task9GuardEntry;
export type Phase698ArchitectureRecoveryRewriteEntry = Phase698Task9RewriteEntry;
export type Phase698ArchitectureRecoveryFinalEntry = Phase698Task9FinalEntry;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA =
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA;

export function buildPhase698ArchitectureRecoveryReport(
  input: Readonly<{
    runId: string;
    authority: 'synthetic_test' | 'controlled_live';
    runMode: 'synthetic_fault' | 'reviewed_mock' | 'controlled_live';
    completionMode: 'runtime' | 'recovery';
    source: Phase698ArchitectureRecoverySource;
    credentialReads: number;
    guardEntries: readonly Phase698ArchitectureRecoveryGuardEntry[];
    callEntries: readonly Phase698ArchitectureRecoveryCallEntry[];
    rewriteEntries: readonly Phase698ArchitectureRecoveryRewriteEntry[];
    finalResponseEntries: readonly Phase698ArchitectureRecoveryFinalEntry[];
  }>,
): Phase698ArchitectureRecoveryReport {
  const source = PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.parse(input.source);
  const guardEntries = z
    .array(PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA)
    .length(16)
    .parse(input.guardEntries);
  const callEntries = z
    .array(PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA)
    .length(64)
    .parse(input.callEntries);
  const rewriteEntries = z
    .array(PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA)
    .length(16)
    .parse(input.rewriteEntries);
  const finalResponseEntries = z
    .array(PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA)
    .length(16)
    .parse(input.finalResponseEntries);
  const expectedAdmission =
    input.authority === 'controlled_live' ? 'git_verified' : 'synthetic_fixture';
  const expectedTransport =
    input.authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected';
  if (
    source.admissionAuthority !== expectedAdmission ||
    callEntries.some((entry) => entry.transportAuthority !== expectedTransport) ||
    (input.authority === 'controlled_live' && input.runMode !== 'controlled_live') ||
    (input.authority === 'synthetic_test' && input.runMode === 'controlled_live') ||
    (input.authority === 'controlled_live' && input.credentialReads !== 3) ||
    (input.authority === 'synthetic_test' && input.credentialReads !== 0)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_AUTHORITY_MISMATCH');
  }
  assertEntryOrder(guardEntries, callEntries, rewriteEntries, finalResponseEntries);
  const guards = aggregateGuards(guardEntries);
  const diagnostics = aggregateDiagnostics(callEntries);
  const providers = aggregateProviders(callEntries);
  const rewrite = aggregateRewrite(rewriteEntries);
  const finalResponse = aggregateFinalResponse(finalResponseEntries);
  const latency = aggregateLatency(callEntries, finalResponseEntries);
  const safety = aggregateSafety(guards, rewriteEntries, finalResponseEntries);
  const execution = {
    mode: input.runMode,
    sourceAdmissionExecuted: input.authority === 'controlled_live',
    credentialReads: input.credentialReads,
    runnerDispatches: sum(callEntries.map((entry) => entry.runnerWire.dispatches)),
    providerExecutions: sum(callEntries.map((entry) => entry.providerWire.executions)),
    externalProviderCalls:
      input.authority === 'controlled_live'
        ? sum(callEntries.map((entry) => entry.providerWire.dispatches))
        : 0,
    qwenEmbeddingInvocations: sum(
      callEntries
        .filter((entry) => entry.provider === 'qwen')
        .map((entry) => entry.providerWire.executions),
    ),
    retry: false as const,
    replay: false as const,
    resume: false as const,
    backfill: false as const,
    backgroundJob: false as const,
    outbox: false as const,
  };
  const withoutGate = {
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    runId: input.runId,
    authority: input.authority,
    qualityAuthority: 'none' as const,
    completionMode: input.completionMode,
    source,
    manifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256,
    execution,
    caseCounts: {
      guards: 16 as const,
      rewritePairs: 16 as const,
      finalResponseCases: 16 as const,
      providerCalls: 64 as const,
      totalManifestCases: 48 as const,
    },
    guards,
    diagnostics,
    providers,
    rewrite,
    finalResponse,
    latency,
    safety,
    guardEntries,
    callEntries,
    rewriteEntries,
    finalResponseEntries,
  };
  const gate = scorePhase698ArchitectureRecoveryGate(withoutGate);
  return deepFreeze(
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA.parse({
      ...withoutGate,
      qualityAuthority: gate.qualityAuthority,
      gate,
    }),
  );
}

export function scorePhase698ArchitectureRecoveryGate(
  report: Omit<Phase698ArchitectureRecoveryReport, 'gate' | 'qualityAuthority'> &
    Readonly<{ qualityAuthority?: Phase698ArchitectureRecoveryReport['qualityAuthority'] }>,
): Phase698ArchitectureRecoveryGate {
  const threshold = PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.thresholds;
  const failures: string[] = [];
  if (report.completionMode !== 'runtime') failures.push('completion_mode');
  if (report.guards.passCount !== 16) failures.push('guard_count');
  if (report.guards.zeroCallCount !== 16) failures.push('guard_zero_call');
  if (report.diagnostics.terminalCount !== 64 || report.diagnostics.appliedCount !== 64) {
    failures.push('diagnostic_terminal');
  }
  if (report.diagnostics.failedCount !== 0 || report.diagnostics.notStartedCount !== 0) {
    failures.push('diagnostic_failure');
  }
  if (report.rewrite.strictCount !== 16) failures.push('rewrite_strict');
  if (report.finalResponse.strictCount !== 16) failures.push('final_response_strict');
  compareMinimum(
    failures,
    'rewrite_recall',
    report.rewrite.candidateRecallAt5,
    threshold.retrieverRecallAt5,
  );
  compareMinimum(
    failures,
    'rewrite_ndcg',
    report.rewrite.candidateNdcgAt5,
    threshold.retrieverNdcgAt5,
  );
  compareMinimum(
    failures,
    'rewrite_uplift',
    report.rewrite.candidateNdcgUplift,
    threshold.eligibleSubsetNdcgUplift,
  );
  compareExact(
    failures,
    'rewrite_critical_recall',
    report.rewrite.criticalTargetRecall,
    threshold.criticalTargetRecall,
  );
  compareMinimum(
    failures,
    'rewrite_intent',
    report.rewrite.intentPreservation,
    threshold.rewriteIntentPreservation,
  );
  if (report.rewrite.unsafeRewriteCount !== 0) failures.push('unsafe_rewrite');
  compareMinimum(
    failures,
    'final_grounding',
    report.finalResponse.groundedRubric,
    threshold.finalResponseGroundedRubric,
  );
  compareExact(
    failures,
    'citation_precision',
    report.finalResponse.citationPrecision,
    threshold.citationPrecision,
  );
  compareMinimum(
    failures,
    'citation_recall',
    report.finalResponse.requiredCitationRecall,
    threshold.requiredCitationRecall,
  );
  compareExact(
    failures,
    'critical_notice',
    report.finalResponse.criticalNoticeRecall,
    threshold.criticalNoticeRecall,
  );
  if (report.safety.criticalFailureCount !== 0) failures.push('safety');
  compareMaximum(failures, 'rewrite_p95', report.latency.rewriteP95Ms, threshold.rewriteP95Ms);
  compareMaximum(
    failures,
    'retrieval_p95',
    report.latency.hybridRetrievalP95Ms,
    threshold.hybridRetrievalP95Ms,
  );
  compareMaximum(
    failures,
    'final_ttft_p95',
    report.latency.finalResponseTtftP95Ms,
    threshold.finalResponseTtftP95Ms,
  );
  compareMaximum(
    failures,
    'final_total_p95',
    report.latency.finalResponseTotalP95Ms,
    threshold.finalResponseTotalP95Ms,
  );
  compareMaximum(
    failures,
    'chat_end_to_end_p95',
    report.latency.chatEndToEndP95Ms,
    threshold.chatEndToEndP95Ms,
  );
  for (const [provider, aggregate] of Object.entries({
    deepseek: report.providers.deepseek,
    qwen: report.providers.qwen,
  })) {
    if (
      Object.values(aggregate.runnerWire).some((value) => value !== 32) ||
      Object.values(aggregate.providerWire).some((value) => value !== 32) ||
      aggregate.inputTokens === null ||
      aggregate.outputTokens === null ||
      aggregate.verifiedCostCny === null
    ) {
      failures.push(`${provider}_accounting`);
    }
  }
  if (
    report.providers.qwen.outputTokens !== 0 ||
    (report.providers.qwen.inputTokens ?? Number.POSITIVE_INFINITY) >
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.qwen.verifiedInputTokensRunMax ||
    (report.providers.qwen.verifiedCostCny ?? Number.POSITIVE_INFINITY) >
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.qwen.runCostCnyMax
  ) {
    failures.push('qwen_budget');
  }
  if (
    (report.providers.deepseek.verifiedCostCny ?? Number.POSITIVE_INFINITY) >
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.deepseek.runCostCnyMax
  ) {
    failures.push('deepseek_budget');
  }
  if (
    report.providers.aggregateVerifiedCostCny === null ||
    report.providers.aggregateVerifiedCostCny >
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.totalRunCostCnyMax
  ) {
    failures.push('aggregate_cost');
  }
  if (report.authority === 'controlled_live') {
    if (!report.execution.sourceAdmissionExecuted || report.execution.credentialReads !== 3) {
      failures.push('live_admission');
    }
    if (report.execution.externalProviderCalls !== 64) failures.push('live_provider_calls');
  } else if (
    report.execution.sourceAdmissionExecuted ||
    report.execution.credentialReads !== 0 ||
    report.execution.externalProviderCalls !== 0
  ) {
    failures.push('synthetic_boundary');
  }
  const passed = failures.length === 0;
  if (!passed) {
    return deepFreeze({
      status: 'architecture_recovery_quality_gate_failed' as const,
      passed: false,
      qualityAuthority: 'none' as const,
      failureReasons: failures,
    });
  }
  if (report.authority === 'controlled_live') {
    return deepFreeze({
      status: 'architecture_recovery_quality_gate_passed' as const,
      passed: true,
      qualityAuthority: 'retriever_final_response_architecture_recovery_semantic_gate' as const,
      failureReasons: failures,
    });
  }
  return deepFreeze({
    status:
      report.execution.mode === 'reviewed_mock'
        ? ('architecture_recovery_mock_quality_not_evidence' as const)
        : ('architecture_recovery_synthetic_contract_passed' as const),
    passed: true,
    qualityAuthority: 'none' as const,
    failureReasons: failures,
  });
}

export function parsePhase698ArchitectureRecoveryReport(
  value: unknown,
): Phase698ArchitectureRecoveryReport | null {
  const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA.safeParse(value);
  if (!parsed.success) return null;
  try {
    const rebuilt = buildPhase698ArchitectureRecoveryReport({
      runId: parsed.data.runId,
      authority: parsed.data.authority,
      runMode: parsed.data.execution.mode,
      completionMode: parsed.data.completionMode,
      source: parsed.data.source,
      credentialReads: parsed.data.execution.credentialReads,
      guardEntries: parsed.data.guardEntries,
      callEntries: parsed.data.callEntries,
      rewriteEntries: parsed.data.rewriteEntries,
      finalResponseEntries: parsed.data.finalResponseEntries,
    });
    return canonicalPhase698ArchitectureRecoveryJson(rebuilt) ===
      canonicalPhase698ArchitectureRecoveryJson(parsed.data)
      ? rebuilt
      : null;
  } catch {
    return null;
  }
}

export function createPhase698ArchitectureRecoveryNotStartedEntry(
  identity: Phase698ArchitectureRecoveryCallIdentity,
  transportAuthority: 'synthetic_injected' | 'external_provider',
  breaker: 'case_guard' | 'quality_breaker' | 'external_abort',
): Phase698ArchitectureRecoveryCallEntry {
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...identity,
    transportAuthority,
    disposition:
      breaker === 'case_guard'
        ? 'not_started_case_guard'
        : breaker === 'external_abort'
          ? 'not_started_external_abort'
          : 'not_started_quality_breaker',
    failureReason:
      breaker === 'case_guard'
        ? 'case_guard'
        : breaker === 'external_abort'
          ? 'aborted'
          : 'quality_breaker',
    runnerWire: { reservations: 0, dispatches: 0, harnessReturns: 0, verifiedResults: 0 },
    providerWire: { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    diagnosticStages: [],
    diagnostic: null,
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
  });
}

export function calculatePhase698ArchitectureRecoveryCostCny(
  provider: 'deepseek' | 'qwen',
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
): number | null {
  try {
    return provider === 'qwen'
      ? usage.outputTokens === 0
        ? calculateQwenTextEmbeddingV4CostCny(usage.inputTokens)
        : null
      : calculatePhase698Task9DeepseekCostCny(usage.inputTokens, usage.outputTokens);
  } catch {
    return null;
  }
}

export function canonicalPhase698ArchitectureRecoveryJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Phase698ArchitectureRecovery(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectedIdentity(callId: string) {
  return (
    expectedPhase698ArchitectureRecoveryCallSchedule().find((entry) => entry.callId === callId) ??
    null
  );
}

function diagnosticTranscriptMatches(
  phase: Phase698ArchitectureRecoveryCallPhase,
  stages: readonly Phase698ArchitectureRecoveryDiagnosticStage[],
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic,
) {
  if (diagnostic.callPhase !== phase) return false;
  const sequence: readonly Phase698ArchitectureRecoveryDiagnosticStage[] =
    DIAGNOSTIC_SEQUENCES[phase];
  const terminalIndex = sequence.indexOf(diagnostic.stage);
  if (terminalIndex < 0) return false;
  const expected =
    diagnostic.stage === 'applied' && diagnostic.reasonCode === 'applied'
      ? sequence
      : sequence.slice(0, terminalIndex);
  return (
    canonicalPhase698ArchitectureRecoveryJson(stages) ===
    canonicalPhase698ArchitectureRecoveryJson(expected)
  );
}

function providerWireMatchesDiagnostic(
  wire: Phase698ArchitectureRecoveryProviderWire,
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic,
) {
  const exact = (dispatches: number, responses: number, verifiedUsage: number) =>
    wire.dispatches === dispatches &&
    wire.responses === responses &&
    wire.verifiedUsage === verifiedUsage &&
    wire.executions >= dispatches;
  switch (diagnostic.providerBoundary) {
    case 'not_dispatched':
      return exact(0, 0, 0);
    case 'dispatched_no_response':
      return exact(1, 0, 0);
    case 'response_observed':
      return exact(1, 1, 0);
    case 'response_and_usage_observed':
      return exact(1, 1, 1);
    case 'unknown':
      return true;
    default:
      return false;
  }
}

function usageWithinLaneBudget(
  phase: Phase698ArchitectureRecoveryCallPhase,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  cost: number,
) {
  if (phase === 'rewrite_original_retrieval' || phase === 'rewrite_candidate_retrieval') {
    return (
      usage.inputTokens <=
        PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.qwen.verifiedInputTokensPerCallMax &&
      usage.outputTokens === 0 &&
      cost <=
        calculateQwenTextEmbeddingV4CostCny(
          PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.qwen.verifiedInputTokensPerCallMax,
        )
    );
  }
  const lane =
    phase === 'rewrite_candidate_model'
      ? PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.deepseek.rewrite
      : PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.deepseek.finalResponse;
  return (
    usage.inputTokens <= lane.inputTokensMax &&
    usage.outputTokens > 0 &&
    usage.outputTokens <= lane.outputTokensMax &&
    cost <= lane.costCnyMax
  );
}

function aggregateGuards(entries: readonly Phase698ArchitectureRecoveryGuardEntry[]) {
  return deepFreeze({
    passCount: entries.filter((entry) => entry.disposition === 'passed').length,
    zeroCallCount: entries.filter((entry) => entry.zeroCallVerified).length,
    permissionFailureCount: entries.filter((entry) => entry.permissionFailure).length,
    crossOwnerFailureCount: entries.filter((entry) => entry.crossOwnerFailure).length,
    credentialFailureCount: entries.filter((entry) => entry.credentialFailure).length,
    injectionFailureCount: entries.filter((entry) => entry.injectionFailure).length,
  });
}

function aggregateDiagnostics(entries: readonly Phase698ArchitectureRecoveryCallEntry[]) {
  const started = entries.filter((entry) => !entry.disposition.startsWith('not_started_'));
  return deepFreeze({
    terminalCount: started.filter((entry) => entry.diagnostic !== null).length,
    appliedCount: started.filter((entry) => entry.diagnostic?.reasonCode === 'applied').length,
    failedCount: started.filter((entry) => entry.diagnostic?.reasonCode !== 'applied').length,
    notStartedCount: entries.length - started.length,
  });
}

function aggregateProviders(entries: readonly Phase698ArchitectureRecoveryCallEntry[]) {
  const aggregate = (provider: 'deepseek' | 'qwen') => {
    const selected = entries.filter((entry) => entry.provider === provider);
    const complete =
      selected.length === 32 && selected.every((entry) => entry.disposition === 'succeeded');
    return deepFreeze({
      expectedCalls: 32 as const,
      runnerWire: {
        reservations: sum(selected.map((entry) => entry.runnerWire.reservations)),
        dispatches: sum(selected.map((entry) => entry.runnerWire.dispatches)),
        harnessReturns: sum(selected.map((entry) => entry.runnerWire.harnessReturns)),
        verifiedResults: sum(selected.map((entry) => entry.runnerWire.verifiedResults)),
      },
      providerWire: {
        executions: sum(selected.map((entry) => entry.providerWire.executions)),
        dispatches: sum(selected.map((entry) => entry.providerWire.dispatches)),
        responses: sum(selected.map((entry) => entry.providerWire.responses)),
        verifiedUsage: sum(selected.map((entry) => entry.providerWire.verifiedUsage)),
      },
      inputTokens: complete ? sum(selected.map((entry) => entry.usage!.inputTokens)) : null,
      outputTokens: complete ? sum(selected.map((entry) => entry.usage!.outputTokens)) : null,
      verifiedCostCny: complete
        ? roundCost(sum(selected.map((entry) => entry.verifiedCostCny!)))
        : null,
    });
  };
  const deepseek = aggregate('deepseek');
  const qwen = aggregate('qwen');
  return deepFreeze({
    deepseek,
    qwen,
    aggregateVerifiedCostCny:
      deepseek.verifiedCostCny === null || qwen.verifiedCostCny === null
        ? null
        : roundCost(deepseek.verifiedCostCny + qwen.verifiedCostCny),
  });
}

function aggregateRewrite(entries: readonly Phase698ArchitectureRecoveryRewriteEntry[]) {
  const complete =
    entries.length === 16 &&
    entries.every(
      (entry) =>
        entry.strict &&
        entry.originalRecallAt5 !== null &&
        entry.originalNdcgAt5 !== null &&
        entry.candidateRecallAt5 !== null &&
        entry.candidateNdcgAt5 !== null &&
        entry.intentPreserved !== null &&
        entry.unsafeRewrite !== null,
    );
  const critical = entries.filter((entry) => entry.critical);
  const originalRecall = complete
    ? average(entries.map((entry) => entry.originalRecallAt5!))
    : null;
  const originalNdcg = complete ? average(entries.map((entry) => entry.originalNdcgAt5!)) : null;
  const candidateRecall = complete
    ? average(entries.map((entry) => entry.candidateRecallAt5!))
    : null;
  const candidateNdcg = complete ? average(entries.map((entry) => entry.candidateNdcgAt5!)) : null;
  return deepFreeze({
    strictCount: entries.filter((entry) => entry.strict).length,
    originalRecallAt5: originalRecall,
    originalNdcgAt5: originalNdcg,
    candidateRecallAt5: candidateRecall,
    candidateNdcgAt5: candidateNdcg,
    candidateNdcgUplift:
      originalNdcg === null || candidateNdcg === null
        ? null
        : rounded(candidateNdcg - originalNdcg),
    criticalTargetRecall:
      complete && critical.length > 0
        ? average(critical.map((entry) => entry.candidateRecallAt5!))
        : null,
    intentPreservation: complete
      ? average(entries.map((entry) => (entry.intentPreserved ? 1 : 0)))
      : null,
    unsafeRewriteCount: entries.filter((entry) => entry.unsafeRewrite === true).length,
  });
}

function isCompleteFinal(entry: Phase698ArchitectureRecoveryFinalEntry) {
  return (
    entry.strict &&
    entry.responseTextHash !== null &&
    entry.terminal === 'response_completed' &&
    entry.terminalCount === 1 &&
    entry.terminalLast &&
    entry.grounded !== null &&
    entry.noticeSatisfied !== null &&
    entry.requiredCitationCount !== null &&
    entry.observedCitationCount !== null &&
    entry.citationTruePositiveCount !== null &&
    entry.falseToolSuccess !== null &&
    entry.falseCitation !== null &&
    entry.ttftMs !== null &&
    entry.totalMs !== null &&
    entry.endToEndMs !== null
  );
}

function aggregateFinalResponse(entries: readonly Phase698ArchitectureRecoveryFinalEntry[]) {
  const complete = entries.length === 16 && entries.every(isCompleteFinal);
  const required = complete ? sum(entries.map((entry) => entry.requiredCitationCount!)) : 0;
  const observed = complete ? sum(entries.map((entry) => entry.observedCitationCount!)) : 0;
  const truePositive = complete ? sum(entries.map((entry) => entry.citationTruePositiveCount!)) : 0;
  const critical = entries.filter(
    (entry) => entry.evidenceStatus === 'conflict' || entry.evidenceStatus === 'insufficient',
  );
  return deepFreeze({
    strictCount: entries.filter((entry) => entry.strict).length,
    groundedRubric: complete ? average(entries.map((entry) => (entry.grounded ? 1 : 0))) : null,
    citationPrecision: complete && observed > 0 ? rounded(truePositive / observed) : null,
    requiredCitationRecall: complete && required > 0 ? rounded(truePositive / required) : null,
    criticalNoticeRecall:
      complete && critical.length > 0
        ? average(critical.map((entry) => (entry.noticeSatisfied ? 1 : 0)))
        : null,
    falseToolSuccessCount: entries.filter((entry) => entry.falseToolSuccess === true).length,
    falseCitationCount: entries.filter((entry) => entry.falseCitation === true).length,
  });
}

function aggregateLatency(
  calls: readonly Phase698ArchitectureRecoveryCallEntry[],
  finals: readonly Phase698ArchitectureRecoveryFinalEntry[],
) {
  const successful = calls.filter((entry) => entry.disposition === 'succeeded');
  const rewrite = successful.filter((entry) => entry.phase === 'rewrite_candidate_model');
  const retrieval = successful.filter(
    (entry) =>
      entry.phase === 'rewrite_original_retrieval' || entry.phase === 'rewrite_candidate_retrieval',
  );
  const completeFinals = finals.filter(isCompleteFinal);
  return deepFreeze({
    rewriteP95Ms:
      rewrite.length === 16 ? nearestRankP95(rewrite.map((entry) => entry.durationMs!)) : null,
    hybridRetrievalP95Ms:
      retrieval.length === 32 ? nearestRankP95(retrieval.map((entry) => entry.durationMs!)) : null,
    finalResponseTtftP95Ms:
      completeFinals.length === 16
        ? nearestRankP95(completeFinals.map((entry) => entry.ttftMs!))
        : null,
    finalResponseTotalP95Ms:
      completeFinals.length === 16
        ? nearestRankP95(completeFinals.map((entry) => entry.totalMs!))
        : null,
    chatEndToEndP95Ms:
      completeFinals.length === 16
        ? nearestRankP95(completeFinals.map((entry) => entry.endToEndMs!))
        : null,
  });
}

function aggregateSafety(
  guards: ReturnType<typeof aggregateGuards>,
  rewrites: readonly Phase698ArchitectureRecoveryRewriteEntry[],
  finals: readonly Phase698ArchitectureRecoveryFinalEntry[],
) {
  const falseExecutionFailureCount = finals.filter(
    (entry) => entry.falseToolSuccess === true,
  ).length;
  const citationFailureCount = finals.filter((entry) => entry.falseCitation === true).length;
  const runtimeSafetyFailures =
    rewrites.filter((entry) => entry.safetyFailure).length +
    finals.filter((entry) => entry.safetyFailure).length;
  return deepFreeze({
    criticalFailureCount:
      guards.permissionFailureCount +
      guards.crossOwnerFailureCount +
      guards.credentialFailureCount +
      guards.injectionFailureCount +
      falseExecutionFailureCount +
      citationFailureCount +
      runtimeSafetyFailures,
    permissionFailureCount: guards.permissionFailureCount,
    crossOwnerFailureCount: guards.crossOwnerFailureCount,
    credentialFailureCount: guards.credentialFailureCount,
    injectionFailureCount: guards.injectionFailureCount,
    falseExecutionFailureCount,
    citationFailureCount,
  });
}

function assertEntryOrder(
  guards: readonly Phase698ArchitectureRecoveryGuardEntry[],
  calls: readonly Phase698ArchitectureRecoveryCallEntry[],
  rewrites: readonly Phase698ArchitectureRecoveryRewriteEntry[],
  finals: readonly Phase698ArchitectureRecoveryFinalEntry[],
) {
  const expected = {
    guards: PHASE_6_9_8_TASK8_MANIFEST.guardCases.map((entry) => entry.caseId),
    calls: expectedPhase698ArchitectureRecoveryCallSchedule().map((entry) => entry.callId),
    rewrites: PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.map((entry) => entry.caseId),
    finals: PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.map((entry) => entry.caseId),
  };
  const actual = {
    guards: guards.map((entry) => entry.caseId),
    calls: calls.map((entry) => entry.callId),
    rewrites: rewrites.map((entry) => entry.caseId),
    finals: finals.map((entry) => entry.caseId),
  };
  if (
    canonicalPhase698ArchitectureRecoveryJson(expected) !==
    canonicalPhase698ArchitectureRecoveryJson(actual)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_ENTRY_ORDER_INVALID');
  }
}

function isPrefix(...values: readonly number[]) {
  return values.every((value, index) => index === 0 || values[index - 1] >= value);
}

function compareMinimum(failures: string[], code: string, value: number | null, threshold: number) {
  if (value === null || value < threshold) failures.push(code);
}

function compareMaximum(failures: string[], code: string, value: number | null, threshold: number) {
  if (value === null || value > threshold) failures.push(code);
}

function compareExact(failures: string[], code: string, value: number | null, expected: number) {
  if (value !== expected) failures.push(code);
}

function nearestRankP95(values: readonly number[]) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0))
    return null;
  const sorted = [...values].sort((left, right) => left - right);
  return rounded(sorted[Math.ceil(sorted.length * 0.95) - 1]);
}

function average(values: readonly number[]) {
  return values.length === 0 ? null : rounded(sum(values) / values.length);
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundCost(value: number) {
  return Number(value.toFixed(9));
}

function rounded(value: number) {
  return Number(value.toFixed(12));
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

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
