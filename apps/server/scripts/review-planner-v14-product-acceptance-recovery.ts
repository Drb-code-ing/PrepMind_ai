import { resolve } from 'node:path';

import {
  executeReviewPlannerV14ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV14ProductAcceptanceCliFailure,
  serializeReviewPlannerV14ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v14-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV14ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV14ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV14ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
