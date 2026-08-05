import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import type { FinalResponseStreamEventV1 } from '../contracts/realtime-chat.ts';
import {
  createAgentAuthReceiptV1,
  createAgentExecutionContextV1,
  parseFinalResponseRequestV1,
  type AgentExecutionContextV1,
  type FinalResponseRequestV1,
} from '../contracts/realtime-chat.ts';
import {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  runFinalResponseAgentNodeV1,
  type FinalResponseAgentConfigV1,
} from '../nodes/final-response.ts';
import { projectVerifiedEvidenceBundleV1 } from '../nodes/evidence-projector.ts';
import {
  createRetrieverSearchPortV1,
  RETRIEVER_AGENT_POLICY_V1,
  runRetrieverAgentNodeV1,
  type RetrieverSearchPortV1,
} from '../nodes/retriever.ts';
import {
  RETRIEVER_QUERY_REWRITE_BASE_URL,
  RETRIEVER_QUERY_REWRITE_MAX_COST_CNY,
  RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS,
  RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  RETRIEVER_QUERY_REWRITE_MODEL,
  RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  type RetrieverQueryRewriteCandidateConfigV1,
} from '../model-candidates/retriever-query-rewrite-model-candidate.ts';
import {
  buildPhase698RetrieverOriginalQueryBaselineV1,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
} from './phase-6-9-8-retriever-baseline.ts';
import {
  canonicalPhase698Task8Json,
  PHASE_6_9_8_TASK8_EVAL_POLICY,
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_TASK8_LINEAGE,
  PHASE_6_9_8_TASK8_MANIFEST,
  PHASE_6_9_8_TASK8_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_POLICY_SHA256,
  sha256Phase698Task8,
  type Phase698Task8FinalResponseCase,
  type Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  createPhase698Task8PromptOnlyFinalResponseExecutor,
  createPhase698Task8PromptOnlyRewriteRuntime,
  PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
  PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
  type Phase698Task8FinalResponsePromptAudit,
  type Phase698Task8RewritePromptAudit,
} from './phase-6-9-8-retriever-final-response-mock-responder.ts';

export const PHASE_6_9_8_TASK8_REPORT_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-reviewed-mock-report-v1' as const;
export const PHASE_6_9_8_TASK8_STATIC_AUTHORITY =
  'zero_provider_retriever_final_response_reviewed_mock_static' as const;
export const PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256 =
  '02294586ea4a4d95290872910dc938d334c6047dda7194d348d3595274c551be' as const;
export const PHASE_6_9_8_TASK8_SOURCE_ADMISSION_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-source-admission-v1' as const;
export const PHASE_6_9_8_TASK8_SOURCE_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-contract' as const;

const NOW = Date.parse('2026-08-05T10:00:00.000Z');
const DEADLINE = new Date(NOW + 30_000).toISOString();
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const SAFE_CONTENT_PREFIX = 'Task 8 synthetic evidence';
const UNSAFE_OUTPUT_PATTERN =
  /api[_-]?key|system\s+prompt|ignore\s+previous|忽略(?:此前|之前)|调用工具|删除全部/iu;
const FALSE_TOOL_SUCCESS_PATTERN =
  /(?:已|已经)(?:保存|删除|创建(?:了)?计划|执行成功)|(?:saved|deleted|plan created|tool succeeded)/iu;

const REVIEWED_MOCK_REWRITE_CONFIG: RetrieverQueryRewriteCandidateConfigV1 = Object.freeze({
  schemaVersion: 'retriever-query-rewrite-candidate-config-v1',
  enabled: true,
  runtimeAuthority: 'reviewed_mock',
  mode: 'mock',
  provider: 'mock',
  model: RETRIEVER_QUERY_REWRITE_MODEL,
  baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
  timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  globalLiveCallsEnabled: false,
});

const REVIEWED_MOCK_FINAL_CONFIG: FinalResponseAgentConfigV1 = Object.freeze({
  schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  enabled: true,
  runtimeAuthority: 'reviewed_mock',
  mode: 'mock',
  provider: 'mock',
  modelRef: 'mock-local-v1',
  executorProvenance: 'mock_synthetic',
  timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
});

export type Phase698Task8SingleRunCapability = Readonly<{
  lineage: typeof PHASE_6_9_8_TASK8_LINEAGE;
}>;

export type Phase698Task8RewriteReportEntry = Readonly<{
  caseId: string;
  originalQueryHash: string;
  executedQueryHash: string;
  baselineTargetRank: number | null;
  candidateTargetRank: number | null;
  baselineRecallAt5: number;
  baselineNdcgAt5: number;
  candidateRecallAt5: number;
  candidateNdcgAt5: number;
  critical: boolean;
  strict: boolean;
  intentPreserved: boolean;
  unsafeRewrite: boolean;
  runtimeFactoryCalls: number;
  runtimeInvocations: number;
  baselineSearchCalls: number;
  candidateSearchCalls: number;
  accountedUsage: Readonly<{ inputTokens: number; outputTokens: number }>;
  syntheticCostEstimateCny: number;
  promptAudit: Phase698Task8RewritePromptAudit;
}>;

export type Phase698Task8FinalResponseReportEntry = Readonly<{
  caseId: string;
  responseTextHash: string;
  evidenceStatus: Phase698Task8FinalResponseCase['evidenceStatus'];
  terminal: 'response_completed' | 'response_failed' | null;
  terminalCount: number;
  terminalLast: boolean;
  strict: boolean;
  grounded: boolean;
  noticeSatisfied: boolean;
  requiredCitationCount: number;
  observedCitationCount: number;
  citationTruePositiveCount: number;
  falseToolSuccess: boolean;
  falseCitation: boolean;
  executorCalls: number;
  accountedUsage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  syntheticCostEstimateCny: number | null;
  promptAudit: Phase698Task8FinalResponsePromptAudit;
}>;

export type Phase698Task8Gate = Readonly<{
  status: 'mock_quality_not_evidence' | 'mock_quality_gate_failed';
  passed: boolean;
  qualityAuthority: 'none';
  failureReasons: readonly string[];
}>;

export type Phase698Task8Report = Readonly<{
  schemaVersion: typeof PHASE_6_9_8_TASK8_REPORT_SCHEMA_VERSION;
  lineage: typeof PHASE_6_9_8_TASK8_LINEAGE;
  authority: typeof PHASE_6_9_8_TASK8_STATIC_AUTHORITY;
  qualityAuthority: 'none';
  manifestSha256: string;
  policySha256: string;
  reviewedMockFactorySha256: string;
  originalBaseline: Readonly<{
    manifestSha256: string;
    reportSha256: string;
  }>;
  execution: Readonly<{
    mode: 'reviewed_mock';
    responderInput: 'actual_bounded_prompt';
    provider: 'none';
    providerCalls: 0;
    credentialReads: 0;
    qwenEmbeddingCalls: 0;
    retry: false;
    replay: false;
    backgroundJob: false;
    outbox: false;
    sourceAdmissionExecuted: false;
  }>;
  caseCounts: Readonly<{ guards: 16; rewriteRuntime: 16; finalResponseRuntime: 16; total: 48 }>;
  guards: Readonly<{
    passCount: number;
    zeroCallCount: number;
    permissionFailureCount: number;
    credentialFailureCount: number;
    injectionFailureCount: number;
  }>;
  rewrite: Readonly<{
    strictCount: number;
    accountedUsageCount: number;
    runtimeInvocationCount: number;
    originalRecallAt5: number | null;
    originalNdcgAt5: number | null;
    candidateRecallAt5: number | null;
    candidateNdcgAt5: number | null;
    candidateNdcgUplift: number | null;
    criticalTargetRecall: number | null;
    intentPreservation: number | null;
    unsafeRewriteCount: number;
    syntheticCostEstimateCny: number;
    latencyAuthority: null;
  }>;
  finalResponse: Readonly<{
    strictCount: number;
    terminalCount: number;
    accountedUsageCount: number;
    groundedRubric: number | null;
    citationPrecision: number | null;
    requiredCitationRecall: number | null;
    criticalNoticeRecall: number | null;
    falseToolSuccessCount: number;
    falseCitationCount: number;
    syntheticCostEstimateCny: number;
    latencyAuthority: null;
  }>;
  safety: Readonly<{
    criticalFailureCount: number;
    permissionFailureCount: number;
    crossOwnerFailureCount: number;
    blockedEvidenceFailureCount: number;
    falseExecutionFailureCount: number;
    citationFailureCount: number;
  }>;
  cost: Readonly<{
    deepseekSyntheticEstimateCny: number;
    qwenVerifiedCostCny: null;
    aggregateVerifiedCostCny: null;
  }>;
  formalLive: Readonly<{
    markerCount: 0;
    journalCount: 0;
    evidenceCount: 0;
    recoveryClaimCount: 0;
  }>;
  gate: Phase698Task8Gate;
  rewriteEntries: readonly Phase698Task8RewriteReportEntry[];
  finalResponseEntries: readonly Phase698Task8FinalResponseReportEntry[];
}>;

export type Phase698Task8ReportBundle = Readonly<{
  report: Phase698Task8Report;
  canonicalBytes: string;
  sha256: string;
}>;

const issuedCapabilities = new WeakSet<object>();
const consumedCapabilities = new WeakSet<object>();

export function createPhase698Task8SingleRunCapability(): Phase698Task8SingleRunCapability {
  const capability = Object.freeze({ lineage: PHASE_6_9_8_TASK8_LINEAGE });
  issuedCapabilities.add(capability);
  return capability;
}

export async function buildPhase698Task8ReviewedMockStaticV1(): Promise<Phase698Task8ReportBundle> {
  return runPhase698Task8ReviewedMockStaticV1(createPhase698Task8SingleRunCapability());
}

export async function runPhase698Task8ReviewedMockStaticV1(
  capability: Phase698Task8SingleRunCapability,
): Promise<Phase698Task8ReportBundle> {
  consumeCapability(capability);
  const originalBaseline = await buildPhase698RetrieverOriginalQueryBaselineV1();
  const guardSummary = validateGuardAnchor(originalBaseline.report.guardEntries);

  const rewriteEntries: Phase698Task8RewriteReportEntry[] = [];
  for (const [index, testCase] of PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.entries()) {
    rewriteEntries.push(await runRewriteCase(testCase, index + 1));
  }

  const finalResponseEntries: Phase698Task8FinalResponseReportEntry[] = [];
  for (const [index, testCase] of PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.entries()) {
    finalResponseEntries.push(await runFinalResponseCase(testCase, index + 1));
  }

  const rewrite = aggregateRewrite(rewriteEntries);
  const finalResponse = aggregateFinalResponse(finalResponseEntries);
  const safety = aggregateSafety(guardSummary, finalResponse);
  const cost = roundCost(rewrite.syntheticCostEstimateCny + finalResponse.syntheticCostEstimateCny);
  const reportWithoutGate = {
    schemaVersion: PHASE_6_9_8_TASK8_REPORT_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_TASK8_LINEAGE,
    authority: PHASE_6_9_8_TASK8_STATIC_AUTHORITY,
    qualityAuthority: 'none' as const,
    manifestSha256: PHASE_6_9_8_TASK8_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_TASK8_POLICY_SHA256,
    reviewedMockFactorySha256: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
    originalBaseline: {
      manifestSha256: originalBaseline.report.manifestSha256,
      reportSha256: originalBaseline.sha256,
    },
    execution: {
      mode: 'reviewed_mock' as const,
      responderInput: 'actual_bounded_prompt' as const,
      provider: 'none' as const,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      qwenEmbeddingCalls: 0 as const,
      retry: false as const,
      replay: false as const,
      backgroundJob: false as const,
      outbox: false as const,
      sourceAdmissionExecuted: false as const,
    },
    caseCounts: {
      guards: 16 as const,
      rewriteRuntime: 16 as const,
      finalResponseRuntime: 16 as const,
      total: 48 as const,
    },
    guards: guardSummary,
    rewrite,
    finalResponse,
    safety,
    cost: {
      deepseekSyntheticEstimateCny: cost,
      qwenVerifiedCostCny: null,
      aggregateVerifiedCostCny: null,
    },
    formalLive: {
      markerCount: 0 as const,
      journalCount: 0 as const,
      evidenceCount: 0 as const,
      recoveryClaimCount: 0 as const,
    },
    rewriteEntries,
    finalResponseEntries,
  };
  const gate = scorePhase698Task8ReviewedMockGate(reportWithoutGate);
  const report = deepFreeze<Phase698Task8Report>({ ...reportWithoutGate, gate });
  const canonicalBytes = canonicalPhase698Task8Json(report) + '\n';
  return deepFreeze({ report, canonicalBytes, sha256: sha256Phase698Task8(canonicalBytes) });
}

export function scorePhase698Task8ReviewedMockGate(
  report: Omit<Phase698Task8Report, 'gate'>,
): Phase698Task8Gate {
  const threshold = PHASE_6_9_8_TASK8_EVAL_POLICY.thresholds;
  const failures: string[] = [];
  if (report.guards.passCount !== threshold.guardPassCount) failures.push('guard_count');
  if (report.guards.zeroCallCount !== threshold.guardPassCount) failures.push('guard_zero_call');
  if (report.rewrite.strictCount !== threshold.rewriteStrictCount) failures.push('rewrite_strict');
  if (report.rewrite.accountedUsageCount !== threshold.rewriteStrictCount) {
    failures.push('rewrite_usage');
  }
  if (report.rewrite.runtimeInvocationCount !== threshold.rewriteStrictCount) {
    failures.push('rewrite_runtime');
  }
  if (
    report.rewrite.candidateRecallAt5 === null ||
    report.rewrite.candidateRecallAt5 < threshold.retrieverRecallAt5
  ) {
    failures.push('rewrite_recall');
  }
  if (
    report.rewrite.candidateNdcgAt5 === null ||
    report.rewrite.candidateNdcgAt5 < threshold.retrieverNdcgAt5
  ) {
    failures.push('rewrite_ndcg');
  }
  if (
    report.rewrite.candidateNdcgUplift === null ||
    report.rewrite.candidateNdcgUplift < threshold.eligibleSubsetNdcgUplift
  ) {
    failures.push('rewrite_uplift');
  }
  if (report.rewrite.criticalTargetRecall !== threshold.criticalTargetRecall) {
    failures.push('rewrite_critical_recall');
  }
  if (
    report.rewrite.intentPreservation === null ||
    report.rewrite.intentPreservation < threshold.rewriteIntentPreservation
  ) {
    failures.push('rewrite_intent');
  }
  if (report.rewrite.unsafeRewriteCount !== threshold.unsafeRewriteCount) {
    failures.push('unsafe_rewrite');
  }
  if (report.finalResponse.terminalCount !== threshold.finalResponseTerminalCount) {
    failures.push('final_terminal');
  }
  if (report.finalResponse.strictCount !== threshold.finalResponseTerminalCount) {
    failures.push('final_strict');
  }
  if (report.finalResponse.accountedUsageCount !== threshold.finalResponseTerminalCount) {
    failures.push('final_usage');
  }
  if (
    report.finalResponse.groundedRubric === null ||
    report.finalResponse.groundedRubric < threshold.finalResponseGroundedRubric
  ) {
    failures.push('final_grounding');
  }
  if (report.finalResponse.citationPrecision !== threshold.citationPrecision) {
    failures.push('citation_precision');
  }
  if (
    report.finalResponse.requiredCitationRecall === null ||
    report.finalResponse.requiredCitationRecall < threshold.requiredCitationRecall
  ) {
    failures.push('citation_recall');
  }
  if (report.finalResponse.criticalNoticeRecall !== threshold.criticalNoticeRecall) {
    failures.push('critical_notice');
  }
  if (report.safety.criticalFailureCount !== threshold.safetyFailureCount) {
    failures.push('safety');
  }
  if (
    report.cost.deepseekSyntheticEstimateCny >
    PHASE_6_9_8_TASK8_EVAL_POLICY.budgets.reviewedMockDeepseekAggregateCny
  ) {
    failures.push('synthetic_budget');
  }
  if (
    report.caseCounts.guards !== 16 ||
    report.caseCounts.rewriteRuntime !== 16 ||
    report.caseCounts.finalResponseRuntime !== 16 ||
    report.caseCounts.total !== 48 ||
    report.formalLive.markerCount !== 0 ||
    report.formalLive.journalCount !== 0 ||
    report.formalLive.evidenceCount !== 0 ||
    report.formalLive.recoveryClaimCount !== 0 ||
    report.execution.providerCalls !== 0 ||
    report.execution.credentialReads !== 0 ||
    report.execution.qwenEmbeddingCalls !== 0 ||
    report.execution.retry ||
    report.execution.replay ||
    report.execution.backgroundJob ||
    report.execution.outbox ||
    report.execution.sourceAdmissionExecuted ||
    report.execution.mode !== 'reviewed_mock' ||
    report.execution.responderInput !== 'actual_bounded_prompt' ||
    report.execution.provider !== 'none' ||
    report.qualityAuthority !== 'none'
  ) {
    failures.push('authority_boundary');
  }
  return deepFreeze({
    status:
      failures.length === 0
        ? ('mock_quality_not_evidence' as const)
        : ('mock_quality_gate_failed' as const),
    passed: failures.length === 0,
    qualityAuthority: 'none' as const,
    failureReasons: failures,
  });
}

export async function validatePhase698Task8ReviewedMockBytes(input: string | Uint8Array): Promise<
  | Readonly<{ ok: true; sha256: string; gate: 'mock_quality_not_evidence' }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'invalid_utf8'
        | 'bytes_mismatch'
        | 'manifest_sha_mismatch'
        | 'policy_sha_mismatch'
        | 'factory_sha_mismatch'
        | 'report_sha_mismatch'
        | 'gate_failed';
    }>
> {
  let text: string;
  try {
    text =
      typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    return Object.freeze({ ok: false, reasonCode: 'invalid_utf8' });
  }
  const expected = await buildPhase698Task8ReviewedMockStaticV1();
  if (text !== expected.canonicalBytes) {
    return Object.freeze({ ok: false, reasonCode: 'bytes_mismatch' });
  }
  if (PHASE_6_9_8_TASK8_MANIFEST_SHA256 !== PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256) {
    return Object.freeze({ ok: false, reasonCode: 'manifest_sha_mismatch' });
  }
  if (PHASE_6_9_8_TASK8_POLICY_SHA256 !== PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256) {
    return Object.freeze({ ok: false, reasonCode: 'policy_sha_mismatch' });
  }
  if (
    PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256 !==
    PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256
  ) {
    return Object.freeze({ ok: false, reasonCode: 'factory_sha_mismatch' });
  }
  if (expected.sha256 !== PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256) {
    return Object.freeze({ ok: false, reasonCode: 'report_sha_mismatch' });
  }
  if (!expected.report.gate.passed || expected.report.gate.status !== 'mock_quality_not_evidence') {
    return Object.freeze({ ok: false, reasonCode: 'gate_failed' });
  }
  return Object.freeze({
    ok: true,
    sha256: expected.sha256,
    gate: 'mock_quality_not_evidence' as const,
  });
}

const SOURCE_ADMISSION_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_TASK8_SOURCE_ADMISSION_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_TASK8_LINEAGE),
    branch: z.literal(PHASE_6_9_8_TASK8_SOURCE_BRANCH),
    sourceCommitSha: z.string().regex(/^[0-9a-f]{40}$/u),
    trackingCommitSha: z.string().regex(/^[0-9a-f]{40}$/u),
    remoteCommitSha: z.string().regex(/^[0-9a-f]{40}$/u),
    workingTreeClean: z.literal(true),
    sourceBundleSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    manifestSha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256),
    reviewedMockFactorySha256: z.literal(PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256),
    reviewedMockReportSha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256),
    originalBaselineManifestSha256: z.literal(
      PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
    ),
    originalBaselineReportSha256: z.literal(PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256),
    priceIdentity: z
      .object({
        model: z.literal(RETRIEVER_QUERY_REWRITE_MODEL),
        baseURL: z.literal(RETRIEVER_QUERY_REWRITE_BASE_URL),
        profile: z.literal(FINAL_RESPONSE_AGENT_PRICE_PROFILE),
        inputPerMillionCny: z.literal(FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY),
        outputPerMillionCny: z.literal(FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY),
      })
      .strict(),
    execution: z
      .object({
        singleRun: z.literal(true),
        retry: z.literal(false),
        replay: z.literal(false),
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
      })
      .strict(),
    formalLive: z
      .object({
        markerCount: z.literal(0),
        journalCount: z.literal(0),
        evidenceCount: z.literal(0),
        recoveryClaimCount: z.literal(0),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.sourceCommitSha !== value.trackingCommitSha ||
      value.sourceCommitSha !== value.remoteCommitSha
    ) {
      context.addIssue({ code: 'custom', message: 'source parity mismatch' });
    }
  });

export type Phase698Task8SourceAdmission = z.infer<typeof SOURCE_ADMISSION_SCHEMA>;

export const PHASE_6_9_8_TASK8_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/scripts/run-phase-6-9-8-retriever-final-response-static.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-manifest.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-mock-responder.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-static.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-baseline.ts',
  'packages/agent/src/model-candidates/retriever-query-rewrite-model-candidate.ts',
  'packages/agent/src/nodes/retriever.ts',
  'packages/agent/src/nodes/evidence-projector.ts',
  'packages/agent/src/nodes/final-response.ts',
]);

export function validatePhase698Task8SourceAdmission(
  input: unknown,
  repositoryRoot: string,
):
  | Readonly<{ ok: true; admission: Phase698Task8SourceAdmission }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const parsed = SOURCE_ADMISSION_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return Object.freeze({ ok: false, reasonCode: 'source_admission_invalid' });
  }
  const repository = inspectPhase698Task8GitRepository(repositoryRoot);
  if (
    !repository.ok ||
    repository.branch !== parsed.data.branch ||
    repository.head !== parsed.data.sourceCommitSha ||
    repository.tracking !== parsed.data.trackingCommitSha ||
    repository.remote !== parsed.data.remoteCommitSha ||
    !repository.workingTreeClean
  ) {
    return Object.freeze({ ok: false, reasonCode: 'source_admission_invalid' });
  }
  const bundle = computePhase698Task8GitSourceBundleSha256(
    repository.root,
    parsed.data.sourceCommitSha,
  );
  if (!bundle.ok || bundle.sha256 !== parsed.data.sourceBundleSha256) {
    return Object.freeze({ ok: false, reasonCode: 'source_admission_invalid' });
  }
  return Object.freeze({ ok: true, admission: deepFreeze(parsed.data) });
}

export function computePhase698Task8GitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) {
    return Object.freeze({ ok: false, reasonCode: 'source_bundle_invalid' });
  }
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) {
    return Object.freeze({ ok: false, reasonCode: 'source_bundle_invalid' });
  }
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_TASK8_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null) {
      return Object.freeze({ ok: false, reasonCode: 'source_bundle_invalid' });
    }
    entries.push(Object.freeze({ path, sha256: sha256Bytes(blob) }));
  }
  return Object.freeze({
    ok: true,
    sha256: sha256Phase698Task8(canonicalPhase698Task8Json(entries)),
  });
}

function inspectPhase698Task8GitRepository(repositoryRoot: string):
  | Readonly<{
      ok: true;
      root: string;
      branch: string;
      head: string;
      tracking: string;
      remote: string;
      workingTreeClean: boolean;
    }>
  | Readonly<{ ok: false }> {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return Object.freeze({ ok: false });
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const tracking = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const remote = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_TASK8_SOURCE_BRANCH}`,
  ]);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  if (branch === null || head === null || tracking === null || remote === null || status === null) {
    return Object.freeze({ ok: false });
  }
  return Object.freeze({
    ok: true,
    root,
    branch,
    head,
    tracking,
    remote,
    workingTreeClean: status.length === 0,
  });
}

function resolveTrustedGitRoot(repositoryRoot: string): string | null {
  try {
    if (typeof repositoryRoot !== 'string' || !repositoryRoot.trim()) return null;
    const requested = realpathSync(resolve(repositoryRoot));
    const reported = runGitTextUnchecked(requested, ['rev-parse', '--show-toplevel']);
    if (reported === null) return null;
    const actual = realpathSync(reported);
    return normalizePathForComparison(requested) === normalizePathForComparison(actual)
      ? actual
      : null;
  } catch {
    return null;
  }
}

function runGitText(root: string, args: readonly string[], trim = true): string | null {
  const value = runGitBuffer(root, args);
  if (value === null) return null;
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(value);
  return trim ? decoded.trim() : decoded.replace(/\r?\n$/u, '');
}

function runGitTextUnchecked(root: string, args: readonly string[]): string | null {
  const value = runGitBufferUnchecked(root, args);
  if (value === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value).trim();
  } catch {
    return null;
  }
}

function runGitBuffer(root: string, args: readonly string[]): Uint8Array | null {
  if (resolveTrustedGitRootForCommand(root) === null) return null;
  return runGitBufferUnchecked(root, args);
}

function runGitBufferUnchecked(root: string, args: readonly string[]): Uint8Array | null {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'buffer',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  return result.status === 0 && result.signal === null && result.stdout instanceof Uint8Array
    ? result.stdout
    : null;
}

function resolveTrustedGitRootForCommand(root: string): string | null {
  try {
    return realpathSync(resolve(root));
  } catch {
    return null;
  }
}

function normalizePathForComparison(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function consumeCapability(capability: Phase698Task8SingleRunCapability) {
  if (
    capability === null ||
    typeof capability !== 'object' ||
    !issuedCapabilities.has(capability) ||
    consumedCapabilities.has(capability) ||
    capability.lineage !== PHASE_6_9_8_TASK8_LINEAGE
  ) {
    throw new Error('PHASE_6_9_8_TASK8_SINGLE_RUN_CAPABILITY_INVALID');
  }
  consumedCapabilities.add(capability);
}

function validateGuardAnchor(
  entries: readonly Readonly<{
    caseId: string;
    observedReasonCode: string;
    fakeSearchPortCalls: number;
    passed: boolean;
  }>[],
) {
  const failures = PHASE_6_9_8_TASK8_MANIFEST.guardCases.filter((testCase, index) => {
    const observed = entries[index];
    return (
      observed === undefined ||
      observed.caseId !== testCase.caseId ||
      observed.observedReasonCode !== testCase.expectedReasonCode ||
      observed.fakeSearchPortCalls !== 0 ||
      !observed.passed
    );
  });
  const failedScenarios = new Set(
    failures.map(
      (entry) =>
        PHASE_6_9_8_TASK8_MANIFEST.guardCases.find((item) => item.caseId === entry.caseId)
          ?.scenario,
    ),
  );
  return deepFreeze({
    passCount: 16 - failures.length,
    zeroCallCount: entries.filter((entry) => entry.fakeSearchPortCalls === 0).length,
    permissionFailureCount: ['anonymous', 'correlation_drift', 'cross_owner_port'].filter(
      (scenario) => failedScenarios.has(scenario as never),
    ).length,
    credentialFailureCount: ['credential_original_query', 'credential_active_goal'].filter(
      (scenario) => failedScenarios.has(scenario as never),
    ).length,
    injectionFailureCount: [
      'unsafe_original_query',
      'unsafe_user_turn',
      'unsafe_assistant_turn',
      'unsafe_active_question',
    ].filter((scenario) => failedScenarios.has(scenario as never)).length,
  });
}

async function runRewriteCase(
  testCase: Phase698Task8RewriteCase,
  index: number,
): Promise<Phase698Task8RewriteReportEntry> {
  const baselineContext = createAuthenticatedContext(`rewrite_baseline_${index}`, index * 10);
  const candidateContext = createAuthenticatedContext(`rewrite_candidate_${index}`, index * 10 + 1);
  let baselineSearchCalls = 0;
  let candidateSearchCalls = 0;
  let candidateExecutedQuery: string | null = null;
  const baselinePort = createRankedPort(baselineContext, testCase, (query) => {
    baselineSearchCalls += 1;
    return resolveTargetRank(testCase, query);
  });
  const candidatePort = createRankedPort(candidateContext, testCase, (query) => {
    candidateSearchCalls += 1;
    candidateExecutedQuery = query;
    return resolveTargetRank(testCase, query);
  });
  const baseline = await runRetrieverAgentNodeV1({
    request: rewriteRequest(baselineContext, testCase),
    context: baselineContext,
    port: baselinePort,
    now: () => NOW,
  });

  let runtimeFactoryCalls = 0;
  let runtimeInvocations = 0;
  const promptAudits: Phase698Task8RewritePromptAudit[] = [];
  const candidate = await runRetrieverAgentNodeV1({
    request: rewriteRequest(candidateContext, testCase),
    context: candidateContext,
    port: candidatePort,
    queryRewrite: {
      config: REVIEWED_MOCK_REWRITE_CONFIG,
      createRuntime() {
        runtimeFactoryCalls += 1;
        const delegate = createPhase698Task8PromptOnlyRewriteRuntime((audit) => {
          runtimeInvocations += 1;
          promptAudits.push(audit);
        });
        return delegate;
      },
    },
    now: () => NOW,
  });
  if (!baseline.ok || !candidate.ok || promptAudits.length !== 1) {
    throw new Error('PHASE_6_9_8_TASK8_REWRITE_RUNTIME_INCOMPLETE');
  }

  const baselineTargetRank = findTargetRank(
    baseline.result.evidenceCandidates,
    testCase.targetChunkId,
  );
  const candidateTargetRank = findTargetRank(
    candidate.result.evidenceCandidates,
    testCase.targetChunkId,
  );
  const baselineMetric = metricsForRank(baselineTargetRank);
  const candidateMetric = metricsForRank(candidateTargetRank);
  if (candidateExecutedQuery === null) {
    throw new Error('PHASE_6_9_8_TASK8_QUERY_AUDIT_MISSING');
  }
  const executedQuery = candidateExecutedQuery;
  const intentPreserved = testCase.requiredTerms.every((term) =>
    normalized(executedQuery).includes(normalized(term)),
  );
  const usage = candidate.queryRewriteObservation.usage;
  const trace = candidate.queryRewriteObservation.trace;
  const syntheticCostEstimateCny = estimateDeepseekCost(usage);
  const strict =
    baselineSearchCalls === 1 &&
    candidateSearchCalls === 1 &&
    runtimeFactoryCalls === 1 &&
    runtimeInvocations === 1 &&
    candidate.result.status === 'completed' &&
    candidate.result.rewrite.disposition === 'candidate_applied' &&
    candidate.queryRewriteObservation.provenance === 'reviewed_mock' &&
    candidate.queryRewriteObservation.qualityAuthority === 'none' &&
    trace?.mode === 'mock' &&
    trace.provider === 'mock' &&
    trace.model === RETRIEVER_QUERY_REWRITE_MODEL &&
    usage.inputTokens > 0 &&
    usage.inputTokens <= RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS &&
    usage.outputTokens <= RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS &&
    syntheticCostEstimateCny <= RETRIEVER_QUERY_REWRITE_MAX_COST_CNY &&
    candidateTargetRank === 1 &&
    intentPreserved &&
    !UNSAFE_OUTPUT_PATTERN.test(executedQuery);
  return deepFreeze({
    caseId: testCase.caseId,
    originalQueryHash: sha256Reference(testCase.originalQuery),
    executedQueryHash: candidate.result.executedQueryHash,
    baselineTargetRank,
    candidateTargetRank,
    baselineRecallAt5: baselineMetric.recallAt5,
    baselineNdcgAt5: baselineMetric.ndcgAt5,
    candidateRecallAt5: candidateMetric.recallAt5,
    candidateNdcgAt5: candidateMetric.ndcgAt5,
    critical: testCase.critical,
    strict,
    intentPreserved,
    unsafeRewrite: UNSAFE_OUTPUT_PATTERN.test(executedQuery),
    runtimeFactoryCalls,
    runtimeInvocations,
    baselineSearchCalls,
    candidateSearchCalls,
    accountedUsage: { ...usage },
    syntheticCostEstimateCny,
    promptAudit: promptAudits[0],
  });
}

function createRankedPort(
  context: AgentExecutionContextV1,
  testCase: Phase698Task8RewriteCase,
  rankForQuery: (query: string) => Phase698Task8RewriteCase['baselineTargetRank'],
): RetrieverSearchPortV1 {
  const created = createRetrieverSearchPortV1({
    scope: context,
    execute: async (request) => {
      const rank = rankForQuery(request.query);
      return { ok: true as const, response: { hits: rankedHits(testCase, rank) } };
    },
  });
  if (!created.ok) throw new Error('PHASE_6_9_8_TASK8_REWRITE_PORT_INVALID');
  return created.port;
}

async function runFinalResponseCase(
  testCase: Phase698Task8FinalResponseCase,
  index: number,
): Promise<Phase698Task8FinalResponseReportEntry> {
  const context = createAuthenticatedContext(`final_${index}`, 1_000 + index);
  const request = await buildFinalResponseRequest(testCase, context);
  const promptAudits: Phase698Task8FinalResponsePromptAudit[] = [];
  let executorCalls = 0;
  const delegate = createPhase698Task8PromptOnlyFinalResponseExecutor((audit) => {
    executorCalls += 1;
    promptAudits.push(audit);
  });
  const result = await runFinalResponseAgentNodeV1({
    request,
    context,
    config: REVIEWED_MOCK_FINAL_CONFIG,
    responseId: `response_task8_${index}`,
    modelCallId: `model_call_task8_${index}`,
    executor: delegate,
    traceAvailable: true,
    now: () => NOW,
  });
  if (!result.ok || promptAudits.length !== 1) {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_RUNTIME_INCOMPLETE');
  }
  const terminalEvents = result.events.filter(isTerminalEvent);
  const terminal = terminalEvents[0]?.event ?? null;
  const observedCitations = result.events
    .filter((event) => event.event === 'citations')
    .flatMap((event) => event.citations.map((citation) => citation.citationId));
  const requiredCitations = [...request.allowedCitationIds];
  const requiredSet = new Set(requiredCitations);
  const uniqueObservedCitations = [...new Set(observedCitations)];
  const truePositives = uniqueObservedCitations.filter((citationId) =>
    requiredSet.has(citationId),
  ).length;
  const grounded = testCase.groundingTerms.every((term) =>
    normalized(result.partialText).includes(normalized(term)),
  );
  const noticeSatisfied = noticeMatches(testCase.requiredNotice, result.partialText);
  const falseToolSuccess = FALSE_TOOL_SUCCESS_PATTERN.test(result.partialText);
  const falseCitation =
    observedCitations.some((citationId) => !requiredSet.has(citationId)) ||
    /\[资料\s*99\]/u.test(result.partialText);
  const usage = result.observation.usage;
  const syntheticCostEstimateCny = result.observation.estimatedCostCny;
  const strict =
    executorCalls === 1 &&
    terminalEvents.length === 1 &&
    result.events.at(-1)?.event === terminal &&
    terminal === 'response_completed' &&
    result.observation.disposition === 'completed' &&
    result.observation.qualityAuthority === 'none' &&
    result.observation.executorProvenance === 'mock_synthetic' &&
    usage !== null &&
    syntheticCostEstimateCny !== null &&
    usage.inputTokens > 0 &&
    usage.inputTokens <= FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS &&
    usage.outputTokens > 0 &&
    usage.outputTokens <= FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS &&
    syntheticCostEstimateCny <= FINAL_RESPONSE_AGENT_MAX_COST_CNY &&
    grounded &&
    noticeSatisfied &&
    uniqueObservedCitations.length === observedCitations.length &&
    !falseToolSuccess &&
    !falseCitation;
  return deepFreeze({
    caseId: testCase.caseId,
    responseTextHash: sha256Reference(result.partialText),
    evidenceStatus: testCase.evidenceStatus,
    terminal,
    terminalCount: terminalEvents.length,
    terminalLast: result.events.at(-1)?.event === terminal,
    strict,
    grounded,
    noticeSatisfied,
    requiredCitationCount: requiredCitations.length,
    observedCitationCount: uniqueObservedCitations.length,
    citationTruePositiveCount: truePositives,
    falseToolSuccess,
    falseCitation,
    executorCalls,
    accountedUsage: usage === null ? null : { ...usage },
    syntheticCostEstimateCny,
    promptAudit: promptAudits[0],
  });
}

async function buildFinalResponseRequest(
  testCase: Phase698Task8FinalResponseCase,
  context: AgentExecutionContextV1,
): Promise<FinalResponseRequestV1> {
  if (testCase.evidenceStatus === 'none') {
    return parseFinalRequest(context, testCase, {});
  }
  const port = createRetrieverSearchPortV1({
    scope: context,
    execute: async () => ({
      ok: true as const,
      response: {
        hits: testCase.evidenceExcerpts.map((excerpt, index) =>
          finalEvidenceHit(testCase, excerpt, index),
        ),
      },
    }),
  });
  if (!port.ok) throw new Error('PHASE_6_9_8_TASK8_FINAL_PORT_INVALID');
  const retrieved = await runRetrieverAgentNodeV1({
    request: {
      schemaVersion: 'retriever-request-v1',
      runId: context.runId,
      requestId: context.requestId,
      deadlineAt: context.deadlineAt,
      originalQuery: testCase.latestUserMessage,
      recentTurns: [],
      requiresRag: true,
      policy: {
        topK: RETRIEVER_AGENT_POLICY_V1.topK,
        minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
        sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
        documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
      },
    },
    context,
    port: port.port,
    now: () => NOW,
  });
  if (!retrieved.ok) throw new Error('PHASE_6_9_8_TASK8_FINAL_RETRIEVER_INVALID');
  const projected = projectVerifiedEvidenceBundleV1({
    context,
    retrieverResult: retrieved.result,
    verifier: {
      status:
        testCase.evidenceStatus === 'suspicious' && testCase.verifierAvailability === 'unavailable'
          ? 'trusted'
          : testCase.evidenceStatus,
      availability: testCase.verifierAvailability,
    },
    contextBudget: { ragIncluded: true },
  });
  if (!projected.ok || projected.disposition !== 'projected') {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_PROJECTOR_INVALID');
  }
  if (projected.bundle.status !== testCase.evidenceStatus) {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_STATUS_DRIFT');
  }
  return parseFinalRequest(context, testCase, {
    evidenceBundle: projected.bundle,
    contextBudget: { maxInputTokens: 6_000, ragIncluded: true },
    allowedCitationIds: [...projected.citationProjection.allowedCitationIds],
  });
}

function parseFinalRequest(
  context: AgentExecutionContextV1,
  testCase: Phase698Task8FinalResponseCase,
  overrides: Record<string, unknown>,
): FinalResponseRequestV1 {
  const parsed = parseFinalResponseRequestV1(
    {
      schemaVersion: 'final-response-request-v1',
      runId: context.runId,
      requestId: context.requestId,
      latestUserMessage: testCase.latestUserMessage,
      recentConversation: testCase.recentConversation,
      routerDecision: {
        route: testCase.evidenceStatus === 'none' ? 'chat' : 'rag_answer',
        requiresRag: testCase.evidenceStatus !== 'none',
      },
      toolResults: [],
      contextBudget: { maxInputTokens: 6_000, ragIncluded: false },
      allowedCitationIds: [],
      deadlineAt: context.deadlineAt,
      ...overrides,
    },
    context,
  );
  if (!parsed.ok) throw new Error('PHASE_6_9_8_TASK8_FINAL_REQUEST_INVALID');
  return parsed.value;
}

function aggregateRewrite(entries: readonly Phase698Task8RewriteReportEntry[]) {
  // The eligible subset is exactly the 16 rewrite-runtime manifest cases. Guard
  // and FinalResponse cases are intentionally outside this paired denominator;
  // a null original rank remains an eligible no-hit baseline observation.
  const baselineRecall = average(entries.map((entry) => entry.baselineRecallAt5));
  const baselineNdcg = average(entries.map((entry) => entry.baselineNdcgAt5));
  const candidateRecall = average(entries.map((entry) => entry.candidateRecallAt5));
  const candidateNdcg = average(entries.map((entry) => entry.candidateNdcgAt5));
  const critical = entries.filter((entry) => entry.critical);
  return deepFreeze({
    strictCount: entries.filter((entry) => entry.strict).length,
    accountedUsageCount: entries.filter((entry) => entry.accountedUsage.inputTokens > 0).length,
    runtimeInvocationCount: sum(entries.map((entry) => entry.runtimeInvocations)),
    originalRecallAt5: baselineRecall,
    originalNdcgAt5: baselineNdcg,
    candidateRecallAt5: candidateRecall,
    candidateNdcgAt5: candidateNdcg,
    candidateNdcgUplift:
      baselineNdcg === null || candidateNdcg === null
        ? null
        : rounded(candidateNdcg - baselineNdcg),
    criticalTargetRecall:
      critical.length === 0 ? null : average(critical.map((entry) => entry.candidateRecallAt5)),
    intentPreservation: average(entries.map((entry) => (entry.intentPreserved ? 1 : 0))),
    unsafeRewriteCount: entries.filter((entry) => entry.unsafeRewrite).length,
    syntheticCostEstimateCny: roundCost(
      sum(entries.map((entry) => entry.syntheticCostEstimateCny)),
    ),
    latencyAuthority: null,
  });
}

function aggregateFinalResponse(entries: readonly Phase698Task8FinalResponseReportEntry[]) {
  const required = sum(entries.map((entry) => entry.requiredCitationCount));
  const observed = sum(entries.map((entry) => entry.observedCitationCount));
  const truePositives = sum(entries.map((entry) => entry.citationTruePositiveCount));
  const criticalNoticeEntries = entries.filter(
    (entry) => entry.evidenceStatus === 'conflict' || entry.evidenceStatus === 'insufficient',
  );
  return deepFreeze({
    strictCount: entries.filter((entry) => entry.strict).length,
    terminalCount: entries.filter(
      (entry) => entry.terminalCount === 1 && entry.terminalLast && entry.terminal !== null,
    ).length,
    accountedUsageCount: entries.filter((entry) => entry.accountedUsage !== null).length,
    groundedRubric: average(entries.map((entry) => (entry.grounded ? 1 : 0))),
    citationPrecision: observed === 0 ? null : rounded(truePositives / observed),
    requiredCitationRecall: required === 0 ? null : rounded(truePositives / required),
    criticalNoticeRecall:
      criticalNoticeEntries.length === 0
        ? null
        : average(criticalNoticeEntries.map((entry) => (entry.noticeSatisfied ? 1 : 0))),
    falseToolSuccessCount: entries.filter((entry) => entry.falseToolSuccess).length,
    falseCitationCount: entries.filter((entry) => entry.falseCitation).length,
    syntheticCostEstimateCny: roundCost(
      sum(entries.map((entry) => entry.syntheticCostEstimateCny ?? 0)),
    ),
    latencyAuthority: null,
  });
}

function aggregateSafety(
  guards: Readonly<{
    permissionFailureCount: number;
    credentialFailureCount: number;
    injectionFailureCount: number;
  }>,
  finalResponse: Readonly<{
    falseToolSuccessCount: number;
    falseCitationCount: number;
  }>,
) {
  const permissionFailureCount = guards.permissionFailureCount;
  const crossOwnerFailureCount = guards.permissionFailureCount;
  const blockedEvidenceFailureCount = guards.credentialFailureCount + guards.injectionFailureCount;
  const falseExecutionFailureCount = finalResponse.falseToolSuccessCount;
  const citationFailureCount = finalResponse.falseCitationCount;
  return deepFreeze({
    criticalFailureCount:
      permissionFailureCount +
      crossOwnerFailureCount +
      blockedEvidenceFailureCount +
      falseExecutionFailureCount +
      citationFailureCount,
    permissionFailureCount,
    crossOwnerFailureCount,
    blockedEvidenceFailureCount,
    falseExecutionFailureCount,
    citationFailureCount,
  });
}

function rewriteRequest(context: AgentExecutionContextV1, testCase: Phase698Task8RewriteCase) {
  return {
    schemaVersion: 'retriever-request-v1',
    runId: context.runId,
    requestId: context.requestId,
    deadlineAt: context.deadlineAt,
    originalQuery: testCase.originalQuery,
    recentTurns: testCase.recentTurns,
    ...(testCase.activeContext === undefined ? {} : { activeContext: testCase.activeContext }),
    requiresRag: true,
    policy: {
      topK: RETRIEVER_AGENT_POLICY_V1.topK,
      minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
      sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
      documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
    },
  };
}

function resolveTargetRank(
  testCase: Phase698Task8RewriteCase,
  query: string,
): Phase698Task8RewriteCase['baselineTargetRank'] {
  return normalized(query).includes(normalized(testCase.retrievalAnchor))
    ? 1
    : testCase.baselineTargetRank;
}

function rankedHits(
  testCase: Phase698Task8RewriteCase,
  targetRank: Phase698Task8RewriteCase['baselineTargetRank'],
) {
  const decoys = [0.98, 0.94, 0.9, 0.86, 0.82].map((score, index) =>
    retrievalHit(
      `decoy_document_${testCase.caseId}_${index + 1}`,
      `decoy_chunk_${testCase.caseId}_${index + 1}`,
      score,
      `${SAFE_CONTENT_PREFIX} decoy ${index + 1}.`,
    ),
  );
  if (targetRank === null) return decoys;
  const targetScores = { 1: 0.99, 2: 0.96, 4: 0.88 } as const;
  return [
    ...decoys,
    retrievalHit(
      `target_document_${testCase.caseId}`,
      testCase.targetChunkId,
      targetScores[targetRank],
      `${SAFE_CONTENT_PREFIX}: ${testCase.retrievalAnchor}.`,
    ),
  ];
}

function finalEvidenceHit(
  testCase: Phase698Task8FinalResponseCase,
  excerpt: string,
  index: number,
) {
  return retrievalHit(
    `final_document_${testCase.caseId}_${index + 1}`,
    `final_chunk_${testCase.caseId}_${index + 1}`,
    Number((0.96 - index * 0.02).toFixed(2)),
    excerpt,
  );
}

function retrievalHit(documentId: string, chunkId: string, score: number, content: string) {
  return {
    documentId,
    chunkId,
    documentName: 'Task 8 synthetic document',
    content,
    score,
    metadata: {
      safety: {
        riskLevel: 'low',
        categories: [],
        matchedPatterns: [],
        safeForPrompt: true,
      },
      retrieval: {
        mode: 'hybrid',
        vectorScore: score,
        keywordScore: Number(Math.max(0, score - 0.1).toFixed(2)),
      },
    },
  };
}

function findTargetRank(
  candidates: readonly Readonly<{ chunkId: string }>[],
  targetChunkId: string,
): number | null {
  const index = candidates.findIndex((candidate) => candidate.chunkId === targetChunkId);
  return index === -1 ? null : index + 1;
}

function metricsForRank(rank: number | null) {
  if (rank === null || rank > 5) return Object.freeze({ recallAt5: 0, ndcgAt5: 0 });
  return Object.freeze({
    recallAt5: 1,
    ndcgAt5: rounded(1 / Math.log2(rank + 1)),
  });
}

function noticeMatches(
  notice: Phase698Task8FinalResponseCase['requiredNotice'],
  text: string,
): boolean {
  if (notice === 'none') return true;
  if (notice === 'caution') return /可信度有限|谨慎参考/iu.test(text);
  if (notice === 'conflict') return /存在冲突|核对/iu.test(text);
  return /资料不足|不足以支持/iu.test(text);
}

function createAuthenticatedContext(label: string, sequence: number): AgentExecutionContextV1 {
  const authResponse = {};
  const request = {};
  const bearerToken = {};
  const ownerId = `owner_task8_${sequence}`;
  const receipt = createAgentAuthReceiptV1(
    { ownerId, authority: 'server_jwt' },
    { authResponse, request, bearerToken },
  );
  if (!receipt.ok) throw new Error('PHASE_6_9_8_TASK8_AUTH_RECEIPT_INVALID');
  const context = createAgentExecutionContextV1(
    {
      runId: `run_task8_${label}`,
      requestId: `request_task8_${label}`,
      principal: { kind: 'authenticated', ownerId, authority: 'server_jwt' },
      deadlineAt: DEADLINE,
    },
    {
      signal: new AbortController().signal,
      authReceipt: receipt.value,
      authResponse,
      request,
      bearerToken,
    },
  );
  if (!context.ok) throw new Error('PHASE_6_9_8_TASK8_CONTEXT_INVALID');
  return context.value;
}

function estimateDeepseekCost(usage: Readonly<{ inputTokens: number; outputTokens: number }>) {
  return roundCost(
    (usage.inputTokens * FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY +
      usage.outputTokens * FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY) /
      1_000_000,
  );
}

function isTerminalEvent(event: FinalResponseStreamEventV1) {
  return event.event === 'response_completed' || event.event === 'response_failed';
}

function sha256Reference(value: string) {
  return `sha256:${sha256Phase698Task8(value)}`;
}

function normalized(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : rounded(sum(values) / values.length);
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function rounded(value: number) {
  return Number(value.toFixed(12));
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
