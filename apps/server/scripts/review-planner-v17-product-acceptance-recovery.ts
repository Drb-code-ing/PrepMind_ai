import { resolve } from 'node:path';

import {
  executeReviewPlannerV17ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV17ProductAcceptanceCliFailure,
  serializeReviewPlannerV17ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v17-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV17ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV17ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV17ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
