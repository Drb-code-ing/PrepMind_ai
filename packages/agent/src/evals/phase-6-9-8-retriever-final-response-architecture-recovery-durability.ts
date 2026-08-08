import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, stat, unlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { z } from 'zod';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  type Phase698ArchitectureRecoveryDiagnosticStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_STAGES,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
  architectureRecoveryDiagnosticSequence,
  buildPhase698ArchitectureRecoveryReport,
  canonicalPhase698ArchitectureRecoveryJson,
  createPhase698ArchitectureRecoveryNotStartedEntry,
  expectedPhase698ArchitectureRecoveryCallSchedule,
  parsePhase698ArchitectureRecoveryReport,
  sha256Phase698ArchitectureRecovery,
  type Phase698ArchitectureRecoveryCallEntry,
  type Phase698ArchitectureRecoveryCallIdentity,
  type Phase698ArchitectureRecoveryFinalEntry,
  type Phase698ArchitectureRecoveryGuardEntry,
  type Phase698ArchitectureRecoveryProviderWire,
  type Phase698ArchitectureRecoveryReport,
  type Phase698ArchitectureRecoveryRewriteEntry,
  type Phase698ArchitectureRecoveryRunnerStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import type {
  Phase698ArchitectureRecoveryCallLifecycle,
  Phase698ArchitectureRecoveryDiagnosticJournalTerminal,
  Phase698ArchitectureRecoveryLifecycle,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import {
  consumePhase698ArchitectureRecoveryReservationCapability,
  type Phase698ArchitectureRecoveryReservationAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-durability-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-marker-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_JOURNAL_RECORD_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-journal-record-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-claim-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-artifact-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-architecture-recovery.marker' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const DATETIME = z.string().datetime({ offset: true });
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const DURABILITY_ERROR = 'PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_INVALID';
const FORMAL_RECOVERY_FILE =
  /^phase-6-9-8-retriever-final-response-architecture-recovery(?:\.marker|-[0-9a-f-]{36}\.(?:journal\.jsonl|recovery\.claim|json))$/u;
const OLD_TASK9_FILE =
  /^phase-6-9-8-retriever-final-response-task9c-(?:controlled-live\.marker|controlled-live-[0-9a-f-]{36}\.(?:journal\.jsonl|recovery\.claim)|branch-controlled-live-[0-9a-f-]{36}\.json)$/u;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
    runId: UUID,
    runScope: z.literal('branch'),
    authority: z.enum(['synthetic_test', 'controlled_live']),
    runMode: z.enum(['synthetic_fault', 'reviewed_mock', 'controlled_live']),
    credentialReads: z.union([z.literal(0), z.literal(3)]),
    createdAt: DATETIME,
    creatorPid: z.number().int().positive(),
    source: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
  })
  .strict()
  .superRefine((marker, context) => {
    const valid =
      (marker.authority === 'synthetic_test' &&
        marker.runMode !== 'controlled_live' &&
        marker.credentialReads === 0 &&
        marker.source.admissionAuthority === 'synthetic_fixture') ||
      (marker.authority === 'controlled_live' &&
        marker.runMode === 'controlled_live' &&
        marker.credentialReads === 3 &&
        marker.source.admissionAuthority === 'git_verified');
    if (!valid) context.addIssue({ code: 'custom', message: 'marker authority mismatch' });
  });

export type Phase698ArchitectureRecoveryMarker = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_SCHEMA
>;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
    runId: UUID,
    markerSha256: SHA256,
    journalTailRecordHash: SHA256,
    claimedAt: DATETIME,
    state: z.literal('crash_only_seal_claimed'),
  })
  .strict();

const IDENTITY_SCHEMA = z
  .object({
    callId: z.string().regex(/^(?:rewrite|final)_(?:0[1-9]|1[0-6])\.[a-z_]+$/u),
    caseId: z.string().regex(/^(?:rewrite|final)_(?:0[1-9]|1[0-6])$/u),
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

const PROVIDER_WIRE_SCHEMA = z
  .object({
    executions: z.number().int().min(0).max(1),
    dispatches: z.number().int().min(0).max(1),
    responses: z.number().int().min(0).max(1),
    verifiedUsage: z.number().int().min(0).max(1),
  })
  .strict();

const DIAGNOSTIC_TERMINAL_SCHEMA = z
  .object({
    diagnostic: PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
    diagnosticStages: z.array(z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES)),
    providerWire: PROVIDER_WIRE_SCHEMA,
  })
  .strict();

const RECORD_BASE = {
  recordVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_JOURNAL_RECORD_VERSION),
  lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
  runId: UUID,
  sequence: z.number().int().positive(),
  recordedAt: DATETIME,
  markerSha256: SHA256,
  previousHash: SHA256.nullable(),
  recordHash: SHA256,
} as const;

const JOURNAL_RECORD_SCHEMA = z.discriminatedUnion('event', [
  z.object({ ...RECORD_BASE, event: z.literal('attempt_reserved') }).strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('guard_terminal'),
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({ ...RECORD_BASE, event: z.literal('call_reserved'), identity: IDENTITY_SCHEMA })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('runner_stage'),
      identity: IDENTITY_SCHEMA,
      stage: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_STAGES),
      preparedSuccess: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.nullable(),
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('diagnostic_stage_started'),
      identity: IDENTITY_SCHEMA,
      stage: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES),
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('diagnostic_stage_succeeded'),
      identity: IDENTITY_SCHEMA,
      stage: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES),
      terminal: DIAGNOSTIC_TERMINAL_SCHEMA.nullable(),
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('diagnostic_stage_failed'),
      identity: IDENTITY_SCHEMA,
      stage: z.enum(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_STAGES),
      terminal: DIAGNOSTIC_TERMINAL_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('call_prepared'),
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('call_terminal'),
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('rewrite_terminal'),
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('final_terminal'),
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA,
    })
    .strict(),
  z.object({ ...RECORD_BASE, event: z.literal('recovery_claimed'), claimSha256: SHA256 }).strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('run_terminal'),
      report: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
      reportLogicalSha256: SHA256,
      completionMode: z.enum(['runtime', 'recovery']),
    })
    .strict(),
  z
    .object({
      ...RECORD_BASE,
      event: z.literal('publication_started'),
      generatedAt: DATETIME,
    })
    .strict(),
  z
    .object({ ...RECORD_BASE, event: z.literal('evidence_published'), evidenceSha256: SHA256 })
    .strict(),
]);

export type Phase698ArchitectureRecoveryJournalRecord = z.infer<typeof JOURNAL_RECORD_SCHEMA>;

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_VERSION),
    lineage: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE),
    authority: z.enum(['synthetic_test', 'controlled_live']),
    qualityAuthority: z.enum([
      'none',
      'retriever_final_response_architecture_recovery_semantic_gate',
    ]),
    runId: UUID,
    runScope: z.literal('branch'),
    generatedAt: DATETIME,
    source: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
    reportLogicalSha256: SHA256,
    report: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
    durability: z
      .object({
        version: z.literal(PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_VERSION),
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
      artifact.authority === 'controlled_live' && artifact.report.gate.passed
        ? 'retriever_final_response_architecture_recovery_semantic_gate'
        : 'none';
    if (
      artifact.qualityAuthority !== expectedQuality ||
      artifact.report.qualityAuthority !== expectedQuality ||
      artifact.report.authority !== artifact.authority ||
      artifact.report.runId !== artifact.runId ||
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

export type Phase698ArchitectureRecoveryArtifact = z.infer<
  typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_SCHEMA
>;

type ActiveCall = {
  identity: Phase698ArchitectureRecoveryCallIdentity;
  runnerStages: Phase698ArchitectureRecoveryRunnerStage[];
  diagnosticStages: Phase698ArchitectureRecoveryDiagnosticStage[];
  diagnosticTerminal: Phase698ArchitectureRecoveryDiagnosticJournalTerminal | null;
  preparedSuccess: Phase698ArchitectureRecoveryCallEntry | null;
  prepared: Phase698ArchitectureRecoveryCallEntry | null;
  pendingDiagnosticStage: Phase698ArchitectureRecoveryDiagnosticStage | null;
};

type ReplayState = {
  marker: Phase698ArchitectureRecoveryMarker;
  markerSha256: string;
  records: Phase698ArchitectureRecoveryJournalRecord[];
  guards: Phase698ArchitectureRecoveryGuardEntry[];
  calls: Phase698ArchitectureRecoveryCallEntry[];
  rewrites: Phase698ArchitectureRecoveryRewriteEntry[];
  finals: Phase698ArchitectureRecoveryFinalEntry[];
  activeCall: ActiveCall | null;
  recoveryClaimSha256: string | null;
  terminal: Extract<Phase698ArchitectureRecoveryJournalRecord, { event: 'run_terminal' }> | null;
  publicationStarted: Extract<
    Phase698ArchitectureRecoveryJournalRecord,
    { event: 'publication_started' }
  > | null;
  published: Extract<
    Phase698ArchitectureRecoveryJournalRecord,
    { event: 'evidence_published' }
  > | null;
};

type ReservationState = ReplayState & {
  root: string;
  journalPath: string;
  failed: boolean;
  queue: Promise<void>;
};

export type Phase698ArchitectureRecoveryReservation = Readonly<{
  runId: string;
  markerRelativePath: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH;
  journalRelativePath: string;
  lifecycle: Phase698ArchitectureRecoveryLifecycle;
  publishArtifact(
    report: Phase698ArchitectureRecoveryReport,
  ): Promise<Readonly<{ relativePath: string; evidenceSha256: string }>>;
}>;

export type Phase698ArchitectureRecoveryCrashSealResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
      gate: Phase698ArchitectureRecoveryReport['gate'];
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

export async function reservePhase698ArchitectureRecoveryAttempt(input: {
  root: string;
  runId: string;
  createdAt: string;
  runMode?: 'synthetic_fault' | 'reviewed_mock' | 'controlled_live';
  reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
}): Promise<Phase698ArchitectureRecoveryReservation> {
  const root = await requireRoot(input.root);
  const admission = consumePhase698ArchitectureRecoveryReservationCapability(
    input.reservationCapability,
    root,
  );
  const runMode =
    input.runMode ??
    (admission.authority === 'controlled_live' ? 'controlled_live' : 'synthetic_fault');
  const marker = PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    runId: input.runId,
    runScope: 'branch',
    authority: admission.authority,
    runMode,
    credentialReads: admission.authority === 'controlled_live' ? 3 : 0,
    createdAt: input.createdAt,
    creatorPid: process.pid,
    source: admission.source,
  });
  await ensureTmp(root);
  if ((await formalFiles(root)).length !== 0) throw new Error(DURABILITY_ERROR);
  const markerPath = resolveWritableRelative(
    root,
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH,
  );
  const markerBytes = `${JSON.stringify(marker)}\n`;
  await writeExclusive(markerPath, markerBytes);
  await syncDirectory(dirname(markerPath));
  const markerSha256 = sha256(markerBytes);
  const journalRelative = journalPhase698ArchitectureRecoveryRelativePath(marker.runId);
  const journalPath = resolveWritableRelative(root, journalRelative);
  const state = createState(root, journalPath, marker, markerSha256);
  const attempt = nextRecord(state, { event: 'attempt_reserved' });
  await writeExclusive(journalPath, `${JSON.stringify(attempt)}\n`);
  await syncDirectory(dirname(journalPath));
  applyRecord(state, attempt);
  return reservationFromState(state, journalRelative);
}

export async function validatePhase698ArchitectureRecoveryBundle(input: { root: string }) {
  try {
    const root = await requireRoot(input.root);
    const markerBytes = await readRegular(
      resolveKnownRelative(root, PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH),
    );
    const marker = PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${JSON.stringify(marker)}\n`) throw new Error(DURABILITY_ERROR);
    const markerSha256 = sha256(markerBytes);
    const journalPath = resolveKnownRelative(
      root,
      journalPhase698ArchitectureRecoveryRelativePath(marker.runId),
    );
    const records = parseJournal(await readRegular(journalPath), marker, markerSha256);
    const replay = replayRecords(marker, markerSha256, records);
    if (!replay.terminal || !replay.publicationStarted || !replay.published) {
      throw new Error(DURABILITY_ERROR);
    }
    const report = recomputeReport(replay, replay.terminal.completionMode);
    const artifactPath = resolveKnownRelative(
      root,
      artifactPhase698ArchitectureRecoveryRelativePath(marker.runId),
    );
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_SCHEMA.parse(
      JSON.parse(artifactBytes),
    );
    if (artifactBytes !== `${JSON.stringify(artifact)}\n`) throw new Error(DURABILITY_ERROR);
    const expected = buildArtifact(replay);
    const reportSha = sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(report),
    );
    const artifactSha = sha256(artifactBytes);
    if (
      canonicalPhase698ArchitectureRecoveryJson(artifact) !==
        canonicalPhase698ArchitectureRecoveryJson(expected) ||
      canonicalPhase698ArchitectureRecoveryJson(artifact.report) !==
        canonicalPhase698ArchitectureRecoveryJson(report) ||
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

export function sealPhase698ArchitectureRecoveryInterruptedAttempt(input: {
  root: string;
}): Promise<Phase698ArchitectureRecoveryCrashSealResult> {
  return sealInterrupted(input.root, isProcessAlive);
}

/** Synthetic-only process liveness seam for isolated temp-root tests. */
export function sealPhase698ArchitectureRecoveryInterruptedAttemptForTest(input: {
  root: string;
  isProcessAlive(processId: number): boolean;
}): Promise<Phase698ArchitectureRecoveryCrashSealResult> {
  return sealInterrupted(input.root, (processId) => input.isProcessAlive(processId));
}

async function sealInterrupted(
  rootInput: string,
  processAlive: (processId: number) => boolean,
): Promise<Phase698ArchitectureRecoveryCrashSealResult> {
  let root: string;
  let marker: Phase698ArchitectureRecoveryMarker;
  let markerBytes: string;
  try {
    root = await requireRoot(rootInput);
    markerBytes = await readRegular(
      resolveKnownRelative(root, PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH),
    );
    marker = PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${JSON.stringify(marker)}\n`) throw new Error(DURABILITY_ERROR);
  } catch {
    return Object.freeze({ ok: false, code: 'marker_missing_or_invalid' });
  }
  if (processAlive(marker.creatorPid)) return Object.freeze({ ok: false, code: 'process_active' });
  const markerSha256 = sha256(markerBytes);
  const journalPath = resolveKnownRelative(
    root,
    journalPhase698ArchitectureRecoveryRelativePath(marker.runId),
  );
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
    const finalArtifactPath = resolveKnownRelative(
      root,
      artifactPhase698ArchitectureRecoveryRelativePath(marker.runId),
    );
    const existingArtifact = replay.publicationStarted && (await pathExists(finalArtifactPath));
    if (existingArtifact) {
      const state = stateFromReplay(root, journalPath, replay);
      const published = await finalizeExistingArtifact(state);
      const validation = await validatePhase698ArchitectureRecoveryBundle({ root });
      if (!validation.ok || validation.runId !== marker.runId) {
        return Object.freeze({ ok: false, code: 'publication_invalid' });
      }
      return Object.freeze({
        ok: true,
        runId: marker.runId,
        disposition: 'terminal_publication_recovered',
        artifactSha256: published.evidenceSha256,
        gate: state.terminal!.report.gate,
      });
    }
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
    const validation = await validatePhase698ArchitectureRecoveryBundle({ root });
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
  journalRelativePath: string,
): Phase698ArchitectureRecoveryReservation {
  const lifecycle: Phase698ArchitectureRecoveryLifecycle = Object.freeze({
    runId: state.marker.runId,
    appendGuardTerminal: (entry) => enqueue(state, () => appendGuard(state, entry)),
    reserveCall: (identity) =>
      enqueueResult(state, async () => {
        await appendRecord(state, { event: 'call_reserved', identity });
        return callLifecycle(state, identity);
      }),
    appendCallTerminal: (entry) => enqueue(state, () => appendCall(state, entry)),
    appendRewriteTerminal: (entry) => enqueue(state, () => appendRewrite(state, entry)),
    appendFinalTerminal: (entry) => enqueue(state, () => appendFinal(state, entry)),
    appendRunTerminal: (report) => enqueue(state, () => appendRunTerminal(state, report)),
  });
  return Object.freeze({
    runId: state.marker.runId,
    markerRelativePath: PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH,
    journalRelativePath,
    lifecycle,
    publishArtifact: (report) => enqueueResult(state, () => publishArtifact(state, report)),
  });
}

function callLifecycle(
  state: ReservationState,
  identity: Phase698ArchitectureRecoveryCallIdentity,
): Phase698ArchitectureRecoveryCallLifecycle {
  return Object.freeze({
    appendRunnerStage: (stage, preparedSuccess) =>
      enqueue(state, () =>
        appendRecord(state, {
          event: 'runner_stage',
          identity,
          stage,
          preparedSuccess:
            preparedSuccess === undefined
              ? null
              : PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse(preparedSuccess),
        }),
      ),
    appendDiagnosticStage: (event, stage, terminal) =>
      enqueue(state, () => appendDiagnostic(state, identity, event, stage, terminal)),
    appendCallPrepared: (entry) =>
      enqueue(state, () =>
        appendRecord(state, {
          event: 'call_prepared',
          entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse(entry),
        }),
      ),
  });
}

async function appendGuard(state: ReservationState, entry: Phase698ArchitectureRecoveryGuardEntry) {
  await appendRecord(state, {
    event: 'guard_terminal',
    entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendDiagnostic(
  state: ReservationState,
  identity: Phase698ArchitectureRecoveryCallIdentity,
  event: 'started' | 'succeeded' | 'failed',
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
  terminal?: Phase698ArchitectureRecoveryDiagnosticJournalTerminal,
) {
  if (!state.activeCall || state.activeCall.identity.callId !== identity.callId) {
    throw new Error(DURABILITY_ERROR);
  }
  if (event === 'started') {
    if (terminal !== undefined || state.activeCall.pendingDiagnosticStage !== null) {
      throw new Error(DURABILITY_ERROR);
    }
    state.activeCall.pendingDiagnosticStage = stage;
    return;
  }
  if (state.activeCall.pendingDiagnosticStage !== stage) throw new Error(DURABILITY_ERROR);
  const pending = state.activeCall.pendingDiagnosticStage;
  state.activeCall.pendingDiagnosticStage = null;
  const started = nextRecord(state, {
    event: 'diagnostic_stage_started',
    identity,
    stage: pending,
  });
  const finished = nextRecordAfter(state, started, {
    event: event === 'succeeded' ? 'diagnostic_stage_succeeded' : 'diagnostic_stage_failed',
    identity,
    stage,
    ...(event === 'succeeded'
      ? { terminal: terminal === undefined ? null : DIAGNOSTIC_TERMINAL_SCHEMA.parse(terminal) }
      : { terminal: DIAGNOSTIC_TERMINAL_SCHEMA.parse(terminal) }),
  });
  await appendRecords(state, [started, finished]);
}

async function appendCall(state: ReservationState, entry: Phase698ArchitectureRecoveryCallEntry) {
  await appendRecord(state, {
    event: 'call_terminal',
    entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendRewrite(
  state: ReservationState,
  entry: Phase698ArchitectureRecoveryRewriteEntry,
) {
  await appendRecord(state, {
    event: 'rewrite_terminal',
    entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendFinal(state: ReservationState, entry: Phase698ArchitectureRecoveryFinalEntry) {
  await appendRecord(state, {
    event: 'final_terminal',
    entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA.parse(entry),
  });
}

async function appendRunTerminal(
  state: ReservationState,
  report: Phase698ArchitectureRecoveryReport,
) {
  const parsed = parsePhase698ArchitectureRecoveryReport(report);
  const recomputed = recomputeReport(state, report.completionMode);
  if (
    !parsed ||
    canonicalPhase698ArchitectureRecoveryJson(parsed) !==
      canonicalPhase698ArchitectureRecoveryJson(recomputed)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  await appendRecord(state, {
    event: 'run_terminal',
    report: parsed,
    reportLogicalSha256: sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(parsed),
    ),
    completionMode: report.completionMode,
  });
}

async function publishArtifact(
  state: ReservationState,
  report: Phase698ArchitectureRecoveryReport,
) {
  if (
    !state.terminal ||
    state.published ||
    canonicalPhase698ArchitectureRecoveryJson(report) !==
      canonicalPhase698ArchitectureRecoveryJson(state.terminal.report)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  if (!state.publicationStarted) {
    await appendRecord(state, {
      event: 'publication_started',
      generatedAt: new Date().toISOString(),
    });
  }
  const artifact = buildArtifact(state);
  const bytes = `${JSON.stringify(artifact)}\n`;
  const relativePath = artifactPhase698ArchitectureRecoveryRelativePath(state.marker.runId);
  const finalPath = resolveWritableRelative(state.root, relativePath);
  if (await pathExists(finalPath)) throw new Error(DURABILITY_ERROR);
  const tempRelative = `${relativePath}.tmp.${randomUUID()}`;
  const tempPath = resolveWritableRelative(state.root, tempRelative, true);
  try {
    await writeExclusive(tempPath, bytes);
    await link(tempPath, finalPath);
    await assertHardLink(tempPath, finalPath);
    if ((await readRegular(finalPath)) !== bytes) throw new Error(DURABILITY_ERROR);
    await syncDirectory(dirname(finalPath));
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = sha256(bytes);
  await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({ relativePath, evidenceSha256 });
}

async function finalizeExistingArtifact(state: ReservationState) {
  if (!state.terminal || !state.publicationStarted || state.published) {
    throw new Error(DURABILITY_ERROR);
  }
  const artifact = buildArtifact(state);
  const bytes = `${JSON.stringify(artifact)}\n`;
  const finalPath = resolveKnownRelative(
    state.root,
    artifactPhase698ArchitectureRecoveryRelativePath(state.marker.runId),
  );
  if ((await readRegular(finalPath)) !== bytes) throw new Error(DURABILITY_ERROR);
  const evidenceSha256 = sha256(bytes);
  await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({
    relativePath: artifactPhase698ArchitectureRecoveryRelativePath(state.marker.runId),
    evidenceSha256,
  });
}

function createState(
  root: string,
  journalPath: string,
  marker: Phase698ArchitectureRecoveryMarker,
  markerSha256: string,
): ReservationState {
  return {
    root,
    journalPath,
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
    failed: false,
    queue: Promise.resolve(),
  };
}

function stateFromReplay(root: string, journalPath: string, replay: ReplayState): ReservationState {
  return {
    root,
    journalPath,
    marker: replay.marker,
    markerSha256: replay.markerSha256,
    records: [...replay.records],
    guards: [...replay.guards],
    calls: [...replay.calls],
    rewrites: [...replay.rewrites],
    finals: [...replay.finals],
    activeCall: cloneActive(replay.activeCall),
    recoveryClaimSha256: replay.recoveryClaimSha256,
    terminal: replay.terminal,
    publicationStarted: replay.publicationStarted,
    published: replay.published,
    failed: false,
    queue: Promise.resolve(),
  };
}

function cloneActive(active: ActiveCall | null): ActiveCall | null {
  return active
    ? {
        identity: active.identity,
        runnerStages: [...active.runnerStages],
        diagnosticStages: [...active.diagnosticStages],
        diagnosticTerminal: active.diagnosticTerminal,
        preparedSuccess: active.preparedSuccess,
        prepared: active.prepared,
        pendingDiagnosticStage: null,
      }
    : null;
}

function replayRecords(
  marker: Phase698ArchitectureRecoveryMarker,
  markerSha256: string,
  records: readonly Phase698ArchitectureRecoveryJournalRecord[],
): ReplayState {
  const replay: ReplayState = {
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
  for (const record of records) applyRecord(replay, record);
  return replay;
}

function applyRecord(state: ReplayState, record: Phase698ArchitectureRecoveryJournalRecord) {
  const expectedSequence = state.records.length + 1;
  const expectedPrevious = state.records.at(-1)?.recordHash ?? null;
  if (
    record.sequence !== expectedSequence ||
    record.previousHash !== expectedPrevious ||
    record.runId !== state.marker.runId ||
    record.markerSha256 !== state.markerSha256 ||
    record.lineage !== PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE ||
    record.recordHash !== hashRecord(record)
  ) {
    throw new Error(DURABILITY_ERROR);
  }
  if (state.published) throw new Error(DURABILITY_ERROR);
  switch (record.event) {
    case 'attempt_reserved':
      if (state.records.length !== 0) throw new Error(DURABILITY_ERROR);
      break;
    case 'guard_terminal': {
      requireOpenRun(state);
      if (state.activeCall || state.calls.length > 0 || state.guards.length >= 16) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = PHASE_6_9_8_TASK8_MANIFEST.guardCases[state.guards.length];
      if (!expected || expected.caseId !== record.entry.caseId) throw new Error(DURABILITY_ERROR);
      state.guards.push(record.entry);
      break;
    }
    case 'call_reserved': {
      requireOpenRun(state);
      if (state.guards.length !== 16 || state.activeCall) throw new Error(DURABILITY_ERROR);
      const expected = expectedPhase698ArchitectureRecoveryCallSchedule()[state.calls.length];
      if (!expected || !sameIdentity(expected, record.identity)) throw new Error(DURABILITY_ERROR);
      state.activeCall = {
        identity: expected,
        runnerStages: [],
        diagnosticStages: [],
        diagnosticTerminal: null,
        preparedSuccess: null,
        prepared: null,
        pendingDiagnosticStage: null,
      };
      break;
    }
    case 'runner_stage': {
      const active = requireActive(state, record.identity);
      const expected = PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_STAGES[active.runnerStages.length];
      if (record.stage !== expected) throw new Error(DURABILITY_ERROR);
      active.runnerStages.push(record.stage);
      if (record.stage === 'verified_result') {
        if (
          !record.preparedSuccess ||
          active.diagnosticTerminal?.diagnostic.reasonCode !== 'applied' ||
          !callMatchesActive(record.preparedSuccess, active) ||
          record.preparedSuccess.disposition !== 'succeeded' ||
          record.preparedSuccess.runnerWire.verifiedResults !== 1
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        active.preparedSuccess = record.preparedSuccess;
      } else if (record.preparedSuccess !== null) {
        throw new Error(DURABILITY_ERROR);
      }
      break;
    }
    case 'diagnostic_stage_started': {
      const active = requireActive(state, record.identity);
      if (active.diagnosticTerminal || active.pendingDiagnosticStage !== null) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = architectureRecoveryDiagnosticSequence(active.identity.phase)[
        active.diagnosticStages.length
      ];
      if (record.stage !== expected) throw new Error(DURABILITY_ERROR);
      active.pendingDiagnosticStage = record.stage;
      break;
    }
    case 'diagnostic_stage_succeeded': {
      const active = requireActive(state, record.identity);
      if (active.pendingDiagnosticStage !== record.stage || active.diagnosticTerminal) {
        throw new Error(DURABILITY_ERROR);
      }
      active.pendingDiagnosticStage = null;
      active.diagnosticStages.push(record.stage);
      if (record.terminal === null) {
        if (record.stage === 'applied') throw new Error(DURABILITY_ERROR);
      } else {
        if (
          record.stage !== 'applied' ||
          record.terminal.diagnostic.stage !== 'applied' ||
          record.terminal.diagnostic.reasonCode !== 'applied' ||
          !terminalMatchesActive(record.terminal, active)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        active.diagnosticTerminal = record.terminal;
      }
      break;
    }
    case 'diagnostic_stage_failed': {
      const active = requireActive(state, record.identity);
      if (
        active.pendingDiagnosticStage !== record.stage ||
        active.diagnosticTerminal ||
        record.terminal.diagnostic.stage !== record.stage ||
        record.terminal.diagnostic.reasonCode === 'applied' ||
        !terminalMatchesActive(record.terminal, active)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      active.pendingDiagnosticStage = null;
      active.diagnosticTerminal = record.terminal;
      break;
    }
    case 'call_prepared': {
      const active = requireActive(state, record.entry);
      if (
        active.pendingDiagnosticStage ||
        !active.diagnosticTerminal ||
        active.prepared ||
        !callMatchesActive(record.entry, active) ||
        (record.entry.disposition === 'succeeded' &&
          canonicalPhase698ArchitectureRecoveryJson(record.entry) !==
            canonicalPhase698ArchitectureRecoveryJson(active.preparedSuccess))
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      active.prepared = record.entry;
      break;
    }
    case 'call_terminal': {
      requireOpenRun(state);
      if (state.activeCall) {
        const active = requireActive(state, record.entry);
        if (
          !active.prepared ||
          canonicalPhase698ArchitectureRecoveryJson(record.entry) !==
            canonicalPhase698ArchitectureRecoveryJson(active.prepared)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        state.calls.push(record.entry);
        state.activeCall = null;
      } else {
        const expected = expectedPhase698ArchitectureRecoveryCallSchedule()[state.calls.length];
        if (
          !expected ||
          !record.entry.disposition.startsWith('not_started_') ||
          !sameIdentity(expected, record.entry)
        ) {
          throw new Error(DURABILITY_ERROR);
        }
        state.calls.push(record.entry);
      }
      break;
    }
    case 'rewrite_terminal': {
      requireOpenRun(state);
      if (state.activeCall || state.rewrites.length >= 16) throw new Error(DURABILITY_ERROR);
      const expected = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[state.rewrites.length];
      if (!expected || expected.caseId !== record.entry.caseId) throw new Error(DURABILITY_ERROR);
      const requiredCalls = (state.rewrites.length + 1) * 3;
      if (state.calls.length < requiredCalls) throw new Error(DURABILITY_ERROR);
      state.rewrites.push(record.entry);
      break;
    }
    case 'final_terminal': {
      requireOpenRun(state);
      if (state.activeCall || state.rewrites.length !== 16 || state.finals.length >= 16) {
        throw new Error(DURABILITY_ERROR);
      }
      const expected = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[state.finals.length];
      if (!expected || expected.caseId !== record.entry.caseId) throw new Error(DURABILITY_ERROR);
      if (state.calls.length < 48 + state.finals.length + 1) throw new Error(DURABILITY_ERROR);
      state.finals.push(record.entry);
      break;
    }
    case 'recovery_claimed':
      if (
        state.published ||
        state.recoveryClaimSha256 !== null ||
        (state.terminal !== null && state.terminal.completionMode !== 'runtime')
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.recoveryClaimSha256 = record.claimSha256;
      break;
    case 'run_terminal': {
      requireOpenRun(state);
      if (
        state.activeCall ||
        state.guards.length !== 16 ||
        state.calls.length !== 64 ||
        state.rewrites.length !== 16 ||
        state.finals.length !== 16 ||
        record.report.completionMode !== record.completionMode ||
        (record.completionMode === 'runtime' && state.recoveryClaimSha256 !== null) ||
        (record.completionMode === 'recovery' && state.recoveryClaimSha256 === null)
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      const recomputed = recomputeReport(state, record.completionMode);
      if (
        canonicalPhase698ArchitectureRecoveryJson(record.report) !==
          canonicalPhase698ArchitectureRecoveryJson(recomputed) ||
        record.reportLogicalSha256 !==
          sha256Phase698ArchitectureRecovery(
            canonicalPhase698ArchitectureRecoveryJson(record.report),
          )
      ) {
        throw new Error(DURABILITY_ERROR);
      }
      state.terminal = record;
      break;
    }
    case 'publication_started':
      if (!state.terminal || state.publicationStarted) throw new Error(DURABILITY_ERROR);
      state.publicationStarted = record;
      break;
    case 'evidence_published':
      if (!state.terminal || !state.publicationStarted || state.published) {
        throw new Error(DURABILITY_ERROR);
      }
      state.published = record;
      break;
    default:
      throw new Error(DURABILITY_ERROR);
  }
  state.records.push(record);
}

function requireOpenRun(state: ReplayState) {
  if (state.terminal || state.publicationStarted || state.published)
    throw new Error(DURABILITY_ERROR);
}

function requireActive(
  state: ReplayState,
  identity: Pick<Phase698ArchitectureRecoveryCallIdentity, 'callId'>,
) {
  requireOpenRun(state);
  if (!state.activeCall || state.activeCall.identity.callId !== identity.callId) {
    throw new Error(DURABILITY_ERROR);
  }
  return state.activeCall;
}

function terminalMatchesActive(
  terminal: Phase698ArchitectureRecoveryDiagnosticJournalTerminal,
  active: ActiveCall,
) {
  return (
    terminal.diagnostic.callPhase === active.identity.phase &&
    canonicalPhase698ArchitectureRecoveryJson(terminal.diagnosticStages) ===
      canonicalPhase698ArchitectureRecoveryJson(active.diagnosticStages) &&
    providerWireCoherent(terminal.providerWire)
  );
}

function callMatchesActive(entry: Phase698ArchitectureRecoveryCallEntry, active: ActiveCall) {
  const terminal = active.diagnosticTerminal;
  return Boolean(
    terminal &&
    sameIdentity(entry, active.identity) &&
    canonicalPhase698ArchitectureRecoveryJson(entry.diagnostic) ===
      canonicalPhase698ArchitectureRecoveryJson(terminal.diagnostic) &&
    canonicalPhase698ArchitectureRecoveryJson(entry.diagnosticStages) ===
      canonicalPhase698ArchitectureRecoveryJson(terminal.diagnosticStages) &&
    canonicalPhase698ArchitectureRecoveryJson(entry.providerWire) ===
      canonicalPhase698ArchitectureRecoveryJson(terminal.providerWire) &&
    entry.runnerWire.reservations === 1 &&
    entry.runnerWire.dispatches === Number(active.runnerStages.includes('dispatch_started')) &&
    entry.runnerWire.harnessReturns === Number(active.runnerStages.includes('harness_returned')) &&
    entry.runnerWire.verifiedResults === Number(active.runnerStages.includes('verified_result')),
  );
}

function providerWireCoherent(wire: Phase698ArchitectureRecoveryProviderWire) {
  return (
    wire.executions >= wire.dispatches &&
    wire.dispatches >= wire.responses &&
    wire.responses >= wire.verifiedUsage
  );
}

function sameIdentity(
  left: Pick<
    Phase698ArchitectureRecoveryCallIdentity,
    'callId' | 'caseId' | 'phase' | 'provider' | 'model' | 'priceProfile'
  >,
  right: Pick<
    Phase698ArchitectureRecoveryCallIdentity,
    'callId' | 'caseId' | 'phase' | 'provider' | 'model' | 'priceProfile'
  >,
) {
  return (
    left.callId === right.callId &&
    left.caseId === right.caseId &&
    left.phase === right.phase &&
    left.provider === right.provider &&
    left.model === right.model &&
    left.priceProfile === right.priceProfile
  );
}

async function completeRecovery(state: ReservationState) {
  if (state.recoveryClaimSha256 === null || state.terminal) throw new Error(DURABILITY_ERROR);
  while (state.guards.length < 16) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.guardCases[state.guards.length];
    if (!testCase) throw new Error(DURABILITY_ERROR);
    await appendRecord(state, {
      event: 'guard_terminal',
      entry: PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA.parse({
        kind: 'guard',
        caseId: testCase.caseId,
        disposition: 'failed',
        expectedReasonCode: testCase.expectedReasonCode,
        observedReasonCode: 'crash_recovery',
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      }),
    });
  }
  if (state.activeCall) await closeActiveCallForRecovery(state);
  const guardBreaker = state.guards.every((entry) => entry.disposition === 'passed')
    ? 'quality_breaker'
    : 'case_guard';
  const transport =
    state.marker.authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected';
  const schedule = expectedPhase698ArchitectureRecoveryCallSchedule();
  while (state.calls.length < schedule.length) {
    const identity = schedule[state.calls.length];
    if (!identity) throw new Error(DURABILITY_ERROR);
    await appendRecord(state, {
      event: 'call_terminal',
      entry: createPhase698ArchitectureRecoveryNotStartedEntry(identity, transport, guardBreaker),
    });
  }
  while (state.rewrites.length < 16) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[state.rewrites.length];
    if (!testCase) throw new Error(DURABILITY_ERROR);
    await appendRecord(state, {
      event: 'rewrite_terminal',
      entry: incompleteRewrite(testCase),
    });
  }
  while (state.finals.length < 16) {
    const testCase = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases[state.finals.length];
    if (!testCase) throw new Error(DURABILITY_ERROR);
    const call = state.calls[48 + state.finals.length];
    if (!call) throw new Error(DURABILITY_ERROR);
    await appendRecord(state, {
      event: 'final_terminal',
      entry: incompleteFinal(testCase, call.disposition),
    });
  }
  const report = recomputeReport(state, 'recovery');
  await appendRecord(state, {
    event: 'run_terminal',
    report,
    reportLogicalSha256: sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(report),
    ),
    completionMode: 'recovery',
  });
}

async function closeActiveCallForRecovery(state: ReservationState) {
  const active = state.activeCall;
  if (!active) return;
  if (active.pendingDiagnosticStage !== null) active.pendingDiagnosticStage = null;
  if (!active.diagnosticTerminal) {
    const terminal = recoveryTerminalForActive(active);
    const stage = terminal.diagnostic.stage;
    const started = nextRecord(state, {
      event: 'diagnostic_stage_started',
      identity: active.identity,
      stage,
    });
    const succeeded = terminal.diagnostic.reasonCode === 'applied';
    const finished = nextRecordAfter(state, started, {
      event: succeeded ? 'diagnostic_stage_succeeded' : 'diagnostic_stage_failed',
      identity: active.identity,
      stage,
      ...(succeeded ? { terminal } : { terminal }),
    });
    await appendRecords(state, [started, finished]);
  }
  const current = state.activeCall;
  if (!current?.diagnosticTerminal) throw new Error(DURABILITY_ERROR);
  let prepared = current.prepared ?? current.preparedSuccess;
  if (!prepared) {
    prepared = PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse({
      kind: 'provider_call',
      ...current.identity,
      transportAuthority:
        state.marker.authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected',
      disposition: 'failed',
      failureReason: 'runtime_contract_invalid',
      runnerWire: {
        reservations: 1,
        dispatches: Number(current.runnerStages.includes('dispatch_started')),
        harnessReturns: Number(current.runnerStages.includes('harness_returned')),
        verifiedResults: 0,
      },
      providerWire: current.diagnosticTerminal.providerWire,
      diagnosticStages: current.diagnosticTerminal.diagnosticStages,
      diagnostic: current.diagnosticTerminal.diagnostic,
      usage: null,
      verifiedCostCny: null,
      durationMs: 0,
    });
    await appendRecord(state, { event: 'call_prepared', entry: prepared });
  } else if (!current.prepared) {
    await appendRecord(state, { event: 'call_prepared', entry: prepared });
  }
  await appendRecord(state, { event: 'call_terminal', entry: prepared });
}

function recoveryTerminalForActive(
  active: ActiveCall,
): Phase698ArchitectureRecoveryDiagnosticJournalTerminal {
  const sequence = architectureRecoveryDiagnosticSequence(active.identity.phase);
  const completed = [...active.diagnosticStages];
  const next = sequence[completed.length];
  if (!next) throw new Error(DURABILITY_ERROR);
  const applied = next === 'applied';
  const diagnosticStages = applied ? [...completed, 'applied' as const] : completed;
  const providerWire = inferProviderWire(diagnosticStages);
  const diagnostic = PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.parse({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase: active.identity.phase,
    stage: next,
    reasonCode: applied ? 'applied' : 'unknown',
    providerBoundary: boundaryFromStages(diagnosticStages),
    topLevelTypeBucket: 'unknown',
    fieldCountBucket: 'unknown',
    terminalCountBucket:
      active.identity.phase === 'final_response_model' ? 'unknown' : 'not_applicable',
    rawDataRetained: false,
  });
  return Object.freeze({
    diagnostic,
    diagnosticStages: Object.freeze(diagnosticStages),
    providerWire,
  });
}

function inferProviderWire(
  stages: readonly Phase698ArchitectureRecoveryDiagnosticStage[],
): Phase698ArchitectureRecoveryProviderWire {
  const dispatches = Number(stages.includes('provider_dispatch'));
  const responses = Number(stages.includes('provider_response'));
  const verifiedUsage = Number(stages.includes('usage_contract'));
  return Object.freeze({
    executions: stages.length > 0 ? 1 : 0,
    dispatches,
    responses,
    verifiedUsage,
  });
}

function boundaryFromStages(stages: readonly Phase698ArchitectureRecoveryDiagnosticStage[]) {
  return stages.includes('usage_contract')
    ? ('response_and_usage_observed' as const)
    : stages.includes('provider_response')
      ? ('response_observed' as const)
      : stages.includes('provider_dispatch')
        ? ('dispatched_no_response' as const)
        : ('not_dispatched' as const);
}

function incompleteRewrite(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number]) {
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: sha256Reference(testCase.originalQuery),
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

function incompleteFinal(
  testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number],
  disposition: Phase698ArchitectureRecoveryCallEntry['disposition'],
) {
  const attempted = !disposition.startsWith('not_started_');
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA.parse({
    kind: 'final_response',
    caseId: testCase.caseId,
    responseTextHash: null,
    evidenceStatus: testCase.evidenceStatus,
    strict: false,
    terminal: attempted ? (disposition === 'aborted' ? 'aborted' : 'response_failed') : null,
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

function recomputeReport(state: ReplayState, completionMode: 'runtime' | 'recovery') {
  return buildPhase698ArchitectureRecoveryReport({
    runId: state.marker.runId,
    authority: state.marker.authority,
    runMode: state.marker.runMode,
    completionMode,
    source: state.marker.source,
    credentialReads: state.marker.credentialReads,
    guardEntries: state.guards,
    callEntries: state.calls,
    rewriteEntries: state.rewrites,
    finalResponseEntries: state.finals,
  });
}

function buildArtifact(state: ReplayState): Phase698ArchitectureRecoveryArtifact {
  if (!state.terminal || !state.publicationStarted) throw new Error(DURABILITY_ERROR);
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_ARTIFACT_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    authority: state.marker.authority,
    qualityAuthority: state.terminal.report.qualityAuthority,
    runId: state.marker.runId,
    runScope: 'branch',
    generatedAt: state.publicationStarted.generatedAt,
    source: state.marker.source,
    reportLogicalSha256: state.terminal.reportLogicalSha256,
    report: state.terminal.report,
    durability: {
      version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_VERSION,
      completionMode: state.terminal.completionMode,
      publicationMode: state.recoveryClaimSha256 === null ? 'runtime' : 'recovery',
      publicationStrategy: 'exclusive_temp_hard_link',
      markerSha256: state.markerSha256,
      terminalSequence: state.terminal.sequence,
      terminalRecordHash: state.terminal.recordHash,
      journalRecordsBeforePublication: state.publicationStarted.sequence,
      recoveryClaimSha256: state.recoveryClaimSha256,
    },
  });
}

function sha256Reference(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function appendRecord(state: ReservationState, event: Record<string, unknown>) {
  if (state.failed || state.published) throw new Error(DURABILITY_ERROR);
  const record = nextRecord(state, event);
  previewRecord(state, record);
  try {
    await appendRegular(state.journalPath, `${JSON.stringify(record)}\n`);
    applyRecord(state, record);
  } catch (error) {
    state.failed = true;
    throw error;
  }
}

async function appendRecords(
  state: ReservationState,
  records: readonly Phase698ArchitectureRecoveryJournalRecord[],
) {
  if (state.failed || state.published || records.length === 0) throw new Error(DURABILITY_ERROR);
  const preview = stateFromReplay(state.root, state.journalPath, state);
  for (const record of records) applyRecord(preview, record);
  try {
    await appendRegular(
      state.journalPath,
      records.map((record) => `${JSON.stringify(record)}\n`).join(''),
    );
    for (const record of records) applyRecord(state, record);
  } catch (error) {
    state.failed = true;
    throw error;
  }
}

function previewRecord(state: ReservationState, record: Phase698ArchitectureRecoveryJournalRecord) {
  const preview = stateFromReplay(state.root, state.journalPath, state);
  applyRecord(preview, record);
}

function nextRecord(state: ReplayState, event: Record<string, unknown>) {
  const unsigned = {
    recordVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_JOURNAL_RECORD_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    runId: state.marker.runId,
    sequence: state.records.length + 1,
    recordedAt: new Date().toISOString(),
    markerSha256: state.markerSha256,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...event,
  };
  return JOURNAL_RECORD_SCHEMA.parse({
    ...unsigned,
    recordHash: sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(unsigned),
    ),
  });
}

function nextRecordAfter(
  state: ReplayState,
  previous: Phase698ArchitectureRecoveryJournalRecord,
  event: Record<string, unknown>,
) {
  const unsigned = {
    recordVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_JOURNAL_RECORD_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    runId: state.marker.runId,
    sequence: previous.sequence + 1,
    recordedAt: new Date().toISOString(),
    markerSha256: state.markerSha256,
    previousHash: previous.recordHash,
    ...event,
  };
  return JOURNAL_RECORD_SCHEMA.parse({
    ...unsigned,
    recordHash: sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(unsigned),
    ),
  });
}

function hashRecord(record: Phase698ArchitectureRecoveryJournalRecord) {
  const unsigned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== 'recordHash') unsigned[key] = value;
  }
  return sha256Phase698ArchitectureRecovery(canonicalPhase698ArchitectureRecoveryJson(unsigned));
}

function parseJournal(
  bytes: string,
  marker: Phase698ArchitectureRecoveryMarker,
  markerSha256: string,
) {
  if (!bytes.endsWith('\n') || Buffer.byteLength(bytes) > MAX_FILE_BYTES) {
    throw new Error(DURABILITY_ERROR);
  }
  const lines = bytes.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0))
    throw new Error(DURABILITY_ERROR);
  const records = lines.map((line) => {
    const parsed = JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line));
    if (line !== JSON.stringify(parsed)) throw new Error(DURABILITY_ERROR);
    return parsed;
  });
  replayRecords(marker, markerSha256, records);
  return records;
}

async function acquireRecoveryClaim(root: string, replay: ReplayState) {
  const tail = replay.records.at(-1);
  if (!tail || replay.published) {
    return Object.freeze({ ok: false as const });
  }
  const recordedClaim = replay.records.find((record) => record.event === 'recovery_claimed');
  const expectedClaimTail = recordedClaim?.previousHash ?? tail.recordHash;
  if (expectedClaimTail === null) return Object.freeze({ ok: false as const });
  const claim = PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_SCHEMA.parse({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_ARCHITECTURE_RECOVERY_LINEAGE,
    runId: replay.marker.runId,
    markerSha256: replay.markerSha256,
    journalTailRecordHash: expectedClaimTail,
    claimedAt: new Date().toISOString(),
    state: 'crash_only_seal_claimed',
  });
  const claimPath = resolveWritableRelative(
    root,
    recoveryClaimPhase698ArchitectureRecoveryRelativePath(replay.marker.runId),
  );
  let bytes = `${JSON.stringify(claim)}\n`;
  try {
    await writeExclusive(claimPath, bytes);
    await syncDirectory(dirname(claimPath));
  } catch (error) {
    if (!isErrorCode(error, 'EEXIST')) return Object.freeze({ ok: false as const });
    try {
      bytes = await readRegular(claimPath);
      const existing = PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_SCHEMA.parse(
        JSON.parse(bytes),
      );
      if (
        bytes !== `${JSON.stringify(existing)}\n` ||
        existing.runId !== replay.marker.runId ||
        existing.markerSha256 !== replay.markerSha256 ||
        existing.journalTailRecordHash !== expectedClaimTail
      ) {
        return Object.freeze({ ok: false as const });
      }
    } catch {
      return Object.freeze({ ok: false as const });
    }
  }
  return Object.freeze({ ok: true as const, claimSha256: sha256(bytes) });
}

async function validateClaim(root: string, replay: ReplayState) {
  const claimPath = resolveKnownRelative(
    root,
    recoveryClaimPhase698ArchitectureRecoveryRelativePath(replay.marker.runId),
  );
  if (replay.recoveryClaimSha256 === null) {
    if (await pathExists(claimPath)) throw new Error(DURABILITY_ERROR);
    return;
  }
  const bytes = await readRegular(claimPath);
  const claim = PHASE_6_9_8_ARCHITECTURE_RECOVERY_RECOVERY_CLAIM_SCHEMA.parse(JSON.parse(bytes));
  const claimRecord = replay.records.find((record) => record.event === 'recovery_claimed');
  if (
    bytes !== `${JSON.stringify(claim)}\n` ||
    !claimRecord ||
    claimRecord.previousHash === null ||
    claim.runId !== replay.marker.runId ||
    claim.markerSha256 !== replay.markerSha256 ||
    claim.journalTailRecordHash !== claimRecord.previousHash ||
    claimRecord.claimSha256 !== replay.recoveryClaimSha256 ||
    sha256(bytes) !== replay.recoveryClaimSha256
  ) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function requireOnlyExpectedFiles(root: string, replay: ReplayState) {
  const observed = new Set((await formalFiles(root)).map((entry) => entry.name));
  const expected = new Set([
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_MARKER_RELATIVE_PATH.split('/').at(-1)!,
    journalPhase698ArchitectureRecoveryRelativePath(replay.marker.runId).split('/').at(-1)!,
    artifactPhase698ArchitectureRecoveryRelativePath(replay.marker.runId).split('/').at(-1)!,
    ...(replay.recoveryClaimSha256 === null
      ? []
      : [
          recoveryClaimPhase698ArchitectureRecoveryRelativePath(replay.marker.runId)
            .split('/')
            .at(-1)!,
        ]),
  ]);
  if (observed.size !== expected.size || [...observed].some((name) => !expected.has(name))) {
    throw new Error(DURABILITY_ERROR);
  }
}

async function formalFiles(root: string) {
  try {
    const entries = await readdir(resolveKnownRelative(root, '.tmp'), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && FORMAL_RECOVERY_FILE.test(entry.name));
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) return [];
    throw error;
  }
}

function enqueue(state: ReservationState, action: () => Promise<void>) {
  const next = state.queue.then(action);
  state.queue = next.catch(() => undefined);
  return next;
}

function enqueueResult<T>(state: ReservationState, action: () => Promise<T>) {
  const next = state.queue.then(action);
  state.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function requireRoot(rootInput: string) {
  if (typeof rootInput !== 'string' || rootInput.length === 0) throw new Error(DURABILITY_ERROR);
  const root = await realpath(resolve(rootInput));
  const metadata = await lstat(root);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(DURABILITY_ERROR);
  return root;
}

async function ensureTmp(root: string) {
  const path = resolveKnownRelative(root, '.tmp');
  await mkdir(path, { recursive: true, mode: 0o700 });
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(DURABILITY_ERROR);
}

function resolveKnownRelative(root: string, relativePath: string) {
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

function resolveWritableRelative(root: string, relativePath: string, allowTemp = false) {
  if (!isWritableRelativePath(relativePath, allowTemp)) throw new Error(DURABILITY_ERROR);
  return resolveKnownRelative(root, relativePath);
}

function isWritableRelativePath(relativePath: string, allowTemp = false) {
  if (
    typeof relativePath !== 'string' ||
    !relativePath.startsWith('.tmp/') ||
    relativePath.includes('\\') ||
    relativePath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return false;
  }
  const name = relativePath.slice('.tmp/'.length);
  if (OLD_TASK9_FILE.test(name) || name.startsWith('phase-6-9-7-')) return false;
  if (FORMAL_RECOVERY_FILE.test(name)) return true;
  return (
    allowTemp &&
    /^phase-6-9-8-retriever-final-response-architecture-recovery-[0-9a-f-]{36}\.json\.tmp\.[0-9a-f-]{36}$/u.test(
      name,
    )
  );
}

export function isPhase698ArchitectureRecoveryWritableRelativePathForTest(relativePath: string) {
  return isWritableRelativePath(relativePath);
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

export function journalPhase698ArchitectureRecoveryRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-architecture-recovery-${runId}.journal.jsonl`;
}

export function recoveryClaimPhase698ArchitectureRecoveryRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-architecture-recovery-${runId}.recovery.claim`;
}

export function artifactPhase698ArchitectureRecoveryRelativePath(runId: string) {
  UUID.parse(runId);
  return `.tmp/phase-6-9-8-retriever-final-response-architecture-recovery-${runId}.json`;
}
