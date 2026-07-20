import { resolve } from 'node:path';

import {
  executeReviewPlannerControlledLiveCli,
  serializeReviewPlannerControlledLiveSummary,
} from '../src/review-agent/review-planner-controlled-live-eval-cli';

async function main() {
  const result = await executeReviewPlannerControlledLiveCli({
    argv: process.argv.slice(2),
    env: process.env,
    root: resolve(__dirname, '../../..'),
  });

  process.stdout.write(`${serializeReviewPlannerControlledLiveSummary(result)}\n`);
  process.exitCode = result.status === 'complete' && result.gate === 'open' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"status":"diagnostic_blocked","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"preflight_invalid"}\n',
  );
  process.exitCode = 1;
});
