import { randomUUID } from 'node:crypto';
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

import { z } from 'zod';

import {
  buildPhase698P1G2Report,
  canonicalPhase698P1G2Json,
  PHASE_6_9_8_P1_G2_ARTIFACT_SCHEMA,
  PHASE_6_9_8_P1_G2_ARTIFACT_VERSION,
  PHASE_6_9_8_P1_G2_DURABILITY_VERSION,
  PHASE_6_9_8_P1_G2_JOURNAL_SCHEMA,
  PHASE_6_9_8_P1_G2_JOURNAL_VERSION,
  PHASE_6_9_8_P1_G2_LINEAGE,
  PHASE_6_9_8_P1_G2_AUTHORITY,
  PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH,
  PHASE_6_9_8_P1_G2_MARKER_SCHEMA,
  PHASE_6_9_8_P1_G2_MARKER_VERSION,
  PHASE_6_9_8_P1_G2_REPORT_SCHEMA,
  PHASE_6_9_8_P1_G2_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_8_P1_G2_LANE_ORDER,
  sha256Phase698P1G2,
  type Phase698P1G2JournalRecord,
  type Phase698P1G2LaneId,
  type Phase698P1G2LaneTerminal,
  type Phase698P1G2Marker,
  type Phase698P1G2Report,
  type Phase698P1G2Source,
} from './phase-6-9-8-retriever-final-response-p1-g2-contract.ts';
import type {
  Phase698P1G2Lifecycle,
  Phase698P1G2LaneLifecycle,
} from './phase-6-9-8-retriever-final-response-p1-g2-runner.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import { scorePhase698P1G2Runner } from './phase-6-9-8-retriever-final-response-p1-g2-contract.ts';

const ROOT_PREFIX = 'prepmind-p1-g2-';
const DURABILITY_ERROR = 'PHASE_6_9_8_P1_G2_DURABILITY_INVALID';
const RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_P1_G2_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
    runId: z.string().uuid(),
    markerSha256: z.string().regex(/^[0-9a-f]{64}$/u),
    journalTailRecordHash: z.string().regex(/^[0-9a-f]{64}$/u),
    state: z.literal('crash_only_recovery_claimed'),
  })
  .strict();

type MutableState = {
  root: string;
  runId: string;
  marker: Phase698P1G2Marker;
  markerBytes: string;
  markerSha256: string;
  journalPath: string;
  records: Phase698P1G2JournalRecord[];
  laneEvents: Map<Phase698P1G2LaneId, Set<string>>;
  laneTerminals: Map<Phase698P1G2LaneId, Phase698P1G2LaneTerminal>;
  guardEntries: Phase698P1G2Report['guardEntries'];
  report: Phase698P1G2Report | null;
  queue: Promise<void>;
};

export type Phase698P1G2Reservation = Readonly<{
  runId: string;
  lifecycle: Phase698P1G2Lifecycle;
  publishArtifact(
    report: Phase698P1G2Report,
    options?: Readonly<{ mode?: 'runtime' | 'recovery' }>,
  ): Promise<Readonly<{ evidenceSha256: string; relativePath: string }>>;
}>;

export type Phase698P1G2Validation = Readonly<{
  ok: boolean;
  runId: string | null;
  gate: 'g2_runner_durability_ready' | 'g2_runner_quality_failed' | null;
  qualityAuthority: 'none' | null;
  finalJournalEvent: 'evidence_published' | null;
  journalRecords: number;
  reportLogicalSha256: string | null;
  physicalArtifactSha256: string | null;
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
}>;

export type Phase698P1G2RecoveryResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'journal_invalid'
        | 'publication_invalid'
        | 'already_published';
    }>;

export async function createPhase698P1G2SyntheticRootForTest() {
  return mkdtemp(join(tmpdir(), ROOT_PREFIX));
}

export async function removePhase698P1G2SyntheticRootForTest(root: string) {
  await rm(root, { recursive: true, force: true });
}

export async function reservePhase698P1G2Attempt(input: {
  root: string;
  runId?: string;
  createdAt?: string;
  source: Phase698P1G2Source;
}): Promise<Phase698P1G2Reservation> {
  const root = await requireSyntheticRoot(input.root);
  const runId = z
    .string()
    .uuid()
    .parse(input.runId ?? randomUUID());
  const createdAt = z
    .string()
    .datetime({ offset: true })
    .parse(input.createdAt ?? new Date().toISOString());
  if (input.source.mode !== 'synthetic_zero_provider') throw new Error('G2_LIVE_DISABLED');
  await prepareTmp(root);
  await ensureNoFormalFiles(root);
  const marker = PHASE_6_9_8_P1_G2_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_P1_G2_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_P1_G2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    runId,
    authority: PHASE_6_9_8_P1_G2_AUTHORITY,
    qualityAuthority: 'none',
    plannedGuards: 8,
    plannedLanes: 12,
    candidateInvocationCap: 12,
    source: input.source,
    creatorPid: process.pid,
    createdAt,
  });
  const markerBytes = `${canonicalPhase698P1G2Json(marker)}\n`;
  const markerPath = contained(root, PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH);
  await writeExclusive(markerPath, markerBytes);
  await syncFileAndDirectory(markerPath);
  const state: MutableState = {
    root,
    runId,
    marker,
    markerBytes,
    markerSha256: sha256Phase698P1G2(markerBytes),
    journalPath: contained(root, journalPath(runId)),
    records: [],
    laneEvents: new Map(),
    laneTerminals: new Map(),
    guardEntries: [],
    report: null,
    queue: Promise.resolve(),
  };
  const first = nextRecord(state, { event: 'attempt_reserved', createdAt });
  await writeExclusive(state.journalPath, `${canonicalPhase698P1G2Json(first)}\n`);
  await syncFileAndDirectory(state.journalPath);
  state.records.push(first);
  return reservationFromState(state);
}

export async function validatePhase698P1G2Bundle(input: {
  root: string;
}): Promise<Phase698P1G2Validation> {
  try {
    const root = await requireSyntheticRoot(input.root);
    const markerBytes = await readRegular(contained(root, PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH));
    const marker = PHASE_6_9_8_P1_G2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonicalPhase698P1G2Json(marker)}\n`) throw new Error(DURABILITY_ERROR);
    const records = await readJournal(root, marker, true);
    const terminal = records.find((entry) => entry.event === 'run_terminal');
    const publication = records.find((entry) => entry.event === 'publication_started');
    const published = records.find((entry) => entry.event === 'evidence_published');
    if (!terminal || !publication || !published) throw new Error(DURABILITY_ERROR);
    const reportPath = contained(root, reportPathFor(marker.runId));
    const reportBytes = await readRegular(reportPath);
    const report = PHASE_6_9_8_P1_G2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (
      reportBytes !== `${canonicalPhase698P1G2Json(report)}\n` ||
      canonicalPhase698P1G2Json(report.source) !== canonicalPhase698P1G2Json(marker.source)
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    const reportSha = sha256Phase698P1G2(canonicalPhase698P1G2Json(report));
    if (terminal.reportSha256 !== reportSha || publication.reportSha256 !== reportSha) {
      throw new Error(DURABILITY_ERROR);
    }
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const gate = scorePhase698P1G2Runner(report, baseline);
    const artifactPath = contained(root, artifactPathFor(marker.runId));
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_P1_G2_ARTIFACT_SCHEMA.parse(JSON.parse(artifactBytes));
    if (artifactBytes !== `${canonicalPhase698P1G2Json(artifact)}\n`)
      throw new Error(DURABILITY_ERROR);
    const artifactSha = sha256Phase698P1G2(artifactBytes);
    if (
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== sha256Phase698P1G2(markerBytes) ||
      artifact.reportLogicalSha256 !== reportSha ||
      canonicalPhase698P1G2Json(artifact.report) !== canonicalPhase698P1G2Json(report) ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publication.sequence ||
      published.evidenceSha256 !== artifactSha ||
      artifact.durability.recoveryClaimSha256 !== recoveryClaimHash(records)
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    const claimRecord = records.find((entry) => entry.event === 'recovery_claimed');
    if (claimRecord) {
      const claimBytes = await readRegular(contained(root, recoveryPathFor(marker.runId)));
      const claim = RECOVERY_CLAIM_SCHEMA.parse(JSON.parse(claimBytes));
      if (
        claimBytes !== `${canonicalPhase698P1G2Json(claim)}\n` ||
        claim.runId !== marker.runId ||
        claim.markerSha256 !== sha256Phase698P1G2(markerBytes) ||
        claim.journalTailRecordHash !== claimRecord.previousHash ||
        claimRecord.claimSha256 !== sha256Phase698P1G2(claimBytes)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
    }
    await ensureOnlyExpectedFiles(
      root,
      marker.runId,
      artifact.durability.recoveryClaimSha256 !== null,
    );
    const statInfo = await lstat(artifactPath);
    if (!statInfo.isFile()) throw new Error(DURABILITY_ERROR);
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      gate: gate.passed
        ? ('g2_runner_durability_ready' as const)
        : ('g2_runner_quality_failed' as const),
      qualityAuthority: 'none' as const,
      finalJournalEvent: 'evidence_published' as const,
      journalRecords: records.length,
      reportLogicalSha256: reportSha,
      physicalArtifactSha256: artifactSha,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
    });
  } catch {
    return Object.freeze({
      ok: false,
      runId: null,
      gate: null,
      qualityAuthority: null,
      finalJournalEvent: null,
      journalRecords: 0,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
    });
  }
}

export async function recoverPhase698P1G2InterruptedAttempt(input: {
  root: string;
  isProcessAlive: (processId: number) => boolean;
}): Promise<Phase698P1G2RecoveryResult> {
  let root: string;
  let marker: Phase698P1G2Marker;
  let markerBytes: string;
  try {
    root = await requireSyntheticRoot(input.root);
    markerBytes = await readRegular(contained(root, PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH));
    marker = PHASE_6_9_8_P1_G2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonicalPhase698P1G2Json(marker)}\n`) throw new Error(DURABILITY_ERROR);
  } catch {
    return { ok: false, code: 'marker_missing_or_invalid' };
  }
  if (input.isProcessAlive(marker.creatorPid)) return { ok: false, code: 'process_active' };
  try {
    const records = await readJournal(root, marker, false);
    if (records.some((entry) => entry.event === 'evidence_published')) {
      return { ok: false, code: 'already_published' };
    }
    const state = await stateFromReplay(root, marker, markerBytes, records);
    if (!state.report) {
      const report = await buildRecoveryReport(state);
      await appendRunTerminal(state, report);
    }
    const report = state.report;
    if (!report) return { ok: false, code: 'journal_invalid' };
    const published = await publishStateArtifact(state, report, { mode: 'recovery' });
    const validation = await validatePhase698P1G2Bundle({ root });
    if (!validation.ok || !validation.physicalArtifactSha256) {
      return { ok: false, code: 'publication_invalid' };
    }
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

export const sealPhase698P1G2InterruptedAttempt = recoverPhase698P1G2InterruptedAttempt;

function reservationFromState(state: MutableState): Phase698P1G2Reservation {
  const lifecycle: Phase698P1G2Lifecycle = {
    runId: state.runId,
    source: state.marker.source,
    appendGuardTerminal: (entry) =>
      enqueue(state, async () => {
        if (state.guardEntries.length >= 8) throw new Error(DURABILITY_ERROR);
        const record = nextRecord(state, { event: 'guard_terminal', entry });
        await appendRecord(state, record);
        state.guardEntries.push(entry);
      }),
    reserveLane: async (laneId, sequence) => {
      await enqueue(state, async () => {
        if (sequence !== state.laneTerminals.size + 1 || state.laneEvents.has(laneId)) {
          throw new Error(DURABILITY_ERROR);
        }
        const record = nextRecord(state, {
          event: 'lane_reserved',
          laneId,
          sequenceInRun: sequence,
        });
        await appendRecord(state, record);
        state.laneEvents.set(laneId, new Set());
      });
      const lane: Phase698P1G2LaneLifecycle = {
        appendStage: (stage) =>
          enqueue(state, async () => {
            const events = state.laneEvents.get(laneId);
            if (!events || events.has(stage)) throw new Error(DURABILITY_ERROR);
            if (stage === 'response_observed' && !events.has('dispatch_started'))
              throw new Error(DURABILITY_ERROR);
            if (stage === 'strict_validated' && !events.has('response_observed'))
              throw new Error(DURABILITY_ERROR);
            const record = nextRecord(state, { event: 'lane_stage', laneId, stage });
            await appendRecord(state, record);
            events.add(stage);
          }),
      };
      return lane;
    },
    appendLaneTerminal: (entry) =>
      enqueue(state, async () => {
        if (
          entry.sequence !== state.laneTerminals.size + 1 ||
          state.laneTerminals.has(entry.laneId)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        const events = state.laneEvents.get(entry.laneId);
        if (!events) throw new Error(DURABILITY_ERROR);
        if (entry.wire.dispatch === 1 && !events.has('dispatch_started'))
          throw new Error(DURABILITY_ERROR);
        if (entry.wire.response === 1 && !events.has('response_observed'))
          throw new Error(DURABILITY_ERROR);
        if (entry.wire.strictValidated === 1 && !events.has('strict_validated'))
          throw new Error(DURABILITY_ERROR);
        const record = nextRecord(state, { event: 'lane_terminal', entry });
        await appendRecord(state, record);
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

function enqueue(state: MutableState, operation: () => Promise<void>) {
  const next = state.queue.then(operation, operation);
  state.queue = next.catch(() => undefined);
  return next;
}

function enqueueResult<T>(state: MutableState, operation: () => Promise<T>): Promise<T> {
  const next = state.queue.then(operation, operation);
  state.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function nextRecord(
  state: MutableState,
  payload: Record<string, unknown>,
): Phase698P1G2JournalRecord {
  const sequence = state.records.length;
  const previousHash = state.records.at(-1)?.recordHash ?? null;
  const unsigned = {
    journalVersion: PHASE_6_9_8_P1_G2_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    runId: state.runId,
    sequence,
    markerSha256: state.markerSha256,
    previousHash,
    ...payload,
  };
  const recordHash = sha256Phase698P1G2(canonicalPhase698P1G2Json(unsigned));
  return PHASE_6_9_8_P1_G2_JOURNAL_SCHEMA.parse({ ...unsigned, recordHash });
}

async function appendRecord(state: MutableState, record: Phase698P1G2JournalRecord) {
  const bytes = `${canonicalPhase698P1G2Json(record)}\n`;
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

function journalPath(runId: string) {
  return `.tmp/phase-6-9-8-retriever-final-response-p1-g2-${runId}.journal.jsonl`;
}

function reportPathFor(runId: string) {
  return `.tmp/phase-6-9-8-retriever-final-response-p1-g2-${runId}.report.json`;
}

function recoveryPathFor(runId: string) {
  return `.tmp/phase-6-9-8-retriever-final-response-p1-g2-${runId}.recovery.claim`;
}

function artifactPathFor(runId: string) {
  return `phase-6-9-8-retriever-final-response-p1-g2-${runId}.json`;
}

async function stateFromReplay(
  root: string,
  marker: Phase698P1G2Marker,
  markerBytes: string,
  records: readonly Phase698P1G2JournalRecord[],
): Promise<MutableState> {
  const state: MutableState = {
    root,
    runId: marker.runId,
    marker,
    markerBytes,
    markerSha256: sha256Phase698P1G2(markerBytes),
    journalPath: contained(root, journalPath(marker.runId)),
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
    const bytes = await readRegular(contained(root, reportPathFor(marker.runId)));
    const report = PHASE_6_9_8_P1_G2_REPORT_SCHEMA.parse(JSON.parse(bytes));
    if (
      bytes !== `${canonicalPhase698P1G2Json(report)}\n` ||
      terminal.reportSha256 !== sha256Phase698P1G2(canonicalPhase698P1G2Json(report)) ||
      canonicalPhase698P1G2Json(report.source) !== canonicalPhase698P1G2Json(marker.source)
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    state.report = report;
  }
  return state;
}

async function appendRecoveryClaim(state: MutableState) {
  if (state.records.some((entry) => entry.event === 'recovery_claimed')) return;
  const tail = state.records.at(-1)?.recordHash;
  if (!tail) throw new Error(DURABILITY_ERROR);
  const claim = {
    version: PHASE_6_9_8_P1_G2_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    journalTailRecordHash: tail,
    state: 'crash_only_recovery_claimed' as const,
  };
  const bytes = `${canonicalPhase698P1G2Json(claim)}\n`;
  const claimPath = contained(state.root, recoveryPathFor(state.runId));
  await writeExclusive(claimPath, bytes);
  await syncFileAndDirectory(claimPath);
  const record = nextRecord(state, {
    event: 'recovery_claimed',
    claimSha256: sha256Phase698P1G2(bytes),
  });
  await appendRecord(state, record);
}

async function buildRecoveryReport(state: MutableState) {
  const baseline = await buildPhase698P1DeterministicSubsetBaseline();
  const guards = baseline.report.guards.map((entry) => {
    const existing = state.guardEntries.find((candidate) => candidate.caseId === entry.caseId);
    return (
      existing ?? {
        caseId: entry.caseId,
        observedReasonCode: entry.expectedReasonCode,
        strict: false,
        terminal: true,
        fakeSearchPortCalls: 0,
        providerCalls: 0 as const,
        credentialReads: 0 as const,
        failureCategory: 'stale' as const,
        breakerOpened: true,
      }
    );
  });
  const terminals: Phase698P1G2LaneTerminal[] = [];
  for (let index = 0; index < PHASE_6_9_8_P1_G2_LANE_ORDER.length; index += 1) {
    const laneId = PHASE_6_9_8_P1_G2_LANE_ORDER[index];
    if (!state.laneEvents.has(laneId)) {
      const reserved = nextRecord(state, {
        event: 'lane_reserved',
        laneId,
        sequenceInRun: index + 1,
      });
      await appendRecord(state, reserved);
      state.laneEvents.set(laneId, new Set());
    }
    let terminal = state.laneTerminals.get(laneId);
    if (!terminal) {
      terminal = makeRecoveryTerminal(laneId, index + 1, state.laneEvents.get(laneId) ?? new Set());
      const record = nextRecord(state, { event: 'lane_terminal', entry: terminal });
      await appendRecord(state, record);
      state.laneTerminals.set(laneId, terminal);
    }
    terminals.push(terminal);
  }
  const rewrites = baseline.report.rewriteEntries.map((entry) =>
    recoveryRewrite(entry.caseId, entry),
  );
  const finals = baseline.report.finalResponseEntries.map((entry) =>
    recoveryFinal(entry.caseId, entry),
  );
  const candidateInvocations = terminals.reduce(
    (sum, entry) => sum + entry.candidateInvocations,
    0,
  );
  const report = buildPhase698P1G2Report({
    runId: state.runId,
    source: state.marker.source,
    guardEntries: guards,
    rewriteEntries: rewrites,
    finalResponseEntries: finals,
    laneTerminals: terminals,
    candidateInvocations,
    breakerReason: 'recovery_prefix',
  });
  state.guardEntries = guards;
  state.laneTerminals = new Map(terminals.map((entry) => [entry.laneId, entry]));
  for (const entry of terminals) {
    if (!state.laneEvents.has(entry.laneId)) state.laneEvents.set(entry.laneId, new Set());
  }
  return report;
}

function makeRecoveryTerminal(
  laneId: Phase698P1G2LaneId,
  sequence: number,
  events: ReadonlySet<string>,
): Phase698P1G2LaneTerminal {
  const dispatched = events.has('dispatch_started');
  const responded = events.has('response_observed');
  return {
    laneId,
    kind: laneId.startsWith('rewrite_') ? 'rewrite' : 'final_response',
    caseId: laneId,
    sequence,
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
    terminalReason: dispatched ? 'recovery_dispatch_prefix' : 'recovery_prefix',
  };
}

function recoveryRewrite(
  caseId: string,
  baseline: {
    metricEligible: boolean;
    expectedNoHit: boolean;
    recallAt5: number | null;
    ndcgAt5: number | null;
    critical: boolean;
  },
) {
  return {
    caseId,
    strict: false,
    runtime: false,
    wire: false,
    verifiedUsage: false,
    terminal: true,
    metricEligible: baseline.metricEligible,
    expectedNoHit: baseline.expectedNoHit,
    noHitObserved: null,
    baselineRecallAt5: baseline.recallAt5,
    baselineNdcgAt5: baseline.ndcgAt5,
    candidateRecallAt5: null,
    candidateNdcgAt5: null,
    critical: baseline.critical,
    intentPreserved: false,
    unsafeRewrite: false,
    candidateInvocations: 0 as const,
    durationMs: null,
    failureCategory: 'stale' as const,
    breakerOpened: true,
  };
}

function recoveryFinal(
  caseId: string,
  baseline: {
    requiredCitationCount: number;
    requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
  },
) {
  return {
    caseId,
    strict: false,
    runtime: false,
    wire: false,
    verifiedUsage: false,
    terminal: true,
    groundedScore: null,
    requiredCitationCount: baseline.requiredCitationCount,
    requiredNotice: baseline.requiredNotice,
    observedCitationCount: 0,
    citationTruePositiveCount: 0,
    noticeSatisfied: false,
    falseToolSuccess: false,
    falseCitation: false,
    safetyFailure: false,
    candidateInvocations: 0 as const,
    durationMs: null,
    failureCategory: 'stale' as const,
    breakerOpened: true,
  };
}

function recoveryClaimHash(records: readonly Phase698P1G2JournalRecord[]) {
  return records.find((entry) => entry.event === 'recovery_claimed')?.claimSha256 ?? null;
}

async function readJournal(root: string, marker: Phase698P1G2Marker, requireTerminal: boolean) {
  const bytes = await readRegular(contained(root, journalPath(marker.runId)));
  const lines = bytes.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) throw new Error(DURABILITY_ERROR);
  const records = lines.map((line) => PHASE_6_9_8_P1_G2_JOURNAL_SCHEMA.parse(JSON.parse(line)));
  let previousHash: string | null = null;
  let guards = 0;
  let lanes = 0;
  let terminalSeen = false;
  let publicationSeen = false;
  let publicationStarted = false;
  const reserved = new Set<Phase698P1G2LaneId>();
  const events = new Map<Phase698P1G2LaneId, Set<string>>();
  const terminalIds = new Set<Phase698P1G2LaneId>();
  for (const [index, record] of records.entries()) {
    const { recordHash, ...unsigned } = record;
    if (
      record.sequence !== index ||
      record.previousHash !== previousHash ||
      record.runId !== marker.runId ||
      record.markerSha256 !== sha256Phase698P1G2(`${canonicalPhase698P1G2Json(marker)}\n`) ||
      recordHash !== sha256Phase698P1G2(canonicalPhase698P1G2Json(unsigned))
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    previousHash = record.recordHash;
    if (publicationSeen) throw new Error(DURABILITY_ERROR);
    if (index === 0 && record.event !== 'attempt_reserved') throw new Error(DURABILITY_ERROR);
    if (record.event === 'attempt_reserved' && index !== 0) throw new Error(DURABILITY_ERROR);
    if (record.event === 'guard_terminal') {
      if (terminalSeen || guards >= 8) throw new Error(DURABILITY_ERROR);
      guards += 1;
    }
    if (record.event === 'lane_reserved') {
      if (
        guards !== 8 ||
        terminalSeen ||
        reserved.has(record.laneId) ||
        record.sequenceInRun !== lanes + 1 ||
        record.laneId !== PHASE_6_9_8_P1_G2_LANE_ORDER[lanes]
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      reserved.add(record.laneId);
      events.set(record.laneId, new Set());
      lanes += 1;
    }
    if (record.event === 'lane_stage') {
      const laneEvents = events.get(record.laneId);
      if (!laneEvents || laneEvents.has(record.stage) || terminalIds.has(record.laneId)) {
        throw new Error(DURABILITY_ERROR);
      }
      if (record.stage === 'response_observed' && !laneEvents.has('dispatch_started'))
        throw new Error(DURABILITY_ERROR);
      if (record.stage === 'strict_validated' && !laneEvents.has('response_observed'))
        throw new Error(DURABILITY_ERROR);
      laneEvents.add(record.stage);
    }
    if (record.event === 'lane_terminal') {
      if (!reserved.has(record.entry.laneId) || terminalIds.has(record.entry.laneId))
        throw new Error(DURABILITY_ERROR);
      if (record.entry.sequence !== terminalIds.size + 1) throw new Error(DURABILITY_ERROR);
      const laneEvents = events.get(record.entry.laneId);
      if (!laneEvents) throw new Error(DURABILITY_ERROR);
      if (record.entry.wire.dispatch === 1 && !laneEvents.has('dispatch_started'))
        throw new Error(DURABILITY_ERROR);
      if (record.entry.wire.response === 1 && !laneEvents.has('response_observed'))
        throw new Error(DURABILITY_ERROR);
      if (record.entry.wire.strictValidated === 1 && !laneEvents.has('strict_validated'))
        throw new Error(DURABILITY_ERROR);
      terminalIds.add(record.entry.laneId);
    }
    if (record.event === 'run_terminal') {
      if (terminalSeen || guards !== 8 || lanes !== 12 || terminalIds.size !== 12)
        throw new Error(DURABILITY_ERROR);
      terminalSeen = true;
    }
    if (record.event === 'recovery_claimed') {
      if (
        publicationStarted ||
        records.filter((entry) => entry.event === 'recovery_claimed').length > 1
      ) {
        throw new Error(DURABILITY_ERROR);
      }
    }
    if (record.event === 'publication_started') {
      if (!terminalSeen || publicationStarted) throw new Error(DURABILITY_ERROR);
      publicationStarted = true;
    }
    if (record.event === 'evidence_published') {
      if (!terminalSeen || !publicationStarted) throw new Error(DURABILITY_ERROR);
      publicationSeen = true;
    }
  }
  if (requireTerminal && (!terminalSeen || !publicationSeen)) throw new Error(DURABILITY_ERROR);
  return records;
}

async function prepareTmp(root: string) {
  const tmp = contained(root, '.tmp');
  await mkdir(tmp, { recursive: true });
  const info = await lstat(tmp);
  const canonical = await realpath(tmp);
  if (!info.isDirectory() || info.isSymbolicLink() || canonical !== tmp)
    throw new Error(DURABILITY_ERROR);
}

async function ensureNoFormalFiles(root: string) {
  const rootEntries = await readdir(root, { withFileTypes: true });
  if (rootEntries.some((entry) => entry.name !== '.tmp')) throw new Error(DURABILITY_ERROR);
  const tmpEntries = await readdir(contained(root, '.tmp'), { withFileTypes: true });
  if (tmpEntries.length > 0) throw new Error(DURABILITY_ERROR);
}

async function ensureOnlyExpectedFiles(root: string, runId: string, hasClaim: boolean) {
  const rootEntries = await readdir(root, { withFileTypes: true });
  const expectedRoot = artifactPathFor(runId).split('/').at(-1);
  if (
    rootEntries.some((entry) =>
      entry.name === '.tmp'
        ? !entry.isDirectory() || entry.isSymbolicLink()
        : !entry.isFile() || entry.isSymbolicLink() || entry.name !== expectedRoot,
    )
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  const expectedTmp = new Set([
    PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH.split('/').at(-1),
    journalPath(runId).split('/').at(-1),
    reportPathFor(runId).split('/').at(-1),
    ...(hasClaim ? [recoveryPathFor(runId).split('/').at(-1)] : []),
  ]);
  const tmpEntries = await readdir(contained(root, '.tmp'), { withFileTypes: true });
  if (tmpEntries.some((entry) => !entry.isFile() || !expectedTmp.has(entry.name))) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function requireSyntheticRoot(input: string) {
  const root = resolve(input);
  const info = await lstat(root);
  const canonical = await realpath(root);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    canonical !== root ||
    !root.split(sep).at(-1)?.startsWith(ROOT_PREFIX)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  return root;
}

function contained(root: string, relativePath: string) {
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    relativePath.includes('..') ||
    relativePath.startsWith('/')
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  const candidate = resolve(root, relativePath);
  const normalizedRoot = resolve(root);
  if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(DURABILITY_ERROR);
  }
  return candidate;
}

async function writeExclusive(path: string, bytes: string) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(bytes, 'utf8');
  } finally {
    await handle.close();
  }
}

async function syncFileAndDirectory(path: string) {
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
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Windows rejects directory fsync on some filesystems; file fsync is mandatory.
  }
}

async function readRegular(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(DURABILITY_ERROR);
  const bytes = await readFile(path, 'utf8');
  if (bytes.length > 64 * 1024 * 1024) throw new Error(DURABILITY_ERROR);
  return bytes;
}

async function appendRunTerminal(state: MutableState, report: Phase698P1G2Report) {
  if (state.guardEntries.length !== 8 || state.laneTerminals.size !== 12 || state.report) {
    throw new Error(DURABILITY_ERROR);
  }
  const parsed = PHASE_6_9_8_P1_G2_REPORT_SCHEMA.parse(report);
  const bytes = `${canonicalPhase698P1G2Json(parsed)}\n`;
  const reportPath = contained(state.root, reportPathFor(state.runId));
  await writeExclusive(reportPath, bytes);
  await syncFileAndDirectory(reportPath);
  const record = nextRecord(state, {
    event: 'run_terminal',
    reportSha256: sha256Phase698P1G2(canonicalPhase698P1G2Json(parsed)),
  });
  await appendRecord(state, record);
  state.report = parsed;
}

async function publishStateArtifact(
  state: MutableState,
  report: Phase698P1G2Report,
  options: Readonly<{ mode?: 'runtime' | 'recovery' }> = {},
) {
  const parsed = PHASE_6_9_8_P1_G2_REPORT_SCHEMA.parse(report);
  if (
    canonicalPhase698P1G2Json(parsed.source) !== canonicalPhase698P1G2Json(state.marker.source) ||
    !state.report ||
    canonicalPhase698P1G2Json(state.report) !== canonicalPhase698P1G2Json(parsed)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  if (state.records.some((entry) => entry.event === 'evidence_published'))
    throw new Error(DURABILITY_ERROR);
  const terminal = state.records.find((entry) => entry.event === 'run_terminal');
  if (!terminal) throw new Error(DURABILITY_ERROR);
  const reportSha256 = sha256Phase698P1G2(canonicalPhase698P1G2Json(parsed));
  if (!state.records.some((entry) => entry.event === 'publication_started')) {
    if (options.mode === 'recovery') await appendRecoveryClaim(state);
    const publication = nextRecord(state, { event: 'publication_started', reportSha256 });
    await appendRecord(state, publication);
  }
  const publication = state.records.find((entry) => entry.event === 'publication_started');
  if (!publication || publication.reportSha256 !== reportSha256) throw new Error(DURABILITY_ERROR);
  const claim = recoveryClaimHash(state.records);
  const artifact = PHASE_6_9_8_P1_G2_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_P1_G2_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_P1_G2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    reportLogicalSha256: reportSha256,
    report: parsed,
    durability: {
      publicationMode: options.mode ?? 'runtime',
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publication.sequence,
      hardLink: true,
      rawDataRetained: false,
      recoveryClaimSha256: claim,
    },
  });
  const bytes = `${canonicalPhase698P1G2Json(artifact)}\n`;
  const artifactPath = contained(state.root, artifactPathFor(state.runId));
  const tempPath = `${artifactPath}.tmp-${randomUUID()}`;
  await writeExclusive(tempPath, bytes);
  await syncFileAndDirectory(tempPath);
  try {
    await link(tempPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
    const [tempInfo, artifactInfo] = await Promise.all([lstat(tempPath), lstat(artifactPath)]);
    if (
      !tempInfo.isFile() ||
      !artifactInfo.isFile() ||
      tempInfo.dev !== artifactInfo.dev ||
      tempInfo.ino !== artifactInfo.ino
    ) {
      throw new Error(DURABILITY_ERROR);
    }
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = sha256Phase698P1G2(bytes);
  const published = nextRecord(state, { event: 'evidence_published', evidenceSha256 });
  await appendRecord(state, published);
  return Object.freeze({ evidenceSha256, relativePath: artifactPathFor(state.runId) });
}
