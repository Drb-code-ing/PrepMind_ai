import { describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5Runner,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner.ts';
import {
  phase698RetrieverSchemaRecoverySr5RunnerArtifactRelativePath,
  phase698RetrieverSchemaRecoverySr5RunnerJournalRelativePath,
  reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt,
  reservePhase698RetrieverSchemaRecoverySr5RunnerAttemptForTest,
  sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttemptForTest,
  validatePhase698RetrieverSchemaRecoverySr5RunnerBundle,
  removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability.ts';

const ROOT_PREFIX = 'prepmind-sr5-runner-durability-';

async function createRun(runId = randomUUID(), creator?: { pid: number; startIdentity: string }) {
  const root = await mkdtemp(join(tmpdir(), ROOT_PREFIX));
  const bound = createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(
    createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput(),
  );
  const input = {
    root,
    runId,
    createdAt: new Date().toISOString(),
    reservationCapability: bound.reservationCapability,
  };
  const reservation = creator
    ? await reservePhase698RetrieverSchemaRecoverySr5RunnerAttemptForTest(input, creator)
    : await reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt(input);
  return { root, bound, reservation };
}

async function completeRun() {
  const run = await createRun();
  const report = await runPhase698RetrieverSchemaRecoverySr5Runner({
    runId: run.reservation.runId,
    runMode: 'reviewed_mock',
    repositoryRoot: run.root,
    admissionAuthority: 'synthetic_test',
    admissionCapability: run.bound.capability,
    harness: createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest(),
    lifecycle: run.reservation.lifecycle,
    signal: new AbortController().signal,
  });
  const published = await run.reservation.publishArtifact(report);
  return { ...run, report, published };
}

describe('Phase 6.9.8 Retriever / FinalResponse SR5 runner durability', () => {
  test('persists a zero-provider hash-chain bundle and hard-link artifact', async () => {
    const run = await completeRun();
    try {
      const validation = await validatePhase698RetrieverSchemaRecoverySr5RunnerBundle({
        root: run.root,
      });
      expect(validation).toMatchObject({
        ok: true,
        runId: run.reservation.runId,
        finalJournalEvent: 'evidence_published',
        providerCalls: 0,
        credentialReads: 0,
      });
      expect(run.published.artifactRelativePath).toBe(
        phase698RetrieverSchemaRecoverySr5RunnerArtifactRelativePath(run.reservation.runId),
      );
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(run.root);
    }
  });

  test('rejects a tampered journal or artifact without repairing it', async () => {
    const run = await completeRun();
    try {
      const artifactPath = join(run.root, run.published.artifactRelativePath);
      await Bun.write(artifactPath, `${await Bun.file(artifactPath).text()}tampered`);
      const validation = await validatePhase698RetrieverSchemaRecoverySr5RunnerBundle({
        root: run.root,
      });
      expect(validation.ok).toBe(false);
      expect(await Bun.file(artifactPath).text()).toContain('tampered');
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(run.root);
    }
  });

  test('crash-only seals an interrupted prefix and does not replay a lane', async () => {
    const runId = randomUUID();
    const run = await createRun(runId, {
      pid: 999_991,
      startIdentity: `sha256:${'1'.repeat(64)}`,
    });
    try {
      const sealed = await sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttemptForTest({
        root: run.root,
        inspectProcess: () => ({ alive: false, startIdentity: `sha256:${'2'.repeat(64)}` }),
      });
      expect(sealed.ok).toBe(true);
      if (sealed.ok) expect(sealed.disposition).toBe('crash_only_sealed');
      const validation = await validatePhase698RetrieverSchemaRecoverySr5RunnerBundle({
        root: run.root,
      });
      expect(validation.ok).toBe(true);
      expect(validation.providerCalls).toBe(0);
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(run.root);
    }
  });

  test('recovers a terminal publication prefix once and rejects a second seal', async () => {
    const run = await createRun(randomUUID(), {
      pid: 999_992,
      startIdentity: `sha256:${'3'.repeat(64)}`,
    });
    try {
      await runPhase698RetrieverSchemaRecoverySr5Runner({
        runId: run.reservation.runId,
        runMode: 'reviewed_mock',
        repositoryRoot: run.root,
        admissionAuthority: 'synthetic_test',
        admissionCapability: run.bound.capability,
        harness: createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest(),
        lifecycle: run.reservation.lifecycle,
        signal: new AbortController().signal,
      });
      const inspectProcess = () => ({ alive: false, startIdentity: null });
      const sealed = await sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttemptForTest({
        root: run.root,
        inspectProcess,
      });
      expect(sealed).toMatchObject({ ok: true, disposition: 'terminal_publication_recovered' });
      const second = await sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttemptForTest({
        root: run.root,
        inspectProcess,
      });
      expect(second).toEqual({ ok: false, code: 'already_published' });
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(run.root);
    }
  });

  test('rejects CRLF journals and foreign current-lineage artifacts fail-closed', async () => {
    const crlfRun = await completeRun();
    try {
      const journalPath = join(
        crlfRun.root,
        phase698RetrieverSchemaRecoverySr5RunnerJournalRelativePath(crlfRun.reservation.runId),
      );
      await Bun.write(journalPath, (await Bun.file(journalPath).text()).replaceAll('\n', '\r\n'));
      expect(
        await validatePhase698RetrieverSchemaRecoverySr5RunnerBundle({ root: crlfRun.root }),
      ).toMatchObject({ ok: false });
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(crlfRun.root);
    }

    const foreignRun = await completeRun();
    try {
      await Bun.write(
        join(
          foreignRun.root,
          `.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-${randomUUID()}.report.json`,
        ),
        '{}\n',
      );
      expect(
        await validatePhase698RetrieverSchemaRecoverySr5RunnerBundle({ root: foreignRun.root }),
      ).toMatchObject({ ok: false });
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(foreignRun.root);
    }
  });

  test('second reservation capability consumption fails closed', async () => {
    const root = await mkdtemp(join(tmpdir(), ROOT_PREFIX));
    const bound = createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(
      createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput(),
    );
    const input = {
      root,
      runId: randomUUID(),
      createdAt: new Date().toISOString(),
      reservationCapability: bound.reservationCapability,
    };
    try {
      await reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt(input);
      await expect(reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt(input)).rejects.toThrow(
        'BOUND_RESERVATION_CAPABILITY_INVALID',
      );
    } finally {
      await removePhase698RetrieverSchemaRecoverySr5RunnerTempRootForTest(root);
    }
  });
});
