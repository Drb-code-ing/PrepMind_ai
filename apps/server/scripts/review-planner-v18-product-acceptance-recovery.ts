import { resolve } from 'node:path';

import {
  executeReviewPlannerV18ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV18ProductAcceptanceCliFailure,
  serializeReviewPlannerV18ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v18-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV18ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV18ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV18ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
