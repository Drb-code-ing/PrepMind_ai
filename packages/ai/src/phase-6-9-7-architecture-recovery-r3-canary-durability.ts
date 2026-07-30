import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import {
  buildPhase697ArchitectureRecoveryR3CanaryArtifact,
  buildPhase697ArchitectureRecoveryR3CrashSealReport,
  buildPhase697ArchitectureRecoveryR3CanaryMarker,
  phase697ArchitectureRecoveryR3CanaryArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RECORD_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  type Phase697ArchitectureRecoveryR3CanaryArtifact,
  type Phase697ArchitectureRecoveryR3CanaryJournalRecord,
  type Phase697ArchitectureRecoveryR3CanaryMarker,
  type Phase697ArchitectureRecoveryR3CanaryReport,
  type Phase697ArchitectureRecoveryR3CanaryRecoveryClaim,
  type Phase697ArchitectureRecoveryR3CanarySource,
} from './phase-6-9-7-architecture-recovery-r3-canary-contract.ts';
import {
  PHASE_6_9_7_V7_WIRE_STAGES,
  type Phase697V7WireStage,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_VERSION =
  'phase-6.9.7-architecture-recovery-r3-provider-canary-durability-v1' as const;

export type Phase697ArchitectureRecoveryR3CanaryTerminal = Readonly<{
  sequence: number;
  recordHash: string;
  reportSha256: string;
}>;

export type Phase697ArchitectureRecoveryR3CanaryReservation = Readonly<{
  version: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_VERSION;
  runId: string;
  markerRelativePath: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH;
  journalRelativePath: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH;
  markerSha256: string;
  appendWireStage(stage: Phase697V7WireStage): Promise<void>;
  appendTerminal(
    report: Phase697ArchitectureRecoveryR3CanaryReport,
  ): Promise<Phase697ArchitectureRecoveryR3CanaryTerminal>;
  buildArtifact(input: {
    generatedAt: string;
    report: Phase697ArchitectureRecoveryR3CanaryReport;
    terminal: Phase697ArchitectureRecoveryR3CanaryTerminal;
  }): Phase697ArchitectureRecoveryR3CanaryArtifact;
  publishArtifact(artifact: Phase697ArchitectureRecoveryR3CanaryArtifact): Promise<
    Readonly<{
      relativePath: string;
      evidenceSha256: string;
    }>
  >;
}>;

export type Phase697ArchitectureRecoveryR3CanaryCrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      attemptDisposition: Phase697ArchitectureRecoveryR3CanaryArtifact['attemptDisposition'];
      evidenceSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'r3_seal_attempt_missing_or_invalid'
        | 'r3_seal_live_owner'
        | 'r3_seal_already_complete'
        | 'r3_seal_claim_io'
        | 'r3_seal_journal_drift'
        | 'r3_seal_evidence_io';
    }>;

type ReservationState = {
  root: string;
  runId: string;
  source: Phase697ArchitectureRecoveryR3CanarySource;
  markerSha256: string;
  sequence: number;
  previousHash: string | null;
  terminal: Phase697ArchitectureRecoveryR3CanaryTerminal | null;
  terminalReport: Phase697ArchitectureRecoveryR3CanaryReport | null;
  completionMode: 'runtime_terminal' | 'crash_only_seal' | null;
  publicationMode: 'runtime' | 'recovery';
  recoveryClaimSha256: string | null;
  fence: (() => Promise<void>) | null;
  publicationAttempted: boolean;
  tail: Promise<void>;
};

const reservationStates = new WeakMap<object, ReservationState>();
const DURABILITY_REJECTED = 'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED';
const HEX_64 = /^[a-f0-9]{64}$/u;
const EVIDENCE_FILE = new RegExp(
  `^${PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.json$`,
  'u',
);

export async function reservePhase697ArchitectureRecoveryR3Canary(input: {
  root: string;
  runId: string;
  createdAt: string;
  source: Phase697ArchitectureRecoveryR3CanarySource;
}): Promise<Phase697ArchitectureRecoveryR3CanaryReservation> {
  try {
    const root = requireRoot(input.root);
    const marker = buildPhase697ArchitectureRecoveryR3CanaryMarker({
      runId: input.runId,
      createdAt: input.createdAt,
      ownerProcessId: process.pid,
      ownerToken: randomUUID(),
      source: input.source,
    });
    const markerBytes = `${JSON.stringify(marker)}\n`;
    const markerPath = resolveRelative(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
    );
    const journalPath = resolveRelative(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
    );
    await mkdir(join(root, '.tmp'), { recursive: true });
    await writeExclusiveFile(markerPath, markerBytes);
    const markerSha256 = sha256(markerBytes);
    const state: ReservationState = {
      root,
      runId: marker.runId,
      source: marker.source,
      markerSha256,
      sequence: 0,
      previousHash: null,
      terminal: null,
      terminalReport: null,
      completionMode: null,
      publicationMode: 'runtime',
      recoveryClaimSha256: null,
      fence: null,
      publicationAttempted: false,
      tail: Promise.resolve(),
    };
    await createJournal(journalPath, state, marker.createdAt);
    return createReservation(state);
  } catch {
    throw new Error(DURABILITY_REJECTED);
  }
}

function createReservation(
  state: ReservationState,
): Phase697ArchitectureRecoveryR3CanaryReservation {
  const holder: { current: Phase697ArchitectureRecoveryR3CanaryReservation | null } = {
    current: null,
  };
  const current = () => {
    if (!holder.current) throw new Error(DURABILITY_REJECTED);
    return holder.current;
  };
  const reservation: Phase697ArchitectureRecoveryR3CanaryReservation = Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_VERSION,
    runId: state.runId,
    markerRelativePath: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
    journalRelativePath: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
    markerSha256: state.markerSha256,
    appendWireStage: (stage: Phase697V7WireStage): Promise<void> =>
      appendWireStage(current(), stage),
    appendTerminal: (report: Phase697ArchitectureRecoveryR3CanaryReport) =>
      appendTerminal(current(), report),
    buildArtifact: (artifactInput) => buildArtifact(current(), artifactInput),
    publishArtifact: (artifact) => publishArtifact(current(), artifact),
  });
  holder.current = reservation;
  reservationStates.set(reservation, state);
  return reservation;
}

export async function validatePhase697ArchitectureRecoveryR3CanaryBundle(input: {
  root: string;
}): Promise<
  Readonly<{
    ok: boolean;
    evidenceCount: number;
    runId: string | null;
    journalRecords: number;
    finalJournalEvent: Phase697ArchitectureRecoveryR3CanaryJournalRecord['event'] | null;
    outcome: Phase697ArchitectureRecoveryR3CanaryReport['providerReport']['outcome'] | null;
    responseObserved: boolean | null;
    completionMode:
      | Phase697ArchitectureRecoveryR3CanaryArtifact['durability']['completionMode']
      | null;
    publicationMode:
      | Phase697ArchitectureRecoveryR3CanaryArtifact['durability']['publicationMode']
      | null;
    attemptDisposition: Phase697ArchitectureRecoveryR3CanaryArtifact['attemptDisposition'] | null;
  }>
> {
  try {
    const root = requireRoot(input.root);
    const markerBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
      'utf8',
    );
    const marker = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    const journalBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
      'utf8',
    );
    const markerSha256 = sha256(markerBytes);
    const records = parseAndVerifyJournal(journalBytes, marker.runId, markerSha256, true);
    const files = (await readdir(join(root, '.tmp'))).filter((name) => EVIDENCE_FILE.test(name));
    if (files.length !== 1) throw new Error();
    const evidenceBytes = await readFile(join(root, '.tmp', files[0]), 'utf8');
    const artifact = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA.parse(
      JSON.parse(evidenceBytes),
    );
    const terminal = records.find((record) => record.event === 'runtime_terminal');
    const recoveryClaimed = records.filter((record) => record.event === 'recovery_claimed').at(-1);
    const published = records.at(-1);
    let recoveryClaimSha256: string | null = null;
    if (artifact.durability.publicationMode === 'recovery') {
      const claimBytes = await readFile(
        resolveRelative(
          root,
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
        ),
        'utf8',
      );
      const claim = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA.parse(
        JSON.parse(claimBytes),
      );
      recoveryClaimSha256 = sha256(claimBytes);
      if (
        claim.runId !== marker.runId ||
        claim.markerSha256 !== markerSha256 ||
        claim.journalTailRecordHash !== recoveryClaimed?.previousHash ||
        recoveryClaimed?.recoveryClaimSha256 !== recoveryClaimSha256
      ) {
        throw new Error();
      }
    } else if (recoveryClaimed) {
      throw new Error();
    }
    if (
      artifact.runId !== marker.runId ||
      JSON.stringify(artifact.source) !== JSON.stringify(marker.source) ||
      artifact.durability.markerSha256 !== markerSha256 ||
      !terminal ||
      terminal.outcome !== artifact.report.providerReport.outcome ||
      JSON.stringify(terminal.report) !== JSON.stringify(artifact.report) ||
      terminal.completionMode !== artifact.durability.completionMode ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.terminalReportSha256 !== sha256(JSON.stringify(artifact.report)) ||
      terminal.reportSha256 !== artifact.durability.terminalReportSha256 ||
      artifact.durability.recoveryClaimSha256 !== recoveryClaimSha256 ||
      published?.event !== 'evidence_published' ||
      published.evidenceSha256 !== sha256(evidenceBytes)
    ) {
      throw new Error();
    }
    return Object.freeze({
      ok: true,
      evidenceCount: 1,
      runId: artifact.runId,
      journalRecords: records.length,
      finalJournalEvent: published.event,
      outcome: artifact.report.providerReport.outcome,
      responseObserved: artifact.report.providerReport.responseObserved,
      completionMode: artifact.durability.completionMode,
      publicationMode: artifact.durability.publicationMode,
      attemptDisposition: artifact.attemptDisposition,
    });
  } catch {
    return Object.freeze({
      ok: false,
      evidenceCount: 0,
      runId: null,
      journalRecords: 0,
      finalJournalEvent: null,
      outcome: null,
      responseObserved: null,
      completionMode: null,
      publicationMode: null,
      attemptDisposition: null,
    });
  }
}

/**
 * Seals an interrupted R3 attempt from durable journal facts only. It never
 * creates a transport, reads a credential, dispatches, retries, resumes, or
 * replays the provider call.
 */
export async function sealPhase697ArchitectureRecoveryR3InterruptedCanary(input: {
  root: string;
}): Promise<Phase697ArchitectureRecoveryR3CanaryCrashSealResult> {
  let root: string;
  let markerBytes: string;
  let marker: Phase697ArchitectureRecoveryR3CanaryMarker;
  let markerSha256: string;
  let journalBytes: string;
  let records: readonly Phase697ArchitectureRecoveryR3CanaryJournalRecord[];
  try {
    root = requireRoot(input.root);
    markerBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
      'utf8',
    );
    marker = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    markerSha256 = sha256(markerBytes);
    journalBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
      'utf8',
    );
    records = parseAndVerifyJournal(journalBytes, marker.runId, markerSha256, false);
  } catch {
    return Object.freeze({ ok: false, code: 'r3_seal_attempt_missing_or_invalid' });
  }
  if (isProcessAlive(marker.ownerProcessId)) {
    return Object.freeze({ ok: false, code: 'r3_seal_live_owner' });
  }
  if (records.some((record) => record.event === 'evidence_published')) {
    return Object.freeze({ ok: false, code: 'r3_seal_already_complete' });
  }
  if (records.some((record) => record.event === 'publication_started')) {
    return Object.freeze({ ok: false, code: 'r3_seal_evidence_io' });
  }
  const initialTail = records.at(-1);
  if (!initialTail) {
    return Object.freeze({ ok: false, code: 'r3_seal_attempt_missing_or_invalid' });
  }

  const acquired = await acquireRecoveryClaim({
    root,
    runId: marker.runId,
    markerSha256,
    journalTailRecordHash: initialTail.recordHash,
  });
  if (!acquired.ok) return acquired.result;

  try {
    const rereadMarkerBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
      'utf8',
    );
    const rereadJournalBytes = await readFile(
      resolveRelative(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
      'utf8',
    );
    const rereadRecords = parseAndVerifyJournal(
      rereadJournalBytes,
      marker.runId,
      markerSha256,
      false,
    );
    if (
      rereadMarkerBytes !== markerBytes ||
      rereadRecords.at(-1)?.recordHash !== initialTail.recordHash ||
      !(await acquired.assertOwned())
    ) {
      await acquired.release();
      return Object.freeze({ ok: false, code: 'r3_seal_journal_drift' });
    }

    const existingTerminal = rereadRecords.find((record) => record.event === 'runtime_terminal');
    const state: ReservationState = {
      root,
      runId: marker.runId,
      source: marker.source,
      markerSha256,
      sequence: initialTail.sequence,
      previousHash: initialTail.recordHash,
      terminal: existingTerminal
        ? Object.freeze({
            sequence: existingTerminal.sequence,
            recordHash: existingTerminal.recordHash,
            reportSha256: existingTerminal.reportSha256!,
          })
        : null,
      terminalReport: existingTerminal?.report ?? null,
      completionMode: existingTerminal?.completionMode ?? null,
      publicationMode: 'recovery',
      recoveryClaimSha256: acquired.claimSha256,
      fence: null,
      publicationAttempted: false,
      tail: Promise.resolve(),
    };
    const reservation = createReservation(state);
    state.fence = () =>
      assertRecoveryFence({
        root,
        markerBytes,
        markerSha256,
        runId: marker.runId,
        claimBytes: acquired.claimBytes,
        expectedSequence: state.sequence,
        expectedTailHash: state.previousHash,
      });
    await appendRecoveryClaimed(reservation, acquired.claimSha256);

    let report: Phase697ArchitectureRecoveryR3CanaryReport;
    let terminal: Phase697ArchitectureRecoveryR3CanaryTerminal;
    let disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
    if (state.terminal && state.terminalReport) {
      report = state.terminalReport;
      terminal = state.terminal;
      disposition = 'terminal_publication_recovered';
    } else {
      const wireStages = rereadRecords
        .filter((record) => record.event === 'wire_stage')
        .map((record) => record.wireStage!);
      report = buildPhase697ArchitectureRecoveryR3CrashSealReport(wireStages);
      terminal = await appendTerminalWithMode(reservation, report, 'crash_only_seal');
      disposition = 'crash_only_sealed';
    }
    const artifact = reservation.buildArtifact({
      generatedAt: new Date().toISOString(),
      report,
      terminal,
    });
    const published = await reservation.publishArtifact(artifact);
    const validation = await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root });
    if (!validation.ok || validation.runId !== marker.runId) throw new Error();
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      disposition,
      attemptDisposition: artifact.attemptDisposition,
      evidenceSha256: published.evidenceSha256,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'r3_seal_evidence_io' });
  }
}

async function createJournal(path: string, state: ReservationState, recordedAt: string) {
  const record = nextRecord(state, {
    recordedAt,
    event: 'attempt_reserved',
    wireStage: null,
    outcome: null,
    reportSha256: null,
    evidenceSha256: null,
    markerSha256: state.markerSha256,
    recoveryClaimSha256: null,
    completionMode: null,
    report: null,
  });
  await writeExclusiveFile(path, `${JSON.stringify(record)}\n`);
  commitRecord(state, record);
}

function appendWireStage(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  stage: Phase697V7WireStage,
) {
  return enqueue(reservation, async (state) => {
    if (
      state.terminal ||
      state.publicationAttempted ||
      PHASE_6_9_7_V7_WIRE_STAGES[state.sequence - 1] !== stage
    ) {
      throw new Error();
    }
    const record = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'wire_stage',
      wireStage: stage,
      outcome: null,
      reportSha256: null,
      evidenceSha256: null,
      markerSha256: null,
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
  });
}

function appendRecoveryClaimed(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  recoveryClaimSha256: string,
) {
  return enqueue(reservation, async (state) => {
    if (state.publicationAttempted || state.recoveryClaimSha256 !== recoveryClaimSha256) {
      throw new Error();
    }
    const record = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'recovery_claimed',
      wireStage: null,
      outcome: null,
      reportSha256: null,
      evidenceSha256: null,
      markerSha256: null,
      recoveryClaimSha256,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
  });
}

function appendTerminal(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  report: Phase697ArchitectureRecoveryR3CanaryReport,
) {
  return appendTerminalWithMode(reservation, report, 'runtime_terminal');
}

function appendTerminalWithMode(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  report: Phase697ArchitectureRecoveryR3CanaryReport,
  completionMode: 'runtime_terminal' | 'crash_only_seal',
) {
  return enqueue(reservation, async (state) => {
    const parsed = parseControlledLiveReport(report);
    if (state.terminal || state.publicationAttempted) throw new Error();
    const reportSha256 = sha256(JSON.stringify(parsed));
    const record = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'runtime_terminal',
      wireStage: null,
      outcome: parsed.providerReport.outcome,
      reportSha256,
      evidenceSha256: null,
      markerSha256: null,
      recoveryClaimSha256: null,
      completionMode,
      report: parsed,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
    const terminal = Object.freeze({
      sequence: record.sequence,
      recordHash: record.recordHash,
      reportSha256,
    });
    state.terminal = terminal;
    state.terminalReport = parsed;
    state.completionMode = completionMode;
    return terminal;
  });
}

function buildArtifact(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  input: {
    generatedAt: string;
    report: Phase697ArchitectureRecoveryR3CanaryReport;
    terminal: Phase697ArchitectureRecoveryR3CanaryTerminal;
  },
) {
  const state = requireReservationState(reservation);
  const parsed = parseControlledLiveReport(input.report);
  if (
    !state.terminal ||
    !state.terminalReport ||
    !state.completionMode ||
    input.terminal.sequence !== state.terminal.sequence ||
    input.terminal.recordHash !== state.terminal.recordHash ||
    input.terminal.reportSha256 !== state.terminal.reportSha256 ||
    sha256(JSON.stringify(parsed)) !== state.terminal.reportSha256
  ) {
    throw new Error(DURABILITY_REJECTED);
  }
  return buildPhase697ArchitectureRecoveryR3CanaryArtifact({
    runId: state.runId,
    generatedAt: input.generatedAt,
    source: state.source,
    markerSha256: state.markerSha256,
    terminalSequence: state.terminal.sequence,
    terminalRecordHash: state.terminal.recordHash,
    completionMode: state.completionMode,
    publicationMode: state.publicationMode,
    recoveryClaimSha256: state.recoveryClaimSha256,
    report: parsed,
  });
}

function publishArtifact(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  artifact: Phase697ArchitectureRecoveryR3CanaryArtifact,
) {
  return enqueue(reservation, async (state) => {
    if (state.publicationAttempted || !state.terminal || !state.terminalReport) throw new Error();
    const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA.parse(artifact);
    if (
      parsed.runId !== state.runId ||
      parsed.durability.markerSha256 !== state.markerSha256 ||
      parsed.durability.terminalSequence !== state.terminal.sequence ||
      parsed.durability.terminalRecordHash !== state.terminal.recordHash ||
      parsed.durability.terminalReportSha256 !== state.terminal.reportSha256 ||
      parsed.durability.completionMode !== state.completionMode ||
      parsed.durability.publicationMode !== state.publicationMode ||
      parsed.durability.recoveryClaimSha256 !== state.recoveryClaimSha256 ||
      sha256(JSON.stringify(parsed.report)) !== state.terminal.reportSha256
    ) {
      throw new Error();
    }
    const publicationStarted = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'publication_started',
      wireStage: null,
      outcome: null,
      reportSha256: null,
      evidenceSha256: null,
      markerSha256: null,
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    state.publicationAttempted = true;
    await appendJournal(state, publicationStarted);
    commitRecord(state, publicationStarted);

    const relativePath = phase697ArchitectureRecoveryR3CanaryArtifactPath({ runId: state.runId });
    const finalPath = resolveRelative(state.root, relativePath);
    const tempPath = `${finalPath}.tmp-${randomUUID()}`;
    const bytes = `${JSON.stringify(parsed)}\n`;
    await writeExclusiveFile(tempPath, bytes);
    try {
      await link(tempPath, finalPath);
    } catch {
      await unlink(tempPath).catch(() => undefined);
      throw new Error();
    }
    await unlink(tempPath).catch(() => undefined);
    const evidenceSha256 = sha256(bytes);
    const record = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'evidence_published',
      wireStage: null,
      outcome: null,
      reportSha256: null,
      evidenceSha256,
      markerSha256: null,
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
    return Object.freeze({ relativePath, evidenceSha256 });
  });
}

function enqueue<T>(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
  operation: (state: ReservationState) => Promise<T>,
): Promise<T> {
  const state = requireReservationState(reservation);
  const guarded = async () => {
    await state.fence?.();
    return operation(state);
  };
  const result = state.tail.then(guarded, guarded);
  state.tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result.catch(() => {
    throw new Error(DURABILITY_REJECTED);
  });
}

function nextRecord(
  state: ReservationState,
  input: Omit<
    Phase697ArchitectureRecoveryR3CanaryJournalRecord,
    'version' | 'runId' | 'sequence' | 'previousHash' | 'recordHash'
  >,
) {
  const payload = {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION,
    runId: state.runId,
    sequence: state.sequence + 1,
    recordedAt: input.recordedAt,
    event: input.event,
    wireStage: input.wireStage,
    outcome: input.outcome,
    reportSha256: input.reportSha256,
    evidenceSha256: input.evidenceSha256,
    markerSha256: input.markerSha256,
    recoveryClaimSha256: input.recoveryClaimSha256,
    completionMode: input.completionMode,
    report: input.report,
    previousHash: state.previousHash,
  } as const;
  return PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RECORD_SCHEMA.parse({
    ...payload,
    recordHash: sha256(JSON.stringify(payload)),
  });
}

async function appendJournal(
  state: ReservationState,
  record: Phase697ArchitectureRecoveryR3CanaryJournalRecord,
) {
  await appendSyncedFile(
    resolveRelative(state.root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
    `${JSON.stringify(record)}\n`,
  );
}

function commitRecord(
  state: ReservationState,
  record: Phase697ArchitectureRecoveryR3CanaryJournalRecord,
) {
  state.sequence = record.sequence;
  state.previousHash = record.recordHash;
}

function parseAndVerifyJournal(
  bytes: string,
  runId: string,
  markerSha256: string,
  requireComplete: boolean,
) {
  if (!bytes.endsWith('\n')) throw new Error();
  const lines = bytes.slice(0, -1).split('\n');
  const records: Phase697ArchitectureRecoveryR3CanaryJournalRecord[] = [];
  let previousHash: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const record = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RECORD_SCHEMA.parse(
      JSON.parse(lines[index]),
    );
    const { recordHash, ...payload } = record;
    if (
      record.runId !== runId ||
      record.sequence !== index + 1 ||
      record.previousHash !== previousHash ||
      recordHash !== sha256(JSON.stringify(payload))
    ) {
      throw new Error();
    }
    previousHash = recordHash;
    records.push(record);
  }
  const first = records[0];
  if (first?.event !== 'attempt_reserved' || first.markerSha256 !== markerSha256) throw new Error();
  let terminalSeen = false;
  let publicationStarted = false;
  let evidenceSeen = false;
  let recoverySeen = false;
  for (const record of records.slice(1)) {
    if (evidenceSeen) throw new Error();
    if (record.event === 'wire_stage') {
      if (terminalSeen || recoverySeen) throw new Error();
      continue;
    }
    if (record.event === 'recovery_claimed') {
      if (publicationStarted) throw new Error();
      recoverySeen = true;
      continue;
    }
    if (record.event === 'runtime_terminal') {
      if (terminalSeen) throw new Error();
      terminalSeen = true;
      continue;
    }
    if (record.event === 'publication_started') {
      if (!terminalSeen || publicationStarted) throw new Error();
      publicationStarted = true;
      continue;
    }
    if (record.event === 'evidence_published') {
      if (!terminalSeen || !publicationStarted) throw new Error();
      evidenceSeen = true;
      continue;
    }
    throw new Error();
  }
  if (
    requireComplete &&
    (!terminalSeen || !evidenceSeen || records.at(-1)?.event !== 'evidence_published')
  ) {
    throw new Error();
  }
  const wireStages = records
    .filter((record) => record.event === 'wire_stage')
    .map((record) => record.wireStage);
  if (
    wireStages.some((stage, index) => stage !== PHASE_6_9_7_V7_WIRE_STAGES[index]) ||
    wireStages.length > PHASE_6_9_7_V7_WIRE_STAGES.length
  ) {
    throw new Error();
  }
  return Object.freeze(records);
}

function parseControlledLiveReport(value: unknown) {
  const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.parse(value);
  if (
    parsed.authority !== 'controlled_live' ||
    parsed.providerReport.authority !== 'controlled_live'
  ) {
    throw new Error();
  }
  return parsed;
}

async function acquireRecoveryClaim(input: {
  root: string;
  runId: string;
  markerSha256: string;
  journalTailRecordHash: string;
}): Promise<
  | Readonly<{
      ok: true;
      claim: Phase697ArchitectureRecoveryR3CanaryRecoveryClaim;
      claimBytes: string;
      claimSha256: string;
      assertOwned(): Promise<boolean>;
      release(): Promise<void>;
    }>
  | Readonly<{ ok: false; result: Phase697ArchitectureRecoveryR3CanaryCrashSealResult }>
> {
  const claimPath = resolveRelative(
    input.root,
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
  );
  const claim = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA.parse({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION,
    runId: input.runId,
    claimedAt: new Date().toISOString(),
    ownerProcessId: process.pid,
    ownerToken: randomUUID(),
    markerSha256: input.markerSha256,
    journalTailRecordHash: input.journalTailRecordHash,
    state: 'orphan_seal_claimed',
  });
  const claimBytes = `${JSON.stringify(claim)}\n`;
  try {
    await writeExclusiveFile(claimPath, claimBytes);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'r3_seal_claim_io' }),
      });
    }
    let existing: Phase697ArchitectureRecoveryR3CanaryRecoveryClaim;
    try {
      const stat = await lstat(claimPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
      existing = PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_SCHEMA.parse(
        JSON.parse(await readFile(claimPath, 'utf8')),
      );
    } catch {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'r3_seal_claim_io' }),
      });
    }
    if (isProcessAlive(existing.ownerProcessId)) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'r3_seal_live_owner' }),
      });
    }
    const stalePath = `${claimPath}.stale-${process.pid}-${randomUUID()}`;
    try {
      await rename(claimPath, stalePath);
    } catch (renameError) {
      if (!isMissingError(renameError)) {
        return Object.freeze({
          ok: false,
          result: Object.freeze({ ok: false, code: 'r3_seal_claim_io' }),
        });
      }
    }
    try {
      await writeExclusiveFile(claimPath, claimBytes);
    } catch {
      await unlink(stalePath).catch(() => undefined);
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'r3_seal_live_owner' }),
      });
    }
    await unlink(stalePath).catch(() => undefined);
  }
  const assertOwned = async () => {
    try {
      const stat = await lstat(claimPath);
      return (
        stat.isFile() &&
        !stat.isSymbolicLink() &&
        (await readFile(claimPath, 'utf8')) === claimBytes
      );
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
  markerBytes: string;
  markerSha256: string;
  runId: string;
  claimBytes: string;
  expectedSequence: number;
  expectedTailHash: string | null;
}) {
  const [markerBytes, claimBytes, journalBytes] = await Promise.all([
    readFile(
      resolveRelative(input.root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
      'utf8',
    ),
    readFile(
      resolveRelative(
        input.root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
      ),
      'utf8',
    ),
    readFile(
      resolveRelative(
        input.root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
      ),
      'utf8',
    ),
  ]);
  const records = parseAndVerifyJournal(journalBytes, input.runId, input.markerSha256, false);
  if (
    markerBytes !== input.markerBytes ||
    claimBytes !== input.claimBytes ||
    records.at(-1)?.sequence !== input.expectedSequence ||
    records.at(-1)?.recordHash !== input.expectedTailHash
  ) {
    throw new Error();
  }
}

function isProcessAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return isErrorCode(error, 'EPERM');
  }
}

function isAlreadyExistsError(error: unknown) {
  return isErrorCode(error, 'EEXIST');
}

function isMissingError(error: unknown) {
  return isErrorCode(error, 'ENOENT');
}

function isErrorCode(error: unknown, code: string) {
  try {
    return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === code;
  } catch {
    return false;
  }
}

function requireReservationState(
  reservation: Phase697ArchitectureRecoveryR3CanaryReservation,
): ReservationState {
  const state = reservationStates.get(reservation);
  if (!state) throw new Error(DURABILITY_REJECTED);
  return state;
}

async function writeExclusiveFile(path: string, bytes: string) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function appendSyncedFile(path: string, bytes: string) {
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function requireRoot(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\0') ||
    !isAbsolute(value)
  ) {
    throw new Error();
  }
  return value;
}

function resolveRelative(root: string, relativePath: string) {
  const normalized = relativePath.replaceAll('/', '\\');
  const resolved = join(root, normalized);
  if (!resolved.startsWith(`${root}\\`) && !resolved.startsWith(`${root}/`)) throw new Error();
  return resolved;
}

function sha256(value: string) {
  const hash = createHash('sha256').update(value).digest('hex');
  if (!HEX_64.test(hash)) throw new Error();
  return hash;
}
