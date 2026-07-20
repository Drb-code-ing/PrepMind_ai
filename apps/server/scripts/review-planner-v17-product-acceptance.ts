import { resolve } from 'node:path';

import {
  executeReviewPlannerV17ProductAcceptanceProductCli,
  serializeReviewPlannerV17ProductAcceptanceCliFailure,
  serializeReviewPlannerV17ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v17-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV17ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV17ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV17ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
