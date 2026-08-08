import { z } from 'zod';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
  architectureRecoveryDiagnosticSequence,
  calculatePhase698ArchitectureRecoveryCostCny,
  canonicalPhase698ArchitectureRecoveryJson,
  expectedPhase698ArchitectureRecoveryCallSchedule,
  sha256Phase698ArchitectureRecovery,
  type Phase698ArchitectureRecoveryCallIdentity,
  type Phase698ArchitectureRecoveryCallResult,
  type Phase698ArchitectureRecoveryReport,
  type Phase698ArchitectureRecoverySource,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryCallPhase,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  createPhase698ArchitectureRecoverySyntheticOutcomeForTest,
  runPhase698ArchitectureRecoveryR3ForTest,
  type Phase698ArchitectureRecoveryHarness,
  type Phase698ArchitectureRecoveryLifecycle,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import { createPhase698ArchitectureRecoverySyntheticAdmissionForTest } from './phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';
import {
  PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256,
  buildPhase698Task8ReviewedMockStaticV1,
  type Phase698Task8FinalResponseReportEntry,
  type Phase698Task8RewriteReportEntry,
} from './phase-6-9-8-retriever-final-response-static.ts';
import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_TASK8_MANIFEST,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import { PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256 } from './phase-6-9-8-retriever-final-response-mock-responder.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256,
  PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256,
  PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';

/**
 * R4 is a reviewed Mock checkpoint, not a Provider or product-quality claim.
 * It deliberately uses the R3 runner with synthetic admission and an injected
 * prompt-only responder. No credential is read and no formal evidence file is
 * created by this module.
 */
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-r4-reviewed-mock-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY =
  'architecture_recovery_mock_quality_not_evidence' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_QUALITY_AUTHORITY = 'none' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_RUN_ID =
  '00000000-0000-4000-8000-000000000004' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-r4-reviewed-mock-factory-v1' as const;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FORBIDDEN_DEPENDENCIES = Object.freeze([
  'provider_credential',
  'external_network',
  'evaluation_expected_output',
  'evaluation_oracle',
  'case_id_answer_table',
  'raw_provider_response',
  'raw_error_or_stack',
  'business_write',
  'background_job',
  'outbox',
]);

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_DESCRIPTOR = Object.freeze({
  version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_VERSION,
  transportAuthority: 'synthetic_injected',
  responderInput: 'actual_bounded_prompt',
  productionPath: 'task8_production_nodes_and_r3_runner',
  providerCalls: 0,
  credentialReads: 0,
  formalEvidence: 0,
  forbiddenDependencies: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FORBIDDEN_DEPENDENCIES,
});
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_SHA256 =
  sha256Phase698ArchitectureRecovery(
    canonicalPhase698ArchitectureRecoveryJson(
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_DESCRIPTOR,
    ),
  );
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FROZEN_FACTORY_SHA256 =
  'c430cbee18c0208b4b31410599860545c261702c790716cdeaf1367c78ecc03e' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FROZEN_REPORT_SHA256 =
  'a8119f51b44d4b9a331e56fb80579a9c075ddb78c71f8b079591645e860f2843' as const;

const SOURCE_IDENTITY_SCHEMA = z
  .object({
    task8ManifestSha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256),
    task8PolicySha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256),
    task8ReviewedMockFactorySha256: z.literal(
      PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
    ),
    task8ReviewedMockReportSha256: z.literal(PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256),
    architectureRecoveryPolicySha256: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256),
    task9cSealedReportSha256: z.literal(PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256),
    task9cSealedArtifactSha256: z.literal(PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256),
  })
  .strict();

const EXECUTION_SCHEMA = z
  .object({
    mode: z.literal('reviewed_mock'),
    authority: z.literal('synthetic_test'),
    responderInput: z.literal('actual_bounded_prompt'),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    externalProviderCalls: z.literal(0),
    qwenExternalCalls: z.literal(0),
    deepseekExternalCalls: z.literal(0),
    syntheticTransportInvocations: z.literal(64),
    sourceAdmissionExecuted: z.literal(false),
    retry: z.literal(false),
    replay: z.literal(false),
    resume: z.literal(false),
    backfill: z.literal(false),
    backgroundJob: z.literal(false),
    outbox: z.literal(false),
  })
  .strict();

const COUNTS_SCHEMA = z
  .object({
    guards: z.literal(16),
    rewritePairs: z.literal(16),
    finalResponseCases: z.literal(16),
    providerCalls: z.literal(64),
    deepseekCalls: z.literal(32),
    qwenCalls: z.literal(32),
  })
  .strict();

const FORMAL_EVIDENCE_SCHEMA = z
  .object({
    approvedTagCount: z.literal(0),
    markerCount: z.literal(0),
    journalCount: z.literal(0),
    artifactCount: z.literal(0),
    recoveryClaimCount: z.literal(0),
  })
  .strict();

const ANTI_ORACLE_SCHEMA = z
  .object({
    actualProductionPath: z.literal(true),
    expectedRead: z.literal(false),
    oracleRead: z.literal(false),
    rawDataRetained: z.literal(false),
    rawDerivedHashRetained: z.literal(false),
    credentialRead: z.literal(false),
    externalProviderCall: z.literal(false),
    responderFactoryCalls: z.literal(16),
    finalExecutorCalls: z.literal(16),
  })
  .strict();

const GATE_SCHEMA = z
  .object({
    status: z.enum([
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
      'architecture_recovery_quality_gate_failed',
    ]),
    passed: z.boolean(),
    qualityAuthority: z.literal('none'),
    failureReasons: z.array(z.string().regex(/^[a-z0-9_]{1,96}$/u)),
  })
  .strict();

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
    authority: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runId: z.string().uuid(),
    source: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
    sourceIdentities: SOURCE_IDENTITY_SCHEMA,
    execution: EXECUTION_SCHEMA,
    counts: COUNTS_SCHEMA,
    diagnostics: z
      .object({
        terminalCount: z.literal(64),
        appliedCount: z.literal(64),
        failedCount: z.literal(0),
        notStartedCount: z.literal(0),
      })
      .strict(),
    wire: z
      .object({
        runner: z
          .object({
            reservations: z.literal(64),
            dispatches: z.literal(64),
            harnessReturns: z.literal(64),
            verifiedResults: z.literal(64),
          })
          .strict(),
        provider: z
          .object({
            executions: z.literal(64),
            dispatches: z.literal(64),
            responses: z.literal(64),
            verifiedUsage: z.literal(64),
          })
          .strict(),
      })
      .strict(),
    quality: z
      .object({
        rewriteStrict: z.literal(16),
        finalResponseStrict: z.literal(16),
        candidateRecallAt5: z.number().min(0).max(1),
        candidateNdcgAt5: z.number().min(0).max(1),
        candidateNdcgUplift: z.number().min(-1).max(1),
        criticalTargetRecall: z.literal(1),
        intentPreservation: z.number().min(0).max(1),
        groundedRubric: z.number().min(0).max(1),
        citationPrecision: z.number().min(0).max(1),
        requiredCitationRecall: z.number().min(0).max(1),
        criticalNoticeRecall: z.number().min(0).max(1),
        unsafeRewriteCount: z.literal(0),
        falseToolSuccessCount: z.literal(0),
        falseCitationCount: z.literal(0),
      })
      .strict(),
    latency: z
      .object({
        rewriteP95Ms: z.number().nonnegative().finite(),
        hybridRetrievalP95Ms: z.number().nonnegative().finite(),
        finalResponseTtftP95Ms: z.number().nonnegative().finite(),
        finalResponseTotalP95Ms: z.number().nonnegative().finite(),
        chatEndToEndP95Ms: z.number().nonnegative().finite(),
      })
      .strict(),
    accounting: z
      .object({
        deepseek: z
          .object({
            calls: z.literal(32),
            inputTokens: z.number().int().positive(),
            outputTokens: z.number().int().positive(),
            syntheticVerifiedCostCny: z.number().nonnegative().finite(),
          })
          .strict(),
        qwen: z
          .object({
            calls: z.literal(32),
            inputTokens: z.number().int().positive(),
            outputTokens: z.literal(0),
            syntheticVerifiedCostCny: z.number().nonnegative().finite(),
          })
          .strict(),
        aggregateSyntheticCostCny: z.number().nonnegative().finite(),
        aggregateVerifiedProviderCostCny: z.null(),
      })
      .strict(),
    safety: z
      .object({
        criticalFailureCount: z.literal(0),
        permissionFailureCount: z.literal(0),
        crossOwnerFailureCount: z.literal(0),
        credentialFailureCount: z.literal(0),
        injectionFailureCount: z.literal(0),
        falseExecutionFailureCount: z.literal(0),
        citationFailureCount: z.literal(0),
      })
      .strict(),
    antiOracle: ANTI_ORACLE_SCHEMA,
    formalEvidence: FORMAL_EVIDENCE_SCHEMA,
    runnerReport: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
    gate: GATE_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.runnerReport.runId !== value.runId ||
      value.runnerReport.source.admissionAuthority !== 'synthetic_fixture' ||
      value.runnerReport.qualityAuthority !== 'none' ||
      value.runnerReport.gate.qualityAuthority !== 'none' ||
      value.gate.qualityAuthority !== 'none' ||
      value.execution.providerCalls !== 0 ||
      value.execution.credentialReads !== 0 ||
      value.formalEvidence.artifactCount !== 0
    ) {
      context.addIssue({ code: 'custom', message: 'R4 authority boundary mismatch' });
    }
  });

export type Phase698ArchitectureRecoveryR4ReviewedMockReport = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_SCHEMA
>;

export type Phase698ArchitectureRecoveryR4ReviewedMockBundle = Readonly<{
  report: Phase698ArchitectureRecoveryR4ReviewedMockReport;
  canonicalBytes: string;
  sha256: string;
}>;

const issuedCapabilities = new WeakSet<object>();
const consumedCapabilities = new WeakSet<object>();

export type Phase698ArchitectureRecoveryR4ReviewedMockCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_VERSION;
}>;

export function createPhase698ArchitectureRecoveryR4ReviewedMockCapability(): Phase698ArchitectureRecoveryR4ReviewedMockCapability {
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_VERSION,
  });
  issuedCapabilities.add(capability);
  return capability;
}

export async function buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1(): Promise<Phase698ArchitectureRecoveryR4ReviewedMockBundle> {
  return runPhase698ArchitectureRecoveryR4ReviewedMockStaticV1(
    createPhase698ArchitectureRecoveryR4ReviewedMockCapability(),
  );
}

export async function runPhase698ArchitectureRecoveryR4ReviewedMockStaticV1(
  capability: Phase698ArchitectureRecoveryR4ReviewedMockCapability,
): Promise<Phase698ArchitectureRecoveryR4ReviewedMockBundle> {
  consumeCapability(capability);

  // Task 8 is the actual production-node/ledger path. Its responder only sees
  // the bounded prompt; expected/oracle data enters only its post-run scorer.
  const task8 = await buildPhase698Task8ReviewedMockStaticV1();
  if (!task8.report.gate.passed || task8.report.gate.status !== 'mock_quality_not_evidence') {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_TASK8_ANCHOR_INVALID');
  }

  const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
  const lifecycleRecording = createRecordingLifecycle(PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_RUN_ID);
  const runnerReport = await runPhase698ArchitectureRecoveryR3ForTest(
    {
      runId: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_RUN_ID,
      authority: 'synthetic_test',
      runMode: 'reviewed_mock',
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: createReviewedMockHarness(
        task8.report.rewriteEntries,
        task8.report.finalResponseEntries,
      ),
      lifecycle: lifecycleRecording.lifecycle,
      signal: new AbortController().signal,
    },
    {
      now: () => 0,
    },
  );

  const parsedRunner = PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA.parse(runnerReport);
  const report = buildR4Report(parsedRunner, admission.source, task8.report);
  const canonicalBytes = `${canonicalPhase698ArchitectureRecoveryJson(report)}\n`;
  const sha256 = sha256Phase698ArchitectureRecovery(canonicalBytes);
  if (
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_SHA256 !==
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FROZEN_FACTORY_SHA256 ||
    sha256 !== PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FROZEN_REPORT_SHA256
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FROZEN_IDENTITY_INVALID');
  }
  return Object.freeze({
    report,
    canonicalBytes,
    sha256,
  });
}

export function scorePhase698ArchitectureRecoveryR4ReviewedMockGate(
  report: Phase698ArchitectureRecoveryR4ReviewedMockReport,
) {
  const failures: string[] = [];
  if (!report.runnerReport.gate.passed) failures.push('runner_gate');
  if (report.diagnostics.terminalCount !== 64 || report.diagnostics.appliedCount !== 64) {
    failures.push('diagnostic_completeness');
  }
  if (
    report.wire.runner.verifiedResults !== 64 ||
    report.wire.provider.verifiedUsage !== 64 ||
    report.execution.providerCalls !== 0 ||
    report.execution.credentialReads !== 0
  ) {
    failures.push('wire_or_authority');
  }
  if (
    report.quality.unsafeRewriteCount !== 0 ||
    report.quality.falseToolSuccessCount !== 0 ||
    report.quality.falseCitationCount !== 0 ||
    report.safety.criticalFailureCount !== 0
  ) {
    failures.push('safety');
  }
  if (
    report.formalEvidence.approvedTagCount !== 0 ||
    report.formalEvidence.markerCount !== 0 ||
    report.formalEvidence.journalCount !== 0 ||
    report.formalEvidence.artifactCount !== 0 ||
    report.formalEvidence.recoveryClaimCount !== 0
  ) {
    failures.push('formal_evidence_boundary');
  }
  return Object.freeze({
    status:
      failures.length === 0
        ? PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY
        : ('architecture_recovery_quality_gate_failed' as const),
    passed: failures.length === 0,
    qualityAuthority: 'none' as const,
    failureReasons: Object.freeze(failures),
  });
}

export async function validatePhase698ArchitectureRecoveryR4ReviewedMockBytes(
  input: string | Uint8Array,
): Promise<
  | Readonly<{
      ok: true;
      sha256: string;
      gate: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY;
    }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'invalid_utf8'
        | 'bytes_mismatch'
        | 'schema_invalid'
        | 'authority_boundary_invalid'
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Object.freeze({ ok: false, reasonCode: 'schema_invalid' });
  }
  const report = PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_SCHEMA.safeParse(parsed);
  if (!report.success) return Object.freeze({ ok: false, reasonCode: 'schema_invalid' });
  if (canonicalPhase698ArchitectureRecoveryJson(report.data) + '\n' !== text) {
    return Object.freeze({ ok: false, reasonCode: 'bytes_mismatch' });
  }
  const expected = await buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1();
  if (expected.canonicalBytes !== text) {
    return Object.freeze({ ok: false, reasonCode: 'bytes_mismatch' });
  }
  const gate = scorePhase698ArchitectureRecoveryR4ReviewedMockGate(report.data);
  if (
    !gate.passed ||
    report.data.gate.status !== PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY ||
    report.data.gate.qualityAuthority !== 'none'
  ) {
    return Object.freeze({ ok: false, reasonCode: 'gate_failed' });
  }
  if (
    report.data.execution.providerCalls !== 0 ||
    report.data.execution.credentialReads !== 0 ||
    report.data.formalEvidence.artifactCount !== 0 ||
    report.data.antiOracle.rawDataRetained ||
    report.data.antiOracle.rawDerivedHashRetained
  ) {
    return Object.freeze({ ok: false, reasonCode: 'authority_boundary_invalid' });
  }
  return Object.freeze({
    ok: true,
    sha256: sha256Phase698ArchitectureRecovery(text),
    gate: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
  });
}

function buildR4Report(
  runnerReport: Phase698ArchitectureRecoveryReport,
  source: Phase698ArchitectureRecoverySource,
  task8Report: Awaited<ReturnType<typeof buildPhase698Task8ReviewedMockStaticV1>>['report'],
): Phase698ArchitectureRecoveryR4ReviewedMockReport {
  const deepseek = runnerReport.providers.deepseek;
  const qwen = runnerReport.providers.qwen;
  const reportWithoutGate = {
    schemaVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    authority: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
    qualityAuthority: 'none' as const,
    runId: runnerReport.runId,
    source,
    sourceIdentities: {
      task8ManifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
      task8PolicySha256: PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
      task8ReviewedMockFactorySha256: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
      task8ReviewedMockReportSha256: PHASE_6_9_8_TASK8_FROZEN_REPORT_SHA256,
      architectureRecoveryPolicySha256: PHASE_6_9_8_ARCHITECTURE_RECOVERY_POLICY_SHA256,
      task9cSealedReportSha256: PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256,
      task9cSealedArtifactSha256: PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256,
    },
    execution: {
      mode: 'reviewed_mock' as const,
      authority: 'synthetic_test' as const,
      responderInput: 'actual_bounded_prompt' as const,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      externalProviderCalls: 0 as const,
      qwenExternalCalls: 0 as const,
      deepseekExternalCalls: 0 as const,
      syntheticTransportInvocations: 64 as const,
      sourceAdmissionExecuted: false as const,
      retry: false as const,
      replay: false as const,
      resume: false as const,
      backfill: false as const,
      backgroundJob: false as const,
      outbox: false as const,
    },
    counts: {
      guards: 16 as const,
      rewritePairs: 16 as const,
      finalResponseCases: 16 as const,
      providerCalls: 64 as const,
      deepseekCalls: 32 as const,
      qwenCalls: 32 as const,
    },
    diagnostics: {
      terminalCount: runnerReport.diagnostics.terminalCount,
      appliedCount: runnerReport.diagnostics.appliedCount,
      failedCount: runnerReport.diagnostics.failedCount,
      notStartedCount: runnerReport.diagnostics.notStartedCount,
    },
    wire: {
      runner: aggregateRunnerWire(runnerReport),
      provider: aggregateProviderWire(runnerReport),
    },
    quality: {
      rewriteStrict: runnerReport.rewrite.strictCount,
      finalResponseStrict: runnerReport.finalResponse.strictCount,
      candidateRecallAt5: runnerReport.rewrite.candidateRecallAt5!,
      candidateNdcgAt5: runnerReport.rewrite.candidateNdcgAt5!,
      candidateNdcgUplift: runnerReport.rewrite.candidateNdcgUplift!,
      criticalTargetRecall: runnerReport.rewrite.criticalTargetRecall!,
      intentPreservation: runnerReport.rewrite.intentPreservation!,
      groundedRubric: runnerReport.finalResponse.groundedRubric!,
      citationPrecision: runnerReport.finalResponse.citationPrecision!,
      requiredCitationRecall: runnerReport.finalResponse.requiredCitationRecall!,
      criticalNoticeRecall: runnerReport.finalResponse.criticalNoticeRecall!,
      unsafeRewriteCount: runnerReport.rewrite.unsafeRewriteCount,
      falseToolSuccessCount: runnerReport.finalResponse.falseToolSuccessCount,
      falseCitationCount: runnerReport.finalResponse.falseCitationCount,
    },
    latency: {
      rewriteP95Ms: runnerReport.latency.rewriteP95Ms!,
      hybridRetrievalP95Ms: runnerReport.latency.hybridRetrievalP95Ms!,
      finalResponseTtftP95Ms: runnerReport.latency.finalResponseTtftP95Ms!,
      finalResponseTotalP95Ms: runnerReport.latency.finalResponseTotalP95Ms!,
      chatEndToEndP95Ms: runnerReport.latency.chatEndToEndP95Ms!,
    },
    accounting: {
      deepseek: {
        calls: 32 as const,
        inputTokens: deepseek.inputTokens!,
        outputTokens: deepseek.outputTokens!,
        syntheticVerifiedCostCny: deepseek.verifiedCostCny!,
      },
      qwen: {
        calls: 32 as const,
        inputTokens: qwen.inputTokens!,
        outputTokens: 0 as const,
        syntheticVerifiedCostCny: qwen.verifiedCostCny!,
      },
      aggregateSyntheticCostCny: deepseek.verifiedCostCny! + qwen.verifiedCostCny!,
      aggregateVerifiedProviderCostCny: null,
    },
    safety: {
      criticalFailureCount: runnerReport.safety.criticalFailureCount,
      permissionFailureCount: runnerReport.safety.permissionFailureCount,
      crossOwnerFailureCount: runnerReport.safety.crossOwnerFailureCount,
      credentialFailureCount: runnerReport.safety.credentialFailureCount,
      injectionFailureCount: runnerReport.safety.injectionFailureCount,
      falseExecutionFailureCount: runnerReport.safety.falseExecutionFailureCount,
      citationFailureCount: runnerReport.safety.citationFailureCount,
    },
    antiOracle: {
      actualProductionPath: true as const,
      expectedRead: false as const,
      oracleRead: false as const,
      rawDataRetained: false as const,
      rawDerivedHashRetained: false as const,
      credentialRead: false as const,
      externalProviderCall: false as const,
      responderFactoryCalls: task8Report.rewriteEntries.reduce(
        (total, entry) => total + entry.runtimeFactoryCalls,
        0,
      ),
      finalExecutorCalls: task8Report.finalResponseEntries.reduce(
        (total, entry) => total + entry.executorCalls,
        0,
      ),
    },
    formalEvidence: {
      approvedTagCount: 0 as const,
      markerCount: 0 as const,
      journalCount: 0 as const,
      artifactCount: 0 as const,
      recoveryClaimCount: 0 as const,
    },
    runnerReport,
  };
  const gate = scorePhase698ArchitectureRecoveryR4ReviewedMockGate(
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_SCHEMA.parse({
      ...reportWithoutGate,
      gate: {
        status: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
        passed: true,
        qualityAuthority: 'none',
        failureReasons: [],
      },
    }),
  );
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REPORT_SCHEMA.parse({
    ...reportWithoutGate,
    gate,
  });
}

function createReviewedMockHarness(
  rewriteEntries: readonly Phase698Task8RewriteReportEntry[],
  finalEntries: readonly Phase698Task8FinalResponseReportEntry[],
): Phase698ArchitectureRecoveryHarness {
  const rewriteById = new Map(rewriteEntries.map((entry) => [entry.caseId, entry]));
  const finalById = new Map(finalEntries.map((entry) => [entry.caseId, entry]));
  return Object.freeze({
    runMode: 'reviewed_mock' as const,
    transportAuthority: 'synthetic_injected' as const,
    async runGuard(testCase) {
      return Object.freeze({
        observedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      });
    },
    async invokeCall(input) {
      const identity = input.identity;
      const rewrite = rewriteById.get(identity.caseId);
      const final = finalById.get(identity.caseId);
      const testCase =
        PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.find((entry) => entry.caseId === identity.caseId) ??
        null;
      const finalCase =
        PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.find(
          (entry) => entry.caseId === identity.caseId,
        ) ?? null;
      if (identity.phase === 'final_response_model') {
        if (!final || !finalCase || final.accountedUsage === null) {
          throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FINAL_FIXTURE_INVALID');
        }
        return createOutcome(identity, {
          result: {
            phase: identity.phase,
            responseTextHash: final.responseTextHash,
            terminal: 'response_completed',
            terminalCount: 1,
            terminalLast: true,
            grounded: final.grounded,
            noticeSatisfied: final.noticeSatisfied,
            requiredCitationCount: final.requiredCitationCount,
            observedCitationCount: final.observedCitationCount,
            citationTruePositiveCount: final.citationTruePositiveCount,
            falseToolSuccess: final.falseToolSuccess,
            falseCitation: final.falseCitation,
            ttftMs: 20,
            totalMs: 50,
            endToEndMs: 80,
          },
          usage: {
            inputTokens: Math.max(1, final.accountedUsage.inputTokens),
            outputTokens: Math.max(1, final.accountedUsage.outputTokens),
          },
        });
      }
      if (!rewrite || !testCase) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REWRITE_FIXTURE_INVALID');
      }
      if (identity.phase === 'rewrite_candidate_model') {
        return createOutcome(identity, {
          result: {
            phase: identity.phase,
            executedQuery: mockExecutedQuery(testCase),
            intentPreserved: rewrite.intentPreserved,
            unsafeRewrite: rewrite.unsafeRewrite,
          },
          usage: {
            inputTokens: Math.max(1, rewrite.accountedUsage.inputTokens),
            outputTokens: Math.max(1, rewrite.accountedUsage.outputTokens),
          },
        });
      }
      if (identity.phase === 'rewrite_candidate_retrieval' && !input.rewrittenQuery) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_QUERY_MISSING');
      }
      const candidate = identity.phase === 'rewrite_candidate_retrieval';
      return createOutcome(identity, {
        result: {
          phase: identity.phase,
          targetRank: candidate ? rewrite.candidateTargetRank : rewrite.baselineTargetRank,
          recallAt5: candidate ? rewrite.candidateRecallAt5 : rewrite.baselineRecallAt5,
          ndcgAt5: candidate ? rewrite.candidateNdcgAt5 : rewrite.baselineNdcgAt5,
        },
        usage: { inputTokens: 128, outputTokens: 0 },
      });
    },
  });
}

function createOutcome(
  identity: Phase698ArchitectureRecoveryCallIdentity,
  input: Readonly<{
    result: Phase698ArchitectureRecoveryCallResult;
    usage: Readonly<{ inputTokens: number; outputTokens: number }>;
  }>,
) {
  const diagnosticStages = architectureRecoveryDiagnosticSequence(identity.phase);
  const diagnostic = appliedDiagnostic(identity.phase);
  return createPhase698ArchitectureRecoverySyntheticOutcomeForTest({
    identity,
    diagnostic,
    diagnosticStages,
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    usage: input.usage,
    verifiedCostCny: calculatePhase698ArchitectureRecoveryCostCny(identity.provider, input.usage),
    result: input.result,
  });
}

function appliedDiagnostic(
  callPhase: Phase698ArchitectureRecoveryCallPhase,
): Phase698ArchitectureRecoveryBoundedDiagnostic {
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.parse({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase,
    stage: 'applied',
    reasonCode: 'applied',
    providerBoundary: 'response_and_usage_observed',
    topLevelTypeBucket: 'object',
    fieldCountBucket: '5_plus',
    terminalCountBucket: callPhase === 'final_response_model' ? '1' : 'not_applicable',
    rawDataRetained: false,
  });
}

function mockExecutedQuery(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number]) {
  const context = [
    ...testCase.recentTurns.map((turn) => turn.content),
    ...(testCase.activeContext?.question ? [testCase.activeContext.question] : []),
    ...(testCase.activeContext?.goal ? [testCase.activeContext.goal] : []),
  ];
  return `${context.join(' ')} 问题：${testCase.originalQuery}`
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
}

function aggregateRunnerWire(report: Phase698ArchitectureRecoveryReport) {
  return {
    reservations:
      report.providers.deepseek.runnerWire.reservations +
      report.providers.qwen.runnerWire.reservations,
    dispatches:
      report.providers.deepseek.runnerWire.dispatches + report.providers.qwen.runnerWire.dispatches,
    harnessReturns:
      report.providers.deepseek.runnerWire.harnessReturns +
      report.providers.qwen.runnerWire.harnessReturns,
    verifiedResults:
      report.providers.deepseek.runnerWire.verifiedResults +
      report.providers.qwen.runnerWire.verifiedResults,
  } as const;
}

function aggregateProviderWire(report: Phase698ArchitectureRecoveryReport) {
  return {
    executions:
      report.providers.deepseek.providerWire.executions +
      report.providers.qwen.providerWire.executions,
    dispatches:
      report.providers.deepseek.providerWire.dispatches +
      report.providers.qwen.providerWire.dispatches,
    responses:
      report.providers.deepseek.providerWire.responses +
      report.providers.qwen.providerWire.responses,
    verifiedUsage:
      report.providers.deepseek.providerWire.verifiedUsage +
      report.providers.qwen.providerWire.verifiedUsage,
  } as const;
}

function consumeCapability(capability: Phase698ArchitectureRecoveryR4ReviewedMockCapability) {
  if (
    typeof capability !== 'object' ||
    capability === null ||
    capability.version !== PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FACTORY_VERSION ||
    !issuedCapabilities.has(capability) ||
    consumedCapabilities.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_CAPABILITY_INVALID');
  }
  consumedCapabilities.add(capability);
}

function createRecordingLifecycle(runId: string): Readonly<{
  lifecycle: Phase698ArchitectureRecoveryLifecycle;
  events: readonly string[];
}> {
  const expectedCalls = expectedPhase698ArchitectureRecoveryCallSchedule();
  const events: string[] = [];
  const reserved = new Map<string, Phase698ArchitectureRecoveryCallIdentity>();
  let guardIndex = 0;
  let callIndex = 0;
  let rewriteIndex = 0;
  let finalIndex = 0;
  let terminal = false;
  const lifecycle: Phase698ArchitectureRecoveryLifecycle = Object.freeze({
    runId,
    async appendGuardTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.guardCases[guardIndex]?.caseId) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_GUARD_ORDER_INVALID');
      }
      guardIndex += 1;
      events.push(`guard:${entry.caseId}`);
    },
    async reserveCall(identity) {
      if (expectedCalls[callIndex]?.callId !== identity.callId || reserved.has(identity.callId)) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_RESERVATION_INVALID');
      }
      reserved.set(identity.callId, identity);
      events.push(`reserve:${identity.callId}`);
      const runnerStages: string[] = [];
      const diagnosticStages: string[] = [];
      return Object.freeze({
        async appendRunnerStage(stage: string) {
          runnerStages.push(stage);
          events.push(`runner:${identity.callId}:${stage}`);
        },
        async appendDiagnosticStage(event: string, stage: string) {
          diagnosticStages.push(stage);
          events.push(`diagnostic:${identity.callId}:${event}:${stage}`);
        },
        async appendCallPrepared(entry: { callId: string }) {
          if (entry.callId !== identity.callId) {
            throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_PREPARED_INVALID');
          }
          events.push(`prepared:${identity.callId}`);
        },
      });
    },
    async appendCallTerminal(entry) {
      if (expectedCalls[callIndex]?.callId !== entry.callId) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_CALL_ORDER_INVALID');
      }
      const started = !entry.disposition.startsWith('not_started_');
      if (started !== reserved.has(entry.callId)) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_RESERVATION_STATE_INVALID');
      }
      reserved.delete(entry.callId);
      callIndex += 1;
      events.push(`call:${entry.callId}`);
    },
    async appendRewriteTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[rewriteIndex]?.caseId) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_REWRITE_ORDER_INVALID');
      }
      rewriteIndex += 1;
      events.push(`rewrite:${entry.caseId}`);
    },
    async appendFinalTerminal(entry) {
      if (entry.caseId !== PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[finalIndex]?.caseId) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_FINAL_ORDER_INVALID');
      }
      finalIndex += 1;
      events.push(`final:${entry.caseId}`);
    },
    async appendRunTerminal(report) {
      if (
        terminal ||
        guardIndex !== 16 ||
        callIndex !== 64 ||
        rewriteIndex !== 16 ||
        finalIndex !== 16 ||
        reserved.size !== 0 ||
        report.runId !== runId
      ) {
        throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_TERMINAL_INVALID');
      }
      terminal = true;
      events.push(`run:${report.gate.status}`);
    },
  });
  return Object.freeze({ lifecycle, events });
}
