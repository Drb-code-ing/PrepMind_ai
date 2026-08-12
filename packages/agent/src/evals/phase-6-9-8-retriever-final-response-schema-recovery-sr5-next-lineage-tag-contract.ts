import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { computePhase698RetrieverSchemaRecoverySr5GitObjectBundleSha256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_OBJECTS,
  PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
  isPhase698Sr5NextLineageEvidenceRelativePath,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-admission.ts';

const GIT_TIMEOUT_MS = 10_000;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SHA256_REF = z.string().regex(/^sha256:[0-9a-f]{64}$/u);

export const PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-tag-contract-v1' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_next_lineage_tag_parity' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_GATE =
  'sr5_next_lineage_annotated_tag_verified_zero_provider' as const;
export const PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_TITLE =
  'Phase 6.9.8 SR5 next-lineage v3 approved source' as const;

export type Phase698Sr5NextLineageTagObservation = Readonly<{
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

export type Phase698Sr5NextLineageTagBinding = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION;
  lineage: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE;
  authority: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_AUTHORITY;
  gate: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_GATE;
  qualityAuthority: 'none';
  mode: 'zero_provider_tag_parity';
  branch: 'main';
  sourceCommit: string;
  sourceManifestSha256: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256;
  sourceBundleSha256: string;
  approvedTag: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG;
  approvedTagObjectId: string;
  annotatedTagVerified: true;
  providerDispatchAllowed: false;
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
  businessWrites: 0;
  liveAuthorizationDefined: false;
  dataBoundaryAcceptanceDefined: false;
}>;

export type Phase698Sr5NextLineageTagCapability = Readonly<{
  version: typeof PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION;
}>;

const issuedCapabilities = new WeakMap<
  object,
  Readonly<{
    authority: 'git_verified' | 'synthetic_test';
    binding: Phase698Sr5NextLineageTagBinding;
  }>
>();
const consumedCapabilities = new WeakSet<object>();

export function createPhase698Sr5NextLineageTagMessage(sourceBundleSha256: string): string {
  if (!SHA256_REF.safeParse(sourceBundleSha256).success) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_SOURCE_BUNDLE_INVALID');
  }
  return [
    PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_TITLE,
    `lineage=${PHASE_6_9_8_SR5_NEXT_LINEAGE}`,
    `sourceManifestSha256=${PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256}`,
    `sourceBundleSha256=${sourceBundleSha256}`,
    `sealedV2TagObjectId=${PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId}`,
    `sealedV2PeeledCommit=${PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit}`,
    'zero-provider=providerCalls:0,credentialReads:0,formalEvidence:0,businessWrites:0,qualityAuthority:none',
  ].join('\n\n');
}

export function verifyPhase698Sr5NextLineageTagParity(repositoryRoot: string):
  | Readonly<{
      ok: true;
      binding: Phase698Sr5NextLineageTagBinding;
      capability: Phase698Sr5NextLineageTagCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'next_lineage_tag_parity_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  return observation === null ? invalidParity() : issueFromObservation(observation, 'git_verified');
}

export function validatePhase698Sr5NextLineageTagObservationForTest(
  observation: Phase698Sr5NextLineageTagObservation,
): boolean {
  return bindingFromObservation(observation) !== null;
}

export function createPhase698Sr5NextLineageSyntheticTagObservationForTest(
  commit = 'a'.repeat(40),
  sourceBundleSha256 = `sha256:${'b'.repeat(64)}`,
): Phase698Sr5NextLineageTagObservation {
  return deepFreeze({
    branch: 'main',
    head: commit,
    upstream: commit,
    origin: commit,
    clean: true,
    tag: {
      name: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
      ref: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
      objectKind: 'tag',
      objectId: 'c'.repeat(40),
      originObjectId: 'c'.repeat(40),
      peeledCommit: commit,
      targetCommit: commit,
      message: createPhase698Sr5NextLineageTagMessage(sourceBundleSha256),
    },
    sourceBundleSha256,
    currentLineageEvidencePaths: [],
    sealedV2TagObjectId: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId,
    sealedV2PeeledCommit: PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit,
  });
}

export function createPhase698Sr5NextLineageSyntheticTagBindingForTest(
  observation: Phase698Sr5NextLineageTagObservation = createPhase698Sr5NextLineageSyntheticTagObservationForTest(),
) {
  const result = issueFromObservation(observation, 'synthetic_test');
  if (!result.ok) throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_SYNTHETIC_TAG_INVALID');
  return result;
}

export function consumePhase698Sr5NextLineageTagCapability(
  capability: unknown,
  expectedAuthority: 'git_verified' | 'synthetic_test',
): Phase698Sr5NextLineageTagBinding {
  if (!isObject(capability) || consumedCapabilities.has(capability)) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(capability, 'version');
  } catch {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
  }
  const issued = issuedCapabilities.get(capability);
  if (
    !descriptor ||
    !('value' in descriptor) ||
    descriptor.value !== PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION ||
    !issued ||
    issued.authority !== expectedAuthority
  ) {
    throw new Error('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
  }
  consumedCapabilities.add(capability);
  return issued.binding;
}

function issueFromObservation(
  observation: Phase698Sr5NextLineageTagObservation,
  authority: 'git_verified' | 'synthetic_test',
):
  | Readonly<{
      ok: true;
      binding: Phase698Sr5NextLineageTagBinding;
      capability: Phase698Sr5NextLineageTagCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'next_lineage_tag_parity_invalid' }> {
  const binding = bindingFromObservation(observation);
  if (binding === null) return invalidParity();
  const capability = Object.freeze({ version: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION });
  issuedCapabilities.set(capability, { authority, binding });
  return Object.freeze({ ok: true as const, binding, capability });
}

function bindingFromObservation(
  observation: Phase698Sr5NextLineageTagObservation,
): Phase698Sr5NextLineageTagBinding | null {
  try {
    if (
      observation.branch !== 'main' ||
      observation.clean !== true ||
      observation.head !== observation.upstream ||
      observation.head !== observation.origin ||
      observation.tag.name !== PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG ||
      observation.tag.ref !== PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF ||
      observation.tag.objectKind !== 'tag' ||
      observation.tag.originObjectId !== observation.tag.objectId ||
      observation.tag.peeledCommit !== observation.head ||
      observation.tag.targetCommit !== observation.head ||
      observation.tag.message !==
        createPhase698Sr5NextLineageTagMessage(observation.sourceBundleSha256) ||
      observation.currentLineageEvidencePaths.length !== 0 ||
      observation.sealedV2TagObjectId !== PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.tagObjectId ||
      observation.sealedV2PeeledCommit !== PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.peeledCommit ||
      !COMMIT.safeParse(observation.head).success ||
      !COMMIT.safeParse(observation.tag.objectId).success ||
      !SHA256_REF.safeParse(observation.sourceBundleSha256).success
    ) {
      return null;
    }
    return deepFreeze({
      version: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION,
      lineage: PHASE_6_9_8_SR5_NEXT_LINEAGE,
      authority: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_AUTHORITY,
      gate: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_GATE,
      qualityAuthority: 'none' as const,
      mode: 'zero_provider_tag_parity' as const,
      branch: 'main' as const,
      sourceCommit: observation.head,
      sourceManifestSha256: PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
      sourceBundleSha256: observation.sourceBundleSha256,
      approvedTag: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
      approvedTagObjectId: observation.tag.objectId,
      annotatedTagVerified: true as const,
      providerDispatchAllowed: false as const,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
      businessWrites: 0 as const,
      liveAuthorizationDefined: false as const,
      dataBoundaryAcceptanceDefined: false as const,
    });
  } catch {
    return null;
  }
}

function inspectRepository(rootInput: string): Phase698Sr5NextLineageTagObservation | null {
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
    PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
  ]);
  const tagObjectKind = runGitText(root, [
    'cat-file',
    '-t',
    PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
  ]);
  const peeledCommit = runGitText(root, [
    'rev-list',
    '-n',
    '1',
    PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
  ]);
  const rawTag = runGitText(
    root,
    ['cat-file', 'tag', PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF],
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
      name: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
      ref: PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
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
    PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF,
  ]);
  if (output === null) return null;
  const fields = output.split(/\s+/u);
  return fields.length === 2 &&
    fields[1] === PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG_REF &&
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
      header[2] !== `tag ${PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG}` ||
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
    const requested = realpathSync(resolve(repositoryRoot));
    const metadata = lstatSync(requested);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const reported = runGitText(requested, ['rev-parse', '--show-toplevel']);
    if (reported === null) return null;
    const actual = realpathSync(reported);
    return normalizePath(requested) === normalizePath(actual) ? actual : null;
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
    const text = new TextDecoder('utf-8', { fatal: true }).decode(result.stdout);
    return trim ? text.trim() : text.replace(/\r?\n$/u, '');
  } catch {
    return null;
  }
}

function invalidParity() {
  return Object.freeze({
    ok: false as const,
    reasonCode: 'next_lineage_tag_parity_invalid' as const,
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
