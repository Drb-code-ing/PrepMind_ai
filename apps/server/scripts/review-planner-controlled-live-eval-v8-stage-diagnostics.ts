import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  runReviewPlannerControlledLiveV8StageDiagnosticsCli,
  serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary,
} from '../src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.cli';
import {
  advanceReviewPlannerControlledLiveV8Stage,
  finalizeReviewPlannerControlledLiveV8Evidence,
  readReviewPlannerControlledLiveV8Evidence,
  reserveReviewPlannerControlledLiveV8Evidence,
  snapshotReviewPlannerControlledLiveV8HistoricalEvidence,
  verifyReviewPlannerControlledLiveV8HistoricalEvidence,
  type SafeReviewPlannerControlledLiveV8Summary,
} from '../src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator,
  validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight,
} from '../src/review-agent/review-planner-controlled-live-eval-v8-stage-diagnostics.factory';

const TOP_LEVEL_FAILURE = Object.freeze({
  status: 'invalid_attempted',
  gate: 'closed',
  providerAttemptCount: 0,
  usageKnown: false,
  diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
} satisfies SafeReviewPlannerControlledLiveV8Summary);

async function main() {
  const root = resolve(__dirname, '../../..');
  const summary = await runReviewPlannerControlledLiveV8StageDiagnosticsCli(
    {
      argv: process.argv.slice(2),
      env: process.env,
      root,
      now: Date.now,
      runId: randomUUID(),
    },
    {
      validatePreflight:
        validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight,
      snapshotHistoricalEvidence:
        snapshotReviewPlannerControlledLiveV8HistoricalEvidence,
      verifyHistoricalEvidence:
        verifyReviewPlannerControlledLiveV8HistoricalEvidence,
      reserveEvidence: reserveReviewPlannerControlledLiveV8Evidence,
      advanceStage: advanceReviewPlannerControlledLiveV8Stage,
      createEvaluator:
        createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator,
      finalizeEvidence: finalizeReviewPlannerControlledLiveV8Evidence,
      readEvidence: readReviewPlannerControlledLiveV8Evidence,
    },
  );
  process.stdout.write(
    serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(summary),
  );
  process.exitCode = summary.status === 'complete' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    serializeReviewPlannerControlledLiveV8StageDiagnosticsSummary(
      TOP_LEVEL_FAILURE,
    ),
  );
  process.exitCode = 1;
});
