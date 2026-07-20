import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  runReviewPlannerControlledLiveV9GateDiagnosticsCli,
  serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary,
  type SafeReviewPlannerControlledLiveV9Summary,
} from '../src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.cli';
import {
  advanceReviewPlannerControlledLiveV9Stage,
  commitReviewPlannerControlledLiveV9GateDiagnostic,
  completeReviewPlannerControlledLiveV9Validation,
  finalizeReviewPlannerControlledLiveV9Success,
  reserveReviewPlannerControlledLiveV9Evidence,
  snapshotReviewPlannerControlledLiveV9HistoricalEvidence,
  verifyReviewPlannerControlledLiveV9HistoricalEvidence,
} from '../src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import {
  createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator,
  validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight,
} from '../src/review-agent/review-planner-controlled-live-eval-v9-gate-diagnostics.factory';

const TOP_LEVEL_FAILURE = Object.freeze({
  status: 'invalid_attempted',
  gate: 'closed',
  providerAttemptCount: 0,
  pairedAdmissionCount: 0,
  usageKnown: false,
  diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
} satisfies SafeReviewPlannerControlledLiveV9Summary);

async function main() {
  const root = resolve(__dirname, '../../..');
  const summary = await runReviewPlannerControlledLiveV9GateDiagnosticsCli(
    {
      argv: process.argv.slice(2),
      env: process.env,
      root,
      now: Date.now,
      runId: randomUUID(),
    },
    {
      validatePreflight:
        validateReviewPlannerControlledLiveV9GateDiagnosticsPreflight,
      snapshotHistoricalEvidence:
        snapshotReviewPlannerControlledLiveV9HistoricalEvidence,
      verifyHistoricalEvidence:
        verifyReviewPlannerControlledLiveV9HistoricalEvidence,
      reserveEvidence: reserveReviewPlannerControlledLiveV9Evidence,
      advanceStage: advanceReviewPlannerControlledLiveV9Stage,
      createEvaluator:
        createReviewPlannerControlledLiveV9GateDiagnosticsEvaluator,
      commitDiagnostic: commitReviewPlannerControlledLiveV9GateDiagnostic,
      completeValidation: completeReviewPlannerControlledLiveV9Validation,
      finalizeSuccess: finalizeReviewPlannerControlledLiveV9Success,
    },
  );
  process.stdout.write(
    serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(summary),
  );
  process.exitCode = summary.status === 'complete' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    serializeReviewPlannerControlledLiveV9GateDiagnosticsSummary(
      TOP_LEVEL_FAILURE,
    ),
  );
  process.exitCode = 1;
});
