import { randomUUID } from 'node:crypto';
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { z } from 'zod';

import {
  canonicalPhase698P1L2Json,
  PHASE_6_9_8_P1_L2_ARTIFACT_PREFIX,
  PHASE_6_9_8_P1_L2_ARTIFACT_SCHEMA,
  PHASE_6_9_8_P1_L2_ARTIFACT_VERSION,
  PHASE_6_9_8_P1_L2_AUTHORITY,
  PHASE_6_9_8_P1_L2_DURABILITY_VERSION,
  PHASE_6_9_8_P1_L2_JOURNAL_SCHEMA,
  PHASE_6_9_8_P1_L2_JOURNAL_VERSION,
  PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA,
  PHASE_6_9_8_P1_L2_LANE_ORDER,
  PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH,
  PHASE_6_9_8_P1_L2_MARKER_SCHEMA,
  PHASE_6_9_8_P1_L2_MARKER_VERSION,
  PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH,
  PHASE_6_9_8_P1_L2_REPORT_SCHEMA,
  PHASE_6_9_8_P1_L2_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH,
  PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH,
  scorePhase698P1L2,
  sha256Phase698P1L2,
  type Phase698P1L2Artifact,
  type Phase698P1L2JournalRecord,
  type Phase698P1L2LaneId,
  type Phase698P1L2LaneTerminal,
  type Phase698P1L2Marker,
  type Phase698P1L2Report,
  type Phase698P1L2Source,
  isPhase698P1L2FormalRelativePath,
} from './phase-6-9-8-retriever-final-response-p1-l2-contract.ts';
import { PHASE_6_9_8_P1_L2_LINEAGE } from './phase-6-9-8-retriever-final-response-p1-l2-admission.ts';
import { PHASE_6_9_8_P1_MANIFEST } from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import type { Phase698P1L2Lifecycle } from './phase-6-9-8-retriever-final-response-p1-l2-runner.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';

const ROOT_PREFIX = 'prepmind-p1-l2-';
const ERROR_CODE = 'PHASE_6_9_8_P1_L2_DURABILITY_INVALID';
const CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_P1_L2_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
    runId: z.string().uuid(),
    markerSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    journalTailRecordHash: z.string().regex(/^[0-9a-f]{64}$/u),
    state: z.literal('crash_only_recovery_claimed'),
  })
  .strict();

type State = {
  root: string;
  runId: string;
  marker: Phase698P1L2Marker;
  markerBytes: string;
  markerSha256: string;
  journalPath: string;
  records: Phase698P1L2JournalRecord[];
  laneEvents: Map<Phase698P1L2LaneId, Set<string>>;
  laneTerminals: Map<Phase698P1L2LaneId, Phase698P1L2LaneTerminal>;
  guardEntries: Phase698P1L2Report['guardEntries'];
  report: Phase698P1L2Report | null;
  queue: Promise<void>;
};

export type Phase698P1L2Reservation = Readonly<{
  runId: string;
  lifecycle: Phase698P1L2Lifecycle;
  publishArtifact(
    report: Phase698P1L2Report,
    options?: Readonly<{ mode?: 'runtime' | 'recovery' }>,
  ): Promise<Readonly<{ evidenceSha256: string; relativePath: string }>>;
}>;
export type Phase698P1L2Validation = Readonly<{
  ok: boolean;
  runId: string | null;
  gate: 'p1_l2_semantic_gate_passed' | 'p1_l2_quality_gate_failed' | null;
  qualityAuthority: 'p1_semantic_gate' | 'none' | null;
  finalJournalEvent: 'evidence_published' | null;
  journalRecords: number;
  reportLogicalSha256: string | null;
  physicalArtifactSha256: string | null;
  providerCalls: number;
  credentialReads: number;
  formalEvidence: 0 | 1;
}>;
export type Phase698P1L2RecoveryResult = Readonly<
  | {
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
    }
  | {
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'journal_invalid'
        | 'publication_invalid'
        | 'already_published';
    }
>;

export async function createPhase698P1L2SyntheticRootForTest(): Promise<string> {
  return mkdtemp(join(tmpdir(), ROOT_PREFIX));
}
export async function removePhase698P1L2SyntheticRootForTest(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export async function reservePhase698P1L2Attempt(input: {
  root: string;
  runId?: string;
  createdAt?: string;
  source: Phase698P1L2Source;
}): Promise<Phase698P1L2Reservation> {
  const root = await containedRoot(input.root);
  const runId = z
    .string()
    .uuid()
    .parse(input.runId ?? randomUUID());
  const createdAt = z
    .string()
    .datetime({ offset: true })
    .parse(input.createdAt ?? new Date().toISOString());
  if (input.source.mode !== 'controlled_live') throw new Error('PHASE_6_9_8_P1_L2_LIVE_REQUIRED');
  await mkdir(join(root, '.tmp'), { recursive: true });
  await assertNoFormalFiles(root);
  const marker = PHASE_6_9_8_P1_L2_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_P1_L2_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_P1_L2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId,
    authority: PHASE_6_9_8_P1_L2_AUTHORITY,
    qualityAuthority: 'none',
    plannedGuards: 8,
    plannedLanes: 12,
    candidateInvocationCap: 12,
    source: input.source,
    creatorPid: process.pid,
    createdAt,
  });
  const markerBytes = `${canonicalPhase698P1L2Json(marker)}\n`;
  const markerPath = contained(root, PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH);
  await writeExclusive(markerPath, markerBytes);
  await syncPath(markerPath);
  const state: State = {
    root,
    runId,
    marker,
    markerBytes,
    markerSha256: sha256Phase698P1L2(markerBytes),
    journalPath: contained(root, fill(PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH, runId)),
    records: [],
    laneEvents: new Map(),
    laneTerminals: new Map(),
    guardEntries: [],
    report: null,
    queue: Promise.resolve(),
  };
  await appendRecord(state, nextRecord(state, { event: 'attempt_reserved', createdAt }));
  return reservationFromState(state);
}

export async function validatePhase698P1L2Bundle(input: {
  root: string;
}): Promise<Phase698P1L2Validation> {
  try {
    const root = await containedRoot(input.root);
    const markerPath = contained(root, PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH);
    const markerBytes = await readRegular(markerPath);
    const marker = PHASE_6_9_8_P1_L2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonicalPhase698P1L2Json(marker)}\n`) throw new Error(ERROR_CODE);
    const records = await readJournal(root, marker, true);
    const terminal = records.find((entry) => entry.event === 'run_terminal');
    const publication = records.find((entry) => entry.event === 'publication_started');
    const published = records.find((entry) => entry.event === 'evidence_published');
    if (!terminal || !publication || !published) throw new Error(ERROR_CODE);
    const reportPath = contained(root, fill(PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH, marker.runId));
    const reportBytes = await readRegular(reportPath);
    const report = PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    const reportCanonical = `${canonicalPhase698P1L2Json(report)}\n`;
    const reportHash = sha256Phase698P1L2(canonicalPhase698P1L2Json(report));
    if (
      reportBytes !== reportCanonical ||
      terminal.reportSha256 !== reportHash ||
      publication.reportSha256 !== reportHash ||
      canonicalPhase698P1L2Json(report.source) !== canonicalPhase698P1L2Json(marker.source)
    )
      throw new Error(ERROR_CODE);
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const gate = scorePhase698P1L2(report, baseline);
    const artifactPath = contained(root, artifactPathFor(marker.runId));
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_P1_L2_ARTIFACT_SCHEMA.parse(JSON.parse(artifactBytes));
    const artifactHash = sha256Phase698P1L2(artifactBytes);
    if (
      artifactBytes !== `${canonicalPhase698P1L2Json(artifact)}\n` ||
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== sha256Phase698P1L2(markerBytes) ||
      artifact.reportLogicalSha256 !== reportHash ||
      canonicalPhase698P1L2Json(artifact.report) !== canonicalPhase698P1L2Json(report) ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publication.sequence ||
      published.evidenceSha256 !== artifactHash ||
      artifact.durability.recoveryClaimSha256 !== recoveryClaimHash(records)
    )
      throw new Error(ERROR_CODE);
    const claimRecord = records.find((entry) => entry.event === 'recovery_claimed');
    if ((report.formalEvidence.recoveryClaimCount === 1) !== Boolean(claimRecord))
      throw new Error(ERROR_CODE);
    if (claimRecord) {
      const claimBytes = await readRegular(
        contained(root, fill(PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH, marker.runId)),
      );
      const claim = CLAIM_SCHEMA.parse(JSON.parse(claimBytes));
      if (
        claimBytes !== `${canonicalPhase698P1L2Json(claim)}\n` ||
        claim.runId !== marker.runId ||
        claim.markerSha256 !== sha256Phase698P1L2(markerBytes) ||
        claim.journalTailRecordHash !== claimRecord.previousHash ||
        claimRecord.claimSha256 !== sha256Phase698P1L2(claimBytes)
      )
        throw new Error(ERROR_CODE);
    }
    await assertOnlyExpectedFiles(root, marker.runId, Boolean(claimRecord));
    if (!(await lstat(artifactPath)).isFile()) throw new Error(ERROR_CODE);
    return {
      ok: true,
      runId: marker.runId,
      gate: gate.passed ? 'p1_l2_semantic_gate_passed' : 'p1_l2_quality_gate_failed',
      qualityAuthority: gate.qualityAuthority,
      finalJournalEvent: 'evidence_published',
      journalRecords: records.length,
      reportLogicalSha256: reportHash,
      physicalArtifactSha256: artifactHash,
      providerCalls: report.execution.providerCalls,
      credentialReads: report.execution.credentialReads,
      formalEvidence: 1,
    };
  } catch {
    return {
      ok: false,
      runId: null,
      gate: null,
      qualityAuthority: null,
      finalJournalEvent: null,
      journalRecords: 0,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
    };
  }
}

export async function recoverPhase698P1L2InterruptedAttempt(input: {
  root: string;
  isProcessAlive: (pid: number) => boolean;
}): Promise<Phase698P1L2RecoveryResult> {
  let root: string;
  let marker: Phase698P1L2Marker;
  let markerBytes: string;
  try {
    root = await containedRoot(input.root);
    markerBytes = await readRegular(contained(root, PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH));
    marker = PHASE_6_9_8_P1_L2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonicalPhase698P1L2Json(marker)}\n`) throw new Error(ERROR_CODE);
  } catch {
    return { ok: false, code: 'marker_missing_or_invalid' };
  }
  if (input.isProcessAlive(marker.creatorPid)) return { ok: false, code: 'process_active' };
  try {
    const records = await readJournal(root, marker, false);
    if (records.some((entry) => entry.event === 'evidence_published'))
      return { ok: false, code: 'already_published' };
    const state = replayState(root, marker, markerBytes, records);
    const hadTerminal = records.some((entry) => entry.event === 'run_terminal');
    if (hadTerminal) await hydrateTerminalReport(state);
    if (!state.report) {
      const report = await buildRecoveryReport(state);
      await appendRunTerminal(state, report);
    }
    if (!state.report) return { ok: false, code: 'journal_invalid' };
    if (state.report.formalEvidence.recoveryClaimCount === 1) await appendRecoveryClaim(state);
    const published = await publishStateArtifact(state, state.report, { mode: 'recovery' });
    const validation = await validatePhase698P1L2Bundle({ root });
    if (!validation.ok) return { ok: false, code: 'publication_invalid' };
    return {
      ok: true,
      runId: marker.runId,
      disposition: records.some((entry) => entry.event === 'run_terminal')
        ? 'terminal_publication_recovered'
        : 'crash_only_sealed',
      artifactSha256: published.evidenceSha256,
    };
  } catch {
    return { ok: false, code: 'journal_invalid' };
  }
}
export const sealPhase698P1L2InterruptedAttempt = recoverPhase698P1L2InterruptedAttempt;

function reservationFromState(state: State): Phase698P1L2Reservation {
  const lifecycle: Phase698P1L2Lifecycle = {
    runId: state.runId,
    source: state.marker.source,
    appendGuardTerminal: (entry) =>
      enqueue(state, async () => {
        if (state.guardEntries.length >= 8) throw new Error(ERROR_CODE);
        await appendRecord(state, nextRecord(state, { event: 'guard_terminal', entry }));
        state.guardEntries.push(entry);
      }),
    reserveLane: async (laneId, sequence) => {
      await enqueue(state, async () => {
        if (sequence !== state.laneTerminals.size + 1 || state.laneEvents.has(laneId))
          throw new Error(ERROR_CODE);
        await appendRecord(
          state,
          nextRecord(state, { event: 'lane_reserved', laneId, sequenceInRun: sequence }),
        );
        state.laneEvents.set(laneId, new Set());
      });
      return {
        appendStage: (stage) =>
          enqueue(state, async () => {
            const events = state.laneEvents.get(laneId);
            if (
              !events ||
              events.has(stage) ||
              (stage === 'response_observed' && !events.has('dispatch_started')) ||
              (stage === 'strict_validated' && !events.has('response_observed'))
            )
              throw new Error(ERROR_CODE);
            await appendRecord(state, nextRecord(state, { event: 'lane_stage', laneId, stage }));
            events.add(stage);
          }),
      };
    },
    appendLaneTerminal: (entry) =>
      enqueue(state, async () => {
        if (
          entry.sequence !== state.laneTerminals.size + 1 ||
          state.laneTerminals.has(entry.laneId)
        )
          throw new Error(ERROR_CODE);
        const events = state.laneEvents.get(entry.laneId);
        if (
          !events ||
          (entry.wire.dispatch === 1 && !events.has('dispatch_started')) ||
          (entry.wire.response === 1 && !events.has('response_observed')) ||
          (entry.wire.strictValidated === 1 && !events.has('strict_validated'))
        )
          throw new Error(ERROR_CODE);
        await appendRecord(state, nextRecord(state, { event: 'lane_terminal', entry }));
        state.laneTerminals.set(entry.laneId, entry);
      }),
    appendRunTerminal: (report) => enqueue(state, async () => appendRunTerminal(state, report)),
  };
  return Object.freeze({
    runId: state.runId,
    lifecycle,
    publishArtifact: (report, options) =>
      enqueueResult(state, () => publishStateArtifact(state, report, options)),
  });
}

function nextRecord(state: State, payload: Record<string, unknown>): Phase698P1L2JournalRecord {
  const unsigned = {
    journalVersion: PHASE_6_9_8_P1_L2_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId: state.runId,
    sequence: state.records.length,
    markerSha256: state.markerSha256,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...payload,
  };
  return PHASE_6_9_8_P1_L2_JOURNAL_SCHEMA.parse({
    ...unsigned,
    recordHash: sha256Phase698P1L2(canonicalPhase698P1L2Json(unsigned)),
  });
}
async function appendRecord(state: State, record: Phase698P1L2JournalRecord): Promise<void> {
  const bytes = `${canonicalPhase698P1L2Json(record)}\n`;
  const handle = await open(state.journalPath, 'a');
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(state.journalPath));
  state.records.push(record);
}
async function appendRunTerminal(state: State, report: Phase698P1L2Report): Promise<void> {
  if (state.report || state.records.some((entry) => entry.event === 'run_terminal'))
    throw new Error(ERROR_CODE);
  state.report = report;
  const reportPath = contained(
    state.root,
    fill(PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH, state.runId),
  );
  await writeExclusive(reportPath, `${canonicalPhase698P1L2Json(report)}\n`);
  await syncPath(reportPath);
  await appendRecord(
    state,
    nextRecord(state, {
      event: 'run_terminal',
      reportSha256: sha256Phase698P1L2(canonicalPhase698P1L2Json(report)),
    }),
  );
}

async function appendRecoveryClaim(state: State): Promise<void> {
  if (state.records.some((entry) => entry.event === 'recovery_claimed')) return;
  const tail = state.records.at(-1);
  if (!tail) throw new Error(ERROR_CODE);
  const claimPath = contained(
    state.root,
    fill(PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH, state.runId),
  );
  const claim = CLAIM_SCHEMA.parse({
    version: PHASE_6_9_8_P1_L2_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    journalTailRecordHash: tail.recordHash,
    state: 'crash_only_recovery_claimed',
  });
  const claimBytes = `${canonicalPhase698P1L2Json(claim)}\n`;
  try {
    const existing = await readRegular(claimPath);
    if (existing !== claimBytes) throw new Error(ERROR_CODE);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    await writeExclusive(claimPath, claimBytes);
    await syncPath(claimPath);
  }
  await appendRecord(
    state,
    nextRecord(state, {
      event: 'recovery_claimed',
      claimSha256: sha256Phase698P1L2(claimBytes),
    }),
  );
}

async function hydrateTerminalReport(state: State): Promise<void> {
  const terminal = state.records.find((entry) => entry.event === 'run_terminal');
  if (!terminal) return;
  const reportPath = contained(
    state.root,
    fill(PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH, state.runId),
  );
  const reportBytes = await readRegular(reportPath);
  const report = PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
  if (
    reportBytes !== `${canonicalPhase698P1L2Json(report)}\n` ||
    terminal.reportSha256 !== sha256Phase698P1L2(canonicalPhase698P1L2Json(report)) ||
    canonicalPhase698P1L2Json(report.source) !== canonicalPhase698P1L2Json(state.marker.source)
  )
    throw new Error(ERROR_CODE);
  state.report = report;
}
async function publishStateArtifact(
  state: State,
  report: Phase698P1L2Report,
  options?: Readonly<{ mode?: 'runtime' | 'recovery' }>,
): Promise<{ evidenceSha256: string; relativePath: string }> {
  const parsedReport = PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse(report);
  if (
    !state.report ||
    canonicalPhase698P1L2Json(state.report) !== canonicalPhase698P1L2Json(parsedReport) ||
    canonicalPhase698P1L2Json(parsedReport.source) !==
      canonicalPhase698P1L2Json(state.marker.source)
  )
    throw new Error(ERROR_CODE);
  if (state.records.some((entry) => entry.event === 'evidence_published'))
    throw new Error(ERROR_CODE);
  const reportHash = sha256Phase698P1L2(canonicalPhase698P1L2Json(parsedReport));
  const terminal = state.records.find((entry) => entry.event === 'run_terminal');
  if (!terminal) throw new Error(ERROR_CODE);
  let publication = state.records.find(
    (entry): entry is Extract<Phase698P1L2JournalRecord, { event: 'publication_started' }> =>
      entry.event === 'publication_started',
  );
  if (!publication) {
    if (options?.mode === 'recovery' && parsedReport.formalEvidence.recoveryClaimCount === 1)
      await appendRecoveryClaim(state);
    const createdPublication = nextRecord(state, {
      event: 'publication_started',
      reportSha256: reportHash,
    }) as Extract<Phase698P1L2JournalRecord, { event: 'publication_started' }>;
    await appendRecord(state, createdPublication);
    publication = createdPublication;
  }
  if (!publication) throw new Error(ERROR_CODE);
  if (publication.reportSha256 !== reportHash) throw new Error(ERROR_CODE);
  const claimRecord = state.records.find((entry) => entry.event === 'recovery_claimed');
  const artifact: Phase698P1L2Artifact = PHASE_6_9_8_P1_L2_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_P1_L2_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_P1_L2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    reportLogicalSha256: reportHash,
    report: parsedReport,
    durability: {
      publicationMode: options?.mode ?? 'runtime',
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publication.sequence,
      hardLink: true,
      rawDataRetained: false,
      recoveryClaimSha256: claimRecord ? recoveryClaimHash(state.records) : null,
    },
  });
  const artifactBytes = `${canonicalPhase698P1L2Json(artifact)}\n`;
  const finalPath = contained(state.root, artifactPathFor(state.runId));
  try {
    const existing = await readRegular(finalPath);
    if (existing !== artifactBytes) throw new Error(ERROR_CODE);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    const temp = contained(
      state.root,
      `.tmp/${PHASE_6_9_8_P1_L2_ARTIFACT_PREFIX}${state.runId}.artifact.tmp`,
    );
    try {
      await writeExclusive(temp, artifactBytes);
      await syncPath(temp);
      await link(temp, finalPath);
      await syncDirectory(dirname(finalPath));
      const [tempInfo, artifactInfo] = await Promise.all([lstat(temp), lstat(finalPath)]);
      if (
        !tempInfo.isFile() ||
        !artifactInfo.isFile() ||
        tempInfo.dev !== artifactInfo.dev ||
        tempInfo.ino !== artifactInfo.ino
      )
        throw new Error(ERROR_CODE);
    } finally {
      await unlink(temp).catch(() => undefined);
    }
    await syncPath(finalPath);
  }
  const evidenceSha256 = sha256Phase698P1L2(artifactBytes);
  await appendRecord(state, nextRecord(state, { event: 'evidence_published', evidenceSha256 }));
  return { evidenceSha256, relativePath: artifactPathFor(state.runId) };
}

async function buildRecoveryReport(state: State): Promise<Phase698P1L2Report> {
  const guards = [...state.guardEntries];
  while (guards.length < 8) {
    const entry = {
      caseId: PHASE_6_9_8_P1_MANIFEST.guardCases[guards.length].caseId,
      observedReasonCode: 'recovery_not_started',
      strict: false,
      terminal: true,
      fakeSearchPortCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      failureCategory: 'stale',
      breakerOpened: true,
    } as const;
    await appendRecord(state, nextRecord(state, { event: 'guard_terminal', entry }));
    state.guardEntries.push(entry);
    guards.push(entry);
  }
  const laneTerminals: Phase698P1L2LaneTerminal[] = [];
  for (let index = 0; index < PHASE_6_9_8_P1_L2_LANE_ORDER.length; index += 1) {
    const laneId = PHASE_6_9_8_P1_L2_LANE_ORDER[index];
    if (!state.laneEvents.has(laneId)) {
      await appendRecord(
        state,
        nextRecord(state, { event: 'lane_reserved', laneId, sequenceInRun: index + 1 }),
      );
      state.laneEvents.set(laneId, new Set());
    }
    let terminal = state.laneTerminals.get(laneId);
    if (!terminal) {
      const events = state.laneEvents.get(laneId) ?? new Set<string>();
      const dispatched = events.has('dispatch_started');
      const responded = events.has('response_observed');
      terminal = PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA.parse({
        laneId,
        kind: laneId.startsWith('rewrite_') ? 'rewrite' : 'final_response',
        caseId: laneId,
        sequence: index + 1,
        state: 'terminal',
        disposition: dispatched ? 'attempted_failed' : 'not_started_quality_breaker',
        failureCategory: dispatched ? 'transport' : 'stale',
        candidateInvocations: dispatched ? 1 : 0,
        wire: {
          reservation: 1,
          dispatch: dispatched ? 1 : 0,
          response: responded ? 1 : 0,
          strictValidated: 0,
          verifiedUsage: 0,
        },
        breakerOpened: true,
        terminalReason: dispatched ? 'recovery_dispatch_prefix' : 'crash_recovery',
      });
      await appendRecord(state, nextRecord(state, { event: 'lane_terminal', entry: terminal }));
      state.laneTerminals.set(laneId, terminal);
    }
    laneTerminals.push(terminal);
  }
  const baseline = state.report;
  const rewrites =
    baseline?.rewriteEntries ??
    PHASE_6_9_8_P1_MANIFEST.rewriteCases.map((entry) => ({
      caseId: entry.caseId,
      strict: false,
      runtime: false,
      wire: false,
      verifiedUsage: false,
      terminal: true,
      metricEligible: true,
      expectedNoHit: false,
      noHitObserved: null,
      baselineRecallAt5: null,
      baselineNdcgAt5: null,
      candidateRecallAt5: null,
      candidateNdcgAt5: null,
      critical: false,
      intentPreserved: false,
      unsafeRewrite: false,
      candidateInvocations: 0 as const,
      durationMs: null,
      usage: null,
      verifiedCostCny: null,
      provenance: 'not_invoked' as const,
      failureCategory: 'stale' as const,
      breakerOpened: true,
    }));
  const finals =
    baseline?.finalResponseEntries ??
    PHASE_6_9_8_P1_MANIFEST.finalResponseCases.map((entry) => ({
      caseId: entry.caseId,
      strict: false,
      runtime: false,
      wire: false,
      verifiedUsage: false,
      terminal: true,
      groundedScore: null,
      requiredCitationCount: 0,
      requiredNotice: 'none' as const,
      observedCitationCount: 0,
      citationTruePositiveCount: 0,
      noticeSatisfied: false,
      falseToolSuccess: false,
      falseCitation: false,
      safetyFailure: false,
      candidateInvocations: 0 as const,
      durationMs: null,
      usage: null,
      verifiedCostCny: null,
      provenance: 'not_invoked' as const,
      failureCategory: 'stale' as const,
      breakerOpened: true,
    }));
  return PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse({
    schemaVersion: 'phase-6.9.8-retriever-final-response-p1-l2-report-v1',
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId: state.runId,
    authority: PHASE_6_9_8_P1_L2_AUTHORITY,
    qualityAuthority: 'none',
    semanticGate: 'none',
    source: state.marker.source,
    execution: {
      providerCalls: 0,
      credentialReads: 0,
      qwenEmbeddingCalls: 0,
      candidateInvocations: 0,
      inputTokens: 0,
      outputTokens: 0,
      verifiedCostCny: null,
      maxConcurrency: 1,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
      breakerReason: 'crash_recovery',
    },
    formalEvidence: {
      markerCount: 1,
      journalCount: state.records.length,
      artifactCount: 1,
      recoveryClaimCount: 1,
    },
    guardEntries: guards,
    rewriteEntries: rewrites,
    finalResponseEntries: finals,
    laneTerminals,
  });
}
function replayState(
  root: string,
  marker: Phase698P1L2Marker,
  markerBytes: string,
  records: Phase698P1L2JournalRecord[],
): State {
  const state: State = {
    root,
    runId: marker.runId,
    marker,
    markerBytes,
    markerSha256: sha256Phase698P1L2(markerBytes),
    journalPath: contained(root, fill(PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH, marker.runId)),
    records: [...records],
    laneEvents: new Map(),
    laneTerminals: new Map(),
    guardEntries: [],
    report: null,
    queue: Promise.resolve(),
  };
  for (const record of records) {
    if (record.event === 'guard_terminal') state.guardEntries.push(record.entry);
    if (record.event === 'lane_reserved') state.laneEvents.set(record.laneId, new Set());
    if (record.event === 'lane_stage') state.laneEvents.get(record.laneId)?.add(record.stage);
    if (record.event === 'lane_terminal')
      state.laneTerminals.set(record.entry.laneId, record.entry);
  }
  const terminal = records.find((entry) => entry.event === 'run_terminal');
  if (terminal) {
    void terminal;
  }
  return state;
}
async function readJournal(
  root: string,
  marker: Phase698P1L2Marker,
  requireTerminal: boolean,
): Promise<Phase698P1L2JournalRecord[]> {
  const path = contained(root, fill(PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH, marker.runId));
  const text = await readRegular(path);
  if (!text.endsWith('\n')) throw new Error(ERROR_CODE);
  const lines = text.split('\n').slice(0, -1);
  const records: Phase698P1L2JournalRecord[] = [];
  let previous: string | null = null;
  let guardCount = 0;
  let laneCount = 0;
  let terminalSeen = false;
  let publicationStarted = false;
  let publicationSeen = false;
  const reserved = new Set<Phase698P1L2LaneId>();
  const laneEvents = new Map<Phase698P1L2LaneId, Set<string>>();
  const terminalIds = new Set<Phase698P1L2LaneId>();
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i]) throw new Error(ERROR_CODE);
    const parsed = PHASE_6_9_8_P1_L2_JOURNAL_SCHEMA.parse(JSON.parse(lines[i]));
    if (
      parsed.sequence !== i ||
      parsed.previousHash !== previous ||
      parsed.markerSha256 !== sha256Phase698P1L2(`${canonicalPhase698P1L2Json(marker)}\n`) ||
      parsed.recordHash !==
        sha256Phase698P1L2(canonicalPhase698P1L2Json({ ...parsed, recordHash: undefined }))
    )
      throw new Error(ERROR_CODE);
    if (publicationSeen) throw new Error(ERROR_CODE);
    if (i === 0 && parsed.event !== 'attempt_reserved') throw new Error(ERROR_CODE);
    if (parsed.event === 'attempt_reserved' && i !== 0) throw new Error(ERROR_CODE);
    if (parsed.event === 'guard_terminal') {
      if (terminalSeen || guardCount >= 8) throw new Error(ERROR_CODE);
      const expected = PHASE_6_9_8_P1_MANIFEST.guardCases[guardCount]?.caseId;
      if (parsed.entry.caseId !== expected) throw new Error(ERROR_CODE);
      guardCount += 1;
    }
    if (parsed.event === 'lane_reserved') {
      if (
        guardCount !== 8 ||
        terminalSeen ||
        reserved.has(parsed.laneId) ||
        parsed.sequenceInRun !== laneCount + 1 ||
        parsed.laneId !== PHASE_6_9_8_P1_L2_LANE_ORDER[laneCount]
      )
        throw new Error(ERROR_CODE);
      reserved.add(parsed.laneId);
      laneEvents.set(parsed.laneId, new Set());
      laneCount += 1;
    }
    if (parsed.event === 'lane_stage') {
      const events = laneEvents.get(parsed.laneId);
      if (!events || events.has(parsed.stage) || terminalIds.has(parsed.laneId))
        throw new Error(ERROR_CODE);
      if (parsed.stage === 'response_observed' && !events.has('dispatch_started'))
        throw new Error(ERROR_CODE);
      if (parsed.stage === 'strict_validated' && !events.has('response_observed'))
        throw new Error(ERROR_CODE);
      events.add(parsed.stage);
    }
    if (parsed.event === 'lane_terminal') {
      if (!reserved.has(parsed.entry.laneId) || terminalIds.has(parsed.entry.laneId))
        throw new Error(ERROR_CODE);
      if (parsed.entry.sequence !== terminalIds.size + 1) throw new Error(ERROR_CODE);
      const events = laneEvents.get(parsed.entry.laneId);
      if (!events) throw new Error(ERROR_CODE);
      if (parsed.entry.wire.dispatch === 1 && !events.has('dispatch_started'))
        throw new Error(ERROR_CODE);
      if (parsed.entry.wire.response === 1 && !events.has('response_observed'))
        throw new Error(ERROR_CODE);
      if (parsed.entry.wire.strictValidated === 1 && !events.has('strict_validated'))
        throw new Error(ERROR_CODE);
      terminalIds.add(parsed.entry.laneId);
    }
    if (parsed.event === 'run_terminal') {
      if (terminalSeen || guardCount !== 8 || laneCount !== 12 || terminalIds.size !== 12)
        throw new Error(ERROR_CODE);
      terminalSeen = true;
    }
    if (parsed.event === 'recovery_claimed') {
      if (publicationStarted || records.some((entry) => entry.event === 'recovery_claimed'))
        throw new Error(ERROR_CODE);
    }
    if (parsed.event === 'publication_started') {
      if (!terminalSeen || publicationStarted) throw new Error(ERROR_CODE);
      publicationStarted = true;
    }
    if (parsed.event === 'evidence_published') {
      if (!terminalSeen || !publicationStarted || publicationSeen) throw new Error(ERROR_CODE);
      publicationSeen = true;
    }
    previous = parsed.recordHash;
    records.push(parsed);
  }
  if (
    records[0]?.event !== 'attempt_reserved' ||
    (requireTerminal &&
      (!terminalSeen || !publicationSeen || records.at(-1)?.event !== 'evidence_published'))
  )
    throw new Error(ERROR_CODE);
  return records;
}
function recoveryClaimHash(records: readonly Phase698P1L2JournalRecord[]): string | null {
  const claim = records.find((entry) => entry.event === 'recovery_claimed');
  return claim ? claim.claimSha256 : null;
}
function artifactPathFor(runId: string) {
  return `${PHASE_6_9_8_P1_L2_ARTIFACT_PREFIX}${runId}.json`;
}
function fill(template: string, runId: string) {
  return template.replace('{runId}', runId);
}
async function containedRoot(root: string) {
  const resolved = resolve(root);
  const info = await stat(resolved);
  if (!info.isDirectory()) throw new Error(ERROR_CODE);
  return resolved;
}
function contained(root: string, value: string) {
  const target = resolve(root, value);
  const base = resolve(root) + sep;
  if (target !== resolve(root) && !target.startsWith(base)) throw new Error(ERROR_CODE);
  return target;
}
async function readRegular(path: string) {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error(ERROR_CODE);
  return readFile(path, 'utf8');
}
async function writeExclusive(path: string, bytes: string) {
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncPath(path: string) {
  const handle = await open(path, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}
async function syncDirectory(path: string) {
  try {
    const handle = await open(path, 'r');
    await handle.sync();
    await handle.close();
  } catch {
    /* Windows directory fsync is unsupported; file fsync remains mandatory. */
  }
}
function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT',
  );
}
async function enqueue(state: State, operation: () => Promise<void>) {
  const next = state.queue.then(operation, operation);
  state.queue = next.catch(() => undefined);
  return next;
}
function enqueueResult<T>(state: State, operation: () => Promise<T>) {
  const next = state.queue.then(operation, operation);
  state.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
async function assertNoFormalFiles(root: string) {
  const entries = await readdir(join(root, '.tmp')).catch((error: unknown) => {
    if (isNotFound(error)) return [] as string[];
    throw error;
  });
  const rootEntries = await readdir(root);
  if (
    entries.some((entry) => isPhase698P1L2FormalRelativePath(`.tmp/${entry}`)) ||
    rootEntries.some((entry) => isPhase698P1L2FormalRelativePath(entry))
  )
    throw new Error('PHASE_6_9_8_P1_L2_FORMAL_EVIDENCE_PRESENT');
}
async function assertOnlyExpectedFiles(root: string, runId: string, hasClaim: boolean) {
  const tmp = await readdir(join(root, '.tmp'));
  const allowed = new Set([
    PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH.split('/').at(-1)!,
    fill(PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH, runId).split('/').at(-1)!,
    fill(PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH, runId).split('/').at(-1)!,
    fill(PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH, runId).split('/').at(-1)!,
  ]);
  for (const entry of tmp) {
    if (isPhase698P1L2FormalRelativePath(`.tmp/${entry}`) && !allowed.has(entry))
      throw new Error(ERROR_CODE);
  }
  if (!hasClaim)
    allowed.delete(fill(PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH, runId).split('/').at(-1)!);
  const rootEntries = await readdir(root);
  const artifact = artifactPathFor(runId);
  if (rootEntries.some((entry) => isPhase698P1L2FormalRelativePath(entry) && entry !== artifact))
    throw new Error(ERROR_CODE);
}
