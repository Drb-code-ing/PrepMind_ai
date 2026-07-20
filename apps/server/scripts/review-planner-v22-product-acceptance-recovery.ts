import { resolve } from 'node:path';

import {
  executeReviewPlannerV22ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV22ProductAcceptanceCliFailure,
  serializeReviewPlannerV22ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v22-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV22ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV22ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV22ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
