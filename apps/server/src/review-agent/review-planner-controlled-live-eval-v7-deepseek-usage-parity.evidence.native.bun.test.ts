import { watch } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  chmod,
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE,
  finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  readReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  reserveReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence,
  safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema,
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

    it('never treats standalone persisted complete bytes as committed success', () => {
      const standaloneComplete = {
        schemaVersion:
          REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.evidenceSchemaVersion,
        state: 'finalized',
        ...completeSummary(),
      };

      expect(
        safeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidenceSchema.safeParse(
          standaloneComplete,
        ).success,
      ).toBe(false);
    });

    it('projects success only through the strict hash-bound commit marker', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'sealed-reader');
      expect(Object.keys(reservation).sort()).toEqual([
        'markAttempted',
        'relativePath',
      ]);
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(true);

      const evidencePath = join(root, reservation.relativePath);
      const directoryPath = dirname(evidencePath);
      const markerPath = join(
        directoryPath,
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.successCommitLeaf,
      );
      const oncePath = join(
        directoryPath,
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.onceLockLeaf,
      );
      const candidateBytes = await readFile(evidencePath);
      const markerBytes = await readFile(markerPath, 'utf8');
      const onceBytes = await readFile(oncePath, 'utf8');
      const marker = JSON.parse(markerBytes) as Record<string, unknown>;

      expect(JSON.parse(candidateBytes.toString('utf8'))).toMatchObject({
        state: 'success_candidate',
        status: 'complete',
      });
      expect(Object.keys(marker).sort()).toEqual([
        'candidateSha256',
        'commitNonce',
        'evidenceLeaf',
        'historicalTreeHash',
        'schemaVersion',
      ]);
      expect(marker.evidenceLeaf).toBe(evidencePath.split('\\').at(-1));
      expect(marker.candidateSha256).toBe(
        createHash('sha256').update(candidateBytes).digest('hex'),
      );
      expect(marker.historicalTreeHash).toBe(snapshot.treeHash);
      expect(marker).not.toHaveProperty('aggregateInputTokens');
      expect(marker).not.toHaveProperty('observedCostCny');
      await expect(
        readEvidence(root, reservation.relativePath),
      ).resolves.toMatchObject({ state: 'finalized', status: 'complete' });

      for (const invalidMarker of [
        'not-json\n',
        `${JSON.stringify({ ...marker, candidateSha256: '0'.repeat(64) })}\n`,
        `${JSON.stringify({ ...marker, evidenceLeaf: 'wrong.json' })}\n`,
        `${JSON.stringify({ ...marker, historicalTreeHash: '0'.repeat(64) })}\n`,
        `${JSON.stringify({ ...marker, commitNonce: '0'.repeat(64) })}\n`,
        `${JSON.stringify({ ...marker, unknown: true })}\n`,
      ]) {
        await writeFile(markerPath, invalidMarker);
        expectEvidenceIo(await readEvidence(root, reservation.relativePath));
      }

      await rm(markerPath);
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));

      await writeFile(markerPath, markerBytes);
      await writeFile(oncePath, 'wrong-consumed-marker\n');
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));
      await writeFile(oncePath, onceBytes);

      await writeFile(evidencePath, `${candidateBytes.toString('utf8')} `);
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));
      const nonStrictCandidate = Buffer.from(
        `${JSON.stringify({
          ...(JSON.parse(candidateBytes.toString('utf8')) as Record<
            string,
            unknown
          >),
          unknown: true,
        })}\n`,
      );
      await writeFile(evidencePath, nonStrictCandidate);
      await writeFile(
        markerPath,
        `${JSON.stringify({
          ...marker,
          candidateSha256: createHash('sha256')
            .update(nonStrictCandidate)
            .digest('hex'),
        })}\n`,
      );
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));
      await writeFile(evidencePath, candidateBytes);
      await writeFile(markerPath, markerBytes);

      await writeFile(
        join(
          root,
          historicalDirectories[0],
          '.review-planner-controlled-live.once',
        ),
        'changed-after-success-marker\n',
      );
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));

      await rm(evidencePath);
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));
    });

    it('fails closed when exclusive success marker creation fails', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'marker-create-fails');
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const markerPath = join(
        dirname(join(root, reservation.relativePath)),
        REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.successCommitLeaf,
      );
      await writeFile(markerPath, 'preexisting-invalid-marker\n');

      await expect(
        finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      expect(
        JSON.parse(
          await readFile(join(root, reservation.relativePath), 'utf8'),
        ),
      ).toMatchObject({ state: 'success_candidate', status: 'complete' });
      expectEvidenceIo(await readEvidence(root, reservation.relativePath));
    });

    it('downgrades a terminal success when V1--V6 drift after replacement', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(
        root,
        snapshot,
        'post-terminal-history-drift',
      );
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const evidencePath = join(root, reservation.relativePath);
      const v6MarkerPath = join(
        root,
        historicalDirectories[5],
        '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
      );
      let mutationStarted = false;
      let resolveMutation!: () => void;
      const mutationObserved = new Promise<void>((resolveMutationPromise) => {
        resolveMutation = resolveMutationPromise;
      });
      const watcher = watch(dirname(evidencePath), (_event, leaf) => {
        if (
          mutationStarted ||
          leaf?.toString() !== evidencePath.split('\\').at(-1)
        ) {
          return;
        }
        void (async () => {
          try {
            const record = JSON.parse(
              await readFile(evidencePath, 'utf8'),
            ) as Record<string, unknown>;
            if (record.status !== 'complete') return;
            mutationStarted = true;
            await writeFile(v6MarkerPath, 'changed-after-terminal-write\n');
            resolveMutation();
          } catch {
            // Replacement events can arrive before the destination is readable.
          }
        })();
      });

      try {
        const finalized =
          finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
            reservation,
            summary: completeSummary(),
          });
        await Promise.race([
          mutationObserved,
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error('terminal mutation was not observed')),
              2_000,
            ),
          ),
        ]);
        await expect(finalized).resolves.toBe(false);
        const stored = JSON.parse(
          await readFile(evidencePath, 'utf8'),
        ) as Record<string, unknown>;
        expect(stored).toMatchObject({
          state: 'finalized',
          status: 'invalid_attempted',
          gate: 'closed',
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
        });
        expect(stored).not.toHaveProperty('aggregateInputTokens');
        expect(stored).not.toHaveProperty('observedCostCny');
        await expect(
          readFile(
            join(
              dirname(evidencePath),
              REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.successCommitLeaf,
            ),
          ),
        ).rejects.toThrow();
      } finally {
        watcher.close();
      }
    });

    it('keeps an uncommitted candidate fail-closed when the drift downgrade write fails', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(
        root,
        snapshot,
        'downgrade-write-fails',
      );
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const evidencePath = join(root, reservation.relativePath);
      const v6MarkerPath = join(
        root,
        historicalDirectories[5],
        '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
      );
      let mutationStarted = false;
      let resolveMutation!: () => void;
      const mutationObserved = new Promise<void>((resolveMutationPromise) => {
        resolveMutation = resolveMutationPromise;
      });
      const watcher = watch(dirname(evidencePath), (_event, leaf) => {
        if (
          mutationStarted ||
          leaf?.toString() !== evidencePath.split('\\').at(-1)
        ) {
          return;
        }
        void (async () => {
          try {
            const record = JSON.parse(
              await readFile(evidencePath, 'utf8'),
            ) as Record<string, unknown>;
            if (record.state !== 'success_candidate') return;
            mutationStarted = true;
            await chmod(evidencePath, 0o444);
            await writeFile(v6MarkerPath, 'changed-before-downgrade\n');
            resolveMutation();
          } catch {
            // Replacement events can arrive before the destination is readable.
          }
        })();
      });

      try {
        const finalized =
          finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
            reservation,
            summary: completeSummary(),
          });
        await Promise.race([
          mutationObserved,
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error('candidate mutation was not observed')),
              2_000,
            ),
          ),
        ]);
        await expect(finalized).resolves.toBe(false);
        expect(JSON.parse(await readFile(evidencePath, 'utf8'))).toMatchObject({
          state: 'success_candidate',
          status: 'complete',
        });
        expectEvidenceIo(await readEvidence(root, reservation.relativePath));
        await expect(
          readFile(
            join(
              dirname(evidencePath),
              REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE.successCommitLeaf,
            ),
          ),
        ).rejects.toThrow();
      } finally {
        watcher.close();
        await chmod(evidencePath, 0o666).catch(() => undefined);
      }
    });

    it('never applies the success downgrade transition to a finalized failure', async () => {
      const snapshot = await snapshotHistory(root);
      const reservation = await reserve(root, snapshot, 'failure-no-downgrade');
      await expect(reservation.markAttempted()).resolves.toBe(true);
      const evidencePath = join(root, reservation.relativePath);
      const v6MarkerPath = join(
        root,
        historicalDirectories[5],
        '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once',
      );
      let mutationStarted = false;
      let resolveMutation!: () => void;
      const mutationObserved = new Promise<void>((resolveMutationPromise) => {
        resolveMutation = resolveMutationPromise;
      });
      const watcher = watch(dirname(evidencePath), (_event, leaf) => {
        if (
          mutationStarted ||
          leaf?.toString() !== evidencePath.split('\\').at(-1)
        ) {
          return;
        }
        void (async () => {
          try {
            const record = JSON.parse(
              await readFile(evidencePath, 'utf8'),
            ) as Record<string, unknown>;
            if (record.diagnosticCode !== 'provider_usage_missing') return;
            mutationStarted = true;
            await writeFile(v6MarkerPath, 'changed-after-failure-write\n');
            resolveMutation();
          } catch {
            // Replacement events can arrive before the destination is readable.
          }
        })();
      });

      try {
        const finalized =
          finalizeReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
            reservation,
            summary: {
              status: 'invalid_attempted',
              gate: 'closed',
              providerAttemptCount: 1,
              usageKnown: false,
              diagnosticCode: 'provider_usage_missing',
            },
          });
        await Promise.race([
          mutationObserved,
          new Promise<never>((_resolve, reject) =>
            setTimeout(
              () => reject(new Error('failure mutation was not observed')),
              2_000,
            ),
          ),
        ]);
        await expect(finalized).resolves.toBe(false);
        expect(JSON.parse(await readFile(evidencePath, 'utf8'))).toMatchObject({
          state: 'finalized',
          status: 'invalid_attempted',
          diagnosticCode: 'provider_usage_missing',
        });
      } finally {
        watcher.close();
      }
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

function readEvidence(root: string, relativePath: string) {
  return readReviewPlannerControlledLiveV7DeepSeekUsageParityEvidence({
    root,
    relativePath,
  });
}

function expectEvidenceIo(value: Record<string, unknown>) {
  expect(value).toMatchObject({
    state: 'finalized',
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 0,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  });
  expect(value).not.toHaveProperty('aggregateInputTokens');
  expect(value).not.toHaveProperty('aggregateOutputTokens');
  expect(value).not.toHaveProperty('observedCostCny');
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
