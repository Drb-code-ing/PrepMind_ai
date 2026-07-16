import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  CONTROLLED_LIVE_V4_PROFILE,
  reserveReviewPlannerControlledLiveV4Evidence,
  safeReviewPlannerControlledLiveV4SummarySchema,
} from './review-planner-controlled-live-eval-v4-evidence';

const describeNodeEvidence =
  process.platform === 'win32' ? describe.skip : describe;

describeNodeEvidence('review planner controlled Live v4 evidence', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v4-evidence-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('has an independent v4 profile and permits the fixed stage only for the closed attempted tuple', () => {
    const summary = {
      status: 'invalid_attempted' as const,
      gate: 'closed' as const,
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_json_parse' as const,
    };

    expect(CONTROLLED_LIVE_V4_PROFILE).toEqual({
      id: 'phase-6.9.5-review-planner-controlled-live-v4',
      evidenceSchemaVersion:
        'phase-6.9.5-review-planner-controlled-live-evidence-v4',
      evidenceDirectory:
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
      onceLockLeaf: '.review-planner-controlled-live-v4.once',
    });
    expect(
      safeReviewPlannerControlledLiveV4SummarySchema.parse(summary),
    ).toEqual(summary);
    expect(() =>
      safeReviewPlannerControlledLiveV4SummarySchema.parse({
        ...summary,
        status: 'complete',
      }),
    ).toThrow();
  });

  it('reserves only the v4 lineage, preserving historical v1-v3 sentinels byte-for-byte', async () => {
    const historicalFiles = [
      'docs/acceptance/evidence/phase-6-9-5-controlled-live/v1.json',
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/v2.json',
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/v3.json',
      '.review-planner-controlled-live.once',
      '.review-planner-controlled-live-v2.once',
      '.review-planner-controlled-live-v3.once',
    ];
    await Promise.all(
      historicalFiles.map(async (relativePath) => {
        const path = join(root, relativePath);
        const parent = path.slice(
          0,
          Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')),
        );
        await mkdir(parent, { recursive: true });
        await writeFile(path, `historical:${relativePath}`, 'utf8');
      }),
    );
    const before = await Promise.all(
      historicalFiles.map((relativePath) =>
        readFile(join(root, relativePath), 'utf8'),
      ),
    );

    const reservation = await reserveReviewPlannerControlledLiveV4Evidence({
      root,
      startedAt: '2026-07-17T00:00:00.000Z',
      runId: 'v4-independent-test-run',
    });
    await expect(reservation.markAttempted()).resolves.toBe(true);
    await expect(
      reservation.finalize({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
        structuredOutputStage: 'provider_object_missing',
      }),
    ).resolves.toBe(true);

    await expect(
      readFile(join(root, reservation.relativePath), 'utf8'),
    ).resolves.toContain(
      'phase-6.9.5-review-planner-controlled-live-evidence-v4',
    );
    await expect(
      Promise.all(
        historicalFiles.map((relativePath) =>
          readFile(join(root, relativePath), 'utf8'),
        ),
      ),
    ).resolves.toEqual(before);
  });
});
