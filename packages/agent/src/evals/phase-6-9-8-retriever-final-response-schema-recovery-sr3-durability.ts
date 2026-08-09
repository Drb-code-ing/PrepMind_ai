import { Buffer } from 'node:buffer';
import { randomUUID, createHash } from 'node:crypto';
import {
  constants as fsConstants,
  link,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  stat,
  unlink,
} from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA,
  buildPhase698RetrieverSchemaRecoverySr3Report,
  canonicalPhase698RetrieverSchemaRecoverySr3Json,
  expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule,
  parsePhase698RetrieverSchemaRecoverySr3Report,
  sha256Phase698RetrieverSchemaRecoverySr3,
  type Phase698RetrieverSchemaRecoverySr3GuardEntry,
  type Phase698RetrieverSchemaRecoverySr3LaneEntry,
  type Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  type Phase698RetrieverSchemaRecoverySr3LaneStage,
  type Phase698RetrieverSchemaRecoverySr3Report,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import type {
  Phase698RetrieverSchemaRecoverySr3LaneLifecycle,
  Phase698RetrieverSchemaRecoverySr3Lifecycle,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-runner.ts';
import {
  consumePhase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-durability-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-marker-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-journal-record-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-recovery-claim-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-artifact-v1' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1.marker' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const DATETIME = z.string().datetime({ offset: true });
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const DURABILITY_ERROR = 'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_DURABILITY_INVALID';
const FORMAL_BASENAME =
  /^phase-6-9-8-retriever-final-response-schema-recovery-v1(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|report\.json|recovery\.claim|json))$/u;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    businessWrites: z.literal(0),
    createdAt: DATETIME,
    creatorPid: z.number().int().positive(),
    creatorStartIdentity: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
    source: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_SCHEMA,
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr3Marker = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_SCHEMA
>;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE),
    runId: UUID,
    markerSha256: SHA256,
    claimedAt: DATETIME,
    recoveryId: UUID,
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    retry: z.literal(false),
    replay: z.literal(false),
  })
  .strict();

type RecoveryClaim = z.infer<typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA>;

const EVENT = z.enum([
  'attempt_reserved',
  'guard_terminal',
  'lane_reserved',
  'lane_stage',
  'lane_terminal',
  'recovery_claimed',
  'run_terminal',
  'publication_started',
  'evidence_published',
]);

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_RECORD_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE),
    runId: UUID,
    sequence: z.number().int().positive(),
    previousHash: SHA256,
    event: EVENT,
    at: DATETIME,
    payload: z.unknown(),
    recordHash: SHA256,
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr3JournalRecord = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_RECORD_SCHEMA
>;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE),
    runId: UUID,
    reportLogicalSha256: SHA256,
    durability: z
      .object({
        markerSha256: SHA256,
        journalTerminalHash: SHA256,
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        businessWrites: z.literal(0),
        retry: z.literal(false),
        replay: z.literal(false),
        resume: z.literal(false),
        backfill: z.literal(false),
      })
      .strict(),
    report: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA,
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr3Artifact = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_SCHEMA
>;

type ReplayState = {
  marker: Phase698RetrieverSchemaRecoverySr3Marker;
  markerSha256: string;
  sequence: number;
  previousHash: string;
  attemptReserved: boolean;
  guards: Phase698RetrieverSchemaRecoverySr3GuardEntry[];
  lanes: Phase698RetrieverSchemaRecoverySr3LaneEntry[];
  activeLane: Phase698RetrieverSchemaRecoverySr3LaneIdentity | null;
  activeStages: Phase698RetrieverSchemaRecoverySr3LaneStage[];
  preparedSuccess: Phase698RetrieverSchemaRecoverySr3LaneEntry | null;
  recoveryClaim: Readonly<{ claim: RecoveryClaim; claimSha256: string }> | null;
  terminal: Phase698RetrieverSchemaRecoverySr3Report | null;
  publicationStarted: Readonly<{
    reportSha256: string;
    artifactRelativePath: string;
    journalTerminalHash: string;
  }> | null;
  published: Readonly<{ artifactSha256: string }> | null;
};

type ReservationState = ReplayState & {
  root: string;
  journalPath: string;
  queue: Promise<void>;
  failed: boolean;
};

export type Phase698RetrieverSchemaRecoverySr3Reservation = Readonly<{
  runId: string;
  markerRelativePath: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH;
  journalRelativePath: string;
  lifecycle: Phase698RetrieverSchemaRecoverySr3Lifecycle;
  publishArtifact(
    report: Phase698RetrieverSchemaRecoverySr3Report,
  ): Promise<Readonly<{ artifactRelativePath: string; artifactSha256: string }>>;
}>;

export type Phase698RetrieverSchemaRecoverySr3CrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
      gate: Phase698RetrieverSchemaRecoverySr3Report['gate'];
    }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'process_identity_unavailable'
        | 'journal_invalid'
        | 'recovery_claim_invalid'
        | 'publication_invalid'
        | 'already_published';
    }>;

export async function reservePhase698RetrieverSchemaRecoverySr3Attempt(input: {
  root: string;
  runId: string;
  createdAt: string;
  reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
}): Promise<Phase698RetrieverSchemaRecoverySr3Reservation> {
  return reserveAttempt(input, {
    pid: process.pid,
    startIdentity: currentProcessStartIdentity(),
  });
}

/** Synthetic-only creator identity seam for PID-reuse durability tests. */
export async function reservePhase698RetrieverSchemaRecoverySr3AttemptForTest(
  input: {
    root: string;
    runId: string;
    createdAt: string;
    reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
  },
  creator: Readonly<{ pid: number; startIdentity: string }>,
): Promise<Phase698RetrieverSchemaRecoverySr3Reservation> {
  return reserveAttempt(input, creator);
}

async function reserveAttempt(
  input: {
    root: string;
    runId: string;
    createdAt: string;
    reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
  },
  creator: Readonly<{ pid: number; startIdentity: string }>,
) {
  const root = await requireRoot(input.root);
  const admission = consumePhase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability(
    input.reservationCapability,
    root,
  );
  if (admission.authority !== 'synthetic_test' && admission.authority !== 'git_verified') {
    throw new Error(DURABILITY_ERROR);
  }
  const marker = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
    runId: input.runId,
    authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
    providerCalls: 0,
    credentialReads: 0,
    businessWrites: 0,
    createdAt: input.createdAt,
    creatorPid: creator.pid,
    creatorStartIdentity: normalizeStartIdentity(creator.startIdentity),
    source: admission.source,
  });
  await ensureTmp(root);
  if ((await formalFiles(root)).length !== 0) throw new Error(DURABILITY_ERROR);
  const markerPath = resolveRelative(
    root,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH,
  );
  const markerBytes = canonicalLine(marker);
  await writeExclusive(markerPath, markerBytes);
  await syncDirectory(dirname(markerPath));
  const markerSha256 = sha256(markerBytes);
  const journalRelative = phase698RetrieverSchemaRecoverySr3JournalRelativePath(marker.runId);
  const journalPath = resolveRelative(root, journalRelative);
  const state = createReservationState(root, journalPath, marker, markerSha256);
  const record = nextRecord(state, 'attempt_reserved', {
    markerSha256,
    sourceBundleSha256: marker.source.sourceBundleSha256,
  });
  await writeExclusive(journalPath, canonicalLine(record));
  await syncDirectory(dirname(journalPath));
  applyRecord(state, record);
  return reservationFromState(state, journalRelative);
}

export async function validatePhase698RetrieverSchemaRecoverySr3Bundle(input: { root: string }) {
  try {
    const root = await requireRoot(input.root);
    const markerPath = resolveRelative(
      root,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH,
    );
    const markerBytes = await readRegular(markerPath);
    const marker = parseCanonicalLine(
      markerBytes,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_SCHEMA,
    );
    const markerSha256 = sha256(markerBytes);
    const journalPath = resolveRelative(
      root,
      phase698RetrieverSchemaRecoverySr3JournalRelativePath(marker.runId),
    );
    const records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    const replay = replayRecords(marker, markerSha256, records);
    if (!replay.terminal || !replay.publicationStarted || !replay.published) {
      throw new Error(DURABILITY_ERROR);
    }
    const report = recomputeReport(replay, replay.terminal.completionMode);
    const reportPath = resolveRelative(
      root,
      phase698RetrieverSchemaRecoverySr3ReportRelativePath(marker.runId),
    );
    const artifactPath = resolveRelative(
      root,
      phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(marker.runId),
    );
    const reportBytes = await readRegular(reportPath);
    const artifactBytes = await readRegular(artifactPath);
    if (reportBytes !== artifactBytes) throw new Error(DURABILITY_ERROR);
    await assertHardLink(reportPath, artifactPath);
    const artifact = parseCanonicalLine(
      artifactBytes,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_SCHEMA,
    );
    const expected = buildArtifact(replay, report);
    const reportSha = sha256Phase698RetrieverSchemaRecoverySr3(
      canonicalPhase698RetrieverSchemaRecoverySr3Json(report),
    );
    const artifactSha = sha256(artifactBytes);
    if (
      canonicalPhase698RetrieverSchemaRecoverySr3Json(artifact) !==
        canonicalPhase698RetrieverSchemaRecoverySr3Json(expected) ||
      artifact.reportLogicalSha256 !== reportSha ||
      replay.publicationStarted.reportSha256 !== reportSha ||
      replay.published.artifactSha256 !== artifactSha
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    await validateClaim(root, replay);
    await requireOnlyExpectedFiles(root, replay);
    return Object.freeze({
      ok: true as const,
      runId: marker.runId,
      gate: report.gate,
      qualityAuthority: report.qualityAuthority,
      journalRecords: records.length,
      finalJournalEvent: 'evidence_published' as const,
      reportLogicalSha256: reportSha,
      physicalArtifactSha256: artifactSha,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
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
      providerCalls: 0 as const,
      credentialReads: 0 as const,
    });
  }
}

export function sealPhase698RetrieverSchemaRecoverySr3InterruptedAttempt(input: {
  root: string;
}): Promise<Phase698RetrieverSchemaRecoverySr3CrashSealResult> {
  return sealInterrupted(input.root, inspectProcess);
}

/** Synthetic-only process identity seam. */
export function sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest(input: {
  root: string;
  inspectProcess(processId: number): Readonly<{
    alive: boolean;
    startIdentity: string | null;
  }>;
}): Promise<Phase698RetrieverSchemaRecoverySr3CrashSealResult> {
  return sealInterrupted(input.root, (processId) => input.inspectProcess(processId));
}

async function sealInterrupted(
  rootInput: string,
  processInspector: (
    processId: number,
  ) => Readonly<{ alive: boolean; startIdentity: string | null }>,
): Promise<Phase698RetrieverSchemaRecoverySr3CrashSealResult> {
  let root: string;
  let marker: Phase698RetrieverSchemaRecoverySr3Marker;
  let markerBytes: string;
  try {
    root = await requireRoot(rootInput);
    markerBytes = await readRegular(
      resolveRelative(root, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH),
    );
    marker = parseCanonicalLine(
      markerBytes,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_SCHEMA,
    );
  } catch {
    return Object.freeze({ ok: false, code: 'marker_missing_or_invalid' });
  }
  let processState: Readonly<{ alive: boolean; startIdentity: string | null }>;
  try {
    processState = processInspector(marker.creatorPid);
  } catch {
    return Object.freeze({ ok: false, code: 'process_identity_unavailable' });
  }
  if (processState.alive) {
    if (processState.startIdentity === null) {
      return Object.freeze({ ok: false, code: 'process_identity_unavailable' });
    }
    if (normalizeStartIdentity(processState.startIdentity) === marker.creatorStartIdentity) {
      return Object.freeze({ ok: false, code: 'process_active' });
    }
  }

  const markerSha256 = sha256(markerBytes);
  const journalPath = resolveRelative(
    root,
    phase698RetrieverSchemaRecoverySr3JournalRelativePath(marker.runId),
  );
  try {
    const records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    let replay = replayRecords(marker, markerSha256, records);
    if (replay.published) return Object.freeze({ ok: false, code: 'already_published' });
    const claim = await acquireRecoveryClaim(root, replay);
    if (!claim.ok) return Object.freeze({ ok: false, code: 'recovery_claim_invalid' });
    replay = replayRecords(
      marker,
      markerSha256,
      parseJournal(await readRegular(journalPath), marker, markerSha256),
    );
    const state = stateFromReplay(root, journalPath, replay);
    if (state.recoveryClaim === null) {
      await appendRecord(state, 'recovery_claimed', {
        claim: claim.claim,
        claimSha256: claim.claimSha256,
      });
    } else if (state.recoveryClaim.claimSha256 !== claim.claimSha256) {
      return Object.freeze({ ok: false, code: 'recovery_claim_invalid' });
    }
    const hadTerminal = state.terminal !== null;
    if (!state.terminal) await completeRecovery(state);
    if (!state.terminal) return Object.freeze({ ok: false, code: 'journal_invalid' });
    const published = await publishArtifact(state, state.terminal);
    const validation = await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root });
    if (!validation.ok || validation.runId !== marker.runId) {
      return Object.freeze({ ok: false, code: 'publication_invalid' });
    }
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      disposition: hadTerminal ? 'terminal_publication_recovered' : 'crash_only_sealed',
      artifactSha256: published.artifactSha256,
      gate: state.terminal.gate,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'journal_invalid' });
  }
}

function reservationFromState(state: ReservationState, journalRelativePath: string) {
  const lifecycle: Phase698RetrieverSchemaRecoverySr3Lifecycle = Object.freeze({
    runId: state.marker.runId,
    appendGuardTerminal: (entry) => enqueue(state, () => appendGuard(state, entry)),
    reserveLane: (identity) =>
      enqueueResult(state, async () => {
        await reserveLane(state, identity);
        const laneLifecycle: Phase698RetrieverSchemaRecoverySr3LaneLifecycle = Object.freeze({
          appendLaneStage: (stage, preparedSuccess) =>
            enqueue(state, () => appendLaneStage(state, identity, stage, preparedSuccess)),
        });
        return laneLifecycle;
      }),
    appendLaneTerminal: (entry) => enqueue(state, () => appendLaneTerminal(state, entry)),
    appendRunTerminal: (report) =>
      enqueue(state, () => appendRunTerminal(state, report, 'runtime')),
  });
  return Object.freeze({
    runId: state.marker.runId,
    markerRelativePath: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH,
    journalRelativePath,
    lifecycle,
    publishArtifact: (report: Phase698RetrieverSchemaRecoverySr3Report) =>
      enqueueResult(state, () => publishArtifact(state, report)),
  });
}

async function appendGuard(
  state: ReservationState,
  input: Phase698RetrieverSchemaRecoverySr3GuardEntry,
) {
  const entry = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA.parse(input);
  await appendRecord(state, 'guard_terminal', { entry });
}

async function reserveLane(
  state: ReservationState,
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
) {
  await appendRecord(state, 'lane_reserved', { identity });
}

async function appendLaneStage(
  state: ReservationState,
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  stage: Phase698RetrieverSchemaRecoverySr3LaneStage,
  preparedSuccess?: Phase698RetrieverSchemaRecoverySr3LaneEntry,
) {
  await appendRecord(state, 'lane_stage', {
    identity,
    stage,
    preparedSuccess:
      preparedSuccess === undefined
        ? null
        : PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse(preparedSuccess),
  });
}

async function appendLaneTerminal(
  state: ReservationState,
  input: Phase698RetrieverSchemaRecoverySr3LaneEntry,
) {
  const entry = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse(input);
  await appendRecord(state, 'lane_terminal', { entry });
}

async function appendRunTerminal(
  state: ReservationState,
  input: Phase698RetrieverSchemaRecoverySr3Report,
  completionMode: 'runtime' | 'recovery',
) {
  const parsed = parsePhase698RetrieverSchemaRecoverySr3Report(input);
  if (!parsed || parsed.completionMode !== completionMode) throw new Error(DURABILITY_ERROR);
  const recomputed = recomputeReport(state, completionMode);
  if (
    canonicalPhase698RetrieverSchemaRecoverySr3Json(parsed) !==
    canonicalPhase698RetrieverSchemaRecoverySr3Json(recomputed)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, 'run_terminal', { report: parsed });
}

async function publishArtifact(
  state: ReservationState,
  reportInput: Phase698RetrieverSchemaRecoverySr3Report,
) {
  const report = parsePhase698RetrieverSchemaRecoverySr3Report(reportInput);
  if (!report || !state.terminal) throw new Error(DURABILITY_ERROR);
  if (
    canonicalPhase698RetrieverSchemaRecoverySr3Json(report) !==
    canonicalPhase698RetrieverSchemaRecoverySr3Json(state.terminal)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  const reportSha256 = sha256Phase698RetrieverSchemaRecoverySr3(
    canonicalPhase698RetrieverSchemaRecoverySr3Json(report),
  );
  const reportRelativePath = phase698RetrieverSchemaRecoverySr3ReportRelativePath(
    state.marker.runId,
  );
  const artifactRelativePath = phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(
    state.marker.runId,
  );
  const reportPath = resolveRelative(state.root, reportRelativePath);
  const artifactPath = resolveRelative(state.root, artifactRelativePath);
  if (state.published) {
    const bytes = await readRegular(artifactPath);
    if (sha256(bytes) !== state.published.artifactSha256) throw new Error(DURABILITY_ERROR);
    return Object.freeze({ artifactRelativePath, artifactSha256: state.published.artifactSha256 });
  }
  if (!state.publicationStarted) {
    await appendRecord(state, 'publication_started', {
      reportSha256,
      artifactRelativePath,
      journalTerminalHash: state.previousHash,
    });
  } else if (
    state.publicationStarted.reportSha256 !== reportSha256 ||
    state.publicationStarted.artifactRelativePath !== artifactRelativePath
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  const artifact = buildArtifact(state, report);
  const bytes = canonicalLine(artifact);
  if (await pathExists(reportPath)) {
    if ((await readRegular(reportPath)) !== bytes) throw new Error(DURABILITY_ERROR);
  } else {
    await writeExclusive(reportPath, bytes);
    await syncDirectory(dirname(reportPath));
  }
  if (await pathExists(artifactPath)) {
    if ((await readRegular(artifactPath)) !== bytes) throw new Error(DURABILITY_ERROR);
    await assertHardLink(reportPath, artifactPath);
  } else {
    await link(reportPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
    await assertHardLink(reportPath, artifactPath);
  }
  const artifactSha256 = sha256(bytes);
  await appendRecord(state, 'evidence_published', { artifactSha256 });
  return Object.freeze({ artifactRelativePath, artifactSha256 });
}

function buildArtifact(
  state: ReplayState,
  report: Phase698RetrieverSchemaRecoverySr3Report,
): Phase698RetrieverSchemaRecoverySr3Artifact {
  if (!state.publicationStarted) throw new Error(DURABILITY_ERROR);
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_SCHEMA.parse({
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_ARTIFACT_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
    runId: state.marker.runId,
    reportLogicalSha256: sha256Phase698RetrieverSchemaRecoverySr3(
      canonicalPhase698RetrieverSchemaRecoverySr3Json(report),
    ),
    durability: {
      markerSha256: state.markerSha256,
      journalTerminalHash: state.publicationStarted.journalTerminalHash,
      hardLink: true,
      rawDataRetained: false,
      providerCalls: 0,
      credentialReads: 0,
      businessWrites: 0,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
    },
    report,
  });
}

async function completeRecovery(state: ReservationState) {
  while (state.guards.length < 8) {
    const testCase =
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.guardCases[state.guards.length];
    if (!testCase) throw new Error(DURABILITY_ERROR);
    await appendGuard(
      state,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA.parse({
        kind: 'guard',
        caseId: testCase.caseId,
        disposition: 'failed',
        observedReasonCode: 'recovery_incomplete',
        expectedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      }),
    );
  }
  if (state.activeLane) {
    const entry = recoveryLaneFromActive(state);
    await appendLaneTerminal(state, entry);
  }
  const schedule = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule();
  while (state.lanes.length < schedule.length) {
    const identity = schedule[state.lanes.length];
    if (!identity) throw new Error(DURABILITY_ERROR);
    await appendLaneTerminal(state, recoveryNotStarted(identity));
  }
  const report = recomputeReport(state, 'recovery');
  await appendRunTerminal(state, report, 'recovery');
}

function recoveryLaneFromActive(state: ReplayState) {
  if (!state.activeLane) throw new Error(DURABILITY_ERROR);
  if (state.preparedSuccess) return state.preparedSuccess;
  const dispatches = state.activeStages.includes('dispatch_started') ? 1 : 0;
  const responses = state.activeStages.includes('response_observed') ? 1 : 0;
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse({
    kind: 'candidate_lane',
    ...state.activeLane,
    transportAuthority: 'synthetic_injected',
    disposition: 'aborted',
    failureReason: 'aborted',
    wire: { reservations: 1, dispatches, responses, verifiedUsage: 0 },
    schemaStage: null,
    schemaDisposition: null,
    schemaDiagnostic: null,
    usage: null,
    verifiedCostCny: null,
    durationMs: 0,
    resultDigest: null,
  });
}

function recoveryNotStarted(identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity) {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse({
    kind: 'candidate_lane',
    ...identity,
    transportAuthority: 'synthetic_injected',
    disposition: 'not_started_quality_breaker',
    failureReason: 'quality_breaker',
    wire: { reservations: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    schemaStage: null,
    schemaDisposition: null,
    schemaDiagnostic: null,
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
    resultDigest: null,
  });
}

function recomputeReport(state: ReplayState, completionMode: 'runtime' | 'recovery') {
  return buildPhase698RetrieverSchemaRecoverySr3Report({
    runId: state.marker.runId,
    completionMode,
    runMode: completionMode === 'runtime' ? 'reviewed_mock' : 'synthetic_fault',
    source: state.marker.source,
    guardEntries: state.guards,
    laneEntries: state.lanes,
  });
}

async function acquireRecoveryClaim(
  root: string,
  replay: ReplayState,
): Promise<
  Readonly<{ ok: true; claim: RecoveryClaim; claimSha256: string }> | Readonly<{ ok: false }>
> {
  const path = resolveRelative(
    root,
    phase698RetrieverSchemaRecoverySr3RecoveryClaimRelativePath(replay.marker.runId),
  );
  if (await pathExists(path)) {
    try {
      const bytes = await readRegular(path);
      const claim = parseCanonicalLine(
        bytes,
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA,
      );
      const claimSha256 = sha256(bytes);
      if (
        claim.runId !== replay.marker.runId ||
        claim.markerSha256 !== replay.markerSha256 ||
        (replay.recoveryClaim !== null && replay.recoveryClaim.claimSha256 !== claimSha256)
      ) {
        return Object.freeze({ ok: false as const });
      }
      return Object.freeze({ ok: true as const, claim, claimSha256 });
    } catch {
      return Object.freeze({ ok: false as const });
    }
  }
  if (replay.recoveryClaim !== null) return Object.freeze({ ok: false as const });
  const claim = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA.parse({
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
    runId: replay.marker.runId,
    markerSha256: replay.markerSha256,
    claimedAt: new Date().toISOString(),
    recoveryId: randomUUID(),
    providerCalls: 0,
    credentialReads: 0,
    retry: false,
    replay: false,
  });
  const bytes = canonicalLine(claim);
  try {
    await writeExclusive(path, bytes);
    await syncDirectory(dirname(path));
    return Object.freeze({ ok: true as const, claim, claimSha256: sha256(bytes) });
  } catch {
    return Object.freeze({ ok: false as const });
  }
}

async function validateClaim(root: string, replay: ReplayState) {
  const path = resolveRelative(
    root,
    phase698RetrieverSchemaRecoverySr3RecoveryClaimRelativePath(replay.marker.runId),
  );
  if (replay.recoveryClaim === null) {
    if (await pathExists(path)) throw new Error(DURABILITY_ERROR);
    return;
  }
  const bytes = await readRegular(path);
  const claim = parseCanonicalLine(bytes, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA);
  if (
    sha256(bytes) !== replay.recoveryClaim.claimSha256 ||
    canonicalPhase698RetrieverSchemaRecoverySr3Json(claim) !==
      canonicalPhase698RetrieverSchemaRecoverySr3Json(replay.recoveryClaim.claim)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

function nextRecord(
  state: ReplayState,
  event: Phase698RetrieverSchemaRecoverySr3JournalRecord['event'],
  payload: unknown,
) {
  const withoutHash = {
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LINEAGE,
    runId: state.marker.runId,
    sequence: state.sequence + 1,
    previousHash: state.previousHash,
    event,
    at: new Date().toISOString(),
    payload,
  };
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_RECORD_SCHEMA.parse({
    ...withoutHash,
    recordHash: sha256(canonicalPhase698RetrieverSchemaRecoverySr3Json(withoutHash)),
  });
}

async function appendRecord(
  state: ReservationState,
  event: Phase698RetrieverSchemaRecoverySr3JournalRecord['event'],
  payload: unknown,
) {
  const preview = cloneReplay(state);
  const record = nextRecord(preview, event, payload);
  applyRecord(preview, record);
  await appendRegular(state.journalPath, canonicalLine(record));
  applyRecord(state, record);
}

function parseJournal(
  bytes: string,
  marker: Phase698RetrieverSchemaRecoverySr3Marker,
  markerSha256: string,
) {
  if (!bytes.endsWith('\n') || bytes.includes('\r') || bytes.length > MAX_FILE_BYTES) {
    throw new Error(DURABILITY_ERROR);
  }
  const lines = bytes.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0))
    throw new Error(DURABILITY_ERROR);
  const records = lines.map((line) => {
    const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_JOURNAL_RECORD_SCHEMA.parse(
      JSON.parse(line),
    );
    if (line !== canonicalPhase698RetrieverSchemaRecoverySr3Json(parsed)) {
      throw new Error(DURABILITY_ERROR);
    }
    return parsed;
  });
  let previous = markerSha256;
  records.forEach((record, index) => {
    const { recordHash, ...withoutHash } = record;
    if (
      record.runId !== marker.runId ||
      record.sequence !== index + 1 ||
      record.previousHash !== previous ||
      recordHash !== sha256(canonicalPhase698RetrieverSchemaRecoverySr3Json(withoutHash))
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    previous = recordHash;
  });
  return records;
}

function replayRecords(
  marker: Phase698RetrieverSchemaRecoverySr3Marker,
  markerSha256: string,
  records: readonly Phase698RetrieverSchemaRecoverySr3JournalRecord[],
) {
  const state = createReplay(marker, markerSha256);
  for (const record of records) applyRecord(state, record);
  return state;
}

function applyRecord(state: ReplayState, record: Phase698RetrieverSchemaRecoverySr3JournalRecord) {
  if (record.sequence !== state.sequence + 1 || record.previousHash !== state.previousHash) {
    throw new Error(DURABILITY_ERROR);
  }
  switch (record.event) {
    case 'attempt_reserved': {
      const payload = parsePayload(record.payload, {
        markerSha256: SHA256,
        sourceBundleSha256: SHA256,
      });
      if (
        state.attemptReserved ||
        record.sequence !== 1 ||
        payload.markerSha256 !== state.markerSha256 ||
        payload.sourceBundleSha256 !== state.marker.source.sourceBundleSha256
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.attemptReserved = true;
      break;
    }
    case 'guard_terminal': {
      const payload = parsePayload(record.payload, {
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA,
      });
      if (!state.attemptReserved || state.activeLane || state.lanes.length > 0 || state.terminal) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected =
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.guardCases[state.guards.length];
      if (!expected || payload.entry.caseId !== expected.caseId) throw new Error(DURABILITY_ERROR);
      state.guards.push(payload.entry);
      break;
    }
    case 'lane_reserved': {
      const payload = parsePayload(record.payload, { identity: identitySchema() });
      const expected = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()[state.lanes.length];
      if (
        state.guards.length !== 8 ||
        state.activeLane ||
        state.terminal ||
        !expected ||
        canonicalPhase698RetrieverSchemaRecoverySr3Json(payload.identity) !==
          canonicalPhase698RetrieverSchemaRecoverySr3Json(expected)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.activeLane = payload.identity;
      state.activeStages = [];
      state.preparedSuccess = null;
      break;
    }
    case 'lane_stage': {
      const payload = parsePayload(record.payload, {
        identity: identitySchema(),
        stage: z.enum(['dispatch_started', 'response_observed', 'usage_verified']),
        preparedSuccess: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.nullable(),
      });
      const expectedStage = ['dispatch_started', 'response_observed', 'usage_verified'][
        state.activeStages.length
      ];
      if (
        !state.activeLane ||
        state.terminal ||
        payload.stage !== expectedStage ||
        canonicalPhase698RetrieverSchemaRecoverySr3Json(payload.identity) !==
          canonicalPhase698RetrieverSchemaRecoverySr3Json(state.activeLane) ||
        (payload.stage === 'usage_verified') !== (payload.preparedSuccess !== null)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      if (payload.preparedSuccess !== null && payload.preparedSuccess.disposition !== 'succeeded') {
        throw new Error(DURABILITY_ERROR);
      }
      state.activeStages.push(payload.stage);
      state.preparedSuccess = payload.preparedSuccess;
      break;
    }
    case 'lane_terminal': {
      const payload = parsePayload(record.payload, {
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA,
      });
      const expected = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()[state.lanes.length];
      if (!expected || state.terminal || payload.entry.laneId !== expected.laneId) {
        throw new Error(DURABILITY_ERROR);
      }
      if (payload.entry.disposition.startsWith('not_started_')) {
        if (state.activeLane !== null) throw new Error(DURABILITY_ERROR);
      } else {
        if (!state.activeLane || payload.entry.laneId !== state.activeLane.laneId) {
          throw new Error(DURABILITY_ERROR);
        }
        if (
          payload.entry.disposition === 'succeeded' &&
          (!state.preparedSuccess ||
            canonicalPhase698RetrieverSchemaRecoverySr3Json(payload.entry) !==
              canonicalPhase698RetrieverSchemaRecoverySr3Json(state.preparedSuccess))
        ) {
          throw new Error(DURABILITY_ERROR);
        }
      }
      state.lanes.push(payload.entry);
      state.activeLane = null;
      state.activeStages = [];
      state.preparedSuccess = null;
      break;
    }
    case 'recovery_claimed': {
      const payload = parsePayload(record.payload, {
        claim: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLAIM_SCHEMA,
        claimSha256: SHA256,
      });
      if (
        state.recoveryClaim !== null ||
        state.published !== null ||
        payload.claim.runId !== state.marker.runId ||
        payload.claim.markerSha256 !== state.markerSha256 ||
        sha256(canonicalLine(payload.claim)) !== payload.claimSha256
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.recoveryClaim = payload;
      break;
    }
    case 'run_terminal': {
      const payload = parsePayload(record.payload, {
        report: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA,
      });
      if (
        state.terminal ||
        state.activeLane ||
        state.guards.length !== 8 ||
        state.lanes.length !== 12
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      const parsed = parsePhase698RetrieverSchemaRecoverySr3Report(payload.report);
      if (!parsed) throw new Error(DURABILITY_ERROR);
      const recomputed = recomputeReport(state, parsed.completionMode);
      if (
        canonicalPhase698RetrieverSchemaRecoverySr3Json(parsed) !==
        canonicalPhase698RetrieverSchemaRecoverySr3Json(recomputed)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.terminal = parsed;
      break;
    }
    case 'publication_started': {
      const payload = parsePayload(record.payload, {
        reportSha256: SHA256,
        artifactRelativePath: z.string(),
        journalTerminalHash: SHA256,
      });
      if (
        !state.terminal ||
        state.publicationStarted ||
        payload.artifactRelativePath !==
          phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(state.marker.runId) ||
        payload.reportSha256 !==
          sha256Phase698RetrieverSchemaRecoverySr3(
            canonicalPhase698RetrieverSchemaRecoverySr3Json(state.terminal),
          )
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.publicationStarted = payload;
      break;
    }
    case 'evidence_published': {
      const payload = parsePayload(record.payload, { artifactSha256: SHA256 });
      if (!state.publicationStarted || state.published) throw new Error(DURABILITY_ERROR);
      state.published = payload;
      break;
    }
  }
  state.sequence = record.sequence;
  state.previousHash = record.recordHash;
}

function parsePayload<T extends z.ZodRawShape>(value: unknown, shape: T): z.infer<z.ZodObject<T>> {
  return z.object(shape).strict().parse(value);
}

function identitySchema() {
  return z
    .object({
      laneId: z.string(),
      caseId: z.string(),
      phase: z.enum(['rewrite_candidate_model', 'final_response_model']),
    })
    .strict();
}

function createReplay(
  marker: Phase698RetrieverSchemaRecoverySr3Marker,
  markerSha256: string,
): ReplayState {
  return {
    marker,
    markerSha256,
    sequence: 0,
    previousHash: markerSha256,
    attemptReserved: false,
    guards: [],
    lanes: [],
    activeLane: null,
    activeStages: [],
    preparedSuccess: null,
    recoveryClaim: null,
    terminal: null,
    publicationStarted: null,
    published: null,
  };
}

function createReservationState(
  root: string,
  journalPath: string,
  marker: Phase698RetrieverSchemaRecoverySr3Marker,
  markerSha256: string,
): ReservationState {
  return {
    ...createReplay(marker, markerSha256),
    root,
    journalPath,
    queue: Promise.resolve(),
    failed: false,
  };
}

function stateFromReplay(root: string, journalPath: string, replay: ReplayState): ReservationState {
  return {
    ...cloneReplay(replay),
    root,
    journalPath,
    queue: Promise.resolve(),
    failed: false,
  };
}

function cloneReplay(state: ReplayState): ReplayState {
  return {
    marker: state.marker,
    markerSha256: state.markerSha256,
    sequence: state.sequence,
    previousHash: state.previousHash,
    attemptReserved: state.attemptReserved,
    guards: [...state.guards],
    lanes: [...state.lanes],
    activeLane: state.activeLane,
    activeStages: [...state.activeStages],
    preparedSuccess: state.preparedSuccess,
    recoveryClaim: state.recoveryClaim,
    terminal: state.terminal,
    publicationStarted: state.publicationStarted,
    published: state.published,
  };
}

async function requireOnlyExpectedFiles(root: string, replay: ReplayState) {
  const expected = new Set([
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MARKER_RELATIVE_PATH,
    phase698RetrieverSchemaRecoverySr3JournalRelativePath(replay.marker.runId),
    phase698RetrieverSchemaRecoverySr3ReportRelativePath(replay.marker.runId),
    phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(replay.marker.runId),
    ...(replay.recoveryClaim
      ? [phase698RetrieverSchemaRecoverySr3RecoveryClaimRelativePath(replay.marker.runId)]
      : []),
  ]);
  const observed = new Set(await formalFiles(root));
  if (expected.size !== observed.size || [...expected].some((path) => !observed.has(path))) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function formalFiles(root: string) {
  const results: string[] = [];
  for (const [directory, prefix] of [
    [resolveRelative(root, '.tmp'), '.tmp/'],
    [root, ''],
  ] as const) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (prefix === '.tmp/' && isErrorCode(error, 'ENOENT')) continue;
      throw error;
    }
    for (const entry of entries) {
      if (FORMAL_BASENAME.test(entry.name)) results.push(`${prefix}${entry.name}`);
    }
  }
  return results.sort();
}

function enqueue(state: ReservationState, operation: () => Promise<void>) {
  return enqueueResult(state, operation);
}

async function enqueueResult<T>(state: ReservationState, operation: () => Promise<T>): Promise<T> {
  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise;
    rejectResult = rejectPromise;
  });
  state.queue = state.queue.then(async () => {
    if (state.failed) {
      rejectResult(new Error(DURABILITY_ERROR));
      return;
    }
    try {
      resolveResult(await operation());
    } catch (error) {
      state.failed = true;
      rejectResult(error);
    }
  });
  await state.queue;
  return result;
}

async function requireRoot(rootInput: string) {
  if (typeof rootInput !== 'string' || rootInput.length === 0) throw new Error(DURABILITY_ERROR);
  const root = await realpath(resolve(rootInput));
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(DURABILITY_ERROR);
  return root;
}

async function ensureTmp(root: string) {
  const path = resolveRelative(root, '.tmp');
  await mkdir(path, { recursive: true, mode: 0o700 });
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(DURABILITY_ERROR);
}

function resolveRelative(root: string, relativePath: string) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    relativePath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  const path = resolve(root, relativePath);
  const observed = relative(root, path);
  if (observed.startsWith('..') || resolve(root, observed) !== path)
    throw new Error(DURABILITY_ERROR);
  return path;
}

async function writeExclusive(path: string, bytes: string) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function appendRegular(path: string, bytes: string) {
  const handle = await open(path, fsConstants.O_WRONLY | fsConstants.O_APPEND);
  try {
    const metadata = await assertOpenedRegular(path, handle);
    if (
      metadata.size > MAX_FILE_BYTES ||
      metadata.size + Buffer.byteLength(bytes) > MAX_FILE_BYTES
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readRegular(path: string) {
  const handle = await open(path, fsConstants.O_RDONLY);
  try {
    const metadata = await assertOpenedRegular(path, handle);
    if (metadata.size > MAX_FILE_BYTES) throw new Error(DURABILITY_ERROR);
    return await handle.readFile('utf8');
  } finally {
    await handle.close();
  }
}

async function assertOpenedRegular(path: string, handle: Awaited<ReturnType<typeof open>>) {
  const [opened, current] = await Promise.all([handle.stat(), lstat(path)]);
  if (
    !opened.isFile() ||
    !current.isFile() ||
    current.isSymbolicLink() ||
    opened.dev !== current.dev ||
    opened.ino !== current.ino
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  return opened;
}

async function syncDirectory(path: string) {
  const handle = await open(path, 'r');
  try {
    try {
      await handle.sync();
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        (!isErrorCode(error, 'EPERM') && !isErrorCode(error, 'EINVAL'))
      ) {
        throw error;
      }
    }
  } finally {
    await handle.close();
  }
}

async function assertHardLink(source: string, target: string) {
  const [left, right] = await Promise.all([
    stat(source, { bigint: true }),
    stat(target, { bigint: true }),
  ]);
  if (!left.isFile() || !right.isFile() || left.dev !== right.dev || left.ino !== right.ino) {
    throw new Error(DURABILITY_ERROR);
  }
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

function canonicalLine(value: unknown) {
  return `${canonicalPhase698RetrieverSchemaRecoverySr3Json(value)}\n`;
}

function parseCanonicalLine<T>(bytes: string, schema: z.ZodType<T>): T {
  if (!bytes.endsWith('\n') || bytes.includes('\r') || bytes.slice(0, -1).includes('\n')) {
    throw new Error(DURABILITY_ERROR);
  }
  const parsed = schema.parse(JSON.parse(bytes));
  if (bytes !== canonicalLine(parsed)) throw new Error(DURABILITY_ERROR);
  return parsed;
}

function currentProcessStartIdentity() {
  return `pid=${process.pid};started=${Math.floor(Date.now() - process.uptime() * 1_000)}`;
}

function normalizeStartIdentity(value: string) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) {
    throw new Error(DURABILITY_ERROR);
  }
  return `sha256:${sha256(value)}`;
}

function inspectProcess(processId: number) {
  try {
    process.kill(processId, 0);
    return Object.freeze({
      alive: true,
      startIdentity: processId === process.pid ? currentProcessStartIdentity() : null,
    });
  } catch (error) {
    if (isErrorCode(error, 'EPERM')) {
      return Object.freeze({ alive: true, startIdentity: null });
    }
    return Object.freeze({ alive: false, startIdentity: null });
  }
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

export function phase698RetrieverSchemaRecoverySr3JournalRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.journal.jsonl`;
}

export function phase698RetrieverSchemaRecoverySr3ReportRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.report.json`;
}

export function phase698RetrieverSchemaRecoverySr3RecoveryClaimRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.recovery.claim`;
}

export function phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(runId: string) {
  UUID.parse(runId);
  return `phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.json`;
}

/** Test-only cleanup for isolated temporary roots. Never use on repository evidence. */
export async function removePhase698RetrieverSchemaRecoverySr3TempRootForTest(root: string) {
  const resolved = await requireRoot(root);
  const formal = await formalFiles(resolved);
  for (const relativePath of formal) {
    await unlink(resolveRelative(resolved, relativePath));
  }
}
