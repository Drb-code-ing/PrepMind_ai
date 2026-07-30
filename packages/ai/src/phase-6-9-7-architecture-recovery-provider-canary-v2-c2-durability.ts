import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

import {
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Artifact,
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker,
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report,
  phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA,
  sha256Canonical,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Marker,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2RecoveryClaim,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Source,
} from './phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import {
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_STAGES,
  type Phase697V7WireStage,
} from './phase-6-9-7-v7-wire-diagnostics.ts';

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_DURABILITY_VERSION =
  'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-durability-v1' as const;

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal = Readonly<{
  sequence: number;
  recordHash: string;
  reportSha256: string;
}>;

export type Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation = Readonly<{
  version: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_DURABILITY_VERSION;
  runId: string;
  markerRelativePath: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH;
  journalRelativePath: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH;
  markerSha256: string;
  appendWireStage(stage: Phase697V7WireStage): Promise<void>;
  appendTerminal(
    report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  ): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal>;
  buildArtifact(input: {
    generatedAt: string;
    report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report;
    terminal: Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal;
  }): Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact;
  publishArtifact(artifact: Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact): Promise<
    Readonly<{
      relativePath: string;
      evidenceSha256: string;
    }>
  >;
}>;

export type Phase697ArchitectureRecoveryProviderCanaryV2C2CrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      attemptDisposition: Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact['attemptDisposition'];
      evidenceSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'c2_seal_attempt_missing_or_invalid'
        | 'c2_seal_live_owner'
        | 'c2_seal_already_complete'
        | 'c2_seal_claim_io'
        | 'c2_seal_journal_drift'
        | 'c2_seal_evidence_io';
    }>;

type CompletionMode = 'runtime' | 'recovery';
type PublicationMode = 'runtime' | 'recovery';
type ReservationState = {
  root: string;
  runId: string;
  source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
  proxyAttestation: Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation;
  markerSha256: string;
  sourceSha256: string;
  proxyAttestationSha256: string;
  sequence: number;
  previousHash: string | null;
  wireStages: Phase697V7WireStage[];
  terminal: Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal | null;
  terminalReport: Phase697ArchitectureRecoveryProviderCanaryV2C2Report | null;
  completionMode: CompletionMode | null;
  publicationMode: PublicationMode;
  recoveryClaimSha256: string | null;
  fence: (() => Promise<void>) | null;
  publicationAttempted: boolean;
  tail: Promise<void>;
};

const RESERVATION_STATES = new WeakMap<object, ReservationState>();
const DURABILITY_REJECTED =
  'PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_DURABILITY_REJECTED';
const HEX_64 = /^[a-f0-9]{64}$/u;
const EVIDENCE_FILE = new RegExp(
  `^${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.json$`,
  'u',
);

export async function reservePhase697ArchitectureRecoveryProviderCanaryV2C2(input: {
  root: string;
  runId: string;
  createdAt: string;
  source: Phase697ArchitectureRecoveryProviderCanaryV2C2Source;
  proxyAttestation: Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation;
}): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation> {
  try {
    const root = await requireRoot(input.root);
    const source = deepFreeze(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA.parse(input.source),
    );
    const proxyAttestation = deepFreeze(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_PROXY_ATTESTATION_SCHEMA.parse(
        input.proxyAttestation,
      ),
    );
    const marker = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker({
      runId: input.runId,
      createdAt: input.createdAt,
      ownerProcessId: process.pid,
      ownerToken: randomUUID(),
      source,
      proxyAttestation,
    });
    const markerBytes = `${JSON.stringify(marker)}\n`;
    const markerPath = resolveRelative(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
    );
    const journalPath = resolveRelative(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
    );
    await ensureTmpDirectory(root);
    await writeExclusiveFile(markerPath, markerBytes);
    const state: ReservationState = {
      root,
      runId: marker.runId,
      source,
      proxyAttestation,
      markerSha256: sha256(markerBytes),
      sourceSha256: sha256Canonical(source),
      proxyAttestationSha256: sha256Canonical(proxyAttestation),
      sequence: 0,
      previousHash: null,
      wireStages: [],
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

export async function validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle(input: {
  root: string;
}): Promise<
  Readonly<{
    ok: boolean;
    evidenceCount: number;
    runId: string | null;
    journalRecords: number;
    finalJournalEvent: Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord['event'] | null;
    outcome: Phase697ArchitectureRecoveryProviderCanaryV2C2Report['outcome'] | null;
    providerHealth: Phase697ArchitectureRecoveryProviderCanaryV2C2Report['providerHealth'] | null;
    responseObserved: boolean | null;
    completionMode: CompletionMode | null;
    publicationMode: PublicationMode | null;
    attemptDisposition:
      Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact['attemptDisposition'] | null;
  }>
> {
  try {
    const root = await requireRoot(input.root);
    const markerBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
      ),
    );
    const marker = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    const journalBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
      ),
    );
    const markerSha256 = sha256(markerBytes);
    const sourceSha256 = sha256Canonical(marker.source);
    const proxyAttestationSha256 = sha256Canonical(marker.proxyAttestation);
    const records = parseAndVerifyJournal({
      bytes: journalBytes,
      runId: marker.runId,
      markerSha256,
      sourceSha256,
      proxyAttestationSha256,
      requireComplete: true,
    });
    const files = (await readdir(join(root, '.tmp'))).filter((name) => EVIDENCE_FILE.test(name));
    if (files.length !== 1) throw new Error();
    const evidenceBytes = await readRegularFile(join(root, '.tmp', files[0]));
    const artifact = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.parse(
      JSON.parse(evidenceBytes),
    );
    const terminal = records.find((record) => record.event === 'runtime_terminal');
    const recoveryClaimed = records.find((record) => record.event === 'recovery_claimed');
    const published = records.at(-1);
    let recoveryClaimSha256: string | null = null;
    if (artifact.durability.publicationMode === 'recovery') {
      const claimBytes = await readRegularFile(
        resolveRelative(
          root,
          PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
        ),
      );
      const claim =
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA.parse(
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
      JSON.stringify(artifact.proxyAttestation) !== JSON.stringify(marker.proxyAttestation) ||
      artifact.durability.markerSha256 !== markerSha256 ||
      artifact.durability.sourceSha256 !== sourceSha256 ||
      artifact.durability.proxyAttestationSha256 !== proxyAttestationSha256 ||
      !terminal ||
      terminal.outcome !== artifact.report.outcome ||
      JSON.stringify(terminal.report) !== JSON.stringify(artifact.report) ||
      terminal.completionMode !== artifact.durability.completionMode ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.terminalReportSha256 !== sha256Canonical(artifact.report) ||
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
      outcome: artifact.report.outcome,
      providerHealth: artifact.report.providerHealth,
      responseObserved: artifact.report.responseObserved,
      completionMode: artifact.durability.completionMode,
      publicationMode: artifact.durability.publicationMode,
      attemptDisposition: artifact.attemptDisposition,
    });
  } catch {
    return invalidValidation();
  }
}

/**
 * Seals a dead C2 owner from durable local facts only. It never reads a
 * credential, constructs a transport, dispatches, retries, resumes, or
 * replays the Provider call.
 */
export async function sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt(input: {
  root: string;
}): Promise<Phase697ArchitectureRecoveryProviderCanaryV2C2CrashSealResult> {
  let root: string;
  let markerBytes: string;
  let marker: Phase697ArchitectureRecoveryProviderCanaryV2C2Marker;
  let markerSha256: string;
  let sourceSha256: string;
  let proxyAttestationSha256: string;
  let records: readonly Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord[];
  try {
    root = await requireRoot(input.root);
    markerBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
      ),
    );
    marker = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    markerSha256 = sha256(markerBytes);
    sourceSha256 = sha256Canonical(marker.source);
    proxyAttestationSha256 = sha256Canonical(marker.proxyAttestation);
    const journalBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
      ),
    );
    records = parseAndVerifyJournal({
      bytes: journalBytes,
      runId: marker.runId,
      markerSha256,
      sourceSha256,
      proxyAttestationSha256,
      requireComplete: false,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'c2_seal_attempt_missing_or_invalid' });
  }
  if (isProcessAlive(marker.ownerProcessId)) {
    return Object.freeze({ ok: false, code: 'c2_seal_live_owner' });
  }
  if (records.some((record) => record.event === 'evidence_published')) {
    return Object.freeze({ ok: false, code: 'c2_seal_already_complete' });
  }
  if (records.some((record) => record.event === 'publication_started')) {
    return Object.freeze({ ok: false, code: 'c2_seal_evidence_io' });
  }
  const initialTail = records.at(-1);
  if (!initialTail) {
    return Object.freeze({ ok: false, code: 'c2_seal_attempt_missing_or_invalid' });
  }

  const acquired = await acquireRecoveryClaim({
    root,
    runId: marker.runId,
    markerSha256,
    journalTailRecordHash: initialTail.recordHash,
  });
  if (!acquired.ok) return acquired.result;

  try {
    const rereadMarkerBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
      ),
    );
    const rereadJournalBytes = await readRegularFile(
      resolveRelative(
        root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
      ),
    );
    const rereadRecords = parseAndVerifyJournal({
      bytes: rereadJournalBytes,
      runId: marker.runId,
      markerSha256,
      sourceSha256,
      proxyAttestationSha256,
      requireComplete: false,
    });
    if (
      rereadMarkerBytes !== markerBytes ||
      rereadRecords.at(-1)?.recordHash !== initialTail.recordHash ||
      !(await acquired.assertOwned())
    ) {
      await acquired.release();
      return Object.freeze({ ok: false, code: 'c2_seal_journal_drift' });
    }

    const existingTerminal = rereadRecords.find((record) => record.event === 'runtime_terminal');
    const wireStages = rereadRecords
      .filter((record) => record.event === 'wire_stage')
      .map((record) => record.wireStage!);
    const state: ReservationState = {
      root,
      runId: marker.runId,
      source: deepFreeze(marker.source),
      proxyAttestation: deepFreeze(marker.proxyAttestation),
      markerSha256,
      sourceSha256,
      proxyAttestationSha256,
      sequence: initialTail.sequence,
      previousHash: initialTail.recordHash,
      wireStages: [...wireStages],
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
        sourceSha256,
        proxyAttestationSha256,
        runId: marker.runId,
        claimBytes: acquired.claimBytes,
        expectedSequence: state.sequence,
        expectedTailHash: state.previousHash,
      });
    await appendRecoveryClaimed(reservation, acquired.claimSha256);

    let report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report;
    let terminal: Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal;
    let disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
    if (state.terminal && state.terminalReport) {
      report = state.terminalReport;
      terminal = state.terminal;
      disposition = 'terminal_publication_recovered';
    } else {
      report = buildCrashSealReport(wireStages);
      terminal = await appendTerminalWithMode(reservation, report, 'recovery');
      disposition = 'crash_only_sealed';
    }
    const artifact = reservation.buildArtifact({
      generatedAt: new Date().toISOString(),
      report,
      terminal,
    });
    const published = await reservation.publishArtifact(artifact);
    const validation = await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root });
    if (!validation.ok || validation.runId !== marker.runId) throw new Error();
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      disposition,
      attemptDisposition: artifact.attemptDisposition,
      evidenceSha256: published.evidenceSha256,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'c2_seal_evidence_io' });
  }
}

function createReservation(
  state: ReservationState,
): Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation {
  const holder: { current: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation | null } = {
    current: null,
  };
  const current = () => {
    if (!holder.current) throw new Error(DURABILITY_REJECTED);
    return holder.current;
  };
  const reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation = Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_DURABILITY_VERSION,
    runId: state.runId,
    markerRelativePath:
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
    journalRelativePath:
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
    markerSha256: state.markerSha256,
    appendWireStage: (stage) => appendWireStage(current(), stage),
    appendTerminal: (report) => appendTerminalWithMode(current(), report, 'runtime'),
    buildArtifact: (input) => buildArtifact(current(), input),
    publishArtifact: (artifact) => publishArtifact(current(), artifact),
  });
  holder.current = reservation;
  RESERVATION_STATES.set(reservation, state);
  return reservation;
}

async function createJournal(path: string, state: ReservationState, recordedAt: string) {
  const record = nextRecord(state, {
    recordedAt,
    event: 'attempt_reserved',
    wireStage: null,
    outcome: null,
    reportSha256: null,
    evidenceSha256: null,
    recoveryClaimSha256: null,
    completionMode: null,
    report: null,
  });
  await writeExclusiveFile(path, `${JSON.stringify(record)}\n`);
  commitRecord(state, record);
}

function appendWireStage(
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
  stage: Phase697V7WireStage,
) {
  return enqueue(reservation, async (state) => {
    if (
      state.terminal ||
      state.publicationAttempted ||
      PHASE_6_9_7_V7_WIRE_STAGES[state.wireStages.length] !== stage
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
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
    state.wireStages.push(stage);
  });
}

function appendRecoveryClaimed(
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
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
      recoveryClaimSha256,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, record);
    commitRecord(state, record);
  });
}

function appendTerminalWithMode(
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
  report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report,
  completionMode: CompletionMode,
) {
  return enqueue(reservation, async (state) => {
    const parsed = parseControlledLiveReport(report);
    if (state.terminal || state.publicationAttempted) throw new Error();
    const reportSha256 = sha256Canonical(parsed);
    const record = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'runtime_terminal',
      wireStage: null,
      outcome: parsed.outcome,
      reportSha256,
      evidenceSha256: null,
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
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
  input: {
    generatedAt: string;
    report: Phase697ArchitectureRecoveryProviderCanaryV2C2Report;
    terminal: Phase697ArchitectureRecoveryProviderCanaryV2C2Terminal;
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
    sha256Canonical(parsed) !== state.terminal.reportSha256
  ) {
    throw new Error(DURABILITY_REJECTED);
  }
  return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Artifact({
    runId: state.runId,
    generatedAt: input.generatedAt,
    source: state.source,
    proxyAttestation: state.proxyAttestation,
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
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
  artifact: Phase697ArchitectureRecoveryProviderCanaryV2C2Artifact,
) {
  return enqueue(reservation, async (state) => {
    if (state.publicationAttempted || !state.terminal || !state.terminalReport) throw new Error();
    const parsed =
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.parse(artifact);
    if (
      parsed.runId !== state.runId ||
      parsed.durability.markerSha256 !== state.markerSha256 ||
      parsed.durability.sourceSha256 !== state.sourceSha256 ||
      parsed.durability.proxyAttestationSha256 !== state.proxyAttestationSha256 ||
      parsed.durability.terminalSequence !== state.terminal.sequence ||
      parsed.durability.terminalRecordHash !== state.terminal.recordHash ||
      parsed.durability.terminalReportSha256 !== state.terminal.reportSha256 ||
      parsed.durability.completionMode !== state.completionMode ||
      parsed.durability.publicationMode !== state.publicationMode ||
      parsed.durability.recoveryClaimSha256 !== state.recoveryClaimSha256 ||
      sha256Canonical(parsed.report) !== state.terminal.reportSha256
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
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    state.publicationAttempted = true;
    await appendJournal(state, publicationStarted);
    commitRecord(state, publicationStarted);

    const relativePath = phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath({
      runId: state.runId,
    });
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
    const published = nextRecord(state, {
      recordedAt: new Date().toISOString(),
      event: 'evidence_published',
      wireStage: null,
      outcome: null,
      reportSha256: null,
      evidenceSha256,
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
    });
    await appendJournal(state, published);
    commitRecord(state, published);
    return Object.freeze({ relativePath, evidenceSha256 });
  });
}

function nextRecord(
  state: ReservationState,
  input: Omit<
    Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord,
    | 'version'
    | 'runId'
    | 'sequence'
    | 'previousHash'
    | 'markerSha256'
    | 'sourceSha256'
    | 'proxyAttestationSha256'
    | 'recordHash'
  >,
) {
  const payload = {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_VERSION,
    runId: state.runId,
    sequence: state.sequence + 1,
    recordedAt: input.recordedAt,
    event: input.event,
    previousHash: state.previousHash,
    markerSha256: state.markerSha256,
    sourceSha256: state.sourceSha256,
    proxyAttestationSha256: state.proxyAttestationSha256,
    wireStage: input.wireStage,
    outcome: input.outcome,
    reportSha256: input.reportSha256,
    evidenceSha256: input.evidenceSha256,
    recoveryClaimSha256: input.recoveryClaimSha256,
    completionMode: input.completionMode,
    report: input.report,
  } as const;
  return PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA.parse({
    ...payload,
    recordHash: sha256Canonical(payload),
  });
}

function parseAndVerifyJournal(input: {
  bytes: string;
  runId: string;
  markerSha256: string;
  sourceSha256: string;
  proxyAttestationSha256: string;
  requireComplete: boolean;
}) {
  if (!input.bytes.endsWith('\n')) throw new Error();
  const lines = input.bytes.slice(0, -1).split('\n');
  const records: Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord[] = [];
  let previousHash: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const record =
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA.parse(
        JSON.parse(lines[index]),
      );
    const { recordHash, ...payload } = record;
    if (
      record.runId !== input.runId ||
      record.sequence !== index + 1 ||
      record.previousHash !== previousHash ||
      record.markerSha256 !== input.markerSha256 ||
      record.sourceSha256 !== input.sourceSha256 ||
      record.proxyAttestationSha256 !== input.proxyAttestationSha256 ||
      recordHash !== sha256Canonical(payload)
    ) {
      throw new Error();
    }
    previousHash = recordHash;
    records.push(record);
  }
  if (records[0]?.event !== 'attempt_reserved') throw new Error();
  let terminalSeen = false;
  let recoverySeen = false;
  let publicationStarted = false;
  let evidenceSeen = false;
  const wireStages: Phase697V7WireStage[] = [];
  for (const record of records.slice(1)) {
    if (evidenceSeen) throw new Error();
    switch (record.event) {
      case 'wire_stage':
        if (terminalSeen || recoverySeen || publicationStarted) throw new Error();
        wireStages.push(record.wireStage!);
        break;
      case 'recovery_claimed':
        if (recoverySeen || publicationStarted) throw new Error();
        recoverySeen = true;
        break;
      case 'runtime_terminal':
        if (terminalSeen || publicationStarted) throw new Error();
        if (record.completionMode === 'recovery' && !recoverySeen) throw new Error();
        terminalSeen = true;
        break;
      case 'publication_started':
        if (!terminalSeen || publicationStarted) throw new Error();
        publicationStarted = true;
        break;
      case 'evidence_published':
        if (!publicationStarted) throw new Error();
        evidenceSeen = true;
        break;
      case 'attempt_reserved':
        throw new Error();
    }
  }
  if (
    wireStages.some((stage, index) => stage !== PHASE_6_9_7_V7_WIRE_STAGES[index]) ||
    wireStages.length > PHASE_6_9_7_V7_WIRE_STAGES.length
  ) {
    throw new Error();
  }
  if (
    input.requireComplete &&
    (!terminalSeen || !evidenceSeen || records.at(-1)?.event !== 'evidence_published')
  ) {
    throw new Error();
  }
  return Object.freeze(records);
}

function buildCrashSealReport(
  stages: readonly Phase697V7WireStage[],
): Phase697ArchitectureRecoveryProviderCanaryV2C2Report {
  const parsedStages = [...stages];
  if (
    parsedStages.length > PHASE_6_9_7_V7_WIRE_STAGES.length ||
    parsedStages.some((stage, index) => stage !== PHASE_6_9_7_V7_WIRE_STAGES[index])
  ) {
    throw new Error();
  }
  const executorInvocations = parsedStages.includes('executor_entered')
    ? (1 as const)
    : (0 as const);
  const providerDispatches = parsedStages.includes('provider_dispatch_started')
    ? (1 as const)
    : (0 as const);
  const providerResponses = parsedStages.includes('provider_response_received')
    ? (1 as const)
    : (0 as const);
  return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
    authority: 'controlled_live',
    executorProvenance: 'deepseek_network',
    outcome: providerResponses === 1 ? 'response_observed' : 'harness_internal',
    responseObserved: providerResponses === 1,
    strictResponseObserved: false,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire:
      parsedStages.length === 0
        ? {
            version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
            state: 'not_started',
            lastCompletedStage: null,
            failureCategory: null,
            counters: {
              executorInvocations: 0,
              providerDispatches: 0,
              providerResponses: 0,
              verifiedUsages: 0,
            },
          }
        : {
            version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
            state: 'failed',
            lastCompletedStage: parsedStages.at(-1) ?? null,
            failureCategory: 'harness_internal',
            counters: {
              executorInvocations,
              providerDispatches,
              providerResponses,
              // A stage without its terminal values is not durable usage evidence.
              verifiedUsages: 0,
            },
          },
    usage: null,
  });
}

function enqueue<T>(
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
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

async function appendJournal(
  state: ReservationState,
  record: Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord,
) {
  await appendSyncedFile(
    resolveRelative(
      state.root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
    ),
    `${JSON.stringify(record)}\n`,
  );
}

function commitRecord(
  state: ReservationState,
  record: Phase697ArchitectureRecoveryProviderCanaryV2C2JournalRecord,
) {
  state.sequence = record.sequence;
  state.previousHash = record.recordHash;
}

function parseControlledLiveReport(value: unknown) {
  const parsed = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA.parse(value);
  if (parsed.authority !== 'controlled_live' || parsed.executorProvenance !== 'deepseek_network') {
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
      claim: Phase697ArchitectureRecoveryProviderCanaryV2C2RecoveryClaim;
      claimBytes: string;
      claimSha256: string;
      assertOwned(): Promise<boolean>;
      release(): Promise<void>;
    }>
  | Readonly<{
      ok: false;
      result: Phase697ArchitectureRecoveryProviderCanaryV2C2CrashSealResult;
    }>
> {
  const claimPath = resolveRelative(
    input.root,
    PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
  );
  const claim = PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA.parse(
    {
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_VERSION,
      runId: input.runId,
      claimedAt: new Date().toISOString(),
      ownerProcessId: process.pid,
      ownerToken: randomUUID(),
      markerSha256: input.markerSha256,
      journalTailRecordHash: input.journalTailRecordHash,
      state: 'orphan_seal_claimed',
    },
  );
  const claimBytes = `${JSON.stringify(claim)}\n`;
  try {
    await writeExclusiveFile(claimPath, claimBytes);
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'c2_seal_claim_io' }),
      });
    }
    let existing: Phase697ArchitectureRecoveryProviderCanaryV2C2RecoveryClaim;
    try {
      existing =
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_SCHEMA.parse(
          JSON.parse(await readRegularFile(claimPath)),
        );
    } catch {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'c2_seal_claim_io' }),
      });
    }
    if (isProcessAlive(existing.ownerProcessId)) {
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'c2_seal_live_owner' }),
      });
    }
    const stalePath = `${claimPath}.stale-${process.pid}-${randomUUID()}`;
    try {
      await rename(claimPath, stalePath);
    } catch (renameError) {
      if (!isMissingError(renameError)) {
        return Object.freeze({
          ok: false,
          result: Object.freeze({ ok: false, code: 'c2_seal_claim_io' }),
        });
      }
    }
    try {
      await writeExclusiveFile(claimPath, claimBytes);
    } catch {
      await unlink(stalePath).catch(() => undefined);
      return Object.freeze({
        ok: false,
        result: Object.freeze({ ok: false, code: 'c2_seal_live_owner' }),
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
  markerBytes: string;
  markerSha256: string;
  sourceSha256: string;
  proxyAttestationSha256: string;
  runId: string;
  claimBytes: string;
  expectedSequence: number;
  expectedTailHash: string | null;
}) {
  const [markerBytes, claimBytes, journalBytes] = await Promise.all([
    readRegularFile(
      resolveRelative(
        input.root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
      ),
    ),
    readRegularFile(
      resolveRelative(
        input.root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
      ),
    ),
    readRegularFile(
      resolveRelative(
        input.root,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
      ),
    ),
  ]);
  const records = parseAndVerifyJournal({
    bytes: journalBytes,
    runId: input.runId,
    markerSha256: input.markerSha256,
    sourceSha256: input.sourceSha256,
    proxyAttestationSha256: input.proxyAttestationSha256,
    requireComplete: false,
  });
  if (
    markerBytes !== input.markerBytes ||
    claimBytes !== input.claimBytes ||
    records.at(-1)?.sequence !== input.expectedSequence ||
    records.at(-1)?.recordHash !== input.expectedTailHash
  ) {
    throw new Error();
  }
}

function requireReservationState(
  reservation: Phase697ArchitectureRecoveryProviderCanaryV2C2Reservation,
) {
  const state = RESERVATION_STATES.get(reservation);
  if (!state) throw new Error(DURABILITY_REJECTED);
  return state;
}

function invalidValidation() {
  return Object.freeze({
    ok: false,
    evidenceCount: 0,
    runId: null,
    journalRecords: 0,
    finalJournalEvent: null,
    outcome: null,
    providerHealth: null,
    responseObserved: null,
    completionMode: null,
    publicationMode: null,
    attemptDisposition: null,
  });
}

async function requireRoot(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\0') ||
    !isAbsolute(value)
  ) {
    throw new Error();
  }
  const root = resolve(value);
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
  return root;
}

async function ensureTmpDirectory(root: string) {
  const path = resolveRelative(root, '.tmp');
  await mkdir(path, { recursive: true });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
}

function resolveRelative(root: string, relativePath: string) {
  const resolvedRoot = resolve(root);
  const resolved = resolve(resolvedRoot, ...relativePath.split('/'));
  const child = relative(resolvedRoot, resolved);
  if (child.length === 0 || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error();
  }
  return resolved;
}

async function readRegularFile(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  return readFile(path, 'utf8');
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
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
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

function sha256(value: string) {
  const hash = createHash('sha256').update(value).digest('hex');
  if (!HEX_64.test(hash)) throw new Error();
  return hash;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
