import { randomUUID } from 'node:crypto';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  admitPhase698P1L2ZeroProvider,
  createPhase698P1L2SyntheticAdmissionInput,
  issuePhase698P1L2AdmissionCapability,
  consumePhase698P1L2AdmissionCapability,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-admission.ts';
import { sourceFromPhase698P1L2Admission } from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-contract.ts';
import {
  createPhase698P1L2ReviewedMockHarness,
  runPhase698P1L2,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-runner.ts';
import {
  createPhase698P1L2SyntheticRootForTest,
  removePhase698P1L2SyntheticRootForTest,
  reservePhase698P1L2Attempt,
  validatePhase698P1L2Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-durability.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from '../src/evals/phase-6-9-8-retriever-final-response-p1-baseline.ts';

describe('Phase 6.9.8 P1 L2 independent runner/durability', () => {
  test('admission capability is single-use and source projection is isolated', () => {
    const input = createPhase698P1L2SyntheticAdmissionInput('b'.repeat(40));
    expect(admitPhase698P1L2ZeroProvider(input)).toMatchObject({ ok: true });
    const capability = issuePhase698P1L2AdmissionCapability(input);
    const admission = consumePhase698P1L2AdmissionCapability(capability);
    expect(admission.providerCalls).toBe(0);
    expect(admission.credentialReads).toBe(0);
    expect(sourceFromPhase698P1L2Admission(admission).mode).toBe('controlled_live');
    expect(() => consumePhase698P1L2AdmissionCapability(capability)).toThrow();
  });

  test('reviewed mock uses the new L2 namespace and publishes a valid zero-provider bundle', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const admissionInput = createPhase698P1L2SyntheticAdmissionInput('c'.repeat(40));
    const admission = admitPhase698P1L2ZeroProvider(admissionInput);
    if (!admission.ok) throw new Error('fixture admission failed');
    const root = await createPhase698P1L2SyntheticRootForTest();
    try {
      const reservation = await reservePhase698P1L2Attempt({
        root,
        runId: randomUUID(),
        source: sourceFromPhase698P1L2Admission(admission.admission),
      });
      const run = await runPhase698P1L2({
        runId: reservation.runId,
        admissionCapability: issuePhase698P1L2AdmissionCapability(admissionInput),
        baselineBundle: baseline,
        harness: createPhase698P1L2ReviewedMockHarness(baseline),
        allowReviewedMock: true,
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(run.report);
      const validation = await validatePhase698P1L2Bundle({ root });
      expect(run.report.execution.candidateInvocations).toBe(12);
      expect(run.report.execution.providerCalls).toBe(0);
      expect(run.gate.passed).toBe(false);
      expect(validation).toMatchObject({
        ok: true,
        providerCalls: 0,
        formalEvidence: 1,
        finalJournalEvent: 'evidence_published',
      });
    } finally {
      await removePhase698P1L2SyntheticRootForTest(root);
    }
  });

  test('journal tamper is fail-closed', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const admissionInput = createPhase698P1L2SyntheticAdmissionInput('d'.repeat(40));
    const admission = admitPhase698P1L2ZeroProvider(admissionInput);
    if (!admission.ok) throw new Error('fixture admission failed');
    const root = await createPhase698P1L2SyntheticRootForTest();
    try {
      const reservation = await reservePhase698P1L2Attempt({
        root,
        runId: randomUUID(),
        source: sourceFromPhase698P1L2Admission(admission.admission),
      });
      const run = await runPhase698P1L2({
        runId: reservation.runId,
        admissionCapability: issuePhase698P1L2AdmissionCapability(admissionInput),
        baselineBundle: baseline,
        harness: createPhase698P1L2ReviewedMockHarness(baseline),
        allowReviewedMock: true,
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(run.report);
      const journalName = (await readdir(join(root, '.tmp'))).find((entry) =>
        entry.endsWith('.journal.jsonl'),
      );
      if (!journalName) throw new Error('journal missing');
      const journalPath = join(root, '.tmp', journalName);
      const bytes = await readFile(journalPath, 'utf8');
      await Bun.write(journalPath, bytes.replace('attempt_reserved', 'attempt_reserved_tampered'));
      expect((await validatePhase698P1L2Bundle({ root })).ok).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
