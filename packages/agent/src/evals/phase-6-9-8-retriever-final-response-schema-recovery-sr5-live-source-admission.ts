import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION,
  admitPhase698RetrieverSchemaRecoverySr5ZeroProvider,
  createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput,
  type Phase698RetrieverSchemaRecoverySr5AdmissionRecord,
  type Phase698RetrieverSchemaRecoverySr5Source,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import {
  assertPhase698RetrieverSchemaRecoverySr5SourceStillMatchesForLive,
  computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256,
  inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission,
  phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
  createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  type Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-manifest.ts';

const LIVE_FORMAL_BASENAME =
  /^phase-6-9-8-retriever-final-response-schema-recovery-sr5-live(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|json)|-[0-9a-f-]{36}\.report\.json\.tmp\.[0-9a-f-]{36})$/u;

export type Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-admission-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5LiveReservationCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-reservation-capability-v1';
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord = Readonly<{
  authority: 'git_verified_live' | 'synthetic_test_live';
  externalProviderDispatchAllowed: boolean;
  credentialReadsPlanned: 0 | 3;
  source: Phase698RetrieverSchemaRecoverySr5Source;
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding;
  boundaryAdmission: Phase698RetrieverSchemaRecoverySr5AdmissionRecord;
}>;

type IssuedLiveAdmission = Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord;

const issuedAdmissions = new WeakMap<object, IssuedLiveAdmission>();
const issuedReservations = new WeakMap<object, IssuedLiveAdmission>();
const consumedAdmissions = new WeakSet<object>();
const consumedReservations = new WeakSet<object>();

export function admitPhase698RetrieverSchemaRecoverySr5ControlledLive(input: Readonly<{
  repositoryRoot: string;
  dataBoundaryConfirmation: unknown;
  authorizationConfirmation: unknown;
}>):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr5Source;
      admission: Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord;
      capability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability;
      reservationCapability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: string }> {
  if (
    typeof input?.repositoryRoot !== 'string' ||
    input.repositoryRoot.length === 0 ||
    input.dataBoundaryConfirmation !==
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION ||
    input.authorizationConfirmation !==
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION
  ) {
    return invalid('live_authorization_invalid');
  }
  const formal = scanPhase698RetrieverSchemaRecoverySr5LiveFormalPaths(input.repositoryRoot);
  if (formal === null || formal.length !== 0) return invalid('live_formal_evidence_present');
  const sourceResult = inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission(input.repositoryRoot, {
    allowHistoricalLineage: true,
  });
  if (!sourceResult.ok) return invalid('source_admission_invalid');
  const source = sourceResult.source;
  const liveBundle = computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256(
    input.repositoryRoot,
    source.head,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
  );
  if (!liveBundle.ok) return invalid('live_source_bundle_invalid');
  const sourceBinding = createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding(
    source.head,
    liveBundle.sha256,
  );
  const admitted = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
    source,
    dataBoundary: {
      accepted: true,
      confirmation: input.dataBoundaryConfirmation,
      providers: ['deepseek', 'qwen'],
      scope: 'current_account',
    },
    authorization: {
      confirmation: input.authorizationConfirmation,
      lineage: source.lineage,
      sourceBranch: source.branch,
      sourceCommit: source.head,
      sourceBundleSha256: source.sourceBundleSha256,
      approvedTag: source.approvedTag.name,
      approvedTagObjectId: source.approvedTag.objectId,
      invocation: 'once',
    },
    budget: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
  });
  if (!admitted.ok) return invalid(admitted.code);
  const issued = deepFreeze({
    authority: 'git_verified_live' as const,
    externalProviderDispatchAllowed: true as const,
    credentialReadsPlanned: 3 as const,
    source,
    sourceBinding,
    boundaryAdmission: admitted.admission,
  });
  const pair = issuePair(issued);
  return Object.freeze({
    ok: true as const,
    source,
    admission: issued,
    ...pair,
  });
}

/** Synthetic-only capability used by zero-provider runner and durability tests. */
export function createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest(
  source: Phase698RetrieverSchemaRecoverySr5Source =
    phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture(),
) {
  const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput(
    source.head,
    source.sourceBundleSha256,
    source.approvedTag.objectId,
  );
  const admitted = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(input);
  if (!admitted.ok) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_ADMISSION_INVALID');
  }
  const issued = deepFreeze({
    authority: 'synthetic_test_live' as const,
    externalProviderDispatchAllowed: false as const,
    credentialReadsPlanned: 0 as const,
    source,
    sourceBinding: createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding(
      source.head,
      source.sourceBundleSha256,
    ),
    boundaryAdmission: admitted.admission,
  });
  return Object.freeze({ source, admission: issued, ...issuePair(issued) });
}

export function consumePhase698RetrieverSchemaRecoverySr5LiveAdmissionCapability(
  capability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
  expectedAuthority: IssuedLiveAdmission['authority'],
  repositoryRoot: string,
): IssuedLiveAdmission {
  const issued = consumeCapability(
    capability,
    expectedAuthority,
    issuedAdmissions,
    consumedAdmissions,
    'ADMISSION',
  );
  if (issued.authority === 'git_verified_live') {
    assertLiveSourceStillMatches(issued.source, issued.sourceBinding, repositoryRoot);
  }
  return issued;
}

export function consumePhase698RetrieverSchemaRecoverySr5LiveReservationCapability(
  capability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability,
  expectedAuthority: IssuedLiveAdmission['authority'],
  repositoryRoot: string,
): IssuedLiveAdmission {
  const issued = consumeCapability(
    capability,
    expectedAuthority,
    issuedReservations,
    consumedReservations,
    'RESERVATION',
  );
  if (issued.authority === 'git_verified_live') {
    const formal = scanPhase698RetrieverSchemaRecoverySr5LiveFormalPaths(repositoryRoot);
    if (formal === null || formal.length !== 0) {
      throw new Error(
        'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RESERVATION_CAPABILITY_INVALID',
      );
    }
    assertLiveSourceStillMatches(issued.source, issued.sourceBinding, repositoryRoot);
  }
  return issued;
}

export function scanPhase698RetrieverSchemaRecoverySr5LiveFormalPaths(
  repositoryRoot: string,
): readonly string[] | null {
  try {
    const root = resolve(repositoryRoot);
    const output: string[] = [];
    try {
      for (const entry of readdirSync(resolve(root, '.tmp'), { withFileTypes: true })) {
        if (LIVE_FORMAL_BASENAME.test(entry.name)) output.push(`.tmp/${entry.name}`);
      }
    } catch (error) {
      if (!isErrorCode(error, 'ENOENT')) return null;
    }
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (LIVE_FORMAL_BASENAME.test(entry.name)) output.push(entry.name);
    }
    return Object.freeze(output.sort());
  } catch {
    return null;
  }
}

export function isPhase698RetrieverSchemaRecoverySr5LiveFormalRelativePath(path: string): boolean {
  return LIVE_FORMAL_BASENAME.test(path.replace(/^\.tmp\//u, ''));
}

function issuePair(issued: IssuedLiveAdmission) {
  const capability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-admission-capability-v1' as const,
  });
  const reservationCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-reservation-capability-v1' as const,
  });
  issuedAdmissions.set(capability, issued);
  issuedReservations.set(reservationCapability, issued);
  return Object.freeze({ capability, reservationCapability });
}

function consumeCapability<T extends object>(
  capability: T,
  expectedAuthority: IssuedLiveAdmission['authority'],
  registry: WeakMap<object, IssuedLiveAdmission>,
  consumed: WeakSet<object>,
  label: string,
) {
  if (!isObject(capability) || consumed.has(capability)) {
    throw new Error(`PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_${label}_CAPABILITY_INVALID`);
  }
  const issued = registry.get(capability);
  if (!issued || issued.authority !== expectedAuthority) {
    throw new Error(`PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_${label}_CAPABILITY_INVALID`);
  }
  consumed.add(capability);
  return issued;
}

function assertLiveSourceStillMatches(
  source: Phase698RetrieverSchemaRecoverySr5Source,
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  repositoryRoot: string,
) {
  assertPhase698RetrieverSchemaRecoverySr5SourceStillMatchesForLive(source, repositoryRoot);
  if (sourceBinding.sourceCommit !== source.head) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
  const bundle = computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256(
    repositoryRoot,
    source.head,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
  );
  if (
    !bundle.ok ||
    bundle.sha256 !== sourceBinding.sourceBundleSha256 ||
    sourceBinding.sourceManifestSha256 !==
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
}

function invalid(reasonCode: string) {
  return Object.freeze({ ok: false as const, reasonCode });
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
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
