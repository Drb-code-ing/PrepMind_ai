import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Source,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import { validatePhase697ArchitectureRecoveryR3CanaryBundle } from './phase-6-9-7-architecture-recovery-r3-canary-durability.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_READER_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-source-reader-v1' as const;

const R3_PREFIX = 'phase-6-9-7-architecture-recovery-r3-provider-canary';
const R3_MARKER_RELATIVE_PATH = `.tmp/${R3_PREFIX}.once.json`;
const R3_JOURNAL_RELATIVE_PATH = `.tmp/${R3_PREFIX}.journal.jsonl`;
const R3_ARTIFACT_RELATIVE_PATH = `.tmp/${R3_PREFIX}-${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.runId}.json`;
const V2_EVIDENCE_FILE = new RegExp(
  `^${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.json$`,
  'u',
);
const GIT_TIMEOUT_MS = 10_000;

/**
 * Reads the complete C2 source authority before approval or credential access.
 * The remote value comes from a fresh `git ls-remote` observation, not only a
 * local remote-tracking ref. No command output or raw error escapes this API.
 */
export async function readPhase697ArchitectureRecoveryProviderCanaryV2C2Source(
  rawRoot: string,
): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Source> {
  try {
    const root = await requireRoot(rawRoot);
    const branch = gitOutput(root, ['branch', '--show-current']);
    const commit = gitOutput(root, ['rev-parse', 'HEAD']);
    const trackingRef = gitOutput(root, ['rev-parse', '--symbolic-full-name', '@{u}']);
    const expectedTrackingRef = `refs/remotes/origin/${branch}`;
    if (trackingRef !== expectedTrackingRef) throw new Error();
    const trackingCommit = gitOutput(root, ['rev-parse', trackingRef]);
    const remoteCommit = gitRemoteCommit(root, branch);
    const trackedWorktreeClean =
      gitStatus(root, ['diff', '--quiet']) === 0 &&
      gitStatus(root, ['diff', '--cached', '--quiet']) === 0;
    const formalArtifactCount = await countFormalV2Artifacts(root);
    const r3Bundle = await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root });
    const [r3MarkerSha256, r3JournalSha256, r3ArtifactSha256] = await Promise.all([
      sha256RegularFile(join(root, ...R3_MARKER_RELATIVE_PATH.split('/'))),
      sha256RegularFile(join(root, ...R3_JOURNAL_RELATIVE_PATH.split('/'))),
      sha256RegularFile(join(root, ...R3_ARTIFACT_RELATIVE_PATH.split('/'))),
    ]);
    return deepFreeze(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA.parse({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION,
        branch,
        commit,
        trackingCommit,
        remoteCommit,
        trackedWorktreeClean,
        formalArtifactCount,
        r3BundleValid:
          r3Bundle.ok &&
          r3Bundle.runId ===
            PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.runId,
        r3RunId: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_R3_PARITY.runId,
        r3MarkerSha256,
        r3JournalSha256,
        r3ArtifactSha256,
      }),
    );
  } catch {
    throw new Error('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE');
  }
}

async function countFormalV2Artifacts(root: string) {
  const tmp = join(root, '.tmp');
  const entries = await readdir(tmp);
  const fixed = new Set([
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH.split('/').at(-1),
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH.split('/').at(-1),
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH.split(
      '/',
    ).at(-1),
  ]);
  return entries.filter((entry) => fixed.has(entry) || V2_EVIDENCE_FILE.test(entry)).length;
}

function gitOutput(root: string, args: readonly string[]) {
  const result = spawnSync('git', [...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw new Error();
  const output = result.stdout.trim();
  if (output.length === 0 || output.includes('\0')) throw new Error();
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
  if (branch !== PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTROLLED_LIVE_BRANCH) {
    throw new Error();
  }
  const ref = `refs/heads/${branch}`;
  const result = spawnSync('git', ['ls-remote', '--exit-code', 'origin', ref], {
    cwd: root,
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw new Error();
  const lines = result.stdout.trim().split(/\r?\n/u);
  if (lines.length !== 1) throw new Error();
  const [commit, observedRef, extra] = lines[0].split(/\s+/u);
  if (extra !== undefined || observedRef !== ref || !/^[a-f0-9]{40}$/u.test(commit))
    throw new Error();
  return commit;
}

async function requireRoot(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\0') ||
    !isAbsolute(value)
  ) {
    throw new Error();
  }
  const root = resolve(value);
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
  return root;
}

async function sha256RegularFile(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
