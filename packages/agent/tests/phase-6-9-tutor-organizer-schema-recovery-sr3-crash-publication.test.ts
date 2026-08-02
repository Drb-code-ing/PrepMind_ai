import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_V7_WIRE_STAGES } from '@repo/ai';

import {
  PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_SCHEMA,
  PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH,
  schemaRecoveryArtifactRelativePath,
  schemaRecoveryClaimRelativePath,
  schemaRecoveryJournalRelativePath,
  sealPhase697SchemaRecoveryInterruptedAttemptForTest,
  validatePhase697SchemaRecoveryBundle,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import { createPhase697SchemaRecoveryCaseEntry } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES,
  computePhase697FullGateCanonicalSha256,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';
import {
  createF2PassingEntries,
  runtimeIdentity,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';
import {
  SR3_RUN_ID,
  createSr3Source,
  createSr3SuccessHarness,
  reserveSr3SyntheticAttempt,
} from './phase-6-9-tutor-organizer-schema-recovery-sr3-helpers.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 Schema Recovery SR3 crash-only publication', () => {
  test('crash-seals only the durable prefix and never resumes an executor', async () => {
    const root = await temporaryRoot();
    const reservation = await reserveSr3SyntheticAttempt(root);
    await appendPassingGuards(reservation.lifecycle);
    const firstPair = PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.filter(
      (entry) => entry.kind === 'runtime' && entry.pairedRunIndex === 0,
    );
    for (const expected of firstPair) {
      const lane = await reservation.lifecycle.reserveLane(runtimeIdentity(expected));
      await lane.appendSchemaStage({ event: 'started', observation: null });
      await lane.appendWireStage('executor_entered');
      await lane.appendWireStage('request_validated');
      await lane.appendWireStage('provider_dispatch_started');
    }

    const result = await sealPhase697SchemaRecoveryInterruptedAttemptForTest({
      root,
      processAlive: () => false,
    });
    expect(result).toMatchObject({
      ok: true,
      runId: SR3_RUN_ID,
      disposition: 'crash_only_sealed',
      gate: 'schema_recovery_quality_gate_failed',
    });
    expect(await validatePhase697SchemaRecoveryBundle({ root })).toMatchObject({
      ok: true,
      runId: SR3_RUN_ID,
      qualityAuthority: 'none',
    });
    const artifact = await readArtifact(root, SR3_RUN_ID);
    expect(artifact.durability).toMatchObject({
      completionMode: 'recovery',
      publicationMode: 'recovery',
    });
    expect(artifact.report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(artifact.report.schemaAccounting).toEqual({
      complete: false,
      canonical: 0,
      extensionFieldsDiscarded: 0,
      rejected: 0,
      notObserved: 48,
    });
    expect(
      artifact.report.caseEntries.filter((entry) => entry.base.disposition === 'attempted_aborted'),
    ).toHaveLength(2);
    expect(
      artifact.report.caseEntries.filter(
        (entry) => entry.base.disposition === 'not_started_quality_breaker',
      ),
    ).toHaveLength(46);
  });

  test('preserves durable usage-stage evidence when schema observation was not yet durable', async () => {
    const root = await temporaryRoot();
    const reservation = await reserveSr3SyntheticAttempt(root);
    await appendPassingGuards(reservation.lifecycle);
    const firstTutor = PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.find(
      (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
    );
    if (!firstTutor) throw new Error('SR3 first Tutor lane missing');
    const lane = await reservation.lifecycle.reserveLane(runtimeIdentity(firstTutor));
    await lane.appendSchemaStage({ event: 'started', observation: null });
    for (const stage of PHASE_6_9_7_V7_WIRE_STAGES) await lane.appendWireStage(stage);

    const result = await sealPhase697SchemaRecoveryInterruptedAttemptForTest({
      root,
      processAlive: () => false,
    });
    expect(result.ok).toBe(true);
    const artifact = await readArtifact(root, SR3_RUN_ID);
    const recoveredTutor = artifact.report.caseEntries.find(
      (entry) => entry.base.caseId === firstTutor.caseId,
    );
    expect(recoveredTutor).toMatchObject({
      base: {
        disposition: 'attempted_aborted',
        usage: null,
        wire: {
          executorEntered: 1,
          providerDispatchStarted: 1,
          providerResponseReceived: 1,
          verifiedUsageObserved: 1,
        },
      },
      schema: { outcome: 'not_observed', diagnostic: null },
    });
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(true);
  });

  test('refuses a live owner or PID reuse without creating a claim or artifact', async () => {
    const root = await temporaryRoot();
    await reserveSr3SyntheticAttempt(root);

    const result = await sealPhase697SchemaRecoveryInterruptedAttemptForTest({
      root,
      processAlive: () => true,
    });
    expect(result).toEqual({ ok: false, code: 'live_attempt_in_progress' });
    expect(await exists(resolve(root, schemaRecoveryClaimRelativePath(SR3_RUN_ID)))).toBe(false);
    expect(
      await exists(resolve(root, schemaRecoveryArtifactRelativePath('branch', SR3_RUN_ID))),
    ).toBe(false);
  });

  test('recovers publication after a durable runtime terminal without rewriting its report', async () => {
    const root = await temporaryRoot();
    const { report } = await completedRun(root, SR3_RUN_ID, false);

    const result = await sealPhase697SchemaRecoveryInterruptedAttemptForTest({
      root,
      processAlive: () => false,
    });
    expect(result).toMatchObject({
      ok: true,
      disposition: 'terminal_publication_recovered',
      runId: SR3_RUN_ID,
    });
    const artifact = await readArtifact(root, SR3_RUN_ID);
    expect(artifact.report).toEqual(report);
    expect(artifact.durability).toMatchObject({
      completionMode: 'runtime',
      publicationMode: 'recovery',
    });
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(true);
  });

  test('makes publication_started permanently fail-closed after a hard-link conflict', async () => {
    const root = await temporaryRoot();
    const { reservation, report } = await completedRun(root, SR3_RUN_ID, false);
    const artifactPath = resolve(root, schemaRecoveryArtifactRelativePath('branch', SR3_RUN_ID));
    await mkdir(artifactPath);

    await expect(reservation.publishArtifact(report)).rejects.toThrow();
    expect(
      await sealPhase697SchemaRecoveryInterruptedAttemptForTest({
        root,
        processAlive: () => false,
      }),
    ).toEqual({ ok: false, code: 'publication_permanently_failed' });
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);
  });

  test('elects one recovery winner and rejects duplicate claim takeover', async () => {
    const root = await temporaryRoot();
    const reservation = await reserveSr3SyntheticAttempt(root);
    await appendPassingGuards(reservation.lifecycle);
    const firstTutor = PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.find(
      (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
    );
    if (!firstTutor) throw new Error('SR3 first Tutor lane missing');
    const lane = await reservation.lifecycle.reserveLane(runtimeIdentity(firstTutor));
    await lane.appendSchemaStage({ event: 'started', observation: null });
    await rewriteMarkerOwner(root, SR3_RUN_ID, 999_973);

    const results = await Promise.all([
      sealPhase697SchemaRecoveryInterruptedAttemptForTest({
        root,
        processAlive: (processId) => processId === process.pid,
      }),
      sealPhase697SchemaRecoveryInterruptedAttemptForTest({
        root,
        processAlive: (processId) => processId === process.pid,
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(true);
    const records = journalRecords(
      await readFile(resolve(root, schemaRecoveryJournalRelativePath(SR3_RUN_ID)), 'utf8'),
    );
    expect(records.filter((record) => record.event === 'recovery_claimed')).toHaveLength(1);
    expect(records.at(-1)?.event).toBe('evidence_published');
  });

  test('allows one marker reservation and detects post-publication artifact mutation', async () => {
    const exclusiveRoot = await temporaryRoot();
    const reservations = await Promise.allSettled([
      reserveSr3SyntheticAttempt(exclusiveRoot, randomUUID()),
      reserveSr3SyntheticAttempt(exclusiveRoot, randomUUID()),
    ]);
    expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(reservations.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const files = await readdir(join(exclusiveRoot, '.tmp'));
    expect(
      files.filter(
        (file) => file === PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH.split('/').at(-1),
      ),
    ).toHaveLength(1);

    const mutationRoot = await temporaryRoot();
    await completedRun(mutationRoot, SR3_RUN_ID, true);
    const artifactPath = resolve(
      mutationRoot,
      schemaRecoveryArtifactRelativePath('branch', SR3_RUN_ID),
    );
    const original = await readFile(artifactPath, 'utf8');
    await writeFile(
      artifactPath,
      original.replace('"authority":"synthetic_test"', '"authority":"controlled_live"'),
    );
    expect((await validatePhase697SchemaRecoveryBundle({ root: mutationRoot })).ok).toBe(false);
  });
});

async function completedRun(root: string, runId: string, publish: boolean) {
  const reservation = await reserveSr3SyntheticAttempt(root, runId);
  const source = createSr3Source();
  const report = await runPhase697TutorOrganizerSchemaRecovery({
    runId,
    runScope: 'branch',
    source,
    harness: createSr3SuccessHarness(),
    lifecycle: reservation.lifecycle,
    signal: new AbortController().signal,
  });
  const published = publish ? await reservation.publishArtifact(report) : null;
  return { reservation, report, published };
}

async function appendPassingGuards(
  lifecycle: Awaited<ReturnType<typeof reserveSr3SyntheticAttempt>>['lifecycle'],
) {
  for (const base of createF2PassingEntries().filter(
    (candidate) => candidate.executionKind === 'guard',
  )) {
    await lifecycle.appendGuardTerminal(
      createPhase697SchemaRecoveryCaseEntry(base, {
        outcome: 'not_observed',
        diagnostic: null,
      }),
    );
  }
}

async function readArtifact(root: string, runId: string) {
  return PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_SCHEMA.parse(
    JSON.parse(
      await readFile(resolve(root, schemaRecoveryArtifactRelativePath('branch', runId)), 'utf8'),
    ),
  );
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-schema-recovery-crash-'));
  roots.push(root);
  return root;
}

function journalRecords(bytes: string): Record<string, unknown>[] {
  return bytes
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function rewriteMarkerOwner(root: string, runId: string, ownerProcessId: number) {
  const markerPath = resolve(root, PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH);
  const marker = JSON.parse(await readFile(markerPath, 'utf8')) as Record<string, unknown>;
  marker.ownerProcessId = ownerProcessId;
  const markerBytes = `${JSON.stringify(marker)}\n`;
  const markerSha256 = createHash('sha256').update(markerBytes).digest('hex');
  const journalPath = resolve(root, schemaRecoveryJournalRelativePath(runId));
  const records = journalRecords(await readFile(journalPath, 'utf8'));
  for (const record of records) record.markerSha256 = markerSha256;
  rehashJournal(records);
  await writeFile(markerPath, markerBytes, 'utf8');
  await writeFile(journalPath, serializeJournal(records), 'utf8');
}

function rehashJournal(records: Record<string, unknown>[]) {
  let previousHash: string | null = null;
  records.forEach((record, index) => {
    record.sequence = index + 1;
    record.previousHash = previousHash;
    const { recordHash: _recordHash, ...base } = record;
    record.recordHash = computePhase697FullGateCanonicalSha256(base);
    previousHash = String(record.recordHash);
  });
}

function serializeJournal(records: readonly Record<string, unknown>[]) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
