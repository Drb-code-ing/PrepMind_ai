import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES,
  runPhase698TransportEvidenceT2Static,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2.ts';
import {
  isPhase698TransportEvidenceT2WritableRelativePathForTest,
  phase698TransportEvidenceT2ArtifactRelativePath,
  phase698TransportEvidenceT2JournalRelativePath,
  phase698TransportEvidenceT2MarkerRelativePath,
  recoverPhase698TransportEvidenceT2InterruptedAttemptForTest,
  reservePhase698TransportEvidenceT2Attempt,
  validatePhase698TransportEvidenceT2Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2-durability.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.8 Transport Evidence Recovery T2 zero-provider robustness', () => {
  test('runs the immutable 30-case matrix and keeps every boundary bounded', () => {
    expect(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST).toHaveLength(30);
    expect(
      new Set(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CASE_MANIFEST.map((item) => item.caseId)).size,
    ).toBe(30);

    const report = runPhase698TransportEvidenceT2Static();

    expect(report).toMatchObject({
      passed: true,
      caseCount: 30,
      passedCases: 30,
      classifierCount: 15,
      passedClassifiers: 15,
      syntheticCalls: 30,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      productWrites: 0,
      rawDataRetained: false,
    });
    expect(report.cases.every((item) => item.passed && item.rawDataRetained === false)).toBe(true);
    expect(report.cases.filter((item) => item.kind === 'capability')).toHaveLength(3);
    expect(report.cases.find((item) => item.caseId === 'capability-cross-family')).toMatchObject({
      passed: true,
      disposition: 'rejected',
      failureCode: 'capability_cross_family',
      diagnostic: null,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('provider response');
    expect(serialized).not.toContain('T2_FETCH_MUST_NOT_RUN');
    expect(serialized).not.toContain('sk-');
  });

  test('keeps classifier subtypes bounded and unknown honest without expanding the runtime denominator', () => {
    expect(PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_CLASSIFIER_FIXTURES).toHaveLength(15);
    const report = runPhase698TransportEvidenceT2Static();
    const unknown = report.classifiers.find((item) => item.fixtureId === 'unknown');

    expect(report.syntheticCalls).toBe(30);
    expect(report.classifiers.every((item) => item.accepted)).toBe(true);
    expect(unknown?.diagnostic).toMatchObject({
      reasonCode: 'unknown',
      providerBoundary: 'unknown',
      rawDataRetained: false,
    });
  });

  test('honors a parent abort before the matrix without invoking a provider-shaped seam', () => {
    const controller = new AbortController();
    controller.abort();
    const report = runPhase698TransportEvidenceT2Static({ signal: controller.signal });

    expect(report).toMatchObject({
      passed: false,
      passedCases: 0,
      passedClassifiers: 0,
      syntheticCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
    });
    expect(report.cases.every((item) => item.failureCode === 'abort_before_start')).toBe(true);
  });

  test('does not touch global fetch while running the full synthetic matrix', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('T2_FETCH_MUST_NOT_RUN');
    }) as typeof fetch;
    try {
      expect(runPhase698TransportEvidenceT2Static().passed).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(fetchCalls).toBe(0);
  });
});

describe('Phase 6.9.8 Transport Evidence Recovery T2 synthetic durability', () => {
  test('serializes concurrent case terminals, publishes a hard-linked artifact, and validates it', async () => {
    const root = await tempRoot();
    const report = runPhase698TransportEvidenceT2Static();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });

    await Promise.all(report.cases.map((result) => reservation.appendCaseTerminal(result)));
    await reservation.appendRunTerminal(report);
    const published = await reservation.publishArtifact(report);
    const validation = await validatePhase698TransportEvidenceT2Bundle({ root });

    expect(validation).toMatchObject({
      ok: true,
      runId: reservation.runId,
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
      physicalArtifactSha256: published.evidenceSha256,
      journalRecords: 34,
    });
    expect(
      await readFile(
        join(root, phase698TransportEvidenceT2ArtifactRelativePath(reservation.runId)),
        'utf8',
      ),
    ).toContain('transport_evidence_t2_zero_provider_passed');
    await expect(reservation.appendCaseTerminal(report.cases[0]!)).rejects.toThrow(
      'PHASE_6_9_8_TRANSPORT_EVIDENCE_T2_DUPLICATE_CASE',
    );
  });

  test('rejects a tampered hash-chain tail and keeps the formal root bounded', async () => {
    const root = await tempRoot();
    const report = runPhase698TransportEvidenceT2Static();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });
    for (const result of report.cases) await reservation.appendCaseTerminal(result);
    await reservation.appendRunTerminal(report);
    await reservation.publishArtifact(report);

    const journalPath = join(
      root,
      phase698TransportEvidenceT2JournalRelativePath(reservation.runId),
    );
    await writeFile(journalPath, `${await readFile(journalPath, 'utf8')}{}\n`);

    expect((await validatePhase698TransportEvidenceT2Bundle({ root })).ok).toBe(false);
    expect(isPhase698TransportEvidenceT2WritableRelativePathForTest('../escape.json')).toBe(false);
    expect(
      isPhase698TransportEvidenceT2WritableRelativePathForTest('.tmp/phase-6-9-7-foreign.marker'),
    ).toBe(false);
    expect(
      isPhase698TransportEvidenceT2WritableRelativePathForTest(
        phase698TransportEvidenceT2JournalRelativePath(reservation.runId),
      ),
    ).toBe(true);
  });

  test('crash-only recovery seals a reserved synthetic attempt without provider calls', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });

    const recovered = await recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    const validation = await validatePhase698TransportEvidenceT2Bundle({ root });

    expect(recovered).toMatchObject({
      ok: true,
      runId: reservation.runId,
      disposition: 'crash_only_sealed',
    });
    expect(validation).toMatchObject({ ok: true, qualityAuthority: 'none', journalRecords: 35 });
    const artifact = JSON.parse(
      await readFile(
        join(root, phase698TransportEvidenceT2ArtifactRelativePath(reservation.runId)),
        'utf8',
      ),
    ) as { durability: { publicationMode: string }; report: { providerCalls: number } };
    expect(artifact.durability.publicationMode).toBe('recovery');
    expect(artifact.report.providerCalls).toBe(0);
    expect(
      await readFile(
        join(
          root,
          '.tmp',
          `phase-6-9-8-retriever-final-response-transport-evidence-t2-${reservation.runId}.report.json`,
        ),
        'utf8',
      ),
    ).toContain('transport_evidence_t2_zero_provider_passed');
    await expect(
      recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      }),
    ).resolves.toEqual({ ok: false, code: 'already_published' });
  });

  test('recovers a complete terminal prefix before publication and rejects active processes', async () => {
    const root = await tempRoot();
    const report = runPhase698TransportEvidenceT2Static();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });
    for (const result of report.cases) await reservation.appendCaseTerminal(result);
    await reservation.appendRunTerminal(report);

    expect(
      await recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
        root,
        isProcessAlive: () => true,
      }),
    ).toEqual({ ok: false, code: 'process_active' });
    const recovered = await recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    expect(recovered).toMatchObject({
      ok: true,
      runId: reservation.runId,
      disposition: 'terminal_publication_recovered',
    });
    expect((await validatePhase698TransportEvidenceT2Bundle({ root })).ok).toBe(true);
  });

  test('reconciles a partial terminal prefix without duplicate case records', async () => {
    const root = await tempRoot();
    const report = runPhase698TransportEvidenceT2Static();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });
    for (const result of report.cases.slice(0, 5)) await reservation.appendCaseTerminal(result);

    const recovered = await recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    expect(recovered).toMatchObject({ ok: true, disposition: 'crash_only_sealed' });
    expect(await validatePhase698TransportEvidenceT2Bundle({ root })).toMatchObject({
      ok: true,
      journalRecords: 35,
    });
  });

  test('completes publication when the artifact exists but evidence publication was interrupted', async () => {
    const root = await tempRoot();
    const report = runPhase698TransportEvidenceT2Static();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });
    for (const result of report.cases) await reservation.appendCaseTerminal(result);
    await reservation.appendRunTerminal(report);
    await reservation.publishArtifact(report);

    const journalPath = join(
      root,
      phase698TransportEvidenceT2JournalRelativePath(reservation.runId),
    );
    const journalLines = (await readFile(journalPath, 'utf8')).trimEnd().split('\n');
    await writeFile(journalPath, `${journalLines.slice(0, -1).join('\n')}\n`);

    await expect(
      recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      }),
    ).resolves.toMatchObject({
      ok: true,
      disposition: 'terminal_publication_recovered',
    });
    expect((await validatePhase698TransportEvidenceT2Bundle({ root })).ok).toBe(true);
  });

  test('rejects multiple synthetic markers instead of selecting one arbitrarily', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase698TransportEvidenceT2Attempt({ root });
    const markerPath = join(root, phase698TransportEvidenceT2MarkerRelativePath(reservation.runId));
    const markerBytes = await readFile(markerPath, 'utf8');
    const secondMarker = phase698TransportEvidenceT2MarkerRelativePath(randomUUID());
    await writeFile(join(root, secondMarker), markerBytes);

    expect((await validatePhase698TransportEvidenceT2Bundle({ root })).ok).toBe(false);
    await expect(
      recoverPhase698TransportEvidenceT2InterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      }),
    ).resolves.toEqual({ ok: false, code: 'marker_missing_or_invalid' });
  });
});

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'phase-698-transport-evidence-t2-'));
  roots.push(root);
  return root;
}
