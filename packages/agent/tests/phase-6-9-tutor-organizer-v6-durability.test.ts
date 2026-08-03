import { randomUUID } from 'node:crypto';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
  buildPhase697V6EvidenceEnvelope,
  sha256Phase697V6Stable,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  buildPhase697V6Marker,
  buildPhase697V6SealedReport,
  buildPhase697V6JournalRecord,
  parseAndValidatePhase697V6Journal,
  phase697V6EvidencePath,
  phase697V6JournalPath,
  projectPhase697V6TerminalEntry,
  stableJsonStringify,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-durability-contract.ts';
import {
  buildPhase697TutorOrganizerV6Report,
  runPhase697TutorOrganizerPairedEvalV6,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  acquirePhase697V6RecoveryClaim,
  createPhase697V6Journal,
  openPhase697V6JournalAppender,
  publishPhase697V6Evidence,
  readPhase697V6Journal,
  reservePhase697V6Marker,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v6-durability.ts';
import { createPhase697V6JournalLifecycle } from '../scripts/phase-6-9-7-tutor-wrong-question-v6-journal-lifecycle.ts';
import { validatePhase697TutorOrganizerV6EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v6-evidence.ts';
import { createPhase697V6SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v6-runner.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v6-r3-'));
  roots.push(root);
  return root;
}

describe('Phase 6.9.7 V6 R3 durability', () => {
  test('reserves one marker winner and keeps the marker after journal initialization failure', async () => {
    const root = await temporaryRoot();
    const marker = buildPhase697V6Marker({
      runId: randomUUID(),
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_991,
    });
    const first = await reservePhase697V6Marker({ root, marker });
    expect(first.ok).toBe(true);
    const second = await reservePhase697V6Marker({ root, marker });
    expect(second).toEqual({ ok: false, code: 'live_already_attempted' });
    if (!first.ok) throw new Error('marker not reserved');

    const journal = await createPhase697V6Journal({
      root,
      marker,
      markerSha256: first.markerSha256,
      overrides: {
        async open() {
          const error = new Error('synthetic journal open failure') as Error & { code: string };
          error.code = 'EIO';
          throw error;
        },
      },
    });
    expect(journal).toEqual({ ok: false, code: 'journal_io_failed' });
    expect(await reservePhase697V6Marker({ root, marker })).toEqual({
      ok: false,
      code: 'live_already_attempted',
    });
  });

  test('fsyncs a complete 24 guard / 48 dispatch journal before sealing evidence', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V6Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_992,
    });
    const reserved = await reservePhase697V6Marker({ root, marker });
    if (!reserved.ok) throw new Error('marker not reserved');
    const created = await createPhase697V6Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('journal not created');

    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ runId, mode: 'live' }),
      { lifecycle: createPhase697V6JournalLifecycle(created.writer, runId) },
    );
    expect(report.gate).toBe('quality_gate_failed');
    const snapshot = await created.writer.snapshot();
    const envelope = buildPhase697V6EvidenceEnvelope({
      report,
      disposition: 'completed_run',
      markerSha256: reserved.markerSha256,
      journalTailSha256: snapshot.tailSha256,
      journalSequence: snapshot.lastSequence,
    });
    if (!envelope) throw new Error('envelope invalid');
    const evidencePath = phase697V6EvidencePath({ runId, runScope: 'branch', mode: 'live' });
    const published = await publishPhase697V6Evidence({ root, evidencePath, envelope });
    if (!published.ok) throw new Error('evidence not published');
    await created.writer.append({
      kind: 'evidence_sealed',
      disposition: 'completed_run',
      sealedFromJournalSha256: snapshot.tailSha256,
      evidenceSha256: published.evidenceSha256,
    });
    await created.writer.close();

    const read = await readPhase697V6Journal({ root, runId });
    if (!read.ok) throw new Error('journal unreadable');
    expect(read.journal.guardTerminals.size).toBe(24);
    expect(read.journal.dispatches.size).toBe(48);
    expect(read.journal.runtimeTerminals.size).toBe(48);
    expect(read.journal.pairedDurations.size).toBe(24);
    expect(read.journal.runCompleted).toEqual({
      reportSha256: sha256Phase697V6Stable(report),
      gate: 'quality_gate_failed',
    });
    expect(read.journal.sealed?.evidenceSha256).toBe(published.evidenceSha256);
    expect(
      buildPhase697V6SealedReport({
        marker,
        markerSha256: reserved.markerSha256,
        journal: read.journal,
      }),
    ).toEqual(report);
    expect(
      await validatePhase697TutorOrganizerV6EvidenceBundle({
        root,
        evidencePath: resolve(root, evidencePath),
      }),
    ).toEqual({ ok: true });
  });

  test('rejects truncation, hash tampering, duplicate dispatch and records after seal', async () => {
    const runId = randomUUID();
    const marker = buildPhase697V6Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
    });
    const markerSha256 = `sha256:${'1'.repeat(64)}`;
    const initialized = buildPhase697V6JournalRecord({
      runId,
      sequence: 0,
      previousRecordSha256: null,
      payload: {
        kind: 'journal_initialized',
        markerSha256,
        runScope: 'branch',
        mode: 'live',
        datasetBindingVersion: marker.datasetBindingVersion,
        datasetBindingSha256: marker.datasetBindingSha256,
        datasetVersion: marker.datasetVersion,
        datasetSha256: marker.datasetSha256,
        evalPolicySha256: marker.evalPolicySha256,
      },
    });
    const initializedText = `${stableJsonStringify(initialized)}\n`;
    expect(parseAndValidatePhase697V6Journal(initializedText)).not.toBeNull();
    expect(parseAndValidatePhase697V6Journal(initializedText.trimEnd())).toBeNull();
    const tampered = JSON.parse(stableJsonStringify(initialized)) as Record<string, unknown>;
    tampered.runId = randomUUID();
    expect(parseAndValidatePhase697V6Journal(`${JSON.stringify(tampered)}\n`)).toBeNull();

    const sealed = buildPhase697V6JournalRecord({
      runId,
      sequence: 1,
      previousRecordSha256: initialized.recordSha256,
      payload: {
        kind: 'evidence_sealed',
        disposition: 'orphan_sealed',
        sealedFromJournalSha256: initialized.recordSha256,
        evidenceSha256: `sha256:${'2'.repeat(64)}`,
      },
    });
    const afterSeal = buildPhase697V6JournalRecord({
      runId,
      sequence: 2,
      previousRecordSha256: sealed.recordSha256,
      payload: {
        kind: 'evidence_sealed',
        disposition: 'orphan_sealed',
        sealedFromJournalSha256: sealed.recordSha256,
        evidenceSha256: `sha256:${'2'.repeat(64)}`,
      },
    });
    expect(
      parseAndValidatePhase697V6Journal(
        `${stableJsonStringify(initialized)}\n${stableJsonStringify(sealed)}\n${stableJsonStringify(afterSeal)}\n`,
      ),
    ).toBeNull();
  });

  test('seals a dispatch-started crash as one attempted orphan without replay', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V6Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_993,
    });
    const reserved = await reservePhase697V6Marker({ root, marker });
    if (!reserved.ok) throw new Error('marker not reserved');
    const created = await createPhase697V6Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('journal not created');

    const lifecycle = createPhase697V6JournalLifecycle(created.writer, runId);
    const baseline = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ runId, mode: 'live' }),
      {
        lifecycle: {
          async recordGuardTerminal(entry) {
            await lifecycle.recordGuardTerminal?.(entry);
          },
          async recordDispatchStarted(reservation, caseId) {
            await lifecycle.recordDispatchStarted?.(reservation, caseId);
            throw new Error('synthetic crash after durable dispatch');
          },
        },
      },
    ).catch(() => null);
    expect(baseline).toBeNull();
    await created.writer.close();
    const read = await readPhase697V6Journal({ root, runId });
    if (!read.ok) throw new Error('journal unreadable');
    expect(read.journal.guardTerminals.size).toBe(24);
    expect(read.journal.dispatches.size).toBe(1);
    expect(read.journal.runtimeTerminals.size).toBe(0);
    const sealed = buildPhase697V6SealedReport({
      marker,
      markerSha256: reserved.markerSha256,
      journal: read.journal,
    });
    expect(sealed?.gate).toBe('quality_gate_failed');
    expect(
      sealed?.caseEntries.filter((entry) => entry.executionOutcome === 'attempted_orphaned'),
    ).toHaveLength(1);
    expect(sealed?.usage.complete).toBe(false);
    expect(sealed?.usage.inputTokens).toBeNull();
    expect(sealed?.scheduler.breakerState).toBe('orphaned');
  });

  test('prevents live-owner sealing and fences same-byte recovery-claim ABA', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const marker = buildPhase697V6Marker({
      runId,
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 999_994,
    });
    const reserved = await reservePhase697V6Marker({ root, marker });
    if (!reserved.ok) throw new Error('marker not reserved');
    const created = await createPhase697V6Journal({
      root,
      marker,
      markerSha256: reserved.markerSha256,
    });
    if (!created.ok) throw new Error('journal not created');
    const snapshot = await created.writer.snapshot();
    await created.writer.close();
    expect(
      await acquirePhase697V6RecoveryClaim({
        root,
        marker,
        markerSha256: reserved.markerSha256,
        journalTailSha256: snapshot.tailSha256,
        overrides: { processAlive: () => true },
      }),
    ).toEqual({ ok: false, code: 'live_attempt_in_progress' });

    const fixedToken = '00000000-0000-4000-8000-000000000511';
    const first = await acquirePhase697V6RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: snapshot.tailSha256,
      overrides: {
        processAlive: () => false,
        claimToken: () => fixedToken,
      },
    });
    if (!first.ok) throw new Error('first claim failed');
    const second = await acquirePhase697V6RecoveryClaim({
      root,
      marker,
      markerSha256: reserved.markerSha256,
      journalTailSha256: snapshot.tailSha256,
      overrides: {
        processAlive: () => false,
        claimToken: () => fixedToken,
        temporaryId: () => 'aba-takeover',
      },
    });
    if (!second.ok) throw new Error('second claim failed');
    expect(await first.claim.assertOwned()).toBe(false);
    await expect(first.claim.release()).rejects.toThrow('PHASE_6_9_7_V6_RECOVERY_CLAIM_LOST');
    expect(await second.claim.assertOwned()).toBe(true);
    await second.claim.release();
  });

  test('fences journal-tail drift both while opening and before every recovery append', async () => {
    const exercise = async (driftBeforeOpen: boolean) => {
      const root = await temporaryRoot();
      const runId = randomUUID();
      const marker = buildPhase697V6Marker({
        runId,
        runScope: 'branch',
        executorProvenance: 'synthetic_test',
        ownerProcessId: 999_995,
      });
      const reserved = await reservePhase697V6Marker({ root, marker });
      if (!reserved.ok) throw new Error('marker not reserved');
      const created = await createPhase697V6Journal({
        root,
        marker,
        markerSha256: reserved.markerSha256,
      });
      if (!created.ok) throw new Error('journal not created');
      await created.writer.close();
      const stale = await readPhase697V6Journal({ root, runId });
      if (!stale.ok) throw new Error('journal unreadable');
      const report = await runPhase697TutorOrganizerPairedEvalV6(
        createPhase697V6SyntheticHarness({ mode: 'mock', runId: randomUUID() }),
      );
      const guard = report.caseEntries.find((entry) => entry.executionKind === 'zero_call');
      const projection = guard ? projectPhase697V6TerminalEntry(guard) : null;
      if (!projection) throw new Error('guard projection unavailable');
      const claim = await acquirePhase697V6RecoveryClaim({
        root,
        marker,
        markerSha256: reserved.markerSha256,
        journalTailSha256: stale.journal.tailSha256,
        overrides: { processAlive: () => false },
      });
      if (!claim.ok) throw new Error('recovery claim unavailable');
      const drift = async () => {
        const record = buildPhase697V6JournalRecord({
          runId,
          sequence: stale.journal.lastSequence + 1,
          previousRecordSha256: stale.journal.tailSha256,
          payload: { kind: 'guard_terminal', terminal: projection },
        });
        await appendFile(
          resolve(root, phase697V6JournalPath(runId)),
          `${stableJsonStringify(record)}\n`,
          'utf8',
        );
      };
      if (driftBeforeOpen) await drift();
      const appender = await openPhase697V6JournalAppender({
        root,
        journal: stale.journal,
        claim: claim.claim,
      });
      if (driftBeforeOpen) {
        expect(appender).toEqual({ ok: false, code: 'journal_tail_drift' });
      } else {
        if (!appender.ok) throw new Error('appender unavailable');
        await drift();
        await expect(
          appender.writer.append({
            kind: 'evidence_sealed',
            disposition: 'orphan_sealed',
            sealedFromJournalSha256: stale.journal.tailSha256,
            evidenceSha256: `sha256:${'3'.repeat(64)}`,
          }),
        ).rejects.toThrow('PHASE_6_9_7_V6_JOURNAL_TAIL_DRIFT');
        await appender.writer.close();
      }
      await claim.claim.release();
    };

    await exercise(true);
    await exercise(false);
  });

  test('publishes one hard-link winner, returns same_bytes, and rejects conflicting bytes', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ runId, mode: 'mock' }),
    );
    const envelope = buildPhase697V6EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope) throw new Error('envelope invalid');
    const evidencePath = phase697V6EvidencePath({ runId, runScope: 'branch', mode: 'mock' });
    const [left, right] = await Promise.all([
      publishPhase697V6Evidence({
        root,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'left' },
      }),
      publishPhase697V6Evidence({
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

    const firstRuntimeCaseId = report.caseEntries.find(
      (entry) => entry.executionKind === 'runtime',
    )?.caseId;
    const conflictingReport = buildPhase697TutorOrganizerV6Report({
      runId: report.runId,
      runScope: report.runScope,
      mode: report.mode,
      provider: report.provider,
      model: report.model,
      structuredOutputMode: report.structuredOutputMode,
      executorProvenance: report.executorProvenance,
      caseEntries: report.caseEntries.map((entry) =>
        entry.caseId === firstRuntimeCaseId
          ? { ...entry, safety: { ...entry.safety, criticalFailure: true } }
          : entry,
      ),
      pairedDurations: new Map(report.pairedDurationEvidence.map((value, index) => [index, value])),
      scheduler: report.scheduler,
      ledger: report.ledger,
    });
    const conflictEnvelope = buildPhase697V6EvidenceEnvelope({
      report: conflictingReport,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!conflictEnvelope) throw new Error('conflict envelope invalid');
    const conflict = await publishPhase697V6Evidence({
      root,
      evidencePath,
      envelope: conflictEnvelope,
      overrides: { temporaryId: () => 'conflict' },
    });
    expect(conflict).toEqual({ ok: false, code: 'evidence_target_conflict' });
    expect((await readFile(resolve(root, evidencePath), 'utf8')).endsWith('\n')).toBe(true);
  });
});
