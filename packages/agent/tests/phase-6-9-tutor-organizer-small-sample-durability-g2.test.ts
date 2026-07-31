import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA,
  PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH,
  artifactRelativePath,
  journalRelativePath,
  recoveryClaimRelativePath,
  sealPhase697SmallSampleInterruptedAttemptForTest,
  validatePhase697SmallSampleBundle,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES,
  computePhase697SmallSampleCanonicalSha256,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts';
import { runPhase697TutorOrganizerSmallSample } from '../src/evals/run-phase-6-9-tutor-organizer-small-sample.ts';
import {
  G2_RUN_ID,
  createG2PassingEntries,
  createG2Source,
  createG2SuccessHarness,
  reserveG2SyntheticAttempt,
  runtimeIdentity,
} from './phase-6-9-tutor-organizer-small-sample-g2-helpers.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 small-sample G2 durability', () => {
  test('persists a canonical complete journal and recomputes the published bundle', async () => {
    const root = await temporaryRoot();
    const { report, published } = await completedRun(root, G2_RUN_ID, true);
    if (!published) throw new Error('G2 artifact was not published');

    const validation = await validatePhase697SmallSampleBundle({ root });
    expect(validation).toMatchObject({
      ok: true,
      runId: G2_RUN_ID,
      gate: 'small_sample_quality_gate_failed',
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
    });
    expect(validation.physicalArtifactSha256).toBe(published.evidenceSha256);
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 16,
      terminalEntries: 16,
      orphanedEntries: 0,
      notStartedEntries: 0,
    });

    const marker = await readFile(
      resolve(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH),
      'utf8',
    );
    const journal = await readFile(resolve(root, journalRelativePath(G2_RUN_ID)), 'utf8');
    const artifactBytes = await readFile(resolve(root, published.relativePath), 'utf8');
    expect(marker.endsWith('\n')).toBe(true);
    expect(marker).not.toContain('\r');
    expect(journal.endsWith('\n')).toBe(true);
    expect(journal).not.toContain('\r');
    expect(artifactBytes.endsWith('\n')).toBe(true);
    expect(artifactBytes).not.toContain('\r');
    const events = journalRecords(journal).map((record) => String(record.event));
    expect(events[0]).toBe('attempt_reserved');
    expect(events.filter((event) => event === 'guard_terminal')).toHaveLength(8);
    expect(events.filter((event) => event === 'lane_reserved')).toHaveLength(16);
    expect(events.filter((event) => event === 'wire_stage')).toHaveLength(128);
    expect(events.filter((event) => event === 'lane_terminal')).toHaveLength(16);
    expect(events.filter((event) => event === 'pair_terminal')).toHaveLength(8);
    expect(events.slice(-3)).toEqual(['run_terminal', 'publication_started', 'evidence_published']);
  });

  test('allows only one concurrent reservation of the fixed marker', async () => {
    const root = await temporaryRoot();
    const results = await Promise.allSettled([
      reserveG2SyntheticAttempt(root, randomUUID()),
      reserveG2SyntheticAttempt(root, randomUUID()),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const files = await readdir(join(root, '.tmp'));
    expect(
      files.filter(
        (file) => file === PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH.split('/').at(-1),
      ),
    ).toHaveLength(1);
    expect(files.filter((file) => file.endsWith('.journal.jsonl'))).toHaveLength(1);
  });

  test('rejects truncated, CRLF, hash-tampered, and extra formal bundle files', async () => {
    const root = await temporaryRoot();
    await completedRun(root, G2_RUN_ID, true);
    const journalPath = resolve(root, journalRelativePath(G2_RUN_ID));
    const original = await readFile(journalPath, 'utf8');

    await writeFile(journalPath, original.trimEnd(), 'utf8');
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original.replaceAll('\n', '\r\n'), 'utf8');
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(false);

    const tampered = original.replace('"event":"guard_terminal"', '"event":"pair_terminal"');
    await writeFile(journalPath, tampered, 'utf8');
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original, 'utf8');
    await writeFile(
      join(
        root,
        '.tmp',
        `phase-6-9-7-tutor-organizer-small-sample-l2-controlled-live-${randomUUID()}.journal.jsonl`,
      ),
      '{}\n',
      'utf8',
    );
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(false);
  });

  test('crash-seals reserved lanes, conservatively closes the denominator, and validates recovery', async () => {
    const root = await temporaryRoot();
    const reservation = await reserveG2SyntheticAttempt(root);
    await appendPassingGuards(reservation.lifecycle);
    const runtime = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter(
      (entry) => entry.kind === 'runtime' && entry.pairedRunIndex === 0,
    );
    for (const expected of runtime) {
      const lane = await reservation.lifecycle.reserveLane(runtimeIdentity(expected));
      await lane.appendWireStage('executor_entered');
      await lane.appendWireStage('request_validated');
      await lane.appendWireStage('provider_dispatch_started');
    }

    const result = await sealPhase697SmallSampleInterruptedAttemptForTest({
      root,
      processAlive: () => false,
    });

    expect(result).toMatchObject({
      ok: true,
      runId: G2_RUN_ID,
      disposition: 'crash_only_sealed',
      gate: 'small_sample_quality_gate_failed',
    });
    const validation = await validatePhase697SmallSampleBundle({ root });
    expect(validation).toMatchObject({ ok: true, runId: G2_RUN_ID, qualityAuthority: 'none' });
    const artifact = await readArtifact(root, G2_RUN_ID);
    expect(artifact.durability).toMatchObject({
      completionMode: 'recovery',
      publicationMode: 'recovery',
    });
    expect(artifact.durability.recoveryClaimSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(artifact.report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 14,
    });
    expect(
      artifact.report.caseEntries.filter((entry) => entry.disposition === 'attempted_aborted'),
    ).toHaveLength(2);
    expect(
      artifact.report.caseEntries.filter(
        (entry) => entry.disposition === 'not_started_quality_breaker',
      ),
    ).toHaveLength(14);
  });

  test('refuses to seal a live owner and creates neither claim nor artifact', async () => {
    const root = await temporaryRoot();
    await reserveG2SyntheticAttempt(root);

    const result = await sealPhase697SmallSampleInterruptedAttemptForTest({
      root,
      processAlive: () => true,
    });

    expect(result).toEqual({ ok: false, code: 'live_attempt_in_progress' });
    expect(await exists(resolve(root, recoveryClaimRelativePath(G2_RUN_ID)))).toBe(false);
    expect(await exists(resolve(root, artifactRelativePath('branch', G2_RUN_ID)))).toBe(false);
  });

  test('recovers publication after a durable runtime terminal without rewriting the report', async () => {
    const root = await temporaryRoot();
    const { report } = await completedRun(root, G2_RUN_ID, false);

    const result = await sealPhase697SmallSampleInterruptedAttemptForTest({
      root,
      processAlive: () => false,
    });

    expect(result).toMatchObject({
      ok: true,
      disposition: 'terminal_publication_recovered',
      runId: G2_RUN_ID,
    });
    const artifact = await readArtifact(root, G2_RUN_ID);
    expect(artifact.report).toEqual(report);
    expect(artifact.durability).toMatchObject({
      completionMode: 'runtime',
      publicationMode: 'recovery',
    });
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(true);
  });

  test('makes publication_started permanently fail-closed after a hard-link conflict', async () => {
    const root = await temporaryRoot();
    const { reservation, report } = await completedRun(root, G2_RUN_ID, false);
    const artifactPath = resolve(root, artifactRelativePath('branch', G2_RUN_ID));
    await mkdir(artifactPath);

    await expect(reservation.publishArtifact(report)).rejects.toThrow();
    expect(
      await sealPhase697SmallSampleInterruptedAttemptForTest({
        root,
        processAlive: () => false,
      }),
    ).toEqual({ ok: false, code: 'publication_permanently_failed' });
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(false);
  });

  test('elects one crash-seal winner across recovery claim takeover races', async () => {
    const root = await temporaryRoot();
    const reservation = await reserveG2SyntheticAttempt(root);
    await appendPassingGuards(reservation.lifecycle);
    const firstTutor = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.find(
      (entry) => entry.kind === 'runtime' && entry.agent === 'tutor',
    );
    if (!firstTutor) throw new Error('G2 first Tutor lane missing');
    await reservation.lifecycle.reserveLane(runtimeIdentity(firstTutor));
    await rewriteMarkerOwner(root, G2_RUN_ID, 999_972);

    const results = await Promise.all([
      sealPhase697SmallSampleInterruptedAttemptForTest({
        root,
        processAlive: (processId) => processId === process.pid,
      }),
      sealPhase697SmallSampleInterruptedAttemptForTest({
        root,
        processAlive: (processId) => processId === process.pid,
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await validatePhase697SmallSampleBundle({ root })).ok).toBe(true);
    const records = journalRecords(
      await readFile(resolve(root, journalRelativePath(G2_RUN_ID)), 'utf8'),
    );
    expect(records.filter((record) => record.event === 'recovery_claimed')).toHaveLength(1);
    expect(records.at(-1)?.event).toBe('evidence_published');
  });

  test('rejects a fully rehashed duplicate recovery claim and hidden guard completion mode', async () => {
    const duplicateRoot = await temporaryRoot();
    const reservation = await reserveG2SyntheticAttempt(duplicateRoot);
    await appendPassingGuards(reservation.lifecycle);
    await sealPhase697SmallSampleInterruptedAttemptForTest({
      root: duplicateRoot,
      processAlive: () => false,
    });
    const duplicateJournalPath = resolve(duplicateRoot, journalRelativePath(G2_RUN_ID));
    const duplicateRecords = journalRecords(await readFile(duplicateJournalPath, 'utf8'));
    const recoveryIndex = duplicateRecords.findIndex(
      (record) => record.event === 'recovery_claimed',
    );
    if (recoveryIndex < 0) throw new Error('G2 recovery record missing');
    duplicateRecords.splice(
      recoveryIndex + 1,
      0,
      structuredClone(duplicateRecords[recoveryIndex]!),
    );
    rehashJournal(duplicateRecords);
    assertHashChain(duplicateRecords);
    await writeFile(duplicateJournalPath, serializeJournal(duplicateRecords), 'utf8');
    expect((await validatePhase697SmallSampleBundle({ root: duplicateRoot })).ok).toBe(false);

    const completionRoot = await temporaryRoot();
    await completedRun(completionRoot, G2_RUN_ID, true);
    const completionJournalPath = resolve(completionRoot, journalRelativePath(G2_RUN_ID));
    const completionRecords = journalRecords(await readFile(completionJournalPath, 'utf8'));
    const guard = completionRecords.find((record) => record.event === 'guard_terminal');
    if (!guard) throw new Error('G2 guard record missing');
    guard.completionMode = 'runtime';
    rehashJournal(completionRecords);
    assertHashChain(completionRecords);
    await writeFile(completionJournalPath, serializeJournal(completionRecords), 'utf8');
    expect((await validatePhase697SmallSampleBundle({ root: completionRoot })).ok).toBe(false);
  });

  test('refuses a pre-existing non-file marker without replacing it', async () => {
    const root = await temporaryRoot();
    const markerPath = resolve(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH);
    await mkdir(join(root, '.tmp'));
    await mkdir(markerPath);

    await expect(reserveG2SyntheticAttempt(root)).rejects.toThrow();
    expect(
      (await readdir(join(root, '.tmp'))).filter((entry) => entry.endsWith('.journal.jsonl')),
    ).toHaveLength(0);
  });
});

async function completedRun(root: string, runId: string, publish: boolean) {
  const reservation = await reserveG2SyntheticAttempt(root, runId);
  const source = createG2Source();
  const report = await runPhase697TutorOrganizerSmallSample({
    runId,
    runScope: 'branch',
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: source.sourceHashes,
    harness: createG2SuccessHarness(),
    lifecycle: reservation.lifecycle,
    signal: new AbortController().signal,
  });
  const published = publish ? await reservation.publishArtifact(report) : null;
  return { reservation, report, published };
}

async function appendPassingGuards(
  lifecycle: Awaited<ReturnType<typeof reserveG2SyntheticAttempt>>['lifecycle'],
) {
  for (const entry of createG2PassingEntries().filter(
    (candidate) => candidate.executionKind === 'guard',
  )) {
    await lifecycle.appendGuardTerminal(entry);
  }
}

async function readArtifact(root: string, runId: string) {
  return PHASE_6_9_7_SMALL_SAMPLE_ARTIFACT_SCHEMA.parse(
    JSON.parse(await readFile(resolve(root, artifactRelativePath('branch', runId)), 'utf8')),
  );
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-small-sample-g2-'));
  roots.push(root);
  return root;
}

function journalRecords(bytes: string): Record<string, unknown>[] {
  return bytes
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function rehashJournal(records: Record<string, unknown>[]) {
  let previousHash: string | null = null;
  records.forEach((record, index) => {
    record.sequence = index + 1;
    record.previousHash = previousHash;
    const { recordHash: _recordHash, ...base } = record;
    record.recordHash = computePhase697SmallSampleCanonicalSha256(base);
    previousHash = String(record.recordHash);
  });
}

function assertHashChain(records: readonly Record<string, unknown>[]) {
  let previousHash: string | null = null;
  for (const [index, record] of records.entries()) {
    const { recordHash, ...base } = record;
    expect(record.sequence).toBe(index + 1);
    expect(record.previousHash).toBe(previousHash);
    expect(recordHash).toBe(computePhase697SmallSampleCanonicalSha256(base));
    previousHash = String(recordHash);
  }
}

function serializeJournal(records: readonly Record<string, unknown>[]) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

async function rewriteMarkerOwner(root: string, runId: string, ownerProcessId: number) {
  const markerPath = resolve(root, PHASE_6_9_7_SMALL_SAMPLE_MARKER_RELATIVE_PATH);
  const marker = JSON.parse(await readFile(markerPath, 'utf8')) as Record<string, unknown>;
  marker.ownerProcessId = ownerProcessId;
  const markerBytes = `${JSON.stringify(marker)}\n`;
  const markerSha256 = createHash('sha256').update(markerBytes).digest('hex');
  const journalPath = resolve(root, journalRelativePath(runId));
  const records = journalRecords(await readFile(journalPath, 'utf8'));
  for (const record of records) record.markerSha256 = markerSha256;
  rehashJournal(records);
  await writeFile(markerPath, markerBytes, 'utf8');
  await writeFile(journalPath, serializeJournal(records), 'utf8');
}

async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
