import { describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { sealPhase697TutorOrganizerV4Orphan } from '../scripts/phase-6-9-7-tutor-wrong-question-v4-cli.ts';
import {
  acquirePhase697V4RecoveryClaim,
  createPhase697V4Journal,
  publishPhase697V4Evidence,
  readPhase697V4Journal,
  reservePhase697V4Marker,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v4-durability.ts';
import { createPhase697V4JournalLifecycle } from '../scripts/phase-6-9-7-tutor-wrong-question-v4-journal-lifecycle.ts';
import { validatePhase697TutorOrganizerV4EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';
import {
  PHASE_6_9_7_V4_EVIDENCE_VERSION,
  PHASE_6_9_7_V4_MARKER_PATH,
  buildPhase697V4EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import {
  buildPhase697V4JournalRecord,
  buildPhase697V4Marker,
  parseAndValidatePhase697V4Journal,
  phase697V4EvidencePath,
  phase697V4JournalPath,
  phase697V4RecoveryClaimPath,
  stableJsonStringify,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts';
import { parseAndValidatePhase697V3Journal } from '../src/evals/phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV4 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v4-paired.ts';
import {
  createPhase697TutorOrganizerV4MockHarness,
  type Phase697TutorOrganizerEvalHarness,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

const LIVE_RUN_ID = '00000000-0000-4000-8000-000000000701';
const SECOND_RUN_ID = '00000000-0000-4000-8000-000000000702';
const DEAD_OWNER_PROCESS_ID = 2_147_483_647;

describe('Phase 6.9.7 V4 independent durability lineage', () => {
  test('allows one marker winner and never aliases a V3 marker path', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-marker-'));
    try {
      const runIds = Array.from({ length: 8 }, (_, index) =>
        index === 0
          ? LIVE_RUN_ID
          : `00000000-0000-4000-8000-${String(703 + index).padStart(12, '0')}`,
      );
      const results = await Promise.all(
        runIds.map((runId) =>
          reservePhase697V4Marker({
            root,
            marker: buildPhase697V4Marker({ runId, runScope: 'branch' }),
          }),
        ),
      );
      expect(results.filter((entry) => entry.ok)).toHaveLength(1);
      expect(results.filter((entry) => !entry.ok)).toHaveLength(7);
      expect(PHASE_6_9_7_V4_MARKER_PATH).toContain('-v4-');
      await expect(
        access(resolve(root, '.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker')),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('persists a complete fixed-denominator V4 journal before publishing evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-complete-'));
    try {
      const marker = buildPhase697V4Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        executorProvenance: 'synthetic_test',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      const reserved = await reservePhase697V4Marker({ root, marker });
      expect(reserved.ok).toBe(true);
      if (!reserved.ok) throw new Error(reserved.code);
      const journal = await createPhase697V4Journal({
        root,
        marker,
        markerSha256: reserved.markerSha256,
      });
      expect(journal.ok).toBe(true);
      if (!journal.ok) throw new Error(journal.code);

      const report = await runPhase697TutorOrganizerPairedEvalV4(
        liveSyntheticHarness(LIVE_RUN_ID),
        {
          lifecycle: createPhase697V4JournalLifecycle(journal.writer, LIVE_RUN_ID),
        },
      );
      const snapshot = await journal.writer.snapshot();
      expect(report.counts).toMatchObject({ cases: 72, zeroCall: 24, runtime: 48 });
      expect(report.ledger).toEqual({ reservedEntries: 48, terminalEntries: 48 });
      expect(
        new Set(
          report.ledger.reservedEntries ? report.caseEntries.map((entry) => entry.caseId) : [],
        ).size,
      ).toBe(72);
      const envelope = buildPhase697V4EvidenceEnvelope({
        report,
        disposition: 'completed_run',
        markerSha256: reserved.markerSha256,
        journalTailSha256: snapshot.tailSha256,
        journalSequence: snapshot.lastSequence,
      });
      expect(envelope).not.toBeNull();
      if (envelope === null) throw new Error('missing V4 evidence envelope');
      const evidencePath = phase697V4EvidencePath({
        runScope: 'branch',
        mode: 'live',
        runId: LIVE_RUN_ID,
      });
      const published = await publishPhase697V4Evidence({ root, evidencePath, envelope });
      expect(published.ok).toBe(true);
      if (!published.ok) throw new Error(published.code);
      await journal.writer.append({
        kind: 'evidence_sealed',
        disposition: 'completed_run',
        sealedFromJournalSha256: snapshot.tailSha256,
        evidenceSha256: published.evidenceSha256,
      });
      await journal.writer.close();

      const read = await readPhase697V4Journal({ root, runId: LIVE_RUN_ID });
      expect(read.ok).toBe(true);
      if (!read.ok) throw new Error(read.code);
      expect(read.journal.guardTerminals.size).toBe(24);
      expect(read.journal.dispatches.size).toBe(48);
      expect(read.journal.runtimeTerminals.size).toBe(48);
      expect(read.journal.pairedLatencies.size).toBe(24);
      expect(
        read.journal.records.filter((entry) => entry.payload.kind === 'evidence_sealed'),
      ).toHaveLength(1);
      expect(
        await validatePhase697TutorOrganizerV4EvidenceBundle({
          root,
          evidencePath: resolve(root, evidencePath),
        }),
      ).toEqual({ ok: true });
      await expect(
        access(resolve(root, phase697V4JournalPath(LIVE_RUN_ID).replace('-v4-', '-v3-'))),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects V4 journal tampering and both legacy parsers reject the other lineage', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-tamper-'));
    try {
      const marker = buildPhase697V4Marker({ runId: LIVE_RUN_ID, runScope: 'branch' });
      const reserved = await reservePhase697V4Marker({ root, marker });
      if (!reserved.ok) throw new Error(reserved.code);
      const journal = await createPhase697V4Journal({
        root,
        marker,
        markerSha256: reserved.markerSha256,
      });
      if (!journal.ok) throw new Error(journal.code);
      await journal.writer.close();
      const path = resolve(root, phase697V4JournalPath(LIVE_RUN_ID));
      const text = await readFile(path, 'utf8');
      expect(parseAndValidatePhase697V4Journal(text)).not.toBeNull();
      expect(parseAndValidatePhase697V3Journal(text)).toBeNull();

      const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
      parsed.sequence = 1;
      expect(parseAndValidatePhase697V4Journal(`${JSON.stringify(parsed)}\n`)).toBeNull();
      parsed.sequence = 0;
      parsed.recordSha256 = `sha256:${'0'.repeat(64)}`;
      expect(parseAndValidatePhase697V4Journal(`${JSON.stringify(parsed)}\n`)).toBeNull();

      const v3Record = buildPhase697V4JournalRecord({
        runId: LIVE_RUN_ID,
        sequence: 0,
        previousRecordSha256: null,
        payload: {
          kind: 'journal_initialized',
          markerSha256: reserved.markerSha256,
          runScope: 'branch',
          mode: 'live',
          datasetSha256: marker.datasetSha256,
        },
      });
      const wrongVersion = stableJsonStringify({
        ...v3Record,
        journalVersion: 'phase-6.9.7-v3-journal-v1',
      });
      expect(parseAndValidatePhase697V4Journal(`${wrongVersion}\n`)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('seals one orphan journal exactly once and keeps the fixed 72/24/48 denominator', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-orphan-'));
    try {
      const marker = buildPhase697V4Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        executorProvenance: 'synthetic_test',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      const reserved = await reservePhase697V4Marker({ root, marker });
      if (!reserved.ok) throw new Error(reserved.code);
      const journal = await createPhase697V4Journal({
        root,
        marker,
        markerSha256: reserved.markerSha256,
      });
      if (!journal.ok) throw new Error(journal.code);
      await journal.writer.close();

      const first = await sealPhase697TutorOrganizerV4Orphan({
        root,
        processAlive: () => false,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(first.disposition).toBe('orphan_sealed');
      expect(first.counts).toMatchObject({ cases: 72, zeroCall: 24, runtime: 48 });
      const second = await sealPhase697TutorOrganizerV4Orphan({
        root,
        processAlive: () => false,
      });
      expect(second).toEqual(first);
      const read = await readPhase697V4Journal({ root, runId: LIVE_RUN_ID });
      expect(read.ok).toBe(true);
      if (!read.ok) throw new Error(read.code);
      expect(
        read.journal.records.filter((entry) => entry.payload.kind === 'evidence_sealed'),
      ).toHaveLength(1);
      expect(read.journal.sealed?.disposition).toBe('orphan_sealed');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fences an ABA recovery claimant and preserves the newer owner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-aba-'));
    try {
      const marker = buildPhase697V4Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      const first = await acquirePhase697V4RecoveryClaim({
        root,
        marker,
        overrides: {
          processAlive: () => false,
          claimToken: () => '00000000-0000-4000-8000-000000000711',
          temporaryId: () => 'first-takeover',
        },
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      const second = await acquirePhase697V4RecoveryClaim({
        root,
        marker,
        overrides: {
          processAlive: () => false,
          claimToken: () => '00000000-0000-4000-8000-000000000712',
          temporaryId: () => 'second-takeover',
        },
      });
      expect(second.ok).toBe(true);
      if (!second.ok) throw new Error(second.code);
      expect(await first.claim.assertOwned()).toBe(false);
      await expect(first.claim.release()).rejects.toThrow('PHASE_6_9_7_V4_RECOVERY_CLAIM_LOST');
      expect(await second.claim.assertOwned()).toBe(true);
      await second.claim.release();
      await expect(
        access(resolve(root, phase697V4RecoveryClaimPath(LIVE_RUN_ID))),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('uses hard-link publication with same-byte idempotency and conflict refusal', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-publish-'));
    try {
      const report = await runPhase697TutorOrganizerPairedEvalV4(
        createPhase697TutorOrganizerV4MockHarness({ runId: SECOND_RUN_ID }),
      );
      const envelope = buildPhase697V4EvidenceEnvelope({
        report,
        disposition: 'mock_direct',
        markerSha256: null,
        journalTailSha256: null,
        journalSequence: null,
      });
      if (envelope === null) throw new Error('missing envelope');
      const evidencePath = phase697V4EvidencePath({
        runScope: 'branch',
        mode: 'mock',
        runId: SECOND_RUN_ID,
      });
      const first = await publishPhase697V4Evidence({ root, evidencePath, envelope });
      expect(first).toMatchObject({ ok: true, disposition: 'published' });
      const second = await publishPhase697V4Evidence({ root, evidencePath, envelope });
      expect(second).toMatchObject({ ok: true, disposition: 'same_bytes' });
      expect(JSON.parse(await readFile(resolve(root, evidencePath), 'utf8'))).toMatchObject({
        evidenceVersion: PHASE_6_9_7_V4_EVIDENCE_VERSION,
      });

      const conflictRoot = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v4-conflict-'));
      try {
        const conflictPath = resolve(conflictRoot, evidencePath);
        await writeFile(conflictPath, 'conflict', { flag: 'wx' }).catch(async (error) => {
          if ((error as { code?: string }).code !== 'ENOENT') throw error;
          const published = await publishPhase697V4Evidence({
            root: conflictRoot,
            evidencePath,
            envelope,
          });
          if (!published.ok) throw new Error(published.code);
          await writeFile(conflictPath, 'conflict');
        });
        expect(
          await publishPhase697V4Evidence({ root: conflictRoot, evidencePath, envelope }),
        ).toEqual({
          ok: false,
          code: 'evidence_target_conflict',
        });
      } finally {
        await rm(conflictRoot, { recursive: true, force: true });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function liveSyntheticHarness(runId: string): Phase697TutorOrganizerEvalHarness {
  const mock = createPhase697TutorOrganizerV4MockHarness({ runId, runScope: 'branch' });
  return Object.freeze({
    ...mock,
    mode: 'live' as const,
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro' as const,
    structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' as const,
    executorProvenance: 'synthetic_test' as const,
  });
}
