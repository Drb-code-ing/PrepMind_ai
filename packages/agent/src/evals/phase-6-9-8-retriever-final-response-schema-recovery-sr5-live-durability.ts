import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, unlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES,
  buildPhase698RetrieverSchemaRecoverySr5LiveReport,
  canonicalPhase698RetrieverSchemaRecoverySr5LiveJson,
  expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule,
  parsePhase698RetrieverSchemaRecoverySr5LiveReport,
  sha256Phase698RetrieverSchemaRecoverySr5Live,
  type Phase698RetrieverSchemaRecoverySr5LiveCallEntry,
  type Phase698RetrieverSchemaRecoverySr5LiveCallIdentity,
  type Phase698RetrieverSchemaRecoverySr5LiveFinalEntry,
  type Phase698RetrieverSchemaRecoverySr5LiveGuardEntry,
  type Phase698RetrieverSchemaRecoverySr5LiveReport,
  type Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry,
  type Phase698RetrieverSchemaRecoverySr5LiveWireStage,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-contract.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';
import type {
  Phase698RetrieverSchemaRecoverySr5LiveCallLifecycle,
  Phase698RetrieverSchemaRecoverySr5LiveLifecycle,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-runner.ts';
import {
  consumePhase698RetrieverSchemaRecoverySr5LiveReservationCapability,
  type Phase698RetrieverSchemaRecoverySr5LiveReservationCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-admission.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-manifest.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-durability-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-marker-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-journal-record-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-recovery-claim-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-artifact-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live.marker' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const DATETIME = z.string().datetime({ offset: true });
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const DURABILITY_ERROR = 'PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_INVALID';
const FORMAL_FILE =
  /^phase-6-9-8-retriever-final-response-schema-recovery-sr5-live(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|recovery\.claim|report\.json)|-[0-9a-f-]{36}\.report\.json\.tmp\.[0-9a-f-]{36})$/u;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    runId: UUID,
    runScope: z.literal('branch'),
    authority: z.enum([
      'synthetic_test_retriever_final_response_schema_recovery_sr5',
      'controlled_live_retriever_final_response_schema_recovery_sr5',
    ]),
    credentialReads: z.union([z.literal(0), z.literal(3)]),
    createdAt: DATETIME,
    creatorPid: z.number().int().positive(),
    source: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA,
    sourceBinding: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
  })
  .strict()
  .superRefine((marker, context) => {
    const valid =
      (marker.authority === 'synthetic_test_retriever_final_response_schema_recovery_sr5' &&
        marker.credentialReads === 0) ||
      (marker.authority === 'controlled_live_retriever_final_response_schema_recovery_sr5' &&
        marker.credentialReads === 3);
    if (!valid || marker.sourceBinding.sourceCommit !== marker.source.head) {
      context.addIssue({ code: 'custom', message: 'marker authority mismatch' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr5LiveMarker = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_SCHEMA
>;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    runId: UUID,
    markerSha256: SHA256,
    journalTailRecordHash: SHA256,
    claimedAt: DATETIME,
    state: z.literal('crash_only_seal_claimed'),
  })
  .strict();

const RECORD_BASE = {
  recordVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_VERSION),
  lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
  runId: UUID,
  sequence: z.number().int().positive(),
  recordedAt: DATETIME,
  markerSha256: SHA256,
  previousHash: SHA256.nullable(),
  recordHash: SHA256,
} as const;
const IDENTITY_SCHEMA = z
  .object({
    callId: z.string().min(1).max(128),
    caseId: z.string().min(1).max(64),
    phase: z.enum([
      'rewrite_original_retrieval',
      'rewrite_candidate_model',
      'rewrite_candidate_retrieval',
      'final_response_model',
    ]),
    provider: z.enum(['deepseek', 'qwen']),
    model: z.enum(['deepseek-v4-pro', 'text-embedding-v4']),
    priceProfile: z.enum([
      'deepseek-v4-pro-cny-2026-07-15',
      'qwen-text-embedding-v4-cn-beijing-cny-2026-08-05',
    ]),
  })
  .strict();

const JOURNAL_RECORD_SCHEMA = z.discriminatedUnion('event', [
  z.object({ ...RECORD_BASE, event: z.literal('attempt_reserved') }).strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('guard_terminal'),
      entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({ ...RECORD_BASE, event: z.literal('call_reserved'), identity: IDENTITY_SCHEMA })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('wire_stage'),
      identity: IDENTITY_SCHEMA,
      stage: z.enum(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES),
      preparedSuccess: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.nullable(),
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('call_terminal'),
      entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('rewrite_terminal'),
      entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('final_terminal'),
      entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA,
    })
    .strict(),
  z.object({ ...RECORD_BASE, event: z.literal('recovery_claimed'), claimSha256: SHA256 }).strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('run_terminal'),
      report: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
      reportLogicalSha256: SHA256,
      completionMode: z.enum(['runtime', 'recovery']),
    })
    .strict(),
  z.object({ ...RECORD_BASE, event: z.literal('publication_started') }).strict(),
  z
    .object({ ...RECORD_BASE, event: z.literal('evidence_published'), evidenceSha256: SHA256 })
    .strict(),
]);

export type Phase698RetrieverSchemaRecoverySr5LiveJournalRecord = z.infer<
  typeof JOURNAL_RECORD_SCHEMA
>;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    authority: z.enum([
      'synthetic_test_retriever_final_response_schema_recovery_sr5',
      'controlled_live_retriever_final_response_schema_recovery_sr5',
    ]),
    qualityAuthority: z.enum(['none', 'schema_recovery_sr5_branch_semantic_gate']),
    runId: UUID,
    runScope: z.literal('branch'),
    generatedAt: DATETIME,
    source: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA,
    sourceBinding: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_BINDING_SCHEMA,
    reportLogicalSha256: SHA256,
    report: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
    durability: z
      .object({
        version: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_VERSION),
        completionMode: z.enum(['runtime', 'recovery']),
        publicationMode: z.enum(['runtime', 'recovery']),
        publicationStrategy: z.literal('exclusive_temp_hard_link'),
        markerSha256: SHA256,
        terminalSequence: z.number().int().positive(),
        terminalRecordHash: SHA256,
        journalRecordsBeforePublication: z.number().int().positive(),
        recoveryClaimSha256: SHA256.nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((artifact, context) => {
    const expectedQuality =
      artifact.authority === 'controlled_live_retriever_final_response_schema_recovery_sr5' &&
      artifact.report.gate.passed
        ? 'schema_recovery_sr5_branch_semantic_gate'
        : 'none';
    if (
      artifact.qualityAuthority !== expectedQuality ||
      artifact.report.qualityAuthority !== expectedQuality ||
      artifact.report.authority !== artifact.authority ||
      artifact.report.runId !== artifact.runId ||
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(artifact.sourceBinding) !==
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(artifact.report.sourceBinding) ||
      artifact.sourceBinding.sourceCommit !== artifact.source.head ||
      (artifact.durability.publicationMode === 'runtime' &&
        artifact.durability.recoveryClaimSha256 !== null) ||
      (artifact.durability.publicationMode === 'recovery' &&
        artifact.durability.recoveryClaimSha256 === null) ||
      (artifact.durability.completionMode === 'recovery' &&
        artifact.durability.publicationMode !== 'recovery')
    ) {
      context.addIssue({ code: 'custom', message: 'artifact authority mismatch' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr5LiveArtifact = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA
>;

type ActiveCall = {
  identity: Phase698RetrieverSchemaRecoverySr5LiveCallIdentity;
  stages: Phase698RetrieverSchemaRecoverySr5LiveWireStage[];
  preparedSuccess: Phase698RetrieverSchemaRecoverySr5LiveCallEntry | null;
};

type MutableReplay = {
  marker: Phase698RetrieverSchemaRecoverySr5LiveMarker;
  markerSha256: string;
  records: Phase698RetrieverSchemaRecoverySr5LiveJournalRecord[];
  guards: Phase698RetrieverSchemaRecoverySr5LiveGuardEntry[];
  calls: Phase698RetrieverSchemaRecoverySr5LiveCallEntry[];
  rewrites: Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry[];
  finals: Phase698RetrieverSchemaRecoverySr5LiveFinalEntry[];
  activeCall: ActiveCall | null;
  recoveryClaimSha256: string | null;
  terminal: Extract<
    Phase698RetrieverSchemaRecoverySr5LiveJournalRecord,
    { event: 'run_terminal' }
  > | null;
  publicationStarted: Extract<
    Phase698RetrieverSchemaRecoverySr5LiveJournalRecord,
    { event: 'publication_started' }
  > | null;
  published: Extract<
    Phase698RetrieverSchemaRecoverySr5LiveJournalRecord,
    { event: 'evidence_published' }
  > | null;
};

type ReservationState = MutableReplay & {
  root: string;
  journalPath: string;
  failed: boolean;
  queue: Promise<void>;
};

export type Phase698RetrieverSchemaRecoverySr5LiveReservation = Readonly<{
  runId: string;
  markerRelativePath: typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH;
  journalRelativePath: string;
  lifecycle: Phase698RetrieverSchemaRecoverySr5LiveLifecycle;
  publishArtifact(
    report: Phase698RetrieverSchemaRecoverySr5LiveReport,
  ): Promise<Readonly<{ relativePath: string; evidenceSha256: string }>>;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
      gate: Phase698RetrieverSchemaRecoverySr5LiveReport['gate'];
    }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'journal_invalid'
        | 'recovery_claim_invalid'
        | 'publication_invalid'
        | 'already_published';
    }>;

export async function reservePhase698RetrieverSchemaRecoverySr5LiveAttempt(input: {
  root: string;
  runId: string;
  createdAt: string;
  admissionAuthority: 'git_verified_live' | 'synthetic_test_live';
  reservationCapability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability;
}): Promise<Phase698RetrieverSchemaRecoverySr5LiveReservation> {
  const root = await requireRoot(input.root);
  const admission = consumePhase698RetrieverSchemaRecoverySr5LiveReservationCapability(
    input.reservationCapability,
    input.admissionAuthority,
    root,
  );
  const live = input.admissionAuthority === 'git_verified_live';
  const credentialReads = live ? 3 : 0;
  const marker = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    runId: input.runId,
    runScope: 'branch',
    authority: live
      ? 'controlled_live_retriever_final_response_schema_recovery_sr5'
      : 'synthetic_test_retriever_final_response_schema_recovery_sr5',
    credentialReads,
    createdAt: input.createdAt,
    creatorPid: process.pid,
    source: admission.source,
    sourceBinding: admission.sourceBinding,
  });
  await ensureTmp(root);
  if ((await formalFiles(root)).length !== 0) throw new Error(DURABILITY_ERROR);
  const markerPath = resolveRelative(
    root,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH,
  );
  const markerBytes = `${JSON.stringify(marker)}\n`;
  await writeExclusive(markerPath, markerBytes);
  await syncDirectory(dirname(markerPath));
  const markerSha256 = sha256(markerBytes);
  const journalRelative = journalRelativePath(marker.runId);
  const journalPath = resolveRelative(root, journalRelative);
  const state = createState(root, journalPath, marker, markerSha256);
  try {
    const attempt = nextRecord(state, { event: 'attempt_reserved' });
    await writeExclusive(journalPath, `${JSON.stringify(attempt)}\n`);
    await syncDirectory(dirname(journalPath));
    applyRecord(state, attempt);
  } catch {
    throw new Error(DURABILITY_ERROR);
  }
  return reservationFromState(state, journalRelative);
}

export async function validatePhase698RetrieverSchemaRecoverySr5LiveBundle(input: {
  root: string;
}) {
  try {
    const root = await requireRoot(input.root);
    const markerBytes = await readRegular(
      resolveRelative(root, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH),
    );
    const marker = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    if (markerBytes !== `${JSON.stringify(marker)}\n`) throw new Error(DURABILITY_ERROR);
    const markerSha256 = sha256(markerBytes);
    const journalPath = resolveRelative(root, journalRelativePath(marker.runId));
    const records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    const replay = replayRecords(marker, markerSha256, records);
    if (!replay.terminal || !replay.publicationStarted || !replay.published) {
      throw new Error(DURABILITY_ERROR);
    }
    const report = recomputeReport(replay, replay.terminal.completionMode);
    const artifactPath = resolveRelative(root, artifactRelativePath(marker.runId));
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA.parse(
      JSON.parse(artifactBytes),
    );
    if (artifactBytes !== `${JSON.stringify(artifact)}\n`) throw new Error(DURABILITY_ERROR);
    const expected = buildArtifact(replay);
    const reportSha = sha256Phase698RetrieverSchemaRecoverySr5Live(
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(report),
    );
    const artifactSha = sha256(artifactBytes);
    if (
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(artifact) !==
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expected) ||
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(artifact.report) !==
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(report) ||
      artifact.reportLogicalSha256 !== reportSha ||
      replay.published.evidenceSha256 !== artifactSha
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

export function sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttempt(input: {
  root: string;
}): Promise<Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult> {
  return sealInterrupted(input.root, isProcessAlive);
}

/** Synthetic-only process-liveness seam for isolated temp-root fault tests. */
export function sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttemptForTest(input: {
  root: string;
  isProcessAlive(processId: number): boolean;
}): Promise<Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult> {
  return sealInterrupted(input.root, (processId) => input.isProcessAlive(processId));
}

async function sealInterrupted(
  rootInput: string,
  processAlive: (processId: number) => boolean,
): Promise<Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult> {
  let root: string;
  let marker: Phase698RetrieverSchemaRecoverySr5LiveMarker;
  let markerBytes: string;
  try {
    root = await requireRoot(rootInput);
    markerBytes = await readRegular(
      resolveRelative(root, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH),
    );
    marker = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_SCHEMA.parse(
      JSON.parse(markerBytes),
    );
    if (markerBytes !== `${JSON.stringify(marker)}\n`) throw new Error();
  } catch {
    return Object.freeze({ ok: false, code: 'marker_missing_or_invalid' });
  }
  if (processAlive(marker.creatorPid)) return Object.freeze({ ok: false, code: 'process_active' });
  const markerSha256 = sha256(markerBytes);
  const journalPath = resolveRelative(root, journalRelativePath(marker.runId));
  try {
    if (!(await pathExists(journalPath))) {
      const state = createState(root, journalPath, marker, markerSha256);
      const attempt = nextRecord(state, { event: 'attempt_reserved' });
      await writeExclusive(journalPath, `${JSON.stringify(attempt)}\n`);
      await syncDirectory(dirname(journalPath));
    }
    let records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    let replay = replayRecords(marker, markerSha256, records);
    if (replay.published) return Object.freeze({ ok: false, code: 'already_published' });
    const claim = await acquireRecoveryClaim(root, replay);
    if (!claim.ok) return Object.freeze({ ok: false, code: 'recovery_claim_invalid' });
    records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    replay = replayRecords(marker, markerSha256, records);
    const state = stateFromReplay(root, journalPath, replay);
    if (state.recoveryClaimSha256 === null) {
      await appendRecord(state, { event: 'recovery_claimed', claimSha256: claim.claimSha256 });
    } else if (state.recoveryClaimSha256 !== claim.claimSha256) {
      return Object.freeze({ ok: false, code: 'recovery_claim_invalid' });
    }
    const hadTerminal = state.terminal !== null;
    if (!state.terminal) await completeRecovery(state);
    const report = state.terminal?.report;
    if (!report) return Object.freeze({ ok: false, code: 'journal_invalid' });
    const published = await publishArtifact(state, report);
    const validation = await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root });
    if (!validation.ok || validation.runId !== marker.runId) {
      return Object.freeze({ ok: false, code: 'publication_invalid' });
    }
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      disposition: hadTerminal ? 'terminal_publication_recovered' : 'crash_only_sealed',
      artifactSha256: published.evidenceSha256,
      gate: report.gate,
    });
  } catch {
    return Object.freeze({ ok: false, code: 'journal_invalid' });
  }
}

function reservationFromState(
  state: ReservationState,
  journalRelative: string,
): Phase698RetrieverSchemaRecoverySr5LiveReservation {
  const lifecycle: Phase698RetrieverSchemaRecoverySr5LiveLifecycle = Object.freeze({
    runId: state.marker.runId,
    appendGuardTerminal: (entry) => enqueue(state, () => appendGuard(state, entry)),
    reserveCall: (identity) =>
      enqueueResult(state, async () => {
        await reserveCall(state, identity);
        const callLifecycle: Phase698RetrieverSchemaRecoverySr5LiveCallLifecycle = Object.freeze({
          appendWireStage: (stage, preparedSuccess) =>
            enqueue(state, () => appendWire(state, identity, stage, preparedSuccess)),
        });
        return callLifecycle;
      }),
    appendCallTerminal: (entry) => enqueue(state, () => appendCall(state, entry)),
    appendRewriteTerminal: (entry) => enqueue(state, () => appendRewrite(state, entry)),
    appendFinalTerminal: (entry) => enqueue(state, () => appendFinal(state, entry)),
    appendRunTerminal: (report) =>
      enqueue(state, () => appendRunTerminal(state, report, 'runtime')),
  });
  return Object.freeze({
    runId: state.marker.runId,
    markerRelativePath: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH,
    journalRelativePath: journalRelative,
    lifecycle,
    publishArtifact: (report) => enqueueResult(state, () => publishArtifact(state, report)),
  });
}

async function appendGuard(
  state: ReservationState,
  entry: Phase698RetrieverSchemaRecoverySr5LiveGuardEntry,
) {
  await appendRecord(state, {
    event: 'guard_terminal',
    entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA.parse(entry),
  });
}

async function reserveCall(
  state: ReservationState,
  identity: Phase698RetrieverSchemaRecoverySr5LiveCallIdentity,
) {
  await appendRecord(state, { event: 'call_reserved', identity });
}

async function appendWire(
  state: ReservationState,
  identity: Phase698RetrieverSchemaRecoverySr5LiveCallIdentity,
  stage: Phase698RetrieverSchemaRecoverySr5LiveWireStage,
  preparedSuccess?: Phase698RetrieverSchemaRecoverySr5LiveCallEntry,
) {
  await appendRecord(state, {
    event: 'wire_stage',
    identity,
    stage,
    preparedSuccess: preparedSuccess ?? null,
  });
}

async function appendCall(
  state: ReservationState,
  entry: Phase698RetrieverSchemaRecoverySr5LiveCallEntry,
) {
  await appendRecord(state, {
    event: 'call_terminal',
    entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendRewrite(
  state: ReservationState,
  entry: Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry,
) {
  await appendRecord(state, {
    event: 'rewrite_terminal',
    entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendFinal(
  state: ReservationState,
  entry: Phase698RetrieverSchemaRecoverySr5LiveFinalEntry,
) {
  await appendRecord(state, {
    event: 'final_terminal',
    entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendRunTerminal(
  state: ReservationState,
  report: Phase698RetrieverSchemaRecoverySr5LiveReport,
  completionMode: 'runtime' | 'recovery',
) {
  const parsed = parsePhase698RetrieverSchemaRecoverySr5LiveReport(report);
  const expected = recomputeReport(state, completionMode);
  if (
    !parsed ||
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(parsed) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expected)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, {
    event: 'run_terminal',
    report: parsed,
    reportLogicalSha256: sha256Phase698RetrieverSchemaRecoverySr5Live(
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(parsed),
    ),
    completionMode,
  });
}

async function publishArtifact(
  state: ReservationState,
  report: Phase698RetrieverSchemaRecoverySr5LiveReport,
) {
  if (
    !state.terminal ||
    canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(report) !==
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(state.terminal.report) ||
    state.published
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  if (!state.publicationStarted) await appendRecord(state, { event: 'publication_started' });
  const artifact = buildArtifact(state);
  const bytes = `${JSON.stringify(artifact)}\n`;
  const relativePath = artifactRelativePath(state.marker.runId);
  const finalPath = resolveRelative(state.root, relativePath);
  if (await pathExists(finalPath)) {
    if ((await readRegular(finalPath)) !== bytes) throw new Error(DURABILITY_ERROR);
  } else {
    const tempPath = `${finalPath}.tmp.${randomUUID()}`;
    try {
      await writeExclusive(tempPath, bytes);
      await createTrustedHardLink(tempPath, finalPath);
      await assertHardLink(tempPath, finalPath);
      if ((await readRegular(finalPath)) !== bytes) throw new Error(DURABILITY_ERROR);
      await syncDirectory(dirname(finalPath));
    } finally {
      await unlinkTrustedRegularIfPresent(tempPath);
    }
  }
  const evidenceSha256 = sha256(bytes);
  await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({ relativePath, evidenceSha256 });
}

function buildArtifact(state: MutableReplay): Phase698RetrieverSchemaRecoverySr5LiveArtifact {
  const terminal = state.terminal;
  const publication = state.publicationStarted;
  if (!terminal || !publication) throw new Error(DURABILITY_ERROR);
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_ARTIFACT_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    authority: state.marker.authority,
    qualityAuthority: terminal.report.qualityAuthority,
    runId: state.marker.runId,
    runScope: 'branch',
    generatedAt: publication.recordedAt,
    source: state.marker.source,
    sourceBinding: state.marker.sourceBinding,
    reportLogicalSha256: terminal.reportLogicalSha256,
    report: terminal.report,
    durability: {
      version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DURABILITY_VERSION,
      completionMode: terminal.completionMode,
      publicationMode: state.recoveryClaimSha256 === null ? 'runtime' : 'recovery',
      publicationStrategy: 'exclusive_temp_hard_link',
      markerSha256: state.markerSha256,
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publication.sequence - 1,
      recoveryClaimSha256: state.recoveryClaimSha256,
    },
  });
}

async function completeRecovery(state: ReservationState) {
  while (state.guards.length < 8) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.guardCases[state.guards.length];
    await appendGuard(
      state,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA.parse({
        kind: 'guard',
        caseId: testCase.caseId,
        disposition: 'failed',
        observedReasonCode: 'recovery_interrupted',
        expectedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      }),
    );
  }
  const guardFailed = state.guards.some((entry) => entry.disposition === 'failed');
  while (state.rewrites.length < 6) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[state.rewrites.length];
    const targetCallCount = (state.rewrites.length + 1) * 3;
    while (state.calls.length < targetCallCount) await recoverNextCall(state, guardFailed);
    await appendRewrite(state, recoveryRewrite(testCase));
  }
  while (state.finals.length < 6) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[state.finals.length];
    await recoverNextCall(state, guardFailed);
    const call = state.calls.at(-1)!;
    await appendFinal(state, recoveryFinal(testCase, call));
  }
  await appendRunTerminal(state, recomputeReport(state, 'recovery'), 'recovery');
}

async function recoverNextCall(state: ReservationState, guardFailed: boolean) {
  const identity = expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule()[state.calls.length];
  if (!identity) throw new Error(DURABILITY_ERROR);
  if (state.activeCall) {
    if (state.activeCall.identity.callId !== identity.callId) throw new Error(DURABILITY_ERROR);
    if (state.activeCall.preparedSuccess) {
      await appendCall(state, state.activeCall.preparedSuccess);
      return;
    }
    const stages = state.activeCall.stages;
    await appendCall(
      state,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.parse({
        kind: 'provider_call',
        ...identity,
        transportAuthority: isLiveAuthority(state.marker.authority)
          ? 'external_provider'
          : 'synthetic_injected',
        disposition: 'failed',
        failureReason: 'runtime_contract_invalid',
        wire: {
          attempts: 1,
          dispatches: stages.includes('dispatch_started') ? 1 : 0,
          responses: stages.includes('response_received') ? 1 : 0,
          verifiedUsage: 0,
        },
        usage: null,
        verifiedCostCny: null,
        durationMs: 0,
      }),
    );
    return;
  }
  await appendCall(state, notStarted(identity, state.marker.authority, guardFailed));
}

function recomputeReport(state: MutableReplay, completionMode: 'runtime' | 'recovery') {
  return buildPhase698RetrieverSchemaRecoverySr5LiveReport({
    runId: state.marker.runId,
    authority: state.marker.authority,
    completionMode,
    source: state.marker.source,
    sourceBinding: state.marker.sourceBinding,
    guardEntries: state.guards,
    callEntries: state.calls,
    rewriteEntries: state.rewrites,
    finalResponseEntries: state.finals,
  });
}

function recoveryRewrite(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number]) {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: `sha256:${sha256(testCase.originalQuery)}`,
    executedQueryHash: null,
    originalTargetRank: null,
    candidateTargetRank: null,
    originalRecallAt5: null,
    originalNdcgAt5: null,
    candidateRecallAt5: null,
    candidateNdcgAt5: null,
    critical: testCase.critical,
    strict: false,
    intentPreserved: null,
    unsafeRewrite: null,
    safetyFailure: false,
  });
}

function recoveryFinal(
  testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number],
  call: Phase698RetrieverSchemaRecoverySr5LiveCallEntry,
) {
  const attempted = !call.disposition.startsWith('not_started_');
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA.parse({
    kind: 'final_response',
    caseId: testCase.caseId,
    responseTextHash: null,
    evidenceStatus: testCase.evidenceStatus,
    strict: false,
    terminal: attempted ? (call.disposition === 'aborted' ? 'aborted' : 'response_failed') : null,
    terminalCount: attempted ? 1 : 0,
    terminalLast: attempted,
    grounded: null,
    noticeSatisfied: null,
    requiredCitationCount: null,
    observedCitationCount: null,
    citationTruePositiveCount: null,
    falseToolSuccess: null,
    falseCitation: null,
    ttftMs: null,
    totalMs: null,
    endToEndMs: null,
    safetyFailure: false,
  });
}

function notStarted(
  identity: Phase698RetrieverSchemaRecoverySr5LiveCallIdentity,
  authority: Phase698RetrieverSchemaRecoverySr5LiveMarker['authority'],
  guardFailed: boolean,
) {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...identity,
    transportAuthority: isLiveAuthority(authority) ? 'external_provider' : 'synthetic_injected',
    disposition: guardFailed ? 'not_started_case_guard' : 'not_started_quality_breaker',
    failureReason: guardFailed ? 'case_guard' : 'quality_breaker',
    wire: { attempts: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
  });
}

async function appendRecord(state: ReservationState, event: Record<string, unknown>) {
  if (state.failed || state.published) throw new Error(DURABILITY_ERROR);
  const record = nextRecord(state, event);
  applyRecordPreview(state, record);
  await appendRegular(state.journalPath, `${JSON.stringify(record)}\n`);
  applyRecord(state, record);
  return record;
}

function nextRecord(state: MutableReplay, event: Record<string, unknown>) {
  const base = {
    recordVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    runId: state.marker.runId,
    sequence: state.records.length + 1,
    recordedAt: new Date().toISOString(),
    markerSha256: state.markerSha256,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...event,
  };
  return JOURNAL_RECORD_SCHEMA.parse({
    ...base,
    recordHash: sha256Phase698RetrieverSchemaRecoverySr5Live(
      canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(base),
    ),
  });
}

function applyRecordPreview(
  state: MutableReplay,
  record: Phase698RetrieverSchemaRecoverySr5LiveJournalRecord,
) {
  const clone = cloneReplay(state);
  applyRecord(clone, record);
}

function applyRecord(
  state: MutableReplay,
  record: Phase698RetrieverSchemaRecoverySr5LiveJournalRecord,
) {
  const expectedSequence = state.records.length + 1;
  const previousHash = state.records.at(-1)?.recordHash ?? null;
  if (
    record.runId !== state.marker.runId ||
    record.markerSha256 !== state.markerSha256 ||
    record.sequence !== expectedSequence ||
    record.previousHash !== previousHash ||
    Date.parse(record.recordedAt) < Date.parse(state.marker.createdAt)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  switch (record.event) {
    case 'attempt_reserved':
      if (state.records.length !== 0) throw new Error(DURABILITY_ERROR);
      break;
    case 'guard_terminal': {
      if (
        state.records.length === 0 ||
        state.calls.length > 0 ||
        state.activeCall ||
        state.terminal
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = PHASE_6_9_8_TASK8_MANIFEST.guardCases[state.guards.length];
      if (!expected || expected.caseId !== record.entry.caseId) throw new Error(DURABILITY_ERROR);
      state.guards.push(record.entry);
      break;
    }
    case 'call_reserved': {
      assertCanStartCall(state);
      const expected =
        expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule()[state.calls.length];
      if (
        !expected ||
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(expected) !==
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(record.identity)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.activeCall = { identity: expected, stages: [], preparedSuccess: null };
      break;
    }
    case 'wire_stage': {
      const active = state.activeCall;
      const expectedStage =
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES[active?.stages.length ?? 99];
      if (
        !active ||
        active.identity.callId !== record.identity.callId ||
        record.stage !== expectedStage ||
        (record.stage === 'usage_verified') !== (record.preparedSuccess !== null) ||
        (record.preparedSuccess !== null &&
          (record.preparedSuccess.callId !== record.identity.callId ||
            record.preparedSuccess.disposition !== 'succeeded'))
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      active.stages.push(record.stage);
      active.preparedSuccess = record.preparedSuccess;
      break;
    }
    case 'call_terminal': {
      assertCanTerminateCall(state, record.entry);
      const expected =
        expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule()[state.calls.length];
      if (!expected || expected.callId !== record.entry.callId) throw new Error(DURABILITY_ERROR);
      const active = state.activeCall;
      if (!record.entry.disposition.startsWith('not_started_')) {
        if (active?.identity.callId !== record.entry.callId) throw new Error(DURABILITY_ERROR);
        const wire = wireFromStages(active.stages);
        if (
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(wire) !==
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(record.entry.wire)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        if (
          active.preparedSuccess !== null &&
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(active.preparedSuccess) !==
            canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(record.entry)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
      }
      state.calls.push(record.entry);
      state.activeCall = null;
      break;
    }
    case 'rewrite_terminal': {
      if (state.activeCall || state.rewrites.length >= 6 || state.finals.length > 0) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[state.rewrites.length];
      if (
        !expected ||
        expected.caseId !== record.entry.caseId ||
        state.calls.length !== (state.rewrites.length + 1) * 3
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.rewrites.push(record.entry);
      break;
    }
    case 'final_terminal': {
      if (state.activeCall || state.rewrites.length !== 6 || state.finals.length >= 6) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[state.finals.length];
      if (
        !expected ||
        expected.caseId !== record.entry.caseId ||
        state.calls.length !== 18 + state.finals.length + 1
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.finals.push(record.entry);
      break;
    }
    case 'recovery_claimed':
      if (state.recoveryClaimSha256 !== null || state.publicationStarted || state.published) {
        throw new Error(DURABILITY_ERROR);
      }
      state.recoveryClaimSha256 = record.claimSha256;
      break;
    case 'run_terminal': {
      if (
        state.terminal ||
        state.activeCall ||
        state.guards.length !== 8 ||
        state.calls.length !== 24 ||
        state.rewrites.length !== 6 ||
        state.finals.length !== 6 ||
        (record.completionMode === 'recovery') !== (state.recoveryClaimSha256 !== null)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      const recomputed = recomputeReport(state, record.completionMode);
      if (
        canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(recomputed) !==
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(record.report) ||
        record.reportLogicalSha256 !==
          sha256Phase698RetrieverSchemaRecoverySr5Live(
            canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(recomputed),
          )
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.terminal = record;
      break;
    }
    case 'publication_started':
      if (!state.terminal || state.publicationStarted || state.published)
        throw new Error(DURABILITY_ERROR);
      state.publicationStarted = record;
      break;
    case 'evidence_published':
      if (!state.publicationStarted || state.published) throw new Error(DURABILITY_ERROR);
      state.published = record;
      break;
  }
  state.records.push(record);
}

function assertCallScheduleBoundary(state: MutableReplay) {
  if (state.guards.length !== 8 || state.terminal || state.publicationStarted || state.published) {
    throw new Error(DURABILITY_ERROR);
  }
  const index = state.calls.length;
  if (
    (index < 18 && Math.floor(index / 3) !== state.rewrites.length) ||
    (index >= 18 && (state.rewrites.length !== 6 || index - 18 !== state.finals.length))
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

function assertCanStartCall(state: MutableReplay) {
  assertCallScheduleBoundary(state);
  if (state.activeCall) throw new Error(DURABILITY_ERROR);
}

function assertCanTerminateCall(
  state: MutableReplay,
  entry: Phase698RetrieverSchemaRecoverySr5LiveCallEntry,
) {
  assertCallScheduleBoundary(state);
  const notStarted = entry.disposition.startsWith('not_started_');
  if ((notStarted && state.activeCall) || (!notStarted && !state.activeCall)) {
    throw new Error(DURABILITY_ERROR);
  }
}

function wireFromStages(stages: readonly Phase698RetrieverSchemaRecoverySr5LiveWireStage[]) {
  return {
    attempts: 1,
    dispatches: stages.includes('dispatch_started') ? 1 : 0,
    responses: stages.includes('response_received') ? 1 : 0,
    verifiedUsage: stages.includes('usage_verified') ? 1 : 0,
  };
}

function parseJournal(
  bytes: string,
  marker: Phase698RetrieverSchemaRecoverySr5LiveMarker,
  markerSha256: string,
) {
  if (!bytes.endsWith('\n') || bytes.length > MAX_FILE_BYTES) throw new Error(DURABILITY_ERROR);
  const lines = bytes.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0))
    throw new Error(DURABILITY_ERROR);
  return lines.map((line, index) => {
    const record = JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line));
    const { recordHash, ...base } = record;
    if (
      record.runId !== marker.runId ||
      record.markerSha256 !== markerSha256 ||
      record.sequence !== index + 1 ||
      record.previousHash !== (index === 0 ? null : linesRecordHash(lines[index - 1])) ||
      recordHash !==
        sha256Phase698RetrieverSchemaRecoverySr5Live(
          canonicalPhase698RetrieverSchemaRecoverySr5LiveJson(base),
        ) ||
      line !== JSON.stringify(record)
    ) {
      throw new Error(DURABILITY_ERROR);
    }
    return record;
  });
}

function linesRecordHash(line: string) {
  return JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line)).recordHash;
}

function replayRecords(
  marker: Phase698RetrieverSchemaRecoverySr5LiveMarker,
  markerSha256: string,
  records: readonly Phase698RetrieverSchemaRecoverySr5LiveJournalRecord[],
) {
  const state = createReplay(marker, markerSha256);
  for (const record of records) applyRecord(state, record);
  return state;
}

function createReplay(
  marker: Phase698RetrieverSchemaRecoverySr5LiveMarker,
  markerSha256: string,
): MutableReplay {
  return {
    marker,
    markerSha256,
    records: [],
    guards: [],
    calls: [],
    rewrites: [],
    finals: [],
    activeCall: null,
    recoveryClaimSha256: null,
    terminal: null,
    publicationStarted: null,
    published: null,
  };
}

function createState(
  root: string,
  journalPath: string,
  marker: Phase698RetrieverSchemaRecoverySr5LiveMarker,
  markerSha256: string,
): ReservationState {
  return {
    ...createReplay(marker, markerSha256),
    root,
    journalPath,
    failed: false,
    queue: Promise.resolve(),
  };
}

function stateFromReplay(
  root: string,
  journalPath: string,
  replay: MutableReplay,
): ReservationState {
  return {
    ...replay,
    records: [...replay.records],
    guards: [...replay.guards],
    calls: [...replay.calls],
    rewrites: [...replay.rewrites],
    finals: [...replay.finals],
    activeCall: replay.activeCall
      ? {
          identity: replay.activeCall.identity,
          stages: [...replay.activeCall.stages],
          preparedSuccess: replay.activeCall.preparedSuccess,
        }
      : null,
    root,
    journalPath,
    failed: false,
    queue: Promise.resolve(),
  };
}

function cloneReplay(state: MutableReplay): MutableReplay {
  return stateFromReplay('', '', state);
}

async function acquireRecoveryClaim(
  root: string,
  replay: MutableReplay,
): Promise<Readonly<{ ok: true; claimSha256: string }> | Readonly<{ ok: false }>> {
  const tail = replay.records.at(-1);
  if (!tail) return Object.freeze({ ok: false });
  const claimPath = resolveRelative(root, recoveryClaimRelativePath(replay.marker.runId));
  const existingRecovery = [...replay.records]
    .reverse()
    .find((record) => record.event === 'recovery_claimed');
  const expectedTail = existingRecovery?.previousHash ?? tail.recordHash;
  if (!expectedTail) return Object.freeze({ ok: false });
  const claim = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_SCHEMA.parse({
    version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    runId: replay.marker.runId,
    markerSha256: replay.markerSha256,
    journalTailRecordHash: expectedTail,
    claimedAt: new Date().toISOString(),
    state: 'crash_only_seal_claimed',
  });
  let bytes: string;
  try {
    bytes = `${JSON.stringify(claim)}\n`;
    await writeExclusive(claimPath, bytes);
    await syncDirectory(dirname(claimPath));
  } catch (error) {
    if (!isErrorCode(error, 'EEXIST')) return Object.freeze({ ok: false });
    try {
      bytes = await readRegular(claimPath);
      const parsed = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_SCHEMA.parse(
        JSON.parse(bytes),
      );
      if (
        bytes !== `${JSON.stringify(parsed)}\n` ||
        parsed.runId !== replay.marker.runId ||
        parsed.markerSha256 !== replay.markerSha256 ||
        parsed.journalTailRecordHash !== expectedTail
      ) {
        return Object.freeze({ ok: false });
      }
    } catch {
      return Object.freeze({ ok: false });
    }
  }
  const claimSha256 = sha256(bytes);
  if (existingRecovery && existingRecovery.claimSha256 !== claimSha256) {
    return Object.freeze({ ok: false });
  }
  return Object.freeze({ ok: true, claimSha256 });
}

async function validateClaim(root: string, replay: MutableReplay) {
  const recovery = [...replay.records]
    .reverse()
    .find((record) => record.event === 'recovery_claimed');
  const claimPath = resolveRelative(root, recoveryClaimRelativePath(replay.marker.runId));
  if (!recovery) {
    if (await pathExists(claimPath)) throw new Error(DURABILITY_ERROR);
    return;
  }
  const bytes = await readRegular(claimPath);
  const claim = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVERY_CLAIM_SCHEMA.parse(
    JSON.parse(bytes),
  );
  if (
    bytes !== `${JSON.stringify(claim)}\n` ||
    claim.runId !== replay.marker.runId ||
    claim.markerSha256 !== replay.markerSha256 ||
    claim.journalTailRecordHash !== recovery.previousHash ||
    recovery.claimSha256 !== sha256(bytes)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function requireOnlyExpectedFiles(root: string, replay: MutableReplay) {
  const observed = new Set((await formalFiles(root)).map((entry) => entry.name));
  const expected = new Set([
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_MARKER_RELATIVE_PATH.split('/').at(-1)!,
    journalRelativePath(replay.marker.runId).split('/').at(-1)!,
    artifactRelativePath(replay.marker.runId).split('/').at(-1)!,
    ...(replay.recoveryClaimSha256 === null
      ? []
      : [recoveryClaimRelativePath(replay.marker.runId).split('/').at(-1)!]),
  ]);
  if (observed.size !== expected.size || [...observed].some((entry) => !expected.has(entry))) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function formalFiles(root: string) {
  try {
    const tmp = resolveRelative(root, '.tmp');
    const tmpHandle = await openTrustedDirectory(tmp);
    try {
      await assertTrustedDirectoryHandle(tmp, tmpHandle);
      const entries = await readdir(tmp, { withFileTypes: true });
      await assertTrustedDirectoryHandle(tmp, tmpHandle);
      // Any directory entry in the current namespace blocks admission. Symlinks,
      // directories and device-like entries must not disappear from the fence.
      return entries.filter((entry) => FORMAL_FILE.test(entry.name));
    } finally {
      await tmpHandle.close();
    }
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return [];
    throw error;
  }
}

async function enqueue(state: ReservationState, operation: () => Promise<void>) {
  return enqueueResult(state, operation);
}

async function enqueueResult<T>(state: ReservationState, operation: () => Promise<T>): Promise<T> {
  if (state.failed) throw new Error(DURABILITY_ERROR);
  let resolveResult!: (value: T) => void;
  let rejectResult!: (reason: unknown) => void;
  const result = new Promise<T>((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise;
    rejectResult = rejectPromise;
  });
  state.queue = state.queue.then(async () => {
    if (state.failed) throw new Error(DURABILITY_ERROR);
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
  await assertTrustedDirectory(path);
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
  return withTrustedParentDirectory(path, async (parent, parentHandle) => {
    const handle = await open(
      path,
      guardedFileFlags(fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL),
      0o600,
    );
    try {
      await assertTrustedDirectoryHandle(parent, parentHandle);
      await assertOpenedRegular(path, handle);
      await handle.writeFile(bytes, 'utf8');
      await handle.sync();
      await assertTrustedDirectoryHandle(parent, parentHandle);
    } finally {
      await handle.close();
    }
  });
}

async function appendRegular(path: string, bytes: string) {
  return withTrustedParentDirectory(path, async (parent, parentHandle) => {
    const handle = await open(path, guardedFileFlags(fsConstants.O_WRONLY | fsConstants.O_APPEND));
    try {
      await assertTrustedDirectoryHandle(parent, parentHandle);
      const metadata = await assertOpenedRegular(path, handle);
      if (
        metadata.size > MAX_FILE_BYTES ||
        metadata.size + Buffer.byteLength(bytes) > MAX_FILE_BYTES
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      await handle.writeFile(bytes, 'utf8');
      await handle.sync();
      await assertTrustedDirectoryHandle(parent, parentHandle);
    } finally {
      await handle.close();
    }
  });
}

async function readRegular(path: string) {
  return withTrustedParentDirectory(path, async (parent, parentHandle) => {
    const handle = await open(path, guardedFileFlags(fsConstants.O_RDONLY));
    try {
      await assertTrustedDirectoryHandle(parent, parentHandle);
      const metadata = await assertOpenedRegular(path, handle);
      if (metadata.size > MAX_FILE_BYTES) throw new Error(DURABILITY_ERROR);
      const bytes = await handle.readFile('utf8');
      await assertTrustedDirectoryHandle(parent, parentHandle);
      return bytes;
    } finally {
      await handle.close();
    }
  });
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
  const handle = await openTrustedDirectory(path);
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
    await assertTrustedDirectoryHandle(path, handle);
  } finally {
    await handle.close();
  }
}

async function assertHardLink(source: string, target: string) {
  await assertTrustedParentDirectory(source);
  await assertTrustedParentDirectory(target);
  const [left, right] = await Promise.all([
    lstat(source, { bigint: true }),
    lstat(target, { bigint: true }),
  ]);
  if (
    !left.isFile() ||
    !right.isFile() ||
    left.isSymbolicLink() ||
    right.isSymbolicLink() ||
    left.dev !== right.dev ||
    left.ino !== right.ino
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function pathExists(path: string) {
  try {
    return await withTrustedParentDirectory(path, async (_parent, parentHandle) => {
      await assertTrustedDirectoryHandle(_parent, parentHandle);
      await lstat(path);
      return true;
    });
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return false;
    throw error;
  }
}

async function createTrustedHardLink(source: string, target: string) {
  const sourceParent = dirname(source);
  const targetParent = dirname(target);
  const sourceHandle = await openTrustedDirectory(sourceParent);
  let targetHandle = sourceHandle;
  try {
    if (normalizePath(sourceParent) !== normalizePath(targetParent)) {
      // Keep the source handle inside the enclosing finally while opening the
      // second parent, so a failed target open cannot leak the first handle.
      targetHandle = await openTrustedDirectory(targetParent);
    }
    await assertTrustedDirectoryHandle(sourceParent, sourceHandle);
    await assertTrustedDirectoryHandle(targetParent, targetHandle);
    await link(source, target);
    await assertTrustedDirectoryHandle(sourceParent, sourceHandle);
    await assertTrustedDirectoryHandle(targetParent, targetHandle);
  } finally {
    await sourceHandle.close();
    if (targetHandle !== sourceHandle) await targetHandle.close();
  }
}

async function unlinkTrustedRegularIfPresent(path: string) {
  try {
    await withTrustedParentDirectory(path, async (_parent, parentHandle) => {
      await assertTrustedDirectoryHandle(_parent, parentHandle);
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink()) return;
      await unlink(path);
      await assertTrustedDirectoryHandle(_parent, parentHandle);
    });
  } catch {
    // Cleanup is best-effort, but never follows an untrusted parent or link.
  }
}

async function assertTrustedParentDirectory(path: string) {
  await assertTrustedDirectory(dirname(path));
}

async function withTrustedParentDirectory<T>(
  path: string,
  operation: (parent: string, parentHandle: Awaited<ReturnType<typeof open>>) => Promise<T>,
) {
  const parent = dirname(path);
  const parentHandle = await openTrustedDirectory(parent);
  try {
    await assertTrustedDirectoryHandle(parent, parentHandle);
    return await operation(parent, parentHandle);
  } finally {
    await parentHandle.close();
  }
}

async function openTrustedDirectory(path: string) {
  const lexical = resolve(path);
  await assertTrustedDirectory(lexical);
  const handle = await open(lexical, 'r');
  try {
    await assertTrustedDirectoryHandle(lexical, handle);
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function assertTrustedDirectoryHandle(
  path: string,
  handle: Awaited<ReturnType<typeof open>>,
) {
  const lexical = resolve(path);
  const [opened, current, canonical] = await Promise.all([
    handle.stat(),
    lstat(lexical),
    realpath(lexical),
  ]);
  if (
    !opened.isDirectory() ||
    !current.isDirectory() ||
    current.isSymbolicLink() ||
    opened.dev !== current.dev ||
    opened.ino !== current.ino ||
    normalizePath(canonical) !== normalizePath(lexical)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function assertTrustedDirectory(path: string) {
  const lexical = resolve(path);
  const [metadata, canonical] = await Promise.all([lstat(lexical), realpath(lexical)]);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    normalizePath(canonical) !== normalizePath(lexical)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

function guardedFileFlags(flags: number) {
  return process.platform === 'win32' ? flags : flags | fsConstants.O_NOFOLLOW;
}

function normalizePath(path: string) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function isProcessAlive(processId: number) {
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    return isErrorCode(error, 'EPERM');
  }
}

function isErrorCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' && error !== null && (error as NodeJS.ErrnoException).code === code
  );
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function isLiveAuthority(
  authority: Phase698RetrieverSchemaRecoverySr5LiveMarker['authority'],
): boolean {
  return authority === 'controlled_live_retriever_final_response_schema_recovery_sr5';
}

export function journalRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-${runId}.journal.jsonl`;
}

export function recoveryClaimRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-${runId}.recovery.claim`;
}

export function artifactRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-${runId}.report.json`;
}
