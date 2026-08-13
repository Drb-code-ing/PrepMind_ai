import { createHash, randomUUID } from 'node:crypto';
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
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

import { z } from 'zod';

import type { Phase698Sr5RuntimeSourceBindingRecord } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-source-binding-contract.ts';

export const PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-runtime-runner-durability-v1' as const;
export const PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_AUTHORITY =
  'zero_provider_retriever_final_response_schema_recovery_sr5_runtime_runner_durability' as const;
export const PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_GATE =
  'sr5_runtime_runner_durability_ready_zero_provider' as const;

const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const SOURCE_SHA256 = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const MARKER_BASENAME = 'phase-6-9-8-sr5-runtime-runner.marker.json';
const ROOT_PREFIX = 'prepmind-sr5-runtime-runner-';
const LANE_COUNT = 12;
const GUARD_COUNT = 8;
const issuedSyntheticCapabilities = new WeakMap<object, Phase698Sr5RuntimeSourceBindingRecord>();
const consumedSyntheticCapabilities = new WeakSet<object>();

const SOURCE_SCHEMA = z
  .object({
    branch: z.literal('main'),
    head: z.string().regex(/^[0-9a-f]{40}$/u),
    sourceManifestSha256: SOURCE_SHA256,
    sourceBundleSha256: SOURCE_SHA256,
    approvedTag: z.string().min(1),
    approvedTagObjectId: z.string().regex(/^[0-9a-f]{40}$/u),
  })
  .strict();

const MARKER_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION),
    lineage: z.literal('phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-v1'),
    runId: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    creatorPid: z.number().int().positive(),
    source: SOURCE_SCHEMA,
    plannedGuards: z.literal(GUARD_COUNT),
    plannedLanes: z.literal(LANE_COUNT),
    providerDispatchAllowed: z.literal(false),
  })
  .strict();

const JOURNAL_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION),
    runId: z.string().uuid(),
    sequence: z.number().int().positive(),
    previousHash: SHA256.nullable(),
    event: z.enum([
      'attempt_reserved',
      'guards_completed',
      'lanes_accounted',
      'recovery_claimed',
      'run_terminal',
      'evidence_published',
    ]),
    guardCount: z.number().int().min(0).max(GUARD_COUNT),
    laneCount: z.number().int().min(0).max(LANE_COUNT),
    reportSha256: SHA256.nullable(),
    artifactSha256: SHA256.nullable(),
    recordHash: SHA256,
  })
  .strict();

const REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION),
    authority: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_AUTHORITY),
    gate: z.enum([
      PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_GATE,
      'sr5_runtime_runner_interrupted_zero_provider',
    ]),
    qualityAuthority: z.literal('none'),
    mode: z.literal('synthetic_zero_provider'),
    runId: z.string().uuid(),
    source: SOURCE_SCHEMA,
    guards: z
      .object({
        planned: z.literal(GUARD_COUNT),
        completed: z.number().int().min(0).max(GUARD_COUNT),
      })
      .strict(),
    lanes: z
      .object({
        planned: z.literal(LANE_COUNT),
        reserved: z.number().int().min(0).max(LANE_COUNT),
        dispatches: z.literal(0),
        responses: z.literal(0),
        notStarted: z.literal(LANE_COUNT),
      })
      .strict(),
    runnerInvocationAllowed: z.literal(false),
    providerDispatchAllowed: z.literal(false),
    credentialReads: z.literal(0),
    providerCalls: z.literal(0),
    formalEvidence: z.literal(0),
    businessWrites: z.literal(0),
    completionMode: z.enum(['runtime', 'crash_only_recovery']),
  })
  .strict()
  .superRefine((report, context) => {
    const runtime = report.completionMode === 'runtime';
    if (
      (runtime &&
        (report.gate !== PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_GATE ||
          report.guards.completed !== GUARD_COUNT ||
          report.lanes.reserved !== LANE_COUNT)) ||
      (!runtime &&
        (report.gate !== 'sr5_runtime_runner_interrupted_zero_provider' ||
          report.guards.completed !== 0 ||
          report.lanes.reserved !== 0))
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'completion_mode_invalid' });
    }
  });

const RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION),
    runId: z.string().uuid(),
    state: z.literal('crash_only_recovery_claimed'),
    journalTailRecordHash: SHA256,
  })
  .strict();

const ARTIFACT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION),
    runId: z.string().uuid(),
    markerSha256: SHA256,
    reportSha256: SHA256,
    terminalRecordHash: SHA256,
    report: REPORT_SCHEMA,
  })
  .strict();

type Journal = z.infer<typeof JOURNAL_SCHEMA>;
type Report = z.infer<typeof REPORT_SCHEMA>;

export type Phase698Sr5RuntimeRunnerReservation = Readonly<{
  root: string;
  runId: string;
  runSyntheticZeroProvider(): Promise<Readonly<{ report: Report; artifactSha256: string }>>;
}>;
export type Phase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest = Readonly<{
  version: typeof PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION;
}>;

export function createPhase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest(
  record: Phase698Sr5RuntimeSourceBindingRecord,
): Phase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest {
  const capability = Object.freeze({ version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION });
  issuedSyntheticCapabilities.set(capability, record);
  return capability;
}

export async function createPhase698Sr5RuntimeRunnerSyntheticRootForTest() {
  return mkdtemp(join(tmpdir(), ROOT_PREFIX));
}

export async function removePhase698Sr5RuntimeRunnerSyntheticRootForTest(root: string) {
  await rm(root, { recursive: true, force: true });
}

export async function reservePhase698Sr5RuntimeRunnerAttemptForTest(
  input: Readonly<{
    root: string;
    sourceBindingCapability: Phase698Sr5RuntimeRunnerSyntheticSourceCapabilityForTest;
    runId?: string;
    createdAt?: string;
  }>,
): Promise<Phase698Sr5RuntimeRunnerReservation> {
  const root = await requireSyntheticRoot(input.root);
  const sourceBinding = consumeSyntheticSourceCapability(input.sourceBindingCapability);
  const runId = z
    .string()
    .uuid()
    .parse(input.runId ?? randomUUID());
  const createdAt = z
    .string()
    .datetime({ offset: true })
    .parse(input.createdAt ?? new Date().toISOString());
  await mkdir(join(root, '.tmp'), { recursive: true });
  if ((await readdir(join(root, '.tmp'))).length !== 0) throw invalid();
  const marker = MARKER_SCHEMA.parse({
    version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
    lineage: 'phase-6.9.8-retriever-final-response-schema-recovery-sr5-next-lineage-v1',
    runId,
    createdAt,
    creatorPid: process.pid,
    source: projectSource(sourceBinding),
    plannedGuards: GUARD_COUNT,
    plannedLanes: LANE_COUNT,
    providerDispatchAllowed: false,
  });
  const markerBytes = bytes(marker);
  const markerPath = contained(root, `.tmp/${MARKER_BASENAME}`);
  await writeExclusive(markerPath, markerBytes);
  const journalPath = contained(root, `.tmp/phase-6-9-8-sr5-runtime-runner-${runId}.journal.jsonl`);
  const first = nextRecord(runId, [], 'attempt_reserved', 0, 0, null, null);
  await writeExclusive(journalPath, bytes(first));

  let used = false;
  return Object.freeze({
    root,
    runId,
    runSyntheticZeroProvider: async () => {
      if (used) throw invalid();
      used = true;
      const records = [first];
      await append(journalPath, records, 'guards_completed', GUARD_COUNT, 0, null, null);
      await append(journalPath, records, 'lanes_accounted', GUARD_COUNT, LANE_COUNT, null, null);
      const report = REPORT_SCHEMA.parse({
        version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
        authority: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_AUTHORITY,
        gate: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_GATE,
        qualityAuthority: 'none',
        mode: 'synthetic_zero_provider',
        runId,
        source: marker.source,
        guards: { planned: GUARD_COUNT, completed: GUARD_COUNT },
        lanes: {
          planned: LANE_COUNT,
          reserved: LANE_COUNT,
          dispatches: 0,
          responses: 0,
          notStarted: LANE_COUNT,
        },
        runnerInvocationAllowed: false,
        providerDispatchAllowed: false,
        credentialReads: 0,
        providerCalls: 0,
        formalEvidence: 0,
        businessWrites: 0,
        completionMode: 'runtime',
      });
      const reportSha = digest(canonical(report));
      const terminal = await append(
        journalPath,
        records,
        'run_terminal',
        GUARD_COUNT,
        LANE_COUNT,
        reportSha,
        null,
      );
      const artifact = ARTIFACT_SCHEMA.parse({
        version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
        runId,
        markerSha256: digest(markerBytes),
        reportSha256: reportSha,
        terminalRecordHash: terminal.recordHash,
        report,
      });
      const reportPath = contained(
        root,
        `.tmp/phase-6-9-8-sr5-runtime-runner-${runId}.report.json`,
      );
      const artifactPath = contained(root, `phase-6-9-8-sr5-runtime-runner-${runId}.json`);
      await writeExclusive(reportPath, bytes(artifact));
      await link(reportPath, artifactPath);
      const artifactSha = digest(bytes(artifact));
      await append(
        journalPath,
        records,
        'evidence_published',
        GUARD_COUNT,
        LANE_COUNT,
        reportSha,
        artifactSha,
      );
      return Object.freeze({ report, artifactSha256: artifactSha });
    },
  });
}

export async function sealPhase698Sr5RuntimeRunnerInterruptedAttemptForTest(
  input: Readonly<{ root: string; isProcessAlive: (pid: number) => boolean }>,
) {
  try {
    const root = await requireSyntheticRoot(input.root);
    const markerBytes = await readRegular(contained(root, `.tmp/${MARKER_BASENAME}`));
    const marker = MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== bytes(marker) || input.isProcessAlive(marker.creatorPid)) {
      return Object.freeze({
        ok: false as const,
        code: 'process_active_or_marker_invalid' as const,
      });
    }
    const journalPath = contained(
      root,
      `.tmp/phase-6-9-8-sr5-runtime-runner-${marker.runId}.journal.jsonl`,
    );
    const records = await readJournal(journalPath, marker.runId);
    if (records.some((record) => record.event === 'evidence_published')) {
      return Object.freeze({ ok: false as const, code: 'already_published' as const });
    }
    if (records.length !== 1 || records[0]?.event !== 'attempt_reserved') {
      return Object.freeze({ ok: false as const, code: 'journal_invalid' as const });
    }
    const claim = RECOVERY_CLAIM_SCHEMA.parse({
      version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
      runId: marker.runId,
      state: 'crash_only_recovery_claimed',
      journalTailRecordHash: records[0].recordHash,
    });
    await writeExclusive(
      contained(root, `.tmp/phase-6-9-8-sr5-runtime-runner-${marker.runId}.recovery.json`),
      bytes(claim),
    );
    await append(journalPath, records, 'recovery_claimed', 0, 0, null, null);
    const report = REPORT_SCHEMA.parse({
      version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
      authority: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_AUTHORITY,
      gate: 'sr5_runtime_runner_interrupted_zero_provider',
      qualityAuthority: 'none',
      mode: 'synthetic_zero_provider',
      runId: marker.runId,
      source: marker.source,
      guards: { planned: GUARD_COUNT, completed: 0 },
      lanes: {
        planned: LANE_COUNT,
        reserved: 0,
        dispatches: 0,
        responses: 0,
        notStarted: LANE_COUNT,
      },
      runnerInvocationAllowed: false,
      providerDispatchAllowed: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
      completionMode: 'crash_only_recovery',
    });
    const reportSha = digest(canonical(report));
    const terminal = await append(journalPath, records, 'run_terminal', 0, 0, reportSha, null);
    const artifact = ARTIFACT_SCHEMA.parse({
      version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
      runId: marker.runId,
      markerSha256: digest(markerBytes),
      reportSha256: reportSha,
      terminalRecordHash: terminal.recordHash,
      report,
    });
    const artifactBytes = bytes(artifact);
    const reportPath = contained(
      root,
      `.tmp/phase-6-9-8-sr5-runtime-runner-${marker.runId}.report.json`,
    );
    await writeExclusive(reportPath, artifactBytes);
    await link(reportPath, contained(root, `phase-6-9-8-sr5-runtime-runner-${marker.runId}.json`));
    await append(
      journalPath,
      records,
      'evidence_published',
      0,
      0,
      reportSha,
      digest(artifactBytes),
    );
    const validation = await validatePhase698Sr5RuntimeRunnerBundleZeroProvider(root);
    if (!validation.ok) {
      return Object.freeze({ ok: false as const, code: 'publication_invalid' as const });
    }
    return Object.freeze({ ok: true as const, disposition: 'crash_only_sealed' as const });
  } catch {
    return Object.freeze({ ok: false as const, code: 'recovery_failed' as const });
  }
}

export async function validatePhase698Sr5RuntimeRunnerBundleZeroProvider(rootInput: string) {
  try {
    const root = await requireSyntheticRoot(rootInput);
    const entries = await readdir(join(root, '.tmp'));
    const markerName = entries.filter((name) => name === MARKER_BASENAME);
    const journals = entries.filter((name) => name.endsWith('.journal.jsonl'));
    const reports = entries.filter((name) => name.endsWith('.report.json'));
    const claims = entries.filter((name) => name.endsWith('.recovery.json'));
    if (
      markerName.length !== 1 ||
      journals.length !== 1 ||
      reports.length !== 1 ||
      claims.length > 1 ||
      entries.length !== 3 + claims.length
    )
      throw invalid();
    const markerBytes = await readRegular(contained(root, `.tmp/${markerName[0]}`));
    const marker = MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== bytes(marker)) throw invalid();
    const records = await readJournal(contained(root, `.tmp/${journals[0]}`), marker.runId);
    const events = records.map((item) => item.event).join(',');
    if (
      events !==
        'attempt_reserved,guards_completed,lanes_accounted,run_terminal,evidence_published' &&
      events !== 'attempt_reserved,recovery_claimed,run_terminal,evidence_published'
    )
      throw invalid();
    if (claims.length === 1) {
      const claimBytes = await readRegular(contained(root, `.tmp/${claims[0]}`));
      const claim = RECOVERY_CLAIM_SCHEMA.parse(JSON.parse(claimBytes));
      if (
        claimBytes !== bytes(claim) ||
        claim.runId !== marker.runId ||
        claim.journalTailRecordHash !== records[0]?.recordHash
      )
        throw invalid();
    }
    const artifactBytes = await readRegular(contained(root, `.tmp/${reports[0]}`));
    const artifact = ARTIFACT_SCHEMA.parse(JSON.parse(artifactBytes));
    if (
      artifactBytes !== bytes(artifact) ||
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== digest(markerBytes)
    )
      throw invalid();
    if (
      artifact.reportSha256 !== digest(canonical(artifact.report)) ||
      artifact.terminalRecordHash !==
        records.find((record) => record.event === 'run_terminal')?.recordHash ||
      records.find((record) => record.event === 'evidence_published')?.artifactSha256 !==
        digest(artifactBytes) ||
      (artifact.report.completionMode === 'runtime') !== (claims.length === 0)
    )
      throw invalid();
    const rootArtifactPath = contained(root, `phase-6-9-8-sr5-runtime-runner-${marker.runId}.json`);
    if (
      (await readRegular(rootArtifactPath)) !== artifactBytes ||
      (await lstat(rootArtifactPath)).nlink < 2
    )
      throw invalid();
    return Object.freeze({
      ok: true as const,
      runId: marker.runId,
      journalRecords: records.length,
      gate: artifact.report.gate,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
    });
  } catch {
    return Object.freeze({
      ok: false as const,
      runId: null,
      journalRecords: 0,
      gate: null,
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
    });
  }
}

export function parsePhase698Sr5RuntimeRunnerArgs(args: readonly string[]) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help'))
    return Object.freeze({ kind: 'help' as const });
  return Object.freeze({ kind: 'rejected' as const });
}

function consumeSyntheticSourceCapability(
  capability: unknown,
): Phase698Sr5RuntimeSourceBindingRecord {
  if (
    (typeof capability !== 'object' && typeof capability !== 'function') ||
    capability === null ||
    consumedSyntheticCapabilities.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_SR5_RUNTIME_RUNNER_SYNTHETIC_SOURCE_CAPABILITY_INVALID');
  }
  const record = issuedSyntheticCapabilities.get(capability);
  if (!record) {
    throw new Error('PHASE_6_9_8_SR5_RUNTIME_RUNNER_SYNTHETIC_SOURCE_CAPABILITY_INVALID');
  }
  consumedSyntheticCapabilities.add(capability);
  return record;
}

function projectSource(record: Phase698Sr5RuntimeSourceBindingRecord) {
  return SOURCE_SCHEMA.parse({
    branch: record.source.branch,
    head: record.source.head,
    sourceManifestSha256: record.source.sourceManifestSha256,
    sourceBundleSha256: record.source.sourceBundleSha256,
    approvedTag: record.source.approvedTag,
    approvedTagObjectId: record.source.approvedTagObjectId,
  });
}

async function append(
  path: string,
  records: Journal[],
  event: Journal['event'],
  guards: number,
  lanes: number,
  reportSha: string | null,
  artifactSha: string | null,
) {
  const record = nextRecord(
    records[0].runId,
    records,
    event,
    guards,
    lanes,
    reportSha,
    artifactSha,
  );
  const handle = await open(path, 'a');
  try {
    await handle.writeFile(bytes(record));
    await handle.sync();
  } finally {
    await handle.close();
  }
  records.push(record);
  return record;
}

function nextRecord(
  runId: string,
  records: Journal[],
  event: Journal['event'],
  guardCount: number,
  laneCount: number,
  reportSha256: string | null,
  artifactSha256: string | null,
): Journal {
  const value = {
    version: PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_VERSION,
    runId,
    sequence: records.length + 1,
    previousHash: records.at(-1)?.recordHash ?? null,
    event,
    guardCount,
    laneCount,
    reportSha256,
    artifactSha256,
  };
  return JOURNAL_SCHEMA.parse({ ...value, recordHash: digest(canonical(value)) });
}

async function readJournal(path: string, runId: string): Promise<Journal[]> {
  const text = await readRegular(path);
  if (!text.endsWith('\n') || text.includes('\r')) throw invalid();
  const records = text
    .trimEnd()
    .split('\n')
    .map((line) => JOURNAL_SCHEMA.parse(JSON.parse(line)));
  let previous: string | null = null;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const { recordHash, ...unsigned } = record;
    if (
      record.runId !== runId ||
      record.sequence !== index + 1 ||
      record.previousHash !== previous ||
      recordHash !== digest(canonical(unsigned))
    )
      throw invalid();
    previous = recordHash;
  }
  return records;
}

async function requireSyntheticRoot(input: string) {
  const root = await realpath(resolve(input));
  const temp = await realpath(tmpdir());
  if (!root.startsWith(`${temp}${sep}`) || !root.includes(ROOT_PREFIX)) throw invalid();
  return root;
}

function contained(root: string, relativePath: string) {
  const value = resolve(root, ...relativePath.split('/'));
  if (!value.startsWith(`${root}${sep}`)) throw invalid();
  return value;
}

async function writeExclusive(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readRegular(path: string) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw invalid();
  return readFile(path, 'utf8');
}

function bytes(value: unknown) {
  return `${canonical(value)}\n`;
}
function canonical(value: unknown) {
  return JSON.stringify(sort(value));
}
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sort(child)]),
    );
  return value;
}
function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function invalid() {
  return new Error('PHASE_6_9_8_SR5_RUNTIME_RUNNER_DURABILITY_INVALID');
}
