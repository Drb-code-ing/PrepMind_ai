import { resolve } from 'node:path';

import {
  runReviewPlannerControlledLiveV7DeepSeekUsageParityCli,
  serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary,
} from '../src/review-agent/review-planner-controlled-live-eval-v7-deepseek-usage-parity.cli';

const FIXED_FAILURE =
  '{"status":"invalid_attempted","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"evidence_io"}';

async function main() {
  const summary = await runReviewPlannerControlledLiveV7DeepSeekUsageParityCli({
    argv: process.argv.slice(2),
    env: process.env,
    root: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerControlledLiveV7DeepSeekUsageParitySummary(summary)}\n`,
  );
  process.exitCode =
    summary.status === 'complete' &&
    summary.gate === 'eligible_for_separate_product_acceptance'
      ? 0
      : 1;
}

void main().catch(() => {
  process.stdout.write(`${FIXED_FAILURE}\n`);
  process.exitCode = 1;
});
