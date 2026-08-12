import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  canonicalPhase698RetrieverSchemaRecoverySr5Json,
  sha256Phase698RetrieverSchemaRecoverySr5,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256_REF = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const CURRENT_LINEAGE_EVIDENCE_BASENAME =
  /^phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|json))$/u;

export const PHASE_6_9_8_SR5_NEXT_LINEAGE =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v2' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-admission-v1' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_admission' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_GATE =
  'sr5_next_lineage_source_admitted_zero_provider' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_CHECKPOINT_BRANCH = 'main' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG =
  'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3-approved' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF =
  `refs/tags/${PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG}` as const;

export const PHASE_6_9_8_SR5_SEALED_V2_RECEIPT = deepFreeze({
  lineage: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1',
  tag: 'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved',
  tagRef: 'refs/tags/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v2-approved',
  tagObjectId: '47a9438fe78a8c023e6be51204f4898ddaab9ef0',
  peeledCommit: '55b4ed2aedf9e19c01614a1fa921558c80090884',
  runId: '9eb57600-97e2-4513-8654-8686b38e856e',
  gate: 'schema_recovery_sr5_branch_quality_gate_failed',
  qualityAuthority: 'none',
  providerCalls: 0,
  reportSha256: '5912a56336e2ac24e73a361c6452dcb473c53d8c7fbff36065848aaf22fe087d',
  artifactSha256: 'a4ccb5063608d2f81cb0c7b9092b4e3610c7ea3bfee817daaec4b5a9c88bb98b',
});

export const PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS = Object.freeze([
  Object.freeze({ path: 'package.json', objectKind: 'blob' as const }),
  Object.freeze({ path: 'bun.lock', objectKind: 'blob' as const }),
  Object.freeze({ path: 'packages/agent', objectKind: 'tree' as const }),
  Object.freeze({ path: 'packages/ai', objectKind: 'tree' as const }),
  Object.freeze({ path: 'packages/types', objectKind: 'tree' as const }),
] as const);

export const PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST = deepFreeze({
  version:
    'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-source-manifest-v1',
  lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
  checkpointBranch: PHASE_6_9_8_SR5_NEXT_LINEAGE_CHECKPOINT_BRANCH,
  futureTag: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
  sourceObjects: PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  sealedPredecessor: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
});

export const PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256 =
  `sha256:${sha256Phase698RetrieverSchemaRecoverySr5(
    canonicalPhase698RetrieverSchemaRecoverySr5Json(PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST),
  )}` as const;

const SOURCE_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION),
    lineage: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE),
    mode: z.literal('zero_provider_admission'),
    branch: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE_CHECKPOINT_BRANCH),
    head: COMMIT,
    upstream: COMMIT,
    origin: COMMIT,
    clean: z.literal(true),
    futureTag: z
      .object({
        name: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG),
        ref: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF),
        exists: z.literal(false),
      })
      .strict(),
    currentLineageEvidencePaths: z.array(z.string().min(1).max(300)).length(0),
    sourceManifestSha256: z.literal(PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256),
    sourceBundleSha256: SHA256_REF,
    sealedPredecessor: z
      .object({
        tag: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tag),
        tagObjectId: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId),
        peeledCommit: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit),
        runId: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.runId),
        reportSha256: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.reportSha256),
        artifactSha256: z.literal(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.artifactSha256),
      })
      .strict(),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.head !== source.upstream || source.head !== source.origin) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_parity_invalid' });
    }
  });

export type Phase698Sr5NextLineageSource = z.infer<typeof SOURCE_SCHEMA>;
export type Phase698Sr5NextLineageAdmissionCapability = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION;
}>;
export type Phase698Sr5NextLineageAdmissionRecord = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION;
  lineage: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE;
  authority: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_admission';
  providerDispatchAllowed: false;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  businessWrites: 0;
  futureTagCreated: false;
  liveAuthorizationDefined: false;
  dataBoundaryAcceptanceDefined: false;
  source: Phase698Sr5NextLineageSource;
}>;

export type Phase698Sr5NextLineageRepositoryObservation = Readonly<{
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  clean: boolean;
  futureTagExists: boolean;
  currentLineageEvidencePaths: readonly string[];
  sourceBundleSha256: string;
  sealedV2TagObjectId: string;
  sealedV2PeeledCommit: string;
}>;

type IssuedAdmission = Readonly<{
  authority: 'git_verified' | 'synthetic_test';
  record: Phase698Sr5NextLineageAdmissionRecord;
}>;
const issuedAdmissions = new WeakMap<object, IssuedAdmission>();
const consumedAdmissions = new WeakSet<object>();

export function admitPhase698Sr5NextLineageZeroProvider(repositoryRoot: string):
  | Readonly<{
      ok: true;
      admission: Phase698Sr5NextLineageAdmissionRecord;
      capability: Phase698Sr5NextLineageAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'next_lineage_source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  return observation === null
    ? invalidAdmission()
    : issueFromObservation(observation, 'git_verified');
}

export function validatePhase698Sr5NextLineageObservationForTest(
  observation: Phase698Sr5NextLineageRepositoryObservation,
): boolean {
  return sourceFromObservation(observation) !== null;
}

export function isPhase698Sr5NextLineageEvidenceRelativePath(path: string): boolean {
  return (
    typeof path === 'string' &&
    CURRENT_LINEAGE_EVIDENCE_BASENAME.test(path.replace(/^\.tmp\//u, ''))
  );
}

export function createPhase698Sr5NextLineageSyntheticAdmissionForTest(
  observation: Phase698Sr5NextLineageRepositoryObservation = createPhase698Sr5NextLineageSyntheticObservationForTest(),
): Readonly<{
  admission: Phase698Sr5NextLineageAdmissionRecord;
  capability: Phase698Sr5NextLineageAdmissionCapability;
}> {
  const result = issueFromObservation(observation, 'synthetic_test');
  if (!result.ok) throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_SYNTHETIC_ADMISSION_INVALID');
  return result;
}

export function createPhase698Sr5NextLineageSyntheticObservationForTest(
  commit = 'a'.repeat(40),
): Phase698Sr5NextLineageRepositoryObservation {
  return deepFreeze({
    branch: PHASE_6_9_8_SR5_NEXT_LINEAGE_CHECKPOINT_BRANCH,
    head: commit,
    upstream: commit,
    origin: commit,
    clean: true,
    futureTagExists: false,
    currentLineageEvidencePaths: [],
    sourceBundleSha256: `sha256:${'b'.repeat(64)}`,
    sealedV2TagObjectId: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId,
    sealedV2PeeledCommit: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit,
  });
}

export function consumePhase698Sr5NextLineageAdmissionCapability(
  capability: unknown,
  expectedAuthority: 'git_verified' | 'synthetic_test',
): Phase698Sr5NextLineageAdmissionRecord {
  if (!isObject(capability) || consumedAdmissions.has(capability)) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(capability, 'version');
  } catch {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
  }
  const issued = issuedAdmissions.get(capability);
  if (
    !descriptor ||
    !('value' in descriptor) ||
    descriptor.value !== PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION ||
    !issued ||
    issued.authority !== expectedAuthority
  ) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
  }
  consumedAdmissions.add(capability);
  return issued.record;
}

export function parsePhase698Sr5NextLineageAdmissionArgs(
  args: readonly string[],
): Readonly<{ kind: 'help' | 'inspect_zero_provider' }> | Readonly<{ kind: 'rejected' }> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  if (args.length === 1 && args[0] === '--inspect-zero-provider') {
    return { kind: 'inspect_zero_provider' };
  }
  return { kind: 'rejected' };
}

function issueFromObservation(
  observation: Phase698Sr5NextLineageRepositoryObservation,
  authority: IssuedAdmission['authority'],
):
  | Readonly<{
      ok: true;
      admission: Phase698Sr5NextLineageAdmissionRecord;
      capability: Phase698Sr5NextLineageAdmissionCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'next_lineage_source_admission_invalid' }> {
  const source = sourceFromObservation(observation);
  if (source === null) return invalidAdmission();
  const record = deepFreeze({
    version: PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION,
    lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
    authority: PHASE_6_9_8_SR5_NEXT_LINEAGE_AUTHORITY,
    gate: PHASE_6_9_8_SR5_NEXT_LINEAGE_GATE,
    qualityAuthority: 'none' as const,
    mode: 'zero_provider_admission' as const,
    providerDispatchAllowed: false as const,
    credentialReads: 0 as const,
    providerCalls: 0 as const,
    formalEvidence: 0 as const,
    businessWrites: 0 as const,
    futureTagCreated: false as const,
    liveAuthorizationDefined: false as const,
    dataBoundaryAcceptanceDefined: false as const,
    source,
  });
  const capability = Object.freeze({
    version: PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION,
  });
  issuedAdmissions.set(capability, { authority, record });
  return Object.freeze({ ok: true as const, admission: record, capability });
}

function sourceFromObservation(
  observation: Phase698Sr5NextLineageRepositoryObservation,
): Phase698Sr5NextLineageSource | null {
  try {
    const parsed = SOURCE_SCHEMA.safeParse({
      schemaVersion: PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      mode: 'zero_provider_admission',
      branch: observation.branch,
      head: observation.head,
      upstream: observation.upstream,
      origin: observation.origin,
      clean: observation.clean,
      futureTag: {
        name: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
        ref: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
        exists: observation.futureTagExists,
      },
      currentLineageEvidencePaths: observation.currentLineageEvidencePaths,
      sourceManifestSha256: PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256: observation.sourceBundleSha256,
      sealedPredecessor: {
        tag: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tag,
        tagObjectId: observation.sealedV2TagObjectId,
        peeledCommit: observation.sealedV2PeeledCommit,
        runId: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.runId,
        reportSha256: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.reportSha256,
        artifactSha256: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.artifactSha256,
      },
    });
    return parsed.success ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

function inspectRepository(rootInput: string): Phase698Sr5NextLineageRepositoryObservation | null {
  const root = resolveTrustedGitRoot(rootInput);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const upstream = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const origin = runGitText(root, ['rev-parse', '--verify', 'refs/remotes/origin/main']);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  const futureTag = inspectTag(root, PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF);
  const sealedTag = inspectTag(root, PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagRef);
  if (
    branch === null ||
    head === null ||
    upstream === null ||
    origin === null ||
    status === null ||
    futureTag === null ||
    sealedTag === null ||
    sealedTag.exists !== true ||
    sealedTag.objectKind !== 'tag' ||
    !COMMIT.safeParse(head).success ||
    !COMMIT.safeParse(upstream).success ||
    !COMMIT.safeParse(origin).success
  ) {
    return null;
  }
  const bundle = computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256(
    root,
    head,
    PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  );
  const evidencePaths = scanCurrentLineageEvidence(root);
  if (!bundle.ok || evidencePaths === null) return null;
  return deepFreeze({
    branch,
    head,
    upstream,
    origin,
    clean: status.length === 0,
    futureTagExists: futureTag.exists,
    currentLineageEvidencePaths: evidencePaths,
    sourceBundleSha256: bundle.sha256,
    sealedV2TagObjectId: sealedTag.objectId,
    sealedV2PeeledCommit: sealedTag.peeledCommit,
  });
}

function inspectTag(
  root: string,
  ref: string,
): Readonly<{
  exists: boolean;
  objectId: string;
  peeledCommit: string;
  objectKind: string;
}> | null {
  const objectId = runGitTextOptionalRef(root, ref);
  if (objectId === null) return null;
  if (objectId === '') return { exists: false, objectId: '', peeledCommit: '', objectKind: '' };
  const peeledCommit = runGitText(root, ['rev-list', '-n', '1', ref]);
  const objectKind = runGitText(root, ['cat-file', '-t', ref]);
  return peeledCommit === null || objectKind === null
    ? null
    : { exists: true, objectId, peeledCommit, objectKind };
}

function scanCurrentLineageEvidence(root: string): readonly string[] | null {
  try {
    const output: string[] = [];
    for (const directory of [root, resolve(root, '.tmp')]) {
      try {
        const metadata = lstatSync(directory);
        if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
        if (normalizePath(realpathSync(directory)) !== normalizePath(directory)) return null;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (CURRENT_LINEAGE_EVIDENCE_BASENAME.test(entry.name)) {
            output.push(directory === root ? entry.name : `.tmp/${entry.name}`);
          }
        }
      } catch (error) {
        if (directory === root || !isErrorCode(error, 'ENOENT')) return null;
      }
    }
    return Object.freeze(output.sort());
  } catch {
    return null;
  }
}

function resolveTrustedGitRoot(repositoryRoot: string): string | null {
  try {
    const requested = realpathSync(resolve(repositoryRoot));
    const metadata = lstatSync(requested);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const reported = runGitTextUnchecked(requested, ['rev-parse', '--show-toplevel']);
    if (reported === null) return null;
    const actual = realpathSync(reported);
    return normalizePath(requested) === normalizePath(actual) ? actual : null;
  } catch {
    return null;
  }
}

function runGitText(root: string, args: readonly string[], trim = true): string | null {
  const result = runGit(root, args);
  if (result === null || result.status !== 0) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(result.stdout);
    return trim ? text.trim() : text.replace(/\r?\n$/u, '');
  } catch {
    return null;
  }
}

function runGitTextUnchecked(root: string, args: readonly string[]): string | null {
  return runGitText(root, args);
}

function runGitTextOptionalRef(root: string, ref: string): string | null {
  const result = runGit(root, ['rev-parse', '--verify', '--quiet', ref]);
  if (result === null || (result.status !== 0 && result.status !== 1)) return null;
  if (result.status === 1) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(result.stdout).trim();
  } catch {
    return null;
  }
}

function runGit(
  root: string,
  args: readonly string[],
): Readonly<{ status: number | null; stdout: Uint8Array }> | null {
  try {
    const result = spawnSync('git', ['-C', root, ...args], {
      encoding: 'buffer',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    return result.signal === null && result.stdout instanceof Uint8Array
      ? { status: result.status, stdout: result.stdout }
      : null;
  } catch {
    return null;
  }
}

function invalidAdmission() {
  return Object.freeze({
    ok: false as const,
    reasonCode: 'next_lineage_source_admission_invalid' as const,
  });
}

function normalizePath(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}
