import { resolve } from 'node:path';

import {
  executeReviewPlannerV16ProductAcceptanceProductCli,
  serializeReviewPlannerV16ProductAcceptanceCliFailure,
  serializeReviewPlannerV16ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v16-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV16ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV16ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV16ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
