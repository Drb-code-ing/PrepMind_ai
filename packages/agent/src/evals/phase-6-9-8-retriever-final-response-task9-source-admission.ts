import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_TASK9_APPROVED_SOURCE_REF,
  PHASE_6_9_8_TASK9_BRANCH,
  PHASE_6_9_8_TASK9_SOURCE_IDENTITIES,
  PHASE_6_9_8_TASK9_SOURCE_SCHEMA,
  canonicalPhase698Task9Json,
  sha256Phase698Task9,
  type Phase698Task9Source,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const ZERO_COMMIT = '0000000000000000000000000000000000000000';
const FORMAL_TASK9_FILE =
  /^phase-6-9-8-retriever-final-response-task9c-(?:controlled-live\.marker|controlled-live-[0-9a-f-]{36}\.(?:journal\.jsonl|recovery\.claim)|branch-controlled-live-[0-9a-f-]{36}\.json)$/u;

export const PHASE_6_9_8_TASK9_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-task9-cli.ts',
  'packages/agent/scripts/validate-phase-6-9-8-retriever-final-response-task9-evidence.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-durability.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-live.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-reviewed-mock.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-runner.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-manifest.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-mock-responder.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-static.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-baseline.ts',
  'packages/agent/src/model-candidates/retriever-query-rewrite-model-candidate.ts',
  'packages/agent/src/nodes/evidence-projector.ts',
  'packages/agent/src/nodes/final-response.ts',
  'packages/agent/src/nodes/retriever.ts',
  'packages/ai/package.json',
  'packages/ai/src/final-response-stream-provider.ts',
  'packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts',
  'packages/ai/src/qwen-text-embedding-v4-provider.ts',
]);

export type Phase698Task9RepositoryObservation = Readonly<{
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

export type Phase698Task9AdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-task9-admission-capability-v1';
}>;

export type Phase698Task9ReservationAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1';
}>;

type IssuedAdmission = Readonly<{
  authority: 'controlled_live' | 'synthetic_test';
  source: Phase698Task9Source;
}>;

const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();
const issuedReservationAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedReservationAdmissions = new WeakSet<object>();

export function inspectPhase698Task9SourceAdmission(repositoryRoot: string):
  | Readonly<{
      ok: true;
      source: Phase698Task9Source;
      capability: Phase698Task9AdmissionCapability;
      reservationCapability: Phase698Task9ReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null) return invalidAdmission();
  const source = sourceFromObservation(observation);
  if (source === null || !sourceMatchesObservation(source, observation)) return invalidAdmission();
  const capabilities = issueAdmissionPair('controlled_live', source);
  return Object.freeze({
    ok: true as const,
    source,
    ...capabilities,
  });
}

export function validatePhase698Task9SourceAdmission(
  input: unknown,
  repositoryRoot: string,
):
  | Readonly<{
      ok: true;
      source: Phase698Task9Source;
      capability: Phase698Task9AdmissionCapability;
      reservationCapability: Phase698Task9ReservationAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const parsed = PHASE_6_9_8_TASK9_SOURCE_SCHEMA.safeParse(input);
  if (!parsed.success || parsed.data.admissionAuthority !== 'git_verified') {
    return invalidAdmission();
  }
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !sourceMatchesObservation(parsed.data, observation)) {
    return invalidAdmission();
  }
  const source = deepFreeze(parsed.data);
  const capabilities = issueAdmissionPair('controlled_live', source);
  return Object.freeze({
    ok: true as const,
    source,
    ...capabilities,
  });
}

/** Pure comparison seam. It cannot issue a controlled-Live capability. */
export function validatePhase698Task9SourceObservationForTest(
  input: unknown,
  observation: Phase698Task9RepositoryObservation,
): boolean {
  const parsed = PHASE_6_9_8_TASK9_SOURCE_SCHEMA.safeParse(input);
  return parsed.success && sourceMatchesObservation(parsed.data, observation);
}

/** Synthetic-only capability for temp-root runner/durability tests. */
export function createPhase698Task9SyntheticAdmissionForTest(
  sourceInput?: Phase698Task9Source,
): Readonly<{
  source: Phase698Task9Source;
  capability: Phase698Task9AdmissionCapability;
  reservationCapability: Phase698Task9ReservationAdmissionCapability;
}> {
  const source = PHASE_6_9_8_TASK9_SOURCE_SCHEMA.parse(sourceInput ?? syntheticSourceFixture());
  if (source.admissionAuthority !== 'synthetic_fixture') {
    throw new Error('PHASE_6_9_8_TASK9_SYNTHETIC_ADMISSION_INVALID');
  }
  const capabilities = issueAdmissionPair('synthetic_test', source);
  return Object.freeze({
    source,
    ...capabilities,
  });
}

export function consumePhase698Task9AdmissionCapability(
  capability: Phase698Task9AdmissionCapability,
  expectedAuthority: 'controlled_live' | 'synthetic_test',
): IssuedAdmission {
  if (
    (typeof capability !== 'object' && typeof capability !== 'function') ||
    capability === null ||
    capability.version !== 'phase-6.9.8-retriever-final-response-task9-admission-capability-v1' ||
    consumedAdmissions.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_TASK9_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = issuedAdmissions.get(capability);
  if (!issued || issued.authority !== expectedAuthority) {
    throw new Error('PHASE_6_9_8_TASK9_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698Task9ReservationAdmissionCapability(
  capability: Phase698Task9ReservationAdmissionCapability,
  repositoryRoot: string,
): IssuedAdmission {
  if (
    (typeof capability !== 'object' && typeof capability !== 'function') ||
    capability === null ||
    capability.version !==
      'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1' ||
    consumedReservationAdmissions.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_TASK9_RESERVATION_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = issuedReservationAdmissions.get(capability);
  if (!issued) {
    throw new Error('PHASE_6_9_8_TASK9_RESERVATION_ADMISSION_CAPABILITY_INVALID');
  }
  consumedReservationAdmissions.add(capability);
  if (issued.authority === 'controlled_live') {
    const observation = inspectRepository(repositoryRoot);
    if (observation === null || !sourceMatchesObservation(issued.source, observation)) {
      throw new Error('PHASE_6_9_8_TASK9_RESERVATION_SOURCE_DRIFT');
    }
  }
  return issued;
}

export function computePhase698Task9GitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!isCommit(commitSha)) return invalidBundle();
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return invalidBundle();
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_TASK9_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null) return invalidBundle();
    entries.push(Object.freeze({ path, sha256: sha256(blob) }));
  }
  return Object.freeze({
    ok: true as const,
    sha256: sha256Phase698Task9(canonicalPhase698Task9Json(entries)),
  });
}

function inspectRepository(repositoryRoot: string): Phase698Task9RepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const tracking = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const remote = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_TASK9_BRANCH}`,
  ]);
  const approvedSourceCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_TASK9_APPROVED_SOURCE_REF}^{commit}`,
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
  const bundle = computePhase698Task9GitSourceBundleSha256(root, head);
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
  observation: Phase698Task9RepositoryObservation,
): Phase698Task9Source | null {
  const parsed = PHASE_6_9_8_TASK9_SOURCE_SCHEMA.safeParse({
    version: 'phase-6.9.8-retriever-final-response-task9-source-v1',
    branch: observation.branch,
    commit: observation.head,
    trackingCommit: observation.tracking,
    remoteCommit: observation.remote,
    approvedSourceRef: PHASE_6_9_8_TASK9_APPROVED_SOURCE_REF,
    approvedSourceCommit: observation.approvedSourceCommit,
    admissionAuthority: 'git_verified',
    workingTreeClean: observation.workingTreeClean,
    formalArtifactCount: observation.formalArtifactCount,
    sourceBundleSha256: observation.sourceBundleSha256,
    identities: sourceIdentities(),
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function sourceMatchesObservation(
  source: Phase698Task9Source,
  observation: Phase698Task9RepositoryObservation,
) {
  try {
    return (
      source.admissionAuthority === 'git_verified' &&
      source.branch === PHASE_6_9_8_TASK9_BRANCH &&
      observation.branch === PHASE_6_9_8_TASK9_BRANCH &&
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

function syntheticSourceFixture(): Phase698Task9Source {
  return PHASE_6_9_8_TASK9_SOURCE_SCHEMA.parse({
    version: 'phase-6.9.8-retriever-final-response-task9-source-v1',
    branch: PHASE_6_9_8_TASK9_BRANCH,
    commit: ZERO_COMMIT,
    trackingCommit: ZERO_COMMIT,
    remoteCommit: ZERO_COMMIT,
    approvedSourceRef: PHASE_6_9_8_TASK9_APPROVED_SOURCE_REF,
    approvedSourceCommit: ZERO_COMMIT,
    admissionAuthority: 'synthetic_fixture',
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    identities: sourceIdentities(),
  });
}

function sourceIdentities() {
  return { ...PHASE_6_9_8_TASK9_SOURCE_IDENTITIES };
}

function issueAdmission(
  authority: IssuedAdmission['authority'],
  source: Phase698Task9Source,
): Phase698Task9AdmissionCapability {
  const capability = Object.freeze({
    version: 'phase-6.9.8-retriever-final-response-task9-admission-capability-v1' as const,
  });
  issuedAdmissions.set(capability, Object.freeze({ authority, source }));
  return capability;
}

function issueReservationAdmission(
  authority: IssuedAdmission['authority'],
  source: Phase698Task9Source,
) {
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1' as const,
  });
  issuedReservationAdmissions.set(capability, Object.freeze({ authority, source }));
  return capability;
}

function issueAdmissionPair(authority: IssuedAdmission['authority'], source: Phase698Task9Source) {
  return Object.freeze({
    capability: issueAdmission(authority, source),
    reservationCapability: issueReservationAdmission(authority, source),
  });
}

function countFormalArtifacts(root: string) {
  try {
    const entries = readdirSync(resolve(root, '.tmp'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && FORMAL_TASK9_FILE.test(entry.name)).length;
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
