import { createHash, randomBytes } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent/review-planner-diagnostics';
import { z } from 'zod';

import {
  openWindowsNoReparseDirectoryForTests,
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import { snapshotReviewPlannerControlledLiveV8HistoricalEvidence } from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  v9GateDiagnosticSchema,
  type V9GateDiagnostic,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE =
  Object.freeze({
    id: 'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics',
    evidenceSchemaVersion:
      'phase-6.9.5-review-planner-controlled-live-evidence-v9-gate-diagnostics',
    evidenceDirectory:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v9-gate-diagnostics',
    onceLockLeaf: '.review-planner-controlled-live-v9-gate-diagnostics.once',
    diagnosticCommitLeaf: '.stage-085-safe-aggregate-committed.json',
    successCommitLeaf:
      '.review-planner-controlled-live-v9-gate-diagnostics.success',
  } as const);

export const REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES = Object.freeze([
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

export type ReviewPlannerControlledLiveV9Stage =
  (typeof REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES)[number];

const V8_EVIDENCE_DIRECTORY =
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics';
const V8_ONCE_LEAF =
  '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.once';
const V8_PROVISIONAL_LEAF =
  'review-planner-live-20260718T164159952Z-a50a85e1-17cf-4e0e-ad69-a525e8319c77.json';
const V8_ONCE_SHA256 =
  'c014e04a7aa9a695971fe307a5b9909e0172c2e9cb0af7a1dcf0b39d5ff9733d';
const V8_PROVISIONAL_SHA256 =
  '82813d58d70a438fb3942358c1ab49f85a52c17e319ca4261c98f7f56c39e0a7';
const V8_ONCE_BYTES = 89;
const V8_PROVISIONAL_BYTES = 231;
const EXPECTED_HISTORY_TREE_HASH =
  '6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

type HistoricalEntry = Readonly<{
  relativePath: string;
  type: 'directory' | 'file';
  sha256: string;
  byteLength: number;
}>;

export type ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot = Readonly<{
  schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v5';
  treeHash: string;
  entries: readonly HistoricalEntry[];
}>;

type NamespaceSeam = Readonly<{
  kind: 'v8_history' | 'v9_reservation' | 'v9_reader';
  absoluteDirectory: string;
}>;
type NamespaceHook = (seam: NamespaceSeam) => Promise<void>;

export function createReviewPlannerControlledLiveV9NamespaceTestHarness(
  hook: NamespaceHook,
) {
  return Object.freeze({
    snapshot(root: string) {
      return snapshotReviewPlannerControlledLiveV9HistoricalEvidenceInternal(
        root,
        hook,
      );
    },
    read(
      input:
        | string
        | Readonly<{ root?: string; relativePath?: string }> = process.cwd(),
    ) {
      return readReviewPlannerControlledLiveV9EvidenceInternal(input, hook);
    },
    reserve(
      input: Parameters<typeof reserveReviewPlannerControlledLiveV9Evidence>[0],
    ) {
      return reserveReviewPlannerControlledLiveV9EvidenceInternal(
        input,
        null,
        hook,
      );
    },
  });
}

export async function snapshotReviewPlannerControlledLiveV9HistoricalEvidence(
  rootInput = process.cwd(),
): Promise<ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot> {
  return snapshotReviewPlannerControlledLiveV9HistoricalEvidenceInternal(
    rootInput,
    null,
  );
}

async function snapshotReviewPlannerControlledLiveV9HistoricalEvidenceInternal(
  rootInput: string,
  namespaceHook: NamespaceHook | null,
): Promise<ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot> {
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    const root = trustedRoot(rootInput);
    const previous =
      await snapshotReviewPlannerControlledLiveV8HistoricalEvidence(root);
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      root,
      V8_EVIDENCE_DIRECTORY.split('/'),
    );
    const absoluteDirectory = resolveInsideRoot(root, V8_EVIDENCE_DIRECTORY);
    await namespaceHook?.({
      kind: 'v8_history',
      absoluteDirectory,
    });
    const names = (await readdir(absoluteDirectory)).sort();
    const expectedNames = [
      V8_ONCE_LEAF,
      ...REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(0, 8),
      V8_PROVISIONAL_LEAF,
    ].sort();
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
      throw new Error('unexpected V8 evidence tree');
    }
    for (const name of expectedNames) {
      const stats = await lstat(
        resolveInsideRoot(root, `${V8_EVIDENCE_DIRECTORY}/${name}`),
      );
      if (!stats.isFile() || stats.nlink !== 1) {
        throw new Error('V8 hardlink or non-file pin');
      }
    }
    const once = directory.readRegularFile(V8_ONCE_LEAF);
    const provisional = directory.readRegularFile(V8_PROVISIONAL_LEAF);
    if (
      once.byteLength !== V8_ONCE_BYTES ||
      provisional.byteLength !== V8_PROVISIONAL_BYTES ||
      sha256(once) !== V8_ONCE_SHA256 ||
      sha256(provisional) !== V8_PROVISIONAL_SHA256
    ) {
      throw new Error('V8 pin mismatch');
    }
    for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(0, 8)) {
      if (directory.readRegularFile(stage).byteLength !== 0) {
        throw new Error('V8 stage not empty');
      }
    }
    const entries = [...previous.entries];
    const treeHash = previous.treeHash;
    if (entries.length !== 20 || treeHash !== EXPECTED_HISTORY_TREE_HASH) {
      throw new Error('V1-V8 tree mismatch');
    }
    return Object.freeze({
      schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v5',
      treeHash,
      entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
    });
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_HISTORICAL_INTEGRITY_FAILED',
    );
  } finally {
    directory?.close();
  }
}

export async function verifyReviewPlannerControlledLiveV9HistoricalEvidence(
  input: Readonly<{
    root?: string;
    snapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
  }>,
) {
  try {
    if (!isSnapshot(input.snapshot)) throw new Error('invalid snapshot');
    const current =
      await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(input.root);
    if (
      current.treeHash !== input.snapshot.treeHash ||
      JSON.stringify(current.entries) !== JSON.stringify(input.snapshot.entries)
    ) {
      throw new Error('history drift');
    }
    return current;
  } catch {
    throw new Error(
      'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_HISTORICAL_INTEGRITY_FAILED',
    );
  }
}

const V9_CONSUMED_MARKER =
  'phase-6.9.5-review-planner-controlled-live-v9-gate-diagnostics-consumed\n';
const diagnosticCommitmentSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-review-planner-v9-safe-aggregate-commit-v1',
    ),
    evidenceLeaf: z
      .string()
      .regex(/^review-planner-live-[A-Za-z0-9._-]+\.json$/),
    diagnosticSha256: z.string().regex(HASH_PATTERN),
    historicalTreeHash: z.literal(EXPECTED_HISTORY_TREE_HASH),
  })
  .strict();

export type ReviewPlannerControlledLiveV9DiagnosticCommitment = Readonly<
  z.infer<typeof diagnosticCommitmentSchema>
>;

const successCandidateSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-review-planner-v9-success-candidate-v1',
    ),
    state: z.literal('success_candidate'),
    status: z.literal('complete'),
    gate: z.literal('closed'),
    diagnostic: v9GateDiagnosticSchema,
    diagnosticSha256: z.string().regex(HASH_PATTERN),
    historicalTreeHash: z.literal(EXPECTED_HISTORY_TREE_HASH),
    stageManifestSha256: z.string().regex(HASH_PATTERN),
    successCommitmentSha256: z.string().regex(HASH_PATTERN),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.diagnostic.terminalReason !== 'passed') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnostic', 'terminalReason'],
        message: 'diagnostic_not_passed',
      });
    }
  });

const successSealSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-review-planner-v9-success-commit-v1'),
    evidenceLeaf: z
      .string()
      .regex(/^review-planner-live-[A-Za-z0-9._-]+\.json$/),
    candidateSha256: z.string().regex(HASH_PATTERN),
    diagnosticSha256: z.string().regex(HASH_PATTERN),
    historicalTreeHash: z.literal(EXPECTED_HISTORY_TREE_HASH),
    stageManifestSha256: z.string().regex(HASH_PATTERN),
    onceMarkerSha256: z.string().regex(HASH_PATTERN),
    commitNonce: z.string().regex(HASH_PATTERN),
  })
  .strict();

export type ReviewPlannerControlledLiveV9EvidenceReservation = Readonly<{
  relativePath: string;
  markAttempted(): Promise<boolean>;
  abort(): boolean;
}>;

type Capability = {
  directory: WindowsNoReparseChildDirectory;
  root: string;
  snapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
  leafName: string;
  stageIndex: number;
  state:
    | 'reserved'
    | 'attempted'
    | 'diagnostic_committed'
    | 'validated'
    | 'finalized';
  revision: number;
  closed: boolean;
  busy: boolean;
  diagnostic: V9GateDiagnostic | null;
  diagnosticSha256: string | null;
  nonce: string;
  nonceCommitment: string;
  onceMarkerSha256: string;
  cleanupInjectedHandles: (() => void) | null;
};

const reservationCapabilities = new WeakMap<
  ReviewPlannerControlledLiveV9EvidenceReservation,
  Capability
>();

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

export function createReviewPlannerControlledLiveV9EvidenceTestHarness(
  injector: (phase: DurableFaultPhase) => boolean,
) {
  return Object.freeze({
    reserve(
      input: Parameters<typeof reserveReviewPlannerControlledLiveV9Evidence>[0],
    ) {
      return reserveReviewPlannerControlledLiveV9EvidenceInternal(
        input,
        injector,
        null,
      );
    },
  });
}

export function reserveReviewPlannerControlledLiveV9Evidence(
  input: Readonly<{
    root?: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
  }>,
): Promise<ReviewPlannerControlledLiveV9EvidenceReservation> {
  return reserveReviewPlannerControlledLiveV9EvidenceInternal(
    input,
    null,
    null,
  );
}

async function reserveReviewPlannerControlledLiveV9EvidenceInternal(
  input: Readonly<{
    root?: string;
    startedAt: string;
    runId: string;
    historicalSnapshot: ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot;
  }>,
  injector: ((phase: DurableFaultPhase) => boolean) | null,
  namespaceHook: NamespaceHook | null,
): Promise<ReviewPlannerControlledLiveV9EvidenceReservation> {
  if (process.platform !== 'win32' || !process.versions.bun) {
    throw new Error(
      'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_EVIDENCE_TRUSTED_HANDLE_REQUIRED',
    );
  }
  const root = trustedRoot(input.root);
  const snapshot = await verifyReviewPlannerControlledLiveV9HistoricalEvidence({
    root,
    snapshot: input.historicalSnapshot,
  });
  const leafName = buildEvidenceLeaf(input.startedAt, input.runId);
  const segments =
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory.split(
      '/',
    );
  const absoluteDirectory = resolve(root, ...segments);
  try {
    await lstat(absoluteDirectory);
    throw new Error('already consumed');
  } catch (error) {
    if (
      error instanceof Error &&
      !('code' in error && error.code === 'ENOENT')
    ) {
      throw new Error(
        'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_EVIDENCE_ALREADY_CONSUMED',
      );
    }
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  let cleanupInjectedHandles: (() => void) | null = null;
  try {
    if (injector) {
      const facade = await openWindowsNoReparseDirectoryForTests(
        root,
        segments,
        injector,
        true,
      );
      directory = facade.directory;
      cleanupInjectedHandles = facade.cleanupInjectedHandles;
    } else {
      directory = await openWindowsNoReparseFrozenDirectory(root, segments);
    }
    directory.assertLocalFixedNtfsVolume();
    await namespaceHook?.({
      kind: 'v9_reservation',
      absoluteDirectory,
    });
    if ((await readdir(absoluteDirectory)).length !== 0) {
      throw new Error('already consumed');
    }
    const once = publishV9Artifact(
      directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
      V9_CONSUMED_MARKER,
    );
    cleanupInjectedHandles?.();
    if (!once.committed) throw new Error('once publication failed');
    directory.createExclusiveDurableFile(
      leafName,
      `${JSON.stringify(evidenceIoProjection(null))}\n`,
    );
    const reserved = publishV9Artifact(
      directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[0],
      '',
    );
    cleanupInjectedHandles?.();
    if (!reserved.committed) throw new Error('reserved publication failed');
  } catch (error) {
    try {
      cleanupInjectedHandles?.();
    } catch {
      // Converted to the fixed reservation failure.
    }
    directory?.close();
    if (error instanceof Error && /already|ALREADY/i.test(error.message)) {
      throw new Error(
        'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_EVIDENCE_ALREADY_CONSUMED',
      );
    }
    throw new Error(
      'CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_EVIDENCE_RESERVATION_FAILED',
    );
  }
  const nonce = randomBytes(32).toString('hex');
  const capability: Capability = {
    directory,
    root,
    snapshot,
    leafName,
    stageIndex: 0,
    state: 'reserved',
    revision: 0,
    closed: false,
    busy: false,
    diagnostic: null,
    diagnosticSha256: null,
    nonce,
    nonceCommitment: sha256(Buffer.from(nonce, 'utf8')),
    onceMarkerSha256: sha256(Buffer.from(V9_CONSUMED_MARKER, 'utf8')),
    cleanupInjectedHandles,
  };
  const reservation = Object.freeze({
    relativePath: `${REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory}/${leafName}`,
    async markAttempted() {
      if (
        capability.closed ||
        capability.busy ||
        capability.state !== 'reserved'
      ) {
        return false;
      }
      capability.busy = true;
      try {
        await verifyReviewPlannerControlledLiveV9HistoricalEvidence({
          root: capability.root,
          snapshot: capability.snapshot,
        });
        const replaced = replaceEvidence(
          capability,
          `${JSON.stringify(evidenceIoProjection(REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[0]))}\n`,
        );
        if (!replaced) return stopCapability(capability);
        capability.state = 'attempted';
        return createStage(capability, 1);
      } catch {
        return stopCapability(capability);
      } finally {
        capability.busy = false;
      }
    },
    abort() {
      const current = reservationCapabilities.get(
        this as ReviewPlannerControlledLiveV9EvidenceReservation,
      );
      if (!current || current.closed || current.busy) return false;
      current.state = 'finalized';
      cleanupFaultHandles(current);
      closeCapability(current);
      return true;
    },
  });
  reservationCapabilities.set(reservation, capability);
  return reservation;
}

export function advanceReviewPlannerControlledLiveV9Stage(
  reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
  exactStage: ReviewPlannerControlledLiveV9Stage,
): boolean {
  const capability = reservationCapabilities.get(reservation);
  if (
    !capability ||
    capability.closed ||
    capability.busy ||
    capability.state !== 'attempted'
  ) {
    return false;
  }
  const expectedIndex = capability.stageIndex + 1;
  if (
    expectedIndex < 2 ||
    expectedIndex > 7 ||
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[expectedIndex] !== exactStage
  ) {
    return false;
  }
  return createStage(capability, expectedIndex);
}

export async function commitReviewPlannerControlledLiveV9GateDiagnostic(
  input: Readonly<{
    reservation: ReviewPlannerControlledLiveV9EvidenceReservation;
    diagnostic: V9GateDiagnostic;
  }>,
): Promise<ReviewPlannerControlledLiveV9DiagnosticCommitment | null> {
  const capability = reservationCapabilities.get(input.reservation);
  const parsed = v9GateDiagnosticSchema.safeParse(input.diagnostic);
  if (
    !capability ||
    !parsed.success ||
    capability.closed ||
    capability.busy ||
    capability.state !== 'attempted' ||
    capability.stageIndex !== 7
  ) {
    return null;
  }
  capability.busy = true;
  try {
    await verifyReviewPlannerControlledLiveV9HistoricalEvidence({
      root: capability.root,
      snapshot: capability.snapshot,
    });
    const contents = `${JSON.stringify(parsed.data)}\n`;
    if (!replaceEvidence(capability, contents)) {
      stopCapability(capability);
      return null;
    }
    const checked = capability.directory.readRegularFile(capability.leafName);
    const checkedDiagnostic = v9GateDiagnosticSchema.parse(
      JSON.parse(checked.toString('utf8')),
    );
    if (`${JSON.stringify(checkedDiagnostic)}\n` !== checked.toString('utf8')) {
      stopCapability(capability);
      return null;
    }
    const commitment = diagnosticCommitmentSchema.parse({
      schemaVersion: 'phase-6.9.5-review-planner-v9-safe-aggregate-commit-v1',
      evidenceLeaf: capability.leafName,
      diagnosticSha256: sha256(checked),
      historicalTreeHash: capability.snapshot.treeHash,
    });
    const publication = publishV9Artifact(
      capability.directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
      `${JSON.stringify(commitment)}\n`,
    );
    cleanupFaultHandles(capability);
    if (!publication.committed) {
      cleanupPrepareLeaf(
        capability.directory,
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
      );
      stopCapability(capability);
      return null;
    }
    capability.stageIndex = 8;
    capability.state = 'diagnostic_committed';
    capability.diagnostic = Object.freeze(checkedDiagnostic);
    capability.diagnosticSha256 = commitment.diagnosticSha256;
    return Object.freeze(commitment);
  } catch {
    cleanupFaultHandles(capability);
    stopCapability(capability);
    return null;
  } finally {
    capability.busy = false;
  }
}

export function completeReviewPlannerControlledLiveV9Validation(
  reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
): boolean {
  const capability = reservationCapabilities.get(reservation);
  if (
    !capability ||
    capability.closed ||
    capability.busy ||
    capability.state !== 'diagnostic_committed' ||
    capability.stageIndex !== 8 ||
    !capability.diagnostic
  ) {
    return false;
  }
  const ok = createStage(capability, 9);
  if (!ok) return false;
  if (capability.diagnostic.terminalReason === 'passed') {
    capability.state = 'validated';
  } else {
    capability.state = 'finalized';
    closeCapability(capability);
  }
  return true;
}

export async function finalizeReviewPlannerControlledLiveV9Success(
  reservation: ReviewPlannerControlledLiveV9EvidenceReservation,
): Promise<boolean> {
  const capability = reservationCapabilities.get(reservation);
  if (
    !capability ||
    capability.closed ||
    capability.busy ||
    capability.state !== 'validated' ||
    capability.stageIndex !== 9 ||
    capability.diagnostic?.terminalReason !== 'passed' ||
    !capability.diagnosticSha256
  ) {
    return false;
  }
  capability.busy = true;
  try {
    if (!createStage(capability, 10) || !createStage(capability, 11)) {
      return false;
    }
    await verifyReviewPlannerControlledLiveV9HistoricalEvidence({
      root: capability.root,
      snapshot: capability.snapshot,
    });
    if (!createStage(capability, 12)) return false;
    const manifestHash = canonicalStageManifestSha256();
    const candidate = successCandidateSchema.parse({
      schemaVersion: 'phase-6.9.5-review-planner-v9-success-candidate-v1',
      state: 'success_candidate',
      status: 'complete',
      gate: 'closed',
      diagnostic: capability.diagnostic,
      diagnosticSha256: capability.diagnosticSha256,
      historicalTreeHash: capability.snapshot.treeHash,
      stageManifestSha256: manifestHash,
      successCommitmentSha256: capability.nonceCommitment,
    });
    if (!replaceEvidence(capability, `${JSON.stringify(candidate)}\n`)) {
      return stopCapability(capability);
    }
    if (!createStage(capability, 13)) return false;
    await verifyReviewPlannerControlledLiveV9HistoricalEvidence({
      root: capability.root,
      snapshot: capability.snapshot,
    });
    if (!createStage(capability, 14) || !createStage(capability, 15)) {
      return false;
    }
    const bytes = capability.directory.readRegularFile(capability.leafName);
    const checked = successCandidateSchema.parse(
      JSON.parse(bytes.toString('utf8')),
    );
    if (
      checked.diagnosticSha256 !== capability.diagnosticSha256 ||
      checked.successCommitmentSha256 !== capability.nonceCommitment ||
      checked.stageManifestSha256 !== manifestHash
    ) {
      return stopCapability(capability);
    }
    const seal = successSealSchema.parse({
      schemaVersion: 'phase-6.9.5-review-planner-v9-success-commit-v1',
      evidenceLeaf: capability.leafName,
      candidateSha256: sha256(bytes),
      diagnosticSha256: capability.diagnosticSha256,
      historicalTreeHash: capability.snapshot.treeHash,
      stageManifestSha256: manifestHash,
      onceMarkerSha256: capability.onceMarkerSha256,
      commitNonce: capability.nonce,
    });
    const publication = publishV9Artifact(
      capability.directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
      `${JSON.stringify(seal)}\n`,
    );
    cleanupFaultHandles(capability);
    if (!publication.committed) {
      cleanupPrepareLeaf(
        capability.directory,
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
      );
      return stopCapability(capability);
    }
    capability.state = 'finalized';
    closeCapability(capability);
    return true;
  } catch {
    cleanupFaultHandles(capability);
    return stopCapability(capability);
  } finally {
    capability.busy = false;
  }
}

export async function readReviewPlannerControlledLiveV9Evidence(
  input:
    | string
    | Readonly<{ root?: string; relativePath?: string }> = process.cwd(),
): Promise<Record<string, unknown>> {
  return readReviewPlannerControlledLiveV9EvidenceInternal(input, null);
}

async function readReviewPlannerControlledLiveV9EvidenceInternal(
  input: string | Readonly<{ root?: string; relativePath?: string }>,
  namespaceHook: NamespaceHook | null,
): Promise<Record<string, unknown>> {
  const fallback = evidenceIoProjection(null);
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    const root = trustedRoot(typeof input === 'string' ? input : input.root);
    const evidenceDirectory =
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory;
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      root,
      evidenceDirectory.split('/'),
    );
    const absoluteDirectory = resolveInsideRoot(root, evidenceDirectory);
    await namespaceHook?.({
      kind: 'v9_reader',
      absoluteDirectory,
    });
    const names = (await readdir(absoluteDirectory)).sort();
    const evidenceNames = names.filter((name) =>
      /^review-planner-live-[A-Za-z0-9._-]+\.json$/.test(name),
    );
    if (evidenceNames.length !== 1) return fallback;
    const allowed = new Set<string>([
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
      ...REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
      evidenceNames[0],
    ]);
    const lastStage = readStagePrefix(directory, names);
    if (lastStage === false) return fallback;
    if (names.some((name) => !allowed.has(name))) {
      return evidenceIoProjection(lastStage);
    }
    for (const name of names) {
      const stats = await lstat(
        resolveInsideRoot(root, `${evidenceDirectory}/${name}`),
      );
      if (!stats.isFile() || stats.nlink !== 1) {
        return evidenceIoProjection(lastStage);
      }
    }
    const requested =
      typeof input === 'string'
        ? undefined
        : input.relativePath?.split('/').at(-1);
    const leafName = requested ?? evidenceNames[0];
    if (leafName !== evidenceNames[0]) return evidenceIoProjection(lastStage);
    const once = directory.readRegularFile(
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
    );
    if (once.toString('utf8') !== V9_CONSUMED_MARKER) {
      return evidenceIoProjection(lastStage);
    }
    const history =
      await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root);
    const stageIndex = lastStage
      ? REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.indexOf(lastStage)
      : -1;
    if (stageIndex < 8) return evidenceIoProjection(lastStage);
    let commitment: z.infer<typeof diagnosticCommitmentSchema>;
    try {
      commitment = diagnosticCommitmentSchema.parse(
        JSON.parse(
          directory
            .readRegularFile(
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
            )
            .toString('utf8'),
        ),
      );
    } catch {
      return evidenceIoProjection(lastStage);
    }
    if (
      commitment.evidenceLeaf !== leafName ||
      commitment.historicalTreeHash !== history.treeHash
    ) {
      return evidenceIoProjection(lastStage);
    }
    const bytes = directory.readRegularFile(leafName);
    const diagnostic = parseDiagnosticBytes(bytes);
    if (diagnostic) {
      if (sha256(bytes) !== commitment.diagnosticSha256) {
        return evidenceIoProjection(lastStage);
      }
      if (stageIndex < 9) {
        return {
          ...evidenceIoProjection(lastStage),
          diagnostic,
        };
      }
      if (diagnostic.terminalReason !== 'passed' && stageIndex === 9) {
        return { ...diagnostic, state: 'finalized', lastStage };
      }
      return {
        ...evidenceIoProjection(lastStage),
        diagnostic,
      };
    }
    const candidate = successCandidateSchema.safeParse(
      JSON.parse(bytes.toString('utf8')) as unknown,
    );
    if (
      !candidate.success ||
      stageIndex !== 15 ||
      candidate.data.diagnosticSha256 !== commitment.diagnosticSha256 ||
      candidate.data.historicalTreeHash !== history.treeHash ||
      candidate.data.stageManifestSha256 !== canonicalStageManifestSha256()
    ) {
      return evidenceIoProjection(lastStage);
    }
    let seal: ReturnType<typeof successSealSchema.safeParse>;
    try {
      seal = successSealSchema.safeParse(
        JSON.parse(
          directory
            .readRegularFile(
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
            )
            .toString('utf8'),
        ),
      );
    } catch {
      return evidenceIoProjection(lastStage);
    }
    const candidateSha256 = sha256(bytes);
    if (
      !seal.success ||
      seal.data.evidenceLeaf !== leafName ||
      seal.data.candidateSha256 !== candidateSha256 ||
      seal.data.diagnosticSha256 !== commitment.diagnosticSha256 ||
      seal.data.historicalTreeHash !== history.treeHash ||
      seal.data.stageManifestSha256 !== canonicalStageManifestSha256() ||
      seal.data.onceMarkerSha256 !== sha256(once) ||
      candidate.data.successCommitmentSha256 !==
        sha256(Buffer.from(seal.data.commitNonce, 'utf8'))
    ) {
      return evidenceIoProjection(lastStage);
    }
    return {
      ...candidate.data.diagnostic,
      state: 'finalized',
      status: 'complete',
      lastStage,
      evidenceSha256: candidateSha256,
    };
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

function createStage(capability: Capability, index: number) {
  if (capability.closed || capability.stageIndex + 1 !== index) return false;
  try {
    const publication = publishV9Artifact(
      capability.directory,
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[index],
      '',
    );
    cleanupFaultHandles(capability);
    if (!publication.committed) {
      cleanupPrepareLeaf(
        capability.directory,
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[index],
      );
      return stopCapability(capability);
    }
    capability.stageIndex = index;
    return true;
  } catch {
    cleanupFaultHandles(capability);
    return stopCapability(capability);
  }
}

const V9_PUBLICATION_LEAVES = new Set<string>([
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
  ...REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
]);

function publishV9Artifact(
  directory: WindowsNoReparseChildDirectory,
  committedLeaf: string,
  contents: string,
) {
  if (!V9_PUBLICATION_LEAVES.has(committedLeaf)) {
    throw new Error('CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_LEAF_INVALID');
  }
  return directory.commitExclusiveDurableFileViaRename(committedLeaf, contents);
}

function readStagePrefix(
  directory: WindowsNoReparseChildDirectory,
  names: readonly string[],
): ReviewPlannerControlledLiveV9Stage | null | false {
  let last: ReviewPlannerControlledLiveV9Stage | null = null;
  let gap = false;
  for (const [
    index,
    stage,
  ] of REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.entries()) {
    const present = names.includes(stage);
    if (!present) {
      gap = true;
      continue;
    }
    if (gap) return false;
    const bytes = directory.readRegularFile(stage);
    if (index === 8) {
      if (
        !diagnosticCommitmentSchema.safeParse(
          JSON.parse(bytes.toString('utf8')),
        ).success
      ) {
        return false;
      }
    } else if (bytes.byteLength !== 0) {
      return false;
    }
    last = stage;
  }
  return last;
}

function parseDiagnosticBytes(bytes: Buffer): V9GateDiagnostic | null {
  try {
    const parsed = v9GateDiagnosticSchema.parse(
      JSON.parse(bytes.toString('utf8')),
    );
    return `${JSON.stringify(parsed)}\n` === bytes.toString('utf8')
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function evidenceIoProjection(
  lastStage: ReviewPlannerControlledLiveV9Stage | null,
) {
  return {
    schemaVersion:
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
    state: 'finalized',
    status: 'invalid_attempted',
    gate: 'closed',
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    lastStage,
  } as const;
}

function cleanupFaultHandles(capability: Capability) {
  try {
    capability.cleanupInjectedHandles?.();
  } catch {
    // The public transition remains fail-closed.
  }
}

function cleanupPrepareLeaf(
  directory: WindowsNoReparseChildDirectory,
  committedLeaf: string,
) {
  try {
    directory.deleteFile(`${committedLeaf}.prepare`);
  } catch {
    // Missing or unremovable prepare leaves remain fail-closed to the reader.
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

function canonicalStageManifestSha256() {
  return sha256(
    Buffer.from(
      REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.map(
        (stage) => `${stage}\n`,
      ).join(''),
      'utf8',
    ),
  );
}

function buildEvidenceLeaf(startedAt: string, runId: string) {
  const compact = startedAt.replace(/[-:.]/g, '');
  if (
    !/^\d{8}T\d{9}Z$/.test(compact) ||
    !/^[A-Za-z0-9._-]{1,80}$/.test(runId)
  ) {
    throw new Error('CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_IDENTITY_INVALID');
  }
  return `review-planner-live-${compact}-${runId}.json`;
}

function trustedRoot(rootInput = process.cwd()) {
  const root = resolve(rootInput);
  if (!/^[A-Za-z]:\\/.test(root)) {
    throw new Error('CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_ROOT_INVALID');
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

function isSnapshot(
  value: unknown,
): value is ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate =
    value as Partial<ReviewPlannerControlledLiveV9HistoricalEvidenceSnapshot>;
  return (
    candidate.schemaVersion ===
      'phase-6.9.5-review-planner-historical-integrity-v5' &&
    candidate.treeHash === EXPECTED_HISTORY_TREE_HASH &&
    Array.isArray(candidate.entries) &&
    candidate.entries.length === 20 &&
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
