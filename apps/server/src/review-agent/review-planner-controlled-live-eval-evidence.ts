import { createHash } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

export const REVIEW_PLANNER_CONTROLLED_LIVE_EVIDENCE_SCHEMA_VERSION =
  'phase-6.9.5-review-planner-controlled-live-evidence-v1' as const;

const EVIDENCE_DIRECTORY =
  'docs/acceptance/evidence/phase-6-9-5-controlled-live' as const;
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
  rename: typeof rename;
  unlink: typeof unlink;
}>;

const nodeFs: EvidenceFs = { mkdir, open, rename, unlink };

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
  const relativePath = buildControlledLiveEvidencePath(
    input.startedAt,
    input.runId,
  );
  const target = resolveInsideRoot(input.root, relativePath);
  const initial = buildEvidence('reserved', {
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  });

  await fs.mkdir(dirname(target), { recursive: true });
  let initialHandle: Awaited<ReturnType<EvidenceFs['open']>> | null = null;
  try {
    initialHandle = await fs.open(target, 'wx');
    await initialHandle.writeFile(serializeEvidence(initial), 'utf8');
    await initialHandle.sync();
  } catch {
    if (initialHandle) await closeQuietly(initialHandle);
    await fs.unlink(target).catch(() => undefined);
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

  return Object.freeze({
    relativePath,
    async markAttempted() {
      if (state !== 'reserved') return false;
      state = 'attempted';
      const changed = await replaceEvidence('attempted', {
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      });
      if (!changed) state = 'discarding';
      return changed;
    },
    async finalize(summary) {
      if (state !== 'attempted') return false;
      state = 'finalizing';
      const changed = await replaceEvidence('finalized', summary);
      state = changed ? 'finalized' : 'attempted';
      return changed;
    },
    async discard() {
      if (state !== 'reserved') return false;
      state = 'discarding';
      try {
        await fs.unlink(target);
        return true;
      } catch {
        return false;
      }
    },
  });
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
