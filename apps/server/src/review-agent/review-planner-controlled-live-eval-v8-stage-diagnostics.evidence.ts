import { createHash, randomBytes } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';
import { z } from 'zod';

import {
  openWindowsNoReparseDirectory,
  openWindowsNoReparseChildDirectoryForTests,
  openWindowsNoReparseExistingDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import { snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence } from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID =
  'deepseek-v4-pro-cny-noncached-2026-07-18-v8-stage-diagnostics' as const;

export const REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE =
  Object.freeze({
    id: 'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
    evidenceSchemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v8-stage-diagnostics',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
    onceLockLeaf:
      '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.once',
    successCommitLeaf:
      '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.success',
  } as const);

export const REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES = Object.freeze([
  '.stage-010-reserved',
  '.stage-020-attempted',
  '.stage-030-evaluator-ready',
  '.stage-040-provider-history-verified',
  '.stage-050-canary-started',
  '.stage-060-canary-returned',
  '.stage-070-paired-started',
  '.stage-080-paired-returned',
  '.stage-090-report-validated',
  '.stage-100-finalization-started',
  '.stage-110-safe-provisional-written',
  '.stage-120-internal-history-verified',
  '.stage-130-terminal-record-written',
  '.stage-140-post-terminal-history-verified',
  '.stage-150-success-commit-started',
] as const);

export type ReviewPlannerControlledLiveV8Stage =
  (typeof REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES)[number];

const V8_MAX_PROVIDER_ATTEMPTS = 23;
const V8_MAX_INPUT_TOKENS = 42_996;
const V8_MAX_OUTPUT_TOKENS = 9_712;
const V8_HARD_CAP_CNY = 1;
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

const blockedSummarySchema = z
  .object({
    status: z.literal('diagnostic_blocked'),
    gate: z.literal('closed'),
    providerAttemptCount: z.literal(0),
    usageKnown: z.literal(false),
    diagnosticCode: z.literal(ReviewPlannerDiagnosticCode.PreflightInvalid),
  })
  .strict();
const failedSummarySchema = z
  .object({
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().min(0).max(V8_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: diagnosticCodeSchema,
  })
  .strict();
const completeSummarySchema = z
  .object({
    status: z.literal('complete'),
    gate: z.literal('closed'),
    providerAttemptCount: z.literal(V8_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(true),
    aggregateInputTokens: z.number().int().positive().max(V8_MAX_INPUT_TOKENS),
    aggregateOutputTokens: z
      .number()
      .int()
      .positive()
      .max(V8_MAX_OUTPUT_TOKENS),
    observedCostCny: z.number().positive().max(V8_HARD_CAP_CNY),
    priceProfileId: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
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
        message: 'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_COST_INVALID',
      });
    }
  });

export const safeReviewPlannerControlledLiveV8SummarySchema = z.union([
  blockedSummarySchema,
  failedSummarySchema,
  completeSummarySchema,
]);
export type SafeReviewPlannerControlledLiveV8Summary = Readonly<
  z.infer<typeof safeReviewPlannerControlledLiveV8SummarySchema>
>;

const failureRecordSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
    ),
    state: z.enum(['reserved', 'attempted', 'finalized']),
    status: z.enum(['diagnostic_blocked', 'invalid_attempted']),
    gate: z.literal('closed'),
    providerAttemptCount: z.number().int().min(0).max(V8_MAX_PROVIDER_ATTEMPTS),
    usageKnown: z.literal(false),
    diagnosticCode: diagnosticCodeSchema,
  })
  .strict();

export function serializeReviewPlannerControlledLiveV8Evidence(value: unknown) {
  const parsed = failureRecordSchema.parse({
    schemaVersion:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
    ...(value as object),
  });
  return `${JSON.stringify(parsed)}\n`;
}

function calculateNonCachedCnyCost(inputTokens: number, outputTokens: number) {
  return Number(((inputTokens * 3 + outputTokens * 6) / 1_000_000).toFixed(8));
}

const V8_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics-consumed\n';
const V7_EVIDENCE_DIRECTORY =
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity';
const V7_ONCE_LEAF =
  '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once';
const V7_TERMINAL_LEAF =
  'review-planner-live-20260717T161356046Z-e26f821fdc46.json';
const V7_MARKER_SHA256 =
  '1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda';
const V7_TERMINAL_SHA256 =
  '79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

type HistoricalEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;

export type ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot = Readonly<{
  schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v4';
  treeHash: string;
  entries: readonly HistoricalEntry[];
}>;

export async function snapshotReviewPlannerControlledLiveV8HistoricalEvidence(
  rootInput = process.cwd(),
): Promise<ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    const root = trustedRoot(rootInput);
    const previous =
      await snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
        root,
      );
    directory = await openWindowsNoReparseExistingDirectory(
      root,
      V7_EVIDENCE_DIRECTORY.split('/'),
    );
    const names = (
      await readdir(resolveInsideRoot(root, V7_EVIDENCE_DIRECTORY))
    ).sort();
    if (
      names.length !== 2 ||
      names[0] !== V7_ONCE_LEAF ||
      names[1] !== V7_TERMINAL_LEAF
    ) {
      throw new Error('unexpected V7 evidence tree');
    }
    const marker = directory.readRegularFile(V7_ONCE_LEAF);
    const terminal = directory.readRegularFile(V7_TERMINAL_LEAF);
    if (
      sha256(marker) !== V7_MARKER_SHA256 ||
      sha256(terminal) !== V7_TERMINAL_SHA256
    ) {
      throw new Error('V7 pin mismatch');
    }
    const entries: HistoricalEntry[] = [
      ...previous.entries,
      {
        relativePath: `${V7_EVIDENCE_DIRECTORY}/${V7_ONCE_LEAF}`,
        type: 'file' as const,
        sha256: V7_MARKER_SHA256,
        byteLength: marker.byteLength,
      },
      {
        relativePath: `${V7_EVIDENCE_DIRECTORY}/${V7_TERMINAL_LEAF}`,
        type: 'file' as const,
        sha256: V7_TERMINAL_SHA256,
        byteLength: terminal.byteLength,
      },
    ].sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath),
    );
    return Object.freeze({
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v4',
      treeHash: hashEntries(entries),
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_HISTORICAL_INTEGRITY_FAILED',
    );
  } finally {
    directory?.close();
  }
}

export async function verifyReviewPlannerControlledLiveV8HistoricalEvidence(
  input: Readonly<{
    root?: string;
    snapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
  }>,
) {
  try {
    if (!isSnapshot(input.snapshot)) throw new Error('invalid snapshot');
    const current =
      await snapshotReviewPlannerControlledLiveV8HistoricalEvidence(input.root);
    if (
      current.treeHash !== input.snapshot.treeHash ||
      JSON.stringify(current.entries) !== JSON.stringify(input.snapshot.entries)
    ) {
      throw new Error('history drift');
    }
    return current;
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

const successCandidateSchema = completeSummarySchema
  .extend({
    schemaVersion: z.literal(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
    ),
    state: z.literal('success_candidate'),
    successCommitmentSha256: z.string().regex(HASH_PATTERN),
    stageManifestSha256: z.string().regex(HASH_PATTERN),
  })
  .strict();
const successSealSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-review-planner-controlled-live-v8-success-commit-v1',
    ),
    evidenceLeaf: z
      .string()
      .regex(/^review-planner-live-[A-Za-z0-9._-]+\.json$/),
    candidateSha256: z.string().regex(HASH_PATTERN),
    historicalTreeHash: z.string().regex(HASH_PATTERN),
    stageManifestSha256: z.string().regex(HASH_PATTERN),
    onceMarkerSha256: z.string().regex(HASH_PATTERN),
    commitNonce: z.string().regex(HASH_PATTERN),
  })
  .strict();

export type ReviewPlannerControlledLiveV8EvidenceReservation = Readonly<{
  relativePath: string;
  markAttempted(): Promise<boolean>;
}>;

type Capability = {
  directory: WindowsNoReparseChildDirectory;
  root: string;
  snapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
  leafName: string;
  stageIndex: number;
  state: 'reserved' | 'attempted' | 'finalized' | 'success_candidate';
  revision: number;
  closed: boolean;
  finalizing: boolean;
  nonce: string;
  nonceCommitment: string;
  onceMarkerSha256: string;
  cleanupInjectedHandles: (() => void) | null;
};
const reservationCapabilities = new WeakMap<
  ReviewPlannerControlledLiveV8EvidenceReservation,
  Capability
>();

export async function reserveReviewPlannerControlledLiveV8Evidence(
  input: Readonly<{
    root?: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV8EvidenceReservation> {
  return reserveReviewPlannerControlledLiveV8EvidenceInternal(input, null);
}

type DurableFaultPhase =
  | 'write'
  | 'flush'
  | 'close'
  | 'prepare_create'
  | 'prepare_write'
  | 'prepare_flush'
  | 'prepare_close'
  | 'prepare_reopen'
  | 'rename'
  | 'post_commit_cleanup'
  | 'volume_non_ntfs'
  | 'volume_non_disk_device'
  | 'volume_remote_characteristic'
  | 'volume_removable_characteristic';

/** Instance-scoped native fault facade; it owns no global mutable hook. */
export function createReviewPlannerControlledLiveV8EvidenceTestHarness(
  injector: (phase: DurableFaultPhase) => boolean,
) {
  return Object.freeze({
    reserve(
      input: Parameters<typeof reserveReviewPlannerControlledLiveV8Evidence>[0],
    ) {
      return reserveReviewPlannerControlledLiveV8EvidenceInternal(
        input,
        injector,
      );
    },
  });
}

async function reserveReviewPlannerControlledLiveV8EvidenceInternal(
  input: Readonly<{
    root?: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot;
  }>,
  injector: ((phase: DurableFaultPhase) => boolean) | null,
): Promise<ReviewPlannerControlledLiveV8EvidenceReservation> {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_EVIDENCE_TRUSTED_HANDLE_REQUIRED',
    );
  }
  const root = trustedRoot(input.root);
  const snapshot = await verifyReviewPlannerControlledLiveV8HistoricalEvidence({
    root,
    snapshot: input.historicalSnapshot,
  });
  const leafName = buildEvidenceLeaf(input.startedAt, input.runId);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let cleanupInjectedHandles: (() => void) | null = null;
  try {
    const evidenceSegments =
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceDirectory.split(
        '/',
      );
    if (injector) {
      const facade = await openWindowsNoReparseChildDirectoryForTests(
        resolve(root, ...evidenceSegments.slice(0, -1)),
        evidenceSegments.at(-1)!,
        injector,
      );
      directory = facade.directory;
      cleanupInjectedHandles = facade.cleanupInjectedHandles;
    } else {
      directory = await openWindowsNoReparseDirectory(root, evidenceSegments);
    }
    const absoluteDirectory = resolveInsideRoot(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceDirectory,
    );
    directory.assertLocalFixedNtfsVolume();
    if ((await readdir(absoluteDirectory)).length !== 0) {
      throw new Error('already consumed');
    }
    const oncePublication = publishV8Artifact(
      directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.onceLockLeaf,
      V8_CONSUMED_MARKER,
    );
    cleanupInjectedHandles?.();
    if (!oncePublication.committed) {
      throw new Error('once publication failed');
    }
    directory.createExclusiveDurableFile(
      leafName,
      serializeReviewPlannerControlledLiveV8Evidence({
        state: 'reserved',
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      }),
    );
    const reservedStagePublication = publishV8Artifact(
      directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[0],
      '',
    );
    cleanupInjectedHandles?.();
    if (!reservedStagePublication.committed) {
      throw new Error('reserved stage publication failed');
    }
  } catch (error) {
    try {
      cleanupInjectedHandles?.();
    } catch {
      // Converted to the fixed reservation failure below.
    }
    directory?.close();
    if (error instanceof Error && /already|ALREADY/i.test(error.message)) {
      throw new Error(
        'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_EVIDENCE_RESERVATION_FAILED',
    );
  }
  const boundDirectory = directory;
  const nonce = randomBytes(32).toString('hex');
  const capability: Capability = {
    directory: boundDirectory,
    root,
    snapshot,
    leafName,
    stageIndex: 0,
    state: 'reserved',
    revision: 0,
    closed: false,
    finalizing: false,
    nonce,
    nonceCommitment: sha256(Buffer.from(nonce, 'utf8')),
    onceMarkerSha256: sha256(Buffer.from(V8_CONSUMED_MARKER, 'utf8')),
    cleanupInjectedHandles,
  };
  const reservation = Object.freeze({
    relativePath: `${REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceDirectory}/${leafName}`,
    async markAttempted() {
      if (capability.closed || capability.state !== 'reserved') return false;
      try {
        await verifyReviewPlannerControlledLiveV8HistoricalEvidence({
          root: capability.root,
          snapshot: capability.snapshot,
        });
        const ok = replaceEvidence(
          capability,
          serializeReviewPlannerControlledLiveV8Evidence({
            state: 'attempted',
            status: 'invalid_attempted',
            gate: 'closed',
            providerAttemptCount: 0,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          }),
        );
        if (ok) capability.state = 'attempted';
        return ok;
      } catch {
        return stopCapability(capability);
      }
    },
  });
  reservationCapabilities.set(reservation, capability);
  return reservation;
}

export function advanceReviewPlannerControlledLiveV8Stage(
  reservation: ReviewPlannerControlledLiveV8EvidenceReservation,
  exactStage: ReviewPlannerControlledLiveV8Stage,
): boolean {
  const capability = reservationCapabilities.get(reservation);
  if (!capability || capability.closed || capability.finalizing) return false;
  const expectedIndex = capability.stageIndex + 1;
  if (
    expectedIndex > 8 ||
    REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[expectedIndex] !== exactStage ||
    (expectedIndex >= 1 && capability.state !== 'attempted')
  ) {
    return false;
  }
  return createStage(capability, exactStage, expectedIndex);
}

export async function finalizeReviewPlannerControlledLiveV8Evidence(
  input: Readonly<{
    reservation: ReviewPlannerControlledLiveV8EvidenceReservation;
    summary: SafeReviewPlannerControlledLiveV8Summary;
  }>,
): Promise<boolean> {
  const parsed = safeReviewPlannerControlledLiveV8SummarySchema.safeParse(
    input.summary,
  );
  const capability = reservationCapabilities.get(input.reservation);
  if (
    !parsed.success ||
    !capability ||
    capability.closed ||
    capability.finalizing ||
    capability.state !== 'attempted' ||
    capability.stageIndex !== 8 ||
    parsed.data.status === 'diagnostic_blocked'
  ) {
    return false;
  }
  capability.finalizing = true;
  const summary = Object.freeze(parsed.data);
  if (!createInternalStage(capability, 9)) return false;
  const provisional = serializeReviewPlannerControlledLiveV8Evidence({
    state: 'finalized',
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: summary.providerAttemptCount,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  });
  if (!replaceEvidence(capability, provisional))
    return stopCapability(capability);
  capability.state = 'finalized';
  if (!createInternalStage(capability, 10)) return false;
  try {
    await verifyReviewPlannerControlledLiveV8HistoricalEvidence({
      root: capability.root,
      snapshot: capability.snapshot,
    });
  } catch {
    return stopCapability(capability);
  }
  if (!createInternalStage(capability, 11)) return false;
  const manifestHash = canonicalStageManifestSha256();
  const terminal =
    summary.status === 'complete'
      ? `${JSON.stringify(
          successCandidateSchema.parse({
            schemaVersion:
              REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
            state: 'success_candidate',
            ...summary,
            successCommitmentSha256: capability.nonceCommitment,
            stageManifestSha256: manifestHash,
          }),
        )}\n`
      : serializeReviewPlannerControlledLiveV8Evidence({
          state: 'finalized',
          ...summary,
        });
  if (!replaceEvidence(capability, terminal)) {
    return stopCapability(capability);
  }
  capability.state =
    summary.status === 'complete' ? 'success_candidate' : 'finalized';
  if (!createInternalStage(capability, 12)) return false;
  if (summary.status !== 'complete') {
    closeCapability(capability);
    return true;
  }
  try {
    await verifyReviewPlannerControlledLiveV8HistoricalEvidence({
      root: capability.root,
      snapshot: capability.snapshot,
    });
  } catch {
    replaceEvidence(capability, provisional);
    capability.state = 'finalized';
    return stopCapability(capability);
  }
  if (!createInternalStage(capability, 13)) return false;
  if (!createInternalStage(capability, 14)) return false;
  try {
    const candidate = capability.directory.readRegularFile(capability.leafName);
    const decoded = successCandidateSchema.parse(
      JSON.parse(candidate.toString('utf8')),
    );
    if (
      decoded.successCommitmentSha256 !== capability.nonceCommitment ||
      decoded.stageManifestSha256 !== manifestHash
    ) {
      return stopCapability(capability);
    }
    const seal = successSealSchema.parse({
      schemaVersion:
        'phase-6.9.5-review-planner-controlled-live-v8-success-commit-v1',
      evidenceLeaf: capability.leafName,
      candidateSha256: sha256(candidate),
      historicalTreeHash: capability.snapshot.treeHash,
      stageManifestSha256: manifestHash,
      onceMarkerSha256: capability.onceMarkerSha256,
      commitNonce: capability.nonce,
    });
    const sealPublication = publishV8Artifact(
      capability.directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.successCommitLeaf,
      `${JSON.stringify(seal)}\n`,
    );
    cleanupFaultHandles(capability);
    if (!sealPublication.committed) return stopCapability(capability);
    closeCapability(capability);
    return true;
  } catch {
    cleanupFaultHandles(capability);
    return stopCapability(capability);
  }
}

export async function readReviewPlannerControlledLiveV8Evidence(
  input:
    | string
    | Readonly<{ root?: string; relativePath?: string }> = process.cwd(),
): Promise<Record<string, unknown>> {
  const fallback = evidenceIoProjection(null);
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    const root = trustedRoot(typeof input === 'string' ? input : input.root);
    const evidenceDirectory =
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceDirectory;
    directory = await openWindowsNoReparseExistingDirectory(
      root,
      evidenceDirectory.split('/'),
    );
    const names = (
      await readdir(resolveInsideRoot(root, evidenceDirectory))
    ).sort();
    const allowedFixed = new Set([
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.onceLockLeaf,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.successCommitLeaf,
      ...REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES,
    ]);
    const evidenceNames = names.filter((name) =>
      /^review-planner-live-[A-Za-z0-9._-]+\.json$/.test(name),
    );
    if (evidenceNames.length !== 1) return fallback;
    const hasUnexpectedLeaf = names.some(
      (name) =>
        !allowedFixed.has(name as ReviewPlannerControlledLiveV8Stage) &&
        !evidenceNames.includes(name),
    );
    const requested =
      typeof input === 'string'
        ? undefined
        : input.relativePath?.split('/').at(-1);
    const leafName = requested ?? evidenceNames[0];
    if (leafName !== evidenceNames[0]) return fallback;
    const once = directory.readRegularFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.onceLockLeaf,
    );
    if (once.toString('utf8') !== V8_CONSUMED_MARKER) return fallback;
    const lastStage = readStagePrefix(directory, names);
    if (lastStage === false) return fallback;
    if (hasUnexpectedLeaf) return evidenceIoProjection(lastStage);
    const bytes = directory.readRegularFile(leafName);
    const decoded = JSON.parse(bytes.toString('utf8')) as unknown;
    const failure = failureRecordSchema.safeParse(decoded);
    if (failure.success && failure.data.state === 'finalized') {
      await snapshotReviewPlannerControlledLiveV8HistoricalEvidence(root);
      const lastStageIndex = lastStage
        ? REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.indexOf(lastStage)
        : -1;
      if (
        failure.data.diagnosticCode !==
          ReviewPlannerDiagnosticCode.EvidenceIo &&
        lastStageIndex < 12
      ) {
        return evidenceIoProjection(lastStage);
      }
      return { ...failure.data, lastStage };
    }
    const candidate = successCandidateSchema.safeParse(decoded);
    if (
      !candidate.success ||
      lastStage !== REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[14]
    ) {
      return evidenceIoProjection(lastStage);
    }
    let seal: ReturnType<typeof successSealSchema.safeParse>;
    try {
      seal = successSealSchema.safeParse(
        JSON.parse(
          directory
            .readRegularFile(
              REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.successCommitLeaf,
            )
            .toString('utf8'),
        ),
      );
    } catch {
      return evidenceIoProjection(lastStage);
    }
    const history =
      await snapshotReviewPlannerControlledLiveV8HistoricalEvidence(root);
    const manifestHash = canonicalStageManifestSha256();
    if (
      !seal.success ||
      seal.data.evidenceLeaf !== leafName ||
      seal.data.candidateSha256 !== sha256(bytes) ||
      seal.data.historicalTreeHash !== history.treeHash ||
      seal.data.stageManifestSha256 !== manifestHash ||
      candidate.data.stageManifestSha256 !== manifestHash ||
      seal.data.onceMarkerSha256 !== sha256(once) ||
      candidate.data.successCommitmentSha256 !==
        sha256(Buffer.from(seal.data.commitNonce, 'utf8'))
    ) {
      return evidenceIoProjection(lastStage);
    }
    const result: Record<string, unknown> = { ...candidate.data };
    result.state = 'finalized';
    result.lastStage = lastStage;
    delete result.successCommitmentSha256;
    delete result.stageManifestSha256;
    return result;
  } catch {
    return fallback;
  } finally {
    directory?.close();
  }
}

function replaceEvidence(capability: Capability, contents: string) {
  try {
    capability.directory.replaceDurableFile(
      `${capability.leafName}.tmp-${process.pid}-${capability.revision++}`,
      capability.leafName,
      contents,
    );
    return true;
  } catch {
    cleanupFaultHandles(capability);
    return false;
  }
}

function createInternalStage(capability: Capability, index: number) {
  if (capability.closed || capability.stageIndex + 1 !== index) return false;
  return createStage(
    capability,
    REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[index],
    index,
  );
}

function createStage(
  capability: Capability,
  stage: ReviewPlannerControlledLiveV8Stage,
  index: number,
) {
  try {
    const publication = publishV8Artifact(capability.directory, stage, '');
    cleanupFaultHandles(capability);
    if (!publication.committed) return stopCapability(capability);
    capability.stageIndex = index;
    return true;
  } catch {
    cleanupFaultHandles(capability);
    return stopCapability(capability);
  }
}

const V8_PUBLICATION_LEAVES = new Set<string>([
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.onceLockLeaf,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.successCommitLeaf,
  ...REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES,
]);

function publishV8Artifact(
  directory: WindowsNoReparseChildDirectory,
  committedLeaf: string,
  contents: string,
) {
  if (!V8_PUBLICATION_LEAVES.has(committedLeaf)) {
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PUBLICATION_LEAF_INVALID',
    );
  }
  return directory.commitExclusiveDurableFileViaRename(committedLeaf, contents);
}

function cleanupFaultHandles(capability: Capability) {
  try {
    capability.cleanupInjectedHandles?.();
  } catch {
    // The public transition remains fail-closed.
  }
}

function stopCapability(capability: Capability) {
  closeCapability(capability);
  return false;
}

function closeCapability(capability: Capability) {
  if (capability.closed) return;
  capability.closed = true;
  capability.directory.close();
}

function readStagePrefix(
  directory: WindowsNoReparseChildDirectory,
  names: readonly string[],
): ReviewPlannerControlledLiveV8Stage | null | false {
  let last: ReviewPlannerControlledLiveV8Stage | null = null;
  let gap = false;
  for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES) {
    const present = names.includes(stage);
    if (!present) {
      gap = true;
      continue;
    }
    if (gap || directory.readRegularFile(stage).byteLength !== 0) return false;
    last = stage;
  }
  return last;
}

function canonicalStageManifestSha256() {
  return sha256(
    Buffer.from(
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.map(
        (stage) => `${stage}\n`,
      ).join(''),
      'utf8',
    ),
  );
}

function evidenceIoProjection(
  lastStage: ReviewPlannerControlledLiveV8Stage | null,
) {
  return {
    schemaVersion:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
    state: 'finalized',
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    lastStage,
  } as const;
}

function buildEvidenceLeaf(startedAt: string, runId: string) {
  const compact = startedAt.replace(/[-:.]/g, '');
  if (
    !/^\d{8}T\d{9}Z$/.test(compact) ||
    !/^[A-Za-z0-9._-]{1,80}$/.test(runId)
  ) {
    throw new Error(
      'CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_EVIDENCE_IDENTITY_INVALID',
    );
  }
  return `review-planner-live-${compact}-${runId}.json`;
}

function trustedRoot(rootInput = process.cwd()) {
  const root = resolve(rootInput);
  if (!/^[A-Za-z]:\\/.test(root)) {
    throw new Error('CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_ROOT_INVALID');
  }
  return root;
}

function resolveInsideRoot(root: string, relativePath: string) {
  const value = resolve(root, ...relativePath.split('/'));
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (!value.startsWith(prefix)) throw new Error('path escape');
  return value;
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function hashEntries(entries: readonly HistoricalEntry[]) {
  return sha256(
    Buffer.from(
      entries
        .map(
          (entry) =>
            `${entry.type}\0${entry.relativePath}\0${entry.byteLength}\0${entry.sha256}\n`,
        )
        .join(''),
      'utf8',
    ),
  );
}

function isSnapshot(
  value: unknown,
): value is ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate =
    value as Partial<ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot>;
  return (
    candidate.schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v4' &&
    typeof candidate.treeHash === 'string' &&
    HASH_PATTERN.test(candidate.treeHash) &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(isHistoricalEntry)
  );
}

function isHistoricalEntry(value: unknown): value is HistoricalEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoricalEntry>;
  return (
    typeof entry.relativePath === 'string' &&
    (entry.type === 'file' || entry.type === 'directory') &&
    typeof entry.sha256 === 'string' &&
    HASH_PATTERN.test(entry.sha256) &&
    typeof entry.byteLength === 'number' &&
    Number.isSafeInteger(entry.byteLength) &&
    entry.byteLength >= 0
  );
}
