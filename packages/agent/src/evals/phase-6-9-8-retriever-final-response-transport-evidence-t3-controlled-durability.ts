import { createHash, randomUUID } from 'node:crypto';
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
import { dirname, isAbsolute, relative as relativePath, resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PROXY_RECEIPT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA,
  consumePhase698TransportEvidenceT3ReservationCapability,
  type Phase698TransportEvidenceT3ProxyReceipt,
  type Phase698TransportEvidenceT3ReservationCapability,
  type Phase698TransportEvidenceT3Source,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';
import { PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE } from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA,
  type Phase698TransportEvidenceT3ControlledReport,
  type Phase698TransportEvidenceT3ControlledSlot,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-live.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-durability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-marker-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_JOURNAL_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-journal-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-artifact-v1' as const;

const UUID = z.string().uuid();
const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const FORMAL_TMP_FILE =
  /^phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-[0-9a-f-]{36}\.(?:marker\.json|journal\.jsonl|report\.json)$/u;
const FORMAL_ROOT_FILE =
  /^phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-[0-9a-f-]{36}\.json(?:\.tmp-[0-9a-f-]{36})?$/u;

const markerPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-${runId}.marker.json`;
const journalPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-${runId}.journal.jsonl`;
const reportPathFor = (runId: string) =>
  `.tmp/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-${runId}.report.json`;
const artifactPathFor = (runId: string) =>
  `phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-${runId}.json`;

const MARKER = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runMode: z.literal('controlled_live'),
    source: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA,
    proxy: z
      .object({
        code: z.enum(['direct_ready', 'loopback_proxy_ready']),
        mode: z.enum(['direct', 'loopback_proxy']),
        listener: z.enum(['not_required', 'listening']),
        listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
        nonceSha256: HEX,
      })
      .strict(),
    plannedSlots: z.literal(3),
    credentialReads: z.literal(0),
    providerCalls: z.literal(0),
    formalEvidence: z.literal(0),
    creatorPid: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
type Marker = Readonly<{
  markerVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_MARKER_VERSION;
  durabilityVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  runId: string;
  authority: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY;
  qualityAuthority: 'none';
  runMode: 'controlled_live';
  source: Phase698TransportEvidenceT3Source;
  proxy: Readonly<{
    code: 'direct_ready' | 'loopback_proxy_ready';
    mode: 'direct' | 'loopback_proxy';
    listener: 'not_required' | 'listening';
    listenerProbeCalls: 0 | 1;
    nonceSha256: string;
  }>;
  plannedSlots: 3;
  credentialReads: 0;
  providerCalls: 0;
  formalEvidence: 0;
  creatorPid: number;
  createdAt: string;
}>;

const JOURNAL_COMMON = {
  version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
  runId: UUID,
  sequence: z.number().int().nonnegative(),
  previousHash: HEX.nullable(),
  recordHash: HEX,
};
const JOURNAL = z.discriminatedUnion('event', [
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
      event: z.literal('slot_terminal'),
      slot: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('run_terminal'),
      reportSha256: HEX,
      slotCount: z.literal(3),
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
type JournalBase = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_JOURNAL_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  runId: string;
  sequence: number;
  previousHash: string | null;
  recordHash: string;
}>;
type JournalRecord =
  | (JournalBase & { event: 'attempt_reserved'; markerSha256: string; createdAt: string })
  | (JournalBase & { event: 'slot_terminal'; slot: Phase698TransportEvidenceT3ControlledSlot })
  | (JournalBase & { event: 'run_terminal'; reportSha256: string; slotCount: 3 })
  | (JournalBase & { event: 'publication_started'; reportSha256: string })
  | (JournalBase & { event: 'evidence_published'; evidenceSha256: string });
type JournalInput =
  | { event: 'attempt_reserved'; markerSha256: string; createdAt: string }
  | { event: 'slot_terminal'; slot: Phase698TransportEvidenceT3ControlledSlot }
  | { event: 'run_terminal'; reportSha256: string; slotCount: 3 }
  | { event: 'publication_started'; reportSha256: string }
  | { event: 'evidence_published'; evidenceSha256: string };

const ARTIFACT = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    runId: UUID,
    markerSha256: HEX,
    proxyNonceSha256: HEX,
    reportLogicalSha256: HEX,
    durability: z
      .object({
        publicationMode: z.literal('runtime'),
        terminalSequence: z.number().int().nonnegative(),
        terminalRecordHash: HEX,
        journalRecordsBeforePublication: z.number().int().positive(),
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    source: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA,
    report: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA,
  })
  .strict();
type Artifact = Readonly<{
  artifactVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARTIFACT_VERSION;
  durabilityVersion: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE;
  runId: string;
  markerSha256: string;
  proxyNonceSha256: string;
  reportLogicalSha256: string;
  durability: Readonly<{
    publicationMode: 'runtime';
    terminalSequence: number;
    terminalRecordHash: string;
    journalRecordsBeforePublication: number;
    hardLink: true;
    rawDataRetained: false;
  }>;
  source: Phase698TransportEvidenceT3Source;
  report: Phase698TransportEvidenceT3ControlledReport;
}>;

export type Phase698TransportEvidenceT3ControlledReservation = Readonly<{
  runId: string;
  appendSlotTerminal(slot: Phase698TransportEvidenceT3ControlledSlot): Promise<void>;
  appendRunTerminal(report: Phase698TransportEvidenceT3ControlledReport): Promise<void>;
  publishArtifact(
    report: Phase698TransportEvidenceT3ControlledReport,
  ): Promise<Readonly<{ evidenceSha256: string }>>;
}>;

type State = {
  root: string;
  runId: string;
  marker: Marker;
  markerSha256: string;
  journalPath: string;
  records: JournalRecord[];
  slots: Map<string, Phase698TransportEvidenceT3ControlledSlot>;
  report: Phase698TransportEvidenceT3ControlledReport | null;
  queue: Promise<void>;
};

export async function reservePhase698TransportEvidenceT3ControlledAttempt(input: {
  root: string;
  runId: string;
  createdAt: string;
  source: Phase698TransportEvidenceT3Source;
  proxy: Phase698TransportEvidenceT3ProxyReceipt;
  reservationCapability: Phase698TransportEvidenceT3ReservationCapability;
}): Promise<Phase698TransportEvidenceT3ControlledReservation> {
  const root = await requireRoot(input.root);
  const admission = consumePhase698TransportEvidenceT3ReservationCapability(
    input.reservationCapability,
    root,
  );
  if (admission.authority !== 'controlled_live') throw new Error('T3_CONTROLLED_AUTHORITY_INVALID');
  const source = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse(admission.source);
  const inputSource = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SOURCE_SCHEMA.parse(input.source);
  if (canonical(source) !== canonical(inputSource))
    throw new Error('T3_CONTROLLED_SOURCE_MISMATCH');
  const proxy = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_PROXY_RECEIPT_SCHEMA.parse(input.proxy);
  const runId = UUID.parse(input.runId);
  const createdAt = z.string().datetime({ offset: true }).parse(input.createdAt);
  await ensureTmp(root);
  if ((await controlledFormalFiles(root)).length !== 0) {
    throw new Error('T3_CONTROLLED_ONCE_ALREADY_CONSUMED');
  }
  const marker = MARKER.parse({
    markerVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId,
    authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY,
    qualityAuthority: 'none',
    runMode: 'controlled_live',
    source,
    proxy: {
      code: proxy.code,
      mode: proxy.mode,
      listener: proxy.listener,
      listenerProbeCalls: proxy.listenerProbeCalls,
      nonceSha256: sha256(proxy.nonce),
    },
    plannedSlots: 3,
    credentialReads: 0,
    providerCalls: 0,
    formalEvidence: 0,
    creatorPid: process.pid,
    createdAt,
  }) as Marker;
  const markerRelative = markerPathFor(runId);
  const journalRelative = journalPathFor(runId);
  const reportRelative = reportPathFor(runId);
  const artifactRelative = artifactPathFor(runId);
  await ensureNoFormalFiles(root, [
    markerRelative,
    journalRelative,
    reportRelative,
    artifactRelative,
  ]);
  const markerBytes = `${canonical(marker)}\n`;
  const markerPath = resolveContained(root, markerRelative);
  await writeExclusive(markerPath, markerBytes);
  await syncFileAndDirectory(markerPath);
  const state: State = {
    root,
    runId,
    marker,
    markerSha256: sha256(markerBytes),
    journalPath: resolveContained(root, journalRelative),
    records: [],
    slots: new Map(),
    report: null,
    queue: Promise.resolve(),
  };
  const reserved = nextRecord(state, {
    event: 'attempt_reserved',
    markerSha256: state.markerSha256,
    createdAt,
  });
  await writeExclusive(state.journalPath, `${canonical(reserved)}\n`);
  await syncFileAndDirectory(state.journalPath);
  state.records.push(reserved);
  return reservationFromState(state);
}

export async function validatePhase698TransportEvidenceT3ControlledBundle(input: { root: string }) {
  try {
    const root = await requireRoot(input.root);
    const markerRelative = await findMarkerRelativePath(root);
    const markerBytes = await readRegular(resolveContained(root, markerRelative));
    const marker = MARKER.parse(JSON.parse(markerBytes)) as Marker;
    if (markerBytes !== `${canonical(marker)}\n`) throw new Error('marker_canonical');
    const records = await readJournal(root, marker);
    const slotRecords = records.filter((record) => record.event === 'slot_terminal');
    if (slotRecords.length !== 3) throw new Error('slot_count');
    const terminal = records.find((record) => record.event === 'run_terminal');
    const publication = records.find((record) => record.event === 'publication_started');
    const published = records.find((record) => record.event === 'evidence_published');
    if (!terminal || !publication || !published) throw new Error('terminal_missing');
    const reportBytes = await readRegular(resolveContained(root, reportPathFor(marker.runId)));
    const report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA.parse(
      JSON.parse(reportBytes),
    );
    if (
      reportBytes !== `${canonical(report)}\n` ||
      terminal.reportSha256 !== sha256(canonical(report)) ||
      publication.reportSha256 !== terminal.reportSha256
    ) {
      throw new Error('report_mismatch');
    }
    const expectedSlots = new Map(report.slots.map((slot) => [slot.slot, canonical(slot)]));
    for (const record of slotRecords) {
      if (expectedSlots.get(record.slot.slot) !== canonical(record.slot))
        throw new Error('slot_mismatch');
    }
    const artifactBytes = await readRegular(resolveContained(root, artifactPathFor(marker.runId)));
    const artifact = ARTIFACT.parse(JSON.parse(artifactBytes)) as Artifact;
    if (
      artifactBytes !== `${canonical(artifact)}\n` ||
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== sha256(markerBytes) ||
      artifact.reportLogicalSha256 !== sha256(canonical(report)) ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publication.sequence ||
      artifact.source.commit !== marker.source.commit ||
      artifact.proxyNonceSha256 !== marker.proxy.nonceSha256 ||
      published.evidenceSha256 !== sha256(artifactBytes)
    ) {
      throw new Error('artifact_mismatch');
    }
    await ensureOnlyExpectedFiles(root, marker.runId);
    return Object.freeze({
      ok: true as const,
      runId: marker.runId,
      gate: report.gate,
      qualityAuthority: report.qualityAuthority,
      journalRecords: records.length,
      finalJournalEvent: 'evidence_published' as const,
      reportLogicalSha256: sha256(canonical(report)),
      physicalArtifactSha256: sha256(artifactBytes),
      providerCalls: report.providerCalls,
      credentialReads: report.credentialReads,
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
      providerCalls: 0,
      credentialReads: 0,
    });
  }
}

function reservationFromState(state: State): Phase698TransportEvidenceT3ControlledReservation {
  return Object.freeze({
    runId: state.runId,
    appendSlotTerminal: (slot) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA.parse(slot);
        if (state.report !== null) throw new Error('T3_CONTROLLED_ALREADY_TERMINAL');
        if (state.slots.has(parsed.slot)) throw new Error('T3_CONTROLLED_DUPLICATE_SLOT');
        const expectedSlot = ['rewrite', 'qwen', 'final_response'][state.slots.size];
        if (parsed.slot !== expectedSlot || parsed.sequence !== state.slots.size + 1) {
          throw new Error('T3_CONTROLLED_SLOT_ORDER_INVALID');
        }
        state.slots.set(parsed.slot, parsed);
        await appendRecord(state, { event: 'slot_terminal', slot: parsed });
      }),
    appendRunTerminal: (report) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA.parse(report);
        if (state.report !== null) throw new Error('T3_CONTROLLED_DUPLICATE_TERMINAL');
        if (state.slots.size !== 3) throw new Error('T3_CONTROLLED_INCOMPLETE_SLOTS');
        for (const slot of parsed.slots) {
          const stored = state.slots.get(slot.slot);
          if (!stored || canonical(stored) !== canonical(slot))
            throw new Error('T3_CONTROLLED_SLOT_REPORT_MISMATCH');
        }
        await writeReportSnapshot(state.root, state.runId, parsed);
        state.report = parsed;
        await appendRecord(state, {
          event: 'run_terminal',
          reportSha256: sha256(canonical(parsed)),
          slotCount: 3,
        });
      }),
    publishArtifact: (report) =>
      enqueueResult(state, async () => publishStateArtifact(state, report)),
  });
}

async function publishStateArtifact(
  state: State,
  reportInput: Phase698TransportEvidenceT3ControlledReport,
) {
  const report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA.parse(reportInput);
  if (!state.report || canonical(state.report) !== canonical(report))
    throw new Error('T3_CONTROLLED_REPORT_MISMATCH');
  if (state.records.some((record) => record.event === 'evidence_published'))
    throw new Error('T3_CONTROLLED_ALREADY_PUBLISHED');
  const terminal = state.records.find((record) => record.event === 'run_terminal');
  if (!terminal) throw new Error('T3_CONTROLLED_TERMINAL_MISSING');
  if (!state.records.some((record) => record.event === 'publication_started')) {
    await appendRecord(state, {
      event: 'publication_started',
      reportSha256: sha256(canonical(report)),
    });
  }
  const publication = state.records.find((record) => record.event === 'publication_started');
  if (!publication) throw new Error('T3_CONTROLLED_PUBLICATION_MISSING');
  const artifact = ARTIFACT.parse({
    artifactVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    proxyNonceSha256: state.marker.proxy.nonceSha256,
    reportLogicalSha256: sha256(canonical(report)),
    durability: {
      publicationMode: 'runtime',
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publication.sequence,
      hardLink: true,
      rawDataRetained: false,
    },
    source: state.marker.source,
    report,
  }) as Artifact;
  const bytes = `${canonical(artifact)}\n`;
  const artifactPath = resolveContained(state.root, artifactPathFor(state.runId));
  const tempPath = `${artifactPath}.tmp-${randomUUID()}`;
  await writeExclusive(tempPath, bytes);
  await syncFileAndDirectory(tempPath);
  try {
    await link(tempPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = sha256(bytes);
  await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({ relativePath: artifactPathFor(state.runId), evidenceSha256 });
}

async function appendRecord(state: State, input: JournalInput) {
  const record = nextRecord(state, input);
  await appendFile(state.journalPath, `${canonical(record)}\n`, { flag: 'a' });
  await syncFileAndDirectory(state.journalPath);
  state.records.push(record);
}

function nextRecord(state: State, input: JournalInput): JournalRecord {
  const unsigned = {
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    runId: state.runId,
    sequence: state.records.length,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...input,
  };
  return JOURNAL.parse({ ...unsigned, recordHash: sha256(canonical(unsigned)) });
}

async function readJournal(root: string, marker: Marker) {
  const bytes = await readRegular(resolveContained(root, journalPathFor(marker.runId)));
  const records = bytes
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => JOURNAL.parse(JSON.parse(line)) as JournalRecord);
  if (records.length < 1) throw new Error('journal_empty');
  let previousHash: string | null = null;
  records.forEach((record, index) => {
    const { recordHash, ...unsigned } = record;
    if (
      record.sequence !== index ||
      record.previousHash !== previousHash ||
      record.runId !== marker.runId ||
      recordHash !== sha256(canonical(unsigned))
    ) {
      throw new Error('journal_hash_chain');
    }
    previousHash = record.recordHash;
  });
  if (
    records[0]?.event !== 'attempt_reserved' ||
    records[0].markerSha256 !== sha256(`${canonical(marker)}\n`)
  ) {
    throw new Error('journal_prefix');
  }
  let terminalSeen = false;
  let publicationSeen = false;
  let publishedSeen = false;
  const slots: string[] = [];
  records.forEach((record, index) => {
    if (publishedSeen) throw new Error('journal_after_publication');
    switch (record.event) {
      case 'attempt_reserved':
        if (index !== 0) throw new Error('attempt_position');
        break;
      case 'slot_terminal':
        if (terminalSeen || publicationSeen || record.slot.sequence !== slots.length + 1) {
          throw new Error('slot_position');
        }
        if (record.slot.slot !== ['rewrite', 'qwen', 'final_response'][slots.length]) {
          throw new Error('slot_order');
        }
        slots.push(record.slot.slot);
        break;
      case 'run_terminal':
        if (terminalSeen || publicationSeen || slots.length !== 3)
          throw new Error('terminal_position');
        terminalSeen = true;
        break;
      case 'publication_started':
        if (!terminalSeen || publicationSeen) throw new Error('publication_position');
        publicationSeen = true;
        break;
      case 'evidence_published':
        if (!terminalSeen || !publicationSeen || publishedSeen)
          throw new Error('published_position');
        publishedSeen = true;
        break;
      default:
        throw new Error('journal_event');
    }
  });
  return records;
}

async function writeReportSnapshot(
  root: string,
  runId: string,
  report: Phase698TransportEvidenceT3ControlledReport,
) {
  const path = resolveContained(root, reportPathFor(runId));
  const bytes = `${canonical(report)}\n`;
  if (await exists(path)) {
    const existing = await readRegular(path);
    if (existing !== bytes) throw new Error('report_snapshot_mismatch');
    return;
  }
  await writeExclusive(path, bytes);
  await syncFileAndDirectory(path);
}

async function ensureOnlyExpectedFiles(root: string, runId: string) {
  const observed = new Set(await controlledFormalFiles(root));
  const expected = new Set([
    markerPathFor(runId),
    journalPathFor(runId),
    reportPathFor(runId),
    artifactPathFor(runId),
  ]);
  if (observed.size !== expected.size || [...observed].some((name) => !expected.has(name))) {
    throw new Error('formal_file_set_mismatch');
  }
}

async function controlledFormalFiles(root: string) {
  const observed: string[] = [];
  try {
    const entries = await readdir(resolveContained(root, '.tmp'), { withFileTypes: true });
    observed.push(
      ...entries
        .filter((entry) => entry.isFile() && FORMAL_TMP_FILE.test(entry.name))
        .map((entry) => `.tmp/${entry.name}`),
    );
  } catch (error) {
    if (!isCode(error, 'ENOENT')) throw error;
  }
  const rootEntries = await readdir(root, { withFileTypes: true });
  observed.push(
    ...rootEntries
      .filter((entry) => entry.isFile() && FORMAL_ROOT_FILE.test(entry.name))
      .map((entry) => entry.name),
  );
  return observed;
}

async function findMarkerRelativePath(root: string) {
  const entries = await controlledFormalFiles(root);
  const markers = entries.filter(
    (entry) => entry.startsWith('.tmp/') && entry.endsWith('.marker.json'),
  );
  if (markers.length !== 1) throw new Error('marker_count');
  return markers[0];
}

async function ensureTmp(root: string) {
  await mkdir(resolveContained(root, '.tmp'), { recursive: true });
}

async function ensureNoFormalFiles(root: string, relativePaths: readonly string[]) {
  for (const relative of relativePaths) {
    if (await exists(resolveContained(root, relative))) throw new Error('formal_file_exists');
  }
}

async function requireRoot(input: string) {
  const root = await realpath(resolve(input));
  const git = await stat(resolve(root, '.git')).catch(() => null);
  if (!git || !git.isDirectory()) throw new Error('trusted_root_invalid');
  return root;
}

function resolveContained(root: string, relative: string) {
  if (!relative || relative.includes('\\') || relative.split('/').includes('..'))
    throw new Error('path_invalid');
  const rootResolved = resolve(root);
  const candidate = resolve(rootResolved, relative);
  const fromRoot = relativePath(rootResolved, candidate);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) throw new Error('path_escape');
  return candidate;
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

async function syncFileAndDirectory(path: string) {
  const handle = await open(path, process.platform === 'win32' ? 'r+' : 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}

async function syncDirectory(path: string) {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    if (process.platform === 'win32' && (isCode(error, 'EPERM') || isCode(error, 'EINVAL'))) return;
    throw error;
  }
  try {
    try {
      await handle.sync();
    } catch (error) {
      if (process.platform !== 'win32' || (!isCode(error, 'EPERM') && !isCode(error, 'EINVAL'))) {
        throw error;
      }
    }
  } finally {
    await handle.close();
  }
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

async function readRegular(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('not_regular');
  return readFile(path, 'utf8');
}

async function exists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isCode(error, 'ENOENT')) return false;
    throw error;
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isCode(error: unknown, code: string) {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}
