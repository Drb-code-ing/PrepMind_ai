import {
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  unlink,
} from 'node:fs/promises';
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

  it.each(['reserved', 'attempted', 'finalized'] as const)(
    'consumes the phase-level controlled Live qualification at the %s state',
    async (state) => {
      const stateRoot = join(root, state);
      await mkdir(stateRoot);
      const reservation = await reserveReviewPlannerControlledLiveEvidence({
        root: stateRoot,
        startedAt: '2026-07-16T00:00:00.000Z',
        runId: `first-${state}-run-id`,
      });
      if (state !== 'reserved') await reservation.markAttempted();
      if (state === 'finalized') {
        await reservation.finalize({
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
        });
      }

      await expect(
        reserveReviewPlannerControlledLiveEvidence({
          root: stateRoot,
          startedAt: '2026-07-16T00:00:00.000Z',
          runId: `second-${state}-run-id`,
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_EVIDENCE_PHASE_ALREADY_CONSUMED');
    },
  );

  it('serializes a delayed attempted write before a concurrent finalization', async () => {
    let releaseFirstRename!: () => void;
    const releaseRename = new Promise<void>((resolve) => {
      releaseFirstRename = resolve;
    });
    let signalFirstRename!: () => void;
    const firstRenameStarted = new Promise<void>((resolve) => {
      signalFirstRename = resolve;
    });
    let delayFirstRename = true;
    const reservation = await reserveReviewPlannerControlledLiveEvidence({
      root,
      startedAt: '2026-07-16T00:00:00.000Z',
      runId: 'serialized-transition-run',
      fs: {
        mkdir,
        open,
        readdir,
        unlink,
        async rename(from, to) {
          if (delayFirstRename) {
            delayFirstRename = false;
            signalFirstRename();
            await releaseRename;
          }
          await rename(from, to);
        },
      },
    });

    const marking = reservation.markAttempted();
    await firstRenameStarted;
    const finalizing = reservation.finalize({
      status: 'complete',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: true,
    });
    releaseFirstRename();

    await expect(marking).resolves.toBe(true);
    await expect(finalizing).resolves.toBe(true);
    await expect(
      readFile(join(root, reservation.relativePath), 'utf8'),
    ).resolves.toContain('"state":"finalized"');
  });

  it('does not follow a phase evidence directory symlink outside the resolved root', async () => {
    const outside = await mkdtemp(
      join(tmpdir(), 'prepmind-phase-695-outside-'),
    );
    try {
      await symlink(outside, join(root, 'docs'), 'junction');
      await expect(
        reserveReviewPlannerControlledLiveEvidence({
          root,
          startedAt: '2026-07-16T00:00:00.000Z',
          runId: 'symlink-run',
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_EVIDENCE_OUTSIDE_ROOT');
      await expect(readdir(outside)).resolves.toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects a junction swap after binding and before the first evidence open', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-swap-'));
    const outsideEvidence = join(
      outside,
      'acceptance',
      'evidence',
      'phase-6-9-5-controlled-live',
    );
    await mkdir(outsideEvidence, { recursive: true });
    let swapped = false;
    try {
      await expect(
        reserveReviewPlannerControlledLiveEvidence({
          root,
          startedAt: '2026-07-16T00:00:00.000Z',
          runId: 'before-open-swap-run',
          fs: {
            mkdir,
            readdir,
            rename,
            unlink,
            async open(path, flags) {
              if (swapped) return open(path, flags);
              swapped = true;
              await rename(join(root, 'docs'), join(root, 'docs-detached'));
              await symlink(outside, join(root, 'docs'), 'junction');
              return open(path, flags);
            },
          },
        }),
      ).rejects.toThrow('CONTROLLED_LIVE_EVIDENCE_RESERVATION_FAILED');
      expect(swapped).toBe(true);
      await expect(readdir(outsideEvidence)).resolves.toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it.each([
    { name: 'attempted', swapOnOpen: 3 },
    { name: 'finalized', swapOnOpen: 4 },
  ] as const)(
    'fails closed without a root-external write when the parent swaps before %s state write',
    async ({ name, swapOnOpen }) => {
      const outside = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-swap-'));
      const outsideEvidence = join(
        outside,
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live',
      );
      await mkdir(outsideEvidence, { recursive: true });
      let opens = 0;
      try {
        const reservation = await reserveReviewPlannerControlledLiveEvidence({
          root,
          startedAt: '2026-07-16T00:00:00.000Z',
          runId: `state-swap-${name}-run`,
          fs: {
            mkdir,
            readdir,
            rename,
            unlink,
            async open(path, flags) {
              opens += 1;
              if (opens === swapOnOpen) {
                await rename(join(root, 'docs'), join(root, 'docs-detached'));
                await symlink(outside, join(root, 'docs'), 'junction');
              }
              return open(path, flags);
            },
          },
        });
        if (name === 'finalized') {
          await expect(reservation.markAttempted()).resolves.toBe(true);
        }

        const operation =
          name === 'attempted'
            ? reservation.markAttempted()
            : reservation.finalize({
                status: 'invalid_attempted',
                gate: 'closed',
                providerAttemptCount: 1,
                usageKnown: false,
                diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
              });
        await expect(operation).resolves.toBe(false);
        expect(opens).toBeGreaterThanOrEqual(swapOnOpen);
        await expect(readdir(outsideEvidence)).resolves.toEqual([]);
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    },
  );

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
