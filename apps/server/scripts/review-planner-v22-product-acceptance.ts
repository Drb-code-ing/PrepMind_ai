import { resolve } from 'node:path';

import {
  executeReviewPlannerV22ProductAcceptanceProductCli,
  serializeReviewPlannerV22ProductAcceptanceCliFailure,
  serializeReviewPlannerV22ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v22-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV22ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV22ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV22ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
