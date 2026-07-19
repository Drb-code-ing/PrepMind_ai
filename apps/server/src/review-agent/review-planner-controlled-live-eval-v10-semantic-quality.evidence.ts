import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { z } from 'zod';

import {
  v10SemanticQualityDiagnosticSchema,
  type V10SemanticQualityDiagnostic,
} from './review-planner-controlled-live-eval-v10-semantic-quality.contract';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
  snapshotReviewPlannerControlledLiveV9HistoricalEvidence,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE =
  Object.freeze({
    id: 'phase-6.9.5-review-planner-v10-semantic-quality',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v10-semantic-quality',
    onceLockLeaf: '.review-planner-controlled-live-v10-semantic-quality.once',
    diagnosticCommitLeaf: '.stage-085-safe-aggregate-committed.json',
    successCommitLeaf:
      '.review-planner-controlled-live-v10-semantic-quality.success',
  } as const);

export const REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES =
  Object.freeze([
    '.stage-010-reserved',
    '.stage-020-attempted',
    '.stage-030-evaluator-ready',
    '.stage-040-provider-history-verified',
    '.stage-050-canary-started',
    '.stage-060-canary-returned',
    '.stage-070-paired-started',
    '.stage-080-paired-returned',
    '.stage-085-safe-aggregate-committed.json',
    '.stage-090-validation-completed',
    '.stage-100-finalization-started',
    '.stage-110-safe-provisional-written',
    '.stage-120-internal-history-verified',
    '.stage-130-terminal-record-written',
    '.stage-140-post-terminal-history-verified',
    '.stage-150-success-commit-started',
  ] as const);

export type ReviewPlannerControlledLiveV10SemanticQualityStage =
  (typeof REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES)[number];
type HistoricalEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;
export type ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot =
  Readonly<{
    schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v10';
    treeHash: string;
    entries: readonly HistoricalEntry[];
  }>;

type DiagnosticCommitment = Readonly<{
  schemaVersion: 'phase-6.9.5-review-planner-v10-safe-aggregate-commit-v1';
  evidenceLeaf: string;
  diagnosticSha256: string;
  historicalTreeHash: string;
}>;

export type ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation =
  Readonly<{
    relativePath: string;
    historicalSnapshot: ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot;
    markAttempted(): Promise<boolean>;
    abort(): Promise<boolean>;
  }>;

const HASH = /^[a-f0-9]{64}$/;
const v9TerminalLeaf =
  'review-planner-live-20260718T214339911Z-031e34a1-7e35-4578-ba3a-cd58a6f544e0.json';
const v9ExpectedLeaves = Object.freeze(
  [
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
    ...REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(0, 10),
    v9TerminalLeaf,
  ].sort(),
);
const reservationRoots = new WeakMap<object, string>();
const V10_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v10-semantic-quality-consumed';
const diagnosticCommitmentSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-review-planner-v10-safe-aggregate-commit-v1',
    ),
    evidenceLeaf: z
      .string()
      .regex(/^review-planner-live-[A-Za-z0-9._-]+\.json$/),
    diagnosticSha256: z.string().regex(HASH),
    historicalTreeHash: z.string().regex(HASH),
  })
  .strict();
const successSealSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-review-planner-v10-success-commit-v1',
    ),
    evidenceLeaf: z
      .string()
      .regex(/^review-planner-live-[A-Za-z0-9._-]+\.json$/),
    diagnosticSha256: z.string().regex(HASH),
    historicalTreeHash: z.string().regex(HASH),
  })
  .strict();

export async function snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
  rootInput = process.cwd(),
): Promise<ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot> {
  try {
    const root = trustedRoot(rootInput);
    const v1ToV8 =
      await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root);
    const v9Directory = resolveInsideRoot(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory,
    );
    const names = (await readdir(v9Directory)).sort();
    if (JSON.stringify(names) !== JSON.stringify(v9ExpectedLeaves)) {
      throw new Error('v9_leaf_mismatch');
    }
    const v9Entries: HistoricalEntry[] = [];
    for (const name of names) {
      const absolute = resolveInsideRoot(
        root,
        `${REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory}/${name}`,
      );
      const stat = await lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
        throw new Error('v9_non_regular_leaf');
      }
      const bytes = await readFile(absolute);
      v9Entries.push(
        Object.freeze({
          relativePath: `${REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory}/${name}`,
          type: 'file',
          sha256: sha256(bytes),
          byteLength: bytes.byteLength,
        }),
      );
    }
    const entries = Object.freeze([...v1ToV8.entries, ...v9Entries]);
    return Object.freeze({
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v10',
      treeHash: sha256(JSON.stringify(entries)),
      entries,
    });
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

export async function verifyReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
  input: Readonly<{
    root?: string;
    snapshot: ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot;
  }>,
) {
  try {
    const current =
      await snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
        input.root,
      );
    if (
      current.treeHash !== input.snapshot.treeHash ||
      JSON.stringify(current.entries) !== JSON.stringify(input.snapshot.entries)
    ) {
      throw new Error('history_drift');
    }
    return current;
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

export async function reserveReviewPlannerControlledLiveV10SemanticQualityEvidence(
  input: Readonly<{
    root: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation> {
  const root = trustedRoot(input.root);
  if (!isSnapshot(input.historicalSnapshot) || !safeRunId(input.runId)) {
    throw new Error('CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_RESERVATION_FAILED');
  }
  const directory = resolveInsideRoot(
    root,
    REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory,
  );
  await mkdir(directory, { recursive: true });
  const oncePath = resolveInsideRoot(
    root,
    `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory}/${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.onceLockLeaf}`,
  );
  let handle;
  try {
    handle = await open(oncePath, 'wx');
    await handle.writeFile(
      `phase-6.9.5-review-planner-controlled-live-v10-semantic-quality-consumed\n${input.startedAt}\n`,
    );
  } catch {
    throw new Error('CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_ALREADY_CONSUMED');
  } finally {
    await handle?.close();
  }
  await writeEmptyStage(root, '.stage-010-reserved');
  const evidenceLeaf = `review-planner-live-${input.runId}.json`;
  let terminal = false;
  const reservation = Object.freeze({
    relativePath: `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory}/${evidenceLeaf}`,
    historicalSnapshot: input.historicalSnapshot,
    async markAttempted() {
      if (terminal) return false;
      try {
        await writeEmptyStage(root, '.stage-020-attempted');
        return true;
      } catch {
        return false;
      }
    },
    async abort() {
      if (terminal) return false;
      terminal = true;
      try {
        await writeEmptyStage(root, '.stage-130-terminal-record-written');
        return true;
      } catch {
        return false;
      }
    },
  });
  reservationRoots.set(reservation, root);
  return reservation;
}

export async function advanceReviewPlannerControlledLiveV10SemanticQualityStage(
  reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation,
  stage: ReviewPlannerControlledLiveV10SemanticQualityStage,
): Promise<boolean> {
  try {
    if (
      stage ===
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.diagnosticCommitLeaf
    ) {
      return false;
    }
    const root = reservationRoots.get(reservation);
    if (!root) return false;
    await writeEmptyStage(root, stage);
    return true;
  } catch {
    return false;
  }
}

export async function commitReviewPlannerControlledLiveV10SemanticQualityDiagnostic(
  input: Readonly<{
    root: string;
    reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
    diagnostic: V10SemanticQualityDiagnostic;
  }>,
): Promise<DiagnosticCommitment | null> {
  try {
    const root = trustedRoot(input.root);
    const diagnostic = v10SemanticQualityDiagnosticSchema.parse(
      input.diagnostic,
    );
    const snapshot = input.reservation.historicalSnapshot;
    const evidenceLeaf = input.reservation.relativePath.split('/').at(-1);
    if (!evidenceLeaf || !isSnapshot(snapshot)) return null;
    const diagnosticJson = JSON.stringify(diagnostic);
    const evidencePath = resolveInsideRoot(
      root,
      input.reservation.relativePath,
    );
    await writeFile(evidencePath, diagnosticJson, { flag: 'wx' });
    const commitment: DiagnosticCommitment = {
      schemaVersion: 'phase-6.9.5-review-planner-v10-safe-aggregate-commit-v1',
      evidenceLeaf,
      diagnosticSha256: sha256(diagnosticJson),
      historicalTreeHash: snapshot.treeHash,
    };
    await writeFile(
      resolveInsideRoot(
        root,
        `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory}/${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.diagnosticCommitLeaf}`,
      ),
      JSON.stringify(commitment),
      { flag: 'wx' },
    );
    return Object.freeze(commitment);
  } catch {
    return null;
  }
}

export async function completeReviewPlannerControlledLiveV10SemanticQualityValidation(
  input: Readonly<{
    root: string;
    reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
  }>,
) {
  try {
    await verifyReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
      {
        root: input.root,
        snapshot: input.reservation.historicalSnapshot,
      },
    );
    await writeEmptyStage(input.root, '.stage-090-validation-completed');
    return true;
  } catch {
    return false;
  }
}

export async function finalizeReviewPlannerControlledLiveV10SemanticQualitySuccess(
  input: Readonly<{
    root: string;
    reservation: ReviewPlannerControlledLiveV10SemanticQualityEvidenceReservation;
    diagnostic: V10SemanticQualityDiagnostic;
  }>,
) {
  try {
    if (input.diagnostic.terminalReason !== 'passed') return false;
    await verifyReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
      {
        root: input.root,
        snapshot: input.reservation.historicalSnapshot,
      },
    );
    const root = trustedRoot(input.root);
    const evidenceLeaf = input.reservation.relativePath.split('/').at(-1);
    if (!evidenceLeaf) return false;
    const diagnostic = v10SemanticQualityDiagnosticSchema.parse(
      input.diagnostic,
    );
    const seal = {
      schemaVersion: 'phase-6.9.5-review-planner-v10-success-commit-v1',
      evidenceLeaf,
      diagnosticSha256: sha256(JSON.stringify(diagnostic)),
      historicalTreeHash: input.reservation.historicalSnapshot.treeHash,
    };
    await writeFile(
      resolveInsideRoot(
        root,
        `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory}/${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.successCommitLeaf}`,
      ),
      JSON.stringify(seal),
      { flag: 'wx' },
    );
    return true;
  } catch {
    return false;
  }
}

export async function readReviewPlannerControlledLiveV10SemanticQualityEvidence(
  rootInput = process.cwd(),
): Promise<Record<string, unknown>> {
  const fallback = evidenceIoProjection();
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    const root = trustedRoot(rootInput);
    const relativeDirectory =
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      root,
      relativeDirectory.split('/'),
    );
    const names = [...directory.listLeafNames()].sort();
    const evidenceLeaves = names.filter((name) =>
      /^review-planner-live-[A-Za-z0-9._-]+\.json$/.test(name),
    );
    if (evidenceLeaves.length !== 1) return fallback;
    const evidenceLeaf = evidenceLeaves[0];
    if (!evidenceLeaf) return fallback;
    const allowed = new Set<string>([
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.onceLockLeaf,
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.successCommitLeaf,
      ...REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES.slice(
        0,
        10,
      ),
      evidenceLeaf,
    ]);
    if (
      names.length !== allowed.size ||
      names.some((name) => !allowed.has(name)) ||
      [...allowed].some((name) => !names.includes(name))
    ) {
      return fallback;
    }
    const once = directory.readRegularFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.onceLockLeaf,
    );
    if (!isV10ConsumedMarker(once)) return fallback;
    const commitment = diagnosticCommitmentSchema.safeParse(
      parseJson(
        directory.readRegularFile(
          REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.diagnosticCommitLeaf,
        ),
      ),
    );
    if (!commitment.success || commitment.data.evidenceLeaf !== evidenceLeaf) {
      return fallback;
    }
    for (const [
      index,
      stage,
    ] of REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES.slice(
      0,
      10,
    ).entries()) {
      const bytes = directory.readRegularFile(stage);
      if (index !== 8 && bytes.byteLength !== 0) return fallback;
    }
    const diagnosticBytes = directory.readRegularFile(evidenceLeaf);
    const diagnostic = v10SemanticQualityDiagnosticSchema.safeParse(
      parseJson(diagnosticBytes),
    );
    if (
      !diagnostic.success ||
      diagnostic.data.terminalReason !== 'passed' ||
      sha256(diagnosticBytes) !== commitment.data.diagnosticSha256
    ) {
      return fallback;
    }
    const seal = successSealSchema.safeParse(
      parseJson(
        directory.readRegularFile(
          REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.successCommitLeaf,
        ),
      ),
    );
    if (
      !seal.success ||
      seal.data.evidenceLeaf !== evidenceLeaf ||
      seal.data.diagnosticSha256 !== commitment.data.diagnosticSha256 ||
      seal.data.historicalTreeHash !== commitment.data.historicalTreeHash
    ) {
      return fallback;
    }
    const history =
      await snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
        root,
      );
    if (
      history.treeHash !== commitment.data.historicalTreeHash ||
      history.treeHash !== seal.data.historicalTreeHash
    ) {
      return fallback;
    }
    return Object.freeze({
      schemaVersion: diagnostic.data.schemaVersion,
      state: 'finalized',
      status: 'complete',
      gate: 'closed',
      terminalReason: 'passed',
      attempts: diagnostic.data.attempts,
      evidenceSha256: commitment.data.diagnosticSha256,
    });
  } catch {
    return fallback;
  } finally {
    directory?.close();
  }
}

function evidenceIoProjection(): Record<string, unknown> {
  return Object.freeze({
    status: 'invalid_attempted',
    gate: 'closed',
    diagnosticCode: 'evidence_io',
  });
}

function parseJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

function isV10ConsumedMarker(bytes: Buffer) {
  return new RegExp(
    `^${V10_CONSUMED_MARKER}\\n\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z\\n$`,
  ).test(bytes.toString('utf8'));
}

function writeEmptyStage(root: string, stage: string) {
  return writeFile(
    resolveInsideRoot(
      trustedRoot(root),
      `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory}/${stage}`,
    ),
    '',
    { flag: 'wx' },
  );
}

function isSnapshot(
  value: unknown,
): value is ReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidenceSnapshot {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { schemaVersion?: unknown }).schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v10' &&
    typeof (value as { treeHash?: unknown }).treeHash === 'string' &&
    Array.isArray((value as { entries?: unknown }).entries),
  );
}

function trustedRoot(root: string) {
  const absolute = resolve(root);
  if (!absolute || absolute.includes('\0')) throw new Error('invalid_root');
  return absolute;
}

function resolveInsideRoot(root: string, relative: string) {
  const absolute = resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error('path_escape');
  }
  return absolute;
}

function safeRunId(value: string) {
  return /^[A-Za-z0-9._-]{1,120}$/.test(value);
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
