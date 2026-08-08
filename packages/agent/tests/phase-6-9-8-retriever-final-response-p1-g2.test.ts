import { randomUUID } from 'node:crypto';
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  admitPhase698P1G2Source,
  createPhase698P1G2SyntheticSourceSnapshot,
  consumePhase698P1G2SourceAdmissionCapability,
  issuePhase698P1G2SourceAdmissionCapability,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-g2-source-admission.ts';
import {
  createPhase698P1G2SyntheticRootForTest,
  recoverPhase698P1G2InterruptedAttempt,
  removePhase698P1G2SyntheticRootForTest,
  reservePhase698P1G2Attempt,
  validatePhase698P1G2Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-g2-durability.ts';
import {
  createPhase698P1G2DeterministicHarness,
  runPhase698P1G2,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-g2-runner.ts';
import { buildPhase698P1DeterministicSubsetBaseline } from '../src/evals/phase-6-9-8-retriever-final-response-p1-baseline.ts';

describe('Phase 6.9.8 P1 G2 zero-provider runner/durability', () => {
  test('fails closed on source drift and consumes admission capability once', () => {
    const dirty = admitPhase698P1G2Source({
      ...createPhase698P1G2SyntheticSourceSnapshot(),
      clean: false,
    });
    expect(dirty).toMatchObject({ ok: false, code: 'source_dirty' });
    const admission = admitPhase698P1G2Source(createPhase698P1G2SyntheticSourceSnapshot());
    if (!admission.ok) throw new Error('source fixture did not admit');
    const capability = issuePhase698P1G2SourceAdmissionCapability(
      createPhase698P1G2SyntheticSourceSnapshot(),
    );
    expect(consumePhase698P1G2SourceAdmissionCapability(capability).branch).toBe(
      'drb/phase-6-9-8-g2-runner-durability',
    );
    expect(() => consumePhase698P1G2SourceAdmissionCapability(capability)).toThrow();
    expect(admission.source.providerCalls).toBe(0);
    expect(admission.source.credentialReads).toBe(0);
  });

  test('runs all 8 guards and 12 serial lanes, with candidate-only projection and durable publication', async () => {
    const root = await createPhase698P1G2SyntheticRootForTest();
    try {
      const baseline = await buildPhase698P1DeterministicSubsetBaseline();
      const admission = admitPhase698P1G2Source(createPhase698P1G2SyntheticSourceSnapshot());
      if (!admission.ok) throw new Error('source fixture did not admit');
      const reservation = await reservePhase698P1G2Attempt({
        root,
        runId: randomUUID(),
        source: admission.source,
      });
      const base = createPhase698P1G2DeterministicHarness(baseline);
      const seenKeys: string[] = [];
      const harness = {
        mode: 'synthetic' as const,
        runGuard: base.runGuard,
        runRewrite: async (input: Parameters<typeof base.runRewrite>[0], signal: AbortSignal) => {
          seenKeys.push(Object.keys(input).sort().join(','));
          return base.runRewrite(input, signal);
        },
        runFinalResponse: async (
          input: Parameters<typeof base.runFinalResponse>[0],
          signal: AbortSignal,
        ) => {
          seenKeys.push(Object.keys(input).sort().join(','));
          return base.runFinalResponse(input, signal);
        },
      };
      const run = await runPhase698P1G2({
        runId: reservation.runId,
        sourceAdmissionCapability: issuePhase698P1G2SourceAdmissionCapability(
          createPhase698P1G2SyntheticSourceSnapshot(),
        ),
        baselineBundle: baseline,
        harness,
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(run.report);
      const validation = await validatePhase698P1G2Bundle({ root });
      expect(run.gate.passed).toBe(true);
      expect(run.report.execution.candidateInvocations).toBe(12);
      expect(seenKeys.every((keys) => !keys.includes('caseId') && !keys.includes('expected'))).toBe(
        true,
      );
      expect(validation).toMatchObject({
        ok: true,
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
        finalJournalEvent: 'evidence_published',
      });
    } finally {
      await removePhase698P1G2SyntheticRootForTest(root);
    }
  });

  test('semantic mismatch continues while transport failure opens the quality breaker', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const admission = admitPhase698P1G2Source(createPhase698P1G2SyntheticSourceSnapshot());
    if (!admission.ok) throw new Error('source fixture did not admit');
    const makeRun = async (failure: 'semantic_mismatch' | 'transport') => {
      const root = await createPhase698P1G2SyntheticRootForTest();
      const reservation = await reservePhase698P1G2Attempt({
        root,
        runId: randomUUID(),
        source: admission.source,
      });
      const base = createPhase698P1G2DeterministicHarness(baseline);
      let calls = 0;
      const harness = {
        mode: 'synthetic' as const,
        runGuard: base.runGuard,
        runRewrite: async (input: Parameters<typeof base.runRewrite>[0], signal: AbortSignal) => {
          calls += 1;
          const result = await base.runRewrite(input, signal);
          return calls === 1 ? { ...result, failureCategory: failure } : result;
        },
        runFinalResponse: async (
          input: Parameters<typeof base.runFinalResponse>[0],
          signal: AbortSignal,
        ) => {
          calls += 1;
          return base.runFinalResponse(input, signal);
        },
      };
      const run = await runPhase698P1G2({
        runId: reservation.runId,
        sourceAdmissionCapability: issuePhase698P1G2SourceAdmissionCapability(
          createPhase698P1G2SyntheticSourceSnapshot(),
        ),
        baselineBundle: baseline,
        harness,
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(run.report);
      const validation = await validatePhase698P1G2Bundle({ root });
      await removePhase698P1G2SyntheticRootForTest(root);
      return { run, validation, calls };
    };
    const semantic = await makeRun('semantic_mismatch');
    expect(semantic.calls).toBe(12);
    expect(semantic.run.report.laneTerminals[0]?.breakerOpened).toBe(false);
    expect(semantic.validation.ok).toBe(true);
    const transport = await makeRun('transport');
    expect(transport.calls).toBe(1);
    expect(transport.run.report.laneTerminals[0]?.breakerOpened).toBe(true);
    expect(transport.run.report.laneTerminals.at(-1)?.disposition).toBe(
      'not_started_quality_breaker',
    );
    expect(transport.validation.ok).toBe(true);
  });

  test('parent abort produces zero-wire suffixes and the exclusive marker rejects a second winner', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const admission = admitPhase698P1G2Source(createPhase698P1G2SyntheticSourceSnapshot());
    if (!admission.ok) throw new Error('source fixture did not admit');
    const root = await createPhase698P1G2SyntheticRootForTest();
    try {
      const first = await reservePhase698P1G2Attempt({
        root,
        runId: randomUUID(),
        source: admission.source,
      });
      await expect(
        reservePhase698P1G2Attempt({ root, runId: randomUUID(), source: admission.source }),
      ).rejects.toThrow();
      const controller = new AbortController();
      controller.abort();
      const run = await runPhase698P1G2({
        runId: first.runId,
        sourceAdmissionCapability: issuePhase698P1G2SourceAdmissionCapability(
          createPhase698P1G2SyntheticSourceSnapshot(),
        ),
        baselineBundle: baseline,
        harness: createPhase698P1G2DeterministicHarness(baseline),
        lifecycle: first.lifecycle,
        signal: controller.signal,
      });
      await first.publishArtifact(run.report);
      expect(run.report.execution.candidateInvocations).toBe(0);
      expect(run.report.laneTerminals.every((entry) => entry.wire.dispatch === 0)).toBe(true);
      expect((await validatePhase698P1G2Bundle({ root })).ok).toBe(true);
    } finally {
      await removePhase698P1G2SyntheticRootForTest(root);
    }
  });

  test('rejects tampered journal and crash-seals only a durable prefix without Provider calls', async () => {
    const baseline = await buildPhase698P1DeterministicSubsetBaseline();
    const admission = admitPhase698P1G2Source(createPhase698P1G2SyntheticSourceSnapshot());
    if (!admission.ok) throw new Error('source fixture did not admit');
    const root = await createPhase698P1G2SyntheticRootForTest();
    try {
      const reservation = await reservePhase698P1G2Attempt({
        root,
        runId: randomUUID(),
        source: admission.source,
      });
      for (const entry of baseline.report.guards) {
        await reservation.lifecycle.appendGuardTerminal({
          caseId: entry.caseId,
          observedReasonCode: entry.expectedReasonCode,
          strict: true,
          terminal: true,
          fakeSearchPortCalls: 0,
          providerCalls: 0,
          credentialReads: 0,
          failureCategory: 'none',
          breakerOpened: false,
        });
      }
      const lane = await reservation.lifecycle.reserveLane('rewrite_01', 1);
      await lane.appendStage('dispatch_started');
      const recovery = await recoverPhase698P1G2InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovery.ok).toBe(true);
      expect(await validatePhase698P1G2Bundle({ root })).toMatchObject({
        ok: true,
        providerCalls: 0,
      });
      const journal = (await readdir(join(root, '.tmp'))).find((entry) =>
        entry.endsWith('.journal.jsonl'),
      );
      if (!journal) throw new Error('journal missing');
      const journalPath = join(root, '.tmp', journal);
      const bytes = await readFile(journalPath, 'utf8');
      await Bun.write(
        journalPath,
        `${bytes.replace('attempt_reserved', 'attempt_reserved_tampered')}`,
      );
      expect((await validatePhase698P1G2Bundle({ root })).ok).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
