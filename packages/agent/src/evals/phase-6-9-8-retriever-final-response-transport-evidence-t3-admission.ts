import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  type Phase698TransportEvidenceFamily,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t2.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-admission-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-source-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-reservation-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY =
  'zero_provider_transport_evidence_t3_admission' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE =
  'transport_evidence_t3_admission_ready' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED =
  'transport_evidence_t3_admission_blocked' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ADMISSION' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_CONTROLLED_CANARY_ONCE' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_APPROVED' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-contract' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVED_SOURCE_REF =
  `refs/heads/${PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH}` as const;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_T2_GATE_BINDING = Object.freeze({
  authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY,
  gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE,
  qualityAuthority: 'none',
  caseCount: 30,
  classifierCount: 15,
} as const);

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER = Object.freeze([
  'rewrite',
  'qwen',
  'final_response',
] as const satisfies readonly Phase698TransportEvidenceFamily[]);
export type Phase698TransportEvidenceT3Slot =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_PROVIDER_CALLS = 3 as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY = 0.024096 as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PREFLIGHT_NONCE_LENGTH = 36 as const;

const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const UUID = z.string().uuid();

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-rewrite.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-qwen.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-final-response.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2-durability.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-runner.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-live.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-durability.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-cli-core.ts',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-cli.ts',
  'packages/agent/scripts/validate-phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-evidence.ts',
  'packages/ai/src/phase-6-9-7-architecture-recovery-proxy-preflight.ts',
] as const);

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    branch: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceRef: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVED_SOURCE_REF),
    approvedSourceCommit: COMMIT,
    admissionAuthority: z.enum(['synthetic_fixture', 'git_verified']),
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: SHA256,
    t2GateBinding: z
      .object({
        authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY),
        gate: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE),
        qualityAuthority: z.literal('none'),
        caseCount: z.literal(30),
        classifierCount: z.literal(15),
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
export type Phase698TransportEvidenceT3Source = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA
>;

export type Phase698TransportEvidenceT3AdmissionCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CAPABILITY_VERSION;
}>;
export type Phase698TransportEvidenceT3ReservationCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_VERSION;
}>;

type IssuedAdmission = Readonly<{
  authority: 'controlled_live' | 'synthetic_test';
  source: Phase698TransportEvidenceT3Source;
}>;

const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();
const issuedReservations = new WeakMap<object, IssuedAdmission>();
const consumedReservations = new WeakSet<object>();

const FORMAL_T3_FILE =
  /^phase-6-9-8-retriever-final-response-transport-evidence-t3(?:-[0-9a-f-]{36})?\.(?:marker\.json|journal\.jsonl|report\.json|json)$/u;
const FORMAL_T3_ROOT_FILE =
  /^phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-[0-9a-f-]{36}\.json(?:\.tmp-[0-9a-f-]{36})?$/u;
const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const ZERO_COMMIT = '0'.repeat(40);

export type Phase698TransportEvidenceT3RepositoryObservation = Readonly<{
  root: string;
  branch: string;
  head: string;
  tracking: string;
  remote: string;
  approvedSourceCommit: string;
  workingTreeClean: boolean;
  formalArtifactCount: number;
  sourceBundleSha256: string;
}>;

export type Phase698TransportEvidenceT3AdmissionResult =
  | Readonly<{
      ok: true;
      authority: 'controlled_live' | 'synthetic_test';
      source: Phase698TransportEvidenceT3Source;
      capability: Phase698TransportEvidenceT3AdmissionCapability;
      reservationCapability: Phase698TransportEvidenceT3ReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }>;

export function inspectPhase698TransportEvidenceT3SourceAdmission(
  repositoryRoot: string,
): Phase698TransportEvidenceT3AdmissionResult {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null) return invalidAdmission();
  const source = sourceFromObservation(observation);
  if (source === null || !sourceMatchesObservation(source, observation)) return invalidAdmission();
  return issuePairResult('controlled_live', source);
}

export function validatePhase698TransportEvidenceT3SourceAdmissionForTest(
  input: unknown,
  observation: Phase698TransportEvidenceT3RepositoryObservation,
): boolean {
  const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.safeParse(input);
  return parsed.success && sourceMatchesObservation(parsed.data, observation);
}

export function createPhase698TransportEvidenceT3SyntheticAdmissionForTest(
  sourceInput?: Phase698TransportEvidenceT3Source,
): Readonly<{
  ok: true;
  authority: 'synthetic_test';
  source: Phase698TransportEvidenceT3Source;
  capability: Phase698TransportEvidenceT3AdmissionCapability;
  reservationCapability: Phase698TransportEvidenceT3ReservationCapability;
}> {
  const source = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse(
    sourceInput ?? syntheticSource(),
  );
  if (source.admissionAuthority !== 'synthetic_fixture') {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SYNTHETIC_ADMISSION_INVALID');
  }
  return Object.freeze({
    ok: true as const,
    authority: 'synthetic_test' as const,
    source,
    ...issuePair('synthetic_test', source),
  });
}

export function consumePhase698TransportEvidenceT3AdmissionCapability(
  capability: unknown,
  expectedAuthority: 'controlled_live' | 'synthetic_test',
): IssuedAdmission {
  if (!isObject(capability)) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = issuedAdmissions.get(capability);
  if (!issued || consumedAdmissions.has(capability) || issued.authority !== expectedAuthority) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698TransportEvidenceT3ReservationCapability(
  capability: unknown,
  repositoryRoot: string,
): IssuedAdmission {
  if (!isObject(capability)) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_INVALID');
  }
  const issued = issuedReservations.get(capability);
  if (!issued || consumedReservations.has(capability)) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_INVALID');
  }
  consumedReservations.add(capability);
  if (issued.authority === 'controlled_live') {
    const observation = inspectRepository(repositoryRoot);
    if (observation === null || !sourceMatchesObservation(issued.source, observation)) {
      throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_SOURCE_DRIFT');
    }
  }
  return issued;
}

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PROXY_RECEIPT_SCHEMA = z
  .object({
    nonce: UUID,
    ok: z.literal(true),
    code: z.enum(['direct_ready', 'loopback_proxy_ready']),
    mode: z.enum(['direct', 'loopback_proxy']),
    listener: z.enum(['not_required', 'listening']),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.code === 'direct_ready' &&
      (value.mode !== 'direct' ||
        value.listener !== 'not_required' ||
        value.listenerProbeCalls !== 0)
    ) {
      context.addIssue({ code: 'custom', message: 'direct preflight receipt mismatch' });
    }
    if (
      value.code === 'loopback_proxy_ready' &&
      (value.mode !== 'loopback_proxy' ||
        value.listener !== 'listening' ||
        value.listenerProbeCalls !== 1)
    ) {
      context.addIssue({ code: 'custom', message: 'loopback preflight receipt mismatch' });
    }
  });
export type Phase698TransportEvidenceT3ProxyReceipt = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PROXY_RECEIPT_SCHEMA
>;

export function parsePhase698TransportEvidenceT3ProxyReceipt(
  input: unknown,
  expectedNonce: string,
): Phase698TransportEvidenceT3ProxyReceipt | null {
  if (typeof expectedNonce !== 'string') return null;
  try {
    const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PROXY_RECEIPT_SCHEMA.safeParse(input);
    return parsed.success && parsed.data.nonce === expectedNonce ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

export function readPhase698TransportEvidenceT3DataBoundary(
  env: Readonly<Record<string, unknown>>,
): true {
  if (
    readOwnString(env, PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV) !==
    PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_INVALID');
  }
  return true;
}

export function readPhase698TransportEvidenceT3Approval(
  env: Readonly<Record<string, unknown>>,
): true {
  if (
    readOwnString(env, PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV) !==
    PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_INVALID');
  }
  return true;
}

export function validatePhase698TransportEvidenceT3GateBinding(input: unknown): boolean {
  try {
    const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.safeParse(input);
    return (
      parsed.success &&
      parsed.data.authority === PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY &&
      parsed.data.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_GATE &&
      parsed.data.passed &&
      parsed.data.caseCount === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_T2_GATE_BINDING.caseCount &&
      parsed.data.passedCases === parsed.data.caseCount &&
      parsed.data.classifierCount ===
        PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_T2_GATE_BINDING.classifierCount &&
      parsed.data.passedClassifiers === parsed.data.classifierCount &&
      parsed.data.providerCalls === 0 &&
      parsed.data.credentialReads === 0 &&
      parsed.data.formalEvidence === 0 &&
      parsed.data.qualityAuthority === 'none'
    );
  } catch {
    return false;
  }
}

function inspectRepository(
  repositoryRoot: string,
): Phase698TransportEvidenceT3RepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const tracking = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const remote = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH}`,
  ]);
  const approvedSourceCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVED_SOURCE_REF}`,
  ]);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  if (
    branch === null ||
    head === null ||
    tracking === null ||
    remote === null ||
    approvedSourceCommit === null ||
    status === null ||
    ![head, tracking, remote, approvedSourceCommit].every(isCommit)
  )
    return null;
  const bundle = computePhase698TransportEvidenceT3GitSourceBundleSha256(root, head);
  if (!bundle.ok) return null;
  return Object.freeze({
    root,
    branch,
    head,
    tracking,
    remote,
    approvedSourceCommit,
    workingTreeClean: status.length === 0,
    formalArtifactCount: countFormalArtifacts(root),
    sourceBundleSha256: bundle.sha256,
  });
}

export function computePhase698TransportEvidenceT3GitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!isCommit(commitSha))
    return Object.freeze({ ok: false as const, reasonCode: 'source_bundle_invalid' as const });
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null)
    return Object.freeze({ ok: false as const, reasonCode: 'source_bundle_invalid' as const });
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null)
      return Object.freeze({ ok: false as const, reasonCode: 'source_bundle_invalid' as const });
    entries.push(Object.freeze({ path, sha256: sha256(blob) }));
  }
  return Object.freeze({ ok: true as const, sha256: sha256(canonical(entries)) });
}

function sourceFromObservation(observation: Phase698TransportEvidenceT3RepositoryObservation) {
  const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.safeParse({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    branch: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH,
    commit: observation.head,
    trackingCommit: observation.tracking,
    remoteCommit: observation.remote,
    approvedSourceRef: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVED_SOURCE_REF,
    approvedSourceCommit: observation.approvedSourceCommit,
    admissionAuthority: 'git_verified',
    workingTreeClean: observation.workingTreeClean,
    formalArtifactCount: observation.formalArtifactCount,
    sourceBundleSha256: observation.sourceBundleSha256,
    t2GateBinding: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_T2_GATE_BINDING,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function sourceMatchesObservation(
  source: Phase698TransportEvidenceT3Source,
  observation: Phase698TransportEvidenceT3RepositoryObservation,
) {
  try {
    return (
      source.admissionAuthority === 'git_verified' &&
      source.lineage === PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE &&
      source.branch === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH &&
      observation.branch === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH &&
      source.commit === observation.head &&
      source.trackingCommit === observation.tracking &&
      source.remoteCommit === observation.remote &&
      source.approvedSourceCommit === observation.approvedSourceCommit &&
      source.workingTreeClean === observation.workingTreeClean &&
      source.workingTreeClean &&
      source.formalArtifactCount === observation.formalArtifactCount &&
      source.formalArtifactCount === 0 &&
      source.sourceBundleSha256 === observation.sourceBundleSha256 &&
      source.commit === source.trackingCommit &&
      source.commit === source.remoteCommit &&
      source.commit === source.approvedSourceCommit
    );
  } catch {
    return false;
  }
}

function syntheticSource(): Phase698TransportEvidenceT3Source {
  return PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    branch: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BRANCH,
    commit: ZERO_COMMIT,
    trackingCommit: ZERO_COMMIT,
    remoteCommit: ZERO_COMMIT,
    approvedSourceRef: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVED_SOURCE_REF,
    approvedSourceCommit: ZERO_COMMIT,
    admissionAuthority: 'synthetic_fixture',
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    t2GateBinding: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_T2_GATE_BINDING,
  });
}

function issuePair(
  authority: IssuedAdmission['authority'],
  source: Phase698TransportEvidenceT3Source,
) {
  const issued = Object.freeze({ authority, source });
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CAPABILITY_VERSION,
  });
  const reservationCapability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_VERSION,
  });
  issuedAdmissions.set(capability, issued);
  issuedReservations.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function issuePairResult(
  authority: IssuedAdmission['authority'],
  source: Phase698TransportEvidenceT3Source,
) {
  return Object.freeze({ ok: true as const, authority, source, ...issuePair(authority, source) });
}

function readOwnString(env: Readonly<Record<string, unknown>>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string')
      return undefined;
    const value = descriptor.value;
    return value.length > 0 && value === value.trim() && value.length <= 512 ? value : undefined;
  } catch {
    return undefined;
  }
}

function countFormalArtifacts(root: string) {
  try {
    const entries = readdirSync(resolve(root, '.tmp'), { withFileTypes: true });
    const tmpCount = entries.filter(
      (entry) => entry.isFile() && FORMAL_T3_FILE.test(entry.name),
    ).length;
    const rootEntries = readdirSync(resolve(root), { withFileTypes: true });
    const rootCount = rootEntries.filter(
      (entry) => entry.isFile() && FORMAL_T3_ROOT_FILE.test(entry.name),
    ).length;
    return tmpCount + rootCount;
  } catch (error) {
    return isErrorCode(error, 'ENOENT') ? 0 : Number.NaN;
  }
}

function resolveTrustedGitRoot(repositoryRoot: string): string | null {
  try {
    if (typeof repositoryRoot !== 'string' || repositoryRoot.length === 0) return null;
    const requested = realpathSync(resolve(repositoryRoot));
    const reported = runGitTextUnchecked(requested, ['rev-parse', '--show-toplevel']);
    if (reported === null) return null;
    const actual = realpathSync(reported);
    return normalizePath(requested) === normalizePath(actual) ? actual : null;
  } catch {
    return null;
  }
}

function runGitText(root: string, args: readonly string[], trim = true) {
  const value = runGitBuffer(root, args);
  if (value === null) return null;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(value);
    return trim ? decoded.trim() : decoded.replace(/\r?\n$/u, '');
  } catch {
    return null;
  }
}

function runGitTextUnchecked(root: string, args: readonly string[]) {
  const value = runGitBufferUnchecked(root, args);
  if (value === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value).trim();
  } catch {
    return null;
  }
}

function runGitBuffer(root: string, args: readonly string[]): Uint8Array | null {
  try {
    realpathSync(root);
  } catch {
    return null;
  }
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

function normalizePath(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function isCommit(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function invalidAdmission(): Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  return Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
}
