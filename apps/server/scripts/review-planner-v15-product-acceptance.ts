import { resolve } from 'node:path';

import {
  executeReviewPlannerV15ProductAcceptanceProductCli,
  serializeReviewPlannerV15ProductAcceptanceCliFailure,
  serializeReviewPlannerV15ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v15-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV15ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV15ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV15ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
