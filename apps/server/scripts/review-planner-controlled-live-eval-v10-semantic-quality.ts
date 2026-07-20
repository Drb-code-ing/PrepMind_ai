import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  runReviewPlannerControlledLiveV10SemanticQualityCli,
  serializeReviewPlannerControlledLiveV10SemanticQualitySummary,
  type SafeReviewPlannerControlledLiveV10SemanticQualitySummary,
} from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.cli';
import {
  advanceReviewPlannerControlledLiveV10SemanticQualityStage,
  commitReviewPlannerControlledLiveV10SemanticQualityDiagnostic,
  completeReviewPlannerControlledLiveV10SemanticQualityValidation,
  finalizeReviewPlannerControlledLiveV10SemanticQualitySuccess,
  reserveReviewPlannerControlledLiveV10SemanticQualityEvidence,
  snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence,
  verifyReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence,
} from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.evidence';
import {
  createReviewPlannerControlledLiveV10SemanticQualityEvaluator,
  validateReviewPlannerControlledLiveV10SemanticQualityPreflight,
} from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.factory';

const FAILURE = Object.freeze({
  status: 'invalid_attempted', gate: 'closed', providerAttemptCount: 0,
  pairedAdmissionCount: 0, usageKnown: false,
  diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
} satisfies SafeReviewPlannerControlledLiveV10SemanticQualitySummary);

async function main() {
  const root = resolve(__dirname, '../../..');
  const summary = await runReviewPlannerControlledLiveV10SemanticQualityCli(
    { argv: process.argv.slice(2), env: process.env, root, now: Date.now, runId: randomUUID() },
    {
      validatePreflight: validateReviewPlannerControlledLiveV10SemanticQualityPreflight,
      snapshotHistoricalEvidence: snapshotReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence,
      verifyHistoricalEvidence: verifyReviewPlannerControlledLiveV10SemanticQualityHistoricalEvidence,
      reserveEvidence: reserveReviewPlannerControlledLiveV10SemanticQualityEvidence,
      advanceStage: advanceReviewPlannerControlledLiveV10SemanticQualityStage,
      createEvaluator: createReviewPlannerControlledLiveV10SemanticQualityEvaluator,
      commitDiagnostic: commitReviewPlannerControlledLiveV10SemanticQualityDiagnostic,
      completeValidation: completeReviewPlannerControlledLiveV10SemanticQualityValidation,
      finalizeSuccess: finalizeReviewPlannerControlledLiveV10SemanticQualitySuccess,
    },
  );
  process.stdout.write(serializeReviewPlannerControlledLiveV10SemanticQualitySummary(summary));
  process.exitCode = summary.status === 'complete' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(serializeReviewPlannerControlledLiveV10SemanticQualitySummary(FAILURE));
  process.exitCode = 1;
});
