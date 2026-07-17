import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import { REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID as factoryProfileId } from './review-planner-controlled-live-eval-v5-deepseek.factory';
import {
  openWindowsNoReparseDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

/** Shared with the V5 factory; this is one independent evidence lineage. */
export const REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID =
  factoryProfileId;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID =
  'deepseek-v4-pro-non-cached-cny-v1' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE = Object.freeze(
  {
    id: REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID,
    evidenceSchemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v5-deepseek-v4-pro',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
    onceLockLeaf: '.review-planner-controlled-live-v5-deepseek-v4-pro.once',
  } as const,
);

const V5_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v5-deepseek-v4-pro-consumed\n';
const V5_MAX_PROVIDER_ATTEMPTS = 23;
const V5_MAX_INPUT_TOKENS = 42_996;
const V5_MAX_OUTPUT_TOKENS = 9_712;
const V5_HARD_CAP_CNY = 1;
const forbiddenEvidenceText =
  /prompt|candidate|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret|endpoint|header|raw[_-]?output|error/i;

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

const qualitySchema = z
  .object({
    caseEntries: z.literal(48),
    zeroCallCases: z.literal(26),
    runtimeInvocations: z.literal(22),
    strictSuccesses: z.literal(22),
    qualityPasses: z.number().int().safe().min(20).max(22),
    criticalFailures: z.literal(0),
    p95DurationMs: z.number().int().safe().min(0).max(4_500),
    productionDecision: z.literal('quality_gate_passed'),
  })
  .strict();

const closedSummarySchema = z
  .object({
    status: z.enum(['invalid_attempted', 'diagnostic_blocked']),
    gate: z.literal('closed'),
    providerAttemptCount: z
      .number()
      .int()
      .safe()
      .min(0)
      .max(V5_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: diagnosticCodeSchema,
  })
  .strict();

const completeSummarySchema = z
  .object({
    status: z.literal('complete'),
    gate: z.literal('open'),
    providerAttemptCount: z.literal(V5_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(true),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
    ),
    currency: z.literal('CNY'),
    aggregateInputTokens: z
      .number()
      .int()
      .safe()
      .min(0)
      .max(V5_MAX_INPUT_TOKENS),
    aggregateOutputTokens: z
      .number()
      .int()
      .safe()
      .min(0)
      .max(V5_MAX_OUTPUT_TOKENS),
    observedCostCny: z.number().finite().min(0).max(V5_HARD_CAP_CNY),
    hardCapCny: z.literal(V5_HARD_CAP_CNY),
    withinHardCap: z.literal(true),
    quality: qualitySchema,
  })
  .strict();

/**
 * The persisted V5 payload is deliberately a discriminated, strict safe
 * aggregate. Closed diagnostics never gain cost or quality fields.
 */
export const safeReviewPlannerControlledLiveV5DeepSeekSummarySchema = z.union([
  closedSummarySchema,
  completeSummarySchema,
]);

export type SafeReviewPlannerControlledLiveV5DeepSeekSummary = Readonly<
  z.infer<typeof safeReviewPlannerControlledLiveV5DeepSeekSummarySchema>
>;

export const safeReviewPlannerControlledLiveV5DeepSeekEvidenceSchema = z.union([
  closedSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceSchemaVersion,
      ),
      state: z.literal('reserved'),
      status: z.literal('diagnostic_blocked'),
    })
    .strict(),
  closedSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceSchemaVersion,
      ),
      state: z.enum(['attempted', 'finalized']),
      status: z.literal('invalid_attempted'),
    })
    .strict(),
  completeSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceSchemaVersion,
      ),
      state: z.literal('finalized'),
    })
    .strict(),
]);

type EvidenceState = 'reserved' | 'attempted' | 'finalized';

export type ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation =
  Readonly<{
    relativePath: string;
    markAttempted(): Promise<boolean>;
    finalize(
      summary: SafeReviewPlannerControlledLiveV5DeepSeekSummary,
    ): Promise<boolean>;
  }>;

const HISTORICAL_EVIDENCE_TREES = [
  {
    evidenceDirectory: 'docs/acceptance/evidence/phase-6-9-5-controlled-live',
    onceLockLeaf: '.review-planner-controlled-live.once',
  },
  {
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
    onceLockLeaf: '.review-planner-controlled-live-v2.once',
  },
  {
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
    onceLockLeaf: '.review-planner-controlled-live-v3.once',
  },
  {
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
    onceLockLeaf: '.review-planner-controlled-live-v4.once',
  },
] as const;

type HistoricalEvidenceEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;

export type ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot = Readonly<{
  schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v1';
  treeHash: string;
  entries: readonly HistoricalEvidenceEntry[];
}>;

/**
 * Captures only a manifest hash of the immutable V1--V4 lineages. It rejects
 * missing markers, special files, and all symlink/junction reparse points.
 */
export async function snapshotReviewPlannerControlledLiveV5HistoricalEvidence(
  rootInput: string,
): Promise<ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot> {
  try {
    const root = await trustedSnapshotRoot(rootInput);
    const entries = (
      await Promise.all(
        HISTORICAL_EVIDENCE_TREES.map((tree) =>
          readHistoricalTree(root, tree.evidenceDirectory),
        ),
      )
    )
      .flat()
      .sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath),
      );
    for (const tree of HISTORICAL_EVIDENCE_TREES) {
      const markerPath = `${tree.evidenceDirectory}/${tree.onceLockLeaf}`;
      if (
        !entries.some(
          (entry) => entry.relativePath === markerPath && entry.type === 'file',
        )
      ) {
        throw new Error('missing historical marker');
      }
    }
    return Object.freeze({
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v1',
      treeHash: hashHistoricalEntries(entries),
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  } catch {
    throw new Error('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');
  }
}

/**
 * Performs a fresh no-write scan and fails closed unless every historical tree
 * entry (name, type, length, and bytes) remains exactly as snapshotted.
 */
export async function verifyReviewPlannerControlledLiveV5HistoricalEvidence(
  input: Readonly<{
    root: string;
    snapshot: ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot> {
  try {
    if (!isSnapshot(input.snapshot)) throw new Error('snapshot invalid');
    const current =
      await snapshotReviewPlannerControlledLiveV5HistoricalEvidence(input.root);
    if (
      current.treeHash !== input.snapshot.treeHash ||
      !sameEntries(current.entries, input.snapshot.entries)
    ) {
      throw new Error('snapshot mismatch');
    }
    return input.snapshot;
  } catch {
    throw new Error('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');
  }
}

/** Writes only the dedicated V5 directory through the native HANDLE boundary. */
export async function reserveReviewPlannerControlledLiveV5DeepSeekEvidence(
  input: Readonly<{ root: string; startedAt: string; runId: string }>,
): Promise<ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation> {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_TRUSTED_HANDLE_REQUIRED');
  }
  const root = resolve(input.root);
  const relativePath = buildEvidencePath(input.startedAt, input.runId);
  const leafName = relativePath.split('/').at(-1);
  if (!leafName) {
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_IDENTITY_INVALID');
  }
  return reserveNativeEvidence(root, relativePath, leafName);
}

async function reserveNativeEvidence(
  root: string,
  relativePath: string,
  leafName: string,
): Promise<ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseDirectory(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceDirectory.split(
        '/',
      ),
    );
    const evidenceDirectory = resolveInsideRoot(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceDirectory,
    );
    if ((await readdir(evidenceDirectory)).length > 0) {
      throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_ALREADY_CONSUMED');
    }
    directory.createExclusiveFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.onceLockLeaf,
      V5_CONSUMED_MARKER,
    );
    directory.createExclusiveFile(
      leafName,
      serializeEvidence('reserved', blockedSummary()),
    );
  } catch (error) {
    directory?.close();
    if (
      error instanceof Error &&
      (error.message.includes('ALREADY') ||
        error.message.includes('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS'))
    ) {
      throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_ALREADY_CONSUMED');
    }
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_RESERVATION_FAILED');
  }
  return nativeReservation(directory, relativePath, leafName);
}

function nativeReservation(
  directory: WindowsNoReparseChildDirectory,
  relativePath: string,
  leafName: string,
): ReviewPlannerControlledLiveV5DeepSeekEvidenceReservation {
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
    summary: SafeReviewPlannerControlledLiveV5DeepSeekSummary,
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
      const changed = replace('attempted', attemptedSummary());
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

function blockedSummary(): SafeReviewPlannerControlledLiveV5DeepSeekSummary {
  return safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
    status: 'diagnostic_blocked',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
  });
}

function attemptedSummary(): SafeReviewPlannerControlledLiveV5DeepSeekSummary {
  return safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse({
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
  });
}

function serializeEvidence(
  state: EvidenceState,
  summary: SafeReviewPlannerControlledLiveV5DeepSeekSummary,
) {
  const parsed =
    safeReviewPlannerControlledLiveV5DeepSeekSummarySchema.parse(summary);
  const evidence =
    safeReviewPlannerControlledLiveV5DeepSeekEvidenceSchema.parse({
      schemaVersion:
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceSchemaVersion,
      state,
      ...parsed,
    });
  return `${JSON.stringify(evidence)}\n`;
}

function buildEvidencePath(startedAt: string, runId: string) {
  let timestamp = '';
  try {
    timestamp = new Date(startedAt)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.', '');
  } catch {
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_IDENTITY_INVALID');
  }
  if (
    !/^\d{8}T\d{9}Z$/.test(timestamp) ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
  ) {
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_IDENTITY_INVALID');
  }
  const digest = createHash('sha256')
    .update(runId, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `${REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceDirectory}/review-planner-live-${timestamp}-${digest}.json`;
}

async function trustedSnapshotRoot(rootInput: string) {
  const root = resolve(rootInput);
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error('invalid root');
  }
  return root;
}

async function readHistoricalTree(root: string, directory: string) {
  const absoluteDirectory = resolveInsideRoot(root, directory);
  const output: HistoricalEvidenceEntry[] = [];
  await walkHistoricalTree(root, absoluteDirectory, output);
  return output;
}

async function walkHistoricalTree(
  root: string,
  absolutePath: string,
  output: HistoricalEvidenceEntry[],
): Promise<void> {
  const metadata = await lstat(absolutePath);
  if (metadata.isSymbolicLink()) throw new Error('reparse point');
  const relativePath = absolutePath
    .slice(`${root}${sep}`.length)
    .replaceAll('\\', '/');
  if (metadata.isDirectory()) {
    output.push({
      relativePath,
      type: 'directory',
      sha256: createHash('sha256').update('directory').digest('hex'),
      byteLength: 0,
    });
    const entries = (await readdir(absolutePath)).sort((left, right) =>
      left.localeCompare(right),
    );
    for (const entry of entries) {
      await walkHistoricalTree(
        root,
        resolveInsideRoot(root, `${relativePath}/${entry}`),
        output,
      );
    }
    return;
  }
  if (!metadata.isFile()) throw new Error('historical entry is not regular');
  const contents = await readFile(absolutePath);
  output.push({
    relativePath,
    type: 'file',
    sha256: createHash('sha256').update(contents).digest('hex'),
    byteLength: contents.byteLength,
  });
}

function hashHistoricalEntries(entries: readonly HistoricalEvidenceEntry[]) {
  const hash = createHash('sha256');
  for (const entry of entries) {
    hash.update(entry.relativePath, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(entry.type, 'utf8');
    hash.update('\0', 'utf8');
    hash.update(String(entry.byteLength), 'utf8');
    hash.update('\0', 'utf8');
    hash.update(entry.sha256, 'utf8');
    hash.update('\n', 'utf8');
  }
  return hash.digest('hex');
}

function sameEntries(
  left: readonly HistoricalEvidenceEntry[],
  right: readonly HistoricalEvidenceEntry[],
) {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.relativePath === right[index]?.relativePath &&
        entry.type === right[index]?.type &&
        entry.byteLength === right[index]?.byteLength &&
        entry.sha256 === right[index]?.sha256,
    )
  );
}

function isSnapshot(
  value: unknown,
): value is ReviewPlannerControlledLiveV5HistoricalEvidenceSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v1' &&
    typeof candidate.treeHash === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.treeHash) &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isHistoricalEntry)
  );
}

function isHistoricalEntry(value: unknown): value is HistoricalEvidenceEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.relativePath === 'string' &&
    entry.relativePath.length > 0 &&
    (entry.type === 'directory' || entry.type === 'file') &&
    typeof entry.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(entry.sha256) &&
    Number.isSafeInteger(entry.byteLength) &&
    entry.byteLength >= 0
  );
}

function resolveInsideRoot(root: string, relativePath: string) {
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) {
    throw new Error('CONTROLLED_LIVE_V5_EVIDENCE_OUTSIDE_ROOT');
  }
  return target;
}
