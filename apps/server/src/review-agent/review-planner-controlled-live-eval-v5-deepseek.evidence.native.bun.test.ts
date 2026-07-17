import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE,
  reserveReviewPlannerControlledLiveV5DeepSeekEvidence,
  snapshotReviewPlannerControlledLiveV5HistoricalEvidence,
  verifyReviewPlannerControlledLiveV5HistoricalEvidence,
} from './review-planner-controlled-live-eval-v5-deepseek.evidence';

const describeNativeWindows =
  process.platform === 'win32' && Boolean(process.versions.bun)
    ? describe
    : describe.skip;

const historicalDirectories = [
  'docs/acceptance/evidence/phase-6-9-5-controlled-live',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
] as const;

describeNativeWindows(
  'Review/Planner controlled Live V5 DeepSeek native evidence',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v5-native-'));
      await copyHistoricalEvidenceTrees(root);
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('reserves and finalizes only an isolated V5 handle-relative record', async () => {
      const reservation =
        await reserveReviewPlannerControlledLiveV5DeepSeekEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v5-native-isolated-run',
        });

      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(reservation.finalize(completeSummary())).resolves.toBe(true);

      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"currency":"CNY"');
      expect(evidence).not.toContain('RAW_V5_PRIVATE_CANARY');
      await expect(
        readdir(
          join(
            root,
            REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceDirectory,
          ),
        ),
      ).resolves.toHaveLength(2);
    });

    it('preserves V1--V4 full trees and markers byte-hash identically across a V5 lifecycle', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV5HistoricalEvidence(root);
      const reservation =
        await reserveReviewPlannerControlledLiveV5DeepSeekEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v5-native-historical-isolation',
        });
      await reservation.markAttempted();
      await reservation.finalize(completeSummary());

      await expect(
        verifyReviewPlannerControlledLiveV5HistoricalEvidence({
          root,
          snapshot,
        }),
      ).resolves.toEqual(snapshot);
    });

    it('fails closed when a historical file changes or a file is added after its snapshot', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV5HistoricalEvidence(root);
      await writeFile(
        join(
          root,
          historicalDirectories[0],
          '.review-planner-controlled-live.once',
        ),
        'changed-history\n',
      );
      await expect(
        verifyReviewPlannerControlledLiveV5HistoricalEvidence({
          root,
          snapshot,
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');

      await copyHistoricalEvidenceTrees(root);
      const cleanSnapshot =
        await snapshotReviewPlannerControlledLiveV5HistoricalEvidence(root);
      await writeFile(
        join(root, historicalDirectories[1], 'added.json'),
        '{}\n',
      );
      await expect(
        verifyReviewPlannerControlledLiveV5HistoricalEvidence({
          root,
          snapshot: cleanSnapshot,
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');
    });

    it('fails closed when a historical tree contains a reparse point', async () => {
      const external = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-v5-outside-'),
      );
      const reparseLeaf = join(root, historicalDirectories[3], 'reparse-leaf');
      try {
        await symlink(external, reparseLeaf, 'junction');
        await expect(
          snapshotReviewPlannerControlledLiveV5HistoricalEvidence(root),
        ).rejects.toThrow('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');
      } finally {
        await rm(external, { recursive: true, force: true });
      }
    });

    it('does not recreate a missing historical directory while rejecting the snapshot', async () => {
      const missingRelativeDirectory = historicalDirectories[2];
      const missingDirectory = join(root, missingRelativeDirectory);
      const parentDirectory = join(root, 'docs/acceptance/evidence');
      await rm(missingDirectory, { recursive: true, force: true });

      await expect(
        snapshotReviewPlannerControlledLiveV5HistoricalEvidence(root),
      ).rejects.toThrow('CONTROLLED_LIVE_V5_HISTORICAL_INTEGRITY_FAILED');
      await expect(readdir(parentDirectory)).resolves.not.toContain(
        'phase-6-9-5-controlled-live-v3',
      );
    });

    it('fails closed without a second V5 write when its consumed marker already exists', async () => {
      const v5Directory = join(
        root,
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.evidenceDirectory,
      );
      await mkdir(v5Directory, { recursive: true });
      await writeFile(
        join(
          v5Directory,
          REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.onceLockLeaf,
        ),
        'already-consumed\n',
      );

      await expect(
        reserveReviewPlannerControlledLiveV5DeepSeekEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v5-native-marker-conflict',
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_V5_EVIDENCE_ALREADY_CONSUMED');
      await expect(readdir(v5Directory)).resolves.toEqual([
        REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE.onceLockLeaf,
      ]);
    });
  },
);

function completeSummary() {
  return {
    status: 'complete' as const,
    gate: 'open' as const,
    providerAttemptCount: 23,
    usageKnown: true,
    priceProfileId: REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PRICE_PROFILE_ID,
    currency: 'CNY' as const,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    hardCapCny: 1,
    withinHardCap: true,
    quality: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 22,
      qualityPasses: 22,
      criticalFailures: 0,
      p95DurationMs: 4_500,
      productionDecision: 'quality_gate_passed' as const,
    },
  };
}

async function copyHistoricalEvidenceTrees(root: string) {
  const moduleDirectory: unknown = import.meta.dir;
  if (typeof moduleDirectory !== 'string') {
    throw new Error('NATIVE_TEST_MODULE_DIRECTORY_UNAVAILABLE');
  }
  const sourceRoot = resolve(moduleDirectory, '../../../..');
  await Promise.all(
    historicalDirectories.map((directory) =>
      cp(join(sourceRoot, directory), join(root, directory), {
        recursive: true,
        force: true,
      }),
    ),
  );
}
