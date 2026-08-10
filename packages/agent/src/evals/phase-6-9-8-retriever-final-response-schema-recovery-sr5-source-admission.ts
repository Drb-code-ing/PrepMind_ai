import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_PATHS,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_VERSION,
  canonicalPhase698RetrieverSchemaRecoverySr5Json,
  admitPhase698RetrieverSchemaRecoverySr5ZeroProvider,
  type Phase698RetrieverSchemaRecoverySr5AdmissionInput,
  type Phase698RetrieverSchemaRecoverySr5AdmissionRecord,
  sha256Phase698RetrieverSchemaRecoverySr5,
  type Phase698RetrieverSchemaRecoverySr5Source,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES } from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const ZERO_COMMIT = '0'.repeat(40);
const CURRENT_FORMAL_PATH =
  /^(?:\.tmp\/)?phase-6-9-8-retriever-final-response-schema-recovery-sr5(?:-runner)?(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|artifact\.tmp|json))$/u;
const OLD_LINEAGE_PATH =
  /^(?:\.tmp\/)?(?:phase-6-9-7-[A-Za-z0-9_-]+|phase-6-9-8-retriever-final-response-(?:schema-recovery-v1|p1-[A-Za-z0-9_-]+|task9[A-Za-z0-9_-]*|architecture-recovery[A-Za-z0-9_-]*|transport-[A-Za-z0-9_-]+))(?:-[0-9a-f-]{36})?\.(?:marker|journal\.jsonl|report\.json|recovery\.claim|artifact\.tmp|json)$/u;

export type Phase698RetrieverSchemaRecoverySr5RepositoryObservation = Readonly<{
  root: string;
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  approvedTag: Readonly<{
    name: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG;
    commit: string;
    objectId: string;
    objectKind: 'tag';
  }>;
  clean: boolean;
  formalEvidencePaths: readonly string[];
  oldLineagePaths: readonly string[];
  sourceBundleSha256: string;
}>;

export type Phase698RetrieverSchemaRecoverySr5AdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-admission-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5ReservationCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-reservation-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-admission-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5BoundReservationCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-reservation-capability-v1';
}>;

type IssuedAdmission = Readonly<{
  authority: 'synthetic_test' | 'git_verified';
  source: Phase698RetrieverSchemaRecoverySr5Source;
}>;
export type Phase698RetrieverSchemaRecoverySr5IssuedBoundAdmission = Readonly<{
  authority: 'synthetic_test' | 'git_verified';
  source: Phase698RetrieverSchemaRecoverySr5Source;
  admission: Phase698RetrieverSchemaRecoverySr5AdmissionRecord;
}>;

const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();
const issuedReservations = new WeakMap<object, IssuedAdmission>();
const consumedReservations = new WeakSet<object>();
const issuedBoundAdmissions = new WeakMap<
  object,
  Phase698RetrieverSchemaRecoverySr5IssuedBoundAdmission
>();
const consumedBoundAdmissions = new WeakSet<object>();
const issuedBoundReservations = new WeakMap<
  object,
  Phase698RetrieverSchemaRecoverySr5IssuedBoundAdmission
>();
const consumedBoundReservations = new WeakSet<object>();

export function inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission(repositoryRoot: string):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr5Source;
      capability: Phase698RetrieverSchemaRecoverySr5AdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr5ReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !observation.clean || observation.formalEvidencePaths.length !== 0) {
    return invalidAdmission();
  }
  const source = sourceFromObservation(observation);
  if (source === null || !sourceMatchesObservation(source, observation)) return invalidAdmission();
  const pair = issuePair('git_verified', source);
  return Object.freeze({ ok: true as const, source, ...pair });
}

/**
 * Validate a supplied snapshot against the live repository.  This is the only
 * path allowed to issue a git-verified capability; callers cannot mint one by
 * supplying a frozen SHA or a forged authorization object.
 */
export function validatePhase698RetrieverSchemaRecoverySr5SourceAdmission(
  input: unknown,
  repositoryRoot: string,
):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr5Source;
      capability: Phase698RetrieverSchemaRecoverySr5AdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr5ReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.safeParse(input);
  if (!parsed.success) return invalidAdmission();
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !sourceMatchesObservation(parsed.data, observation)) {
    return invalidAdmission();
  }
  const source = deepFreeze(parsed.data);
  const pair = issuePair('git_verified', source);
  return Object.freeze({ ok: true as const, source, ...pair });
}

/**
 * Compose the live Git source gate with the zero-provider boundary contract.
 * This is the only production-shaped path that can issue a bound admission
 * capability. It still cannot read credentials or dispatch a Provider.
 */
export function admitPhase698RetrieverSchemaRecoverySr5SourceBoundZeroProvider(
  input: Readonly<Omit<Phase698RetrieverSchemaRecoverySr5AdmissionInput, 'source'>>,
  repositoryRoot: string,
):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr5Source;
      admission: Phase698RetrieverSchemaRecoverySr5AdmissionRecord;
      capability: Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr5BoundReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: string }> {
  const sourceResult = inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission(repositoryRoot);
  if (!sourceResult.ok) return invalidAdmission();
  const admissionResult = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
    source: sourceResult.source,
    dataBoundary: input.dataBoundary,
    authorization: input.authorization,
    budget: input.budget,
  });
  if (!admissionResult.ok)
    return Object.freeze({ ok: false as const, reasonCode: admissionResult.code });
  const pair = issueBoundPair('git_verified', sourceResult.source, admissionResult.admission);
  return Object.freeze({
    ok: true as const,
    source: sourceResult.source,
    admission: admissionResult.admission,
    ...pair,
  });
}

/** Synthetic-only composition seam for runner and contract tests. */
export function createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(
  input: Phase698RetrieverSchemaRecoverySr5AdmissionInput,
): Readonly<{
  source: Phase698RetrieverSchemaRecoverySr5Source;
  admission: Phase698RetrieverSchemaRecoverySr5AdmissionRecord;
  capability: Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability;
  reservationCapability: Phase698RetrieverSchemaRecoverySr5BoundReservationCapability;
}> {
  const source = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.parse(input.source);
  const admissionResult = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(input);
  if (!admissionResult.ok) {
    throw new Error(
      `PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_${admissionResult.code.toUpperCase()}`,
    );
  }
  const pair = issueBoundPair('synthetic_test', source, admissionResult.admission);
  return Object.freeze({ source, admission: admissionResult.admission, ...pair });
}

export function consumePhase698RetrieverSchemaRecoverySr5BoundAdmissionCapability(
  capability: Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability,
  expectedAuthority: 'synthetic_test' | 'git_verified',
  repositoryRoot: string,
): Phase698RetrieverSchemaRecoverySr5IssuedBoundAdmission {
  if (!isObject(capability) || consumedBoundAdmissions.has(capability)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BOUND_ADMISSION_CAPABILITY_INVALID');
  }
  const version = readOwnDataProperty(capability, 'version');
  const issued = issuedBoundAdmissions.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-admission-capability-v1' ||
    !issued ||
    issued.authority !== expectedAuthority
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BOUND_ADMISSION_CAPABILITY_INVALID');
  }
  consumedBoundAdmissions.add(capability);
  if (issued.authority === 'git_verified') assertSourceStillMatches(issued.source, repositoryRoot);
  return issued;
}

export function consumePhase698RetrieverSchemaRecoverySr5BoundReservationCapability(
  capability: Phase698RetrieverSchemaRecoverySr5BoundReservationCapability,
  repositoryRoot: string,
): Phase698RetrieverSchemaRecoverySr5IssuedBoundAdmission {
  if (!isObject(capability) || consumedBoundReservations.has(capability)) {
    throw new Error(
      'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BOUND_RESERVATION_CAPABILITY_INVALID',
    );
  }
  const version = readOwnDataProperty(capability, 'version');
  const issued = issuedBoundReservations.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-reservation-capability-v1' ||
    !issued
  ) {
    throw new Error(
      'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BOUND_RESERVATION_CAPABILITY_INVALID',
    );
  }
  consumedBoundReservations.add(capability);
  if (issued.authority === 'git_verified') assertSourceStillMatches(issued.source, repositoryRoot);
  return issued;
}

/** Pure comparison seam for zero-provider tests; never issues a capability. */
export function validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(
  input: unknown,
  observation: Phase698RetrieverSchemaRecoverySr5RepositoryObservation,
): boolean {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.safeParse(input);
  return parsed.success && sourceMatchesObservation(parsed.data, observation);
}

/** Synthetic-only source/capability seam. It cannot be used by a live runner. */
export function createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionForTest(
  sourceInput?: Phase698RetrieverSchemaRecoverySr5Source,
): Readonly<{
  source: Phase698RetrieverSchemaRecoverySr5Source;
  capability: Phase698RetrieverSchemaRecoverySr5AdmissionCapability;
  reservationCapability: Phase698RetrieverSchemaRecoverySr5ReservationCapability;
}> {
  const source = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.parse(
    sourceInput ?? phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture(),
  );
  const pair = issuePair('synthetic_test', source);
  return Object.freeze({ source, ...pair });
}

export function consumePhase698RetrieverSchemaRecoverySr5AdmissionCapability(
  capability: Phase698RetrieverSchemaRecoverySr5AdmissionCapability,
  expectedAuthority: 'synthetic_test' | 'git_verified',
): IssuedAdmission {
  if (!isObject(capability) || consumedAdmissions.has(capability)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_CAPABILITY_INVALID');
  }
  const version = readOwnDataProperty(capability, 'version');
  const issued = issuedAdmissions.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-admission-capability-v1' ||
    !issued ||
    issued.authority !== expectedAuthority
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698RetrieverSchemaRecoverySr5ReservationCapability(
  capability: Phase698RetrieverSchemaRecoverySr5ReservationCapability,
  repositoryRoot: string,
): IssuedAdmission {
  if (!isObject(capability) || consumedReservations.has(capability)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RESERVATION_CAPABILITY_INVALID');
  }
  const version = readOwnDataProperty(capability, 'version');
  const issued = issuedReservations.get(capability);
  if (
    version !==
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-reservation-capability-v1' ||
    !issued
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RESERVATION_CAPABILITY_INVALID');
  }
  consumedReservations.add(capability);
  if (issued.authority === 'git_verified') {
    const observation = inspectRepository(repositoryRoot);
    if (observation === null || !sourceMatchesObservation(issued.source, observation)) {
      throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_DRIFT');
    }
  }
  return issued;
}

export function computePhase698RetrieverSchemaRecoverySr5GitSourceBundleSha256(
  repositoryRoot: string,
  commitSha: string,
):
  | Readonly<{ ok: true; sha256: string }>
  | Readonly<{ ok: false; reasonCode: 'source_bundle_invalid' }> {
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) return { ok: false, reasonCode: 'source_bundle_invalid' };
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return { ok: false, reasonCode: 'source_bundle_invalid' };
  const entries: Array<Readonly<{ path: string; sha256: string }>> = [];
  for (const path of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_PATHS) {
    const blob = runGitBuffer(root, ['cat-file', 'blob', `${commitSha}:${path}`]);
    if (blob === null) return { ok: false, reasonCode: 'source_bundle_invalid' };
    entries.push(Object.freeze({ path, sha256: sha256Phase698RetrieverSchemaRecoverySr5(blob) }));
  }
  return Object.freeze({
    ok: true as const,
    sha256: `sha256:${sha256Phase698RetrieverSchemaRecoverySr5(
      canonicalPhase698RetrieverSchemaRecoverySr5Json(entries),
    )}`,
  });
}

export function phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture(
  commit = ZERO_COMMIT,
  sourceBundleSha256 = `sha256:${'0'.repeat(64)}`,
): Phase698RetrieverSchemaRecoverySr5Source {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.parse({
    schemaVersion: `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_VERSION}-source`,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LINEAGE,
    mode: 'controlled_live',
    branch: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_BRANCH,
    head: commit,
    upstream: commit,
    origin: commit,
    approvedTag: {
      name: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG,
      commit,
      objectId: 'b'.repeat(40),
      objectKind: 'tag' as const,
    },
    clean: true,
    formalEvidencePaths: [],
    oldLineagePaths: [],
    sourceBundleSha256,
    admissionManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    identities: {
      sr3ManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3ManifestSha256,
      sr3PolicySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3PolicySha256,
      sr4FactorySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
      sr4CheckpointSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
    },
  });
}

function inspectRepository(
  repositoryRoot: string,
): Phase698RetrieverSchemaRecoverySr5RepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const upstream = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const origin = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_BRANCH}`,
  ]);
  const approvedTagCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF}^{commit}`,
  ]);
  const approvedTagObjectId = runGitText(root, [
    'rev-parse',
    '--verify',
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
  ]);
  const approvedTagObject = runGitText(root, [
    'cat-file',
    '-t',
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
  ]);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  if (
    branch === null ||
    head === null ||
    upstream === null ||
    origin === null ||
    approvedTagCommit === null ||
    approvedTagObjectId === null ||
    approvedTagObject === null ||
    approvedTagObject !== 'tag' ||
    status === null ||
    ![head, upstream, origin, approvedTagCommit, approvedTagObjectId].every((value) =>
      /^[0-9a-f]{40}$/u.test(value),
    )
  ) {
    return null;
  }
  const bundle = computePhase698RetrieverSchemaRecoverySr5GitSourceBundleSha256(root, head);
  if (!bundle.ok) return null;
  const paths = scanFormalPaths(root);
  if (paths === null) return null;
  return Object.freeze({
    root,
    branch,
    head,
    upstream,
    origin,
    approvedTag: {
      name: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG,
      commit: approvedTagCommit,
      objectId: approvedTagObjectId,
      objectKind: 'tag' as const,
    },
    clean: status.length === 0,
    formalEvidencePaths: paths.formal,
    oldLineagePaths: paths.old,
    sourceBundleSha256: bundle.sha256,
  });
}

function sourceFromObservation(
  observation: Phase698RetrieverSchemaRecoverySr5RepositoryObservation,
): Phase698RetrieverSchemaRecoverySr5Source | null {
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.safeParse({
    schemaVersion: `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_VERSION}-source`,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LINEAGE,
    mode: 'controlled_live',
    branch: observation.branch,
    head: observation.head,
    upstream: observation.upstream,
    origin: observation.origin,
    approvedTag: observation.approvedTag,
    clean: observation.clean,
    formalEvidencePaths: observation.formalEvidencePaths,
    oldLineagePaths: observation.oldLineagePaths,
    sourceBundleSha256: observation.sourceBundleSha256,
    admissionManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    identities: {
      sr3ManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3ManifestSha256,
      sr3PolicySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3PolicySha256,
      sr4FactorySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
      sr4CheckpointSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
    },
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

function sourceMatchesObservation(
  source: Phase698RetrieverSchemaRecoverySr5Source,
  observation: Phase698RetrieverSchemaRecoverySr5RepositoryObservation,
): boolean {
  try {
    return (
      source.mode === 'controlled_live' &&
      source.branch === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_BRANCH &&
      observation.branch === source.branch &&
      source.head === observation.head &&
      source.upstream === observation.upstream &&
      source.origin === observation.origin &&
      source.approvedTag.commit === observation.approvedTag.commit &&
      source.approvedTag.objectId === observation.approvedTag.objectId &&
      source.approvedTag.objectKind === observation.approvedTag.objectKind &&
      source.clean === observation.clean &&
      source.formalEvidencePaths.length === observation.formalEvidencePaths.length &&
      source.formalEvidencePaths.every(
        (value, index) => value === observation.formalEvidencePaths[index],
      ) &&
      source.oldLineagePaths.length === observation.oldLineagePaths.length &&
      source.oldLineagePaths.every(
        (value, index) => value === observation.oldLineagePaths[index],
      ) &&
      source.sourceBundleSha256 === observation.sourceBundleSha256 &&
      source.head === source.upstream &&
      source.head === source.origin &&
      source.head === source.approvedTag.commit &&
      observation.formalEvidencePaths.length === 0 &&
      observation.oldLineagePaths.length === 0 &&
      source.clean
    );
  } catch {
    return false;
  }
}

function issuePair(
  authority: IssuedAdmission['authority'],
  source: Phase698RetrieverSchemaRecoverySr5Source,
) {
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-admission-capability-v1' as const,
  });
  const reservationCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-reservation-capability-v1' as const,
  });
  const issued = Object.freeze({ authority, source });
  issuedAdmissions.set(capability, issued);
  issuedReservations.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function issueBoundPair(
  authority: IssuedAdmission['authority'],
  source: Phase698RetrieverSchemaRecoverySr5Source,
  admission: Phase698RetrieverSchemaRecoverySr5AdmissionRecord,
) {
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-admission-capability-v1' as const,
  });
  const reservationCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-bound-reservation-capability-v1' as const,
  });
  const issued = Object.freeze({ authority, source, admission });
  issuedBoundAdmissions.set(capability, issued);
  issuedBoundReservations.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function assertSourceStillMatches(
  source: Phase698RetrieverSchemaRecoverySr5Source,
  repositoryRoot: string,
): void {
  const observation = inspectRepository(repositoryRoot);
  if (observation === null || !sourceMatchesObservation(source, observation)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_SOURCE_DRIFT');
  }
}

function scanFormalPaths(
  root: string,
): Readonly<{ formal: readonly string[]; old: readonly string[] }> | null {
  const formal: string[] = [];
  const old: string[] = [];
  try {
    for (const entry of readdirSync(resolve(root, '.tmp'), { withFileTypes: true })) {
      const relative = `.tmp/${entry.name}`;
      if (CURRENT_FORMAL_PATH.test(relative)) formal.push(relative);
      else if (OLD_LINEAGE_PATH.test(relative)) old.push(relative);
    }
  } catch (error) {
    if (!isErrorCode(error, 'ENOENT')) return null;
  }
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (CURRENT_FORMAL_PATH.test(entry.name)) formal.push(entry.name);
      else if (OLD_LINEAGE_PATH.test(entry.name)) old.push(entry.name);
    }
  } catch {
    return null;
  }
  return Object.freeze({ formal: formal.sort(), old: old.sort() });
}

function resolveTrustedGitRoot(repositoryRoot: string): string | null {
  try {
    if (
      typeof repositoryRoot !== 'string' ||
      repositoryRoot.length === 0 ||
      repositoryRoot.includes('\0')
    ) {
      return null;
    }
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

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readOwnDataProperty(value: object, key: string): unknown {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function normalizePath(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function invalidAdmission() {
  return Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
