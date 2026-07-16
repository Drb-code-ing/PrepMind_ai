import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
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

/**
 * V4 is an isolated lineage. Its descriptor deliberately lives in this new
 * module: v1-v3 descriptors and serializers are historical, read-only facts.
 */
export const CONTROLLED_LIVE_V4_PROFILE = Object.freeze({
  id: 'phase-6.9.5-review-planner-controlled-live-v4',
  evidenceSchemaVersion:
    'phase-6.9.5-review-planner-controlled-live-evidence-v4',
  evidenceDirectory: 'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
  onceLockLeaf: '.review-planner-controlled-live-v4.once',
} as const);

const evidenceFileName =
  /^review-planner-live-\d{8}T\d{9}Z-[a-f0-9]{12}\.json$/;
const forbiddenEvidenceText =
  /prompt|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret/i;
const structuredOutputStageSchema = z.enum([
  'provider_json_parse',
  'provider_type_validation',
  'provider_object_missing',
]);
const diagnosticCodeSchema = z.enum([
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

export const safeReviewPlannerControlledLiveV4SummarySchema = z
  .object({
    status: z.enum(['complete', 'invalid_attempted', 'diagnostic_blocked']),
    gate: z.enum(['open', 'closed']),
    providerAttemptCount: z.number().int().safe().min(0).max(48),
    usageKnown: z.boolean(),
    diagnosticCode: diagnosticCodeSchema.optional(),
    structuredOutputStage: structuredOutputStageSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.structuredOutputStage === undefined) return;
    if (
      value.status === 'invalid_attempted' &&
      value.gate === 'closed' &&
      value.providerAttemptCount === 1 &&
      value.usageKnown === false &&
      value.diagnosticCode === ReviewPlannerDiagnosticCode.StructuredOutput
    ) {
      return;
    }
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CONTROLLED_LIVE_V4_STAGE_TUPLE_INVALID',
    });
  });

export type SafeReviewPlannerControlledLiveV4Summary = Readonly<
  z.infer<typeof safeReviewPlannerControlledLiveV4SummarySchema>
>;

export type ReviewPlannerControlledLiveV4EvidenceReservation = Readonly<{
  relativePath: string;
  markAttempted(): Promise<boolean>;
  finalize(summary: SafeReviewPlannerControlledLiveV4Summary): Promise<boolean>;
}>;

type EvidenceState = 'reserved' | 'attempted' | 'finalized';
type BoundParent = Readonly<{
  root: string;
  path: string;
  realPath: string;
  identity: string;
}>;

/**
 * Reserves a V4-only once marker and safe baseline before the executor is
 * constructed. No historical directory or marker is resolved by this code.
 */
export async function reserveReviewPlannerControlledLiveV4Evidence(
  input: Readonly<{ root: string; startedAt: string; runId: string }>,
): Promise<ReviewPlannerControlledLiveV4EvidenceReservation> {
  const root = await resolveRoot(input.root);
  const relativePath = buildEvidencePath(input.startedAt, input.runId);
  const leafName = relativePath.split('/').at(-1);
  if (!leafName)
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_IDENTITY_INVALID');

  if (process.platform === 'win32') {
    return reserveNativeV4Evidence(root, relativePath, leafName);
  }
  return reserveBoundV4Evidence(root, relativePath);
}

async function reserveNativeV4Evidence(
  root: string,
  relativePath: string,
  leafName: string,
): Promise<ReviewPlannerControlledLiveV4EvidenceReservation> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseDirectory(
      root,
      CONTROLLED_LIVE_V4_PROFILE.evidenceDirectory.split('/'),
    );
    const evidenceDirectory = resolveInsideRoot(
      root,
      CONTROLLED_LIVE_V4_PROFILE.evidenceDirectory,
    );
    const entries = await readdir(evidenceDirectory);
    if (entries.some((entry) => evidenceFileName.test(entry))) {
      throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_ALREADY_CONSUMED');
    }
    directory.createExclusiveFile(
      CONTROLLED_LIVE_V4_PROFILE.onceLockLeaf,
      'phase-6.9.5-review-planner-controlled-live-v4-consumed\n',
    );
    directory.createExclusiveFile(
      leafName,
      serializeEvidence('reserved', blockedSummary()),
    );
  } catch (error) {
    directory?.close();
    if (error instanceof Error && error.message.includes('ALREADY')) {
      throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_ALREADY_CONSUMED');
    }
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_RESERVATION_FAILED');
  }

  return nativeReservation(directory, relativePath, leafName);
}

function nativeReservation(
  directory: WindowsNoReparseChildDirectory,
  relativePath: string,
  leafName: string,
): ReviewPlannerControlledLiveV4EvidenceReservation {
  let state: EvidenceState = 'reserved';
  let revision = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    directory.close();
  };
  const replace = (
    nextState: 'attempted' | 'finalized',
    summary: SafeReviewPlannerControlledLiveV4Summary,
  ) => {
    try {
      const serialized = serializeEvidence(nextState, summary);
      if (forbiddenEvidenceText.test(serialized)) return false;
      directory.replaceFile(
        `${leafName}.tmp-${process.pid}-${revision++}`,
        leafName,
        serialized,
      );
      return true;
    } catch {
      return false;
    }
  };
  return Object.freeze({
    relativePath,
    markAttempted() {
      if (state !== 'reserved') return Promise.resolve(false);
      const changed = replace('attempted', attemptedBaseline());
      state = changed ? 'attempted' : 'finalized';
      if (!changed) close();
      return Promise.resolve(changed);
    },
    finalize(summary) {
      if (state !== 'attempted') return Promise.resolve(false);
      const changed = replace('finalized', summary);
      if (changed) state = 'finalized';
      close();
      return Promise.resolve(changed);
    },
  });
}

async function reserveBoundV4Evidence(
  root: string,
  relativePath: string,
): Promise<ReviewPlannerControlledLiveV4EvidenceReservation> {
  const directoryPath = await ensureDirectory(
    root,
    CONTROLLED_LIVE_V4_PROFILE.evidenceDirectory,
  );
  const parent = await bindParent(root, directoryPath);
  const entries = await readdir(directoryPath);
  if (entries.some((entry) => evidenceFileName.test(entry))) {
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_ALREADY_CONSUMED');
  }
  const lockPath = resolveInsideRoot(
    root,
    `${CONTROLLED_LIVE_V4_PROFILE.evidenceDirectory}/${CONTROLLED_LIVE_V4_PROFILE.onceLockLeaf}`,
  );
  const target = resolveInsideRoot(root, relativePath);
  try {
    await writeExclusive(
      parent,
      lockPath,
      'phase-6.9.5-review-planner-controlled-live-v4-consumed\n',
    );
    await writeExclusive(
      parent,
      target,
      serializeEvidence('reserved', blockedSummary()),
    );
  } catch (error) {
    if (isAlreadyExists(error)) {
      throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_ALREADY_CONSUMED');
    }
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_RESERVATION_FAILED');
  }

  let state: EvidenceState = 'reserved';
  let revision = 0;
  const replace = async (
    nextState: 'attempted' | 'finalized',
    summary: SafeReviewPlannerControlledLiveV4Summary,
  ) => {
    let temporary = '';
    try {
      const serialized = serializeEvidence(nextState, summary);
      if (forbiddenEvidenceText.test(serialized)) return false;
      temporary = `${target}.tmp-${process.pid}-${revision++}`;
      await writeExclusive(parent, temporary, serialized);
      await assertBoundParent(parent);
      await rename(temporary, target);
      await assertBoundParent(parent);
      return true;
    } catch {
      if (temporary && (await isBoundParent(parent)))
        await unlink(temporary).catch(() => undefined);
      return false;
    }
  };
  return Object.freeze({
    relativePath,
    async markAttempted() {
      if (state !== 'reserved') return false;
      const changed = await replace('attempted', attemptedBaseline());
      state = changed ? 'attempted' : 'finalized';
      return changed;
    },
    async finalize(summary) {
      if (state !== 'attempted') return false;
      const changed = await replace('finalized', summary);
      if (changed) state = 'finalized';
      return changed;
    },
  });
}

function blockedSummary(): SafeReviewPlannerControlledLiveV4Summary {
  return safeReviewPlannerControlledLiveV4SummarySchema.parse({
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  });
}

function attemptedBaseline(): SafeReviewPlannerControlledLiveV4Summary {
  return safeReviewPlannerControlledLiveV4SummarySchema.parse({
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
  });
}

function serializeEvidence(
  state: EvidenceState,
  summary: SafeReviewPlannerControlledLiveV4Summary,
) {
  const parsed = safeReviewPlannerControlledLiveV4SummarySchema.parse(summary);
  return `${JSON.stringify({ schemaVersion: CONTROLLED_LIVE_V4_PROFILE.evidenceSchemaVersion, state, ...parsed })}\n`;
}

async function resolveRoot(root: string) {
  const resolved = resolve(root);
  if (process.platform === 'win32') return resolved;
  try {
    return await realpath(resolved);
  } catch {
    throw new Error('CONTROLLED_LIVE_V4_ROOT_INVALID');
  }
}

function buildEvidencePath(startedAt: string, runId: string) {
  const timestamp = new Date(startedAt)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('.', '');
  if (
    !/^\d{8}T\d{9}Z$/.test(timestamp) ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
  ) {
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_IDENTITY_INVALID');
  }
  const digest = createHash('sha256')
    .update(runId, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `${CONTROLLED_LIVE_V4_PROFILE.evidenceDirectory}/review-planner-live-${timestamp}-${digest}.json`;
}

function resolveInsideRoot(root: string, path: string) {
  const target = resolve(root, path);
  if (!target.startsWith(`${root}${sep}`))
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_OUTSIDE_ROOT');
  return target;
}

async function ensureDirectory(root: string, relative: string) {
  let directory = root;
  for (const component of relative.split('/')) {
    directory = resolve(directory, component);
    await mkdir(directory).catch((error: unknown) => {
      if (!isAlreadyExists(error)) throw error;
    });
  }
  return directory;
}

async function bindParent(root: string, path: string): Promise<BoundParent> {
  const metadata = await lstat(path);
  const realPath = await realpath(path);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    !realPath.startsWith(`${root}${sep}`)
  ) {
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_OUTSIDE_ROOT');
  }
  return Object.freeze({
    root,
    path,
    realPath,
    identity: `${metadata.dev}:${metadata.ino}`,
  });
}

async function assertBoundParent(parent: BoundParent) {
  const current = await bindParent(parent.root, parent.path);
  if (
    current.realPath !== parent.realPath ||
    current.identity !== parent.identity
  ) {
    throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_PARENT_DRIFT');
  }
}

async function isBoundParent(parent: BoundParent) {
  try {
    await assertBoundParent(parent);
    return true;
  } catch {
    return false;
  }
}

async function writeExclusive(
  parent: BoundParent,
  path: string,
  contents: string,
) {
  await assertBoundParent(parent);
  const handle = await open(path, 'wx');
  try {
    // A path check before open is not enough: a junction/rename may land the
    // new handle elsewhere. Verify both the still-bound parent and handle
    // identity before a byte is written, then remove only an owned empty file.
    if (
      !(await isBoundParent(parent)) ||
      !(await isOpenedHandleAtPath(handle, path))
    ) {
      await removeOwnedOpenedFile(path, handle);
      throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_PARENT_DRIFT');
    }
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    if (
      !(await isBoundParent(parent)) ||
      !(await isOpenedHandleAtPath(handle, path))
    ) {
      throw new Error('CONTROLLED_LIVE_V4_EVIDENCE_PARENT_DRIFT');
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function isOpenedHandleAtPath(
  handle: Awaited<ReturnType<typeof open>>,
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

async function removeOwnedOpenedFile(
  path: string,
  handle: Awaited<ReturnType<typeof open>>,
) {
  let identity: string | null = null;
  try {
    const metadata = await handle.stat();
    identity = `${metadata.dev}:${metadata.ino}`;
  } catch {
    return;
  }
  await handle.close().catch(() => undefined);
  try {
    const current = await lstat(path);
    if (
      !current.isSymbolicLink() &&
      `${current.dev}:${current.ino}` === identity
    ) {
      await unlink(path);
    }
  } catch {
    // A path we cannot prove we own is never removed.
  }
}

function isAlreadyExists(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}
