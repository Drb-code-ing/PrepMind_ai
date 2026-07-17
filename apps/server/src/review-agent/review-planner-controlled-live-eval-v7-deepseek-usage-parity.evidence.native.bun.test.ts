import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE,
  finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
  verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';
import type {
  ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
  SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
} from './review-planner-controlled-live-eval-v7-deepseek-usage-parity.evidence';

const describeNativeWindows =
  process.platform === 'win32' && Boolean(process.versions.bun)
    ? describe
    : describe.skip;

const historicalDirectories = [
  'docs/acceptance/evidence/phase-6-9-5-controlled-live',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
] as const;

describeNativeWindows(
  'Review/Planner controlled Live V7 native evidence',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v7-native-'));
      await copyHistoricalEvidenceTrees(root);
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('pins V1--V6 bytes and verifies the copied immutable snapshot', async () => {
      const snapshot = await snapshotHistory(root);
      expect(snapshot.schemaVersion).toBe(
        'phase-6.9.5-review-planner-historical-integrity-v3',
      );
      const markerEntry = snapshot.entries.find((entry) =>
        entry.relativePath.endsWith(
          '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
        ),
      );
      const jsonEntry = snapshot.entries.find((entry) =>
        entry.relativePath.endsWith(
          'review-planner-live-20260717T111332841Z-9d02337a8c85.json',
        ),
      );
      expect(markerEntry?.sha256).toBe(
        'ac04ea11c4e416e44bd870c158a6bff0d65db297262ab6610790cf355525ec31',
      );
      expect(jsonEntry?.sha256).toBe(
        '4fb435824785af4b2601b83787b22a4b98de1ac47d222f2566e351960bfd1afb',
      );
      await expect(verify(root, snapshot)).resolves.toEqual(snapshot);
    });

    it('rejects changed V6 bytes and a historical reparse entry', async () => {
      const snapshot = await snapshotHistory(root);
      const v6Marker = join(
        root,
        historicalDirectories[5],
        '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
      );
      await writeFile(v6Marker, 'changed\n');
      await expect(verify(root, snapshot)).rejects.toThrow(
        'CONTROLLED_LIVE_V7_USAGE_PARITY_HISTORICAL_INTEGRITY_FAILED',
      );

      await rm(root, { recursive: true, force: true });
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v7-native-'));
      await copyHistoricalEvidenceTrees(root);
      const external = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-v7-outside-'),
      );
      try {
        await symlink(
          external,
          join(root, historicalDirectories[5], 'reparse'),
          'junction',
        );
        await expect(snapshotHistory(root)).rejects.toThrow(
          'CONTROLLED_LIVE_V7_USAGE_PARITY_HISTORICAL_INTEGRITY_FAILED',
        );
      } finally {
        await rm(external, { recursive: true, force: true });
      }
    });

    it('allows only one concurrent reservation and preserves winner bytes', async () => {
      const snapshot = await snapshotHistory(root);
      const attempts = await Promise.allSettled([
        reserve(root, snapshot, 'winner-a'),
        reserve(root, snapshot, 'winner-b'),
      ]);
      expect(
        attempts.filter((item) => item.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((item) => item.status === 'rejected'),
      ).toHaveLength(1);
      const winner = attempts.find((item) => item.status === 'fulfilled');
      if (!winner || winner.status !== 'fulfilled')
        throw new Error('missing winner');
      const before = await readFile(join(root, winner.value.relativePath));
      await expect(reserve(root, snapshot, 'late-loser')).rejects.toThrow(
        'CONTROLLED_LIVE_V7_USAGE_PARITY_EVIDENCE_ALREADY_CONSUMED',
      );
      await expect(
        readFile(join(root, winner.value.relativePath)),
      ).resolves.toEqual(before);
    });

    it('rechecks V1--V6 inside markAttempted and preserves reserved bytes on drift', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'mark-history-drift');
      const before = await readFile(join(root, reservation.relativePath));
      await writeFile(
        join(
          root,
          historicalDirectories[5],
          '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
        ),
        'changed-after-reservation\n',
      );

      await expect(reservation.markAttempted()).resolves.toBe(false);
      await expect(
        readFile(join(root, reservation.relativePath)),
      ).resolves.toEqual(before);
    });

    it('rejects forged finalizers without overwriting and seals finalized bytes', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'finalized-immutable');
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const attempted = await readFile(join(root, reservation.relativePath));
      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation: { ...reservation },
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      await expect(
        readFile(join(root, reservation.relativePath)),
      ).resolves.toEqual(attempted);

      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(true);
      const finalized = await readFile(join(root, reservation.relativePath));
      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      await expect(
        readFile(join(root, reservation.relativePath)),
      ).resolves.toEqual(finalized);
    });

    it('rejects lifecycle skips and attempted-to-blocked downgrades without rewriting bytes', async () => {
      const snapshot = await snapshotHistory(root);
      const reserved = await reserve(root, snapshot, 'lifecycle-reserved');
      const reservedBytes = await readFile(join(root, reserved.relativePath));
      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation: reserved,
          summary: {
            status: 'invalid_attempted',
            gate: 'closed',
            providerAttemptCount: 0,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          },
        }),
      ).resolves.toBe(false);
      await expect(
        readFile(join(root, reserved.relativePath)),
      ).resolves.toEqual(reservedBytes);

      await expect(reserved.markAttempted()).resolves.toBe(true);
      const attemptedBytes = await readFile(join(root, reserved.relativePath));
      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation: reserved,
          summary: {
            status: 'diagnostic_blocked',
            gate: 'closed',
            providerAttemptCount: 0,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
          },
        }),
      ).resolves.toBe(false);
      await expect(
        readFile(join(root, reserved.relativePath)),
      ).resolves.toEqual(attemptedBytes);
    });

    it('cannot verify a different root while finalizing the bound reservation root', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'cross-root-finalizer');
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const secondRoot = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-v7-second-root-'),
      );
      try {
        await copyHistoricalEvidenceTrees(secondRoot);
        const secondSnapshot = await snapshotHistory(secondRoot);
        await writeFile(
          join(
            root,
            historicalDirectories[5],
            '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
          ),
          'changed-before-cross-root-finalize\n',
        );

        const forgedInput = {
          root: secondRoot,
          historicalSnapshot: secondSnapshot,
          reservation,
          summary: completeSummary(),
        } as Parameters<
          typeof finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence
        >[0];
        await expect(
          finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence(
            forgedInput,
          ),
        ).resolves.toBe(false);
      } finally {
        await rm(secondRoot, { recursive: true, force: true });
      }
    });

    it('uses an immutable canonical summary across asynchronous finalization', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'mutable-summary');
      const mutableSummary: Record<string, unknown> = {
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
      const finalization =
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation,
          summary:
            mutableSummary as SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
        });
      for (const key of Object.keys(mutableSummary)) delete mutableSummary[key];
      Object.assign(mutableSummary, completeSummary());

      await expect(finalization).resolves.toBe(true);
      const stored = JSON.parse(
        await readFile(join(root, reservation.relativePath), 'utf8'),
      ) as Record<string, unknown>;
      expect(stored.status).toBe('diagnostic_blocked');
      expect(stored).not.toHaveProperty('aggregateInputTokens');
    });

    it('binds a fresh immutable historical baseline instead of a mutable caller snapshot', async () => {
      const initial = await snapshotHistory(root);
      const mutableSnapshot = JSON.parse(JSON.stringify(initial)) as {
        schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v3';
        treeHash: string;
        entries: Array<{
          relativePath: string;
          type: 'directory' | 'file';
          sha256: string;
          byteLength: number;
        }>;
      };
      const reservation = await reserve(
        root,
        mutableSnapshot,
        'mutable-snapshot',
      );
      await writeFile(
        join(
          root,
          historicalDirectories[0],
          '.review-planner-controlled-live.once',
        ),
        'changed-v1-marker\n',
      );
      const changed = await snapshotHistory(root);
      mutableSnapshot.treeHash = changed.treeHash;
      mutableSnapshot.entries = changed.entries.map((entry) => ({ ...entry }));

      await expect(reservation.markAttempted()).resolves.toBe(false);
    });
  },
);

function snapshotHistory(root: string) {
  return snapshotReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
    root,
  );
}

function verify(
  root: string,
  snapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
) {
  return verifyReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidence(
    {
      root,
      snapshot,
    },
  );
}

function reserve(
  root: string,
  historicalSnapshot: ReviewPlannerControlledLiveV7DeepSeekUsageParityHistoricalEvidenceSnapshot,
  runId: string,
) {
  return reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
    root,
    startedAt: '2026-07-17T12:00:00.000Z',
    runId,
    historicalSnapshot,
  });
}

function completeSummary() {
  return {
    status: 'complete' as const,
    gate: 'eligible_for_separate_product_acceptance' as const,
    providerAttemptCount: 23,
    usageKnown: true as const,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
    caseEntries: 48,
    zeroCallCases: 26,
    runtimeInvocations: 22,
    strictSuccesses: 48,
    qualityPasses: 48,
    criticalFailures: 0,
  } satisfies SafeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary;
}

async function copyHistoricalEvidenceTrees(root: string) {
  const sourceRoot = resolve(process.cwd());
  await Promise.all(
    historicalDirectories.map((directory) =>
      cp(join(sourceRoot, directory), join(root, directory), {
        recursive: true,
        force: true,
      }),
    ),
  );
  expect(
    join(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceDirectory,
    ),
  ).not.toBe('');
}
