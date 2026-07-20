import { resolve } from 'node:path';

import {
  executeReviewPlannerV13ProductAcceptanceProductCli,
  serializeReviewPlannerV13ProductAcceptanceCliFailure,
  serializeReviewPlannerV13ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v13-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV13ProductAcceptanceProductCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV13ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV13ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
