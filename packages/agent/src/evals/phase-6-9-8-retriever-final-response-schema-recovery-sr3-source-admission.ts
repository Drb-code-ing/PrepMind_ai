import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_VERSION,
  canonicalPhase698RetrieverSchemaRecoverySr3Json,
  sha256Phase698RetrieverSchemaRecoverySr3,
  type Phase698RetrieverSchemaRecoverySr3Source,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const ZERO_COMMIT = '0000000000000000000000000000000000000000';
const FORMAL_BASENAME =
  /^phase-6-9-8-retriever-final-response-schema-recovery-v1(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|json))$/u;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/src/index.ts',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr3-cli.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-durability.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-runner.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-manifest.ts',
  'packages/agent/src/model-candidates/retriever-query-rewrite-model-candidate.ts',
  'packages/agent/src/model-candidates/retriever-schema-recovery-contract.ts',
  'packages/agent/src/model-candidates/retriever-schema-recovery.ts',
  'packages/agent/src/nodes/evidence-projector.ts',
  'packages/agent/src/nodes/final-response.ts',
  'packages/agent/src/nodes/retriever.ts',
  'packages/ai/src/model-agent-structured-output-policy.ts',
]);

export type Phase698RetrieverSchemaRecoverySr3RepositoryObservation = Readonly<{
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

export type Phase698RetrieverSchemaRecoverySr3AdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr3-admission-capability-v1';
}>;

export type Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr3-reservation-admission-capability-v1';
}>;

type IssuedAdmission = Readonly<{
  authority: 'synthetic_test' | 'git_verified';
  source: Phase698RetrieverSchemaRecoverySr3Source;
}>;

const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();
const issuedReservationAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedReservationAdmissions = new WeakSet<object>();

export function inspectPhase698RetrieverSchemaRecoverySr3SourceAdmission(repositoryRoot: string):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr3Source;
      capability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null) return invalidAdmission();
  const source = sourceFromObservation(observation);
  if (source === null || !sourceMatchesObservation(source, observation)) return invalidAdmission();
  const capabilities = issuePair('git_verified', source);
  return Object.freeze({ ok: true as const, source, ...capabilities });
}

export function validatePhase698RetrieverSchemaRecoverySr3SourceAdmission(
  input: unknown,
  repositoryRoot: string,
):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr3Source;
      capability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.safeParse(input);
  if (!parsed.success || parsed.data.admissionAuthority !== 'git_verified') {
    return invalidAdmission();
  }
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !sourceMatchesObservation(parsed.data, observation)) {
    return invalidAdmission();
  }
  const source = deepFreeze(parsed.data);
  return Object.freeze({ ok: true as const, source, ...issuePair('git_verified', source) });
}

/** Pure source comparison seam; it cannot issue a Git-verified capability. */
export function validatePhase698RetrieverSchemaRecoverySr3ObservationForTest(
  input: unknown,
  observation: Phase698RetrieverSchemaRecoverySr3RepositoryObservation,
): boolean {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.safeParse(input);
  return parsed.success && sourceMatchesObservation(parsed.data, observation);
}

/** Synthetic-only admission used by SR3 temp-root tests. */
export function createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest(
  sourceInput?: Phase698RetrieverSchemaRecoverySr3Source,
): Readonly<{
  source: Phase698RetrieverSchemaRecoverySr3Source;
  capability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability;
  reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
}> {
  const source = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.parse(
    sourceInput ?? syntheticSourceFixture(),
  );
  if (source.admissionAuthority !== 'synthetic_fixture') {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SYNTHETIC_ADMISSION_INVALID');
  }
  return Object.freeze({ source, ...issuePair('synthetic_test', source) });
}

export function consumePhase698RetrieverSchemaRecoverySr3AdmissionCapability(
  capability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability,
  expectedAuthority: 'synthetic_test' | 'git_verified' | 'zero_provider',
): IssuedAdmission {
  if (!isCapabilityObject(capability) || consumedAdmissions.has(capability)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ADMISSION_CAPABILITY_INVALID');
  }
  let version: unknown;
  try {
    version = Reflect.getOwnPropertyDescriptor(capability, 'version')?.value;
  } catch {
    version = undefined;
  }
  const issued = issuedAdmissions.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr3-admission-capability-v1' ||
    !issued ||
    (expectedAuthority !== 'zero_provider' && issued.authority !== expectedAuthority)
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability(
  capability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability,
  repositoryRoot: string,
): IssuedAdmission {
  if (!isCapabilityObject(capability) || consumedReservationAdmissions.has(capability)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_RESERVATION_CAPABILITY_INVALID');
  }
  let version: unknown;
  try {
    version = Reflect.getOwnPropertyDescriptor(capability, 'version')?.value;
  } catch {
    version = undefined;
  }
  const issued = issuedReservationAdmissions.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr3-reservation-admission-capability-v1' ||
    !issued
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_RESERVATION_CAPABILITY_INVALID');
  }
  consumedReservationAdmissions.add(capability);
  if (issued.authority === 'git_verified') {
    const observation = inspectRepository(repositoryRoot);
    if (observation === null || !sourceMatchesObservation(issued.source, observation)) {
      throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_DRIFT');
    }
  }
  return issued;
}

export function computePhase698RetrieverSchemaRecoverySr3GitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!isCommit(commitSha)) return invalidBundle();
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return invalidBundle();
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null) return invalidBundle();
    entries.push(Object.freeze({ path, sha256: sha256(blob) }));
  }
  return Object.freeze({
    ok: true as const,
    sha256: sha256Phase698RetrieverSchemaRecoverySr3(
      canonicalPhase698RetrieverSchemaRecoverySr3Json(entries),
    ),
  });
}

export function phase698RetrieverSchemaRecoverySr3SyntheticSourceFixture(): Phase698RetrieverSchemaRecoverySr3Source {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.parse({
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_VERSION,
    branch: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH,
    commit: ZERO_COMMIT,
    trackingCommit: ZERO_COMMIT,
    remoteCommit: ZERO_COMMIT,
    approvedSourceRef: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF,
    approvedSourceCommit: ZERO_COMMIT,
    admissionAuthority: 'synthetic_fixture',
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    identities: { ...PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES },
  });
}

function inspectRepository(
  repositoryRoot: string,
): Phase698RetrieverSchemaRecoverySr3RepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const tracking = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const remote = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH}`,
  ]);
  const approvedSourceCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF}^{commit}`,
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
  const bundle = computePhase698RetrieverSchemaRecoverySr3GitSourceBundleSha256(root, head);
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
  observation: Phase698RetrieverSchemaRecoverySr3RepositoryObservation,
): Phase698RetrieverSchemaRecoverySr3Source | null {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA.safeParse({
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_VERSION,
    branch: observation.branch,
    commit: observation.head,
    trackingCommit: observation.tracking,
    remoteCommit: observation.remote,
    approvedSourceRef: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_APPROVED_SOURCE_REF,
    approvedSourceCommit: observation.approvedSourceCommit,
    admissionAuthority: 'git_verified',
    workingTreeClean: observation.workingTreeClean,
    formalArtifactCount: observation.formalArtifactCount,
    sourceBundleSha256: observation.sourceBundleSha256,
    identities: { ...PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES },
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function sourceMatchesObservation(
  source: Phase698RetrieverSchemaRecoverySr3Source,
  observation: Phase698RetrieverSchemaRecoverySr3RepositoryObservation,
) {
  try {
    return (
      source.admissionAuthority === 'git_verified' &&
      source.branch === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH &&
      observation.branch === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_BRANCH &&
      source.commit === observation.head &&
      source.trackingCommit === observation.tracking &&
      source.remoteCommit === observation.remote &&
      source.approvedSourceCommit === observation.approvedSourceCommit &&
      source.workingTreeClean &&
      source.workingTreeClean === observation.workingTreeClean &&
      source.formalArtifactCount === 0 &&
      source.formalArtifactCount === observation.formalArtifactCount &&
      source.sourceBundleSha256 === observation.sourceBundleSha256 &&
      source.commit === source.trackingCommit &&
      source.commit === source.remoteCommit &&
      source.commit === source.approvedSourceCommit
    );
  } catch {
    return false;
  }
}

function syntheticSourceFixture() {
  return phase698RetrieverSchemaRecoverySr3SyntheticSourceFixture();
}

function issuePair(
  authority: IssuedAdmission['authority'],
  source: Phase698RetrieverSchemaRecoverySr3Source,
) {
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr3-admission-capability-v1' as const,
  });
  const reservationCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr3-reservation-admission-capability-v1' as const,
  });
  const issued = Object.freeze({ authority, source });
  issuedAdmissions.set(capability, issued);
  issuedReservationAdmissions.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function countFormalArtifacts(root: string) {
  let count = 0;
  try {
    count += readdirSync(resolve(root, '.tmp'), { withFileTypes: true }).filter((entry) =>
      FORMAL_BASENAME.test(entry.name),
    ).length;
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) return Number.NaN;
  }
  try {
    count += readdirSync(root, { withFileTypes: true }).filter((entry) =>
      FORMAL_BASENAME.test(entry.name),
    ).length;
  } catch {
    return Number.NaN;
  }
  return count;
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
  const bytes = runGitBuffer(root, args);
  if (bytes === null) return null;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return trim ? decoded.trim() : decoded.replace(/\r?\n$/u, '');
  } catch {
    return null;
  }
}

function runGitTextUnchecked(root: string, args: readonly string[]): string | null {
  const bytes = runGitBufferUnchecked(root, args);
  if (bytes === null) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
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

function isCommit(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
}

function isCapabilityObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function normalizePath(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
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
