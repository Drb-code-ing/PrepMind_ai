import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA,
  buildPhase698RetrieverPartialGateReport,
  validatePhase698RetrieverPartialGateReport,
} from './phase-6-9-8-retriever-final-response-partial-quality-gate.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA,
  artifactRelativePath,
  validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';

export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_VERSION =
  'phase-6.9.8-retriever-final-response-partial-quality-closure-v1' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_AUTHORITY =
  'retriever_final_response_v12_retrospective_transport_completion_authority' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT =
  'FINALIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_PARTIAL_CLOSURE_ZERO_PROVIDER_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID =
  '49429392-857d-4635-80cc-0bca317cf9ff' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256 =
  '86f4e84e1859d9c77fc3a050095f5123f16cee9a61da60cc19d79b55e2323654' as const;
export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARTIFACT_SHA256 =
  '817bc89708813982fdfc258126607f2930f42a6aae0fef81584c35548dd9be81' as const;

const BLOCKED_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_VERSION),
    status: z.literal('blocked'),
    gate: z.literal('closed'),
    authority: z.literal('none'),
    qualityAuthority: z.literal('none'),
    reasonCode: z.literal('partial_closure_invalid'),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidenceWrites: z.literal(0),
    businessWrites: z.literal(0),
    v12MutationWrites: z.literal(0),
  })
  .strict();

const COMPLETE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_VERSION),
    status: z.literal('partial_completion_closed'),
    gate: z.literal('closed'),
    authority: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_AUTHORITY),
    qualityAuthority: z.literal('none'),
    baseRunId: z.literal(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID),
    baseReportLogicalSha256: z.literal(
      `sha256:${PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256}`,
    ),
    baseArtifactPhysicalSha256: z.literal(
      `sha256:${PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARTIFACT_SHA256}`,
    ),
    partialReport: PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_REPORT_SCHEMA,
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidenceWrites: z.literal(0),
    businessWrites: z.literal(0),
    v12MutationWrites: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    const calls = value.partialReport.calls;
    if (
      value.partialReport.gate.passed !== true ||
      value.partialReport.gate.authority !== PHASE_6_9_8_RETRIEVER_PARTIAL_GATE_AUTHORITY ||
      value.partialReport.gate.qualityAuthority !== 'none' ||
      value.partialReport.baseReportSha256 !==
        `sha256:${PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256}` ||
      calls.planned !== 24 ||
      calls.started !== 5 ||
      calls.succeeded !== 4 ||
      calls.responsesObserved !== 5 ||
      calls.usageVerified !== 4 ||
      calls.deferred !== 19 ||
      calls.failed !== 1
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'partial closure mismatch' });
    }
  });

export const PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_SUMMARY_SCHEMA = z.union([
  BLOCKED_SCHEMA,
  COMPLETE_SCHEMA,
]);

export type Phase698RetrieverPartialClosureSummary = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_SUMMARY_SCHEMA
>;

export async function runPhase698RetrieverPartialQualityClosure(
  input: Readonly<{
    argv: readonly string[];
    repositoryRoot: string;
  }>,
): Promise<Phase698RetrieverPartialClosureSummary> {
  if (input.argv.length !== 1 || input.argv[0] !== PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARGUMENT) {
    return blocked();
  }
  try {
    const before = await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({
      root: input.repositoryRoot,
    });
    if (!matchesV12(before)) return blocked();

    const bytes = await readFile(
      resolve(
        input.repositoryRoot,
        artifactRelativePath(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID),
      ),
    );
    if (sha256(bytes) !== PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARTIFACT_SHA256) {
      return blocked();
    }
    const artifact = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA.parse(
      JSON.parse(bytes.toString('utf8')),
    );
    if (
      artifact.runId !== PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID ||
      artifact.reportLogicalSha256 !== PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256 ||
      artifact.authority !== 'controlled_live_retriever_final_response_schema_recovery_sr5_v12'
    ) {
      return blocked();
    }

    const partialReport = buildPhase698RetrieverPartialGateReport({
      baseReport: artifact.report,
      executionMode: 'live',
    });
    if (
      validatePhase698RetrieverPartialGateReport({
        report: partialReport,
        baseReport: artifact.report,
        executionMode: 'live',
      }) === null
    ) {
      return blocked();
    }

    const after = await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({
      root: input.repositoryRoot,
    });
    if (!matchesV12(after)) return blocked();

    return COMPLETE_SCHEMA.parse({
      version: PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_VERSION,
      status: 'partial_completion_closed',
      gate: 'closed',
      authority: PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_AUTHORITY,
      qualityAuthority: 'none',
      baseRunId: PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID,
      baseReportLogicalSha256: `sha256:${PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256}`,
      baseArtifactPhysicalSha256: `sha256:${PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARTIFACT_SHA256}`,
      partialReport,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidenceWrites: 0,
      businessWrites: 0,
      v12MutationWrites: 0,
    });
  } catch {
    return blocked();
  }
}

export function serializePhase698RetrieverPartialClosureSummary(
  value: Phase698RetrieverPartialClosureSummary,
): string {
  return `${JSON.stringify(PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_SUMMARY_SCHEMA.parse(value))}\n`;
}

function matchesV12(
  value: Awaited<ReturnType<typeof validatePhase698RetrieverSchemaRecoverySr5LiveBundle>>,
) {
  return (
    value.ok === true &&
    value.runId === PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_RUN_ID &&
    value.reportLogicalSha256 === PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_REPORT_SHA256 &&
    value.physicalArtifactSha256 === PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_ARTIFACT_SHA256 &&
    value.qualityAuthority === 'none'
  );
}

function blocked(): Phase698RetrieverPartialClosureSummary {
  return BLOCKED_SCHEMA.parse({
    version: PHASE_6_9_8_RETRIEVER_PARTIAL_CLOSURE_VERSION,
    status: 'blocked',
    gate: 'closed',
    authority: 'none',
    qualityAuthority: 'none',
    reasonCode: 'partial_closure_invalid',
    providerCalls: 0,
    credentialReads: 0,
    formalEvidenceWrites: 0,
    businessWrites: 0,
    v12MutationWrites: 0,
  });
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
