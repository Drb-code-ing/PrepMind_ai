import {
  cp,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE,
  finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence,
  safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema,
  snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
  verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence';
import type {
  ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot,
  SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence';
import {
  executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli,
  serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary,
} from './review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli';

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
] as const;

describeNativeWindows(
  'Review/Planner controlled Live V6 non-thinking native evidence',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v6-native-'));
      await copyHistoricalEvidenceTrees(root);
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('checks V1--V5 before reserve, executor, provider, and after V6 finalization', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      await expect(verify(root, snapshot)).resolves.toEqual(snapshot);

      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-safe-lifecycle',
          historicalSnapshot: snapshot,
        });
      await expect(verify(root, snapshot)).resolves.toEqual(snapshot);
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(verify(root, snapshot)).resolves.toEqual(snapshot);

      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(true);
      await expect(verify(root, snapshot)).resolves.toEqual(snapshot);

      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"reasoning":"not_reported"');
      expect(evidence).not.toContain('V6_PRIVATE_EVIDENCE_CANARY');
    });

    it('exposes no terminal-write capability and rejects a forged reservation without a write', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-public-capability-boundary',
          historicalSnapshot: snapshot,
        });
      await reservation.markAttempted();
      const before = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      const forged = { ...reservation };

      expect(Object.keys(reservation).sort()).toEqual([
        'markAttempted',
        'relativePath',
      ]);
      expect('finalize' in reservation).toBe(false);
      expect('seal' in reservation).toBe(false);
      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation: forged,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      await expect(
        readFile(join(root, reservation.relativePath), 'utf8'),
      ).resolves.toBe(before);

      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(true);
    });

    it.each([
      {
        label: 'changed',
        mutate: async () => {
          await writeFile(
            join(
              root,
              historicalDirectories[0],
              '.review-planner-controlled-live.once',
            ),
            'changed-history\n',
          );
        },
      },
      {
        label: 'added',
        mutate: async () => {
          await writeFile(
            join(root, historicalDirectories[1], 'added.json'),
            '{}\n',
          );
        },
      },
      {
        label: 'removed',
        mutate: async () => {
          await rm(
            join(
              root,
              historicalDirectories[2],
              '.review-planner-controlled-live-v3.once',
            ),
          );
        },
      },
      {
        label: 'renamed',
        mutate: async () => {
          await rename(
            join(
              root,
              historicalDirectories[3],
              '.review-planner-controlled-live-v4.once',
            ),
            join(root, historicalDirectories[3], 'renamed.once'),
          );
        },
      },
    ])('fails closed when V1--V5 history is $label', async ({ mutate }) => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      await mutate();
      await expect(verify(root, snapshot)).rejects.toThrow(
        'CONTROLLED_LIVE_V6_NONTHINKING_HISTORICAL_INTEGRITY_FAILED',
      );
    });

    it('detects a concurrently-created historical entry at the next boundary verification', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const lateWriter = writeFile(
        join(root, historicalDirectories[4], 'late-concurrent-entry.json'),
        '{}\n',
      );
      await lateWriter;

      await expect(verify(root, snapshot)).rejects.toThrow(
        'CONTROLLED_LIVE_V6_NONTHINKING_HISTORICAL_INTEGRITY_FAILED',
      );
    });

    it('rejects a historical junction without following it', async () => {
      const external = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-v6-outside-'),
      );
      try {
        await symlink(
          external,
          join(root, historicalDirectories[4], 'reparse-leaf'),
          'junction',
        );
        await expect(
          snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
            root,
          ),
        ).rejects.toThrow(
          'CONTROLLED_LIVE_V6_NONTHINKING_HISTORICAL_INTEGRITY_FAILED',
        );
      } finally {
        await rm(external, { recursive: true, force: true });
      }
    });

    it('fails closed without a second V6 write when its unique marker exists', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const directory = join(
        root,
        REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.evidenceDirectory,
      );
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(
          directory,
          REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE.onceLockLeaf,
        ),
        'consumed\n',
      );

      await expect(
        reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-marker-conflict',
          historicalSnapshot: snapshot,
        }),
      ).rejects.toThrow(
        'CONTROLLED_LIVE_V6_NONTHINKING_EVIDENCE_ALREADY_CONSUMED',
      );
    });

    it('seals the safe attempted record when the native V6 writer is denied', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-writer-failure',
          historicalSnapshot: snapshot,
        });
      await reservation.markAttempted();
      await chmod(join(root, reservation.relativePath), 0o444);
      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      await chmod(join(root, reservation.relativePath), 0o666);
      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"state":"attempted"');
      expect(evidence).not.toContain('"status":"complete"');
      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
    });

    it('seals the reserved handle when both the attempt and first safe closure writes are denied', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-reserved-write-denied-seal',
          historicalSnapshot: snapshot,
        });
      const evidencePath = join(root, reservation.relativePath);
      await chmod(evidencePath, 0o444);
      let evaluatorConstructed = false;

      try {
        const result =
          await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli({
            argv: ['--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking'],
            env: {},
            root,
            validatePreflight: () => ({ ok: true }),
            snapshotHistoricalEvidence: () => Promise.resolve(snapshot),
            reserveEvidence: () => Promise.resolve(reservation),
            verifyHistoricalEvidence: () => Promise.resolve(snapshot),
            createEvaluator: () => {
              evaluatorConstructed = true;
              throw new Error('CLI_EVALUATOR_MUST_NOT_BE_CONSTRUCTED');
            },
          });

        expect(result).toEqual(evidenceIoClosure());
        expect(
          serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary(
            result,
          ),
        ).toBe(
          '{"status":"invalid_attempted","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"evidence_io"}',
        );
        expect(evaluatorConstructed).toBe(false);
        const initialRecord = await readFile(evidencePath, 'utf8');
        expect(initialRecord).toContain('"state":"reserved"');
        expect(initialRecord).toContain('"status":"diagnostic_blocked"');
        expect(initialRecord).toContain('"providerAttemptCount":0');
        expect(initialRecord).not.toContain('"status":"complete"');
      } finally {
        await chmod(evidencePath, 0o666);
      }

      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: evidenceIoClosure(),
        }),
      ).resolves.toBe(false);
      await expect(reservation.markAttempted()).resolves.toBe(false);
    });

    it('seals closed evidence-io when history mismatches after the safe provisional write', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-final-post-check',
          historicalSnapshot: snapshot,
        });
      await reservation.markAttempted();
      await writeFile(
        join(root, historicalDirectories[1], 'late-change.json'),
        '{}\n',
      );

      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"state":"finalized"');
      expect(evidence).toContain('"diagnosticCode":"evidence_io"');
      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: completeSummary(),
        }),
      ).resolves.toBe(false);
    });

    it('uses the private finalizer to seal a reserved record when the CLI pre-attempt history check fails', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-cli-pre-attempt-history-failure',
          historicalSnapshot: snapshot,
        });
      const createEvaluator = () => {
        throw new Error('CLI_EVALUATOR_MUST_NOT_BE_CONSTRUCTED');
      };

      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli({
          argv: ['--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking'],
          env: {},
          root,
          validatePreflight: () => ({ ok: true }),
          snapshotHistoricalEvidence: () => Promise.resolve(snapshot),
          reserveEvidence: () => Promise.resolve(reservation),
          verifyHistoricalEvidence: () =>
            Promise.reject(new Error('CLI_PRE_ATTEMPT_HISTORY_MISMATCH')),
          createEvaluator,
        });

      expect(result).toEqual(evidenceIoClosure());
      expect(
        serializeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary(
          result,
        ),
      ).toBe(
        '{"status":"invalid_attempted","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"evidence_io"}',
      );
      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"state":"finalized"');
      expect(evidence).toContain('"providerAttemptCount":0');
      expect(evidence).toContain('"diagnosticCode":"evidence_io"');
      await expect(
        finalizeReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          historicalSnapshot: snapshot,
          reservation,
          summary: evidenceIoClosure(),
        }),
      ).resolves.toBe(false);
    });

    it('uses the same private finalizer when markAttempted returns false and never constructs an evaluator', async () => {
      const snapshot =
        await snapshotReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
          root,
        );
      const reservation =
        await reserveReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidence({
          root,
          startedAt: '2026-07-17T00:00:00.000Z',
          runId: 'v6-native-cli-mark-attempted-failure',
          historicalSnapshot: snapshot,
        });
      // The first transition owns the reservation. The CLI's attempt transition
      // then returns false, exercising the no-provider terminal branch.
      await expect(reservation.markAttempted()).resolves.toBe(true);
      let evaluatorConstructed = false;

      const result =
        await executeReviewPlannerControlledLiveV6DeepSeekNonThinkingCli({
          argv: ['--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking'],
          env: {},
          root,
          validatePreflight: () => ({ ok: true }),
          snapshotHistoricalEvidence: () => Promise.resolve(snapshot),
          reserveEvidence: () => Promise.resolve(reservation),
          verifyHistoricalEvidence: () => Promise.resolve(snapshot),
          createEvaluator: () => {
            evaluatorConstructed = true;
            throw new Error('CLI_EVALUATOR_MUST_NOT_BE_CONSTRUCTED');
          },
        });

      expect(result).toEqual(evidenceIoClosure());
      expect(evaluatorConstructed).toBe(false);
      const evidence = await readFile(
        join(root, reservation.relativePath),
        'utf8',
      );
      expect(evidence).toContain('"state":"finalized"');
      expect(evidence).toContain('"providerAttemptCount":0');
      expect(evidence).toContain('"diagnosticCode":"evidence_io"');
    });
  },
);

function verify(
  root: string,
  snapshot: ReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidenceSnapshot,
) {
  return verifyReviewPlannerControlledLiveV6DeepSeekNonThinkingHistoricalEvidence(
    {
      root,
      snapshot,
    },
  );
}

function completeSummary() {
  return {
    status: 'complete' as const,
    gate: 'open' as const,
    providerAttemptCount: 23,
    usageKnown: true as const,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PRICE_PROFILE_ID,
    currency: 'CNY' as const,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    hardCapCny: 1,
    withinHardCap: true as const,
    quality: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      p95DurationMs: 4_500,
      productionDecision: 'quality_gate_passed' as const,
    },
    nonThinkingAudit: {
      reasoning: 'not_reported' as const,
      reasoningContentPresent: false,
    },
  } satisfies SafeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummary;
}

function evidenceIoClosure() {
  return safeReviewPlannerControlledLiveV6DeepSeekNonThinkingSummarySchema.parse(
    {
      status: 'invalid_attempted' as const,
      gate: 'closed' as const,
      providerAttemptCount: 0,
      usageKnown: false as const,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    },
  );
}

async function copyHistoricalEvidenceTrees(root: string) {
  const sourceRoot = resolve(process.cwd(), '../..');
  await Promise.all(
    historicalDirectories.map((directory) =>
      cp(join(sourceRoot, directory), join(root, directory), {
        recursive: true,
        force: true,
      }),
    ),
  );
}
