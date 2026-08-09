import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST,
  expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import {
  phase698RetrieverSchemaRecoverySr3ArtifactRelativePath,
  phase698RetrieverSchemaRecoverySr3JournalRelativePath,
  reservePhase698RetrieverSchemaRecoverySr3Attempt,
  reservePhase698RetrieverSchemaRecoverySr3AttemptForTest,
  sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest,
  validatePhase698RetrieverSchemaRecoverySr3Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-durability.ts';
import {
  createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr3,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-runner.ts';
import { createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

async function tempRoot() {
  return mkdtemp(join(tmpdir(), 'prepmind-sr3-test-'));
}

describe('Phase 6.9.8 Retriever Schema Recovery SR3 durability', () => {
  test('persists a hash-chain bundle and publishes a hard-linked artifact', async () => {
    const root = await tempRoot();
    try {
      const runId = '00000000-0000-4000-8000-000000000004';
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const reservation = await reservePhase698RetrieverSchemaRecoverySr3Attempt({
        root,
        runId,
        createdAt: '2026-08-09T13:00:00.000Z',
        reservationCapability: admission.reservationCapability,
      });
      const report = await runPhase698RetrieverSchemaRecoverySr3({
        runId,
        runMode: 'reviewed_mock',
        admissionCapability: admission.capability,
        harness: createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest(),
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(report);
      const validation = await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root });
      expect(validation.ok).toBe(true);
      expect(validation.providerCalls).toBe(0);
      expect(validation.credentialReads).toBe(0);
      expect(validation.journalRecords).toBe(72);
      expect(phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(runId)).toContain(runId);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('recovers only the durable prefix after a dead creator and is idempotent', async () => {
    const root = await tempRoot();
    try {
      const runId = '00000000-0000-4000-8000-000000000005';
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const reservation = await reservePhase698RetrieverSchemaRecoverySr3AttemptForTest(
        {
          root,
          runId,
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: admission.reservationCapability,
        },
        { pid: 987654, startIdentity: 'dead-process-start' },
      );
      for (const guard of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.guardCases) {
        await reservation.lifecycle.appendGuardTerminal({
          kind: 'guard',
          caseId: guard.caseId,
          disposition: 'passed',
          observedReasonCode: guard.expectedReasonCode,
          expectedReasonCode: guard.expectedReasonCode,
          zeroCallVerified: true,
          permissionFailure: false,
          crossOwnerFailure: false,
          credentialFailure: false,
          injectionFailure: false,
        });
      }
      const identity = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()[0];
      if (!identity) throw new Error('fixture');
      const lane = await reservation.lifecycle.reserveLane(identity);
      await lane.appendLaneStage('dispatch_started');
      const sealed = await sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest({
        root,
        inspectProcess: () => ({ alive: false, startIdentity: null }),
      });
      expect(sealed.ok).toBe(true);
      if (sealed.ok) expect(sealed.disposition).toBe('crash_only_sealed');
      const validation = await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root });
      expect(validation.ok).toBe(true);
      expect(validation.providerCalls).toBe(0);
      const second = await sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest({
        root,
        inspectProcess: () => ({ alive: false, startIdentity: null }),
      });
      expect(second).toEqual({ ok: false, code: 'already_published' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects CRLF journal and foreign formal artifacts without repairing them', async () => {
    const root = await tempRoot();
    try {
      const runId = '00000000-0000-4000-8000-000000000009';
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const reservation = await reservePhase698RetrieverSchemaRecoverySr3Attempt({
        root,
        runId,
        createdAt: '2026-08-09T13:00:00.000Z',
        reservationCapability: admission.reservationCapability,
      });
      const report = await runPhase698RetrieverSchemaRecoverySr3({
        runId,
        runMode: 'reviewed_mock',
        admissionCapability: admission.capability,
        harness: createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest(),
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(report);
      const journalPath = join(
        root,
        '.tmp',
        `phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.journal.jsonl`,
      );
      const original = await readFile(journalPath, 'utf8');
      await writeFile(journalPath, original.replaceAll('\n', '\r\n'));
      expect((await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root })).ok).toBe(false);
      await writeFile(journalPath, original);
      await writeFile(
        join(
          root,
          '.tmp',
          'phase-6-9-8-retriever-final-response-schema-recovery-v1-00000000-0000-4000-8000-000000000010.journal.jsonl',
        ),
        'foreign\n',
      );
      expect((await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root })).ok).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('refuses an alive creator when start identity cannot be established', async () => {
    const root = await tempRoot();
    try {
      const runId = '00000000-0000-4000-8000-000000000011';
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      await reservePhase698RetrieverSchemaRecoverySr3AttemptForTest(
        {
          root,
          runId,
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: admission.reservationCapability,
        },
        { pid: 12345, startIdentity: 'unknown' },
      );
      const result = await sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest({
        root,
        inspectProcess: () => ({ alive: true, startIdentity: null }),
      });
      expect(result).toEqual({ ok: false, code: 'process_identity_unavailable' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('recovers a durable publication prefix and rejects an independent artifact inode', async () => {
    const root = await tempRoot();
    try {
      const runId = '00000000-0000-4000-8000-000000000012';
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const reservation = await reservePhase698RetrieverSchemaRecoverySr3AttemptForTest(
        {
          root,
          runId,
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: admission.reservationCapability,
        },
        { pid: 987655, startIdentity: 'dead-process-start' },
      );
      const report = await runPhase698RetrieverSchemaRecoverySr3({
        runId,
        runMode: 'reviewed_mock',
        admissionCapability: admission.capability,
        harness: createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest(),
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(report);
      const journalPath = join(root, phase698RetrieverSchemaRecoverySr3JournalRelativePath(runId));
      const journal = await readFile(journalPath, 'utf8');
      const lines = journal.trimEnd().split('\n');
      const publicationIndex = lines.findIndex((line) => line.includes('"publication_started"'));
      expect(publicationIndex).toBeGreaterThan(0);
      await writeFile(journalPath, `${lines.slice(0, publicationIndex + 1).join('\n')}\n`);
      const recovered = await sealPhase698RetrieverSchemaRecoverySr3InterruptedAttemptForTest({
        root,
        inspectProcess: () => ({ alive: false, startIdentity: null }),
      });
      expect(recovered.ok).toBe(true);
      if (recovered.ok) expect(recovered.disposition).toBe('terminal_publication_recovered');
      expect((await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root })).ok).toBe(true);

      const artifactPath = join(
        root,
        phase698RetrieverSchemaRecoverySr3ArtifactRelativePath(runId),
      );
      const reportPath = join(
        root,
        '.tmp',
        `phase-6-9-8-retriever-final-response-schema-recovery-v1-${runId}.report.json`,
      );
      const reportBytes = await readFile(reportPath, 'utf8');
      await unlink(artifactPath);
      await writeFile(artifactPath, reportBytes);
      expect((await validatePhase698RetrieverSchemaRecoverySr3Bundle({ root })).ok).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
