import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { reserveReviewPlannerControlledLiveEvidence } from './review-planner-controlled-live-eval-evidence';

describe('review planner controlled Live evidence', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-evidence-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reserves a parseable sanitized baseline before an attempt and finalizes it once', async () => {
    const reservation = await reserveReviewPlannerControlledLiveEvidence({
      root,
      startedAt: '2026-07-16T00:00:00.000Z',
      runId: 'test-run-1',
    });
    const evidencePath = join(root, reservation.relativePath);

    await expect(readFile(evidencePath, 'utf8')).resolves.toContain(
      '"state":"reserved"',
    );
    await expect(reservation.markAttempted()).resolves.toBe(true);
    await expect(
      reservation.finalize({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      }),
    ).resolves.toBe(true);

    const evidence = await readFile(evidencePath, 'utf8');
    expect(JSON.parse(evidence)).toEqual({
      schemaVersion: 'phase-6.9.5-review-planner-controlled-live-evidence-v1',
      state: 'finalized',
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
    });
    expect(evidence).not.toMatch(
      /prompt|api[_-]?key|authorization|cookie|stack/i,
    );
    await expect(
      reservation.finalize({
        status: 'complete',
        gate: 'open',
        providerAttemptCount: 2,
        usageKnown: true,
      }),
    ).resolves.toBe(false);
  });

  it('rejects collision and a concurrent discard never deletes finalized evidence', async () => {
    const input = {
      root,
      startedAt: '2026-07-16T00:00:00.000Z',
      runId: 'test-run-2',
    };
    const reservation = await reserveReviewPlannerControlledLiveEvidence(input);
    await expect(
      reserveReviewPlannerControlledLiveEvidence(input),
    ).rejects.toThrow();
    await reservation.markAttempted();

    const [finalized, discarded] = await Promise.all([
      reservation.finalize({
        status: 'complete',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: true,
      }),
      reservation.discard(),
    ]);

    expect(finalized).toBe(true);
    expect(discarded).toBe(false);
    await expect(
      readFile(join(root, reservation.relativePath), 'utf8'),
    ).resolves.toContain('"state":"finalized"');
  });

  it('rejects unsafe summaries without writing their raw diagnostic text', async () => {
    const reservation = await reserveReviewPlannerControlledLiveEvidence({
      root,
      startedAt: '2026-07-16T00:00:00.000Z',
      runId: 'test-run-3',
    });
    await reservation.markAttempted();

    await expect(
      reservation.finalize({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: 'RAW_PROMPT_CANARY' as never,
      }),
    ).resolves.toBe(false);

    await expect(
      readFile(join(root, reservation.relativePath), 'utf8'),
    ).resolves.not.toContain('RAW_PROMPT_CANARY');
  });
});
