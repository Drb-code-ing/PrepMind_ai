import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_P1_MANIFEST,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import { PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import {
  PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
  PHASE_6_9_8_P1_L2_APPROVED_TAG,
  PHASE_6_9_8_P1_L2_LINEAGE,
  type Phase698P1L2SourceSnapshot,
} from './phase-6-9-8-retriever-final-response-p1-l2-admission.ts';
import { isPhase698P1L2FormalRelativePath } from './phase-6-9-8-retriever-final-response-p1-l2-contract.ts';
const PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256 =
  'sha256:8ad0a12ae7bd6365873631cb4908b41888617b9599fdd6865cf7e45c788f0e7d' as const;
const PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256 =
  'b492487db888a2e2d89810faac8cc7b0e50c36b464fb6eb6cfa9a4bc4680a532' as const;

const SHA40 = /^[0-9a-f]{40}$/u;
export type Phase698P1L2RepositoryObservation = Readonly<{
  root: string;
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  clean: boolean;
  approvedTag: Readonly<{ name: string; commit: string }>;
  formalEvidencePaths: readonly string[];
  oldLineagePaths: readonly string[];
}>;

export function inspectPhase698P1L2Source(
  repositoryRoot: string,
):
  | Readonly<{ ok: true; source: Phase698P1L2SourceSnapshot }>
  | Readonly<{ ok: false; code: 'source_admission_invalid' }> {
  const observation = inspectRepository(repositoryRoot);
  if (
    !observation ||
    !observation.clean ||
    observation.branch !== PHASE_6_9_8_P1_L2_APPROVED_BRANCH ||
    observation.head !== observation.upstream ||
    observation.head !== observation.origin ||
    observation.approvedTag.commit !== observation.head ||
    observation.formalEvidencePaths.length !== 0 ||
    observation.oldLineagePaths.length !== 0
  )
    return { ok: false, code: 'source_admission_invalid' };
  return {
    ok: true,
    source: Object.freeze({
      branch: observation.branch,
      head: observation.head,
      upstream: observation.upstream,
      origin: observation.origin,
      clean: true,
      approvedTag: observation.approvedTag,
      manifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
      baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
      s2FactorySha256: PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
      final11CompatibilitySha256: PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256,
      formalEvidencePaths: [],
      oldLineagePaths: [],
    }),
  };
}

export function inspectPhase698P1L2SourceForTest(repositoryRoot: string) {
  return inspectRepository(repositoryRoot);
}

function inspectRepository(repositoryRoot: string): Phase698P1L2RepositoryObservation | null {
  const root = trustedRoot(repositoryRoot);
  if (!root) return null;
  const branch = git(root, ['branch', '--show-current']);
  const head = git(root, ['rev-parse', '--verify', 'HEAD']);
  const upstream = git(root, ['rev-parse', '--verify', '@{upstream}']);
  const origin = git(root, [
    'rev-parse',
    '--verify',
    `refs/remotes/origin/${PHASE_6_9_8_P1_L2_APPROVED_BRANCH}`,
  ]);
  const tagCommit = git(root, [
    'rev-parse',
    '--verify',
    `refs/tags/${PHASE_6_9_8_P1_L2_APPROVED_TAG}^{commit}`,
  ]);
  const status = git(root, ['status', '--porcelain=v1', '--untracked-files=all'], false);
  if (
    !branch ||
    !head ||
    !upstream ||
    !origin ||
    !tagCommit ||
    !isPhase698P1L2GitStatusClean(status) ||
    !SHA40.test(head) ||
    !SHA40.test(upstream) ||
    !SHA40.test(origin) ||
    !SHA40.test(tagCommit)
  )
    return null;
  const paths = scanFormal(root);
  return Object.freeze({
    root,
    branch,
    head,
    upstream,
    origin,
    clean: isPhase698P1L2GitStatusClean(status),
    approvedTag: { name: PHASE_6_9_8_P1_L2_APPROVED_TAG, commit: tagCommit },
    formalEvidencePaths: paths.formal,
    oldLineagePaths: paths.old,
  });
}

/**
 * An empty porcelain status is the valid clean result. A null status means
 * the git command failed and must remain fail-closed.
 */
export function isPhase698P1L2GitStatusClean(status: string | null): boolean {
  return status !== null && status.length === 0;
}

function scanFormal(root: string) {
  const formal: string[] = [];
  const old: string[] = [];
  try {
    for (const entry of readdirSync(resolve(root, '.tmp'))) {
      const relative = `.tmp/${entry}`;
      if (isPhase698P1L2FormalRelativePath(relative)) formal.push(relative);
    }
  } catch (error) {
    if (!isNotFound(error)) {
      formal.push('.tmp/read_error');
      old.push('.tmp/read_error');
    }
  }
  try {
    for (const entry of readdirSync(root)) {
      if (isPhase698P1L2FormalRelativePath(entry)) formal.push(entry);
    }
  } catch {
    formal.push('root/read_error');
    old.push('root/read_error');
  }
  return { formal: [...new Set(formal)].sort(), old: [...new Set(old)].sort() };
}
function trustedRoot(value: string): string | null {
  try {
    const requested = realpathSync(resolve(value));
    const reported = git(requested, ['rev-parse', '--show-toplevel']);
    if (!reported) return null;
    return realpathSync(reported) === requested ? requested : null;
  } catch {
    return null;
  }
}
function git(root: string, args: readonly string[], trim = true): string | null {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  return trim ? result.stdout.trim() : result.stdout.replace(/\r?\n$/u, '');
}
function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT',
  );
}

export const PHASE_6_9_8_P1_L2_SOURCE_IDENTITY = Object.freeze({
  lineage: PHASE_6_9_8_P1_L2_LINEAGE,
  manifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
  caseCount:
    PHASE_6_9_8_P1_MANIFEST.guardCases.length +
    PHASE_6_9_8_P1_MANIFEST.rewriteCases.length +
    PHASE_6_9_8_P1_MANIFEST.finalResponseCases.length,
});
