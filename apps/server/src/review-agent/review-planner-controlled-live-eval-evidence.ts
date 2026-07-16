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
}>;

const nodeFs: EvidenceFs = { mkdir, open, readdir, rename, unlink };

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
  const evidenceDirectory = await ensureEvidenceDirectory(root, fs);
  await rejectExistingPhaseEvidence(fs, evidenceDirectory);
  await assertDirectoryInsideRoot(root, evidenceDirectory);
  await acquirePhaseOnceLock(fs, resolveInsideRoot(root, PHASE_ONCE_LOCK));

  const relativePath = buildControlledLiveEvidencePath(
    input.startedAt,
    input.runId,
  );
  const target = resolveInsideRoot(root, relativePath);
  const initial = buildEvidence('reserved', {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  });

  await assertDirectoryInsideRoot(root, evidenceDirectory);
  let initialHandle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
  try {
    initialHandle = await fs.open(target, 'wx');
    await initialHandle.writeFile(serializeEvidence(initial), 'utf8');
    await initialHandle.sync();
  } catch {
    if (initialHandle) await closeQuietly(initialHandle);
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
      await assertDirectoryInsideRoot(root, evidenceDirectory);
      const evidence = buildEvidence(nextState, summary);
      const serialized = serializeEvidence(evidence);
      if (FORBIDDEN_EVIDENCE_TEXT.test(serialized)) return false;
      temporary = `${target}.tmp-${process.pid}-${revision++}`;
      handle = await fs.open(temporary, 'wx');
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
      await closeQuietly(handle);
      handle = null;
      await fs.rename(temporary, target);
      return true;
    } catch {
      if (handle) await closeQuietly(handle);
      if (temporary) await fs.unlink(temporary).catch(() => undefined);
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
        return changed;
      });
    },
    async finalize(summary) {
      return serializeTransition(async () => {
        if (state !== 'attempted') return false;
        state = 'finalizing';
        const changed = await replaceEvidence('finalized', summary);
        state = changed ? 'finalized' : 'attempted';
        return changed;
      });
    },
    async discard() {
      return serializeTransition(async () => {
        if (state !== 'reserved') return false;
        state = 'discarding';
        try {
          await fs.unlink(target);
          return true;
        } catch {
          return false;
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

async function assertDirectoryInsideRoot(root: string, directory: string) {
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

async function acquirePhaseOnceLock(fs: EvidenceFs, lockPath: string) {
  let handle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
  try {
    handle = await fs.open(lockPath, 'wx');
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
