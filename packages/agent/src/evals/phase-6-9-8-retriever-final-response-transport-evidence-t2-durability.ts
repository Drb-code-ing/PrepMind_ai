import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  appendFile,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { z } from 'zod';

import { PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE } from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA,
  type Phase698TransportEvidenceT2CaseResult,
  type Phase698TransportEvidenceT2Report,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t2.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-durability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-marker-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_JOURNAL_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-journal-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-artifact-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_RECOVERY_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t2-recovery-claim-v1' as const;

const SYNTHETIC_ROOT_PREFIX = 'phase-698-transport-evidence-t2-';
const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const RUN_ID = z.string().uuid();

const markerPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t2-${runId}.marker.json`;
const journalPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t2-${runId}.journal.jsonl`;
const reportPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t2-${runId}.report.json`;
const artifactPathFor = (runId: string) =>
  `phase-6-9-8-retriever-final-response-transport-evidence-t2-${runId}.json`;

const MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    runId: RUN_ID,
    authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runMode: z.literal('synthetic_static'),
    credentialReads: z.literal(0),
    providerCalls: z.literal(0),
    formalEvidence: z.literal(0),
    creatorPid: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
type Marker = z.infer<typeof MARKER_SCHEMA>;

const JOURNAL_COMMON = {
  version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
  runId: RUN_ID,
  sequence: z.number().int().nonnegative(),
  previousHash: HEX.nullable(),
  recordHash: HEX,
};

const JOURNAL_SCHEMA = z.discriminatedUnion('event', [
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('attempt_reserved'),
      markerSha256: HEX,
      createdAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('case_terminal'),
      caseId: z.string().min(1).max(128),
      passed: z.boolean(),
      disposition: z.enum(['accepted', 'rejected']),
      failureCode: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA.shape.failureCode,
      rawDataRetained: z.literal(false),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('run_terminal'),
      reportSha256: HEX,
      caseCount: z.literal(30),
      passedCases: z.number().int().min(0).max(30),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('recovery_claimed'),
      claimSha256: HEX,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('publication_started'),
      reportSha256: HEX,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('evidence_published'),
      evidenceSha256: HEX,
    })
    .strict(),
]);
type JournalBase = {
  version: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_JOURNAL_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  runId: string;
  sequence: number;
  previousHash: string | null;
  recordHash: string;
};
export type Phase698TransportEvidenceT2JournalRecord =
  | (JournalBase & {
      event: 'attempt_reserved';
      markerSha256: string;
      createdAt: string;
    })
  | (JournalBase & {
      event: 'case_terminal';
      caseId: string;
      passed: boolean;
      disposition: 'accepted' | 'rejected';
      failureCode: string | null;
      rawDataRetained: false;
    })
  | (JournalBase & {
      event: 'run_terminal';
      reportSha256: string;
      caseCount: 30;
      passedCases: number;
    })
  | (JournalBase & { event: 'recovery_claimed'; claimSha256: string })
  | (JournalBase & { event: 'publication_started'; reportSha256: string })
  | (JournalBase & { event: 'evidence_published'; evidenceSha256: string });

type JournalInput =
  | { event: 'attempt_reserved'; markerSha256: string; createdAt: string }
  | {
      event: 'case_terminal';
      caseId: string;
      passed: boolean;
      disposition: 'accepted' | 'rejected';
      failureCode: string | null;
      rawDataRetained: false;
    }
  | { event: 'run_terminal'; reportSha256: string; caseCount: 30; passedCases: number }
  | { event: 'recovery_claimed'; claimSha256: string }
  | { event: 'publication_started'; reportSha256: string }
  | { event: 'evidence_published'; evidenceSha256: string };

const ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    runId: RUN_ID,
    markerSha256: HEX,
    reportLogicalSha256: HEX,
    durability: z
      .object({
        publicationMode: z.enum(['runtime', 'recovery']),
        terminalSequence: z.number().int().nonnegative(),
        terminalRecordHash: HEX,
        journalRecordsBeforePublication: z.number().int().positive(),
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    report: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA,
  })
  .strict();
type Artifact = {
  artifactVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ARTIFACT_VERSION;
  durabilityVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  runId: string;
  markerSha256: string;
  reportLogicalSha256: string;
  durability: {
    publicationMode: 'runtime' | 'recovery';
    terminalSequence: number;
    terminalRecordHash: string;
    journalRecordsBeforePublication: number;
    hardLink: true;
    rawDataRetained: false;
  };
  report: Phase698TransportEvidenceT2Report;
};

export type Phase698TransportEvidenceT2Reservation = Readonly<{
  runId: string;
  appendCaseTerminal(result: Phase698TransportEvidenceT2CaseResult): Promise<void>;
  appendRunTerminal(report: Phase698TransportEvidenceT2Report): Promise<void>;
  publishArtifact(
    report: Phase698TransportEvidenceT2Report,
  ): Promise<Readonly<{ evidenceSha256: string }>>;
}>;

type State = {
  root: string;
  runId: string;
  marker: Marker;
  markerSha256: string;
  journalPath: string;
  records: Phase698TransportEvidenceT2JournalRecord[];
  report: Phase698TransportEvidenceT2Report | null;
  queue: Promise<void>;
};

export type Phase698TransportEvidenceT2RecoveryResult =
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

export async function reservePhase698TransportEvidenceT2Attempt(input: {
  root: string;
  runId?: string;
  createdAt?: string;
}): Promise<Phase698TransportEvidenceT2Reservation> {
  const root = await requireSyntheticRoot(input.root);
  const runId = RUN_ID.parse(input.runId ?? randomUUID());
  const createdAt = input.createdAt ?? new Date().toISOString();
  const marker: Marker = MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId,
    authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_AUTHORITY,
    qualityAuthority: 'none',
    runMode: 'synthetic_static',
    credentialReads: 0,
    providerCalls: 0,
    formalEvidence: 0,
    creatorPid: process.pid,
    createdAt,
  });
  const markerRelativePath = markerPathFor(runId);
  const journalRelativePath = journalPathFor(runId);
  const artifactRelativePath = artifactPathFor(runId);
  const reportRelativePath = reportPathFor(runId);
  await ensureNoFormalFiles(root, [
    markerRelativePath,
    journalRelativePath,
    artifactRelativePath,
    reportRelativePath,
  ]);
  const markerBytes = `${canonical(marker)}\n`;
  await writeExclusive(resolveContained(root, markerRelativePath), markerBytes);
  await syncFileAndDirectory(resolveContained(root, markerRelativePath));
  const journalPath = resolveContained(root, journalRelativePath);
  const state: State = {
    root,
    runId,
    marker,
    markerSha256: sha256(markerBytes),
    journalPath,
    records: [],
    report: null,
    queue: Promise.resolve(),
  };
  const reserved = nextRecord(state, {
    event: 'attempt_reserved',
    markerSha256: state.markerSha256,
    createdAt,
  });
  await writeExclusive(journalPath, `${canonical(reserved)}\n`);
  await syncFileAndDirectory(journalPath);
  state.records.push(reserved);
  return reservationFromState(state);
}

export async function validatePhase698TransportEvidenceT2Bundle(input: { root: string }) {
  try {
    const root = await requireSyntheticRoot(input.root);
    const markerRelativePath = await findMarkerRelativePath(root);
    const markerPath = resolveContained(root, markerRelativePath);
    const markerBytes = await readRegular(markerPath);
    const marker = MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonical(marker)}\n`) throw new Error('INVALID');
    const records = await readJournal(root, marker);
    const terminal = records.find((record) => record.event === 'run_terminal');
    const publicationStarted = records.find((record) => record.event === 'publication_started');
    const published = records.find((record) => record.event === 'evidence_published');
    if (!terminal || !publicationStarted || !published) throw new Error('INVALID');
    const artifactPath = resolveContained(root, artifactPathFor(marker.runId));
    const artifactBytes = await readRegular(artifactPath);
    const artifact = ARTIFACT_SCHEMA.parse(JSON.parse(artifactBytes));
    if (artifactBytes !== `${canonical(artifact)}\n`) throw new Error('INVALID');
    if (reconcileCaseTerminals(records, artifact.report).size !== 30) throw new Error('INVALID');
    const reportSha256 = sha256(canonical(artifact.report));
    const artifactSha256 = sha256(artifactBytes);
    if (
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== sha256(markerBytes) ||
      artifact.reportLogicalSha256 !== reportSha256 ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publicationStarted.sequence ||
      artifact.durability.publicationMode !==
        (records.some((record) => record.event === 'recovery_claimed') ? 'recovery' : 'runtime') ||
      published.evidenceSha256 !== artifactSha256 ||
      terminal.reportSha256 !== reportSha256 ||
      publicationStarted.reportSha256 !== reportSha256
    ) {
      throw new Error('INVALID');
    }
    await ensureOnlyExpectedFiles(root, marker.runId);
    return Object.freeze({
      ok: true as const,
      runId: marker.runId,
      qualityAuthority: artifact.report.qualityAuthority,
      finalJournalEvent: 'evidence_published' as const,
      journalRecords: records.length,
      reportLogicalSha256: reportSha256,
      physicalArtifactSha256: artifactSha256,
    });
  } catch {
    return Object.freeze({
      ok: false as const,
      runId: null,
      qualityAuthority: null,
      finalJournalEvent: null,
      journalRecords: 0,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
    });
  }
}

export async function recoverPhase698TransportEvidenceT2InterruptedAttemptForTest(input: {
  root: string;
  isProcessAlive(processId: number): boolean;
}): Promise<Phase698TransportEvidenceT2RecoveryResult> {
  let root: string;
  let marker: Marker;
  let markerBytes: string;
  try {
    root = await requireSyntheticRoot(input.root);
    const markerRelativePath = await findMarkerRelativePath(root);
    markerBytes = await readRegular(resolveContained(root, markerRelativePath));
    marker = MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${canonical(marker)}\n`) throw new Error('INVALID');
  } catch {
    return { ok: false, code: 'marker_missing_or_invalid' };
  }
  if (input.isProcessAlive(marker.creatorPid)) return { ok: false, code: 'process_active' };
  try {
    const records = await readJournal(root, marker);
    if (records.some((record) => record.event === 'evidence_published')) {
      return { ok: false, code: 'already_published' };
    }
    const state = await stateFromReplay(root, marker, markerBytes, records);
    const artifactPath = resolveContained(root, artifactPathFor(marker.runId));
    const artifactExists = await pathExists(artifactPath);
    if (artifactExists && !state.records.some((record) => record.event === 'publication_started')) {
      return { ok: false, code: 'publication_invalid' };
    }
    let artifact: Artifact | null = null;
    let artifactBytes: string | null = null;
    if (artifactExists) {
      if (!state.report) return { ok: false, code: 'publication_invalid' };
      artifactBytes = await readRegular(artifactPath);
      artifact = parseArtifactForState(state, state.report, artifactBytes);
      const hasRecoveryClaim = state.records.some((record) => record.event === 'recovery_claimed');
      if (artifact.durability.publicationMode === 'runtime' && hasRecoveryClaim) {
        return { ok: false, code: 'publication_invalid' };
      }
      if (artifact.durability.publicationMode === 'recovery' && !hasRecoveryClaim) {
        await appendRecoveryClaim(state);
      }
    }
    let report = state.report;
    const disposition: 'crash_only_sealed' | 'terminal_publication_recovered' = report
      ? 'terminal_publication_recovered'
      : 'crash_only_sealed';
    if (!state.records.some((record) => record.event === 'recovery_claimed') && !artifact) {
      await appendRecoveryClaim(state);
    }
    if (!report) {
      const { runPhase698TransportEvidenceT2Static } =
        await import('./phase-6-9-8-retriever-final-response-transport-evidence-t2.ts');
      report = runPhase698TransportEvidenceT2Static();
      const existingCaseIds = reconcileCaseTerminals(state.records, report);
      for (const result of report.cases) {
        if (existingCaseIds.has(result.caseId)) continue;
        await appendStateRecord(state, {
          event: 'case_terminal',
          caseId: result.caseId,
          passed: result.passed,
          disposition: result.disposition,
          failureCode: result.failureCode,
          rawDataRetained: false,
        });
      }
      await ensureReportSnapshot(state.root, state.runId, report);
      await appendStateRecord(state, {
        event: 'run_terminal',
        reportSha256: sha256(canonical(report)),
        caseCount: 30,
        passedCases: report.passedCases,
      });
      state.report = report;
    }
    if (artifact && artifactBytes !== null) {
      const publishedRecord = state.records.find((record) => record.event === 'evidence_published');
      if (!publishedRecord) {
        await appendStateRecord(state, {
          event: 'evidence_published',
          evidenceSha256: sha256(artifactBytes),
        });
      }
      const validation = await validatePhase698TransportEvidenceT2Bundle({ root });
      if (!validation.ok || !validation.physicalArtifactSha256) {
        return { ok: false, code: 'publication_invalid' };
      }
      return {
        ok: true,
        runId: marker.runId,
        disposition,
        artifactSha256: validation.physicalArtifactSha256,
      };
    }
    if (!report) return { ok: false, code: 'journal_invalid' };
    const published = await publishStateArtifact(state, report, 'recovery');
    const validation = await validatePhase698TransportEvidenceT2Bundle({ root });
    if (!validation.ok) return { ok: false, code: 'publication_invalid' };
    return { ok: true, runId: marker.runId, disposition, artifactSha256: published.evidenceSha256 };
  } catch {
    return { ok: false, code: 'journal_invalid' };
  }
}

export function isPhase698TransportEvidenceT2WritableRelativePathForTest(relativePath: string) {
  if (!relativePath || relativePath.includes('\\') || relativePath.includes('..')) return false;
  return (
    /^\.tmp\/phase-6-9-8-retriever-final-response-transport-evidence-t2-[0-9a-f-]{36}\.(marker\.json|journal\.jsonl|report\.json)$/u.test(
      relativePath,
    ) ||
    /^phase-6-9-8-retriever-final-response-transport-evidence-t2-[0-9a-f-]{36}\.json$/u.test(
      relativePath,
    )
  );
}

export function phase698TransportEvidenceT2ArtifactRelativePath(runId: string) {
  return artifactPathFor(RUN_ID.parse(runId));
}

export function phase698TransportEvidenceT2MarkerRelativePath(runId: string) {
  return markerPathFor(RUN_ID.parse(runId));
}

export function phase698TransportEvidenceT2JournalRelativePath(runId: string) {
  return journalPathFor(RUN_ID.parse(runId));
}

function reservationFromState(state: State): Phase698TransportEvidenceT2Reservation {
  return Object.freeze({
    runId: state.runId,
    appendCaseTerminal: (result) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_RESULT_SCHEMA.parse(result);
        if (
          state.records.some(
            (record) => record.event === 'case_terminal' && record.caseId === parsed.caseId,
          )
        ) {
          throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DUPLICATE_CASE');
        }
        await appendStateRecord(state, {
          event: 'case_terminal',
          caseId: parsed.caseId,
          passed: parsed.passed,
          disposition: parsed.disposition,
          failureCode: parsed.failureCode,
          rawDataRetained: false,
        });
      }),
    appendRunTerminal: (report) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.parse(report);
        if (state.records.some((record) => record.event === 'run_terminal')) {
          throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DUPLICATE_TERMINAL');
        }
        const caseIds = reconcileCaseTerminals(state.records, parsed);
        if (caseIds.size !== 30) {
          throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_INCOMPLETE_CASES');
        }
        await ensureReportSnapshot(state.root, state.runId, parsed);
        state.report = parsed;
        await appendStateRecord(state, {
          event: 'run_terminal',
          reportSha256: sha256(canonical(parsed)),
          caseCount: 30,
          passedCases: parsed.passedCases,
        });
      }),
    publishArtifact: (report) =>
      enqueueResult(state, async () => publishStateArtifact(state, report, 'runtime')),
  });
}

async function publishStateArtifact(
  state: State,
  reportInput: Phase698TransportEvidenceT2Report,
  publicationMode: 'runtime' | 'recovery',
) {
  if (state.records.some((record) => record.event === 'evidence_published')) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ALREADY_PUBLISHED');
  }
  const report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.parse(reportInput);
  if (!state.report || canonical(state.report) !== canonical(report)) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_MISMATCH');
  }
  const terminal = state.records.find((record) => record.event === 'run_terminal');
  if (!terminal) throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_TERMINAL_MISSING');
  if (!state.records.some((record) => record.event === 'publication_started')) {
    await appendStateRecord(state, {
      event: 'publication_started',
      reportSha256: sha256(canonical(report)),
    });
  }
  const publicationStarted = state.records.find((record) => record.event === 'publication_started');
  if (!publicationStarted) throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_PUBLICATION_MISSING');
  const artifact: Artifact = ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    reportLogicalSha256: sha256(canonical(report)),
    durability: {
      publicationMode,
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publicationStarted.sequence,
      hardLink: true,
      rawDataRetained: false,
    },
    report,
  });
  const artifactBytes = `${canonical(artifact)}\n`;
  const artifactRelativePath = artifactPathFor(state.runId);
  const artifactPath = resolveContained(state.root, artifactRelativePath);
  const tempPath = `${artifactPath}.tmp-${randomUUID()}`;
  await writeExclusive(tempPath, artifactBytes);
  await syncFileAndDirectory(tempPath);
  try {
    await link(tempPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = sha256(artifactBytes);
  if (!state.records.some((record) => record.event === 'evidence_published')) {
    await appendStateRecord(state, { event: 'evidence_published', evidenceSha256 });
  }
  return Object.freeze({ relativePath: artifactRelativePath, evidenceSha256 });
}

async function stateFromReplay(
  root: string,
  marker: Marker,
  markerBytes: string,
  records: Phase698TransportEvidenceT2JournalRecord[],
): Promise<State> {
  const terminal = records.find((record) => record.event === 'run_terminal');
  let report: Phase698TransportEvidenceT2Report | null = null;
  if (terminal) {
    const reportBytes = await readRegular(resolveContained(root, reportPathFor(marker.runId)));
    const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (
      reportBytes !== `${canonical(parsed)}\n` ||
      sha256(canonical(parsed)) !== terminal.reportSha256
    ) {
      throw new Error('INVALID');
    }
    reconcileCaseTerminals(records, parsed);
    report = parsed;
  }
  return {
    root,
    runId: marker.runId,
    marker,
    markerSha256: sha256(markerBytes),
    journalPath: resolveContained(root, journalPathFor(marker.runId)),
    records: [...records],
    report,
    queue: Promise.resolve(),
  };
}

function reconcileCaseTerminals(
  records: readonly Phase698TransportEvidenceT2JournalRecord[],
  report: Phase698TransportEvidenceT2Report,
) {
  const expectedById = new Map(report.cases.map((result) => [result.caseId, result]));
  const seen = new Set<string>();
  for (const record of records) {
    if (record.event !== 'case_terminal') continue;
    const expected = expectedById.get(record.caseId);
    if (
      !expected ||
      seen.has(record.caseId) ||
      record.passed !== expected.passed ||
      record.disposition !== expected.disposition ||
      record.failureCode !== expected.failureCode
    ) {
      throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_PREFIX_INVALID');
    }
    seen.add(record.caseId);
  }
  return seen;
}

async function appendRecoveryClaim(state: State) {
  if (state.records.some((record) => record.event === 'recovery_claimed')) return;
  await appendStateRecord(state, {
    event: 'recovery_claimed',
    claimSha256: sha256(
      `${PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_RECOVERY_CLAIM_VERSION}:${state.runId}`,
    ),
  });
}

function parseArtifactForState(
  state: State,
  report: Phase698TransportEvidenceT2Report,
  bytes: string,
) {
  const artifact = ARTIFACT_SCHEMA.parse(JSON.parse(bytes));
  const reportSha256 = sha256(canonical(report));
  const terminal = state.records.find((record) => record.event === 'run_terminal');
  const publicationStarted = state.records.find((record) => record.event === 'publication_started');
  if (
    bytes !== `${canonical(artifact)}\n` ||
    !terminal ||
    !publicationStarted ||
    artifact.runId !== state.runId ||
    artifact.markerSha256 !== state.markerSha256 ||
    artifact.reportLogicalSha256 !== reportSha256 ||
    artifact.reportLogicalSha256 !== terminal.reportSha256 ||
    artifact.durability.terminalSequence !== terminal.sequence ||
    artifact.durability.terminalRecordHash !== terminal.recordHash ||
    artifact.durability.journalRecordsBeforePublication !== publicationStarted.sequence
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ARTIFACT_INVALID');
  }
  return artifact;
}

async function ensureReportSnapshot(
  root: string,
  runId: string,
  report: Phase698TransportEvidenceT2Report,
) {
  const reportPath = resolveContained(root, reportPathFor(runId));
  const reportBytes = `${canonical(report)}\n`;
  if (await pathExists(reportPath)) {
    const existingBytes = await readRegular(reportPath);
    const existing = PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_SCHEMA.parse(
      JSON.parse(existingBytes),
    );
    if (existingBytes !== `${canonical(existing)}\n` || canonical(existing) !== canonical(report)) {
      throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_REPORT_MISMATCH');
    }
    return;
  }
  await writeExclusive(reportPath, reportBytes);
  await syncFileAndDirectory(reportPath);
}

async function readJournal(root: string, marker: Marker) {
  const bytes = await readRegular(resolveContained(root, journalPathFor(marker.runId)));
  const records = bytes
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => JOURNAL_SCHEMA.parse(JSON.parse(line)));
  if (!records.length) throw new Error('INVALID');
  let previousHash: string | null = null;
  records.forEach((record, index) => {
    const { recordHash, ...unsigned } = record;
    if (
      record.sequence !== index ||
      record.previousHash !== previousHash ||
      record.runId !== marker.runId ||
      record.lineage !== PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE ||
      recordHash !== sha256(canonical(unsigned))
    ) {
      throw new Error('INVALID');
    }
    previousHash = record.recordHash;
  });
  if (
    records[0]?.event !== 'attempt_reserved' ||
    records[0].markerSha256 !== sha256(`${canonical(marker)}\n`)
  ) {
    throw new Error('INVALID');
  }
  let terminalSeen = false;
  let publicationStartedSeen = false;
  let publishedSeen = false;
  let recoveryClaimSeen = false;
  const caseIds = new Set<string>();
  records.forEach((record, index) => {
    if (publishedSeen) throw new Error('INVALID');
    switch (record.event) {
      case 'attempt_reserved':
        if (index !== 0) throw new Error('INVALID');
        break;
      case 'case_terminal':
        if (terminalSeen || publicationStartedSeen || caseIds.has(record.caseId)) {
          throw new Error('INVALID');
        }
        caseIds.add(record.caseId);
        break;
      case 'recovery_claimed':
        if (recoveryClaimSeen) throw new Error('INVALID');
        recoveryClaimSeen = true;
        break;
      case 'run_terminal':
        if (terminalSeen || publicationStartedSeen || caseIds.size !== 30) {
          throw new Error('INVALID');
        }
        terminalSeen = true;
        break;
      case 'publication_started':
        if (!terminalSeen || publicationStartedSeen) throw new Error('INVALID');
        publicationStartedSeen = true;
        break;
      case 'evidence_published':
        if (!terminalSeen || !publicationStartedSeen || publishedSeen) throw new Error('INVALID');
        publishedSeen = true;
        break;
      default:
        throw new Error('INVALID');
    }
  });
  return records;
}

async function findMarkerRelativePath(root: string) {
  const tmpPath = resolveContained(root, '.tmp');
  const entries = await readdir(tmpPath);
  const markers = entries.filter((entry) =>
    /^phase-6-9-8-retriever-final-response-transport-evidence-t2-[0-9a-f-]{36}\.marker\.json$/u.test(
      entry,
    ),
  );
  if (markers.length !== 1 || !markers[0]) throw new Error('INVALID');
  const marker = markers[0];
  return `.tmp/${marker}`;
}

async function ensureOnlyExpectedFiles(root: string, runId: string) {
  const expectedRoot = new Set([artifactPathFor(runId)]);
  const rootEntries = await readdir(root);
  if (rootEntries.some((entry) => !expectedRoot.has(entry) && entry !== '.tmp'))
    throw new Error('INVALID');
  const expectedTmp = new Set([
    markerPathFor(runId).slice('.tmp/'.length),
    journalPathFor(runId).slice('.tmp/'.length),
    reportPathFor(runId).slice('.tmp/'.length),
  ]);
  const tmpEntries = await readdir(resolveContained(root, '.tmp'));
  if (tmpEntries.some((entry) => !expectedTmp.has(entry))) throw new Error('INVALID');
}

async function ensureNoFormalFiles(root: string, allowed: readonly string[]) {
  const allowedAbsolute = new Set(allowed.map((path) => resolveContained(root, path)));
  const rootEntries = await readdir(root);
  if (
    rootEntries.some(
      (entry) => entry !== '.tmp' && !allowedAbsolute.has(resolveContained(root, entry)),
    )
  )
    throw new Error('INVALID');
  const tmpEntries = await readdir(resolveContained(root, '.tmp'));
  if (tmpEntries.some((entry) => !allowedAbsolute.has(resolveContained(root, `.tmp/${entry}`))))
    throw new Error('INVALID');
}

async function requireSyntheticRoot(input: string) {
  const root = resolve(input);
  await mkdir(root, { recursive: true });
  const [rootStat, canonicalRoot] = await Promise.all([lstat(root), realpath(root)]);
  if (
    !rootStat.isDirectory() ||
    rootStat.isSymbolicLink() ||
    canonicalRoot !== root ||
    !basename(root).startsWith(SYNTHETIC_ROOT_PREFIX)
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_ROOT_INVALID');
  }
  await mkdir(resolveContained(root, '.tmp'), { recursive: true });
  const tmp = resolveContained(root, '.tmp');
  const [tmpStat, canonicalTmp] = await Promise.all([lstat(tmp), realpath(tmp)]);
  if (!tmpStat.isDirectory() || tmpStat.isSymbolicLink() || canonicalTmp !== tmp)
    throw new Error('INVALID');
  return root;
}

function resolveContained(root: string, relativePath: string) {
  if (
    !isPhase698TransportEvidenceT2WritableRelativePathForTest(relativePath) &&
    relativePath !== '.tmp'
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_PATH_INVALID');
  }
  const candidate = resolve(root, relativePath);
  const rootPrefix = `${resolve(root)}\\`;
  if (
    candidate !== resolve(root) &&
    !candidate.startsWith(rootPrefix) &&
    !candidate.startsWith(`${resolve(root)}/`)
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_PATH_INVALID');
  }
  return candidate;
}

async function appendStateRecord(state: State, input: JournalInput) {
  const record = nextRecord(state, input);
  await appendFile(state.journalPath, `${canonical(record)}\n`);
  await syncFileAndDirectory(state.journalPath);
  state.records.push(record);
}

function nextRecord(state: State, input: JournalInput): Phase698TransportEvidenceT2JournalRecord {
  const unsigned = {
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId: state.runId,
    sequence: state.records.length,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...input,
  };
  return JOURNAL_SCHEMA.parse({
    ...unsigned,
    recordHash: sha256(canonical(unsigned)),
  });
}

function enqueue(state: State, task: () => Promise<void>) {
  const next = state.queue.then(task);
  state.queue = next.catch(() => undefined);
  return next;
}

function enqueueResult<T>(state: State, task: () => Promise<T>) {
  const next = state.queue.then(task);
  state.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function writeExclusive(path: string, bytes: string) {
  const handle = await open(
    path,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o600,
  );
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncFileAndDirectory(path: string) {
  // Windows/Bun can reject fsync on a read-only descriptor. These files are
  // created by this module with owner-write permissions, so use a writable
  // descriptor for the file barrier while retaining a strict error policy.
  const handle = await open(path, process.platform === 'win32' ? 'r+' : 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}

async function syncDirectory(path: string) {
  const handle = await open(path, 'r');
  try {
    try {
      await handle.sync();
    } catch (error) {
      // Directory fsync is unsupported by Windows filesystems exposed through
      // Bun. Keep the barrier strict elsewhere, but tolerate only these two
      // platform-specific errors (matching the existing durability contract).
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

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

async function readRegular(path: string) {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error('INVALID');
  return readFile(path, 'utf8');
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(',')}}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
