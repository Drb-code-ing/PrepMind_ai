import { createHash } from 'node:crypto';
import {
  mkdir,
  lstat,
  open,
  readdir,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import {
  openWindowsNoReparseDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

export const REVIEW_PLANNER_CONTROLLED_LIVE_EVIDENCE_SCHEMA_VERSION =
  'phase-6.9.5-review-planner-controlled-live-evidence-v1' as const;

const EVIDENCE_DIRECTORY =
  'docs/acceptance/evidence/phase-6-9-5-controlled-live' as const;
const PHASE_ONCE_LOCK =
  `${EVIDENCE_DIRECTORY}/.review-planner-controlled-live.once` as const;
const EVIDENCE_FILE_NAME =
  /^review-planner-live-\d{8}T\d{9}Z-[a-f0-9]{12}\.json$/;
const FORBIDDEN_EVIDENCE_TEXT =
  /prompt|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret/i;
const controlledDiagnosticCodeSchema = z.enum([
  ReviewPlannerDiagnosticCode.PreflightInvalid,
  ReviewPlannerDiagnosticCode.ExecutorInit,
  ReviewPlannerDiagnosticCode.HttpAuth,
  ReviewPlannerDiagnosticCode.HttpRateLimit,
  ReviewPlannerDiagnosticCode.HttpClient,
  ReviewPlannerDiagnosticCode.HttpServer,
  ReviewPlannerDiagnosticCode.Transport,
  ReviewPlannerDiagnosticCode.StructuredOutput,
  ReviewPlannerDiagnosticCode.InvalidResponse,
  ReviewPlannerDiagnosticCode.UsageUnverifiable,
  ReviewPlannerDiagnosticCode.EvidenceIo,
]);

export const safeReviewPlannerControlledLiveSummarySchema = z
  .object({
    status: z.enum(['complete', 'invalid_attempted', 'diagnostic_blocked']),
    gate: z.enum(['open', 'closed']),
    providerAttemptCount: z.number().int().safe().min(0).max(48),
    usageKnown: z.boolean(),
    diagnosticCode: controlledDiagnosticCodeSchema.optional(),
  })
  .strict();

export type SafeReviewPlannerControlledLiveSummary = Readonly<
  z.infer<typeof safeReviewPlannerControlledLiveSummarySchema>
>;

const evidenceSchema = safeReviewPlannerControlledLiveSummarySchema
  .extend({
    schemaVersion: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_EVIDENCE_SCHEMA_VERSION,
    ),
    state: z.enum(['reserved', 'attempted', 'finalized']),
  })
  .strict();

type EvidenceState =
  | 'reserved'
  | 'attempted'
  | 'finalizing'
  | 'finalized'
  | 'discarding';

export type ControlledLiveEvidenceReservation = Readonly<{
  relativePath: string;
  markAttempted(): Promise<boolean>;
  finalize(summary: SafeReviewPlannerControlledLiveSummary): Promise<boolean>;
  discard(): Promise<boolean>;
}>;

type EvidenceFs = Readonly<{
  mkdir: typeof mkdir;
  open: typeof open;
  readdir: typeof readdir;
  rename: typeof rename;
  unlink: typeof unlink;
  beforeOpen?(path: string): void | Promise<void>;
  beforeRename?(from: string, to: string): void | Promise<void>;
  beforeNativeOperation?(
    operation: 'create' | 'replace' | 'delete',
  ): void | Promise<void>;
}>;

const nodeFs: EvidenceFs = { mkdir, open, readdir, rename, unlink };
const EVIDENCE_DIRECTORY_COMPONENTS = EVIDENCE_DIRECTORY.split('/');

/**
 * Creates a single-use evidence record before the first provider boundary.
 * Every persisted payload is reconstructed from the safe summary schema; raw
 * provider data never crosses this module boundary.
 */
export async function reserveReviewPlannerControlledLiveEvidence(
  input: Readonly<{
    root: string;
    startedAt: string;
    runId: string;
    fs?: EvidenceFs;
  }>,
): Promise<ControlledLiveEvidenceReservation> {
  const fs = input.fs ?? nodeFs;
  const root = await resolveEvidenceRoot(input.root);
  const relativePath = buildControlledLiveEvidencePath(
    input.startedAt,
    input.runId,
  );
  const targetLeafName = relativePath.split('/').at(-1);
  if (!targetLeafName) {
    throw new Error('CONTROLLED_LIVE_EVIDENCE_IDENTITY_INVALID');
  }
  const target = resolveInsideRoot(root, relativePath);
  const evidenceDirectory = resolveInsideRoot(root, EVIDENCE_DIRECTORY);
  let nativeDirectory: WindowsNoReparseChildDirectory | null = null;
  let parent: EvidenceParentBinding | null = null;
  let nativeClosed = false;
  const closeNativeDirectory = () => {
    if (!nativeDirectory || nativeClosed) return;
    nativeClosed = true;
    nativeDirectory.close();
  };

  try {
    if (isWindowsNativeEvidenceIo()) {
      nativeDirectory = await openWindowsNoReparseDirectory(
        root,
        EVIDENCE_DIRECTORY_COMPONENTS,
      );
      await rejectExistingPhaseEvidence(fs, evidenceDirectory);
      await writeNativeEvidenceFile(
        fs,
        nativeDirectory,
        'create',
        phaseOnceLockLeafName(),
        'phase-6.9.5-controlled-live-consumed\n',
      );
    } else {
      const ensuredDirectory = await ensureEvidenceDirectory(root, fs);
      parent = await bindEvidenceParent(root, ensuredDirectory);
      await rejectExistingPhaseEvidence(fs, ensuredDirectory);
      await assertBoundEvidenceParent(parent);
      await acquirePhaseOnceLock(
        fs,
        parent,
        resolveInsideRoot(root, PHASE_ONCE_LOCK),
      );
    }
  } catch (error) {
    closeNativeDirectory();
    if (isWindowsAlreadyExists(error)) {
      throw new Error('CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED');
    }
    if (
      error instanceof Error &&
      error.message === 'CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED'
    ) {
      throw error;
    }
    throw new Error('CONTROLLED_LIVE_EVIDENCE_RESERVATION_FAILED');
  }

  const initial = buildEvidence('reserved', {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  });

  let initialHandle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
  try {
    if (nativeDirectory) {
      await writeNativeEvidenceFile(
        fs,
        nativeDirectory,
        'create',
        targetLeafName,
        serializeEvidence(initial),
      );
    } else {
      if (!parent) throw new Error('CONTROLLED_LIVE_EVIDENCE_PARENT_DRIFT');
      await assertBoundEvidenceParent(parent);
      initialHandle = await openInBoundEvidenceParent(fs, parent, target, 'wx');
      await initialHandle.writeFile(serializeEvidence(initial), 'utf8');
      await initialHandle.sync();
    }
  } catch {
    if (initialHandle) await closeQuietly(initialHandle);
    closeNativeDirectory();
    throw new Error('CONTROLLED_LIVE_EVIDENCE_RESERVATION_FAILED');
  }
  await closeQuietly(initialHandle);

  let state: EvidenceState = 'reserved';
  let revision = 0;

  const replaceEvidence = async (
    nextState: 'attempted' | 'finalized',
    summary: SafeReviewPlannerControlledLiveSummary,
  ): Promise<boolean> => {
    let temporary: string | null = null;
    let handle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
    try {
      const evidence = buildEvidence(nextState, summary);
      const serialized = serializeEvidence(evidence);
      if (FORBIDDEN_EVIDENCE_TEXT.test(serialized)) return false;
      const temporarySuffix = revision++;
      const temporaryLeafName = `${targetLeafName}.tmp-${process.pid}-${temporarySuffix}`;
      if (nativeDirectory) {
        await replaceNativeEvidenceFile(
          fs,
          nativeDirectory,
          temporaryLeafName,
          targetLeafName,
          serialized,
        );
      } else {
        if (!parent) throw new Error('CONTROLLED_LIVE_EVIDENCE_PARENT_DRIFT');
        await assertBoundEvidenceParent(parent);
        temporary = `${target}.tmp-${process.pid}-${temporarySuffix}`;
        handle = await openInBoundEvidenceParent(fs, parent, temporary, 'wx');
        await handle.writeFile(serialized, 'utf8');
        await handle.sync();
        await closeQuietly(handle);
        handle = null;
        await renameInBoundEvidenceParent(fs, parent, temporary, target);
      }
      return true;
    } catch {
      if (handle) await closeQuietly(handle);
      if (temporary && parent && (await isBoundEvidenceParent(parent))) {
        await fs.unlink(temporary).catch(() => undefined);
      }
      return false;
    }
  };

  let operationTail: Promise<void> = Promise.resolve();
  const serializeTransition = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationTail.then(operation, operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return Object.freeze({
    relativePath,
    async markAttempted() {
      return serializeTransition(async () => {
        if (state !== 'reserved') return false;
        const changed = await replaceEvidence('attempted', {
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 0,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
        });
        state = changed ? 'attempted' : 'discarding';
        if (!changed) closeNativeDirectory();
        return changed;
      });
    },
    async finalize(summary) {
      return serializeTransition(async () => {
        if (state !== 'attempted') return false;
        state = 'finalizing';
        const changed = await replaceEvidence('finalized', summary);
        state = changed ? 'finalized' : 'attempted';
        closeNativeDirectory();
        return changed;
      });
    },
    async discard() {
      return serializeTransition(async () => {
        if (state !== 'reserved') return false;
        state = 'discarding';
        try {
          if (nativeDirectory) {
            await deleteNativeEvidenceFile(fs, nativeDirectory, targetLeafName);
          } else {
            if (!parent || !(await isBoundEvidenceParent(parent))) return false;
            await fs.unlink(target);
          }
          return true;
        } catch {
          return false;
        } finally {
          closeNativeDirectory();
        }
      });
    },
  });
}

async function resolveEvidenceRoot(root: string) {
  try {
    return await realpath(resolve(root));
  } catch {
    throw new Error('CONTROLLED_LIVE_EVIDENCE_ROOT_INVALID');
  }
}

function isWindowsNativeEvidenceIo() {
  return process.platform === 'win32';
}

function phaseOnceLockLeafName() {
  return (
    PHASE_ONCE_LOCK.split('/').at(-1) ?? '.review-planner-controlled-live.once'
  );
}

async function writeNativeEvidenceFile(
  fs: EvidenceFs,
  directory: WindowsNoReparseChildDirectory,
  operation: 'create',
  leafName: string,
  contents: string,
) {
  await fs.beforeNativeOperation?.(operation);
  directory.createExclusiveFile(leafName, contents);
}

async function replaceNativeEvidenceFile(
  fs: EvidenceFs,
  directory: WindowsNoReparseChildDirectory,
  temporaryLeafName: string,
  targetLeafName: string,
  contents: string,
) {
  await fs.beforeNativeOperation?.('replace');
  directory.replaceFile(temporaryLeafName, targetLeafName, contents);
}

async function deleteNativeEvidenceFile(
  fs: EvidenceFs,
  directory: WindowsNoReparseChildDirectory,
  leafName: string,
) {
  await fs.beforeNativeOperation?.('delete');
  directory.deleteFile(leafName);
}

function isWindowsAlreadyExists(error: unknown) {
  return (
    error instanceof Error &&
    error.message === 'WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS'
  );
}

async function assertDirectoryInsideRoot(root: string, directory: string) {
  await bindEvidenceParent(root, directory);
}

type EvidenceParentBinding = Readonly<{
  root: string;
  directory: string;
  realPath: string;
  identity: string;
}>;

async function bindEvidenceParent(
  root: string,
  directory: string,
): Promise<EvidenceParentBinding> {
  try {
    const metadata = await lstat(directory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error('CONTROLLED_LIVE_EVIDENCE_OUTSIDE_ROOT');
    }
    const resolvedDirectory = await realpath(directory);
    if (
      resolvedDirectory !== root &&
      !resolvedDirectory.startsWith(`${root}${sep}`)
    ) {
      throw new Error('CONTROLLED_LIVE_EVIDENCE_OUTSIDE_ROOT');
    }
    return Object.freeze({
      root,
      directory,
      realPath: resolvedDirectory,
      identity: `${metadata.dev}:${metadata.ino}`,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'CONTROLLED_LIVE_EVIDENCE_OUTSIDE_ROOT'
    ) {
      throw error;
    }
    throw new Error('CONTROLLED_LIVE_EVIDENCE_DIRECTORY_INVALID');
  }
}

async function assertBoundEvidenceParent(binding: EvidenceParentBinding) {
  const current = await bindEvidenceParent(binding.root, binding.directory);
  if (
    current.realPath !== binding.realPath ||
    current.identity !== binding.identity
  ) {
    throw new Error('CONTROLLED_LIVE_EVIDENCE_PARENT_DRIFT');
  }
}

async function isBoundEvidenceParent(binding: EvidenceParentBinding) {
  try {
    await assertBoundEvidenceParent(binding);
    return true;
  } catch {
    return false;
  }
}

async function openInBoundEvidenceParent(
  fs: EvidenceFs,
  parent: EvidenceParentBinding,
  path: string,
  flags: 'wx',
) {
  await fs.beforeOpen?.(path);
  await assertBoundEvidenceParent(parent);
  const handle = await fs.open(path, flags);
  if (
    (await isBoundEvidenceParent(parent)) &&
    (await isOpenedHandleAtPath(handle, path))
  ) {
    return handle;
  }
  await removeOwnedOpenedFile(fs, path, handle);
  throw new Error('CONTROLLED_LIVE_EVIDENCE_PARENT_DRIFT');
}

async function isOpenedHandleAtPath(
  handle: Awaited<ReturnType<EvidenceFs['open']>>,
  path: string,
) {
  try {
    const opened = await handle.stat();
    const current = await lstat(path);
    return (
      !current.isSymbolicLink() &&
      `${opened.dev}:${opened.ino}` === `${current.dev}:${current.ino}`
    );
  } catch {
    return false;
  }
}

async function renameInBoundEvidenceParent(
  fs: EvidenceFs,
  parent: EvidenceParentBinding,
  from: string,
  to: string,
) {
  await fs.beforeRename?.(from, to);
  await assertBoundEvidenceParent(parent);
  await fs.rename(from, to);
  await assertBoundEvidenceParent(parent);
}

async function removeOwnedOpenedFile(
  fs: EvidenceFs,
  path: string,
  handle: Awaited<ReturnType<EvidenceFs['open']>>,
) {
  let identity: string | null = null;
  try {
    const metadata = await handle.stat();
    identity = `${metadata.dev}:${metadata.ino}`;
  } catch {
    // A failed identity read means this helper must not delete by pathname.
  }
  await closeQuietly(handle);
  if (!identity) return;
  try {
    const current = await lstat(path);
    if (
      !current.isSymbolicLink() &&
      `${current.dev}:${current.ino}` === identity
    ) {
      await fs.unlink(path);
    }
  } catch {
    // The file is no longer safely attributable to this reservation.
  }
}

async function ensureEvidenceDirectory(root: string, fs: EvidenceFs) {
  let directory = root;
  for (const component of EVIDENCE_DIRECTORY.split('/')) {
    directory = resolve(directory, component);
    try {
      await fs.mkdir(directory);
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw new Error('CONTROLLED_LIVE_EVIDENCE_DIRECTORY_INVALID');
      }
    }
    await assertDirectoryInsideRoot(root, directory);
  }
  return directory;
}

async function rejectExistingPhaseEvidence(fs: EvidenceFs, directory: string) {
  try {
    const entries = await fs.readdir(directory);
    if (entries.some((entry) => EVIDENCE_FILE_NAME.test(entry))) {
      throw new Error('CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED');
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED'
    ) {
      throw error;
    }
    throw new Error('CONTROLLED_LIVE_EVIDENCE_DIRECTORY_INVALID');
  }
}

async function acquirePhaseOnceLock(
  fs: EvidenceFs,
  parent: EvidenceParentBinding,
  lockPath: string,
) {
  let handle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
  try {
    handle = await openInBoundEvidenceParent(fs, parent, lockPath, 'wx');
    await handle.writeFile('phase-6.9.5-controlled-live-consumed\n', 'utf8');
    await handle.sync();
  } catch (error) {
    if (handle) await closeQuietly(handle);
    if (isAlreadyExists(error)) {
      throw new Error('CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED');
    }
    throw new Error('CONTROLLED_LIVE_EVIDENCE_RESERVATION_FAILED');
  }
  await closeQuietly(handle);
}

function isAlreadyExists(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}

function buildEvidence(
  state: 'reserved' | 'attempted' | 'finalized',
  summary: SafeReviewPlannerControlledLiveSummary,
) {
  const parsed =
    safeReviewPlannerControlledLiveSummarySchema.safeParse(summary);
  if (!parsed.success) throw new Error('CONTROLLED_LIVE_EVIDENCE_INVALID');
  return evidenceSchema.parse({
    schemaVersion: REVIEW_PLANNER_CONTROLLED_LIVE_EVIDENCE_SCHEMA_VERSION,
    state,
    status: parsed.data.status,
    gate: parsed.data.gate,
    providerAttemptCount: parsed.data.providerAttemptCount,
    usageKnown: parsed.data.usageKnown,
    ...(parsed.data.diagnosticCode
      ? { diagnosticCode: parsed.data.diagnosticCode }
      : {}),
  });
}

function serializeEvidence(value: z.infer<typeof evidenceSchema>) {
  return `${JSON.stringify(value)}\n`;
}

function buildControlledLiveEvidencePath(startedAt: string, runId: string) {
  const timestamp = safeTimestamp(startedAt);
  if (!timestamp || !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)) {
    throw new Error('CONTROLLED_LIVE_EVIDENCE_IDENTITY_INVALID');
  }
  const digest = createHash('sha256')
    .update(runId, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `${EVIDENCE_DIRECTORY}/review-planner-live-${timestamp}-${digest}.json`;
}

function safeTimestamp(value: string) {
  try {
    const timestamp = new Date(value).toISOString();
    return timestamp.replace(/[-:]/g, '').replace('.', '');
  } catch {
    return null;
  }
}

function resolveInsideRoot(root: string, relativePath: string) {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, relativePath);
  if (!target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error('CONTROLLED_LIVE_EVIDENCE_OUTSIDE_ROOT');
  }
  return target;
}

async function closeQuietly(
  handle: Awaited<ReturnType<EvidenceFs['open']>> | null,
) {
  try {
    await handle?.close();
  } catch {
    // The caller collapses all filesystem failures to a fixed safe outcome.
  }
}
