import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  canonicalPhase698RetrieverSchemaRecoverySr5LiveJson,
  type Phase698RetrieverSchemaRecoverySr5LiveReport,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-contract.ts';

const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const SHA256 = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_VERSION =
  'phase-6.9.8-retriever-final-response-partial-quality-gate-v1' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY =
  'retriever_final_response_transport_completion_authority' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_QUALITY_AUTHORITY = 'none' as const;

const GATE_SCHEMA = z
  .object({
    status: z.enum(['partial_transport_completion', 'partial_gate_failed']),
    passed: z.boolean(),
    authority: z.enum(['none', PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY]),
    qualityAuthority: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_QUALITY_AUTHORITY),
    failureReasons: z.array(SAFE_CODE),
  })
  .strict()
  .superRefine((value, context) => {
    const passed =
      value.status === 'partial_transport_completion' &&
      value.authority === PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY &&
      value.qualityAuthority === 'none' &&
      value.failureReasons.length === 0;
    if (value.passed !== passed) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'partial gate authority mismatch' });
    }
  });

export const PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_VERSION),
    baseReportSha256: SHA256,
    baseLineage: z.string().regex(/^[a-z0-9.-]{1,120}$/u),
    baseGateStatus: z.string().regex(/^[a-z0-9_]{1,96}$/u),
    completionMode: z.enum(['runtime', 'recovery']),
    executionMode: z.enum(['live', 'reviewed_mock']),
    calls: z
      .object({
        planned: z.literal(24),
        started: z.number().int().min(0).max(24),
        succeeded: z.number().int().min(0).max(24),
        responsesObserved: z.number().int().min(0).max(24),
        usageVerified: z.number().int().min(0).max(24),
        deferred: z.number().int().min(0).max(24),
        failed: z.number().int().min(0).max(24),
      })
      .strict(),
    guards: z
      .object({
        passed: z.number().int().min(0).max(8),
        zeroCallVerified: z.number().int().min(0).max(8),
        safetyFailures: z.number().int().nonnegative(),
      })
      .strict(),
    deferredReasons: z.array(SAFE_CODE),
    budget: z
      .object({
        inputTokens: z.null(),
        outputTokens: z.null(),
        verifiedCostCny: z.null(),
      })
      .strict(),
    semantic: z
      .object({
        status: z.literal('not_established'),
        qualityAuthority: z.literal('none'),
        reason: z.literal('partial_gate_does_not_establish_retriever_or_final_response_quality'),
      })
      .strict(),
    gate: GATE_SCHEMA,
    rawDataRetained: z.literal(false),
  })
  .strict();

export type Phase698RetrieverPartialGateReport = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA
>;

export type BuildPhase698RetrieverPartialGateInput = Readonly<{
  baseReport: Phase698RetrieverSchemaRecoverySr5LiveReport;
  executionMode: 'live' | 'reviewed_mock';
}>;

/**
 * Projects bounded transport progress without changing the immutable V12 report.
 * This is intentionally not a semantic-quality or billing result.
 */
export function buildPhase698RetrieverPartialGateReport(
  input: BuildPhase698RetrieverPartialGateInput,
): Phase698RetrieverPartialGateReport {
  const base = input.baseReport;
  const started = base.callEntries.filter((entry) => !entry.disposition.startsWith('not_started_'));
  const succeeded = base.callEntries.filter((entry) => entry.disposition === 'succeeded');
  const observed = base.callEntries.filter((entry) => entry.wire.responses > 0);
  const usageVerified = base.callEntries.filter((entry) => entry.wire.verifiedUsage > 0);
  const deferred = base.callEntries.filter((entry) => entry.disposition.startsWith('not_started_'));
  const failed = started.filter((entry) => entry.disposition !== 'succeeded');
  const failures: string[] = [];

  if (base.completionMode !== 'runtime') failures.push('completion_mode');
  if (base.guards.passCount !== 8 || base.guards.zeroCallCount !== 8) failures.push('guard_count');
  if (base.guards.safetyFailureCount !== 0) failures.push('guard_safety');
  if (started.length === 0 || observed.length === 0) failures.push('no_transport_progress');
  if (failed.some((entry) => entry.failureReason === null)) failures.push('unbounded_failure');
  if (base.execution.mode !== 'live') failures.push('synthetic_authority');
  if (base.execution.mode !== input.executionMode) failures.push('execution_authority');
  if (base.gate.passed || base.qualityAuthority !== 'none') {
    failures.push('semantic_gate_already_established');
  }

  const passed = failures.length === 0;
  const report = {
    version: PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_VERSION,
    baseReportSha256: sha256(canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(base)),
    baseLineage: base.lineage,
    baseGateStatus: base.gate.status,
    completionMode: base.completionMode,
    executionMode: input.executionMode,
    calls: {
      planned: 24 as const,
      started: started.length,
      succeeded: succeeded.length,
      responsesObserved: observed.length,
      usageVerified: usageVerified.length,
      deferred: deferred.length,
      failed: failed.length,
    },
    guards: {
      passed: base.guards.passCount,
      zeroCallVerified: base.guards.zeroCallCount,
      safetyFailures: base.guards.safetyFailureCount,
    },
    deferredReasons: [
      ...new Set(deferred.map((entry) => entry.failureReason).filter(Boolean)),
    ] as string[],
    budget: { inputTokens: null, outputTokens: null, verifiedCostCny: null },
    semantic: {
      status: 'not_established' as const,
      qualityAuthority: 'none' as const,
      reason: 'partial_gate_does_not_establish_retriever_or_final_response_quality' as const,
    },
    gate: {
      status: passed ? ('partial_transport_completion' as const) : ('partial_gate_failed' as const),
      passed,
      authority: passed ? PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY : ('none' as const),
      qualityAuthority: 'none' as const,
      failureReasons: failures,
    },
    rawDataRetained: false as const,
  };
  return PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA.parse(report);
}

export function parsePhase698RetrieverPartialGateReport(
  value: unknown,
): Phase698RetrieverPartialGateReport | null {
  const parsed = PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function validatePhase698RetrieverPartialGateReport(input: {
  report: unknown;
  baseReport: Phase698RetrieverSchemaRecoverySr5LiveReport;
  executionMode: 'live' | 'reviewed_mock';
}): Phase698RetrieverPartialGateReport | null {
  const parsed = parsePhase698RetrieverPartialGateReport(input.report);
  if (parsed === null) return null;
  const rebuilt = buildPhase698RetrieverPartialGateReport({
    baseReport: input.baseReport,
    executionMode: input.executionMode,
  });
  return canonicalPhase698RetrieverPartialGateJson(parsed) ===
    canonicalPhase698RetrieverPartialGateJson(rebuilt)
    ? rebuilt
    : null;
}

export function canonicalPhase698RetrieverPartialGateJson(value: unknown): string {
  return canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(value);
}

function sha256(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
