import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  opendirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES } from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-contract.ts';
import { computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
  createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  type Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-source-manifest.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA_VERSION,
  createPhase698RetrieverSchemaRecoverySr5LiveSyntheticSourceFixture,
  type Phase698RetrieverSchemaRecoverySr5LiveSource,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-source-schema.ts';
import {
  canonicalPhase698RetrieverSchemaRecoverySr5LiveJson,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE,
  sha256Phase698RetrieverSchemaRecoverySr5Live,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_SCHEMA } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v11-live-journal-contract.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256_REF = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const UUID = z.string().uuid();
const LIVE_FORMAL_BASENAME =
  /^phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|json)|-[0-9a-f-]{36}\.report\.json\.tmp\.[0-9a-f-]{36})$/u;

export type Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-admission-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5LiveReservationCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-reservation-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-first-dispatch-capability-v1';
}>;
export type Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit = Readonly<{
  version: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-first-dispatch-permit-v1';
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveBoundaryAdmissionRecord = Readonly<{
  schemaVersion: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-boundary-v1';
  lineage: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE;
  authority: 'controlled_live_retriever_final_response_schema_recovery_sr5';
  gate: 'sr5_live_boundary_admitted';
  qualityAuthority: 'none';
  mode: 'controlled_live';
  providerDispatchAllowed: false;
  source: Readonly<{
    branch: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH;
    head: string;
    approvedTag: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG;
    approvedTagObjectId: string;
    sourceBundleSha256: string;
    sourceManifestSha256: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256;
  }>;
  dataBoundary: Readonly<{
    accepted: true;
    providers: readonly ['deepseek', 'qwen'];
    scope: 'current_account';
    confirmationSha256: string;
  }>;
  authorization: Readonly<{
    sourceCommit: string;
    sourceBundleSha256: string;
    approvedTag: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG;
    approvedTagObjectId: string;
    invocation: 'once';
    confirmationSha256: string;
  }>;
  budget: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET;
  execution: Readonly<{
    maximumConcurrency: 1;
    pairSerial: true;
    singleDispatchPerLane: true;
    retry: false;
    resume: false;
    replay: false;
    backfill: false;
    backgroundJob: false;
    outbox: false;
  }>;
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord = Readonly<{
  authority: 'git_verified_live' | 'synthetic_test_live';
  externalProviderDispatchAllowed: boolean;
  credentialReadsPlanned: 0 | 3;
  source: Phase698RetrieverSchemaRecoverySr5LiveSource;
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding;
  boundaryAdmission: Phase698RetrieverSchemaRecoverySr5LiveBoundaryAdmissionRecord;
}>;

type IssuedLiveAdmission = Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord;
export type Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation = Readonly<{
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  approvedTag: Readonly<{
    name: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG;
    ref: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF;
    commit: string;
    objectId: string;
    objectKind: 'tag';
  }>;
  clean: boolean;
  formalEvidencePaths: readonly string[];
  sourceBundleSha256: string;
}>;

const issuedAdmissions = new WeakMap<object, IssuedLiveAdmission>();
const issuedReservations = new WeakMap<object, IssuedLiveAdmission>();
const consumedAdmissions = new WeakSet<object>();
const consumedReservations = new WeakSet<object>();
type RunBinding = { runId: string | null };
const issuedRunBindings = new WeakMap<object, RunBinding>();
type FirstDispatchBinding = Readonly<{
  admissionCapability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability;
  admission: IssuedLiveAdmission;
  repositoryRoot: string;
  runId: string;
  expectedJournalEvents: readonly RunBoundJournalEvent[];
  lease: RunBoundDispatchLease;
}>;
const issuedFirstDispatches = new WeakMap<object, FirstDispatchBinding>();
const consumedFirstDispatches = new WeakSet<object>();
const issuedFirstDispatchPermits = new WeakMap<object, FirstDispatchBinding>();
const consumedFirstDispatchPermits = new WeakSet<object>();

export function admitPhase698RetrieverSchemaRecoverySr5ControlledLive(
  input: Readonly<{
    repositoryRoot: string;
    dataBoundaryConfirmation: unknown;
    authorizationConfirmation: unknown;
  }>,
):
  | Readonly<{
      ok: true;
      source: Phase698RetrieverSchemaRecoverySr5LiveSource;
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
  const sourceResult = inspectPhase698RetrieverSchemaRecoverySr5LiveSourceAdmission(
    input.repositoryRoot,
  );
  if (!sourceResult.ok) return invalid(sourceResult.reasonCode);
  const source = sourceResult.source;
  const sourceBinding = createPhase698RetrieverSchemaRecoverySr5LiveSourceBinding(
    source.head,
    source.sourceBundleSha256,
  );
  const admitted = admitLiveBoundary(
    source,
    input.dataBoundaryConfirmation,
    input.authorizationConfirmation,
  );
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
  return Object.freeze({ ok: true as const, source, admission: issued, ...pair });
}

/** Synthetic-only capability used by zero-provider runner and durability tests. */
export function createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest(
  source: Phase698RetrieverSchemaRecoverySr5LiveSource = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticSourceFixture(),
) {
  const admitted = admitLiveBoundary(
    source,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION,
  );
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
  runId: string,
): IssuedLiveAdmission {
  const issued = consumeCapability(
    capability,
    expectedAuthority,
    issuedAdmissions,
    consumedAdmissions,
    'ADMISSION',
  );
  const binding = issuedRunBindings.get(capability);
  if (!binding || binding.runId !== UUID.parse(runId)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_BINDING_INVALID');
  }
  if (issued.authority === 'git_verified_live') {
    assertLiveRunBoundSourceStillMatches(
      issued.source,
      issued.sourceBinding,
      repositoryRoot,
      runId,
    );
  } else {
    assertRunBoundSourceAndDurablePrefix(
      repositoryRoot,
      runId,
      issued.source,
      issued.sourceBinding,
      issued.authority,
      ['attempt_reserved'],
    );
  }
  return issued;
}

export function revalidatePhase698RetrieverSchemaRecoverySr5LiveBeforeFirstDispatch(
  capability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
  expectedAuthority: IssuedLiveAdmission['authority'],
  repositoryRoot: string,
  runId: string,
): Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability {
  const issued = issuedAdmissions.get(capability);
  const binding = issuedRunBindings.get(capability);
  if (
    !issued ||
    issued.authority !== expectedAuthority ||
    !consumedAdmissions.has(capability) ||
    !binding ||
    binding.runId !== UUID.parse(runId)
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_BINDING_INVALID');
  }
  const observedJournalEvents = [
    'attempt_reserved',
    ...Array.from({ length: 8 }, () => 'guard_terminal' as const),
    'call_reserved',
  ] as const;
  if (issued.authority === 'git_verified_live') {
    assertLiveRunBoundSourceStillMatches(
      issued.source,
      issued.sourceBinding,
      repositoryRoot,
      runId,
      observedJournalEvents,
    );
  } else {
    assertRunBoundSourceAndDurablePrefix(
      repositoryRoot,
      runId,
      issued.source,
      issued.sourceBinding,
      issued.authority,
      observedJournalEvents,
    );
  }
  const lease = acquireRunBoundDispatchLease(repositoryRoot, runId);
  const dispatchCapability = Object.freeze({
    version:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-first-dispatch-capability-v1' as const,
  });
  issuedFirstDispatches.set(dispatchCapability, {
    admissionCapability: capability,
    admission: issued,
    repositoryRoot: resolve(repositoryRoot),
    runId,
    expectedJournalEvents: observedJournalEvents,
    lease,
  });
  return dispatchCapability;
}

export function consumePhase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability(
  capability: Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability,
  admissionCapability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
  expectedAuthority: IssuedLiveAdmission['authority'],
  repositoryRoot: string,
  runId: string,
): Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit {
  const binding = issuedFirstDispatches.get(capability);
  if (
    !binding ||
    consumedFirstDispatches.has(capability) ||
    binding.admissionCapability !== admissionCapability ||
    binding.admission.authority !== expectedAuthority ||
    binding.repositoryRoot !== resolve(repositoryRoot) ||
    binding.runId !== UUID.parse(runId)
  ) {
    throw new Error(
      'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FIRST_DISPATCH_CAPABILITY_INVALID',
    );
  }
  consumedFirstDispatches.add(capability);
  try {
    assertRunBoundDispatchLease(binding.lease);
    if (binding.admission.authority === 'git_verified_live') {
      assertLiveRunBoundSourceStillMatches(
        binding.admission.source,
        binding.admission.sourceBinding,
        binding.repositoryRoot,
        binding.runId,
        binding.expectedJournalEvents,
      );
    } else {
      assertRunBoundSourceAndDurablePrefix(
        binding.repositoryRoot,
        binding.runId,
        binding.admission.source,
        binding.admission.sourceBinding,
        binding.admission.authority,
        binding.expectedJournalEvents,
      );
    }
    const permit = Object.freeze({
      version:
        'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-first-dispatch-permit-v1' as const,
    });
    issuedFirstDispatchPermits.set(permit, binding);
    return permit;
  } catch (error) {
    releaseRunBoundDispatchLease(binding.lease);
    throw error;
  }
}

export function invokePhase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit<T>(
  permit: Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit,
  invokeLoadedAdapter: () => Promise<T>,
): Promise<T> {
  const binding = issuedFirstDispatchPermits.get(permit);
  if (!binding || consumedFirstDispatchPermits.has(permit)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FIRST_DISPATCH_PERMIT_INVALID');
  }
  consumedFirstDispatchPermits.add(permit);
  try {
    assertRunBoundDispatchLease(binding.lease);
    const expectedJournalEvents = [...binding.expectedJournalEvents, 'wire_stage' as const];
    if (binding.admission.authority === 'git_verified_live') {
      assertLiveRunBoundSourceStillMatches(
        binding.admission.source,
        binding.admission.sourceBinding,
        binding.repositoryRoot,
        binding.runId,
        expectedJournalEvents,
      );
    } else {
      assertRunBoundSourceAndDurablePrefix(
        binding.repositoryRoot,
        binding.runId,
        binding.admission.source,
        binding.admission.sourceBinding,
        binding.admission.authority,
        expectedJournalEvents,
      );
    }
    return Promise.resolve(invokeLoadedAdapter()).finally(() =>
      releaseRunBoundDispatchLease(binding.lease),
    );
  } catch (error) {
    releaseRunBoundDispatchLease(binding.lease);
    throw error;
  }
}

export function cancelPhase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit(
  permit: Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchPermit,
) {
  const binding = issuedFirstDispatchPermits.get(permit);
  if (!binding || consumedFirstDispatchPermits.has(permit)) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FIRST_DISPATCH_PERMIT_INVALID');
  }
  consumedFirstDispatchPermits.add(permit);
  releaseRunBoundDispatchLease(binding.lease);
}

export function cancelPhase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability(
  capability: Phase698RetrieverSchemaRecoverySr5LiveFirstDispatchCapability,
) {
  const binding = issuedFirstDispatches.get(capability);
  if (!binding || consumedFirstDispatches.has(capability)) {
    throw new Error(
      'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FIRST_DISPATCH_CAPABILITY_INVALID',
    );
  }
  consumedFirstDispatches.add(capability);
  releaseRunBoundDispatchLease(binding.lease);
}

export function consumePhase698RetrieverSchemaRecoverySr5LiveReservationCapability(
  capability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability,
  expectedAuthority: IssuedLiveAdmission['authority'],
  repositoryRoot: string,
  runId: string,
): IssuedLiveAdmission {
  const parsedRunId = UUID.parse(runId);
  const issued = consumeCapability(
    capability,
    expectedAuthority,
    issuedReservations,
    consumedReservations,
    'RESERVATION',
  );
  if (issued.authority === 'git_verified_live')
    assertLiveSourceStillMatches(issued.source, issued.sourceBinding, repositoryRoot);
  const binding = issuedRunBindings.get(capability);
  if (!binding || binding.runId !== null) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_BINDING_INVALID');
  }
  binding.runId = parsedRunId;
  return issued;
}

export function scanPhase698RetrieverSchemaRecoverySr5LiveFormalPaths(
  repositoryRoot: string,
): readonly string[] | null {
  try {
    const root = resolve(repositoryRoot);
    const rootMetadata = lstatSync(root);
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) return null;
    if (normalizePath(realpathSync(root)) !== normalizePath(root)) return null;
    const output: string[] = [];
    const tmp = resolve(root, '.tmp');
    try {
      const tmpMetadata = lstatSync(tmp);
      if (!tmpMetadata.isDirectory() || tmpMetadata.isSymbolicLink()) return null;
      if (normalizePath(realpathSync(tmp)) !== normalizePath(tmp)) return null;
      for (const entry of readdirSync(tmp, { withFileTypes: true })) {
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

function inspectPhase698RetrieverSchemaRecoverySr5LiveSourceAdmission(
  repositoryRoot: string,
):
  | Readonly<{ ok: true; source: Phase698RetrieverSchemaRecoverySr5LiveSource }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  return validateLiveRepositoryObservation(inspectLiveRepository(repositoryRoot));
}

export function validatePhase698RetrieverSchemaRecoverySr5LiveObservationForTest(
  observation: Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation,
) {
  return validateLiveRepositoryObservation(observation);
}

export function validatePhase698RetrieverSchemaRecoverySr5LiveRunBoundObservationForTest(
  observation: Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation,
  runId: string,
) {
  return validateLiveRunBoundRepositoryObservation(observation, UUID.parse(runId));
}

function validateLiveRepositoryObservation(
  observation: Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation | null,
):
  | Readonly<{ ok: true; source: Phase698RetrieverSchemaRecoverySr5LiveSource }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }> {
  if (
    observation === null ||
    !observation.clean ||
    observation.formalEvidencePaths.length !== 0 ||
    observation.head !== observation.upstream ||
    observation.head !== observation.origin ||
    observation.head !== observation.approvedTag.commit
  ) {
    return Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
  }
  const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA.safeParse({
    schemaVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    mode: 'controlled_live',
    branch: observation.branch,
    head: observation.head,
    upstream: observation.upstream,
    origin: observation.origin,
    approvedTag: observation.approvedTag,
    clean: observation.clean,
    formalEvidencePaths: observation.formalEvidencePaths,
    oldLineagePaths: [],
    sourceBundleSha256: observation.sourceBundleSha256,
    admissionManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
    historicalAdmissionManifestSha256:
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    identities: {
      sr3ManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3ManifestSha256,
      sr3PolicySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_IDENTITIES.sr3PolicySha256,
      sr4FactorySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
      sr4CheckpointSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
    },
  });
  return parsed.success
    ? Object.freeze({ ok: true as const, source: deepFreeze(parsed.data) })
    : Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
}

function validateLiveRunBoundRepositoryObservation(
  observation: Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation | null,
  runId: string,
) {
  const expected = [
    `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}.marker`,
    `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}-${runId}.journal.jsonl`,
  ].sort();
  const observedPaths = observation === null ? [] : [...observation.formalEvidencePaths].sort();
  if (
    observation === null ||
    observedPaths.length !== expected.length ||
    !observedPaths.every((path, index) => path === expected[index])
  ) {
    return Object.freeze({ ok: false as const, reasonCode: 'source_admission_invalid' as const });
  }
  return validateLiveRepositoryObservation({ ...observation, formalEvidencePaths: [] });
}

function expectedRunBoundFormalPaths(runId: string) {
  return [
    `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}.marker`,
    `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}-${runId}.journal.jsonl`,
  ].sort();
}

function inspectLiveRepository(
  repositoryRoot: string,
): Phase698RetrieverSchemaRecoverySr5LiveRepositoryObservation | null {
  const root = resolveTrustedGitRoot(repositoryRoot);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const upstream = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const origin = runGitText(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH}`,
  ]);
  const approvedTagCommit = runGitText(root, [
    'rev-parse',
    '--verify',
    `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF}^{commit}`,
  ]);
  const approvedTagObjectId = runGitText(root, [
    'rev-parse',
    '--verify',
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  ]);
  const approvedTagObject = runGitText(root, [
    'cat-file',
    '-t',
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  ]);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  if (
    branch === null ||
    head === null ||
    upstream === null ||
    origin === null ||
    approvedTagCommit === null ||
    approvedTagObjectId === null ||
    approvedTagObject !== 'tag' ||
    status === null ||
    ![head, upstream, origin, approvedTagCommit, approvedTagObjectId].every(
      (value) => COMMIT.safeParse(value).success,
    )
  )
    return null;
  const bundle = computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256(
    root,
    head,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
  );
  if (!bundle.ok) return null;
  const formalEvidencePaths = scanPhase698RetrieverSchemaRecoverySr5LiveFormalPaths(root);
  if (formalEvidencePaths === null) return null;
  return Object.freeze({
    branch,
    head,
    upstream,
    origin,
    approvedTag: {
      name: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
      ref: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
      commit: approvedTagCommit,
      objectId: approvedTagObjectId,
      objectKind: 'tag' as const,
    },
    clean: status.length === 0,
    formalEvidencePaths,
    sourceBundleSha256: bundle.sha256,
  });
}

function admitLiveBoundary(
  source: Phase698RetrieverSchemaRecoverySr5LiveSource,
  dataBoundaryConfirmation: unknown,
  authorizationConfirmation: unknown,
):
  | Readonly<{ ok: true; admission: Phase698RetrieverSchemaRecoverySr5LiveBoundaryAdmissionRecord }>
  | Readonly<{ ok: false; code: string }> {
  const boundary = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_SCHEMA.safeParse({
    accepted: true,
    confirmation: dataBoundaryConfirmation,
    providers: ['deepseek', 'qwen'],
    scope: 'current_account',
  });
  const authorization = z
    .object({
      confirmation: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION),
      lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
      sourceBranch: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH),
      sourceCommit: COMMIT,
      sourceBundleSha256: SHA256_REF,
      approvedTag: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG),
      approvedTagObjectId: COMMIT,
      invocation: z.literal('once'),
    })
    .strict()
    .safeParse({
      confirmation: authorizationConfirmation,
      lineage: source.lineage,
      sourceBranch: source.branch,
      sourceCommit: source.head,
      sourceBundleSha256: source.sourceBundleSha256,
      approvedTag: source.approvedTag.name,
      approvedTagObjectId: source.approvedTag.objectId,
      invocation: 'once',
    });
  const budget = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET_SCHEMA.safeParse(
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
  );
  if (!boundary.success) return { ok: false, code: 'data_boundary_invalid' };
  if (!authorization.success) return { ok: false, code: 'authorization_invalid' };
  if (!budget.success) return { ok: false, code: 'budget_invalid' };
  const admission = deepFreeze({
    schemaVersion:
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-boundary-v1' as const,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    authority: 'controlled_live_retriever_final_response_schema_recovery_sr5' as const,
    gate: 'sr5_live_boundary_admitted' as const,
    qualityAuthority: 'none' as const,
    mode: 'controlled_live' as const,
    providerDispatchAllowed: false as const,
    source: {
      branch: source.branch,
      head: source.head,
      approvedTag: source.approvedTag.name,
      approvedTagObjectId: source.approvedTag.objectId,
      sourceBundleSha256: source.sourceBundleSha256,
      sourceManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
    },
    dataBoundary: {
      accepted: true as const,
      providers: ['deepseek', 'qwen'] as const,
      scope: 'current_account' as const,
      confirmationSha256: digest(boundary.data.confirmation),
    },
    authorization: {
      sourceCommit: authorization.data.sourceCommit,
      sourceBundleSha256: authorization.data.sourceBundleSha256,
      approvedTag: authorization.data.approvedTag,
      approvedTagObjectId: authorization.data.approvedTagObjectId,
      invocation: 'once' as const,
      confirmationSha256: digest(authorization.data.confirmation),
    },
    budget: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET,
    execution: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST.execution,
    providerCalls: 0 as const,
    credentialReads: 0 as const,
    formalEvidence: 0 as const,
  });
  return Object.freeze({ ok: true as const, admission });
}

function assertLiveSourceStillMatches(
  source: Phase698RetrieverSchemaRecoverySr5LiveSource,
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  repositoryRoot: string,
) {
  const current = inspectPhase698RetrieverSchemaRecoverySr5LiveSourceAdmission(repositoryRoot);
  if (
    !current.ok ||
    current.source.branch !== source.branch ||
    current.source.head !== source.head ||
    current.source.upstream !== source.upstream ||
    current.source.origin !== source.origin ||
    current.source.approvedTag.objectId !== source.approvedTag.objectId ||
    current.source.sourceBundleSha256 !== source.sourceBundleSha256
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
  if (
    sourceBinding.sourceCommit !== source.head ||
    sourceBinding.sourceBundleSha256 !== source.sourceBundleSha256
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
}

function assertLiveRunBoundSourceStillMatches(
  source: Phase698RetrieverSchemaRecoverySr5LiveSource,
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  repositoryRoot: string,
  runId: string,
  expectedJournalEvents: readonly RunBoundJournalEvent[] = ['attempt_reserved'],
) {
  const current = inspectLiveRepository(repositoryRoot);
  const validated = validateLiveRunBoundRepositoryObservation(current, runId);
  if (
    !validated.ok ||
    validated.source.branch !== source.branch ||
    validated.source.head !== source.head ||
    validated.source.upstream !== source.upstream ||
    validated.source.origin !== source.origin ||
    validated.source.approvedTag.objectId !== source.approvedTag.objectId ||
    validated.source.sourceBundleSha256 !== source.sourceBundleSha256
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
  assertRunBoundSourceAndDurablePrefix(
    repositoryRoot,
    runId,
    source,
    sourceBinding,
    'git_verified_live',
    expectedJournalEvents,
  );
}

const RUN_BOUND_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-marker-v1',
    ),
    durabilityVersion: z.literal(
      'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-durability-v1',
    ),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    runId: UUID,
    runScope: z.literal('branch'),
    authority: z.enum([
      'synthetic_test_retriever_final_response_schema_recovery_sr5',
      'controlled_live_retriever_final_response_schema_recovery_sr5',
    ]),
    credentialReads: z.union([z.literal(0), z.literal(3)]),
    createdAt: z.string().datetime({ offset: true }),
    creatorPid: z.number().int().positive(),
    source: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA,
    sourceBinding: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
  })
  .strict();

type RunBoundJournalEvent = 'attempt_reserved' | 'guard_terminal' | 'call_reserved' | 'wire_stage';

function assertRunBoundSourceAndDurablePrefix(
  repositoryRoot: string,
  runId: string,
  source: Phase698RetrieverSchemaRecoverySr5LiveSource,
  sourceBinding: Phase698RetrieverSchemaRecoverySr5LiveSourceBinding,
  admissionAuthority: IssuedLiveAdmission['authority'],
  expectedJournalEvents: readonly RunBoundJournalEvent[],
) {
  try {
    const namespace = openTrustedRunBoundNamespace(repositoryRoot, runId);
    let markerBytes: string;
    let journalBytes: string;
    try {
      markerBytes = readTrustedRegularFile(
        namespace,
        `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}.marker`,
      );
      journalBytes = readTrustedRegularFile(
        namespace,
        `.tmp/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}-${runId}.journal.jsonl`,
      );
      assertTrustedRunBoundNamespace(namespace, runId);
    } finally {
      closeSync(namespace.tmpHandle);
      closeSync(namespace.rootHandle);
    }
    const marker = RUN_BOUND_MARKER_SCHEMA.parse(JSON.parse(markerBytes.trim()));
    const expectedMarkerAuthority =
      admissionAuthority === 'git_verified_live'
        ? 'controlled_live_retriever_final_response_schema_recovery_sr5'
        : 'synthetic_test_retriever_final_response_schema_recovery_sr5';
    const expectedCredentialReads = admissionAuthority === 'git_verified_live' ? 3 : 0;
    if (
      marker.runId !== runId ||
      marker.authority !== expectedMarkerAuthority ||
      marker.credentialReads !== expectedCredentialReads ||
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(marker.source) !==
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(source) ||
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(marker.sourceBinding) !==
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(sourceBinding)
    ) {
      throw new Error('marker_binding_invalid');
    }
    const lines = journalBytes.split(/\r?\n/u).filter((line) => line.length > 0);
    if (lines.length !== expectedJournalEvents.length) throw new Error('journal_prefix_invalid');
    let previousHash: string | null = null;
    for (const [index, line] of lines.entries()) {
      const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_SCHEMA.parse(
        JSON.parse(line),
      );
      const recordHash = parsed.recordHash;
      const record = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key !== 'recordHash'),
      );
      if (
        parsed.recordVersion !==
          'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-journal-record-v1' ||
        parsed.lineage !== PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE ||
        parsed.runId !== runId ||
        parsed.sequence !== index + 1 ||
        parsed.event !== expectedJournalEvents[index] ||
        parsed.markerSha256 !== sha256Phase698RetrieverSchemaRecoverySr5Live(markerBytes) ||
        parsed.previousHash !== previousHash ||
        recordHash !==
          sha256Phase698RetrieverSchemaRecoverySr5Live(
            canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(record),
          )
      ) {
        throw new Error('journal_binding_invalid');
      }
      previousHash = recordHash;
    }
  } catch {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_DRIFT');
  }
}

type TrustedRunBoundNamespace = Readonly<{
  root: string;
  tmp: string;
  rootHandle: number;
  tmpHandle: number;
  rootIdentity: ReturnType<typeof fstatSync>;
  tmpIdentity: ReturnType<typeof fstatSync>;
}>;
type RunBoundDispatchLease = Readonly<{
  path: string;
  handle: number;
  identity: ReturnType<typeof fstatSync>;
}>;

function openTrustedRunBoundNamespace(
  repositoryRoot: string,
  runId: string,
): TrustedRunBoundNamespace {
  const root = resolve(repositoryRoot);
  const tmp = resolve(root, '.tmp');
  const rootHandle = openSync(root, fsConstants.O_RDONLY);
  let tmpHandle: number | null = null;
  try {
    tmpHandle = openSync(tmp, fsConstants.O_RDONLY);
    const namespace = {
      root,
      tmp,
      rootHandle,
      tmpHandle,
      rootIdentity: fstatSync(rootHandle),
      tmpIdentity: fstatSync(tmpHandle),
    };
    assertTrustedRunBoundNamespace(namespace, runId);
    return namespace;
  } catch (error) {
    if (tmpHandle !== null) closeSync(tmpHandle);
    closeSync(rootHandle);
    throw error;
  }
}

function assertTrustedRunBoundNamespace(namespace: TrustedRunBoundNamespace, runId: string) {
  assertPathMatchesHandle(namespace.root, namespace.rootHandle, namespace.rootIdentity, true);
  assertPathMatchesHandle(namespace.tmp, namespace.tmpHandle, namespace.tmpIdentity, true);
  const observed = [
    ...readDirectoryEntriesFromOpenedDirectory(namespace.tmp)
      .filter((entry) => LIVE_FORMAL_BASENAME.test(entry.name))
      .map((entry) => `.tmp/${entry.name}`),
    ...readDirectoryEntriesFromOpenedDirectory(namespace.root)
      .filter((entry) => LIVE_FORMAL_BASENAME.test(entry.name))
      .map((entry) => entry.name),
  ].sort();
  const expected = expectedRunBoundFormalPaths(runId);
  if (
    observed.length !== expected.length ||
    !observed.every((path, index) => path === expected[index])
  ) {
    throw new Error('namespace_invalid');
  }
  assertPathMatchesHandle(namespace.root, namespace.rootHandle, namespace.rootIdentity, true);
  assertPathMatchesHandle(namespace.tmp, namespace.tmpHandle, namespace.tmpIdentity, true);
}

function readDirectoryEntriesFromOpenedDirectory(path: string) {
  const directory = opendirSync(path);
  const entries: NonNullable<ReturnType<typeof directory.readSync>>[] = [];
  try {
    for (;;) {
      const entry = directory.readSync();
      if (entry === null) break;
      entries.push(entry);
    }
  } finally {
    directory.closeSync();
  }
  return entries;
}

function acquireRunBoundDispatchLease(
  repositoryRoot: string,
  runId: string,
): RunBoundDispatchLease {
  const path = resolve(
    repositoryRoot,
    '.tmp',
    `${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_EVIDENCE_NAMESPACE}-${UUID.parse(runId)}.dispatch.lock`,
  );
  const handle = openSync(
    path,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o600,
  );
  try {
    writeSync(handle, `${runId}\n`, undefined, 'utf8');
    fsyncSync(handle);
    const lease = { path, handle, identity: fstatSync(handle) };
    assertRunBoundDispatchLease(lease);
    return lease;
  } catch (error) {
    closeSync(handle);
    try {
      unlinkSync(path);
    } catch {
      // Preserve the original fail-closed error.
    }
    throw error;
  }
}

function assertRunBoundDispatchLease(lease: RunBoundDispatchLease) {
  assertPathMatchesHandle(lease.path, lease.handle, lease.identity, false);
}

function releaseRunBoundDispatchLease(lease: RunBoundDispatchLease) {
  let owned = false;
  try {
    assertRunBoundDispatchLease(lease);
    owned = true;
  } finally {
    closeSync(lease.handle);
    if (owned) unlinkSync(lease.path);
  }
}

function readTrustedRegularFile(namespace: TrustedRunBoundNamespace, relativePath: string) {
  const path = resolve(namespace.root, relativePath);
  const flags =
    process.platform === 'win32'
      ? fsConstants.O_RDONLY
      : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW;
  const handle = openSync(path, flags);
  try {
    const identity = fstatSync(handle);
    assertPathMatchesHandle(path, handle, identity, false);
    assertPathMatchesHandle(namespace.tmp, namespace.tmpHandle, namespace.tmpIdentity, true);
    const bytes = readFileSync(handle);
    if (bytes.byteLength === 0 || bytes.byteLength > 1024 * 1024) throw new Error('invalid_size');
    assertPathMatchesHandle(path, handle, identity, false);
    assertPathMatchesHandle(namespace.tmp, namespace.tmpHandle, namespace.tmpIdentity, true);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    closeSync(handle);
  }
}

function assertPathMatchesHandle(
  path: string,
  handle: number,
  identity: ReturnType<typeof fstatSync>,
  directory: boolean,
) {
  const opened = fstatSync(handle);
  const current = lstatSync(path);
  if (
    (directory
      ? !opened.isDirectory() || !current.isDirectory()
      : !opened.isFile() || !current.isFile()) ||
    current.isSymbolicLink() ||
    opened.dev !== identity.dev ||
    opened.ino !== identity.ino ||
    opened.dev !== current.dev ||
    opened.ino !== current.ino
  ) {
    throw new Error('untrusted_path');
  }
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
  const runBinding: RunBinding = { runId: null };
  issuedRunBindings.set(capability, runBinding);
  issuedRunBindings.set(reservationCapability, runBinding);
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

function resolveTrustedGitRoot(repositoryRoot: string): string | null {
  try {
    if (
      typeof repositoryRoot !== 'string' ||
      repositoryRoot.length === 0 ||
      repositoryRoot.includes('\0')
    )
      return null;
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

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
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

function normalizePath(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
