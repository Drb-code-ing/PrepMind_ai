import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { reserveReviewPlannerControlledLiveV4Evidence } from './review-planner-controlled-live-eval-v4-evidence';

const describeNativeWindows =
  process.platform === 'win32' && Boolean(process.versions.bun)
    ? describe
    : describe.skip;

describeNativeWindows(
  'review planner controlled Live v4 native evidence',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v4-native-'));
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('reserves and finalizes only a v4 handle-relative evidence record', async () => {
      const reservation = await reserveReviewPlannerControlledLiveV4Evidence({
        root,
        startedAt: '2026-07-17T00:00:00.000Z',
        runId: 'v4-native-isolated-run',
      });
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(
        reservation.finalize({
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
          structuredOutputStage: 'provider_type_validation',
        }),
      ).resolves.toBe(true);

      await expect(
        readFile(join(root, reservation.relativePath), 'utf8'),
      ).resolves.toContain(
        '"structuredOutputStage":"provider_type_validation"',
      );
      await expect(
        readdir(
          join(
            root,
            'docs',
            'acceptance',
            'evidence',
            'phase-6-9-5-controlled-live-v4',
          ),
        ),
      ).resolves.toHaveLength(2);
    });
  },
);
