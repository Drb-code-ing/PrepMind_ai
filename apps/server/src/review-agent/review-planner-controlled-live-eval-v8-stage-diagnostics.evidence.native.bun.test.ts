import { createHash } from 'node:crypto';
import {
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
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES,
  advanceReviewPlannerControlledLiveV8Stage,
  createReviewPlannerControlledLiveV8EvidenceTestHarness,
  finalizeReviewPlannerControlledLiveV8Evidence,
  readReviewPlannerControlledLiveV8Evidence,
  reserveReviewPlannerControlledLiveV8Evidence,
  snapshotReviewPlannerControlledLiveV8HistoricalEvidence,
  verifyReviewPlannerControlledLiveV8HistoricalEvidence,
  type ReviewPlannerControlledLiveV8EvidenceReservation,
  type ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot,
  type SafeReviewPlannerControlledLiveV8Summary,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

const describeNative = process.platform === 'win32' ? describe : describe.skip;
const historicalDirectories = [
  'docs/acceptance/evidence/phase-6-9-5-controlled-live',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v7-deepseek-v4-pro-usage-parity',
] as const;

describeNative('Review/Planner V8 durable stage evidence', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v8-native-'));
    await copyHistory(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('pins the immutable V7 marker and terminal in the combined V1--V7 tree', async () => {
    const currentSnapshot = await snapshot(root);
    expect(currentSnapshot.schemaVersion).toBe(
      'phase-6.9.5-review-planner-historical-integrity-v4',
    );
    expect(
      currentSnapshot.entries.find((entry) =>
        entry.relativePath.endsWith(
          '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once',
        ),
      )?.sha256,
    ).toBe('1920c68d8fd10d77af1cf63731e46ed8e9c02270093a024302b24eb97fa85bda');
    expect(
      currentSnapshot.entries.find((entry) =>
        entry.relativePath.endsWith(
          'review-planner-live-20260717T161356046Z-e26f821fdc46.json',
        ),
      )?.sha256,
    ).toBe('79c07fed05a011a6344e7df3aecd9c616824c6a7cd07873693f3ddfaab1a63ba');
    await expect(
      verifyReviewPlannerControlledLiveV8HistoricalEvidence({
        root,
        snapshot: currentSnapshot,
      }),
    ).resolves.toEqual(currentSnapshot);
  });

  it('keeps stage authority private and accepts only the exact durable prefix', async () => {
    const reservation = await reserve(
      root,
      await snapshot(root),
      'stage-prefix',
    );
    expect(Object.keys(reservation).sort()).toEqual([
      'markAttempted',
      'relativePath',
    ]);
    const evidenceDirectory = dirname(join(root, reservation.relativePath));
    expect(
      await readFile(
        join(evidenceDirectory, REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[0]),
      ),
    ).toHaveLength(0);
    expect(
      advanceReviewPlannerControlledLiveV8Stage(
        reservation,
        REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[1],
      ),
    ).toBe(false);
    await expect(reservation.markAttempted()).resolves.toBe(true);
    for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.slice(1, 9)) {
      expect(
        advanceReviewPlannerControlledLiveV8Stage(reservation, stage),
      ).toBe(true);
      expect(await readFile(join(evidenceDirectory, stage))).toHaveLength(0);
      expect(
        advanceReviewPlannerControlledLiveV8Stage(reservation, stage),
      ).toBe(false);
    }
    await expect(
      finalizeReviewPlannerControlledLiveV8Evidence({
        reservation,
        summary: failureSummary(),
      }),
    ).resolves.toBe(true);
    await expect(
      readReviewPlannerControlledLiveV8Evidence({
        root,
        relativePath: reservation.relativePath,
      }),
    ).resolves.toMatchObject({
      state: 'finalized',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
      lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[12],
    });
  });

  it('projects success only after the full manifest and strict hash-bound durable seal', async () => {
    const reservation = await preparedReservation(root, 'sealed-success');
    await expect(
      finalizeReviewPlannerControlledLiveV8Evidence({
        reservation,
        summary: completeSummary(),
      }),
    ).resolves.toBe(true);
    const evidencePath = join(root, reservation.relativePath);
    const directoryPath = dirname(evidencePath);
    const candidate = await readFile(evidencePath);
    expect(
      Object.keys(
        JSON.parse(candidate.toString('utf8')) as Record<string, unknown>,
      ).sort(),
    ).toEqual([
      'aggregateInputTokens',
      'aggregateOutputTokens',
      'caseEntries',
      'criticalFailures',
      'gate',
      'observedCostCny',
      'priceProfileId',
      'providerAttemptCount',
      'qualityPasses',
      'runtimeInvocations',
      'schemaVersion',
      'stageManifestSha256',
      'state',
      'status',
      'strictSuccesses',
      'successCommitmentSha256',
      'usageKnown',
      'zeroCallCases',
    ]);
    const sealPath = join(
      directoryPath,
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.successCommitLeaf,
    );
    const seal = JSON.parse(await readFile(sealPath, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(seal).sort()).toEqual([
      'candidateSha256',
      'commitNonce',
      'evidenceLeaf',
      'historicalTreeHash',
      'onceMarkerSha256',
      'schemaVersion',
      'stageManifestSha256',
    ]);
    expect(seal.candidateSha256).toBe(
      createHash('sha256').update(candidate).digest('hex'),
    );
    await expect(
      readReviewPlannerControlledLiveV8Evidence({
        root,
        relativePath: reservation.relativePath,
      }),
    ).resolves.toMatchObject({
      state: 'finalized',
      status: 'complete',
      lastStage: REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[14],
    });

    await rm(sealPath);
    expectEvidenceIo(
      await readReviewPlannerControlledLiveV8Evidence({
        root,
        relativePath: reservation.relativePath,
      }),
    );
  });

  it('fails fresh reads closed for non-zero, gapped, unknown, or mismatched stage evidence', async () => {
    const reservation = await preparedReservation(root, 'tampered-manifest');
    await expect(
      finalizeReviewPlannerControlledLiveV8Evidence({
        reservation,
        summary: completeSummary(),
      }),
    ).resolves.toBe(true);
    const directoryPath = dirname(join(root, reservation.relativePath));
    await writeFile(
      join(directoryPath, REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[5]),
      'not-zero',
    );
    expectEvidenceIo(await readReviewPlannerControlledLiveV8Evidence(root));
    await writeFile(join(directoryPath, '.stage-999-unknown'), '');
    expectEvidenceIo(await readReviewPlannerControlledLiveV8Evidence(root));
  });

  it('allows one concurrent reservation and detects V7 drift before attempting', async () => {
    const historicalSnapshot = await snapshot(root);
    const reservations = await Promise.allSettled([
      reserve(root, historicalSnapshot, 'concurrent-a'),
      reserve(root, historicalSnapshot, 'concurrent-b'),
    ]);
    expect(
      reservations.filter((value) => value.status === 'fulfilled'),
    ).toHaveLength(1);
    const winner = reservations.find((value) => value.status === 'fulfilled');
    if (!winner || winner.status !== 'fulfilled')
      throw new Error('missing winner');
    await writeFile(
      join(
        root,
        historicalDirectories[6],
        '.review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity.once',
      ),
      'changed',
    );
    await expect(winner.value.markAttempted()).resolves.toBe(false);
  });

  it('rejects forged reservations/finalizers and a reparse-swapped V8 tree', async () => {
    const reservation = await preparedReservation(root, 'forged-finalizer');
    await expect(
      finalizeReviewPlannerControlledLiveV8Evidence({
        reservation: { ...reservation },
        summary: failureSummary(),
      }),
    ).resolves.toBe(false);
    await expect(
      finalizeReviewPlannerControlledLiveV8Evidence({
        reservation,
        summary: failureSummary(),
      }),
    ).resolves.toBe(true);

    const evidenceDirectory = dirname(join(root, reservation.relativePath));
    const external = await mkdtemp(
      join(tmpdir(), 'prepmind-v8-reparse-outside-'),
    );
    try {
      await rm(evidenceDirectory, { recursive: true, force: true });
      await symlink(external, evidenceDirectory, 'junction');
      expectEvidenceIo(await readReviewPlannerControlledLiveV8Evidence(root));
    } finally {
      await rm(evidenceDirectory, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });

  it('stops at the last durable prefix for every stage write failure or thrown flush fault without retry', async () => {
    const durableOperationByStage = [
      3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 19, 20,
    ];
    for (const throws of [false, true]) {
      for (
        let stageIndex = 0;
        stageIndex < REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.length;
        stageIndex += 1
      ) {
        const caseRoot = await mkdtemp(
          join(tmpdir(), 'prepmind-v8-stage-fault-'),
        );
        try {
          await copyHistory(caseRoot);
          let phaseCount = 0;
          let hits = 0;
          const faultPhase = throws ? 'flush' : 'write';
          const harness =
            createReviewPlannerControlledLiveV8EvidenceTestHarness((phase) => {
              if (phase !== faultPhase) return false;
              phaseCount += 1;
              if (phaseCount !== durableOperationByStage[stageIndex])
                return false;
              hits += 1;
              if (throws) throw new Error('injected');
              return true;
            });
          const historicalSnapshot = await snapshot(caseRoot);
          let reservation: ReviewPlannerControlledLiveV8EvidenceReservation | null =
            null;
          if (stageIndex === 0) {
            await expect(
              harness.reserve({
                root: caseRoot,
                historicalSnapshot,
                startedAt: '2026-07-18T12:00:00.000Z',
                runId: `stage-${stageIndex}-${throws}`,
              }),
            ).rejects.toThrow();
          } else {
            reservation = await harness.reserve({
              root: caseRoot,
              historicalSnapshot,
              startedAt: '2026-07-18T12:00:00.000Z',
              runId: `stage-${stageIndex}-${throws}`,
            });
            await reservation.markAttempted();
            if (stageIndex <= 8) {
              for (let current = 1; current <= stageIndex; current += 1) {
                const advanced = advanceReviewPlannerControlledLiveV8Stage(
                  reservation,
                  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[current],
                );
                expect(advanced).toBe(current < stageIndex);
              }
            } else {
              for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.slice(
                1,
                9,
              )) {
                expect(
                  advanceReviewPlannerControlledLiveV8Stage(reservation, stage),
                ).toBe(true);
              }
              await expect(
                finalizeReviewPlannerControlledLiveV8Evidence({
                  reservation,
                  summary: completeSummary(),
                }),
              ).resolves.toBe(false);
            }
          }
          expect(hits).toBe(1);
          const read =
            await readReviewPlannerControlledLiveV8Evidence(caseRoot);
          expect(read.status).toBe('invalid_attempted');
          expect(read.lastStage).toBe(
            stageIndex === 0
              ? null
              : REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES[stageIndex - 1],
          );
        } finally {
          await rm(caseRoot, { recursive: true, force: true });
        }
      }
    }
  }, 30_000);

  it('fails once, provisional, candidate, terminal and seal write/flush/close boundaries closed', async () => {
    const boundaries = [
      { name: 'once', operation: 1, complete: true },
      { name: 'provisional', operation: 14, complete: true },
      { name: 'candidate', operation: 17, complete: true },
      { name: 'terminal', operation: 17, complete: false },
      { name: 'seal', operation: 21, complete: true },
    ] as const;
    for (const boundary of boundaries) {
      for (const faultPhase of ['write', 'flush', 'close'] as const) {
        const caseRoot = await mkdtemp(
          join(tmpdir(), 'prepmind-v8-boundary-fault-'),
        );
        try {
          await copyHistory(caseRoot);
          let phaseCount = 0;
          let hits = 0;
          const harness =
            createReviewPlannerControlledLiveV8EvidenceTestHarness((phase) => {
              if (phase !== faultPhase) return false;
              phaseCount += 1;
              if (phaseCount !== boundary.operation) return false;
              hits += 1;
              return true;
            });
          const historicalSnapshot = await snapshot(caseRoot);
          if (boundary.name === 'once') {
            await expect(
              harness.reserve({
                root: caseRoot,
                historicalSnapshot,
                startedAt: '2026-07-18T12:00:00.000Z',
                runId: `once-${faultPhase}`,
              }),
            ).rejects.toThrow();
          } else {
            const reservation = await harness.reserve({
              root: caseRoot,
              historicalSnapshot,
              startedAt: '2026-07-18T12:00:00.000Z',
              runId: `${boundary.name}-${faultPhase}`,
            });
            await reservation.markAttempted();
            for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.slice(
              1,
              9,
            )) {
              expect(
                advanceReviewPlannerControlledLiveV8Stage(reservation, stage),
              ).toBe(true);
            }
            await expect(
              finalizeReviewPlannerControlledLiveV8Evidence({
                reservation,
                summary: boundary.complete
                  ? completeSummary()
                  : failureSummary(),
              }),
            ).resolves.toBe(false);
          }
          expect(hits).toBe(1);
          expectEvidenceIo(
            await readReviewPlannerControlledLiveV8Evidence(caseRoot),
          );
        } finally {
          await rm(caseRoot, { recursive: true, force: true });
        }
      }
    }
  }, 30_000);
});

function snapshot(root: string) {
  return snapshotReviewPlannerControlledLiveV8HistoricalEvidence(root);
}

function reserve(
  root: string,
  historicalSnapshot: ReviewPlannerControlledLiveV8HistoricalEvidenceSnapshot,
  runId: string,
) {
  return reserveReviewPlannerControlledLiveV8Evidence({
    root,
    historicalSnapshot,
    startedAt: '2026-07-18T12:00:00.000Z',
    runId,
  });
}

async function preparedReservation(root: string, runId: string) {
  const reservation = await reserve(root, await snapshot(root), runId);
  await reservation.markAttempted();
  for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGES.slice(1, 9)) {
    if (!advanceReviewPlannerControlledLiveV8Stage(reservation, stage)) {
      throw new Error(`stage failed: ${stage}`);
    }
  }
  return reservation;
}

function failureSummary(): SafeReviewPlannerControlledLiveV8Summary {
  return {
    status: 'invalid_attempted',
    gate: 'closed',
    providerAttemptCount: 1,
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
  };
}

function completeSummary(): SafeReviewPlannerControlledLiveV8Summary {
  return {
    status: 'complete',
    gate: 'closed',
    providerAttemptCount: 23,
    usageKnown: true,
    aggregateInputTokens: 42_996,
    aggregateOutputTokens: 9_712,
    observedCostCny: 0.18726,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
    caseEntries: 48,
    zeroCallCases: 26,
    runtimeInvocations: 22,
    strictSuccesses: 48,
    qualityPasses: 48,
    criticalFailures: 0,
  };
}

function expectEvidenceIo(value: Record<string, unknown>) {
  expect(value).toMatchObject({
    state: 'finalized',
    status: 'invalid_attempted',
    gate: 'closed',
    usageKnown: false,
    diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
  });
  expect(value).not.toHaveProperty('aggregateInputTokens');
  expect(value).not.toHaveProperty('observedCostCny');
}

async function copyHistory(root: string) {
  const sourceRoot = resolve(process.cwd());
  await Promise.all(
    historicalDirectories.map((directory) =>
      cp(join(sourceRoot, directory), join(root, directory), {
        recursive: true,
        force: true,
      }),
    ),
  );
}
