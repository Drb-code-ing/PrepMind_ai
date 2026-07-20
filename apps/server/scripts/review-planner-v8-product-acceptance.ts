import { resolve } from 'node:path';

import {
  executeReviewPlannerV8ProductAcceptanceProductCli,
  parseReviewPlannerV8ProductAcceptanceArguments,
  serializeReviewPlannerV8ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v8-product-acceptance-composition';

async function main() {
  const argv = process.argv.slice(2);
  parseReviewPlannerV8ProductAcceptanceArguments(argv, 'product');
  const repoRoot = resolve(__dirname, '../../..');
  const summary = await executeReviewPlannerV8ProductAcceptanceProductCli({
    argv,
    repoRoot,
  });
  process.stdout.write(
    `${serializeReviewPlannerV8ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'passed') process.exitCode = 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"stage":"operation","status":"failed","code":"operation_failed"}\n',
  );
  process.exitCode = 1;
});
