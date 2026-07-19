import assert from 'node:assert/strict';
import { test } from 'node:test';

import { snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence } from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.evidence.ts';

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
