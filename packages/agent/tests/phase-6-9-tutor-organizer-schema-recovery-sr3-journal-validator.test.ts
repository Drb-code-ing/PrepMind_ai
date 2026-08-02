import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA } from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_SCHEMA,
  PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH,
  schemaRecoveryArtifactRelativePath,
  schemaRecoveryJournalRelativePath,
  validatePhase697SchemaRecoveryBundle,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import { computePhase697FullGateCanonicalSha256 } from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';
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

describe('Phase 6.9.7 Schema Recovery SR3 journal and validator', () => {
  test('publishes one canonical independent bundle with bounded schema stages', async () => {
    const root = await temporaryRoot();
    const { report, published } = await completedRun(root, SR3_RUN_ID, true);
    if (!published) throw new Error('SR3 artifact was not published');

    const validation = await validatePhase697SchemaRecoveryBundle({ root });
    expect(validation).toMatchObject({
      ok: true,
      runId: SR3_RUN_ID,
      gate: 'schema_recovery_quality_gate_failed',
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
    });
    expect(validation.physicalArtifactSha256).toBe(published.evidenceSha256);
    expect(report.schemaAccounting).toEqual({
      complete: true,
      canonical: 48,
      extensionFieldsDiscarded: 0,
      rejected: 0,
      notObserved: 0,
    });

    const marker = await readFile(
      resolve(root, PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH),
      'utf8',
    );
    const journal = await readFile(
      resolve(root, schemaRecoveryJournalRelativePath(SR3_RUN_ID)),
      'utf8',
    );
    const artifact = await readFile(
      resolve(root, schemaRecoveryArtifactRelativePath('branch', SR3_RUN_ID)),
      'utf8',
    );
    for (const bytes of [marker, journal, artifact]) {
      expect(bytes.endsWith('\n')).toBe(true);
      expect(bytes).not.toContain('\r');
    }
    expect(journal).not.toMatch(
      /"(?:rawResponse|rawOutput|rawContent|credential|apiKey|api_key)":/iu,
    );
    const events = journalRecords(journal).map((record) => String(record.event));
    expect(events[0]).toBe('attempt_reserved');
    expect(events.filter((event) => event === 'guard_terminal')).toHaveLength(24);
    expect(events.filter((event) => event === 'lane_reserved')).toHaveLength(48);
    expect(events.filter((event) => event === 'schema_stage_started')).toHaveLength(48);
    expect(events.filter((event) => event === 'wire_stage')).toHaveLength(384);
    expect(events.filter((event) => event === 'schema_stage_succeeded')).toHaveLength(48);
    expect(events.filter((event) => event === 'schema_stage_failed')).toHaveLength(0);
    expect(events.filter((event) => event === 'lane_terminal')).toHaveLength(48);
    expect(events.filter((event) => event === 'pair_terminal')).toHaveLength(24);
    expect(events.slice(-3)).toEqual(['run_terminal', 'publication_started', 'evidence_published']);
  });

  test('rejects truncated, CRLF, hash drift, unknown raw fields, and extra formal files', async () => {
    const root = await temporaryRoot();
    await completedRun(root, SR3_RUN_ID, true);
    const journalPath = resolve(root, schemaRecoveryJournalRelativePath(SR3_RUN_ID));
    const original = await readFile(journalPath, 'utf8');

    await writeFile(journalPath, original.trimEnd(), 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original.replaceAll('\n', '\r\n'), 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);

    const drift = original.replace('"event":"guard_terminal"', '"event":"pair_terminal"');
    await writeFile(journalPath, drift, 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);

    const records = journalRecords(original);
    const schemaTerminal = records.find((record) => record.event === 'schema_stage_succeeded');
    if (!schemaTerminal) throw new Error('SR3 schema terminal missing');
    schemaTerminal.rawResponse = 'must-not-survive';
    rehashJournal(records);
    await writeFile(journalPath, serializeJournal(records), 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original, 'utf8');
    await writeFile(
      join(
        root,
        '.tmp',
        'phase-6-9-7-tutor-organizer-schema-recovery-sr5-controlled-live-11111111-1111-4111-8111-111111111111.journal.jsonl',
      ),
      '{}\n',
      'utf8',
    );
    expect((await validatePhase697SchemaRecoveryBundle({ root })).ok).toBe(false);
  });

  test('rejects schema-stage reordering and duplicate terminal even after a valid rehash', async () => {
    const reorderRoot = await temporaryRoot();
    await completedRun(reorderRoot, SR3_RUN_ID, true);
    const reorderPath = resolve(reorderRoot, schemaRecoveryJournalRelativePath(SR3_RUN_ID));
    const reordered = journalRecords(await readFile(reorderPath, 'utf8'));
    const startedIndex = reordered.findIndex((record) => record.event === 'schema_stage_started');
    const wireIndex = reordered.findIndex(
      (record, index) => index > startedIndex && record.event === 'wire_stage',
    );
    if (startedIndex < 0 || wireIndex < 0) throw new Error('SR3 stage fixture missing');
    [reordered[startedIndex], reordered[wireIndex]] = [
      reordered[wireIndex]!,
      reordered[startedIndex]!,
    ];
    rehashJournal(reordered);
    await writeFile(reorderPath, serializeJournal(reordered), 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root: reorderRoot })).ok).toBe(false);

    const duplicateRoot = await temporaryRoot();
    await completedRun(duplicateRoot, SR3_RUN_ID, true);
    const duplicatePath = resolve(duplicateRoot, schemaRecoveryJournalRelativePath(SR3_RUN_ID));
    const duplicated = journalRecords(await readFile(duplicatePath, 'utf8'));
    const terminalIndex = duplicated.findIndex(
      (record) => record.event === 'schema_stage_succeeded',
    );
    if (terminalIndex < 0) throw new Error('SR3 schema terminal fixture missing');
    duplicated.splice(terminalIndex + 1, 0, structuredClone(duplicated[terminalIndex]!));
    rehashJournal(duplicated);
    await writeFile(duplicatePath, serializeJournal(duplicated), 'utf8');
    expect((await validatePhase697SchemaRecoveryBundle({ root: duplicateRoot })).ok).toBe(false);
  });

  test('keeps old and Schema Recovery artifact lineages mutually exclusive', async () => {
    const root = await temporaryRoot();
    await completedRun(root, SR3_RUN_ID, true);
    const artifact = PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_SCHEMA.parse(
      JSON.parse(
        await readFile(
          resolve(root, schemaRecoveryArtifactRelativePath('branch', SR3_RUN_ID)),
          'utf8',
        ),
      ),
    );
    expect(PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA.safeParse(artifact).success).toBe(false);
    expect(
      PHASE_6_9_7_SCHEMA_RECOVERY_ARTIFACT_SCHEMA.safeParse({
        ...artifact,
        lineage: 'phase-6.9.7-tutor-organizer-full-gate-v1',
      }).success,
    ).toBe(false);
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

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-schema-recovery-sr3-'));
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
    record.recordHash = computePhase697FullGateCanonicalSha256(base);
    previousHash = String(record.recordHash);
  });
}

function serializeJournal(records: readonly Record<string, unknown>[]) {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}
