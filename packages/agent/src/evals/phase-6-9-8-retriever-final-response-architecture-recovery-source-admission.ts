import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_VERSION,
  canonicalPhase698ArchitectureRecoveryJson,
  sha256Phase698ArchitectureRecovery,
  type Phase698ArchitectureRecoverySource,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const ZERO_COMMIT = '0000000000000000000000000000000000000000';
const FORMAL_RECOVERY_FILE =
  /^phase-6-9-8-retriever-final-response-architecture-recovery(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|recovery\.claim|json))$/u;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-architecture-recovery-cli.ts',
  'packages/agent/scripts/validate-phase-6-9-8-retriever-final-response-architecture-recovery-evidence.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-final-response.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-qwen.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-observation.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-manifest.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-baseline.ts',
  'packages/agent/src/model-candidates/retriever-query-rewrite-model-candidate.ts',
  'packages/agent/src/nodes/evidence-projector.ts',
  'packages/agent/src/nodes/final-response.ts',
  'packages/agent/src/nodes/retriever.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-final-response.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-qwen.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-rewrite.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-durability.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-lineage-cli.test.ts',
  'packages/agent/tests/phase-6-9-8-retriever-final-response-architecture-recovery-r3-runner.test.ts',
  'packages/ai/package.json',
  'packages/ai/src/final-response-stream-provider.ts',
  'packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts',
  'packages/ai/src/phase-6-9-8-provider-wire-diagnostics.ts',
  'packages/ai/src/qwen-text-embedding-v4-provider.ts',
]);

export type Phase698ArchitectureRecoveryRepositoryObservation = Readonly<{
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

export type Phase698ArchitectureRecoveryAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-architecture-recovery-admission-capability-v1';
}>;

export type Phase698ArchitectureRecoveryReservationAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-architecture-recovery-reservation-admission-capability-v1';
}>;

type IssuedAdmission = Readonly<{
  authority: 'controlled_live' | 'synthetic_test';
  source: Phase698ArchitectureRecoverySource;
}>;

const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();
const issuedReservations = new WeakMap<object, IssuedAdmission>();
const consumedReservations = new WeakSet<object>();

export function inspectPhase698ArchitectureRecoverySourceAdmission(repositoryRoot: string):
  | Readonly<{
      ok: true;
      source: Phase698ArchitectureRecoverySource;
      capability: Phase698ArchitectureRecoveryAdmissionCapability;
      reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null) return invalidAdmission();
  const source = sourceFromObservation(observation);
  if (source === null || !sourceMatchesObservation(source, observation)) return invalidAdmission();
  return issuePairResult('controlled_live', source);
}

export function validatePhase698ArchitectureRecoverySourceAdmission(
  input: unknown,
  repositoryRoot: string,
):
  | Readonly<{
      ok: true;
      source: Phase698ArchitectureRecoverySource;
      capability: Phase698ArchitectureRecoveryAdmissionCapability;
      reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.safeParse(input);
  if (!parsed.success || parsed.data.admissionAuthority !== 'git_verified')
    return invalidAdmission();
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !sourceMatchesObservation(parsed.data, observation)) {
    return invalidAdmission();
  }
  return issuePairResult('controlled_live', deepFreeze(parsed.data));
}

/** Pure comparison seam. It never issues a controlled-Live capability. */
export function validatePhase698ArchitectureRecoverySourceObservationForTest(
  input: unknown,
  observation: Phase698ArchitectureRecoveryRepositoryObservation,
): boolean {
  const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.safeParse(input);
  return parsed.success && sourceMatchesObservation(parsed.data, observation);
}

/** Synthetic-only admission for isolated runner/durability tests. */
export function createPhase698ArchitectureRecoverySyntheticAdmissionForTest(
  sourceInput?: Phase698ArchitectureRecoverySource,
): Readonly<{
  source: Phase698ArchitectureRecoverySource;
  capability: Phase698ArchitectureRecoveryAdmissionCapability;
  reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
}> {
  const source = PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.parse(
    sourceInput ?? syntheticSource(),
  );
  if (source.admissionAuthority !== 'synthetic_fixture') {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_SYNTHETIC_ADMISSION_INVALID');
  }
  const pair = issuePair('synthetic_test', source);
  return Object.freeze({ source, ...pair });
}

export function consumePhase698ArchitectureRecoveryAdmissionCapability(
  capability: Phase698ArchitectureRecoveryAdmissionCapability,
  expectedAuthority: IssuedAdmission['authority'],
): IssuedAdmission {
  if (
    !isObject(capability) ||
    capability.version !==
      'phase-6.9.8-retriever-final-response-architecture-recovery-admission-capability-v1' ||
    consumedAdmissions.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = issuedAdmissions.get(capability);
  if (!issued || issued.authority !== expectedAuthority) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698ArchitectureRecoveryReservationCapability(
  capability: Phase698ArchitectureRecoveryReservationAdmissionCapability,
  repositoryRoot: string,
): IssuedAdmission {
  if (
    !isObject(capability) ||
    capability.version !==
      'phase-6.9.8-retriever-final-response-architecture-recovery-reservation-admission-capability-v1' ||
    consumedReservations.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RESERVATION_CAPABILITY_INVALID');
  }
  const issued = issuedReservations.get(capability);
  if (!issued) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RESERVATION_CAPABILITY_INVALID');
  }
  consumedReservations.add(capability);
  if (issued.authority === 'controlled_live') {
    const observation = inspectRepository(repositoryRoot);
    if (observation === null || !sourceMatchesObservation(issued.source, observation)) {
      throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RESERVATION_SOURCE_DRIFT');
    }
  }
  return issued;
}

export function computePhase698ArchitectureRecoveryGitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!isCommit(commitSha)) return invalidBundle();
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return invalidBundle();
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null) return invalidBundle();
    entries.push(Object.freeze({ path, sha256: sha256(blob) }));
  }
  return Object.freeze({
    ok: true as const,
    sha256: sha256Phase698ArchitectureRecovery(canonicalPhase698ArchitectureRecoveryJson(entries)),
  });
}

function inspectRepository(
  repositoryRoot: string,
): Phase698ArchitectureRecoveryRepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const tracking = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const remote = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH}`,
  ]);
  const approvedSourceCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF}^{commit}`,
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
  ) {
    return null;
  }
  const bundle = computePhase698ArchitectureRecoveryGitSourceBundleSha256(root, head);
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

function sourceFromObservation(
  observation: Phase698ArchitectureRecoveryRepositoryObservation,
): Phase698ArchitectureRecoverySource | null {
  const parsed = PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.safeParse({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_VERSION,
    branch: observation.branch,
    commit: observation.head,
    trackingCommit: observation.tracking,
    remoteCommit: observation.remote,
    approvedSourceRef: PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF,
    approvedSourceCommit: observation.approvedSourceCommit,
    admissionAuthority: 'git_verified',
    workingTreeClean: observation.workingTreeClean,
    formalArtifactCount: observation.formalArtifactCount,
    sourceBundleSha256: observation.sourceBundleSha256,
    identities: { ...PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES },
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function sourceMatchesObservation(
  source: Phase698ArchitectureRecoverySource,
  observation: Phase698ArchitectureRecoveryRepositoryObservation,
) {
  try {
    return (
      source.admissionAuthority === 'git_verified' &&
      source.branch === PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH &&
      observation.branch === PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH &&
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

function syntheticSource(): Phase698ArchitectureRecoverySource {
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.parse({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_VERSION,
    branch: PHASE_6_9_8_ARCHITECTURE_RECOVERY_BRANCH,
    commit: ZERO_COMMIT,
    trackingCommit: ZERO_COMMIT,
    remoteCommit: ZERO_COMMIT,
    approvedSourceRef: PHASE_6_9_8_ARCHITECTURE_RECOVERY_APPROVED_SOURCE_REF,
    approvedSourceCommit: ZERO_COMMIT,
    admissionAuthority: 'synthetic_fixture',
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    identities: { ...PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_IDENTITIES },
  });
}

function issuePairResult(
  authority: IssuedAdmission['authority'],
  source: Phase698ArchitectureRecoverySource,
) {
  return Object.freeze({ ok: true as const, source, ...issuePair(authority, source) });
}

function issuePair(
  authority: IssuedAdmission['authority'],
  source: Phase698ArchitectureRecoverySource,
) {
  const issued = Object.freeze({ authority, source });
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-architecture-recovery-admission-capability-v1' as const,
  });
  const reservationCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-architecture-recovery-reservation-admission-capability-v1' as const,
  });
  issuedAdmissions.set(capability, issued);
  issuedReservations.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function countFormalArtifacts(root: string) {
  try {
    const entries = readdirSync(resolve(root, '.tmp'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && FORMAL_RECOVERY_FILE.test(entry.name))
      .length;
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

function runGitText(root: string, args: readonly string[], trim = true): string | null {
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

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isCommit(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function invalidAdmission() {
  return Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
}

function invalidBundle() {
  return Object.freeze({ ok: false as const, reasonCode: 'source_bundle_invalid' as const });
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
