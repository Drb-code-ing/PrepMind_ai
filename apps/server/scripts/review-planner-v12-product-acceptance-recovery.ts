import { resolve } from 'node:path';

import {
  executeReviewPlannerV12ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV12ProductAcceptanceCliFailure,
  serializeReviewPlannerV12ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v12-product-acceptance-cli';

async function main() {
  const summary = await executeReviewPlannerV12ProductAcceptanceRecoveryCli({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerV12ProductAcceptanceCliSummary(summary)}\n`,
  );
  process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stdout.write(
    `${serializeReviewPlannerV12ProductAcceptanceCliFailure('recovery', error)}\n`,
  );
  process.exitCode = 1;
});
