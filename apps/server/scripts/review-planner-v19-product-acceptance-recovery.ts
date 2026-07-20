import { resolve } from 'node:path';

import {
  executeReviewPlannerV19ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV19ProductAcceptanceCliFailure,
  serializeReviewPlannerV19ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v19-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV19ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV19ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered') process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV19ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
