import { createHash, randomUUID } from 'node:crypto';
import { lstat, link, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { PHASE_6_9_7_V7_WIRE_STAGES, type Phase697V7WireStage } from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
  claimPhase697SmallSampleConsumedProxyAttestation,
  type Phase697SmallSampleConsumedProxyAttestation,
  type Phase697SmallSampleProxyRecord,
  type Phase697SmallSampleSource,
} from './phase-6-9-tutor-organizer-small-sample-authority.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA,
  buildPhase697SmallSampleReport,
  parsePhase697SmallSampleReport,
  type Phase697SmallSampleCaseEntry,
  type Phase697SmallSampleReport,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES,
  PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
  canonicalPhase697SmallSampleJson,
  computePhase697SmallSampleCanonicalSha256,
} from './phase-6-9-tutor-organizer-small-sample-manifest.ts';
import type {
  Phase697SmallSampleLaneIdentity,
  Phase697SmallSampleLifecycle,
} from './run-phase-6-9-tutor-organizer-small-sample.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-durability-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_MARKER_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-marker-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_JOURNAL_RECORD_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-journal-record-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-recovery-claim-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-artifact-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live.marker' as const;

const FORMAL_JOURNAL_FILE =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-[0-9a-f-]{36}\.journal\.jsonl$/u;
const FORMAL_CLAIM_FILE =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-[0-9a-f-]{36}\.recovery\.claim$/u;
const FORMAL_ARTIFACT_FILE =
  /^phase-6-9-7-tutor-organizer-small-sample-l2-(branch|main)-controlled-live-[0-9a-f-]{36}\.json$/u;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const ISO_DATE = z.string().datetime({ offset: true });
const EVENT_TYPES = [
  'attempt_reserved',
  'guard_terminal',
  'lane_reserved',
  'wire_stage',
  'lane_terminal',
  'lane_not_started',
  'pair_terminal',
  'recovery_claimed',
  'run_terminal',
  'publication_started',
  'evidence_published',
] as const;

const proxyRecordSchema = z
  .object({
    version: z.literal('phase-6.9.7-tutor-organizer-small-sample-proxy-attestation-v1'),
    status: z.enum(['direct_ready', 'loopback_proxy_ready']),
    providerCalls: z.literal(0),
  })
  .strict();

export const PHASE_6_9_7_SMALL_SAMPLE_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    authority: z.enum(['controlled_live', 'synthetic_test']),
    mode: z.enum(['mock', 'live']),
    executorProvenance: z.enum(['deepseek_network', 'mock_synthetic', 'synthetic_test']),
    runId: UUID,
    runScope: z.enum(['branch', 'main']),
    createdAt: ISO_DATE,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: UUID,
    source: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
    proxy: proxyRecordSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const controlled =
      value.authority === 'controlled_live' &&
      value.mode === 'live' &&
      value.executorProvenance === 'deepseek_network';
    const synthetic =
      value.authority === 'synthetic_test' && value.executorProvenance !== 'deepseek_network';
    if (!controlled && !synthetic) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'marker_authority_mismatch' });
    }
  });

export type Phase697SmallSampleMarker = z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_MARKER_SCHEMA>;

export const PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    runId: UUID,
    claimedAt: ISO_DATE,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: UUID,
    markerSha256: SHA256,
    journalTailRecordHash: SHA256,
    state: z.literal('crash_only_seal_claimed'),
  })
  .strict();

const journalRecordSchema = z
  .object({
    recordVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_JOURNAL_RECORD_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    runId: UUID,
    sequence: z.number().int().safe().positive(),
    event: z.enum(EVENT_TYPES),
    occurredAt: ISO_DATE,
    previousHash: SHA256.nullable(),
    markerSha256: SHA256,
    caseId: z.string().min(1).max(96).nullable(),
    agent: z.enum(['tutor', 'wrong_question_organizer']).nullable(),
    pairedRunIndex: z.number().int().min(0).max(23).nullable(),
    wireStage: z.enum(PHASE_6_9_7_V7_WIRE_STAGES).nullable(),
    caseEntry: PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.nullable(),
    report: PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.nullable(),
    reportLogicalSha256: SHA256.nullable(),
    recoveryClaimSha256: SHA256.nullable(),
    evidenceSha256: SHA256.nullable(),
    completionMode: z.enum(['runtime', 'recovery']).nullable(),
    recordHash: SHA256,
  })
  .strict()
  .superRefine((value, context) => {
    const hasIdentity =
      value.caseId !== null && value.agent !== null && value.pairedRunIndex !== null;
    const noIdentity =
      value.caseId === null && value.agent === null && value.pairedRunIndex === null;
    const noPayload =
      value.wireStage === null &&
      value.caseEntry === null &&
      value.report === null &&
      value.reportLogicalSha256 === null &&
      value.recoveryClaimSha256 === null &&
      value.evidenceSha256 === null &&
      value.completionMode === null;
    let valid = false;
    switch (value.event) {
      case 'attempt_reserved':
        valid = noIdentity && noPayload;
        break;
      case 'guard_terminal':
        valid =
          value.caseId !== null &&
          value.agent !== null &&
          value.pairedRunIndex === null &&
          value.caseEntry?.executionKind === 'guard' &&
          value.wireStage === null &&
          value.report === null &&
          value.reportLogicalSha256 === null &&
          value.recoveryClaimSha256 === null &&
          value.evidenceSha256 === null &&
          value.completionMode === null;
        break;
      case 'lane_reserved':
        valid = hasIdentity && noPayload;
        break;
      case 'pair_terminal':
        valid =
          value.caseId === null &&
          value.agent === null &&
          value.pairedRunIndex !== null &&
          noPayload;
        break;
      case 'wire_stage':
        valid =
          hasIdentity &&
          value.wireStage !== null &&
          value.caseEntry === null &&
          value.report === null &&
          value.reportLogicalSha256 === null &&
          value.recoveryClaimSha256 === null &&
          value.evidenceSha256 === null &&
          value.completionMode === null;
        break;
      case 'lane_terminal':
      case 'lane_not_started':
        valid =
          hasIdentity &&
          value.caseEntry?.executionKind === 'runtime' &&
          value.wireStage === null &&
          value.report === null &&
          value.reportLogicalSha256 === null &&
          value.recoveryClaimSha256 === null &&
          value.evidenceSha256 === null &&
          value.completionMode === null;
        break;
      case 'recovery_claimed':
        valid =
          noIdentity &&
          value.recoveryClaimSha256 !== null &&
          value.wireStage === null &&
          value.caseEntry === null &&
          value.report === null &&
          value.reportLogicalSha256 === null &&
          value.evidenceSha256 === null &&
          value.completionMode === null;
        break;
      case 'run_terminal':
        valid =
          noIdentity &&
          value.report !== null &&
          value.reportLogicalSha256 !== null &&
          value.completionMode !== null &&
          value.wireStage === null &&
          value.caseEntry === null &&
          value.recoveryClaimSha256 === null &&
          value.evidenceSha256 === null;
        break;
      case 'publication_started':
        valid = noIdentity && noPayload;
        break;
      case 'evidence_published':
        valid =
          noIdentity &&
          value.evidenceSha256 !== null &&
          value.wireStage === null &&
          value.caseEntry === null &&
          value.report === null &&
          value.reportLogicalSha256 === null &&
          value.recoveryClaimSha256 === null &&
          value.completionMode === null;
        break;
    }
    if (!valid)
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'journal_event_mismatch' });
  });

export type Phase697SmallSampleJournalRecord = z.infer<typeof journalRecordSchema>;

export const PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    authority: z.enum(['controlled_live', 'synthetic_test']),
    qualityAuthority: z.enum(['none', 'small_sample_semantic_gate']),
    runId: UUID,
    runScope: z.enum(['branch', 'main']),
    generatedAt: ISO_DATE,
    source: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_SCHEMA,
    proxy: proxyRecordSchema,
    reportLogicalSha256: SHA256,
    report: PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA,
    durability: z
      .object({
        version: z.literal(PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_VERSION),
        completionMode: z.enum(['runtime', 'recovery']),
        publicationMode: z.enum(['runtime', 'recovery']),
        markerSha256: SHA256,
        terminalSequence: z.number().int().safe().positive(),
        terminalRecordHash: SHA256,
        journalRecordsBeforePublication: z.number().int().safe().positive(),
        recoveryClaimSha256: SHA256.nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const reportSha = computePhase697SmallSampleCanonicalSha256(value.report);
    const quality =
      value.authority === 'controlled_live' &&
      value.report.gate === 'small_sample_quality_gate_passed'
        ? 'small_sample_semantic_gate'
        : 'none';
    if (
      value.reportLogicalSha256 !== reportSha ||
      value.report.runId !== value.runId ||
      value.report.runScope !== value.runScope ||
      value.report.approvedRunnableSourceCommit !== value.source.approvedRunnableSourceCommit ||
      value.qualityAuthority !== quality ||
      (value.durability.completionMode === 'runtime' &&
        value.durability.publicationMode === 'runtime' &&
        value.durability.recoveryClaimSha256 !== null) ||
      (value.durability.completionMode === 'runtime' &&
        value.durability.publicationMode === 'recovery' &&
        value.durability.recoveryClaimSha256 === null) ||
      (value.durability.completionMode === 'recovery' &&
        (value.durability.publicationMode !== 'recovery' ||
          value.durability.recoveryClaimSha256 === null))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'artifact_authority_mismatch' });
    }
  });

export type Phase697SmallSampleArtifact = z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA>;

type LaneState = {
  identity: Phase697SmallSampleLaneIdentity;
  reserved: boolean;
  wireStages: Phase697V7WireStage[];
  terminal: Phase697SmallSampleCaseEntry | null;
  notStarted: boolean;
};

type ReservationState = {
  root: string;
  marker: Phase697SmallSampleMarker;
  markerBytes: string;
  markerSha256: string;
  journalPath: string;
  sequence: number;
  previousHash: string | null;
  records: Phase697SmallSampleJournalRecord[];
  guards: Map<string, Phase697SmallSampleCaseEntry>;
  lanes: Map<string, LaneState>;
  pairs: Set<number>;
  terminal: Phase697SmallSampleJournalRecord | null;
  report: Phase697SmallSampleReport | null;
  completionMode: 'runtime' | 'recovery';
  publicationMode: 'runtime' | 'recovery';
  recoveryClaimSha256: string | null;
  publicationStarted: boolean;
  published: boolean;
  fence: (() => Promise<void>) | null;
  tail: Promise<void>;
};

export type Phase697SmallSampleReservation = Readonly<{
  runId: string;
  markerRelativePath: typeof PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH;
  journalRelativePath: string;
  lifecycle: Phase697SmallSampleLifecycle;
  publishArtifact(report: Phase697SmallSampleReport): Promise<
    Readonly<{
      relativePath: string;
      evidenceSha256: string;
    }>
  >;
}>;

export type Phase697SmallSampleCrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      gate: Phase697SmallSampleReport['gate'];
      evidenceSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'attempt_missing_or_invalid'
        | 'live_attempt_in_progress'
        | 'attempt_already_complete'
        | 'publication_permanently_failed'
        | 'recovery_claim_io'
        | 'journal_drift'
        | 'recovery_evidence_io';
    }>;

type RecoveryDependencies = Readonly<{
  processAlive(processId: number): boolean;
  ownerProcessId: number;
  randomUUID(): string;
  now(): number;
}>;

const RESERVATIONS = new WeakMap<object, ReservationState>();
const DURABILITY_ERROR = 'PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_REJECTED';

export async function reservePhase697SmallSampleAttempt(input: {
  root: string;
  runId: string;
  runScope: 'branch' | 'main';
  authority: 'controlled_live' | 'synthetic_test';
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  createdAt: string;
  source: Phase697SmallSampleSource;
  proxyAttestation: Phase697SmallSampleConsumedProxyAttestation;
}): Promise<Phase697SmallSampleReservation> {
  let proxy: Phase697SmallSampleProxyRecord;
  try {
    proxy = claimPhase697SmallSampleConsumedProxyAttestation(
      input.proxyAttestation,
      input.authority,
    );
  } catch {
    throw new Error(DURABILITY_ERROR);
  }
  try {
    const root = await requireRoot(input.root);
    await ensureTmpDirectory(root);
    const marker = deepFreeze(
      PHASE_6_9_7_SMALL_SAMPLE_MARKER_SCHEMA.parse({
        markerVersion: PHASE_6_9_7_SMALL_SAMPLE_MARKER_VERSION,
        durabilityVersion: PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_VERSION,
        lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
        authority: input.authority,
        mode: input.mode,
        executorProvenance: input.executorProvenance,
        runId: input.runId,
        runScope: input.runScope,
        createdAt: input.createdAt,
        ownerProcessId: process.pid,
        ownerToken: randomUUID(),
        source: input.source,
        proxy,
      }),
    );
    const markerBytes = `${JSON.stringify(marker)}\n`;
    const markerPath = resolveRelative(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH);
    const journalPath = resolveRelative(root, journalRelativePath(marker.runId));
    await writeExclusiveRegularFile(markerPath, markerBytes);
    const state: ReservationState = {
      root,
      marker,
      markerBytes,
      markerSha256: sha256(markerBytes),
      journalPath,
      sequence: 0,
      previousHash: null,
      records: [],
      guards: new Map(),
      lanes: createLaneStates(),
      pairs: new Set(),
      terminal: null,
      report: null,
      completionMode: 'runtime',
      publicationMode: 'runtime',
      recoveryClaimSha256: null,
      publicationStarted: false,
      published: false,
      fence: null,
      tail: Promise.resolve(),
    };
    await createJournal(state);
    return createReservation(state);
  } catch {
    throw new Error(DURABILITY_ERROR);
  }
}

/**
 * Production crash-only seal. It reads only the marker/journal/claim prefix and
 * never reads authorization env, credential, proxy state, or constructs a
 * Provider transport.
 */
export function sealPhase697SmallSampleInterruptedAttempt(input: {
  root: string;
}): Promise<Phase697SmallSampleCrashSealResult> {
  return sealInterruptedAttempt(
    input,
    {
      processAlive: isProcessAlive,
      ownerProcessId: process.pid,
      randomUUID,
      now: Date.now,
    },
    'controlled_live',
  );
}

/** Synthetic-only seam for temporary-directory fault tests. */
export function sealPhase697SmallSampleInterruptedAttemptForTest(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
}): Promise<Phase697SmallSampleCrashSealResult> {
  return sealInterruptedAttempt(
    input,
    {
      processAlive: input.processAlive ?? (() => false),
      ownerProcessId: process.pid,
      randomUUID,
      now: Date.now,
    },
    'synthetic_test',
  );
}

async function sealInterruptedAttempt(
  input: { root: string },
  dependencies: RecoveryDependencies,
  requiredAuthority: 'controlled_live' | 'synthetic_test',
): Promise<Phase697SmallSampleCrashSealResult> {
  let root: string;
  let markerBytes: string;
  let marker: Phase697SmallSampleMarker;
  let markerSha256: string;
  let records: readonly Phase697SmallSampleJournalRecord[];
  try {
    root = await requireRoot(input.root);
    markerBytes = await readRegularFile(
      resolveRelative(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH),
    );
    marker = PHASE_6_9_7_SMALL_SAMPLE_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (
      markerBytes !== `${JSON.stringify(marker)}\n` ||
      marker.authority !== requiredAuthority ||
      (requiredAuthority === 'controlled_live' &&
        (marker.mode !== 'live' || marker.executorProvenance !== 'deepseek_network'))
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    markerSha256 = sha256(markerBytes);
    const journalBytes = await readRegularFile(
      resolveRelative(root, journalRelativePath(marker.runId)),
    );
    records = parseJournal(journalBytes, marker, markerSha256, false);
  } catch {
    return Object.freeze({ ok: false, code: 'attempt_missing_or_invalid' });
  }

  if (dependencies.processAlive(marker.ownerProcessId)) {
    return Object.freeze({ ok: false, code: 'live_attempt_in_progress' });
  }
  if (records.at(-1)?.event === 'evidence_published') {
    return Object.freeze({ ok: false, code: 'attempt_already_complete' });
  }
  if (records.some((record) => record.event === 'publication_started')) {
    return Object.freeze({ ok: false, code: 'publication_permanently_failed' });
  }
  const initialTail = records.at(-1);
  if (!initialTail) return Object.freeze({ ok: false, code: 'attempt_missing_or_invalid' });

  const acquired = await acquireRecoveryClaim(
    {
      root,
      runId: marker.runId,
      markerSha256,
      journalTailRecordHash: initialTail.recordHash,
    },
    dependencies,
  );
  if (!acquired.ok) return acquired.result;

  try {
    const [rereadMarkerBytes, rereadJournalBytes] = await Promise.all([
      readRegularFile(resolveRelative(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH)),
      readRegularFile(resolveRelative(root, journalRelativePath(marker.runId))),
    ]);
    const rereadRecords = parseJournal(rereadJournalBytes, marker, markerSha256, false);
    if (
      rereadMarkerBytes !== markerBytes ||
      rereadRecords.at(-1)?.recordHash !== initialTail.recordHash ||
      !(await acquired.assertOwned())
    ) {
      await acquired.release();
      return Object.freeze({ ok: false, code: 'journal_drift' });
    }

    const replay = replayRecords(marker, rereadRecords);
    const state = recoveryState({
      root,
      marker,
      markerBytes,
      markerSha256,
      records: rereadRecords,
      replay,
      recoveryClaimSha256: acquired.claimSha256,
    });
    state.fence = () =>
      assertRecoveryFence({
        root,
        marker,
        markerBytes,
        markerSha256,
        claimBytes: acquired.claimBytes,
        expectedSequence: state.sequence,
        expectedTailHash: state.previousHash,
      });

    await enqueue(state, async () => {
      const record = await appendRecord(state, {
        event: 'recovery_claimed',
        recoveryClaimSha256: acquired.claimSha256,
      });
      if (record.previousHash !== acquired.claim.journalTailRecordHash) {
        throw new Error(DURABILITY_ERROR);
      }
      state.recoveryClaimSha256 = acquired.claimSha256;
      state.publicationMode = 'recovery';
    });

    const disposition = state.terminal
      ? ('terminal_publication_recovered' as const)
      : ('crash_only_sealed' as const);
    if (!state.terminal) {
      await completeRecoveredEntries(state);
      await enqueue(state, async () => {
        await appendRunTerminalWithMode(state, recomputeReport(state), 'recovery');
      });
    }
    const report = state.report;
    if (!report) throw new Error(DURABILITY_ERROR);
    const published = await enqueueResult(state, async () => publishArtifact(state, report));
    const validation = await validatePhase697SmallSampleBundle({ root });
    if (!validation.ok || validation.runId !== marker.runId) throw new Error(DURABILITY_ERROR);
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      disposition,
      gate: report.gate,
      evidenceSha256: published.evidenceSha256,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'recovery_evidence_io' });
  }
}

function recoveryState(input: {
  root: string;
  marker: Phase697SmallSampleMarker;
  markerBytes: string;
  markerSha256: string;
  records: readonly Phase697SmallSampleJournalRecord[];
  replay: ReturnType<typeof replayRecords>;
  recoveryClaimSha256: string;
}): ReservationState {
  const guards = new Map<string, Phase697SmallSampleCaseEntry>();
  for (const expected of PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES) {
    if (expected.kind !== 'guard') continue;
    const entry = input.replay.entries.get(expected.caseId);
    if (entry) guards.set(expected.caseId, entry);
  }
  const lanes = new Map(
    [...input.replay.lanes.entries()].map(([caseId, lane]) => [
      caseId,
      {
        identity: { ...lane.identity },
        reserved: lane.reserved,
        wireStages: [...lane.wireStages],
        terminal: lane.terminal,
        notStarted: lane.notStarted,
      } satisfies LaneState,
    ]),
  );
  const tail = input.records.at(-1);
  if (!tail) throw new Error(DURABILITY_ERROR);
  return {
    root: input.root,
    marker: input.marker,
    markerBytes: input.markerBytes,
    markerSha256: input.markerSha256,
    journalPath: resolveRelative(input.root, journalRelativePath(input.marker.runId)),
    sequence: tail.sequence,
    previousHash: tail.recordHash,
    records: [...input.records],
    guards,
    lanes,
    pairs: new Set(input.replay.pairs),
    terminal: input.replay.terminalRecord,
    report: input.replay.terminalReport,
    completionMode: input.replay.completionMode ?? 'recovery',
    publicationMode: 'recovery',
    recoveryClaimSha256: input.recoveryClaimSha256,
    publicationStarted: false,
    published: false,
    fence: null,
    tail: Promise.resolve(),
  };
}

async function completeRecoveredEntries(state: ReservationState) {
  while (state.guards.size < 8) {
    const expected = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES[state.guards.size];
    if (!expected || expected.kind !== 'guard') throw new Error(DURABILITY_ERROR);
    await enqueue(state, async () => appendGuardTerminal(state, recoveredGuardFailure(expected)));
  }

  const pairIndexes = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
    (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
  ).map((entry) => entry.pairedRunIndex!);
  let breakerOpen =
    [...state.guards.values()].some((entry) => !entry.zeroCallVerified) ||
    [...state.lanes.values()].some(
      (lane) => lane.terminal !== null && lane.terminal.disposition !== 'succeeded',
    );
  for (const pairedRunIndex of pairIndexes) {
    const pair = pairLanes(state, pairedRunIndex);
    if (state.pairs.has(pairedRunIndex)) {
      breakerOpen ||= pair.some(
        (lane) => lane.terminal !== null && lane.terminal.disposition !== 'succeeded',
      );
      continue;
    }
    const pairHasDurableActivity = pair.some(
      (lane) => lane.reserved || (lane.terminal !== null && !lane.notStarted),
    );
    const pairNeedsRecoveryAnchor = !breakerOpen && !pairHasDurableActivity;
    for (const agent of ['tutor', 'wrong_question_organizer'] as const) {
      const lane = pair.find((candidate) => candidate.identity.agent === agent);
      if (!lane) throw new Error(DURABILITY_ERROR);
      if (lane.terminal) continue;
      if (lane.reserved || pairHasDurableActivity || pairNeedsRecoveryAnchor) {
        if (!lane.reserved) {
          // A crash may happen after the first lane reservation is durable but
          // before its sibling reservation is appended. Recovery never calls
          // the harness; it closes only that already-open pair by durably
          // reserving the missing sibling and immediately aborting it at zero
          // wire. Completely untouched later pairs remain not-started.
          await enqueue(state, async () => reserveLane(state, lane.identity));
        }
        await enqueue(state, async () =>
          appendLaneTerminal(state, lane.identity, recoveredReservedLane(lane)),
        );
      } else {
        await enqueue(state, async () =>
          appendLaneNotStarted(state, recoveredNotStartedLane(lane)),
        );
      }
    }
    await enqueue(state, async () => appendPairTerminal(state, pairedRunIndex));
    breakerOpen ||= pair.some(
      (lane) => lane.terminal !== null && lane.terminal.disposition !== 'succeeded',
    );
  }
}

function recoveredGuardFailure(
  expected: (typeof PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES)[number],
) {
  return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION,
    caseId: expected.caseId,
    agent: expected.agent,
    executionKind: 'guard',
    pairedRunIndex: null,
    disposition: 'attempted_failed',
    failureCategory: 'guard',
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    wire: emptyWire(),
    durationMs: null,
    usage: null,
    semantic: null,
    safety: { ...clearSafety(), criticalFailure: true },
  });
}

function recoveredReservedLane(lane: LaneState) {
  return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION,
    ...lane.identity,
    executionKind: 'runtime',
    disposition: 'attempted_aborted',
    failureCategory: 'abort',
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    wire: wireFromStages(lane.wireStages),
    durationMs: null,
    usage: null,
    semantic: null,
    safety: clearSafety(),
  });
}

function recoveredNotStartedLane(lane: LaneState) {
  return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
    entryVersion: PHASE_6_9_7_SMALL_SAMPLE_ENTRY_VERSION,
    ...lane.identity,
    executionKind: 'runtime',
    disposition: 'not_started_quality_breaker',
    failureCategory: 'quality_breaker',
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    wire: emptyWire(),
    durationMs: null,
    usage: null,
    semantic: null,
    safety: clearSafety(),
  });
}

function emptyWire() {
  return {
    executorEntered: 0 as const,
    providerDispatchStarted: 0 as const,
    providerResponseReceived: 0 as const,
    verifiedUsageObserved: 0 as const,
  };
}

function wireFromStages(stages: readonly Phase697V7WireStage[]) {
  return {
    executorEntered: stages.includes('executor_entered') ? (1 as const) : (0 as const),
    providerDispatchStarted: stages.includes('provider_dispatch_started')
      ? (1 as const)
      : (0 as const),
    providerResponseReceived: stages.includes('provider_response_received')
      ? (1 as const)
      : (0 as const),
    verifiedUsageObserved: stages.includes('usage_validated') ? (1 as const) : (0 as const),
  };
}

function clearSafety() {
  return {
    criticalFailure: false,
    permissionFailure: false,
    mutationFailure: false,
    broaderThanDeterministicFallback: false,
    lockedNameChanged: false,
    writeCommandLeaked: false,
  };
}

async function acquireRecoveryClaim(
  input: {
    root: string;
    runId: string;
    markerSha256: string;
    journalTailRecordHash: string;
  },
  dependencies: RecoveryDependencies,
): Promise<
  | Readonly<{
      ok: true;
      claim: z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA>;
      claimBytes: string;
      claimSha256: string;
      assertOwned(): Promise<boolean>;
      release(): Promise<void>;
    }>
  | Readonly<{ ok: false; result: Phase697SmallSampleCrashSealResult }>
> {
  let claim: z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA>;
  let claimBytes: string;
  try {
    claim = PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA.parse({
      claimVersion: PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_VERSION,
      lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
      runId: input.runId,
      claimedAt: new Date(dependencies.now()).toISOString(),
      ownerProcessId: dependencies.ownerProcessId,
      ownerToken: dependencies.randomUUID(),
      markerSha256: input.markerSha256,
      journalTailRecordHash: input.journalTailRecordHash,
      state: 'crash_only_seal_claimed',
    });
    claimBytes = `${JSON.stringify(claim)}\n`;
  } catch {
    return Object.freeze({
      ok: false,
      result: Object.freeze({ ok: false, code: 'recovery_claim_io' }),
    });
  }

  const claimPath = resolveRelative(input.root, recoveryClaimRelativePath(input.runId));
  try {
    await writeExclusiveRegularFile(claimPath, claimBytes);
  } catch (error) {
    if (!isErrorCode(error, 'EEXIST')) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'recovery_claim_io' }),
      });
    }
    let existing: z.infer<typeof PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA>;
    try {
      const existingBytes = await readRegularFile(claimPath);
      existing = PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA.parse(JSON.parse(existingBytes));
      if (existingBytes !== `${JSON.stringify(existing)}\n`) throw new Error(DURABILITY_ERROR);
    } catch {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'recovery_claim_io' }),
      });
    }
    if (dependencies.processAlive(existing.ownerProcessId)) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'live_attempt_in_progress' }),
      });
    }
    const stalePath = `${claimPath}.stale-${dependencies.ownerProcessId}-${dependencies.randomUUID()}`;
    try {
      assertContained(input.root, resolve(stalePath));
      await rename(claimPath, stalePath);
    } catch (renameError) {
      if (!isErrorCode(renameError, 'ENOENT')) {
        return Object.freeze({
          ok: false,
          result: Object.freeze({ ok: false, code: 'recovery_claim_io' }),
        });
      }
    }
    try {
      await writeExclusiveRegularFile(claimPath, claimBytes);
    } catch {
      await unlink(stalePath).catch(() => undefined);
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'live_attempt_in_progress' }),
      });
    }
    await unlink(stalePath).catch(() => undefined);
  }

  const assertOwned = async () => {
    try {
      return (await readRegularFile(claimPath)) === claimBytes;
    } catch {
      return false;
    }
  };
  const release = async () => {
    if (await assertOwned()) await unlink(claimPath).catch(() => undefined);
  };
  return Object.freeze({
    ok: true,
    claim,
    claimBytes,
    claimSha256: sha256(claimBytes),
    assertOwned,
    release,
  });
}

async function assertRecoveryFence(input: {
  root: string;
  marker: Phase697SmallSampleMarker;
  markerBytes: string;
  markerSha256: string;
  claimBytes: string;
  expectedSequence: number;
  expectedTailHash: string | null;
}) {
  const [markerBytes, claimBytes, journalBytes] = await Promise.all([
    readRegularFile(resolveRelative(input.root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH)),
    readRegularFile(resolveRelative(input.root, recoveryClaimRelativePath(input.marker.runId))),
    readRegularFile(resolveRelative(input.root, journalRelativePath(input.marker.runId))),
  ]);
  const records = parseJournal(journalBytes, input.marker, input.markerSha256, false);
  if (
    markerBytes !== input.markerBytes ||
    claimBytes !== input.claimBytes ||
    records.at(-1)?.sequence !== input.expectedSequence ||
    records.at(-1)?.recordHash !== input.expectedTailHash
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

function createReservation(state: ReservationState): Phase697SmallSampleReservation {
  const lifecycle: Phase697SmallSampleLifecycle = Object.freeze({
    appendGuardTerminal: (entry) => enqueue(state, async () => appendGuardTerminal(state, entry)),
    reserveLane: async (identity) => {
      await enqueue(state, async () => reserveLane(state, identity));
      return Object.freeze({
        appendWireStage: (stage: Phase697V7WireStage) =>
          enqueue(state, async () => appendWireStage(state, identity, stage)),
      });
    },
    appendLaneTerminal: (identity, entry) =>
      enqueue(state, async () => appendLaneTerminal(state, identity, entry)),
    appendLaneNotStarted: (entry) => enqueue(state, async () => appendLaneNotStarted(state, entry)),
    appendPairTerminal: (pairedRunIndex) =>
      enqueue(state, async () => appendPairTerminal(state, pairedRunIndex)),
    appendRunTerminal: (report) => enqueue(state, async () => appendRunTerminal(state, report)),
  });
  const reservation = Object.freeze({
    runId: state.marker.runId,
    markerRelativePath: PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH,
    journalRelativePath: journalRelativePath(state.marker.runId),
    lifecycle,
    publishArtifact: (report: Phase697SmallSampleReport) =>
      enqueueResult(state, async () => publishArtifact(state, report)),
  });
  RESERVATIONS.set(reservation, state);
  return reservation;
}

async function createJournal(state: ReservationState) {
  const handle = await openExclusiveHandle(state.journalPath);
  try {
    const record = nextRecord(state, { event: 'attempt_reserved' });
    await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
    await handle.sync();
    await assertHandleIdentity(state.root, state.journalPath, handle);
    commitRecord(state, record);
  } finally {
    await handle.close();
  }
}

async function appendGuardTerminal(state: ReservationState, entry: Phase697SmallSampleCaseEntry) {
  const parsed = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse(entry);
  const expected = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES[state.guards.size];
  if (
    state.terminal ||
    expected?.kind !== 'guard' ||
    parsed.executionKind !== 'guard' ||
    parsed.caseId !== expected.caseId ||
    parsed.agent !== expected.agent ||
    state.guards.has(parsed.caseId)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, {
    event: 'guard_terminal',
    caseId: parsed.caseId,
    agent: parsed.agent,
    pairedRunIndex: null,
    caseEntry: parsed,
  });
  state.guards.set(parsed.caseId, parsed);
}

async function reserveLane(state: ReservationState, identity: Phase697SmallSampleLaneIdentity) {
  const lane = requireLane(state, identity);
  const firstIncompletePair = nextIncompletePair(state);
  if (
    state.terminal ||
    state.guards.size !== 8 ||
    state.pairs.has(identity.pairedRunIndex) ||
    firstIncompletePair !== identity.pairedRunIndex ||
    identity.agent !== expectedReservationAgent(state, identity.pairedRunIndex) ||
    lane.reserved ||
    lane.terminal
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, { event: 'lane_reserved', ...identity });
  lane.reserved = true;
}

async function appendWireStage(
  state: ReservationState,
  identity: Phase697SmallSampleLaneIdentity,
  stage: Phase697V7WireStage,
) {
  const lane = requireLane(state, identity);
  const expected = PHASE_6_9_7_V7_WIRE_STAGES[lane.wireStages.length];
  if (!lane.reserved || lane.terminal || stage !== expected) throw new Error(DURABILITY_ERROR);
  await appendRecord(state, { event: 'wire_stage', ...identity, wireStage: stage });
  lane.wireStages.push(stage);
}

async function appendLaneTerminal(
  state: ReservationState,
  identity: Phase697SmallSampleLaneIdentity,
  entry: Phase697SmallSampleCaseEntry,
) {
  const lane = requireLane(state, identity);
  const parsed = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse(entry);
  if (
    !lane.reserved ||
    lane.terminal ||
    parsed.caseId !== identity.caseId ||
    parsed.agent !== identity.agent ||
    parsed.pairedRunIndex !== identity.pairedRunIndex ||
    parsed.disposition.startsWith('not_started_') ||
    !wireMatchesStages(parsed, lane.wireStages)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, { event: 'lane_terminal', ...identity, caseEntry: parsed });
  lane.terminal = parsed;
}

async function appendLaneNotStarted(state: ReservationState, entry: Phase697SmallSampleCaseEntry) {
  const parsed = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse(entry);
  if (parsed.executionKind !== 'runtime' || parsed.pairedRunIndex === null) {
    throw new Error(DURABILITY_ERROR);
  }
  const identity = {
    caseId: parsed.caseId,
    agent: parsed.agent,
    pairedRunIndex: parsed.pairedRunIndex,
  } as const;
  const lane = requireLane(state, identity);
  if (
    lane.reserved ||
    lane.terminal ||
    parsed.pairedRunIndex !== nextIncompletePair(state) ||
    parsed.agent !== expectedReservationAgent(state, parsed.pairedRunIndex) ||
    !parsed.disposition.startsWith('not_started_')
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, { event: 'lane_not_started', ...identity, caseEntry: parsed });
  lane.terminal = parsed;
  lane.notStarted = true;
}

async function appendPairTerminal(state: ReservationState, pairedRunIndex: number) {
  const pair = pairLanes(state, pairedRunIndex);
  if (
    state.pairs.has(pairedRunIndex) ||
    pair.length !== 2 ||
    pair.some((lane) => lane.terminal === null) ||
    nextIncompletePair(state) !== pairedRunIndex
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, { event: 'pair_terminal', pairedRunIndex });
  state.pairs.add(pairedRunIndex);
}

async function appendRunTerminal(state: ReservationState, report: Phase697SmallSampleReport) {
  return appendRunTerminalWithMode(state, report, 'runtime');
}

async function appendRunTerminalWithMode(
  state: ReservationState,
  report: Phase697SmallSampleReport,
  completionMode: 'runtime' | 'recovery',
) {
  if (state.terminal || state.guards.size !== 8 || state.pairs.size !== 8) {
    throw new Error(DURABILITY_ERROR);
  }
  const parsed = parsePhase697SmallSampleReport(report);
  if (!parsed || canonical(parsed) !== canonical(recomputeReport(state))) {
    throw new Error(DURABILITY_ERROR);
  }
  const reportLogicalSha256 = computePhase697SmallSampleCanonicalSha256(parsed);
  const record = await appendRecord(state, {
    event: 'run_terminal',
    report: parsed,
    reportLogicalSha256,
    completionMode,
  });
  state.terminal = record;
  state.report = parsed;
  state.completionMode = completionMode;
}

async function publishArtifact(state: ReservationState, report: Phase697SmallSampleReport) {
  if (
    state.publicationStarted ||
    state.published ||
    !state.terminal ||
    !state.report ||
    canonical(report) !== canonical(state.report)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, { event: 'publication_started' });
  state.publicationStarted = true;
  const artifact = buildArtifact(state);
  const bytes = `${JSON.stringify(artifact)}\n`;
  const relativePath = artifactRelativePath(state.marker.runScope, state.marker.runId);
  const finalPath = resolveRelative(state.root, relativePath);
  const tempPath = `${finalPath}.tmp.${randomUUID()}`;
  try {
    await writeExclusiveRegularFile(tempPath, bytes);
    await link(tempPath, finalPath);
    await assertHardLinkIdentity(state.root, tempPath, finalPath);
    const observed = await readRegularFile(finalPath);
    if (observed !== bytes) throw new Error(DURABILITY_ERROR);
    const evidenceSha256 = sha256(observed);
    await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
    state.published = true;
    await unlink(tempPath).catch(() => undefined);
    return Object.freeze({ relativePath, evidenceSha256 });
  } catch {
    await unlink(tempPath).catch(() => undefined);
    throw new Error(DURABILITY_ERROR);
  }
}

function buildArtifact(state: ReservationState): Phase697SmallSampleArtifact {
  const terminal = state.terminal;
  const report = state.report;
  if (!terminal || !report) throw new Error(DURABILITY_ERROR);
  return deepFreeze(
    PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA.parse({
      artifactVersion: PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_VERSION,
      lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
      authority: state.marker.authority,
      qualityAuthority:
        state.marker.authority === 'controlled_live' &&
        report.gate === 'small_sample_quality_gate_passed'
          ? 'small_sample_semantic_gate'
          : 'none',
      runId: state.marker.runId,
      runScope: state.marker.runScope,
      generatedAt: new Date().toISOString(),
      source: state.marker.source,
      proxy: state.marker.proxy,
      reportLogicalSha256: computePhase697SmallSampleCanonicalSha256(report),
      report,
      durability: {
        version: PHASE_6_9_7_SMALL_SAMPLE_DURABILITY_VERSION,
        completionMode: state.completionMode,
        publicationMode: state.publicationMode,
        markerSha256: state.markerSha256,
        terminalSequence: terminal.sequence,
        terminalRecordHash: terminal.recordHash,
        journalRecordsBeforePublication: state.records.length - 1,
        recoveryClaimSha256: state.recoveryClaimSha256,
      },
    }),
  );
}

export async function validatePhase697SmallSampleBundle(input: { root: string }) {
  try {
    const root = await requireRoot(input.root);
    const markerBytes = await readRegularFile(
      resolveRelative(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH),
    );
    const marker = PHASE_6_9_7_SMALL_SAMPLE_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${JSON.stringify(marker)}\n`) throw new Error(DURABILITY_ERROR);
    const markerSha256 = sha256(markerBytes);
    const journalBytes = await readRegularFile(
      resolveRelative(root, journalRelativePath(marker.runId)),
    );
    const records = parseJournal(journalBytes, marker, markerSha256, true);
    const terminal = records.find((record) => record.event === 'run_terminal');
    const published = records.at(-1);
    if (
      !terminal?.report ||
      published?.event !== 'evidence_published' ||
      !published.evidenceSha256
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    const artifactPath = resolveRelative(root, artifactRelativePath(marker.runScope, marker.runId));
    const evidenceBytes = await readRegularFile(artifactPath);
    const artifact = PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA.parse(JSON.parse(evidenceBytes));
    if (evidenceBytes !== `${JSON.stringify(artifact)}\n`) throw new Error(DURABILITY_ERROR);
    const physicalArtifactSha256 = sha256(evidenceBytes);
    const replay = replayRecords(marker, records);
    const recomputed = buildPhase697SmallSampleReport({
      runId: marker.runId,
      runScope: marker.runScope,
      mode: marker.mode,
      executorProvenance: marker.executorProvenance,
      approvedRunnableSourceCommit: marker.source.approvedRunnableSourceCommit,
      sourceHashes: marker.source.sourceHashes,
      caseEntries: orderedReplayEntries(replay),
    });
    const reportLogicalSha256 = computePhase697SmallSampleCanonicalSha256(recomputed);
    if (
      artifact.runId !== marker.runId ||
      artifact.runScope !== marker.runScope ||
      canonical(artifact.source) !== canonical(marker.source) ||
      canonical(artifact.proxy) !== canonical(marker.proxy) ||
      artifact.durability.markerSha256 !== markerSha256 ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.completionMode !== terminal.completionMode ||
      artifact.durability.publicationMode !==
        (records.some((record) => record.event === 'recovery_claimed') ? 'recovery' : 'runtime') ||
      artifact.reportLogicalSha256 !== reportLogicalSha256 ||
      canonical(artifact.report) !== canonical(recomputed) ||
      canonical(terminal.report) !== canonical(recomputed) ||
      terminal.reportLogicalSha256 !== reportLogicalSha256 ||
      published.evidenceSha256 !== physicalArtifactSha256 ||
      artifact.durability.journalRecordsBeforePublication !==
        records.findIndex((record) => record.event === 'publication_started')
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    await validateRecoveryClaim(root, marker, markerSha256, records, artifact);
    await requireSingleBundleFiles(root, marker, records);
    return Object.freeze({
      ok: true as const,
      runId: marker.runId,
      gate: recomputed.gate,
      qualityAuthority: artifact.qualityAuthority,
      journalRecords: records.length,
      finalJournalEvent: published.event,
      reportLogicalSha256,
      physicalArtifactSha256,
    });
  } catch {
    return Object.freeze({
      ok: false as const,
      runId: null,
      gate: null,
      qualityAuthority: null,
      journalRecords: 0,
      finalJournalEvent: null,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
    });
  }
}

function recomputeReport(state: ReservationState) {
  return buildPhase697SmallSampleReport({
    runId: state.marker.runId,
    runScope: state.marker.runScope,
    mode: state.marker.mode,
    executorProvenance: state.marker.executorProvenance,
    approvedRunnableSourceCommit: state.marker.source.approvedRunnableSourceCommit,
    sourceHashes: state.marker.source.sourceHashes,
    caseEntries: orderedStateEntries(state),
  });
}

function orderedStateEntries(state: ReservationState) {
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((expected) => {
    const entry =
      expected.kind === 'guard'
        ? state.guards.get(expected.caseId)
        : state.lanes.get(expected.caseId)?.terminal;
    if (!entry) throw new Error(DURABILITY_ERROR);
    return entry;
  });
}

function orderedReplayEntries(replay: ReturnType<typeof replayRecords>) {
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((expected) => {
    const entry = replay.entries.get(expected.caseId);
    if (!entry) throw new Error(DURABILITY_ERROR);
    return entry;
  });
}

function createLaneStates() {
  return new Map(
    PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter((entry) => entry.kind === 'runtime').map(
      (entry) => [
        entry.caseId,
        {
          identity: {
            caseId: entry.caseId,
            agent: entry.agent,
            pairedRunIndex: entry.pairedRunIndex!,
          },
          reserved: false,
          wireStages: [],
          terminal: null,
          notStarted: false,
        } satisfies LaneState,
      ],
    ),
  );
}

function requireLane(state: ReservationState, identity: Phase697SmallSampleLaneIdentity) {
  const lane = state.lanes.get(identity.caseId);
  if (
    !lane ||
    lane.identity.agent !== identity.agent ||
    lane.identity.pairedRunIndex !== identity.pairedRunIndex
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  return lane;
}

function pairLanes(state: ReservationState, pairedRunIndex: number) {
  return [...state.lanes.values()].filter(
    (lane) => lane.identity.pairedRunIndex === pairedRunIndex,
  );
}

function nextIncompletePair(state: ReservationState) {
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
    (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
  )
    .map((entry) => entry.pairedRunIndex!)
    .find((pairedRunIndex) => !state.pairs.has(pairedRunIndex));
}

function expectedReservationAgent(state: ReservationState, pairedRunIndex: number) {
  const pair = pairLanes(state, pairedRunIndex);
  const tutor = pair.find((lane) => lane.identity.agent === 'tutor');
  const organizer = pair.find((lane) => lane.identity.agent === 'wrong_question_organizer');
  if (!tutor?.reserved && !tutor?.terminal) return 'tutor' as const;
  if (!organizer?.reserved && !organizer?.terminal) return 'wrong_question_organizer' as const;
  return null;
}

function wireMatchesStages(
  entry: Phase697SmallSampleCaseEntry,
  stages: readonly Phase697V7WireStage[],
) {
  const counters = {
    executorEntered: stages.includes('executor_entered') ? 1 : 0,
    providerDispatchStarted: stages.includes('provider_dispatch_started') ? 1 : 0,
    providerResponseReceived: stages.includes('provider_response_received') ? 1 : 0,
    verifiedUsageObserved: stages.includes('usage_validated') ? 1 : 0,
  };
  return canonical(entry.wire) === canonical(counters);
}

async function appendRecord(
  state: ReservationState,
  input: Partial<Phase697SmallSampleJournalRecord> &
    Pick<Phase697SmallSampleJournalRecord, 'event'>,
) {
  const record = nextRecord(state, input);
  await appendRegularFile(state.root, state.journalPath, `${JSON.stringify(record)}\n`);
  commitRecord(state, record);
  return record;
}

function nextRecord(
  state: ReservationState,
  input: Partial<Phase697SmallSampleJournalRecord> &
    Pick<Phase697SmallSampleJournalRecord, 'event'>,
) {
  const base = {
    recordVersion: PHASE_6_9_7_SMALL_SAMPLE_JOURNAL_RECORD_VERSION,
    lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
    runId: state.marker.runId,
    sequence: state.sequence + 1,
    event: input.event,
    occurredAt: new Date().toISOString(),
    previousHash: state.previousHash,
    markerSha256: state.markerSha256,
    caseId: input.caseId ?? null,
    agent: input.agent ?? null,
    pairedRunIndex: input.pairedRunIndex ?? null,
    wireStage: input.wireStage ?? null,
    caseEntry: input.caseEntry ?? null,
    report: input.report ?? null,
    reportLogicalSha256: input.reportLogicalSha256 ?? null,
    recoveryClaimSha256: input.recoveryClaimSha256 ?? null,
    evidenceSha256: input.evidenceSha256 ?? null,
    completionMode: input.completionMode ?? null,
  };
  return deepFreeze(
    journalRecordSchema.parse({
      ...base,
      recordHash: computePhase697SmallSampleCanonicalSha256(base),
    }),
  );
}

function commitRecord(state: ReservationState, record: Phase697SmallSampleJournalRecord) {
  state.sequence = record.sequence;
  state.previousHash = record.recordHash;
  state.records.push(record);
}

function parseJournal(
  bytes: string,
  marker: Phase697SmallSampleMarker,
  markerSha256: string,
  requireComplete: boolean,
) {
  if (!bytes.endsWith('\n') || bytes.includes('\r')) throw new Error(DURABILITY_ERROR);
  const lines = bytes.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0))
    throw new Error(DURABILITY_ERROR);
  let previousHash: string | null = null;
  const records = lines.map((line, index) => {
    const parsed = journalRecordSchema.parse(JSON.parse(line));
    const { recordHash, ...base } = parsed;
    if (
      parsed.runId !== marker.runId ||
      parsed.markerSha256 !== markerSha256 ||
      parsed.sequence !== index + 1 ||
      parsed.previousHash !== previousHash ||
      computePhase697SmallSampleCanonicalSha256(base) !== recordHash
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    previousHash = recordHash;
    return parsed;
  });
  replayRecords(marker, records);
  if (requireComplete && records.at(-1)?.event !== 'evidence_published') {
    throw new Error(DURABILITY_ERROR);
  }
  return records;
}

function replayRecords(
  marker: Phase697SmallSampleMarker,
  records: readonly Phase697SmallSampleJournalRecord[],
) {
  if (records[0]?.event !== 'attempt_reserved') throw new Error(DURABILITY_ERROR);
  const entries = new Map<string, Phase697SmallSampleCaseEntry>();
  const lanes = createLaneStates();
  const pairs = new Set<number>();
  let guards = 0;
  let runTerminal = false;
  let terminalRecord: Phase697SmallSampleJournalRecord | null = null;
  let terminalReport: Phase697SmallSampleReport | null = null;
  let completionMode: 'runtime' | 'recovery' | null = null;
  let recoveryClaims = 0;
  let publicationStarted = false;
  let published = false;
  for (const record of records.slice(1)) {
    if (published) throw new Error(DURABILITY_ERROR);
    switch (record.event) {
      case 'guard_terminal': {
        const expected = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES[guards];
        if (
          runTerminal ||
          expected?.kind !== 'guard' ||
          record.caseEntry?.caseId !== expected.caseId ||
          entries.has(expected.caseId)
        )
          throw new Error(DURABILITY_ERROR);
        entries.set(expected.caseId, record.caseEntry);
        guards += 1;
        break;
      }
      case 'lane_reserved': {
        const lane = replayLane(lanes, record);
        const currentPair = nextReplayPair(pairs);
        const expectedAgent = expectedReplayReservationAgent(lanes, currentPair);
        if (
          guards !== 8 ||
          runTerminal ||
          currentPair === undefined ||
          lane.identity.pairedRunIndex !== currentPair ||
          lane.identity.agent !== expectedAgent ||
          lane.reserved ||
          lane.terminal
        )
          throw new Error(DURABILITY_ERROR);
        lane.reserved = true;
        break;
      }
      case 'wire_stage': {
        const lane = replayLane(lanes, record);
        if (
          !lane.reserved ||
          lane.terminal ||
          pairs.has(lane.identity.pairedRunIndex) ||
          record.wireStage !== PHASE_6_9_7_V7_WIRE_STAGES[lane.wireStages.length]
        )
          throw new Error(DURABILITY_ERROR);
        lane.wireStages.push(record.wireStage);
        break;
      }
      case 'lane_terminal':
      case 'lane_not_started': {
        const lane = replayLane(lanes, record);
        if (
          lane.terminal ||
          !record.caseEntry ||
          lane.identity.pairedRunIndex !== nextReplayPair(pairs) ||
          (record.event === 'lane_terminal' && !lane.reserved) ||
          (record.event === 'lane_not_started' && lane.reserved) ||
          (record.event === 'lane_not_started' &&
            lane.identity.agent !==
              expectedReplayReservationAgent(lanes, lane.identity.pairedRunIndex)) ||
          !wireMatchesStages(record.caseEntry, lane.wireStages)
        )
          throw new Error(DURABILITY_ERROR);
        lane.terminal = record.caseEntry;
        lane.notStarted = record.event === 'lane_not_started';
        entries.set(record.caseEntry.caseId, record.caseEntry);
        break;
      }
      case 'pair_terminal': {
        if (
          record.pairedRunIndex === null ||
          record.pairedRunIndex !== nextReplayPair(pairs) ||
          pairs.has(record.pairedRunIndex)
        )
          throw new Error(DURABILITY_ERROR);
        const pair = [...lanes.values()].filter(
          (lane) => lane.identity.pairedRunIndex === record.pairedRunIndex,
        );
        if (pair.length !== 2 || pair.some((lane) => !lane.terminal))
          throw new Error(DURABILITY_ERROR);
        pairs.add(record.pairedRunIndex);
        break;
      }
      case 'recovery_claimed':
        if (publicationStarted || recoveryClaims !== 0) throw new Error(DURABILITY_ERROR);
        recoveryClaims += 1;
        break;
      case 'run_terminal': {
        if (
          runTerminal ||
          guards !== 8 ||
          pairs.size !== 8 ||
          !record.report ||
          record.completionMode === null ||
          (recoveryClaims > 0 && record.completionMode !== 'recovery') ||
          (recoveryClaims === 0 && record.completionMode !== 'runtime')
        )
          throw new Error(DURABILITY_ERROR);
        const recomputed = buildPhase697SmallSampleReport({
          runId: marker.runId,
          runScope: marker.runScope,
          mode: marker.mode,
          executorProvenance: marker.executorProvenance,
          approvedRunnableSourceCommit: marker.source.approvedRunnableSourceCommit,
          sourceHashes: marker.source.sourceHashes,
          caseEntries: PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((expected) => {
            const entry = entries.get(expected.caseId);
            if (!entry) throw new Error(DURABILITY_ERROR);
            return entry;
          }),
        });
        if (
          canonical(record.report) !== canonical(recomputed) ||
          record.reportLogicalSha256 !== computePhase697SmallSampleCanonicalSha256(recomputed)
        )
          throw new Error(DURABILITY_ERROR);
        runTerminal = true;
        terminalRecord = record;
        terminalReport = record.report;
        completionMode = record.completionMode;
        break;
      }
      case 'publication_started':
        if (!runTerminal || publicationStarted) throw new Error(DURABILITY_ERROR);
        publicationStarted = true;
        break;
      case 'evidence_published':
        if (!publicationStarted || published) throw new Error(DURABILITY_ERROR);
        published = true;
        break;
      case 'attempt_reserved':
        throw new Error(DURABILITY_ERROR);
    }
  }
  return {
    entries,
    lanes,
    pairs,
    guards,
    runTerminal,
    terminalRecord,
    terminalReport,
    completionMode,
    recoveryClaims,
    publicationStarted,
    published,
  };
}

function nextReplayPair(pairs: ReadonlySet<number>) {
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
    (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
  )
    .map((entry) => entry.pairedRunIndex!)
    .find((pairedRunIndex) => !pairs.has(pairedRunIndex));
}

function expectedReplayReservationAgent(
  lanes: ReadonlyMap<string, LaneState>,
  pairedRunIndex: number | undefined,
) {
  if (pairedRunIndex === undefined) return null;
  const pair = [...lanes.values()].filter(
    (lane) => lane.identity.pairedRunIndex === pairedRunIndex,
  );
  const tutor = pair.find((lane) => lane.identity.agent === 'tutor');
  const organizer = pair.find((lane) => lane.identity.agent === 'wrong_question_organizer');
  if (!tutor?.reserved && !tutor?.terminal) return 'tutor' as const;
  if (!organizer?.reserved && !organizer?.terminal) return 'wrong_question_organizer' as const;
  return null;
}

function replayLane(lanes: Map<string, LaneState>, record: Phase697SmallSampleJournalRecord) {
  const lane = record.caseId ? lanes.get(record.caseId) : undefined;
  if (
    !lane ||
    lane.identity.agent !== record.agent ||
    lane.identity.pairedRunIndex !== record.pairedRunIndex
  )
    throw new Error(DURABILITY_ERROR);
  return lane;
}

async function validateRecoveryClaim(
  root: string,
  marker: Phase697SmallSampleMarker,
  markerSha256: string,
  records: readonly Phase697SmallSampleJournalRecord[],
  artifact: Phase697SmallSampleArtifact,
) {
  const recovery = [...records].reverse().find((record) => record.event === 'recovery_claimed');
  if (!recovery) {
    if (artifact.durability.recoveryClaimSha256 !== null) throw new Error(DURABILITY_ERROR);
    if (await pathExists(resolveRelative(root, recoveryClaimRelativePath(marker.runId)))) {
      throw new Error(DURABILITY_ERROR);
    }
    return;
  }
  const bytes = await readRegularFile(
    resolveRelative(root, recoveryClaimRelativePath(marker.runId)),
  );
  const claim = PHASE_6_9_7_SMALL_SAMPLE_RECOVERY_CLAIM_SCHEMA.parse(JSON.parse(bytes));
  if (bytes !== `${JSON.stringify(claim)}\n`) throw new Error(DURABILITY_ERROR);
  if (
    claim.runId !== marker.runId ||
    claim.markerSha256 !== markerSha256 ||
    claim.journalTailRecordHash !== recovery.previousHash ||
    Date.parse(claim.claimedAt) < Date.parse(marker.createdAt) ||
    recovery.recoveryClaimSha256 !== sha256(bytes) ||
    artifact.durability.recoveryClaimSha256 !== sha256(bytes)
  )
    throw new Error(DURABILITY_ERROR);
}

async function requireSingleBundleFiles(
  root: string,
  marker: Phase697SmallSampleMarker,
  records: readonly Phase697SmallSampleJournalRecord[],
) {
  const entries = await readdir(join(root, '.tmp'));
  const journals = entries.filter((entry) => FORMAL_JOURNAL_FILE.test(entry));
  const claims = entries.filter((entry) => FORMAL_CLAIM_FILE.test(entry));
  const artifacts = entries.filter((entry) => FORMAL_ARTIFACT_FILE.test(entry));
  const expectedClaimCount = records.some((record) => record.event === 'recovery_claimed') ? 1 : 0;
  if (
    journals.length !== 1 ||
    journals[0] !== journalRelativePath(marker.runId).split('/').at(-1) ||
    claims.length !== expectedClaimCount ||
    (expectedClaimCount === 1 &&
      claims[0] !== recoveryClaimRelativePath(marker.runId).split('/').at(-1)) ||
    artifacts.length !== 1 ||
    artifacts[0] !== artifactRelativePath(marker.runScope, marker.runId).split('/').at(-1)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

function enqueue(state: ReservationState, operation: () => Promise<void>) {
  const guarded = async () => {
    await state.fence?.();
    return operation();
  };
  const next = state.tail.then(guarded, guarded);
  state.tail = next.catch(() => undefined);
  return next;
}

function enqueueResult<T>(state: ReservationState, operation: () => Promise<T>) {
  const guarded = async () => {
    await state.fence?.();
    return operation();
  };
  const next = state.tail.then(guarded, guarded);
  state.tail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureTmpDirectory(root: string) {
  const path = resolveRelative(root, '.tmp');
  await mkdir(path, { recursive: true });
  const [stat, canonicalPath] = await Promise.all([lstat(path), realpath(path)]);
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonicalPath !== path) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function writeExclusiveRegularFile(path: string, bytes: string) {
  const root = findRootForPath(path);
  const handle = await openExclusiveHandle(path);
  try {
    await assertHandleIdentity(root, path, handle);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await assertHandleIdentity(root, path, handle);
  } finally {
    await handle.close();
  }
}

function openExclusiveHandle(path: string) {
  return open(path, 'wx', 0o600);
}

async function appendRegularFile(root: string, path: string, bytes: string) {
  await assertRegularPath(root, path);
  const handle = await open(path, 'a');
  try {
    await assertHandleIdentity(root, path, handle);
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
    await assertHandleIdentity(root, path, handle);
  } finally {
    await handle.close();
  }
}

async function readRegularFile(path: string) {
  const root = findRootForPath(path);
  await assertRegularPath(root, path);
  const handle = await open(path, 'r');
  try {
    await assertHandleIdentity(root, path, handle);
    const bytes = await handle.readFile('utf8');
    await assertHandleIdentity(root, path, handle);
    return bytes;
  } finally {
    await handle.close();
  }
}

async function assertHardLinkIdentity(root: string, left: string, right: string) {
  const [leftStat, rightStat] = await Promise.all([
    assertRegularPath(root, left),
    assertRegularPath(root, right),
  ]);
  if (leftStat.dev !== rightStat.dev || leftStat.ino !== rightStat.ino) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function assertRegularPath(root: string, path: string) {
  const [stat, canonicalPath] = await Promise.all([lstat(path), realpath(path)]);
  assertContained(root, canonicalPath);
  if (!stat.isFile() || stat.isSymbolicLink() || canonicalPath !== resolve(path)) {
    throw new Error(DURABILITY_ERROR);
  }
  return stat;
}

async function assertHandleIdentity(
  root: string,
  path: string,
  handle: Awaited<ReturnType<typeof open>>,
) {
  const [handleStat, pathStat, canonicalPath, parentStat, canonicalParent] = await Promise.all([
    handle.stat(),
    lstat(path),
    realpath(path),
    lstat(dirname(path)),
    realpath(dirname(path)),
  ]);
  assertContained(root, canonicalPath);
  assertContained(root, canonicalParent);
  if (
    !handleStat.isFile() ||
    !pathStat.isFile() ||
    pathStat.isSymbolicLink() ||
    !parentStat.isDirectory() ||
    parentStat.isSymbolicLink() ||
    canonicalPath !== resolve(path) ||
    canonicalParent !== dirname(resolve(path)) ||
    handleStat.dev !== pathStat.dev ||
    handleStat.ino !== pathStat.ino
  )
    throw new Error(DURABILITY_ERROR);
}

async function requireRoot(value: unknown) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    throw new Error(DURABILITY_ERROR);
  }
  const root = resolve(value);
  const [stat, canonicalRoot] = await Promise.all([lstat(root), realpath(root)]);
  if (!stat.isDirectory() || stat.isSymbolicLink() || canonicalRoot !== root) {
    throw new Error(DURABILITY_ERROR);
  }
  return root;
}

function resolveRelative(root: string, relativePath: string) {
  const target = resolve(root, ...relativePath.split('/'));
  assertContained(root, target);
  return target;
}

function assertContained(root: string, target: string) {
  const delta = relative(root, target);
  if (!delta || delta.startsWith('..') || isAbsolute(delta) || resolve(root, delta) !== target) {
    throw new Error(DURABILITY_ERROR);
  }
}

function findRootForPath(path: string) {
  const parent = dirname(resolve(path));
  if (parent.split(/[\\/]/u).at(-1) === '.tmp') return dirname(parent);
  if (dirname(parent).split(/[\\/]/u).at(-1) === '.tmp') return dirname(dirname(parent));
  throw new Error(DURABILITY_ERROR);
}

export function journalRelativePath(runId: string) {
  if (!isUuid(runId)) throw new Error(DURABILITY_ERROR);
  return `.tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-${runId}.journal.jsonl`;
}

export function recoveryClaimRelativePath(runId: string) {
  if (!isUuid(runId)) throw new Error(DURABILITY_ERROR);
  return `.tmp/phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-${runId}.recovery.claim`;
}

export function artifactRelativePath(runScope: 'branch' | 'main', runId: string) {
  if (!isUuid(runId)) throw new Error(DURABILITY_ERROR);
  return `.tmp/phase-6-9-7-tutor-organizer-small-sample-l2-${runScope}-controlled-live-${runId}.json`;
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

async function pathExists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return false;
    throw error;
  }
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function isProcessAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return isErrorCode(error, 'EPERM');
  }
}

function canonical(value: unknown) {
  return canonicalPhase697SmallSampleJson(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
