import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { executeReviewPlannerControlledLiveCli } from './review-planner-controlled-live-eval-cli';
import { reserveReviewPlannerControlledLiveEvidence } from './review-planner-controlled-live-eval-evidence';

const describeNativeWindows =
  process.platform === 'win32' && Boolean(process.versions.bun)
    ? describe
    : describe.skip;

describeNativeWindows(
  'review planner controlled Live native evidence I/O',
  () => {
    let root = '';
    let outside = '';
    let discardRoot = '';

    beforeEach(async () => {
      root = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-evidence-'),
      );
      outside = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-outside-'),
      );
      discardRoot = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-discard-'),
      );
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
      await rm(discardRoot, { recursive: true, force: true });
    });

    it('blocks a root junction before native binding and leaves the outside evidence directory empty', async () => {
      const swappedRoot = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-root-swap-'),
      );
      const detachedRoot = `${swappedRoot}-detached`;
      const evidenceComponents = [
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      ];
      const outsideEvidence = join(outside, ...evidenceComponents);

      try {
        await mkdir(join(swappedRoot, ...evidenceComponents), {
          recursive: true,
        });
        await mkdir(outsideEvidence, { recursive: true });
        await rename(swappedRoot, detachedRoot);
        await symlink(outside, swappedRoot, 'junction');

        await expect(
          reserveReviewPlannerControlledLiveEvidence({
            root: swappedRoot,
            startedAt: '2026-07-16T00:00:00.000Z',
            runId: 'native-root-swap-blocked-run',
          }),
        ).rejects.toThrow('CONTROLLED_LIVE_EVIDENCE_RESERVATION_FAILED');
        await expect(readdir(outsideEvidence)).resolves.toEqual([]);
      } finally {
        await rm(swappedRoot, { recursive: true, force: true });
        await rm(detachedRoot, { recursive: true, force: true });
      }
    });

    it('fails closed for a missing root without recreating locks or evidence before the provider boundary', async () => {
      const detachedRoot = `${root}-detached`;
      const detachedEvidence = join(
        detachedRoot,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      );
      let providerAttempts = 0;

      try {
        await mkdir(
          join(
            root,
            'docs',
            'acceptance',
            'evidence',
            'phase-6-9-5-controlled-live',
          ),
          { recursive: true },
        );
        await rename(root, detachedRoot);

        const result = await executeReviewPlannerControlledLiveCli({
          argv: ['--confirm-controlled-live'],
          root,
          env: {
            AI_PROVIDER_MODE: 'live',
            AI_ENABLE_LIVE_CALLS: 'true',
            REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
            REVIEW_AGENT_MODEL_ENABLED: 'false',
            PLANNER_AGENT_MODEL_ENABLED: 'false',
            AI_MODEL: 'deepseek-v4-flash',
            AI_BASE_URL: 'https://api.deepseek.com/v1',
            DEEPSEEK_API_KEY: 'native-test-private-canary',
          },
          now: () => Date.parse('2026-07-16T00:00:00.000Z'),
          randomUUID: () => 'native-missing-root-provider-zero-run',
          dependencies: {
            createExecutor: () => () => {
              providerAttempts += 1;
              return Promise.reject(
                new Error('provider must remain unreachable'),
              );
            },
          },
        });

        expect(result).toEqual({
          status: 'diagnostic_blocked',
          gate: 'closed',
          providerAttemptCount: 0,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
        });
        expect(providerAttempts).toBe(0);
        await expect(lstat(root)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(readdir(detachedEvidence)).resolves.toEqual([]);
      } finally {
        await rm(root, { recursive: true, force: true });
        await rm(detachedRoot, { recursive: true, force: true });
      }
    });

    it('fails closed for a missing root ancestor without recreating locks or evidence before the provider boundary', async () => {
      const anchor = await mkdtemp(
        join(tmpdir(), 'prepmind-phase-695-native-missing-ancestor-'),
      );
      const ancestor = join(anchor, 'workspace');
      const detachedAncestor = `${ancestor}-detached`;
      const scopedRoot = join(ancestor, 'project');
      const detachedEvidence = join(
        detachedAncestor,
        'project',
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      );
      let providerAttempts = 0;

      try {
        await mkdir(
          join(
            scopedRoot,
            'docs',
            'acceptance',
            'evidence',
            'phase-6-9-5-controlled-live',
          ),
          { recursive: true },
        );
        await rename(ancestor, detachedAncestor);

        const result = await executeReviewPlannerControlledLiveCli({
          argv: ['--confirm-controlled-live'],
          root: scopedRoot,
          env: {
            AI_PROVIDER_MODE: 'live',
            AI_ENABLE_LIVE_CALLS: 'true',
            REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
            REVIEW_AGENT_MODEL_ENABLED: 'false',
            PLANNER_AGENT_MODEL_ENABLED: 'false',
            AI_MODEL: 'deepseek-v4-flash',
            AI_BASE_URL: 'https://api.deepseek.com/v1',
            DEEPSEEK_API_KEY: 'native-test-private-canary',
          },
          now: () => Date.parse('2026-07-16T00:00:00.000Z'),
          randomUUID: () => 'native-missing-ancestor-provider-zero-run',
          dependencies: {
            createExecutor: () => () => {
              providerAttempts += 1;
              return Promise.reject(
                new Error('provider must remain unreachable'),
              );
            },
          },
        });

        expect(result).toEqual({
          status: 'diagnostic_blocked',
          gate: 'closed',
          providerAttemptCount: 0,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
        });
        expect(providerAttempts).toBe(0);
        await expect(lstat(ancestor)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(readdir(detachedEvidence)).resolves.toEqual([]);
      } finally {
        await rm(anchor, { recursive: true, force: true });
        await rm(detachedAncestor, { recursive: true, force: true });
      }
    });

    it('keeps reserve, attempted, finalized, and discard writes handle-relative when a junction swap is attempted', async () => {
      const outsideEvidence = join(
        outside,
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      );
      await mkdir(outsideEvidence, { recursive: true });

      let nodePathOpenCalls = 0;
      let swapAttempts = 0;
      let activeRoot = root;
      const onNativeOperation = async () => {
        swapAttempts += 1;
        try {
          await rename(
            join(activeRoot, 'docs'),
            join(activeRoot, 'docs-detached'),
          );
          await symlink(outside, join(activeRoot, 'docs'), 'junction');
        } catch {
          // The bound native directory intentionally denies a concurrent swap.
        }
      };

      const fs = {
        mkdir,
        readdir,
        rename,
        unlink,
        open(): Promise<never> {
          nodePathOpenCalls += 1;
          return Promise.reject(
            new Error('NODE_PATH_OPEN_MUST_NOT_RUN_ON_WINDOWS'),
          );
        },
        beforeNativeOperation: onNativeOperation,
      } as never;

      const reservation = await reserveReviewPlannerControlledLiveEvidence({
        root,
        startedAt: '2026-07-16T00:00:00.000Z',
        runId: 'native-reserve-mark-finalize-run',
        fs,
      });
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(
        reservation.finalize({
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
        }),
      ).resolves.toBe(true);
      await expect(
        readFile(join(root, reservation.relativePath), 'utf8'),
      ).resolves.toContain('"state":"finalized"');

      activeRoot = discardRoot;
      const discardReservation =
        await reserveReviewPlannerControlledLiveEvidence({
          root: discardRoot,
          startedAt: '2026-07-16T00:00:00.000Z',
          runId: 'native-discard-run',
          fs,
        });
      await expect(discardReservation.discard()).resolves.toBe(true);

      expect(nodePathOpenCalls).toBe(0);
      expect(swapAttempts).toBeGreaterThan(0);
      await expect(readdir(outsideEvidence)).resolves.toEqual([]);
    });

    it('fails before the provider when a post-binding junction swap hook aborts a native reservation', async () => {
      const outsideEvidence = join(
        outside,
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      );
      await mkdir(outsideEvidence, { recursive: true });
      let swapAttempted = false;
      let providerAttempts = 0;

      const result = await executeReviewPlannerControlledLiveCli({
        argv: ['--confirm-controlled-live'],
        root,
        env: {
          AI_PROVIDER_MODE: 'live',
          AI_ENABLE_LIVE_CALLS: 'true',
          REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
          REVIEW_AGENT_MODEL_ENABLED: 'false',
          PLANNER_AGENT_MODEL_ENABLED: 'false',
          AI_MODEL: 'deepseek-v4-flash',
          AI_BASE_URL: 'https://api.deepseek.com/v1',
          DEEPSEEK_API_KEY: 'native-test-private-canary',
        },
        now: () => Date.parse('2026-07-16T00:00:00.000Z'),
        randomUUID: () => 'native-swap-provider-zero-run',
        dependencies: {
          createExecutor: () => () => {
            providerAttempts += 1;
            return Promise.reject(
              new Error('provider must remain unreachable'),
            );
          },
        },
        reserveEvidence: (input) =>
          reserveReviewPlannerControlledLiveEvidence({
            ...input,
            fs: {
              mkdir,
              open,
              readdir,
              rename,
              unlink,
              async beforeNativeOperation() {
                swapAttempted = true;
                try {
                  await rename(join(root, 'docs'), join(root, 'docs-detached'));
                  await symlink(outside, join(root, 'docs'), 'junction');
                } catch {
                  // The native ancestor handles should deny this rename.
                }
                throw new Error('test abort after native bind');
              },
            },
          }),
      });

      expect(result).toEqual({
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
      });
      expect(swapAttempted).toBe(true);
      expect(providerAttempts).toBe(0);
      await expect(readdir(outsideEvidence)).resolves.toEqual([]);
    });
  },
);
