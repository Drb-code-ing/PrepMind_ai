import { createHash } from 'node:crypto';
import { readdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import { PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-s1-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-s1-source-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY =
  'zero_provider_transport_reentry_v2_s1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_LINEAGE = PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE =
  'transport_reentry_v2_s1_mock_quality_not_evidence' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE_FAILED =
  'transport_reentry_v2_s1_mock_quality_gate_failed' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_BRANCH =
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock-factory-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_RUN_ID =
  '00000000-0000-4000-8000-000000000101' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_MAX_COST_CNY = 0.024096 as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS = Object.freeze([
  Object.freeze({
    slot: 'rewrite',
    adapterId: 'deepseek_rewrite_first_party_synthetic',
    provider: 'deepseek',
    modelRef: 'deepseek-v4-pro',
  }),
  Object.freeze({
    slot: 'qwen',
    adapterId: 'qwen_embedding_first_party_synthetic',
    provider: 'qwen',
    modelRef: 'text-embedding-v4',
  }),
  Object.freeze({
    slot: 'final_response',
    adapterId: 'deepseek_final_response_first_party_synthetic',
    provider: 'deepseek',
    modelRef: 'deepseek-v4-pro',
  }),
] as const);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock.ts',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1.ts',
] as const);

const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const UUID = z.string().uuid();
const ZERO_COMMIT = '0'.repeat(40);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    branch: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceCommit: COMMIT,
    admissionAuthority: z.enum(['synthetic_fixture', 'git_verified']),
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: HEX,
    c2Gate: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedSourceCommit
    ) {
      context.addIssue({ code: 'custom', message: 'S1 source parity mismatch' });
    }
  });
export type Phase698TransportReentryV2S1Source = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_SCHEMA
>;

export type Phase698TransportReentryV2S1AdmissionCapability = Readonly<{
  version: `${typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION}-admission-capability`;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
}>;

type IssuedAdmission = Readonly<{
  authority: 'synthetic_test' | 'git_verified';
  source: Phase698TransportReentryV2S1Source;
}>;
const admissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();

export type Phase698TransportReentryV2S1AdmissionResult =
  | Readonly<{
      ok: true;
      authority: 'synthetic_test' | 'git_verified';
      source: Phase698TransportReentryV2S1Source;
      capability: Phase698TransportReentryV2S1AdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }>;

export function createPhase698TransportReentryV2S1SyntheticAdmissionForTest(): Extract<
  Phase698TransportReentryV2S1AdmissionResult,
  { ok: true }
> {
  const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    branch: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_BRANCH,
    commit: ZERO_COMMIT,
    trackingCommit: ZERO_COMMIT,
    remoteCommit: ZERO_COMMIT,
    approvedSourceCommit: ZERO_COMMIT,
    admissionAuthority: 'synthetic_fixture',
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    c2Gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE,
  });
  return issueAdmission('synthetic_test', source);
}

export function inspectPhase698TransportReentryV2S1SourceAdmission(
  repositoryRoot: string,
): Phase698TransportReentryV2S1AdmissionResult {
  try {
    const root = resolveTrustedGitRoot(repositoryRoot);
    if (!root) return { ok: false, reasonCode: 'source_admission_invalid' };
    const branch = gitText(root, ['branch', '--show-current']);
    const commit = gitText(root, ['rev-parse', '--verify', 'HEAD']);
    const trackingCommit = gitText(root, ['rev-parse', '--verify', '@{upstream}']);
    const remoteCommit = gitText(root, [
      'rev-parse',
      '--verify',
      `refs/remotes/origin/${PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_BRANCH}`,
    ]);
    const status = gitText(root, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (
      branch !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_BRANCH ||
      !commit ||
      !trackingCommit ||
      !remoteCommit ||
      status !== '' ||
      countFormalRepositoryFiles(root) !== 0
    ) {
      return { ok: false, reasonCode: 'source_admission_invalid' };
    }
    if (![commit, trackingCommit, remoteCommit].every((value) => COMMIT.safeParse(value).success)) {
      return { ok: false, reasonCode: 'source_admission_invalid' };
    }
    if (commit !== trackingCommit || commit !== remoteCommit) {
      return { ok: false, reasonCode: 'source_admission_invalid' };
    }
    const sourceBundleSha256 = computeSourceBundle(root, commit);
    if (!sourceBundleSha256) return { ok: false, reasonCode: 'source_admission_invalid' };
    return issueAdmission(
      'git_verified',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_SCHEMA.parse({
        version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_VERSION,
        lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
        branch,
        commit,
        trackingCommit,
        remoteCommit,
        approvedSourceCommit: commit,
        admissionAuthority: 'git_verified',
        workingTreeClean: true,
        formalArtifactCount: 0,
        sourceBundleSha256,
        c2Gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE,
      }),
    );
  } catch {
    return { ok: false, reasonCode: 'source_admission_invalid' };
  }
}

export function consumePhase698TransportReentryV2S1AdmissionCapability(
  capability: unknown,
  expectedAuthority: 'synthetic_test' | 'git_verified',
): IssuedAdmission {
  if (
    typeof capability !== 'object' ||
    capability === null ||
    consumedAdmissions.has(capability) // single-consume capability
  ) {
    throw new Error('S1_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = admissions.get(capability);
  if (!issued || issued.authority !== expectedAuthority) {
    throw new Error('S1_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export type Phase698TransportReentryV2S1AdapterAudit = Readonly<{
  slot: (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTERS)[number]['slot'];
  adapterId: string;
  provider: 'deepseek' | 'qwen';
  modelRef: string;
  mode: 'reviewed_mock';
  inputShape: 'fact_free_bounded';
  outputShape: 'strict_usage_envelope';
  dispatches: 1;
  responses: 1;
  verifiedUsage: 1;
  providerCalls: 0;
  credentialReads: 0;
  rawDataRetained: false;
  oracleRead: false;
}>;

const ADAPTER_AUDIT_SCHEMA = z
  .object({
    slot: z.enum(['rewrite', 'qwen', 'final_response']),
    adapterId: z.string().regex(/^[a-z0-9_]{1,96}$/u),
    provider: z.enum(['deepseek', 'qwen']),
    modelRef: z.string().regex(/^[a-z0-9._-]{1,96}$/u),
    mode: z.literal('reviewed_mock'),
    inputShape: z.literal('fact_free_bounded'),
    outputShape: z.literal('strict_usage_envelope'),
    dispatches: z.literal(1),
    responses: z.literal(1),
    verifiedUsage: z.literal(1),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    rawDataRetained: z.literal(false),
    oracleRead: z.literal(false),
  })
  .strict();

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_ADAPTER_AUDIT_SCHEMA = ADAPTER_AUDIT_SCHEMA;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_REPORT_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runId: UUID,
    source: PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_SCHEMA,
    factory: z
      .object({
        version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_VERSION),
        sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
        adapterCount: z.literal(3),
        responderInput: z.literal('actual_bounded_synthetic_payload'),
        expectedRead: z.literal(false),
        oracleRead: z.literal(false),
      })
      .strict(),
    execution: z
      .object({
        mode: z.literal('reviewed_mock'),
        authority: z.literal('synthetic_test'),
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        syntheticPortCalls: z.literal(3),
        retry: z.literal(false),
        replay: z.literal(false),
        resume: z.literal(false),
        backfill: z.literal(false),
        backgroundJob: z.literal(false),
        outbox: z.literal(false),
        traceWrites: z.literal(0),
        businessWrites: z.literal(0),
      })
      .strict(),
    adapters: z.array(ADAPTER_AUDIT_SCHEMA).length(3),
    runner: z
      .object({
        authority: z.literal('zero_provider_transport_reentry_v2_c2'),
        gate: z.enum([
          'transport_reentry_v2_c2_zero_provider_passed',
          'transport_reentry_v2_c2_zero_provider_blocked',
        ]),
        passed: z.boolean(),
        plannedSlots: z.literal(3),
        startedSlots: z.number().int().min(0).max(3),
        completedSlots: z.number().int().min(0).max(3),
        verifiedUsageSlots: z.number().int().min(0).max(3),
        syntheticPortCalls: z.number().int().min(0).max(3),
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        formalEvidence: z.literal(0),
        breakerOpen: z.boolean(),
        breakerReason: z.string().min(1).max(64),
        reportRawDataRetained: z.literal(false),
      })
      .strict(),
    wire: z
      .object({
        runnerReservations: z.literal(3),
        runnerDispatches: z.literal(3),
        runnerReturns: z.literal(3),
        runnerVerifiedResults: z.literal(3),
        providerExecutions: z.literal(3),
        providerDispatches: z.literal(3),
        providerResponses: z.literal(3),
        providerVerifiedUsage: z.literal(3),
      })
      .strict(),
    usage: z
      .object({
        slots: z.literal(3),
        inputTokens: z.number().int().positive(),
        outputTokens: z.number().int().positive(),
        totalTokens: z.number().int().positive(),
        verifiedProviderCostCny: z.null(),
        syntheticEstimateCny: z
          .number()
          .nonnegative()
          .max(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_MAX_COST_CNY),
      })
      .strict(),
    safety: z
      .object({
        permissionFailures: z.literal(0),
        crossOwnerFailures: z.literal(0),
        credentialFailures: z.literal(0),
        rawDataRetained: z.literal(false),
        falseExecutionFailures: z.literal(0),
      })
      .strict(),
    formalEvidence: z
      .object({
        approvedTagCount: z.literal(0),
        markerCount: z.literal(0),
        journalCount: z.literal(0),
        artifactCount: z.literal(0),
        recoveryClaimCount: z.literal(0),
      })
      .strict(),
    gate: z
      .object({
        status: z.enum([
          PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE,
          PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE_FAILED,
        ]),
        passed: z.boolean(),
        qualityAuthority: z.literal('none'),
        failureReasons: z.array(z.string().regex(/^[a-z0-9_]{1,96}$/u)),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.source.admissionAuthority !== 'synthetic_fixture' ||
      value.runner.providerCalls !== 0 ||
      value.execution.providerCalls !== 0 ||
      value.formalEvidence.artifactCount !== 0 ||
      value.adapters.some((adapter) => adapter.providerCalls !== 0 || adapter.credentialReads !== 0)
    ) {
      context.addIssue({ code: 'custom', message: 'S1 zero-provider boundary mismatch' });
    }
    if (value.gate.passed !== (value.gate.status === PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_GATE)) {
      context.addIssue({ code: 'custom', message: 'S1 gate mismatch' });
    }
  });

export type Phase698TransportReentryV2S1ReviewedMockReport = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_REPORT_SCHEMA
>;

export type Phase698TransportReentryV2S1Checkpoint = Readonly<{
  authority: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_AUTHORITY;
  qualityAuthority: 'none';
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
  factorySha256: string;
  reportSha256: string;
  report: Phase698TransportReentryV2S1ReviewedMockReport;
}>;

export function phase698TransportReentryV2S1Canonical(value: unknown): string {
  return JSON.stringify(sortCanonicalValue(value));
}

export function phase698TransportReentryV2S1Sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function issueAdmission(
  authority: IssuedAdmission['authority'],
  source: Phase698TransportReentryV2S1Source,
): Extract<Phase698TransportReentryV2S1AdmissionResult, { ok: true }> {
  const issued = Object.freeze({ authority, source });
  const capability = Object.freeze({
    version: `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_VERSION}-admission-capability` as const,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  });
  admissions.set(capability, issued);
  return Object.freeze({ ok: true as const, authority, source, capability });
}

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortCanonicalValue(child)]),
  );
}

function resolveTrustedGitRoot(input: string): string | null {
  try {
    const supplied = realpathSync(resolve(input));
    const result = gitText(supplied, ['rev-parse', '--show-toplevel']);
    return result ? realpathSync(result) : null;
  } catch {
    return null;
  }
}

function gitText(root: string, args: string[]): string | null {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  return String(result.stdout).trim();
}

function computeSourceBundle(root: string, commit: string): string | null {
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const path of PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_PATHS) {
    const result = spawnSync('git', ['-C', root, 'cat-file', 'blob', `${commit}:${path}`], {
      encoding: null,
      timeout: 10_000,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.status !== 0 || !result.stdout) return null;
    entries.push({ path, sha256: phase698TransportReentryV2S1Sha256(result.stdout) });
  }
  return phase698TransportReentryV2S1Sha256(phase698TransportReentryV2S1Canonical(entries));
}

function countFormalRepositoryFiles(root: string): number {
  try {
    const tracked = gitText(root, ['ls-files', '.tmp']);
    if (tracked && tracked.length > 0) return tracked.split(/\r?\n/u).filter(Boolean).length;
    const tmp = readdirSync(join(root, '.tmp'), { withFileTypes: true });
    return tmp.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}
