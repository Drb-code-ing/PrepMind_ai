import { randomUUID } from 'node:crypto';
import {
  appendFile,
  mkdir,
  mkdtemp,
  readFile,
  rename as fsRename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION, PHASE_6_9_7_V7_WIRE_STAGES } from '@repo/ai';
import { afterEach, describe, expect, test } from 'bun:test';

import {
  buildPhase697V7EvidenceEnvelope,
  buildPhase697V7Marker,
  phase697V7DispatchKeySha256,
  sha256Phase697V7Stable,
} from '../src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts';
import {
  assertPhase697V7PathIdentity,
  buildPhase697V7JournalRecord,
  buildPhase697V7SealedReport,
  parseAndValidatePhase697V7Journal,
  phase697V7EvidencePath,
  phase697V7JournalPath,
  projectPhase697V7TerminalEntry,
  stablePhase697V7JsonStringify,
  type Phase697V7JournalPayload,
} from '../src/evals/phase-6-9-tutor-wrong-question-v7-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV7 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v7-paired.ts';
import { sealPhase697TutorOrganizerV7Orphan } from '../scripts/phase-6-9-7-tutor-wrong-question-v7-cli.ts';
import {
  acquirePhase697V7RecoveryClaim,
  createPhase697V7Journal,
  openPhase697V7JournalAppender,
  publishPhase697V7Evidence,
  readPhase697V7Journal,
  reservePhase697V7Marker,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v7-durability.ts';
import { createPhase697V7JournalLifecycle } from '../scripts/phase-6-9-7-tutor-wrong-question-v7-journal-lifecycle.ts';
import { validatePhase697TutorOrganizerV7EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v7-evidence.ts';
import { createPhase697V7SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v7-runner.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 V7 R2 durability and recovery', () => {
  test('reserves a single marker and never re-opens the consumed attempt', async () => {
    const root = await temporaryRoot();
    const marker = buildPhase697V7Marker({
      runId: randomUUID(),
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_971,
    });
    const first = await reservePhase697V7Marker({ root, marker });
    expect(first.ok).toBe(true);
    expect(await reservePhase697V7Marker({ root, marker })).toEqual({
      ok: false,
      code: 'live_already_attempted',
    });
    if (!first.ok) throw new Error('V7 marker unavailable');
    const journal = await createPhase697V7Journal({
      root,
      marker,
      markerSha256: first.markerSha256,
      overrides: {
        async open() {
          const error = new Error('synthetic journal failure') as Error & { code: string };
          error.code = 'EIO';
          throw error;
        },
      },
    });
    expect(journal).toEqual({ ok: false, code: 'journal_io_failed' });
    expect(await reservePhase697V7Marker({ root, marker })).toEqual({
      ok: false,
      code: 'live_already_attempted',
    });
  });

  test('persists the complete guard/lane/wire/terminal chain before sealing evidence', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V7Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_972,
    });
    const reserved = await reservePhase697V7Marker({ root, marker });
    if (!reserved.ok) throw new Error('V7 marker unavailable');
    const created = await createPhase697V7Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('V7 journal unavailable');

    const report = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({ runId, mode: 'live' }),
      { lifecycle: createPhase697V7JournalLifecycle(created.writer) },
    );
    expect(report.gate).toBe('quality_gate_failed');
    const snapshot = await created.writer.snapshot();
    const envelope = buildPhase697V7EvidenceEnvelope({
      report,
      disposition: 'completed_run',
      markerSha256: reserved.markerSha256,
      journalTailSha256: snapshot.tailSha256,
      journalSequence: snapshot.lastSequence,
    });
    if (!envelope) throw new Error('V7 evidence envelope unavailable');
    const evidencePath = phase697V7EvidencePath({ runId, runScope: 'branch', mode: 'live' });
    const published = await publishPhase697V7Evidence({ root, evidencePath, envelope });
    if (!published.ok) throw new Error('V7 evidence publication failed');
    await created.writer.append({
      kind: 'evidence_sealed',
      disposition: 'completed_run',
      sealedFromJournalSha256: snapshot.tailSha256,
      evidenceSha256: published.evidenceSha256,
    });
    await created.writer.close();

    const read = await readPhase697V7Journal({ root, runId });
    if (!read.ok) throw new Error('V7 journal unreadable');
    expect(read.journal.guardTerminals.size).toBe(24);
    expect(read.journal.lanes.size).toBe(48);
    expect(read.journal.runtimeTerminals.size).toBe(48);
    expect(read.journal.pairedDurations.size).toBe(24);
    expect([...read.journal.lanes.values()].every((lane) => lane.stages.length === 8)).toBe(true);
    expect(read.journal.runCompleted).toEqual({
      reportSha256: sha256Phase697V7Stable(report),
      gate: 'quality_gate_failed',
    });
    expect(
      buildPhase697V7SealedReport({
        marker,
        markerSha256: reserved.markerSha256,
        journal: read.journal,
      }),
    ).toEqual(report);
    expect(
      await validatePhase697TutorOrganizerV7EvidenceBundle({
        root,
        evidencePath: resolve(root, evidencePath),
      }),
    ).toEqual({ ok: true });
  });

  test('rejects partial tails, hash tampering, duplicate/out-of-order stages, and records after seal', async () => {
    const { root, runId, journalText } = await createCompletedJournalFixture();
    expect(parseAndValidatePhase697V7Journal(journalText)).not.toBeNull();
    expect(parseAndValidatePhase697V7Journal(journalText.trimEnd())).toBeNull();

    const records = journalText
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line) as ReturnType<typeof buildPhase697V7JournalRecord>);
    const tampered = structuredClone(records[0]!);
    tampered.runId = randomUUID();
    expect(parseAndValidatePhase697V7Journal(`${JSON.stringify(tampered)}\n`)).toBeNull();

    const firstWireIndex = records.findIndex((record) => record.payload.kind === 'wire_stage');
    const firstWire = records[firstWireIndex];
    if (!firstWire || firstWire.payload.kind !== 'wire_stage') {
      throw new Error('V7 wire record unavailable');
    }
    const duplicate = buildPhase697V7JournalRecord({
      runId,
      sequence: firstWire.sequence + 1,
      previousRecordSha256: firstWire.recordSha256,
      payload: firstWire.payload,
    });
    const duplicateText = `${records
      .slice(0, firstWireIndex + 1)
      .map(stablePhase697V7JsonStringify)
      .join('\n')}\n${stablePhase697V7JsonStringify(duplicate)}\n`;
    expect(parseAndValidatePhase697V7Journal(duplicateText)).toBeNull();

    const firstReservationIndex = records.findIndex(
      (record) => record.payload.kind === 'lane_reserved',
    );
    const firstReservation = records[firstReservationIndex];
    if (!firstReservation || firstReservation.payload.kind !== 'lane_reserved') {
      throw new Error('V7 lane reservation unavailable');
    }
    const crossLaneKey = phase697V7DispatchKeySha256({
      runId,
      agent: firstReservation.payload.agent === 'tutor' ? 'wrong_question_organizer' : 'tutor',
      pairedRunIndex: firstReservation.payload.pairedRunIndex,
    });
    if (!crossLaneKey) throw new Error('V7 cross-lane key unavailable');
    const crossLaneReservation = buildPhase697V7JournalRecord({
      runId,
      sequence: firstReservation.sequence,
      previousRecordSha256: firstReservation.previousRecordSha256,
      payload: { ...firstReservation.payload, dispatchKeySha256: crossLaneKey },
    });
    const crossLaneText = `${records
      .slice(0, firstReservationIndex)
      .map(stablePhase697V7JsonStringify)
      .join('\n')}\n${stablePhase697V7JsonStringify(crossLaneReservation)}\n`;
    expect(parseAndValidatePhase697V7Journal(crossLaneText)).toBeNull();

    const unknownDispatch = buildPhase697V7JournalRecord({
      runId,
      sequence: firstReservation.sequence + 1,
      previousRecordSha256: firstReservation.recordSha256,
      payload: {
        kind: 'wire_stage',
        dispatchKeySha256: `sha256:${'f'.repeat(64)}`,
        stage: 'executor_entered',
      },
    });
    const unknownDispatchText = `${records
      .slice(0, firstReservationIndex + 1)
      .map(stablePhase697V7JsonStringify)
      .join('\n')}\n${stablePhase697V7JsonStringify(unknownDispatch)}\n`;
    expect(parseAndValidatePhase697V7Journal(unknownDispatchText)).toBeNull();

    const terminalIndex = records.findIndex((record) => record.payload.kind === 'runtime_terminal');
    const forgedTerminal = structuredClone(records[terminalIndex]!) as unknown as Record<
      string,
      unknown
    >;
    const forgedPayload = forgedTerminal.payload as Record<string, unknown>;
    const forgedProjection = forgedPayload.terminal as Record<string, unknown>;
    const forgedEntry = forgedProjection.entry as Record<string, unknown>;
    const forgedWire = forgedEntry.wireEvidence as Record<string, unknown>;
    const forgedSnapshot = forgedWire.snapshot as Record<string, unknown>;
    (forgedSnapshot.counters as Record<string, unknown>).providerResponses = 0;
    forgedProjection.terminalEntrySha256 = sha256Phase697V7Stable(forgedEntry);
    const { recordSha256: _discardedRecordSha, ...forgedWithoutHash } = forgedTerminal;
    forgedTerminal.recordSha256 = sha256Phase697V7Stable(forgedWithoutHash);
    const forgedTerminalText = `${records
      .slice(0, terminalIndex)
      .map(stablePhase697V7JsonStringify)
      .join('\n')}\n${stablePhase697V7JsonStringify(forgedTerminal)}\n`;
    expect(parseAndValidatePhase697V7Journal(forgedTerminalText)).toBeNull();

    const sealed = records.at(-1)!;
    if (sealed.payload.kind !== 'evidence_sealed') throw new Error('V7 seal unavailable');
    const afterSeal = buildPhase697V7JournalRecord({
      runId,
      sequence: sealed.sequence + 1,
      previousRecordSha256: sealed.recordSha256,
      payload: {
        kind: 'evidence_sealed',
        disposition: sealed.payload.disposition,
        sealedFromJournalSha256: sealed.recordSha256,
        evidenceSha256: sealed.payload.evidenceSha256,
      },
    });
    expect(
      parseAndValidatePhase697V7Journal(
        `${journalText}${stablePhase697V7JsonStringify(afterSeal)}\n`,
      ),
    ).toBeNull();
    expect(await readFile(resolve(root, phase697V7JournalPath(runId)), 'utf8')).toBe(journalText);
  });

  test('seals a durable wire prefix without creating an adapter or replaying a lane', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V7Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_973,
    });
    const reserved = await reservePhase697V7Marker({ root, marker });
    if (!reserved.ok) throw new Error('V7 marker unavailable');
    const created = await createPhase697V7Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('V7 journal unavailable');

    const mockReport = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({ runId: randomUUID() }),
    );
    for (const entry of mockReport.caseEntries.filter(
      (entry) => entry.executionKind === 'zero_call',
    )) {
      const terminal = projectPhase697V7TerminalEntry(entry);
      if (!terminal) throw new Error('V7 guard projection unavailable');
      await created.writer.append({ kind: 'guard_terminal', terminal });
    }
    const caseEntry = mockReport.caseEntries.find(
      (entry) => entry.caseId === 'tutor-v2-runtime-01',
    );
    if (!caseEntry || caseEntry.pairedRunIndex === null)
      throw new Error('V7 runtime case unavailable');
    const dispatchKeySha256 = phase697V7DispatchKeySha256({
      runId,
      agent: caseEntry.agent,
      pairedRunIndex: caseEntry.pairedRunIndex,
    });
    if (!dispatchKeySha256) throw new Error('V7 dispatch key unavailable');
    await created.writer.append({
      kind: 'lane_reserved',
      caseId: caseEntry.caseId,
      agent: caseEntry.agent,
      pairedRunIndex: caseEntry.pairedRunIndex,
      dispatchKeySha256,
      wireCapabilityVersion: PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION,
    });
    for (const stage of PHASE_6_9_7_V7_WIRE_STAGES.slice(0, 3)) {
      await created.writer.append({ kind: 'wire_stage', dispatchKeySha256, stage });
    }
    await created.writer.close();

    const before = await readPhase697V7Journal({ root, runId });
    if (!before.ok) throw new Error('V7 partial journal unreadable');
    const recovered = buildPhase697V7SealedReport({
      marker,
      markerSha256: reserved.markerSha256,
      journal: before.journal,
    });
    const orphan = recovered?.caseEntries.find((entry) => entry.caseId === caseEntry.caseId);
    expect(orphan).toMatchObject({
      executionOutcome: 'attempted_orphaned',
      strictRuntimeSuccess: false,
      wireEvidence: {
        disposition: 'observed',
        snapshot: {
          state: 'active',
          counters: {
            executorInvocations: 1,
            providerDispatches: 1,
            providerResponses: 0,
            verifiedUsages: 0,
          },
        },
      },
    });
    expect(recovered?.metrics.tutorSemanticScore).toBeNull();
    expect(recovered?.latency.tutorCandidateP95Ms).toBeNull();
    expect(recovered?.usage.inputTokens).toBeNull();

    const sealed = await sealPhase697TutorOrganizerV7Orphan({
      root,
      processAlive: () => false,
    });
    expect(sealed).toMatchObject({
      ok: true,
      runId,
      disposition: 'orphan_sealed',
      gate: 'quality_gate_failed',
    });
    const after = await readPhase697V7Journal({ root, runId });
    if (!after.ok) throw new Error('V7 sealed journal unreadable');
    expect(after.journal.sealed?.disposition).toBe('orphan_sealed');
    expect(await sealPhase697TutorOrganizerV7Orphan({ root })).toMatchObject({
      ok: true,
      disposition: 'orphan_sealed',
    });
  });

  test('blocks live owners and fences recovery-claim ABA plus journal-tail drift', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V7Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_974,
    });
    const reserved = await reservePhase697V7Marker({ root, marker });
    if (!reserved.ok) throw new Error('V7 marker unavailable');
    const created = await createPhase697V7Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('V7 journal unavailable');
    await created.writer.close();
    const initial = await readPhase697V7Journal({ root, runId });
    if (!initial.ok) throw new Error('V7 journal unreadable');

    expect(
      await acquirePhase697V7RecoveryClaim({
        root,
        marker,
        markerSha256: reserved.markerSha256,
        journalTailSha256: initial.journal.tailSha256,
        overrides: { processAlive: () => true },
      }),
    ).toEqual({ ok: false, code: 'live_attempt_in_progress' });

    const fixedToken = '00000000-0000-4000-8000-000000000711';
    const first = await acquirePhase697V7RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: initial.journal.tailSha256,
      overrides: { processAlive: () => false, claimToken: () => fixedToken },
    });
    if (!first.ok) throw new Error('V7 first claim unavailable');
    const second = await acquirePhase697V7RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: initial.journal.tailSha256,
      overrides: {
        processAlive: () => false,
        claimToken: () => fixedToken,
        temporaryId: () => 'aba-takeover',
      },
    });
    if (!second.ok) throw new Error('V7 second claim unavailable');
    expect(await first.claim.assertOwned()).toBe(false);
    await expect(first.claim.release()).rejects.toThrow('PHASE_6_9_7_V7_RECOVERY_CLAIM_LOST');
    expect(await second.claim.assertOwned()).toBe(true);

    const mockReport = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({ runId: randomUUID() }),
    );
    const guard = mockReport.caseEntries.find((entry) => entry.executionKind === 'zero_call');
    const terminal = guard ? projectPhase697V7TerminalEntry(guard) : null;
    if (!terminal) throw new Error('V7 guard projection unavailable');
    const drift = buildPhase697V7JournalRecord({
      runId,
      sequence: initial.journal.lastSequence + 1,
      previousRecordSha256: initial.journal.tailSha256,
      payload: { kind: 'guard_terminal', terminal },
    });
    await appendFile(
      resolve(root, phase697V7JournalPath(runId)),
      `${stablePhase697V7JsonStringify(drift)}\n`,
      'utf8',
    );
    expect(
      await openPhase697V7JournalAppender({
        root,
        journal: initial.journal,
        claim: second.claim,
      }),
    ).toEqual({ ok: false, code: 'journal_tail_drift' });
    await second.claim.release();
  });

  test('fails closed after a stale-claim rename crash and permits a fresh exclusive claimant', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V7Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_975,
    });
    const reserved = await reservePhase697V7Marker({ root, marker });
    if (!reserved.ok) throw new Error('V7 marker unavailable');
    const created = await createPhase697V7Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('V7 journal unavailable');
    await created.writer.close();
    const journal = await readPhase697V7Journal({ root, runId });
    if (!journal.ok) throw new Error('V7 journal unavailable');

    const stale = await acquirePhase697V7RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: journal.journal.tailSha256,
      overrides: { processAlive: () => false },
    });
    if (!stale.ok) throw new Error('V7 stale claim unavailable');

    let renamed = false;
    const interrupted = await acquirePhase697V7RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: journal.journal.tailSha256,
      overrides: {
        processAlive: () => false,
        temporaryId: () => 'crash-after-stale-rename',
        async rename(from, to) {
          await fsRename(from, to);
          renamed = true;
          const error = new Error('synthetic crash after rename') as Error & { code: string };
          error.code = 'EIO';
          throw error;
        },
      },
    });
    expect(renamed).toBe(true);
    expect(interrupted).toEqual({ ok: false, code: 'recovery_claim_io_failed' });
    expect(await stale.claim.assertOwned()).toBe(false);

    const recovered = await acquirePhase697V7RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: journal.journal.tailSha256,
      overrides: { processAlive: () => false },
    });
    if (!recovered.ok) throw new Error('V7 recovery claimant unavailable');
    expect(await recovered.claim.assertOwned()).toBe(true);
    await recovered.claim.release();
  });

  test('publishes one hard-link winner, accepts same bytes, rejects conflicts, and never writes secrets', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const report = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({ runId }),
    );
    const envelope = buildPhase697V7EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope) throw new Error('V7 mock envelope unavailable');
    const evidencePath = phase697V7EvidencePath({ runId, runScope: 'branch', mode: 'mock' });
    const [left, right] = await Promise.all([
      publishPhase697V7Evidence({
        root,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'left' },
      }),
      publishPhase697V7Evidence({
        root,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'right' },
      }),
    ]);
    expect(
      [left, right].filter((result) => result.ok && result.disposition === 'published'),
    ).toHaveLength(1);
    expect(
      [left, right].filter((result) => result.ok && result.disposition === 'same_bytes'),
    ).toHaveLength(1);

    const conflictRoot = await temporaryRoot();
    const absoluteConflict = resolve(conflictRoot, evidencePath);
    await mkdir(dirname(absoluteConflict), { recursive: true });
    await writeFile(absoluteConflict, 'conflicting bytes\n', 'utf8');
    expect(
      await publishPhase697V7Evidence({
        root: conflictRoot,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'conflict' },
      }),
    ).toEqual({ ok: false, code: 'evidence_target_conflict' });

    const marker = buildPhase697V7Marker({
      runId: randomUUID(),
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
    });
    const markerReserved = await reservePhase697V7Marker({ root: conflictRoot, marker });
    if (!markerReserved.ok) throw new Error('V7 leak marker unavailable');
    const journal = await createPhase697V7Journal({
      root: conflictRoot,
      marker,
      markerSha256: markerReserved.markerSha256,
    });
    if (!journal.ok) throw new Error('V7 leak journal unavailable');
    const secret = 'sk-v7-r2-must-never-persist';
    await expect(
      journal.writer.append({
        kind: 'wire_stage',
        dispatchKeySha256: `sha256:${'a'.repeat(64)}`,
        stage: 'executor_entered',
        rawError: secret,
      } as unknown as Phase697V7JournalPayload),
    ).rejects.toThrow();
    await journal.writer.close();
    expect(
      await readFile(resolve(conflictRoot, phase697V7JournalPath(marker.runId)), 'utf8'),
    ).not.toContain(secret);
    expect(await readFile(resolve(root, evidencePath), 'utf8')).not.toContain(
      'v7-r2-synthetic-key',
    );
    assertPhase697V7PathIdentity();
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v7-r2-'));
  roots.push(root);
  return root;
}

async function createCompletedJournalFixture() {
  const root = await temporaryRoot();
  const runId = randomUUID();
  const marker = buildPhase697V7Marker({
    runId,
    runScope: 'branch',
    executorProvenance: 'synthetic_test',
  });
  const reserved = await reservePhase697V7Marker({ root, marker });
  if (!reserved.ok) throw new Error('V7 marker unavailable');
  const created = await createPhase697V7Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
  });
  if (!created.ok) throw new Error('V7 journal unavailable');
  const report = await runPhase697TutorOrganizerPairedEvalV7(
    createPhase697V7SyntheticHarness({ runId, mode: 'live' }),
    { lifecycle: createPhase697V7JournalLifecycle(created.writer) },
  );
  const snapshot = await created.writer.snapshot();
  const envelope = buildPhase697V7EvidenceEnvelope({
    report,
    disposition: 'completed_run',
    markerSha256: reserved.markerSha256,
    journalTailSha256: snapshot.tailSha256,
    journalSequence: snapshot.lastSequence,
  });
  if (!envelope) throw new Error('V7 evidence envelope unavailable');
  const evidencePath = phase697V7EvidencePath({ runId, runScope: 'branch', mode: 'live' });
  const published = await publishPhase697V7Evidence({ root, evidencePath, envelope });
  if (!published.ok) throw new Error('V7 evidence unavailable');
  await created.writer.append({
    kind: 'evidence_sealed',
    disposition: 'completed_run',
    sealedFromJournalSha256: snapshot.tailSha256,
    evidenceSha256: published.evidenceSha256,
  });
  await created.writer.close();
  const journalText = await readFile(resolve(root, phase697V7JournalPath(runId)), 'utf8');
  return { root, runId, journalText };
}
