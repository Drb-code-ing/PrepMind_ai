import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TASK9_ARTIFACT_SCHEMA,
  PHASE_6_9_8_TASK9_MARKER_RELATIVE_PATH,
  artifactRelativePath,
  journalRelativePath,
  recoveryClaimRelativePath,
  reservePhase698Task9Attempt,
  sealPhase698Task9InterruptedAttemptForTest,
  validatePhase698Task9Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-durability.ts';
import { expectedPhase698Task9CallSchedule } from '../src/evals/phase-6-9-8-retriever-final-response-task9-contract.ts';
import {
  buildPhase698Task9BReviewedMockCheckpoint,
  createPhase698Task9ReviewedMockHarnessForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-reviewed-mock.ts';
import { runPhase698Task9 } from '../src/evals/phase-6-9-8-retriever-final-response-task9-runner.ts';
import { createPhase698Task9SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.8 Task 9B durability and crash-only recovery', () => {
  test('persists and strictly recomputes a complete 372-record synthetic bundle', async () => {
    const root = await temporaryRoot();
    const { runId, report, published } = await completedRun(root, true);
    if (!published) throw new Error('Task 9B synthetic publication missing');

    const validation = await validatePhase698Task9Bundle({ root });
    expect(validation).toMatchObject({
      ok: true,
      runId,
      qualityAuthority: 'none',
      journalRecords: 372,
      finalJournalEvent: 'evidence_published',
      physicalArtifactSha256: published.evidenceSha256,
    });
    expect(validation.gate).toEqual(report.gate);
    const journal = await readFile(resolve(root, journalRelativePath(runId)), 'utf8');
    const events = journalRecords(journal).map((record) => record.event);
    expect(events.filter((event) => event === 'guard_terminal')).toHaveLength(16);
    expect(events.filter((event) => event === 'call_reserved')).toHaveLength(64);
    expect(events.filter((event) => event === 'wire_stage')).toHaveLength(192);
    expect(events.filter((event) => event === 'call_terminal')).toHaveLength(64);
    expect(events.slice(-3)).toEqual(['run_terminal', 'publication_started', 'evidence_published']);
  });

  test('elects exactly one reservation winner and rejects marker replacement', async () => {
    const root = await temporaryRoot();
    const results = await Promise.allSettled([reserveSynthetic(root), reserveSynthetic(root)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const files = await readdir(join(root, '.tmp'));
    expect(files.filter((file) => file.endsWith('.marker'))).toHaveLength(1);
    expect(files.filter((file) => file.endsWith('.journal.jsonl'))).toHaveLength(1);
  });

  test('rejects truncation, CRLF, hash tampering, and extra formal files', async () => {
    const root = await temporaryRoot();
    const { runId } = await completedRun(root, true);
    const journalPath = resolve(root, journalRelativePath(runId));
    const original = await readFile(journalPath, 'utf8');

    await writeFile(journalPath, original.trimEnd(), 'utf8');
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original.replaceAll('\n', '\r\n'), 'utf8');
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(false);

    await writeFile(
      journalPath,
      original.replace('"event":"guard_terminal"', '"event":"rewrite_terminal"'),
      'utf8',
    );
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(false);

    await writeFile(journalPath, original, 'utf8');
    await writeFile(
      join(
        root,
        '.tmp',
        `phase-6-9-8-retriever-final-response-task9c-controlled-live-${randomUUID()}.journal.jsonl`,
      ),
      '{}\n',
      'utf8',
    );
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(false);
  });

  test('crash-seals an attempt that stopped before guards without inventing calls or metrics', async () => {
    const root = await temporaryRoot();
    const { runId } = await reserveSynthetic(root);

    const sealed = await sealPhase698Task9InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });

    expect(sealed).toMatchObject({
      ok: true,
      runId,
      disposition: 'crash_only_sealed',
      gate: { passed: false, qualityAuthority: 'none' },
    });
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(true);
    const artifact = await readArtifact(root, runId);
    expect(artifact.durability).toMatchObject({
      completionMode: 'recovery',
      publicationMode: 'recovery',
    });
    expect(artifact.report.guards.passCount).toBe(0);
    expect(
      artifact.report.callEntries.every((entry) => entry.disposition === 'not_started_case_guard'),
    ).toBe(true);
    expect(artifact.report.providers.aggregateVerifiedCostCny).toBeNull();
  });

  test('recovers a usage-verified prepared success without replaying the call', async () => {
    const root = await temporaryRoot();
    const checkpoint = await buildPhase698Task9BReviewedMockCheckpoint();
    const { runId, reservation } = await reserveSynthetic(root);
    for (const guard of checkpoint.report.guardEntries) {
      await reservation.lifecycle.appendGuardTerminal(guard);
    }
    const identity = expectedPhase698Task9CallSchedule()[0]!;
    const call = await reservation.lifecycle.reserveCall(identity);
    await call.appendWireStage('dispatch_started');
    await call.appendWireStage('response_received');
    await call.appendWireStage('usage_verified', checkpoint.report.callEntries[0]);

    const sealed = await sealPhase698Task9InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });

    expect(sealed).toMatchObject({ ok: true, disposition: 'crash_only_sealed' });
    const artifact = await readArtifact(root, runId);
    expect(artifact.report.callEntries[0]).toEqual(checkpoint.report.callEntries[0]);
    expect(
      artifact.report.callEntries
        .slice(1)
        .every((entry) => entry.disposition === 'not_started_quality_breaker'),
    ).toBe(true);
    expect(artifact.report.providers.qwen).toMatchObject({
      attempts: 1,
      dispatches: 1,
      responses: 1,
      verifiedUsage: 1,
    });
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(true);
  });

  test('preserves dispatch/response crash boundaries and never fabricates verified usage', async () => {
    for (const lastStage of ['dispatch_started', 'response_received'] as const) {
      const root = await temporaryRoot();
      const checkpoint = await buildPhase698Task9BReviewedMockCheckpoint();
      const { runId, reservation } = await reserveSynthetic(root);
      for (const guard of checkpoint.report.guardEntries) {
        await reservation.lifecycle.appendGuardTerminal(guard);
      }
      const call = await reservation.lifecycle.reserveCall(expectedPhase698Task9CallSchedule()[0]!);
      await call.appendWireStage('dispatch_started');
      if (lastStage === 'response_received') await call.appendWireStage('response_received');

      expect(
        await sealPhase698Task9InterruptedAttemptForTest({
          root,
          isProcessAlive: () => false,
        }),
      ).toMatchObject({ ok: true, disposition: 'crash_only_sealed' });
      const first = (await readArtifact(root, runId)).report.callEntries[0]!;
      expect(first).toMatchObject({
        disposition: 'failed',
        failureReason: 'runtime_contract_invalid',
        wire: {
          attempts: 1,
          dispatches: 1,
          responses: lastStage === 'response_received' ? 1 : 0,
          verifiedUsage: 0,
        },
        usage: null,
        verifiedCostCny: null,
      });
    }
  });

  test('recovers publication from a durable runtime terminal without changing the report', async () => {
    const root = await temporaryRoot();
    const { runId, report } = await completedRun(root, false);

    const sealed = await sealPhase698Task9InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });

    expect(sealed).toMatchObject({
      ok: true,
      runId,
      disposition: 'terminal_publication_recovered',
    });
    const artifact = await readArtifact(root, runId);
    expect(artifact.report).toEqual(report);
    expect(artifact.durability).toMatchObject({
      completionMode: 'runtime',
      publicationMode: 'recovery',
    });
    expect((await validatePhase698Task9Bundle({ root })).ok).toBe(true);
  });

  test('refuses recovery while the marker owner is alive and creates no claim or artifact', async () => {
    const root = await temporaryRoot();
    const { runId } = await reserveSynthetic(root);

    expect(
      await sealPhase698Task9InterruptedAttemptForTest({ root, isProcessAlive: () => true }),
    ).toEqual({ ok: false, code: 'process_active' });
    expect(await exists(resolve(root, recoveryClaimRelativePath(runId)))).toBe(false);
    expect(await exists(resolve(root, artifactRelativePath(runId)))).toBe(false);
  });

  test('refuses a pre-existing non-file marker without replacing it', async () => {
    const root = await temporaryRoot();
    await mkdir(join(root, '.tmp'));
    await mkdir(resolve(root, PHASE_6_9_8_TASK9_MARKER_RELATIVE_PATH));

    await expect(reserveSynthetic(root)).rejects.toThrow();
    expect(
      (await readdir(join(root, '.tmp'))).filter((entry) => entry.endsWith('.journal.jsonl')),
    ).toHaveLength(0);
  });
});

async function completedRun(root: string, publish: boolean) {
  const { runId, admission, reservation } = await reserveSynthetic(root);
  const report = await runPhase698Task9({
    runId,
    authority: 'synthetic_test',
    credentialReads: 0,
    admissionCapability: admission.capability,
    harness: await createPhase698Task9ReviewedMockHarnessForTest(),
    lifecycle: reservation.lifecycle,
    signal: new AbortController().signal,
  });
  const published = publish ? await reservation.publishArtifact(report) : null;
  return { runId, report, reservation, published };
}

async function reserveSynthetic(root: string) {
  const runId = randomUUID();
  const admission = createPhase698Task9SyntheticAdmissionForTest();
  const reservation = await reservePhase698Task9Attempt({
    root,
    runId,
    createdAt: new Date().toISOString(),
    reservationCapability: admission.reservationCapability,
  });
  return { runId, admission, reservation };
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-task9b-durability-'));
  roots.push(root);
  return root;
}

async function readArtifact(root: string, runId: string) {
  return PHASE_6_9_8_TASK9_ARTIFACT_SCHEMA.parse(
    JSON.parse(await readFile(resolve(root, artifactRelativePath(runId)), 'utf8')),
  );
}

function journalRecords(bytes: string): Array<Record<string, unknown>> {
  return bytes
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
