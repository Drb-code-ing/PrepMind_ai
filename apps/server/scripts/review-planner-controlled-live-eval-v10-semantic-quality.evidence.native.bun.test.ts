import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { tmpdir } from 'node:os';

import { deriveV10SemanticQualityDiagnostic } from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.contract.ts';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES,
  advanceReviewPlannerControlledLiveV10SemanticQualityStage,
  commitReviewPlannerControlledLiveV10SemanticQualityDiagnostic,
  completeReviewPlannerControlledLiveV10SemanticQualityValidation,
  finalizeReviewPlannerControlledLiveV10SemanticQualitySuccess,
  readReviewPlannerControlledLiveV10SemanticQualityEvidence,
  reserveReviewPlannerControlledLiveV10SemanticQualityEvidence,
  snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence,
} from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.evidence.ts';

test('V10 native historical snapshot pins all V1 through V9 leaves before reservation', async () => {
  const snapshot =
    await snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(
      process.cwd(),
    );

  assert.equal(snapshot.schemaVersion,
    'phase-6.9.5-review-planner-historical-integrity-v10',
  );
  assert.equal(snapshot.entries.length, 32);
  assert.equal(
    snapshot.entries.some((entry) => entry.relativePath.includes('v9-gate-diagnostics')),
    true,
  );
  assert.match(snapshot.treeHash, /^[a-f0-9]{64}$/);
});

test('V10 reader rejects fresh V1-V9 history drift and unrecognized V10 leaves', async () => {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v10-reader-'));
  try {
    await cp(
      resolve(process.cwd(), 'docs/acceptance/evidence'),
      join(root, 'docs/acceptance/evidence'),
      { recursive: true },
    );
    const reservation = await reserveReviewPlannerControlledLiveV10SemanticQualityEvidence({
      root,
      startedAt: '2026-07-19T12:00:00.000Z',
      runId: 'reader-proof',
      historicalSnapshot:
        await snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(root),
    });
    assert.equal(await reservation.markAttempted(), true);
    for (const stage of REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_STAGES.slice(2, 8)) {
      assert.equal(await advanceReviewPlannerControlledLiveV10SemanticQualityStage(reservation, stage), true);
    }
    const diagnostic = passingDiagnostic();
    assert.notEqual(
      await commitReviewPlannerControlledLiveV10SemanticQualityDiagnostic({ root, reservation, diagnostic }),
      null,
    );
    assert.equal(
      await completeReviewPlannerControlledLiveV10SemanticQualityValidation({ root, reservation }),
      true,
    );
    assert.equal(
      await finalizeReviewPlannerControlledLiveV10SemanticQualitySuccess({ root, reservation, diagnostic }),
      true,
    );
    const initial = await readReviewPlannerControlledLiveV10SemanticQualityEvidence(root);
    assert.equal(initial.status, 'complete');

    await writeFile(
      join(root, 'docs/acceptance/evidence/phase-6-9-5-controlled-live-v9-gate-diagnostics/.stage-010-reserved'),
      'drift',
    );
    const afterHistoryDrift = await readReviewPlannerControlledLiveV10SemanticQualityEvidence(root);
    assert.equal(afterHistoryDrift.diagnosticCode, 'evidence_io');

    await writeFile(
      join(root, REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory, 'extra.json'),
      '{}',
    );
    const afterExtraLeaf = await readReviewPlannerControlledLiveV10SemanticQualityEvidence(root);
    assert.equal(afterExtraLeaf.diagnosticCode, 'evidence_io');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('V10 reservation rejects a junctioned evidence namespace before writing externally', async () => {
  if (process.platform !== 'win32') return;
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v10-junction-'));
  const outside = await mkdtemp(join(tmpdir(), 'prepmind-v10-outside-'));
  try {
    await cp(
      resolve(process.cwd(), 'docs/acceptance/evidence'),
      join(root, 'docs/acceptance/evidence'),
      { recursive: true },
    );
    const target = join(
      root,
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory,
    );
    await mkdir(resolve(target, '..'), { recursive: true });
    await symlink(outside, target, 'junction');

    await assert.rejects(
      reserveReviewPlannerControlledLiveV10SemanticQualityEvidence({
        root,
        startedAt: '2026-07-19T12:00:00.000Z',
        runId: 'junction-proof',
        historicalSnapshot:
          await snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence(root),
      }),
    );
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

function passingDiagnostic() {
  return deriveV10SemanticQualityDiagnostic({
    attempts: { providerCount: 23, expectedProviderCount: 23, pairedAdmissionCount: 22, expectedPairedAdmissionCount: 22, overflow: false, auditRecordCount: 23 },
    report: {
      schemaValid: true, caseEntries: 48, zeroCallCases: 26, zeroCallVerified: 26,
      runtimeInvocations: 22, budgetExceededCases: 0, strictSuccesses: 48,
      qualityPasses: 48, criticalFailures: 0, p95DurationMs: 1,
      productionDecision: 'quality_gate_passed',
      lanes: {
        review: { caseEntries: 24, runtimeCases: 11, zeroCallCases: 13, strictSuccesses: 24, qualityPasses: 24, criticalFailures: 0 },
        planner: { caseEntries: 24, runtimeCases: 11, zeroCallCases: 13, strictSuccesses: 24, qualityPasses: 24, criticalFailures: 0 },
      },
    },
    usage: { known: true, inputTokens: 42_000, outputTokens: 9_000 },
    cost: { evaluated: true, amountCny: 0.18, hardCapCny: 1, withinCap: true },
  });
}
