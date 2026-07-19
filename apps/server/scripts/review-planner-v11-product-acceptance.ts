import { resolve } from 'node:path';

import {
  executeReviewPlannerV11ProductAcceptanceProductCli,
  serializeReviewPlannerV11ProductAcceptanceCliFailure,
  serializeReviewPlannerV11ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v11-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV11ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV11ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV11ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
