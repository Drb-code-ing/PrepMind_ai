import { resolve } from 'node:path';

import {
  executeReviewPlannerV20ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV20ProductAcceptanceCliFailure,
  serializeReviewPlannerV20ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v20-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV20ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV20ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV20ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
