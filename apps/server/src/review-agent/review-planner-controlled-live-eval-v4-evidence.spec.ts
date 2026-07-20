import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  CONTROLLED_LIVE_V4_PROFILE,
  reserveReviewPlannerControlledLiveV4Evidence,
  safeReviewPlannerControlledLiveV4SummarySchema,
} from './review-planner-controlled-live-eval-v4-evidence';

const hasTrustedWindowsDirectoryHandle =
  process.platform === 'win32' && Boolean(process.versions.bun);

describe('review planner controlled Live v4 evidence', () => {
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

  it('fails closed with no writes when the trusted Windows directory-handle boundary is unavailable', async () => {
    if (hasTrustedWindowsDirectoryHandle) return;

    await expect(
      reserveReviewPlannerControlledLiveV4Evidence({
        root,
        startedAt: '2026-07-17T00:00:00.000Z',
        runId: 'v4-no-dirfd-test-run',
      }),
    ).rejects.toThrow('CONTROLLED_LIVE_V4_EVIDENCE_TRUSTED_HANDLE_REQUIRED');
    await expect(readdir(root)).resolves.toEqual([]);
  });
});
