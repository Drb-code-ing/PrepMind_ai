import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import {
  openWindowsNoReparseDirectory,
  openWindowsNoReparseExistingDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID =
  'deepseek-v4-pro-non-cached-cny-v1' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE =
  Object.freeze({
    id: REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID,
    evidenceSchemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v6-deepseek-v4-pro-nonthinking',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
    onceLockLeaf:
      '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
  } as const);

const V6_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking-consumed\n';
const V6_MAX_PROVIDER_ATTEMPTS = 23;
const V6_MAX_INPUT_TOKENS = 42_996;
const V6_MAX_OUTPUT_TOKENS = 9_712;
const V6_HARD_CAP_CNY = 1;
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
  'thinking_not_disabled',
]);

const compliantNonThinkingAuditSchema = z.union([
  z
    .object({
      reasoning: z.literal('not_reported'),
      reasoningContentPresent: z.literal(false),
    })
    .strict(),
  z
    .object({
      reasoning: z.literal('reported_zero'),
      reasoningContentPresent: z.literal(false),
      reportedReasoningTokens: z.literal(0),
    })
    .strict(),
]);

const nonCompliantNonThinkingAuditSchema = z.union([
  z
    .object({
      reasoning: z.literal('reported_positive'),
      reasoningContentPresent: z.boolean(),
      reportedReasoningTokens: z.number().int().safe().min(1),
    })
    .strict(),
  z
    .object({
      reasoning: z.literal('invalid_detail'),
      reasoningContentPresent: z.boolean(),
    })
    .strict(),
]);

const qualitySchema = z
  .object({
    caseEntries: z.literal(48),
    zeroCallCases: z.literal(26),
    runtimeInvocations: z.literal(22),
    strictSuccesses: z.literal(48),
    qualityPasses: z.literal(48),
    criticalFailures: z.literal(0),
    p95DurationMs: z.number().int().safe().min(0).max(4_500),
    productionDecision: z.literal('quality_gate_passed'),
  })
  .strict();

const diagnosticBlockedSummarySchema = z
  .object({
    status: z.literal('diagnostic_blocked'),
    gate: z.literal('closed'),
    providerAttemptCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.PreflightInvalid),
  })
  .strict();

const ordinaryClosedSummarySchema = z
  .object({
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    providerAttemptCount: z
      .number()
      .int()
      .safe()
      .min(0)
      .max(V6_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: diagnosticCodeSchema.exclude(['thinking_not_disabled']),
  })
  .strict();

const thinkingNotDisabledSummarySchema = z
  .object({
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    providerAttemptCount: z
      .number()
      .int()
      .safe()
      .min(0)
      .max(V6_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal('thinking_not_disabled'),
    nonThinkingAudit: nonCompliantNonThinkingAuditSchema,
  })
  .strict();

const completeSummarySchema = z
  .object({
    status: z.literal('complete'),
    gate: z.literal('open'),
    providerAttemptCount: z.literal(V6_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(true),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
    ),
    currency: z.literal('CNY'),
    aggregateInputTokens: z
      .number()
      .int()
      .safe()
      .min(1)
      .max(V6_MAX_INPUT_TOKENS),
    aggregateOutputTokens: z
      .number()
      .int()
      .safe()
      .min(1)
      .max(V6_MAX_OUTPUT_TOKENS),
    observedCostCny: z.number().finite().min(0).max(V6_HARD_CAP_CNY),
    hardCapCny: z.literal(V6_HARD_CAP_CNY),
    withinHardCap: z.literal(true),
    quality: qualitySchema,
    nonThinkingAudit: compliantNonThinkingAuditSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.observedCostCny !==
      calculateNonCachedCnyCost(
        value.aggregateInputTokens,
        value.aggregateOutputTokens,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CONTROLLED_LIVE_V6_NONTHINKING_COST_INVALID',
      });
    }
  });

export const safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema =
  z.union([
    diagnosticBlockedSummarySchema,
    ordinaryClosedSummarySchema,
    thinkingNotDisabledSummarySchema,
    completeSummarySchema,
  ]);

export type SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary =
  Readonly<
    z.infer<
      typeof safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema
    >
  >;

export const reviewPlannerControlledLiveV6DeepSeekNonThinkingReservedRecordSchema =
  diagnosticBlockedSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
      ),
      state: z.literal('reserved'),
    })
    .strict();

export const reviewPlannerControlledLiveV6DeepSeekNonThinkingAttemptedRecordSchema =
  z.union([
    ordinaryClosedSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('attempted'),
      })
      .strict(),
    thinkingNotDisabledSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('attempted'),
      })
      .strict(),
  ]);

export const reviewPlannerControlledLiveV6DeepSeekNonThinkingFinalizedRecordSchema =
  z.union([
    diagnosticBlockedSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
    ordinaryClosedSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
    thinkingNotDisabledSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
    completeSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
  ]);

export const safeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceSchema =
  z.union([
    reviewPlannerControlledLiveV6DeepSeekNonThinkingReservedRecordSchema,
    reviewPlannerControlledLiveV6DeepSeekNonThinkingAttemptedRecordSchema,
    reviewPlannerControlledLiveV6DeepSeekNonThinkingFinalizedRecordSchema,
  ]);

type EvidenceState = 'reserved' | 'attempted' | 'finalized';

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation =
  Readonly<{
    relativePath: string;
    markAttempted(): Promise<boolean>;
  }>;

type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceCapability =
  Readonly<{
    finalize(
      summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
    ): Promise<boolean>;
    seal(): void;
  }>;

/** Terminal-write authority is never exported with the reservation handle. */
const reservationCapabilities = new WeakMap<
  ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation,
  ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceCapability
>();

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
  {
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
    onceLockLeaf: '.review-planner-controlled-live-v5-deepseek-v4-pro.once',
  },
] as const;

type HistoricalEvidenceEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot =
  Readonly<{
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v2';
    treeHash: string;
    entries: readonly HistoricalEvidenceEntry[];
  }>;

/**
 * Captures a no-content manifest of all immutable V1--V5 evidence lineages.
 * The reader never creates history and binds every directory through a
 * no-reparse HANDLE before it reads an entry.
 */
export async function snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
  rootInput: string,
): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot> {
  try {
    const root = trustedSnapshotRoot(rootInput);
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
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v2',
      treeHash: hashHistoricalEntries(entries),
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V6_NONTHINKING_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

/** Runs a fresh no-write V1--V5 manifest check at every boundary. */
export async function verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
  input: Readonly<{
    root: string;
    snapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot> {
  try {
    if (!isSnapshot(input.snapshot)) throw new Error('snapshot invalid');
    const current =
      await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
        input.root,
      );
    if (
      current.treeHash !== input.snapshot.treeHash ||
      !sameEntries(current.entries, input.snapshot.entries)
    ) {
      throw new Error('snapshot mismatch');
    }
    return input.snapshot;
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V6_NONTHINKING_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

/**
 * Reserves the only writable V6 tree after the first mandatory V1--V5 check.
 * Its caller must separately run the same verifier before executor and
 * provider boundaries; this module does not hold credentials or executors.
 */
export async function reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
  input: Readonly<{
    root: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation> {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error(
      'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_TRUSTED_HANDLE_REQUIRED',
    );
  }
  await verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
    {
      root: input.root,
      snapshot: input.historicalSnapshot,
    },
  );
  const root = resolve(input.root);
  const relativePath = buildEvidencePath(input.startedAt, input.runId);
  const leafName = relativePath.split('/').at(-1);
  if (!leafName) {
    throw new Error('CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_IDENTITY_INVALID');
  }
  return reserveNativeEvidence(root, relativePath, leafName);
}

/**
 * The first durable finalized record is always the safe evidence-io closure.
 * Only after the last history check succeeds may it be replaced with the
 * requested terminal summary and sealed. This does not claim an impossible
 * atomic lock across external history writers: each lifecycle boundary takes a
 * fresh manifest, and every write failure seals an already-safe record.
 */
export async function finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
  input: Readonly<{
    root: string;
    historicalSnapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot;
    reservation: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation;
    summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary;
  }>,
): Promise<boolean> {
  const capability = reservationCapabilities.get(input.reservation);
  if (!capability) return false;
  const safeWrite = await capability.finalize(evidenceIoSummary(input.summary));
  if (!safeWrite) {
    capability.seal();
    return false;
  }
  try {
    await verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
      {
        root: input.root,
        snapshot: input.historicalSnapshot,
      },
    );
  } catch {
    capability.seal();
    return false;
  }
  const terminalWrite = await capability.finalize(input.summary);
  if (!terminalWrite) {
    capability.seal();
    return false;
  }
  capability.seal();
  return true;
}

export function serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
  state: EvidenceState,
  summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
): string {
  const parsed =
    safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
      summary,
    );
  const record = {
    schemaVersion:
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceSchemaVersion,
    state,
    ...parsed,
  };
  const evidence = parseRecord(state, record);
  const serialized = `${JSON.stringify(evidence)}\n`;
  if (forbiddenEvidenceText.test(serialized)) {
    throw new Error(
      'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_SERIALIZATION_FAILED',
    );
  }
  return serialized;
}

async function reserveNativeEvidence(
  root: string,
  relativePath: string,
  leafName: string,
): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseDirectory(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceDirectory.split(
        '/',
      ),
    );
    const evidenceDirectory = resolveInsideRoot(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceDirectory,
    );
    if ((await readdir(evidenceDirectory)).length > 0) {
      throw new Error(
        'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    directory.createExclusiveFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.onceLockLeaf,
      V6_CONSUMED_MARKER,
    );
    directory.createExclusiveFile(
      leafName,
      serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
        'reserved',
        blockedSummary(),
      ),
    );
  } catch (exception) {
    directory?.close();
    if (
      exception instanceof Error &&
      (exception.message.includes('ALREADY') ||
        exception.message.includes('WINDOWS_REPARSE_SAFE_IO_ALREADY_EXISTS'))
    ) {
      throw new Error(
        'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    throw new Error(
      'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_RESERVATION_FAILED',
    );
  }
  return nativeReservation(directory, relativePath, leafName);
}

function nativeReservation(
  directory: WindowsNoReparseChildDirectory,
  relativePath: string,
  leafName: string,
): ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceReservation {
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
    summary: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
  ) => {
    try {
      const serialized =
        serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence(
          nextState,
          summary,
        );
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
  const reservation = Object.freeze({
    relativePath,
    markAttempted() {
      if (state !== 'reserved') return Promise.resolve(false);
      const changed = replace('attempted', attemptedSummary());
      if (changed) state = 'attempted';
      return Promise.resolve(changed);
    },
  });
  const capability: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceCapability =
    Object.freeze({
      finalize(summary) {
        // A reservation has no public terminal writer. The controlled finalizer
        // alone may close a reserved record, and only with its first fixed
        // evidence-io record when no provider boundary has been reached.
        if (state === 'reserved' && !isReservedEvidenceIoClosure(summary)) {
          return Promise.resolve(false);
        }
        if (
          state !== 'reserved' &&
          state !== 'attempted' &&
          state !== 'finalized'
        ) {
          return Promise.resolve(false);
        }
        const changed = replace('finalized', summary);
        if (changed) state = 'finalized';
        return Promise.resolve(changed);
      },
      seal() {
        // Even when filesystem permissions deny both the attempt transition and
        // the first safe closure replacement, the consumed reservation handle
        // must never remain writable after the CLI returns its safe stdout.
        close();
      },
    });
  reservationCapabilities.set(reservation, capability);
  return reservation;
}

function blockedSummary(): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  return safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
    {
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    },
  );
}

function attemptedSummary(): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  return safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
    {
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    },
  );
}

function evidenceIoSummary(
  value: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
): SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary {
  let providerAttemptCount = 0;
  try {
    const parsed =
      safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
        value,
      );
    providerAttemptCount = parsed.providerAttemptCount;
  } catch {
    // The durable closure intentionally preserves no untrusted detail.
  }
  return safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
    {
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    },
  );
}

function isReservedEvidenceIoClosure(
  value: SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
) {
  return (
    value.status === 'invalid_attempted' &&
    value.gate === 'closed' &&
    value.providerAttemptCount === 0 &&
    value.usageKnown === false &&
    value.diagnosticCode === ReviewPlannerDiagnosticCode.EvidenceIo
  );
}

function parseRecord(state: EvidenceState, record: unknown) {
  switch (state) {
    case 'reserved':
      return reviewPlannerControlledLiveV6DeepSeekNonThinkingReservedRecordSchema.parse(
        record,
      );
    case 'attempted':
      return reviewPlannerControlledLiveV6DeepSeekNonThinkingAttemptedRecordSchema.parse(
        record,
      );
    case 'finalized':
      return reviewPlannerControlledLiveV6DeepSeekNonThinkingFinalizedRecordSchema.parse(
        record,
      );
  }
}

function buildEvidencePath(startedAt: string, runId: string) {
  let timestamp = '';
  try {
    timestamp = new Date(startedAt)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.', '');
  } catch {
    throw new Error('CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_IDENTITY_INVALID');
  }
  if (
    !/^\d{8}T\d{9}Z$/.test(timestamp) ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
  ) {
    throw new Error('CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_IDENTITY_INVALID');
  }
  const digest = createHash('sha256')
    .update(runId, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `${REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceDirectory}/review-planner-live-${timestamp}-${digest}.json`;
}

function trustedSnapshotRoot(rootInput: string) {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error('native historical reader required');
  }
  return resolve(rootInput);
}

async function readHistoricalTree(root: string, directory: string) {
  const output: HistoricalEvidenceEntry[] = [];
  await walkHistoricalTree(root, directory.split('/'), output);
  return output;
}

async function walkHistoricalTree(
  root: string,
  segments: readonly string[],
  output: HistoricalEvidenceEntry[],
): Promise<void> {
  const relativePath = segments.join('/');
  const enumerationPath = resolveInsideRoot(root, relativePath);
  const directory = await openWindowsNoReparseExistingDirectory(root, segments);
  try {
    output.push({
      relativePath,
      type: 'directory',
      sha256: createHash('sha256').update('directory').digest('hex'),
      byteLength: 0,
    });
    // `readdir` is only a source of untrusted leaf names. It never supplies
    // content or traversal authority: the directory HANDLE is already bound
    // with DELETE denied, each file is reopened relative/no-reparse, and any
    // recursively discovered directory is rebound existing-only/no-reparse.
    // A concurrent add/change cannot become junction traversal; the next fresh
    // manifest boundary detects it as a hash mismatch instead.
    const entries = (await readdir(enumerationPath)).sort((left, right) =>
      left.localeCompare(right),
    );
    for (const entry of entries) {
      try {
        const contents = directory.readRegularFile(entry);
        output.push({
          relativePath: `${relativePath}/${entry}`,
          type: 'file',
          sha256: createHash('sha256').update(contents).digest('hex'),
          byteLength: contents.byteLength,
        });
      } catch {
        await walkHistoricalTree(root, [...segments, entry], output);
      }
    }
  } finally {
    directory.close();
  }
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

function calculateNonCachedCnyCost(inputTokens: number, outputTokens: number) {
  return (
    Math.round(
      ((inputTokens * 3 + outputTokens * 6) / 1_000_000) * 100_000_000,
    ) / 100_000_000
  );
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
): value is ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v2' &&
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
    typeof entry.byteLength === 'number' &&
    Number.isSafeInteger(entry.byteLength) &&
    entry.byteLength >= 0
  );
}

function resolveInsideRoot(root: string, relativePath: string) {
  const target = resolve(root, relativePath);
  if (!target.startsWith(`${root}${sep}`)) {
    throw new Error('CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_OUTSIDE_ROOT');
  }
  return target;
}
