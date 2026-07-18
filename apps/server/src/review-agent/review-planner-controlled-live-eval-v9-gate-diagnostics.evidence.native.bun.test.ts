import { createHash } from 'node:crypto';
import {
  cp,
  link,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
  advanceReviewPlannerControlledLiveV9Stage,
  commitReviewPlannerControlledLiveV9GateDiagnostic,
  completeReviewPlannerControlledLiveV9Validation,
  createReviewPlannerControlledLiveV9EvidenceTestHarness,
  createReviewPlannerControlledLiveV9NamespaceTestHarness,
  finalizeReviewPlannerControlledLiveV9Success,
  readReviewPlannerControlledLiveV9Evidence,
  reserveReviewPlannerControlledLiveV9Evidence,
  snapshotReviewPlannerControlledLiveV9HistoricalEvidence,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import { deriveV9GateDiagnostic } from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

const describeNative = process.platform === 'win32' ? describe : describe.skip;
const historicalDirectories = [
  'docs/acceptance/evidence/phase-6-9-5-controlled-live',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v8-deepseek-v4-pro-stage-diagnostics',
] as const;

describeNative('Review/Planner V9 durable gate evidence', () => {
  it('pins the exact immutable V1--V8 tree before reservation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v9-red-'));
    try {
      const sourceRoot = resolve(process.cwd());
      await Promise.all(
        historicalDirectories.map((directory) =>
          cp(join(sourceRoot, directory), join(root, directory), {
            recursive: true,
            force: true,
          }),
        ),
      );

      const snapshot =
        await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root);
      expect(snapshot).toMatchObject({
        schemaVersion: 'phase-6.9.5-review-planner-historical-integrity-v5',
        treeHash:
          '6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6',
      });
      expect(snapshot.entries).toHaveLength(20);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('commits a hash-bound diagnostic at 085 and publishes failure only at 090', async () => {
    const root = await createRoot();
    try {
      const reservation = await preparedReservation(root, 'p95-failure');
      await expect(
        readReviewPlannerControlledLiveV9Evidence(root),
      ).resolves.toMatchObject({
        diagnosticCode: 'evidence_io',
        lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[7],
      });
      const diagnostic = diagnosticWithP95(4_501, 'latency_budget_exceeded');
      const committed = await commitReviewPlannerControlledLiveV9GateDiagnostic(
        {
          reservation,
          diagnostic,
        },
      );
      expect(committed).toMatchObject({
        evidenceLeaf: reservation.relativePath.split('/').at(-1),
        historicalTreeHash:
          '6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6',
      });
      expect(committed?.diagnosticSha256).toMatch(/^[a-f0-9]{64}$/);
      const directory = join(
        root,
        REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory,
      );
      const bytes = await readFile(join(root, reservation.relativePath));
      expect(committed?.diagnosticSha256).toBe(
        createHash('sha256').update(bytes).digest('hex'),
      );
      expect(
        JSON.parse(
          await readFile(
            join(
              directory,
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
            ),
            'utf8',
          ),
        ),
      ).toEqual(committed);
      await expect(
        readReviewPlannerControlledLiveV9Evidence(root),
      ).resolves.toMatchObject({
        diagnosticCode: 'evidence_io',
        lastStage:
          REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
        diagnostic: { terminalReason: 'p95_exceeded' },
      });

      expect(completeReviewPlannerControlledLiveV9Validation(reservation)).toBe(
        true,
      );
      expect(reservation.abort()).toBe(false);
      await expect(
        readReviewPlannerControlledLiveV9Evidence(root),
      ).resolves.toMatchObject({
        state: 'finalized',
        status: 'invalid_attempted',
        terminalReason: 'p95_exceeded',
        lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[9],
      });
      await expect(
        finalizeReviewPlannerControlledLiveV9Success(reservation),
      ).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('allows only a passed diagnostic through complete candidate and success seal', async () => {
    const root = await createRoot();
    try {
      const reservation = await preparedReservation(root, 'sealed-success');
      await commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: passingDiagnostic(),
      });
      expect(completeReviewPlannerControlledLiveV9Validation(reservation)).toBe(
        true,
      );
      await expect(
        finalizeReviewPlannerControlledLiveV9Success(reservation),
      ).resolves.toBe(true);
      await expect(
        readReviewPlannerControlledLiveV9Evidence(root),
      ).resolves.toMatchObject({
        state: 'finalized',
        status: 'complete',
        terminalReason: 'passed',
        lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[15],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('allows one concurrent reservation and detects any pinned V8 drift', async () => {
    const root = await createRoot();
    try {
      const historicalSnapshot =
        await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root);
      const reservations = await Promise.allSettled([
        reserveReviewPlannerControlledLiveV9Evidence({
          root,
          historicalSnapshot,
          startedAt: '2026-07-19T12:00:00.000Z',
          runId: 'concurrent-a',
        }),
        reserveReviewPlannerControlledLiveV9Evidence({
          root,
          historicalSnapshot,
          startedAt: '2026-07-19T12:00:00.000Z',
          runId: 'concurrent-b',
        }),
      ]);
      const winners = reservations.filter(
        (value) => value.status === 'fulfilled',
      );
      expect(winners).toHaveLength(1);
      const winner = winners[0];
      if (winner.status !== 'fulfilled') throw new Error('missing winner');
      await writeFile(
        join(
          root,
          historicalDirectories[7],
          '.review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics.once',
        ),
        'changed',
      );
      await expect(winner.value.markAttempted()).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('releases reserved and intermediate capabilities without deleting evidence', async () => {
    for (const state of ['reserved', 'intermediate'] as const) {
      const root = await createRoot();
      try {
        const reservation = await reserveReviewPlannerControlledLiveV9Evidence({
          root,
          historicalSnapshot:
            await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root),
          startedAt: '2026-07-19T12:00:00.000Z',
          runId: `abort-${state}`,
        });
        expect(Object.keys(reservation).sort()).toEqual([
          'abort',
          'markAttempted',
          'relativePath',
        ]);
        if (state === 'intermediate') {
          expect(await reservation.markAttempted()).toBe(true);
          expect(
            advanceReviewPlannerControlledLiveV9Stage(
              reservation,
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[2],
            ),
          ).toBe(true);
        }
        const evidencePath = join(root, reservation.relativePath);
        const directory = dirname(evidencePath);
        await expect(readFile(evidencePath)).resolves.toBeDefined();

        expect(reservation.abort()).toBe(true);
        expect(reservation.abort()).toBe(false);
        await expect(readFile(evidencePath)).resolves.toBeDefined();
        await expect(rename(directory, `${directory}.released`)).resolves.toBe(
          undefined,
        );
        await rm(`${directory}.released`, { recursive: true, force: true });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it('keeps abort opaque and refuses to close a busy transition', async () => {
    const root = await createRoot();
    try {
      const reservation = await preparedReservation(root, 'abort-busy');
      expect(reservation.abort.call(Object.freeze({}))).toBe(false);
      const transition = commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
      });

      expect(reservation.abort()).toBe(false);
      await expect(transition).resolves.not.toBeNull();
      expect(reservation.abort()).toBe(true);
      expect(reservation.abort()).toBe(false);
      const directory = dirname(join(root, reservation.relativePath));
      await expect(rename(directory, `${directory}.released`)).resolves.toBe(
        undefined,
      );
      await rm(`${directory}.released`, { recursive: true, force: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails fresh reads closed for strict-valid tamper, unknown leaves and fake seals', async () => {
    for (const attack of [
      'diagnostic_tamper',
      'unknown_leaf',
      'fake_complete',
      'fake_seal',
    ] as const) {
      const root = await createRoot();
      try {
        const reservation = await preparedReservation(root, attack);
        await commitReviewPlannerControlledLiveV9GateDiagnostic({
          reservation,
          diagnostic:
            attack === 'fake_seal'
              ? passingDiagnostic()
              : diagnosticWithP95(4_501, 'latency_budget_exceeded'),
        });
        completeReviewPlannerControlledLiveV9Validation(reservation);
        const evidencePath = join(root, reservation.relativePath);
        const directory = dirname(evidencePath);
        if (attack === 'diagnostic_tamper') {
          await writeFile(
            evidencePath,
            `${JSON.stringify(diagnosticWithP95(4_502, 'latency_budget_exceeded'))}\n`,
          );
        } else if (attack === 'unknown_leaf') {
          await writeFile(join(directory, '.unknown-leaf'), '');
        } else if (attack === 'fake_complete') {
          await writeFile(
            evidencePath,
            `${JSON.stringify({
              ...diagnosticWithP95(4_501, 'latency_budget_exceeded'),
              state: 'finalized',
              status: 'complete',
            })}\n`,
          );
        } else {
          await finalizeReviewPlannerControlledLiveV9Success(reservation);
          await writeFile(
            join(
              directory,
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
            ),
            '{}\n',
          );
        }
        expectEvidenceIo(await readReviewPlannerControlledLiveV9Evidence(root));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it('rejects a reparse-swapped V9 evidence directory', async () => {
    const root = await createRoot();
    const external = await mkdtemp(join(tmpdir(), 'prepmind-v9-reparse-'));
    try {
      const reservation = await preparedReservation(root, 'reparse-reader');
      await commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
      });
      completeReviewPlannerControlledLiveV9Validation(reservation);
      const directory = dirname(join(root, reservation.relativePath));
      await cp(directory, external, { recursive: true, force: true });
      await rm(directory, { recursive: true, force: true });
      await symlink(external, directory, 'junction');
      expectEvidenceIo(await readReviewPlannerControlledLiveV9Evidence(root));
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it('rejects a hard-linked canonical diagnostic leaf', async () => {
    const root = await createRoot();
    try {
      const reservation = await preparedReservation(root, 'hardlink-reader');
      await commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
      });
      completeReviewPlannerControlledLiveV9Validation(reservation);
      await link(
        join(root, reservation.relativePath),
        join(root, 'outside-hardlink.json'),
      );
      expectEvidenceIo(await readReviewPlannerControlledLiveV9Evidence(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('freezes the V8 history directory across path-level pin checks', async () => {
    const root = await createRoot();
    const external = await mkdtemp(join(tmpdir(), 'prepmind-v9-v8-swap-'));
    let blocked = false;
    let hookCalls = 0;
    try {
      const harness = createReviewPlannerControlledLiveV9NamespaceTestHarness(
        async ({ kind, absoluteDirectory }) => {
          if (kind !== 'v8_history') return;
          hookCalls += 1;
          try {
            await rename(absoluteDirectory, `${absoluteDirectory}.swapped`);
            await symlink(external, absoluteDirectory, 'junction');
          } catch {
            blocked = true;
          }
        },
      );

      await expect(harness.snapshot(root)).resolves.toMatchObject({
        treeHash:
          '6078891e6c962bc5c8e57471017d7f64e210c5f4ffd867c96136e33983ac2bd6',
      });
      expect(hookCalls).toBe(1);
      expect(blocked).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it('freezes the V9 reservation directory before canonical namespace checks', async () => {
    const root = await createRoot();
    const external = await mkdtemp(
      join(tmpdir(), 'prepmind-v9-reservation-swap-'),
    );
    let blocked = false;
    let swapped = false;
    let hookCalls = 0;
    try {
      const harness = createReviewPlannerControlledLiveV9NamespaceTestHarness(
        async ({ kind, absoluteDirectory }) => {
          if (kind !== 'v9_reservation') return;
          hookCalls += 1;
          try {
            await rename(absoluteDirectory, `${absoluteDirectory}.swapped`);
            swapped = true;
            await symlink(external, absoluteDirectory, 'junction');
          } catch {
            blocked = true;
          }
        },
      );
      const reservation = await harness.reserve({
        root,
        historicalSnapshot:
          await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root),
        startedAt: '2026-07-19T12:00:00.000Z',
        runId: 'frozen-reservation',
      });

      expect(hookCalls).toBe(1);
      expect(blocked).toBe(true);
      expect(swapped).toBe(false);
      await expect(
        readFile(join(root, reservation.relativePath)),
      ).resolves.toBeDefined();
      expect(await reservation.markAttempted()).toBe(true);
      for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(
        2,
        8,
      )) {
        expect(
          advanceReviewPlannerControlledLiveV9Stage(reservation, stage),
        ).toBe(true);
      }
      await commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
      });
      expect(completeReviewPlannerControlledLiveV9Validation(reservation)).toBe(
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it('freezes the V9 reader directory across namespace and handle checks', async () => {
    const root = await createRoot();
    const external = await mkdtemp(join(tmpdir(), 'prepmind-v9-reader-swap-'));
    let blocked = false;
    let hookCalls = 0;
    try {
      const reservation = await preparedReservation(root, 'frozen-reader');
      await commitReviewPlannerControlledLiveV9GateDiagnostic({
        reservation,
        diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
      });
      completeReviewPlannerControlledLiveV9Validation(reservation);
      const harness = createReviewPlannerControlledLiveV9NamespaceTestHarness(
        async ({ kind, absoluteDirectory }) => {
          if (kind !== 'v9_reader') return;
          hookCalls += 1;
          try {
            await rename(absoluteDirectory, `${absoluteDirectory}.swapped`);
            await symlink(external, absoluteDirectory, 'junction');
          } catch {
            blocked = true;
          }
        },
      );

      await expect(harness.read(root)).resolves.toMatchObject({
        state: 'finalized',
        terminalReason: 'p95_exceeded',
      });
      expect(hookCalls).toBe(1);
      expect(blocked).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it('keeps diagnostic publication fail-closed across checked write and rename faults', async () => {
    for (const phase of [
      'write',
      'flush',
      'close',
      'prepare_create',
      'prepare_write',
      'prepare_flush',
      'prepare_close',
      'prepare_reopen',
      'rename',
    ] as const) {
      const root = await createRoot();
      try {
        let count = 0;
        let hits = 0;
        const target = ['write', 'flush', 'close'].includes(phase) ? 3 : 10;
        const harness = createReviewPlannerControlledLiveV9EvidenceTestHarness(
          (current) => {
            if (current !== phase) return false;
            count += 1;
            if (count !== target) return false;
            hits += 1;
            return true;
          },
        );
        const reservation = await preparedHarnessReservation(
          root,
          `fault-${phase}`,
          harness,
        );
        await expect(
          commitReviewPlannerControlledLiveV9GateDiagnostic({
            reservation,
            diagnostic: passingDiagnostic(),
          }),
        ).resolves.toBeNull();
        expect(hits).toBe(1);
        expectEvidenceIo(await readReviewPlannerControlledLiveV9Evidence(root));
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 30_000);

  it('keeps a rename-committed 085 after post-commit hard-exit boundary', async () => {
    const root = await createRoot();
    try {
      let cleanupCount = 0;
      const harness = createReviewPlannerControlledLiveV9EvidenceTestHarness(
        (phase) => {
          if (phase !== 'post_commit_cleanup') return false;
          cleanupCount += 1;
          return cleanupCount === 10;
        },
      );
      const reservation = await preparedHarnessReservation(
        root,
        'hard-exit-085',
        harness,
      );
      const committed = await commitReviewPlannerControlledLiveV9GateDiagnostic(
        {
          reservation,
          diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
        },
      );
      expect(committed?.diagnosticSha256).toMatch(/^[a-f0-9]{64}$/);
      await expect(
        readReviewPlannerControlledLiveV9Evidence(root),
      ).resolves.toMatchObject({
        diagnosticCode: 'evidence_io',
        lastStage:
          REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
      });
      expect(completeReviewPlannerControlledLiveV9Validation(reservation)).toBe(
        true,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('never publishes 090 when its exclusive durable rename boundary fails', async () => {
    for (const phase of [
      'prepare_create',
      'prepare_write',
      'prepare_flush',
      'prepare_close',
      'prepare_reopen',
      'rename',
    ] as const) {
      const root = await createRoot();
      try {
        let count = 0;
        const harness = createReviewPlannerControlledLiveV9EvidenceTestHarness(
          (current) => {
            if (current !== phase) return false;
            count += 1;
            return count === 11;
          },
        );
        const reservation = await preparedHarnessReservation(
          root,
          `stage-090-${phase}`,
          harness,
        );
        await commitReviewPlannerControlledLiveV9GateDiagnostic({
          reservation,
          diagnostic: diagnosticWithP95(4_501, 'latency_budget_exceeded'),
        });
        expect(
          completeReviewPlannerControlledLiveV9Validation(reservation),
        ).toBe(false);
        await expect(
          readFile(
            join(
              root,
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory,
              REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES[9],
            ),
          ),
        ).rejects.toThrow();
        await expect(
          readReviewPlannerControlledLiveV9Evidence(root),
        ).resolves.toMatchObject({
          diagnosticCode: 'evidence_io',
          lastStage:
            REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.diagnosticCommitLeaf,
          diagnostic: { terminalReason: 'p95_exceeded' },
        });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 30_000);
});

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v9-native-'));
  const sourceRoot = resolve(process.cwd());
  await Promise.all(
    historicalDirectories.map((directory) =>
      cp(join(sourceRoot, directory), join(root, directory), {
        recursive: true,
        force: true,
      }),
    ),
  );
  return root;
}

async function preparedReservation(root: string, runId: string) {
  const reservation = await reserveReviewPlannerControlledLiveV9Evidence({
    root,
    historicalSnapshot:
      await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root),
    startedAt: '2026-07-19T12:00:00.000Z',
    runId,
  });
  await reservation.markAttempted();
  for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(2, 8)) {
    expect(advanceReviewPlannerControlledLiveV9Stage(reservation, stage)).toBe(
      true,
    );
  }
  return reservation;
}

async function preparedHarnessReservation(
  root: string,
  runId: string,
  harness: ReturnType<
    typeof createReviewPlannerControlledLiveV9EvidenceTestHarness
  >,
) {
  const reservation = await harness.reserve({
    root,
    historicalSnapshot:
      await snapshotReviewPlannerControlledLiveV9HistoricalEvidence(root),
    startedAt: '2026-07-19T12:00:00.000Z',
    runId,
  });
  await reservation.markAttempted();
  for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES.slice(2, 8)) {
    expect(advanceReviewPlannerControlledLiveV9Stage(reservation, stage)).toBe(
      true,
    );
  }
  return reservation;
}

function passingDiagnostic() {
  return diagnosticWithP95(4_500, 'quality_gate_passed');
}

function diagnosticWithP95(
  p95DurationMs: number,
  productionDecision: 'quality_gate_passed' | 'latency_budget_exceeded',
) {
  return deriveV9GateDiagnostic({
    attempts: {
      providerCount: 23,
      expectedProviderCount: 23,
      pairedAdmissionCount: 22,
      expectedPairedAdmissionCount: 22,
      overflow: false,
      auditRecordCount: 23,
    },
    report: {
      schemaValid: true,
      caseEntries: 48,
      zeroCallCases: 26,
      zeroCallVerified: 26,
      runtimeInvocations: 22,
      budgetExceededCases: 0,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      semanticPasses: 22,
      semanticTotal: 22,
      p95DurationMs,
      productionDecision,
    },
    usage: { known: true, inputTokens: 42_000, outputTokens: 9_000 },
    cost: {
      evaluated: true,
      amountCny: 0.18,
      hardCapCny: 1,
      withinCap: true,
    },
  });
}

function expectEvidenceIo(value: Record<string, unknown>) {
  expect(value).toMatchObject({
    status: 'invalid_attempted',
    gate: 'closed',
    diagnosticCode: 'evidence_io',
  });
  expect(value).not.toHaveProperty('prompt');
  expect(value).not.toHaveProperty('response');
  expect(value).not.toHaveProperty('rawError');
}
