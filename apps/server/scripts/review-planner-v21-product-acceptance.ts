import { resolve } from 'node:path';

import {
  executeReviewPlannerV21ProductAcceptanceProductCli,
  serializeReviewPlannerV21ProductAcceptanceCliFailure,
  serializeReviewPlannerV21ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v21-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV21ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV21ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV21ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
