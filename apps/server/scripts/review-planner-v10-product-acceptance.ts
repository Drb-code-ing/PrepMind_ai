import { resolve } from 'node:path';

import {
  executeReviewPlannerV10ProductAcceptanceProductCli,
  parseReviewPlannerV10ProductAcceptanceArguments,
  serializeReviewPlannerV10ProductAcceptanceCliFailure,
  serializeReviewPlannerV8ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v8-product-acceptance-composition';

async function main() {
  const argv = process.argv.slice(2);
  parseReviewPlannerV10ProductAcceptanceArguments(argv, 'product');
  const repoRoot = resolve(__dirname, '../../..');
  const summary = await executeReviewPlannerV10ProductAcceptanceProductCli({
    argv,
    repoRoot,
  });
  process.stdout.write(
    `${serializeReviewPlannerV8ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV10ProductAcceptanceCliFailure('product', error)}\n`,
  );
  process.exitCode = 1;
});
