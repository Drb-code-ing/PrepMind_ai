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

export const PHASE_6_9_7_SMALL_SAMPLE_CONTROLLED_LIVE_BRANCH =
  'codex/phase-6-9-7-tutor-wrong-question-agents' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_APPROVAL_ENV =
  'PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_APPROVED' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_CREDENTIAL_ENV =
  'PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-proxy-attestation-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_SOURCE_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-source-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF =
  'refs/tags/phase-6-9-7-tutor-organizer-small-sample-s2-approved' as const;

const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);

export const PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA = z
  .object({
    sourceVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_VERSION),
    branch: z.literal(PHASE_6_9_7_SMALL_SAMPLE_CONTROLLED_LIVE_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedRunnableSourceRef: z.literal(PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF),
    approvedRunnableSourceCommit: COMMIT,
    trackedWorktreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceHashes: z
      .object({
        tutorPromptSha256: SHA256,
        tutorSchemaSha256: SHA256,
        tutorMergerSha256: SHA256,
        organizerPromptSha256: SHA256,
        organizerSchemaSha256: SHA256,
        organizerMergerSha256: SHA256,
        adapterSha256: SHA256,
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

export type Phase697SmallSampleSource = z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA>;

export type Phase697SmallSampleProxyAttestation = Readonly<{
  version: typeof PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION;
}>;

export type Phase697SmallSampleConsumedProxyAttestation = Readonly<{
  version: typeof PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION;
}>;

export type Phase697SmallSampleProxyRecord = Readonly<{
  version: typeof PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION;
  status: 'direct_ready' | 'loopback_proxy_ready';
  providerCalls: 0;
}>;

type AttestationState = {
  authority: 'controlled_live' | 'synthetic_test';
  status: Phase697SmallSampleProxyRecord['status'];
  consumed: boolean;
};

const ATTESTATIONS = new WeakMap<object, AttestationState>();
const CONSUMED_ATTESTATIONS = new WeakMap<
  object,
  AttestationState & { reservationClaimed: boolean }
>();
const GIT_TIMEOUT_MS = 10_000;
const FORMAL_MARKER = 'phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.marker';
const FORMAL_JOURNAL =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-[0-9a-f-]{36}\.journal\.jsonl$/u;
const FORMAL_CLAIM =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-[0-9a-f-]{36}\.recovery\.claim$/u;
const FORMAL_ARTIFACT =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-(branch|main)-controlled-live-[0-9a-f-]{36}\.json$/u;

export async function runPhase697SmallSampleProductionProxyPreflight(
  signal: AbortSignal,
): Promise<Phase697SmallSampleProxyAttestation> {
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

/** Synthetic-only capability for local fault tests. It is rejected by the production consumer. */
export function createPhase697SmallSampleSyntheticProxyAttestationForTest(
  status: Phase697SmallSampleProxyRecord['status'] = 'direct_ready',
): Phase697SmallSampleProxyAttestation {
  return mintAttestation('synthetic_test', status);
}

export function consumePhase697SmallSampleProxyAttestation(
  value: unknown,
  authority: 'controlled_live' | 'synthetic_test',
): Phase697SmallSampleConsumedProxyAttestation {
  try {
    if (typeof value !== 'object' || value === null) throw authorityError();
    const state = ATTESTATIONS.get(value);
    if (!state || state.authority !== authority || state.consumed) throw authorityError();
    state.consumed = true;
    const consumed = Object.freeze({
      version: PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION,
    });
    CONSUMED_ATTESTATIONS.set(consumed, {
      authority,
      status: state.status,
      consumed: true,
      reservationClaimed: false,
    });
    return consumed;
  } catch {
    throw authorityError();
  }
}

/**
 * Claims the already-consumed opaque capability exactly once at the marker
 * boundary. A plain object, clone, replay, or cross-process value has no
 * WeakMap record and is rejected before any filesystem await.
 */
export function claimPhase697SmallSampleConsumedProxyAttestation(
  value: unknown,
  authority: 'controlled_live' | 'synthetic_test',
): Phase697SmallSampleProxyRecord {
  try {
    if (typeof value !== 'object' || value === null) throw authorityError();
    const state = CONSUMED_ATTESTATIONS.get(value);
    if (!state || state.authority !== authority || state.reservationClaimed) {
      throw authorityError();
    }
    state.reservationClaimed = true;
    return Object.freeze({
      version: PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION,
      status: state.status,
      providerCalls: 0 as const,
    });
  } catch {
    throw authorityError();
  }
}

/**
 * Reads source identity before approval or credential access. Remote parity is
 * observed with a fresh ls-remote call; raw git output never crosses this API.
 */
export async function readPhase697SmallSampleSource(
  rawRoot: string,
): Promise<Readonly<Phase697SmallSampleSource>> {
  try {
    const root = await requireRoot(rawRoot);
    const branch = gitOutput(root, ['branch', '--show-current']);
    if (branch !== PHASE_6_9_7_SMALL_SAMPLE_CONTROLLED_LIVE_BRANCH) throw authorityError();
    const commit = gitOutput(root, ['rev-parse', 'HEAD']);
    const trackingRef = gitOutput(root, ['rev-parse', '--symbolic-full-name', '@{upstream}']);
    if (trackingRef !== `refs/remotes/origin/${branch}`) throw authorityError();
    const trackingCommit = gitOutput(root, ['rev-parse', trackingRef]);
    const remoteCommit = gitRemoteCommit(root, branch);
    const approvedRunnableSourceCommit = gitOutput(root, [
      'rev-parse',
      `${PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF}^{commit}`,
    ]);
    const remoteApprovedRunnableSourceCommit = gitRemoteRefCommit(
      root,
      PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF,
    );
    if (approvedRunnableSourceCommit !== commit || remoteApprovedRunnableSourceCommit !== commit) {
      throw authorityError();
    }
    const trackedWorktreeClean =
      gitStatus(root, ['diff', '--quiet']) === 0 &&
      gitStatus(root, ['diff', '--cached', '--quiet']) === 0;
    const formalArtifactCount = await countFormalArtifacts(root);
    const sourceHashes = await hashRunnableSources(root);
    return deepFreeze(
      PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA.parse({
        sourceVersion: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_VERSION,
        branch,
        commit,
        trackingCommit,
        remoteCommit,
        approvedRunnableSourceRef: PHASE_6_9_7_SMALL_SAMPLE_APPROVED_SOURCE_REF,
        approvedRunnableSourceCommit,
        trackedWorktreeClean,
        formalArtifactCount,
        sourceHashes,
      }),
    );
  } catch {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_SOURCE_INVALID');
  }
}

export function readPhase697SmallSampleApproval(
  env: Readonly<Record<string, string | undefined>>,
): true {
  if (
    readEnv(env, PHASE_6_9_7_SMALL_SAMPLE_APPROVAL_ENV) !==
    PHASE_6_9_7_SMALL_SAMPLE_EXACT_CONFIRMATION
  ) {
    throw authorityError();
  }
  return true;
}

export function readPhase697SmallSampleCredential(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const credential = readEnv(env, PHASE_6_9_7_SMALL_SAMPLE_CREDENTIAL_ENV);
  if (!isCredential(credential)) throw authorityError();
  return credential;
}

async function hashRunnableSources(
  root: string,
): Promise<Readonly<Phase697SmallSampleSource['sourceHashes']>> {
  const paths = {
    tutorPromptSha256: 'packages/agent/src/model-candidates/tutor-v6-model-projection.ts',
    tutorSchemaSha256: 'packages/agent/src/model-candidates/tutor-v6-model-contract.ts',
    tutorMergerSha256: 'packages/agent/src/model-candidates/tutor-v6-model-candidate.ts',
    organizerPromptSha256:
      'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-projection.ts',
    organizerSchemaSha256:
      'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-contract.ts',
    organizerMergerSha256:
      'packages/agent/src/model-candidates/wrong-question-organizer-v9-model-candidate.ts',
    adapterSha256: 'packages/ai/src/first-party-deepseek-v4-pro-direct.ts',
  } as const;
  const hash = (relativePath: string) => sha256RegularFile(join(root, ...relativePath.split('/')));
  const [
    tutorPromptSha256,
    tutorSchemaSha256,
    tutorMergerSha256,
    organizerPromptSha256,
    organizerSchemaSha256,
    organizerMergerSha256,
    adapterSha256,
  ] = await Promise.all([
    hash(paths.tutorPromptSha256),
    hash(paths.tutorSchemaSha256),
    hash(paths.tutorMergerSha256),
    hash(paths.organizerPromptSha256),
    hash(paths.organizerSchemaSha256),
    hash(paths.organizerMergerSha256),
    hash(paths.adapterSha256),
  ]);
  return Object.freeze({
    tutorPromptSha256,
    tutorSchemaSha256,
    tutorMergerSha256,
    organizerPromptSha256,
    organizerSchemaSha256,
    organizerMergerSha256,
    adapterSha256,
  });
}

async function countFormalArtifacts(root: string) {
  const tmp = join(root, '.tmp');
  let entries: string[];
  try {
    entries = await readdir(tmp);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
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
  status: Phase697SmallSampleProxyRecord['status'],
) {
  const capability = Object.freeze({
    version: PHASE_6_9_7_SMALL_SAMPLE_PROXY_ATTESTATION_VERSION,
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

function gitRemoteCommit(root: string, branch: string) {
  return gitRemoteRefCommit(root, `refs/heads/${branch}`);
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
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0'))
    throw authorityError();
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

function authorityError() {
  return new Error('PHASE_6_9_7_SMALL_SAMPLE_AUTHORITY_REJECTED');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
