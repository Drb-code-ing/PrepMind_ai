import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { connect } from 'node:net';
import { isAbsolute, join, resolve } from 'node:path';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  runPhase697ArchitectureRecoveryProxyPreflight,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
  PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
} from './phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_DETACHED_SOURCE_MANIFEST_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256,
} from './phase-6-9-tutor-organizer-schema-recovery-sr5-source-manifest.ts';
import { validatePhase697FullGateBundle } from './phase-6-9-tutor-organizer-full-gate-durability.ts';
import { computePhase697FullGateCanonicalSha256 } from './phase-6-9-tutor-organizer-full-gate-manifest.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_AUTHORITY_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-authority-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-source-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-admission-manifest-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CONTROLLED_BRANCH =
  'codex/phase-6-9-7-tutor-wrong-question-agents' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF =
  'refs/tags/phase-6-9-7-tutor-organizer-schema-recovery-sr5-approved' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVAL_ENV =
  'PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR5_APPROVED' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CREDENTIAL_ENV =
  'PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR5_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-proxy-attestation-v1' as const;

const L3_RUN_ID = '2b0ac3a0-631f-4c7f-9781-ce0cda94149a';
const L3_PHYSICAL_ARTIFACT_SHA256 =
  'e081939bb7f4b17235b1d9afb61d78031879bb80b9d64c952e4b86531cd7dbe5';
const SR4_REVIEWED_MOCK_FACTORY_SHA256 =
  'sha256:8f18c1c2a73790818f63b64e0da67852900d341c99b9f599e9838eba41c93d44';
const SR4_REVIEWED_MOCK_CHECKPOINT_SHA256 =
  '03bb81a65b0ae838646191fb58abf2dcf0af73f5e720812b5789a185afcb6960';
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const GIT_TIMEOUT_MS = 10_000;

/**
 * Every executable or authority-bearing dependency used by the SR5 process is
 * hashed as one ordered bundle, including this authority implementation. Only
 * the detached hash anchor is excluded to avoid an impossible self-reference;
 * that anchor is bound by the approved commit/tag and remote parity.
 */
export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/scripts/phase-6-9-7-tutor-organizer-schema-recovery-sr5-cli.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-authority.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-authority.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-mock.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-cli-core.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-live.ts',
  'packages/agent/src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-authority.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-live.ts',
  'packages/agent/src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts',
  'packages/agent/src/evals/run-phase-6-9-tutor-organizer-full-gate.ts',
  'packages/agent/src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts',
  'packages/agent/src/evals/phase-6-9-tutor-wrong-question-v6-eval-case.ts',
  'packages/agent/src/model-candidates/tutor-schema-recovery-contract.ts',
  'packages/agent/src/model-candidates/tutor-schema-recovery-model-candidate.ts',
  'packages/agent/src/model-candidates/tutor-v6-model-contract.ts',
  'packages/agent/src/model-candidates/tutor-v6-model-projection.ts',
  'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-candidate.ts',
  'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-contract.ts',
  'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-projection.ts',
  'packages/agent/src/model-candidates/wrong-question-organizer-v9-option-authority.ts',
  'packages/agent/src/nodes/tutor.ts',
  'packages/agent/src/policies/tutor-strategy-policy.ts',
  'packages/ai/src/first-party-deepseek-v4-pro-direct.ts',
  'packages/ai/src/index.ts',
  'packages/ai/src/model-agent-runtime.ts',
  'packages/ai/src/phase-6-9-7-architecture-recovery-proxy-preflight.ts',
] as const);

const SR5_ADMISSION_MANIFEST = deepFreeze({
  version: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_VERSION,
  lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
  sr3SourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
  sr4ReviewedMockFactorySha256: SR4_REVIEWED_MOCK_FACTORY_SHA256,
  sr4ReviewedMockCheckpointSha256: SR4_REVIEWED_MOCK_CHECKPOINT_SHA256,
  runnableSourcePaths: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS,
  detachedSourceManifestVersion: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_DETACHED_SOURCE_MANIFEST_VERSION,
  runnableSourceBundleSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256,
  oldL3: {
    runId: L3_RUN_ID,
    physicalArtifactSha256: L3_PHYSICAL_ARTIFACT_SHA256,
  },
});

export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256 =
  computePhase697FullGateCanonicalSha256(SR5_ADMISSION_MANIFEST);

export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA = z
  .object({
    sourceVersion: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_VERSION),
    lineage: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE),
    branch: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CONTROLLED_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedRunnableSourceRef: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF),
    approvedRunnableSourceCommit: COMMIT,
    trackedWorktreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceManifestSha256: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256),
    admissionManifestSha256: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256),
    runnableSourceBundleSha256: z.literal(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256,
    ),
    historicalL3: z
      .object({
        runId: z.literal(L3_RUN_ID),
        gate: z.literal('full_gate_quality_gate_failed'),
        qualityAuthority: z.literal('none'),
        physicalArtifactSha256: z.literal(L3_PHYSICAL_ARTIFACT_SHA256),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedRunnableSourceCommit
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_commit_parity_mismatch' });
    }
  });

export type Phase697SchemaRecoverySr5Source = z.infer<
  typeof PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA
>;

/** Synthetic-only source for zero-network SR5 admission tests. */
export function createPhase697SchemaRecoverySr5SyntheticSourceForTest(
  commit = 'b'.repeat(40),
): Phase697SchemaRecoverySr5Source {
  return PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.parse({
    sourceVersion: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_VERSION,
    lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
    branch: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CONTROLLED_BRANCH,
    commit,
    trackingCommit: commit,
    remoteCommit: commit,
    approvedRunnableSourceRef: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
    approvedRunnableSourceCommit: commit,
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    sourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
    admissionManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    runnableSourceBundleSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_BUNDLE_SHA256,
    historicalL3: {
      runId: L3_RUN_ID,
      gate: 'full_gate_quality_gate_failed',
      qualityAuthority: 'none',
      physicalArtifactSha256: L3_PHYSICAL_ARTIFACT_SHA256,
    },
  });
}

export type Phase697SchemaRecoverySr5ProxyAttestation = Readonly<{
  version: typeof PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION;
}>;
export type Phase697SchemaRecoverySr5ConsumedProxyAttestation = Readonly<{
  version: typeof PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION;
}>;
export type Phase697SchemaRecoverySr5ProxyRecord = Readonly<{
  version: typeof PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION;
  status: 'direct_ready' | 'loopback_proxy_ready';
  providerCalls: 0;
}>;

type AttestationState = {
  authority: 'controlled_live' | 'synthetic_test';
  status: Phase697SchemaRecoverySr5ProxyRecord['status'];
  consumed: boolean;
};
const ATTESTATIONS = new WeakMap<object, AttestationState>();
const CONSUMED_ATTESTATIONS = new WeakMap<
  object,
  AttestationState & { reservationClaimed: boolean }
>();

const FORMAL_MARKER = 'phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live.marker';
const FORMAL_JOURNAL =
  /^phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live-[0-9a-f-]{36}\.journal\.jsonl$/u;
const FORMAL_CLAIM =
  /^phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live-[0-9a-f-]{36}\.recovery\.claim$/u;
const FORMAL_ARTIFACT =
  /^phase-6-9-7-tutor-organizer-schema-recovery-sr5-(branch|main)-controlled-live-[0-9a-f-]{36}\.json$/u;

export async function runPhase697SchemaRecoverySr5ProductionProxyPreflight(
  signal: AbortSignal,
): Promise<Phase697SchemaRecoverySr5ProxyAttestation> {
  if (!isAbortSignal(signal)) throw authorityError();
  const result = await runPhase697ArchitectureRecoveryProxyPreflight(
    { env: snapshotProxyEnvironment(), signal },
    { probeLoopbackListener },
  );
  if (
    !result.ok ||
    result.providerCalls !== 0 ||
    (result.code !== 'direct_ready' && result.code !== 'loopback_proxy_ready')
  ) {
    throw authorityError();
  }
  return mintAttestation('controlled_live', result.code);
}

/** Synthetic-only opaque capability for zero-network authority tests. */
export function createPhase697SchemaRecoverySr5SyntheticProxyAttestationForTest(
  status: Phase697SchemaRecoverySr5ProxyRecord['status'] = 'direct_ready',
) {
  return mintAttestation('synthetic_test', status);
}

export function consumePhase697SchemaRecoverySr5ProxyAttestation(
  value: unknown,
  authority: 'controlled_live' | 'synthetic_test',
): Phase697SchemaRecoverySr5ConsumedProxyAttestation {
  try {
    if (typeof value !== 'object' || value === null) throw authorityError();
    const state = ATTESTATIONS.get(value);
    if (!state || state.authority !== authority || state.consumed) throw authorityError();
    state.consumed = true;
    const consumed = Object.freeze({
      version: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION,
    });
    CONSUMED_ATTESTATIONS.set(consumed, { ...state, reservationClaimed: false });
    return consumed;
  } catch {
    throw authorityError();
  }
}

export function claimPhase697SchemaRecoverySr5ConsumedProxyAttestation(
  value: unknown,
  authority: 'controlled_live' | 'synthetic_test',
): Phase697SchemaRecoverySr5ProxyRecord {
  try {
    if (typeof value !== 'object' || value === null) throw authorityError();
    const state = CONSUMED_ATTESTATIONS.get(value);
    if (!state || state.authority !== authority || state.reservationClaimed) throw authorityError();
    state.reservationClaimed = true;
    return Object.freeze({
      version: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION,
      status: state.status,
      providerCalls: 0 as const,
    });
  } catch {
    throw authorityError();
  }
}

/**
 * Reads only git/source/history/formal-file state. Approval and credential are
 * deliberately separate and cannot be observed until this admission succeeds.
 */
export async function readPhase697SchemaRecoverySr5Source(
  rawRoot: string,
): Promise<Readonly<Phase697SchemaRecoverySr5Source>> {
  try {
    const root = await requireRoot(rawRoot);
    const branch = gitOutput(root, ['branch', '--show-current']);
    if (branch !== PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CONTROLLED_BRANCH) throw authorityError();
    const commit = gitOutput(root, ['rev-parse', 'HEAD']);
    const trackingRef = gitOutput(root, ['rev-parse', '--symbolic-full-name', '@{upstream}']);
    if (trackingRef !== `refs/remotes/origin/${branch}`) throw authorityError();
    const trackingCommit = gitOutput(root, ['rev-parse', trackingRef]);
    const remoteCommit = gitRemoteRefCommit(root, `refs/heads/${branch}`);
    const approvedRunnableSourceCommit = gitOutput(root, [
      'rev-parse',
      `${PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF}^{commit}`,
    ]);
    const remoteApprovedRunnableSourceCommit = gitRemoteRefCommit(
      root,
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
    );
    if (approvedRunnableSourceCommit !== commit || remoteApprovedRunnableSourceCommit !== commit) {
      throw authorityError();
    }
    const trackedWorktreeClean =
      gitStatus(root, ['diff', '--quiet']) === 0 &&
      gitStatus(root, ['diff', '--cached', '--quiet']) === 0;
    const formalArtifactCount = await countFormalArtifacts(root);
    const runnableSourceBundleSha256 = await hashRunnableSourceBundle(root);
    const historicalL3 = await validatePhase697FullGateBundle({ root });
    if (
      !historicalL3.ok ||
      historicalL3.runId !== L3_RUN_ID ||
      historicalL3.gate !== 'full_gate_quality_gate_failed' ||
      historicalL3.qualityAuthority !== 'none' ||
      historicalL3.physicalArtifactSha256 !== L3_PHYSICAL_ARTIFACT_SHA256
    ) {
      throw authorityError();
    }
    return deepFreeze(
      PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA.parse({
        sourceVersion: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_VERSION,
        lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
        branch,
        commit,
        trackingCommit,
        remoteCommit,
        approvedRunnableSourceRef: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVED_SOURCE_REF,
        approvedRunnableSourceCommit,
        trackedWorktreeClean,
        formalArtifactCount,
        sourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
        admissionManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
        runnableSourceBundleSha256,
        historicalL3: {
          runId: historicalL3.runId,
          gate: historicalL3.gate,
          qualityAuthority: historicalL3.qualityAuthority,
          physicalArtifactSha256: historicalL3.physicalArtifactSha256,
        },
      }),
    );
  } catch {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_INVALID');
  }
}

export function readPhase697SchemaRecoverySr5Approval(
  env: Readonly<Record<string, string | undefined>>,
): true {
  if (
    readEnv(env, PHASE_6_9_7_SCHEMA_RECOVERY_SR5_APPROVAL_ENV) !==
    PHASE_6_9_7_SCHEMA_RECOVERY_SR5_EXACT_CONFIRMATION
  ) {
    throw authorityError();
  }
  return true;
}

export function readPhase697SchemaRecoverySr5Credential(
  env: Readonly<Record<string, string | undefined>>,
) {
  const credential = readEnv(env, PHASE_6_9_7_SCHEMA_RECOVERY_SR5_CREDENTIAL_ENV);
  if (!isCredential(credential)) throw authorityError();
  return credential;
}

/** Read-only bundle recomputation used by admission tests and release tooling. */
export async function computePhase697SchemaRecoverySr5RunnableSourceBundleSha256(rawRoot: string) {
  const root = await requireRoot(rawRoot);
  return hashRunnableSourceBundle(root);
}

async function hashRunnableSourceBundle(root: string) {
  const entries = [] as Array<{ path: string; sha256: string }>;
  for (const path of PHASE_6_9_7_SCHEMA_RECOVERY_SR5_RUNNABLE_SOURCE_PATHS) {
    entries.push({ path, sha256: await sha256RegularFile(join(root, ...path.split('/'))) });
  }
  return computePhase697FullGateCanonicalSha256(entries);
}

async function countFormalArtifacts(root: string) {
  let entries: string[];
  try {
    entries = await readdir(join(root, '.tmp'));
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return 0;
    throw error;
  }
  return entries.filter(
    (entry) =>
      entry === FORMAL_MARKER ||
      FORMAL_JOURNAL.test(entry) ||
      FORMAL_CLAIM.test(entry) ||
      FORMAL_ARTIFACT.test(entry),
  ).length;
}

function mintAttestation(
  authority: AttestationState['authority'],
  status: Phase697SchemaRecoverySr5ProxyRecord['status'],
) {
  const capability = Object.freeze({
    version: PHASE_6_9_7_SCHEMA_RECOVERY_SR5_PROXY_ATTESTATION_VERSION,
  });
  ATTESTATIONS.set(capability, { authority, status, consumed: false });
  return capability;
}

function snapshotProxyEnvironment(): Record<string, unknown> {
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
    try {
      const value = process.env[key];
      if (value !== undefined) {
        Object.defineProperty(snapshot, key, {
          enumerable: true,
          configurable: false,
          writable: false,
          value,
        });
      }
    } catch {
      Object.defineProperty(snapshot, key, {
        enumerable: true,
        configurable: false,
        writable: false,
        value: null,
      });
    }
  }
  return Object.freeze(snapshot);
}

async function probeLoopbackListener(input: {
  host: '127.0.0.1' | '::1';
  port: number;
  timeoutMs: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS;
  signal: AbortSignal;
}) {
  if (isAborted(input.signal)) return false;
  return new Promise<boolean>((resolvePromise) => {
    let settled = false;
    const socket = connect({ host: input.host, port: input.port });
    const timer = setTimeout(() => finish(false), input.timeoutMs);
    const abort = () => finish(false);
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
      socket.destroy();
      resolvePromise(value);
    };
    input.signal.addEventListener('abort', abort, { once: true });
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function gitOutput(root: string, args: readonly string[]) {
  const result = spawnSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw authorityError();
  const output = result.stdout.trim();
  if (!output || output.includes('\0')) throw authorityError();
  return output;
}

function gitStatus(root: string, args: readonly string[]) {
  return spawnSync('git', [...args], {
    cwd: root,
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  }).status;
}

function gitRemoteRefCommit(root: string, ref: string) {
  if (!/^refs\/(heads|tags)\/[a-z0-9._\/-]+$/u.test(ref)) throw authorityError();
  const result = spawnSync('git', ['ls-remote', '--exit-code', 'origin', ref], {
    cwd: root,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw authorityError();
  const lines = result.stdout.trim().split(/\r?\n/u);
  if (lines.length !== 1) throw authorityError();
  const [commit, observedRef, extra] = lines[0].split(/\s+/u);
  if (extra !== undefined || observedRef !== ref || !/^[0-9a-f]{40}$/u.test(commit)) {
    throw authorityError();
  }
  return commit;
}

async function requireRoot(value: unknown) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    throw authorityError();
  }
  const root = resolve(value);
  const [stat, canonical] = await Promise.all([lstat(root), realpath(root)]);
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonical !== root) throw authorityError();
  return root;
}

async function sha256RegularFile(path: string) {
  const [stat, canonical] = await Promise.all([lstat(path), realpath(path)]);
  if (!stat.isFile() || stat.isSymbolicLink() || canonical !== resolve(path))
    throw authorityError();
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function readEnv(env: Readonly<Record<string, string | undefined>>, key: string) {
  try {
    const value = env[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
}

function isCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function authorityError() {
  return new Error('PHASE_6_9_7_SCHEMA_RECOVERY_SR5_AUTHORITY_REJECTED');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
