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

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID =
  'deepseek-v4-pro-cny-noncached-2026-07-17-v7' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE =
  Object.freeze({
    id: REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID,
    evidenceSchemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v7-deepseek-v4-pro-usage-parity',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity',
    onceLockLeaf:
      '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once',
  } as const);

const V7_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity-consumed\n';
const V7_MAX_PROVIDER_ATTEMPTS = 23;
const V7_MAX_INPUT_TOKENS = 42_996;
const V7_MAX_OUTPUT_TOKENS = 9_712;
const V7_HARD_CAP_CNY = 1;
const forbiddenEvidenceText =
  /prompt|response|token.?detail|candidate|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret|endpoint|url|header|raw[_-]?(?:output|error)/i;

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
  'provider_usage_missing',
  'provider_usage_invalid',
  'sdk_usage_lost',
  'output_limit_exceeded',
  'usage_reservation_exceeded',
]);

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
      .max(V7_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: diagnosticCodeSchema,
  })
  .strict();

const completeSummarySchema = z
  .object({
    status: z.literal('complete'),
    gate: z.literal('eligible_for_separate_product_acceptance'),
    providerAttemptCount: z.literal(V7_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(true),
    aggregateInputTokens: z
      .number()
      .int()
      .safe()
      .min(1)
      .max(V7_MAX_INPUT_TOKENS),
    aggregateOutputTokens: z
      .number()
      .int()
      .safe()
      .min(1)
      .max(V7_MAX_OUTPUT_TOKENS),
    observedCostCny: z.number().finite().positive().max(V7_HARD_CAP_CNY),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
    ),
    caseEntries: z.literal(48),
    zeroCallCases: z.literal(26),
    runtimeInvocations: z.literal(22),
    strictSuccesses: z.literal(48),
    qualityPasses: z.literal(48),
    criticalFailures: z.literal(0),
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
        message: 'CONTROLLED_LIVE_V7_USAGE_PARITY_COST_INVALID',
      });
    }
  });

export const safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema =
  z.union([
    diagnosticBlockedSummarySchema,
    ordinaryClosedSummarySchema,
    completeSummarySchema,
  ]);

export type SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary =
  Readonly<
    z.infer<
      typeof safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema
    >
  >;

export const reviewPlannerControlledLiveV7DeepSeekUsageParityReservedRecordSchema =
  diagnosticBlockedSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
      ),
      state: z.literal('reserved'),
    })
    .strict();

export const reviewPlannerControlledLiveV7DeepSeekUsageParityAttemptedRecordSchema =
  ordinaryClosedSummarySchema
    .extend({
      schemaVersion: z.literal(
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
      ),
      state: z.literal('attempted'),
    })
    .strict();

export const reviewPlannerControlledLiveV7DeepSeekUsageParityFinalizedRecordSchema =
  z.union([
    diagnosticBlockedSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
    ordinaryClosedSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
    completeSummarySchema
      .extend({
        schemaVersion: z.literal(
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
        ),
        state: z.literal('finalized'),
      })
      .strict(),
  ]);

export const safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema =
  z.union([
    reviewPlannerControlledLiveV7DeepSeekUsageParityReservedRecordSchema,
    reviewPlannerControlledLiveV7DeepSeekUsageParityAttemptedRecordSchema,
    reviewPlannerControlledLiveV7DeepSeekUsageParityFinalizedRecordSchema,
  ]);

type EvidenceState = 'reserved' | 'attempted' | 'finalized';

export type ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation =
  Readonly<{
    relativePath: string;
    markAttempted(): Promise<boolean>;
  }>;

type ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceCapability =
  Readonly<{
    beginFinalization(
      summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
    ): boolean;
    writeSafeProvisional(
      summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
    ): Promise<boolean>;
    writeTerminalReplacement(
      summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
    ): Promise<boolean>;
    writePostTerminalHistoryFailure(
      summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
    ): Promise<boolean>;
    verifyHistoricalEvidence(): Promise<boolean>;
    seal(): void;
  }>;

/** Terminal-write authority is never exported with the reservation handle. */
const reservationCapabilities = new WeakMap<
  ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation,
  ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceCapability
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
  {
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
    onceLockLeaf:
      '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
  },
] as const;

const V6_EVIDENCE_DIRECTORY =
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking';
const V6_MARKER_PATH = `${V6_EVIDENCE_DIRECTORY}/.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once`;
const V6_JSON_PATH = `${V6_EVIDENCE_DIRECTORY}/review-planner-live-20260717T111332841Z-9d02337a8c85.json`;
const V6_MARKER_SHA256 =
  'ac04ea11c4e416e44bd870c158a6bff0d65db297262ab6610790cf355525ec31';
const V6_JSON_SHA256 =
  '4fb435824785af4b2601b83787b22a4b98de1ac47d222f2566e351960bfd1afb';

type HistoricalEvidenceEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;

export type ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot =
  Readonly<{
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v3';
    treeHash: string;
    entries: readonly HistoricalEvidenceEntry[];
  }>;

/**
 * Captures a no-content manifest of all immutable V1--V6 evidence lineages.
 * The reader never creates history and binds every directory through a
 * no-reparse HANDLE before it reads an entry.
 */
export async function snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
  rootInput: string,
): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot> {
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
    assertPinnedV6Evidence(entries);
    return Object.freeze({
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v3',
      treeHash: hashHistoricalEntries(entries),
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

/** Runs a fresh no-write V1--V6 manifest check at every boundary. */
export async function verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
  input: Readonly<{
    root: string;
    snapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot> {
  try {
    if (!isSnapshot(input.snapshot)) throw new Error('snapshot invalid');
    const current =
      await snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
        input.root,
      );
    if (
      current.treeHash !== input.snapshot.treeHash ||
      !sameEntries(current.entries, input.snapshot.entries)
    ) {
      throw new Error('snapshot mismatch');
    }
    return current;
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

/**
 * Reserves the only writable V7 tree after the first mandatory V1--V6 check.
 * Its caller must separately run the same verifier before executor and
 * provider boundaries; this module does not hold credentials or executors.
 */
export async function reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
  input: Readonly<{
    root: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation> {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_TRUSTED_HANDLE_REQUIRED',
    );
  }
  const historicalSnapshot =
    await verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
      {
        root: input.root,
        snapshot: input.historicalSnapshot,
      },
    );
  const root = resolve(input.root);
  const relativePath = buildEvidencePath(input.startedAt, input.runId);
  const leafName = relativePath.split('/').at(-1);
  if (!leafName) {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_IDENTITY_INVALID',
    );
  }
  return reserveNativeEvidence(
    root,
    relativePath,
    leafName,
    historicalSnapshot,
  );
}

/**
 * The first durable finalized record is always the safe evidence-io closure.
 * Only after the last history check succeeds may it be replaced with the
 * requested terminal summary and sealed. This does not claim an impossible
 * atomic lock across external history writers: each lifecycle boundary takes a
 * fresh manifest, and every write failure seals an already-safe record.
 */
export async function finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
  input: Readonly<{
    reservation: ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation;
    summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary;
  }>,
): Promise<boolean> {
  const parsedSummary =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.safeParse(
      input.summary,
    );
  if (!parsedSummary.success) return false;
  const summary = Object.freeze(parsedSummary.data);
  const capability = reservationCapabilities.get(input.reservation);
  if (!capability || !capability.beginFinalization(summary)) return false;
  const safeWrite = await capability.writeSafeProvisional(
    evidenceIoSummary(summary),
  );
  if (!safeWrite) {
    capability.seal();
    return false;
  }
  if (!(await capability.verifyHistoricalEvidence())) {
    capability.seal();
    return false;
  }
  const terminalWrite = await capability.writeTerminalReplacement(summary);
  if (!terminalWrite) {
    capability.seal();
    return false;
  }
  // Give same-turn filesystem writers one bounded quiescence window before
  // the required post-terminal snapshot. This is not a provider/file retry.
  await new Promise<void>((resolveWindow) => setTimeout(resolveWindow, 25));
  if (!(await capability.verifyHistoricalEvidence())) {
    await capability.writePostTerminalHistoryFailure(
      evidenceIoSummary(summary),
    );
    capability.seal();
    return false;
  }
  capability.seal();
  return true;
}

export function serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
  state: EvidenceState,
  summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
): string {
  const parsed =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
      summary,
    );
  const record = {
    schemaVersion:
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
    state,
    ...parsed,
  };
  const evidence = parseRecord(state, record);
  const serialized = `${JSON.stringify(evidence)}\n`;
  if (forbiddenEvidenceText.test(serialized)) {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_SERIALIZATION_FAILED',
    );
  }
  return serialized;
}

async function reserveNativeEvidence(
  root: string,
  relativePath: string,
  leafName: string,
  historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
): Promise<ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseDirectory(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceDirectory.split(
        '/',
      ),
    );
    const evidenceDirectory = resolveInsideRoot(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceDirectory,
    );
    if ((await readdir(evidenceDirectory)).length > 0) {
      throw new Error(
        'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    // Consume the lineage before creating its first record. A crash between
    // these two exclusive writes can leave marker-only state; that state is
    // deliberately irrecoverable and fail-closed, because retrying would risk
    // a second paid run. Operators must treat marker-only as evidence_io, not
    // delete the marker or reconstruct success evidence.
    directory.createExclusiveFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.onceLockLeaf,
      V7_CONSUMED_MARKER,
    );
    directory.createExclusiveFile(
      leafName,
      serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
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
        'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_RESERVATION_FAILED',
    );
  }
  return nativeReservation(
    directory,
    root,
    historicalSnapshot,
    relativePath,
    leafName,
  );
}

function nativeReservation(
  directory: WindowsNoReparseChildDirectory,
  root: string,
  historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
  relativePath: string,
  leafName: string,
): ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceReservation {
  let state: EvidenceState = 'reserved';
  let revision = 0;
  let closed = false;
  let finalizationClaimed = false;
  let safeProvisionalWritten = false;
  let terminalReplacementWritten = false;
  const close = () => {
    if (closed) return;
    closed = true;
    directory.close();
  };
  const replace = (
    nextState: 'attempted' | 'finalized',
    summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
  ) => {
    try {
      const serialized =
        serializeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
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
    async markAttempted() {
      if (state !== 'reserved') return false;
      try {
        await verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
          { root, snapshot: historicalSnapshot },
        );
      } catch {
        return false;
      }
      if (state !== 'reserved') return false;
      const changed = replace('attempted', attemptedSummary());
      if (changed) state = 'attempted';
      return changed;
    },
  });
  const capability: ReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceCapability =
    Object.freeze({
      beginFinalization(summary) {
        if (
          finalizationClaimed ||
          closed ||
          !isTerminalAllowedForState(state, summary)
        ) {
          return false;
        }
        finalizationClaimed = true;
        return true;
      },
      writeSafeProvisional(summary) {
        // The owner may first write only the bounded evidence-io closure. A
        // reserved record has never crossed a provider boundary, so its count
        // must remain zero; an attempted record preserves its safe count.
        if (
          !isEvidenceIoClosure(summary) ||
          (state === 'reserved' && !isReservedEvidenceIoClosure(summary)) ||
          (state !== 'reserved' && state !== 'attempted')
        ) {
          return Promise.resolve(false);
        }
        const changed = replace('finalized', summary);
        if (changed) {
          state = 'finalized';
          safeProvisionalWritten = true;
        }
        return Promise.resolve(changed);
      },
      writeTerminalReplacement(summary) {
        // Exactly one terminal replacement may follow the safe provisional
        // record. Re-entering the public controlled finalizer cannot rewrite
        // either provisional or terminal evidence.
        if (!safeProvisionalWritten || state !== 'finalized') {
          return Promise.resolve(false);
        }
        const changed = replace('finalized', summary);
        if (changed) {
          safeProvisionalWritten = false;
          terminalReplacementWritten = true;
        }
        return Promise.resolve(changed);
      },
      writePostTerminalHistoryFailure(summary) {
        if (
          !terminalReplacementWritten ||
          state !== 'finalized' ||
          !isEvidenceIoClosure(summary)
        ) {
          return Promise.resolve(false);
        }
        const changed = replace('finalized', summary);
        if (changed) terminalReplacementWritten = false;
        return Promise.resolve(changed);
      },
      async verifyHistoricalEvidence() {
        try {
          await verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
            { root, snapshot: historicalSnapshot },
          );
          return true;
        } catch {
          return false;
        }
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

function isTerminalAllowedForState(
  state: EvidenceState,
  summary: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
) {
  const parsed =
    safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.safeParse(
      summary,
    );
  if (!parsed.success || state === 'finalized') return false;
  if (state === 'reserved') {
    return (
      parsed.data.status === 'diagnostic_blocked' ||
      (parsed.data.status === 'invalid_attempted' &&
        parsed.data.providerAttemptCount === 0 &&
        parsed.data.diagnosticCode === ReviewPlannerDiagnosticCode.EvidenceIo)
    );
  }
  return parsed.data.status !== 'diagnostic_blocked';
}

function blockedSummary(): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary {
  return safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
    {
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    },
  );
}

function attemptedSummary(): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary {
  return safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
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
  value: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
): SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary {
  let providerAttemptCount = 0;
  try {
    const parsed =
      safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
        value,
      );
    providerAttemptCount = parsed.providerAttemptCount;
  } catch {
    // The durable closure intentionally preserves no untrusted detail.
  }
  return safeReviewPlannerControlledLiveV7DeepSeekUsageParitySummarySchema.parse(
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
  value: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
) {
  return isEvidenceIoClosure(value) && value.providerAttemptCount === 0;
}

function isEvidenceIoClosure(
  value: SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
) {
  return (
    value.status === 'invalid_attempted' &&
    value.gate === 'closed' &&
    value.usageKnown === false &&
    value.diagnosticCode === ReviewPlannerDiagnosticCode.EvidenceIo
  );
}

function parseRecord(state: EvidenceState, record: unknown) {
  switch (state) {
    case 'reserved':
      return reviewPlannerControlledLiveV7DeepSeekUsageParityReservedRecordSchema.parse(
        record,
      );
    case 'attempted':
      return reviewPlannerControlledLiveV7DeepSeekUsageParityAttemptedRecordSchema.parse(
        record,
      );
    case 'finalized':
      return reviewPlannerControlledLiveV7DeepSeekUsageParityFinalizedRecordSchema.parse(
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
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_IDENTITY_INVALID',
    );
  }
  if (
    !/^\d{8}T\d{9}Z$/.test(timestamp) ||
    !/^[A-Za-z0-9._:-]{1,120}$/.test(runId)
  ) {
    throw new Error(
      'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_IDENTITY_INVALID',
    );
  }
  const digest = createHash('sha256')
    .update(runId, 'utf8')
    .digest('hex')
    .slice(0, 12);
  return `${REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceDirectory}/review-planner-live-${timestamp}-${digest}.json`;
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

function assertPinnedV6Evidence(entries: readonly HistoricalEvidenceEntry[]) {
  const v6Entries = entries.filter(
    (entry) =>
      entry.relativePath === V6_EVIDENCE_DIRECTORY ||
      entry.relativePath.startsWith(`${V6_EVIDENCE_DIRECTORY}/`),
  );
  if (
    v6Entries.length !== 3 ||
    !v6Entries.some(
      (entry) =>
        entry.relativePath === V6_EVIDENCE_DIRECTORY &&
        entry.type === 'directory',
    ) ||
    !v6Entries.some(
      (entry) =>
        entry.relativePath === V6_MARKER_PATH &&
        entry.type === 'file' &&
        entry.sha256 === V6_MARKER_SHA256,
    ) ||
    !v6Entries.some(
      (entry) =>
        entry.relativePath === V6_JSON_PATH &&
        entry.type === 'file' &&
        entry.sha256 === V6_JSON_SHA256,
    )
  ) {
    throw new Error('pinned V6 evidence mismatch');
  }
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
): value is ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v3' &&
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
    throw new Error('CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_OUTSIDE_ROOT');
  }
  return target;
}
