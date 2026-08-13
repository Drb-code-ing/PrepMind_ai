import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
  isPhase698Sr5NextLineageEvidenceRelativePath,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-admission.ts';
import { computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
  PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
  PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_SR5_RUNTIME_SOURCE_RECEIPT_SCHEMA,
  type Phase698Sr5RuntimeSourceReceipt,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-source-binding-contract.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256 = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-final-git-verifier-v1' as const;
export const PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_final_git_verifier' as const;
export const PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_GATE =
  'sr5_final_git_source_verified_zero_provider' as const;
export const PHASE_6_9_8_SR5_FINAL_GIT_TAG_TITLE =
  'Phase 6.9.8 SR5 runtime v7 approved source' as const;

export type Phase698Sr5FinalGitObservation = Readonly<{
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  clean: boolean;
  tag: Readonly<{
    name: string;
    ref: string;
    objectKind: string;
    objectId: string;
    originObjectId: string;
    peeledCommit: string;
    targetCommit: string;
    message: string;
  }>;
  sourceBundleSha256: string;
  currentLineageEvidencePaths: readonly string[];
  sealedV2TagObjectId: string;
  sealedV2PeeledCommit: string;
}>;

export type Phase698Sr5FinalGitVerifierRecord = Readonly<{
  version: typeof PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION;
  lineage: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE;
  authority: typeof PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_final_git_verifier';
  sourceReceipt: Phase698Sr5RuntimeSourceReceipt;
  gitAuthorityIssued: true;
  runnerInvocationAllowed: false;
  providerDispatchAllowed: false;
  liveAuthorizationDefined: false;
  dataBoundaryAcceptanceDefined: false;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  businessWrites: 0;
}>;

export type Phase698Sr5FinalGitCapability = Readonly<{
  version: typeof PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION;
}>;

const issuedCapabilities = new WeakMap<
  object,
  Readonly<{
    authority: 'git_verified' | 'synthetic_test';
    record: Phase698Sr5FinalGitVerifierRecord;
  }>
>();
const consumedCapabilities = new WeakSet<object>();

export function createPhase698Sr5FinalGitTagMessage(sourceBundleSha256: string): string {
  if (!SHA256.safeParse(sourceBundleSha256).success) {
    throw new Error('PHASE_6_9_8_SR5_FINAL_GIT_SOURCE_BUNDLE_INVALID');
  }
  return [
    PHASE_6_9_8_SR5_FINAL_GIT_TAG_TITLE,
    `lineage=${PHASE_6_9_8_SR5_NEXT_LINEAGE}`,
    `sourceManifestSha256=${PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256}`,
    `sourceBundleSha256=${sourceBundleSha256}`,
    `sealedV2TagObjectId=${PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId}`,
    `sealedV2PeeledCommit=${PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit}`,
    'zero-provider=providerCalls:0,credentialReads:0,formalEvidence:0,businessWrites:0,qualityAuthority:none',
  ].join('\n\n');
}

export function verifyPhase698Sr5FinalGitSourceZeroProvider(repositoryRoot: string):
  | Readonly<{
      ok: true;
      record: Phase698Sr5FinalGitVerifierRecord;
      capability: Phase698Sr5FinalGitCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'final_git_source_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  return observation === null ? invalid() : issueFromObservation(observation, 'git_verified');
}

export function validatePhase698Sr5FinalGitObservationForTest(
  observation: Phase698Sr5FinalGitObservation,
): boolean {
  return recordFromObservation(observation) !== null;
}

export function createPhase698Sr5FinalGitSyntheticObservationForTest(
  commit = 'a'.repeat(40),
  sourceBundleSha256 = `sha256:${'b'.repeat(64)}`,
): Phase698Sr5FinalGitObservation {
  return deepFreeze({
    branch: 'main',
    head: commit,
    upstream: commit,
    origin: commit,
    clean: true,
    tag: {
      name: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
      ref: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
      objectKind: 'tag',
      objectId: 'c'.repeat(40),
      originObjectId: 'c'.repeat(40),
      peeledCommit: commit,
      targetCommit: commit,
      message: createPhase698Sr5FinalGitTagMessage(sourceBundleSha256),
    },
    sourceBundleSha256,
    currentLineageEvidencePaths: [],
    sealedV2TagObjectId: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId,
    sealedV2PeeledCommit: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit,
  });
}

export function createPhase698Sr5FinalGitSyntheticAuthorityForTest(
  observation: Phase698Sr5FinalGitObservation = createPhase698Sr5FinalGitSyntheticObservationForTest(),
) {
  const result = issueFromObservation(observation, 'synthetic_test');
  if (!result.ok) throw new Error('PHASE_6_9_8_SR5_FINAL_GIT_SYNTHETIC_OBSERVATION_INVALID');
  return result;
}

export function consumePhase698Sr5FinalGitCapability(
  capability: unknown,
  expectedAuthority: 'git_verified' | 'synthetic_test',
): Phase698Sr5FinalGitVerifierRecord {
  if (!isObject(capability) || consumedCapabilities.has(capability)) throw invalidCapability();
  const version = readOwnDataProperty(capability, 'version');
  const issued = issuedCapabilities.get(capability);
  if (
    version !== PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION ||
    !issued ||
    issued.authority !== expectedAuthority
  ) {
    throw invalidCapability();
  }
  consumedCapabilities.add(capability);
  return issued.record;
}

export function parsePhase698Sr5FinalGitVerifierArgs(
  args: readonly string[],
):
  | Readonly<{ kind: 'help' }>
  | Readonly<{ kind: 'inspect-zero-provider' }>
  | Readonly<{ kind: 'rejected' }> {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return { kind: 'help' };
  if (args.length === 1 && args[0] === 'inspect-zero-provider') {
    return { kind: 'inspect-zero-provider' };
  }
  return { kind: 'rejected' };
}

function issueFromObservation(
  observation: Phase698Sr5FinalGitObservation,
  authority: 'git_verified' | 'synthetic_test',
):
  | Readonly<{
      ok: true;
      record: Phase698Sr5FinalGitVerifierRecord;
      capability: Phase698Sr5FinalGitCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'final_git_source_invalid' }> {
  const record = recordFromObservation(observation);
  if (record === null) return invalid();
  const capability = Object.freeze({ version: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION });
  issuedCapabilities.set(capability, { authority, record });
  return Object.freeze({ ok: true as const, record, capability });
}

function recordFromObservation(
  observation: Phase698Sr5FinalGitObservation,
): Phase698Sr5FinalGitVerifierRecord | null {
  try {
    if (
      observation.branch !== 'main' ||
      observation.clean !== true ||
      observation.head !== observation.upstream ||
      observation.head !== observation.origin ||
      observation.tag.name !== PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG ||
      observation.tag.ref !== PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF ||
      observation.tag.objectKind !== 'tag' ||
      observation.tag.objectId !== observation.tag.originObjectId ||
      observation.tag.peeledCommit !== observation.head ||
      observation.tag.targetCommit !== observation.head ||
      observation.tag.message !==
        createPhase698Sr5FinalGitTagMessage(observation.sourceBundleSha256) ||
      observation.currentLineageEvidencePaths.length !== 0 ||
      observation.sealedV2TagObjectId !== PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId ||
      observation.sealedV2PeeledCommit !== PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit ||
      !COMMIT.safeParse(observation.head).success ||
      !COMMIT.safeParse(observation.tag.objectId).success ||
      !SHA256.safeParse(observation.sourceBundleSha256).success
    ) {
      return null;
    }
    const sourceReceipt = PHASE_6_9_8_SR5_RUNTIME_SOURCE_RECEIPT_SCHEMA.safeParse({
      branch: 'main',
      head: observation.head,
      upstream: observation.upstream,
      origin: observation.origin,
      clean: true,
      sourceManifestSha256: PHASE_6_9_8_SR5_RUNTIME_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256: observation.sourceBundleSha256,
      approvedTag: observation.tag.name,
      approvedTagRef: observation.tag.ref,
      approvedTagKind: observation.tag.objectKind,
      approvedTagObjectId: observation.tag.objectId,
      originTagObjectId: observation.tag.originObjectId,
      peeledCommit: observation.tag.peeledCommit,
      targetCommit: observation.tag.targetCommit,
      currentLineageEvidencePaths: observation.currentLineageEvidencePaths,
    });
    if (!sourceReceipt.success) return null;
    return deepFreeze({
      version: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      authority: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_AUTHORITY,
      gate: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_GATE,
      qualityAuthority: 'none' as const,
      mode: 'zero_provider_final_git_verifier' as const,
      sourceReceipt: sourceReceipt.data,
      gitAuthorityIssued: true as const,
      runnerInvocationAllowed: false as const,
      providerDispatchAllowed: false as const,
      liveAuthorizationDefined: false as const,
      dataBoundaryAcceptanceDefined: false as const,
      credentialReads: 0 as const,
      providerCalls: 0 as const,
      formalEvidence: 0 as const,
      businessWrites: 0 as const,
    });
  } catch {
    return null;
  }
}

function inspectRepository(rootInput: string): Phase698Sr5FinalGitObservation | null {
  const root = resolveTrustedGitRoot(rootInput);
  if (root === null) return null;
  const branch = runGitText(root, ['branch', '--show-current']);
  const head = runGitText(root, ['rev-parse', '--verify', 'HEAD']);
  const upstream = runGitText(root, ['rev-parse', '--verify', '@{upstream}']);
  const origin = runGitText(root, ['rev-parse', '--verify', 'refs/remotes/origin/main']);
  const status = runGitText(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  const tagObjectId = runGitText(root, [
    'rev-parse',
    '--verify',
    PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
  ]);
  const tagObjectKind = runGitText(root, [
    'cat-file',
    '-t',
    PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
  ]);
  const peeledCommit = runGitText(root, [
    'rev-list',
    '-n',
    '1',
    PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
  ]);
  const rawTag = runGitText(
    root,
    ['cat-file', 'tag', PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF],
    false,
  );
  const originTagObjectId = inspectOriginTagObjectId(root);
  const sealedV2TagObjectId = runGitText(root, [
    'rev-parse',
    '--verify',
    PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagRef,
  ]);
  const sealedV2PeeledCommit = runGitText(root, [
    'rev-list',
    '-n',
    '1',
    PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagRef,
  ]);
  if (
    branch === null ||
    head === null ||
    upstream === null ||
    origin === null ||
    status === null ||
    tagObjectId === null ||
    tagObjectKind === null ||
    peeledCommit === null ||
    rawTag === null ||
    originTagObjectId === null ||
    sealedV2TagObjectId === null ||
    sealedV2PeeledCommit === null
  )
    return null;
  const parsedTag = parseAnnotatedTag(rawTag);
  if (parsedTag === null) return null;
  const bundle = computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256(
    root,
    peeledCommit,
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
    tag: {
      name: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG,
      ref: PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
      objectKind: tagObjectKind,
      objectId: tagObjectId,
      originObjectId: originTagObjectId,
      peeledCommit,
      targetCommit: parsedTag.targetCommit,
      message: parsedTag.message,
    },
    sourceBundleSha256: bundle.sha256,
    currentLineageEvidencePaths: evidencePaths,
    sealedV2TagObjectId,
    sealedV2PeeledCommit,
  });
}

function inspectOriginTagObjectId(root: string): string | null {
  const output = runGitText(root, [
    'ls-remote',
    '--tags',
    'origin',
    PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF,
  ]);
  if (output === null) return null;
  const fields = output.split(/\s+/u);
  return fields.length === 2 &&
    fields[1] === PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG_REF &&
    COMMIT.safeParse(fields[0]).success
    ? fields[0]
    : null;
}

function parseAnnotatedTag(
  rawTag: string,
): Readonly<{ targetCommit: string; message: string }> | null {
  try {
    const normalized = rawTag.replace(/\r\n/gu, '\n').replace(/\n$/u, '');
    const separator = normalized.indexOf('\n\n');
    if (separator < 0) return null;
    const header = normalized.slice(0, separator).split('\n');
    const message = normalized.slice(separator + 2);
    if (
      header.length !== 4 ||
      !header[0]?.startsWith('object ') ||
      header[1] !== 'type commit' ||
      header[2] !== `tag ${PHASE_6_9_8_SR5_RUNTIME_APPROVED_TAG}` ||
      !header[3]?.startsWith('tagger ')
    )
      return null;
    const targetCommit = header[0].slice('object '.length);
    return COMMIT.safeParse(targetCommit).success && message.length > 0
      ? Object.freeze({ targetCommit, message })
      : null;
  } catch {
    return null;
  }
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
          const relative = directory === root ? entry.name : `.tmp/${entry.name}`;
          if (isPhase698Sr5NextLineageEvidenceRelativePath(relative)) output.push(relative);
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
    const requested = resolve(repositoryRoot);
    const metadata = lstatSync(requested);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const canonical = realpathSync(requested);
    if (normalizePath(canonical) !== normalizePath(requested)) return null;
    const reported = runGitText(canonical, ['rev-parse', '--show-toplevel']);
    if (reported === null) return null;
    return normalizePath(realpathSync(reported)) === normalizePath(canonical) ? canonical : null;
  } catch {
    return null;
  }
}

function runGitText(root: string, args: readonly string[], trim = true): string | null {
  try {
    const result = spawnSync('git', ['-C', root, ...args], {
      encoding: 'buffer',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
    });
    if (result.status !== 0 || result.signal !== null || !(result.stdout instanceof Uint8Array))
      return null;
    const output = new TextDecoder('utf-8', { fatal: true }).decode(result.stdout);
    return trim ? output.trim() : output.replace(/\r?\n$/u, '');
  } catch {
    return null;
  }
}

function readOwnDataProperty(value: object, key: PropertyKey): unknown {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function invalid() {
  return Object.freeze({ ok: false as const, reasonCode: 'final_git_source_invalid' as const });
}

function invalidCapability(): Error {
  return new Error('PHASE_6_9_8_SR5_FINAL_GIT_CAPABILITY_INVALID');
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
