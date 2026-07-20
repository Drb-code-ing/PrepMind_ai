import { resolve } from 'node:path';

import {
  executeReviewPlannerControlledLiveV5DeepSeekCli,
  serializeReviewPlannerControlledLiveV5DeepSeekSummary,
} from '../src/review-agent/review-planner-controlled-live-eval-v5-deepseek.cli';

async function main() {
  const result = await executeReviewPlannerControlledLiveV5DeepSeekCli({
    argv: process.argv.slice(2),
    env: process.env,
    root: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerControlledLiveV5DeepSeekSummary(result)}\n`,
  );
  process.exitCode =
    result.status === 'complete' && result.gate === 'open' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"status":"invalid_attempted","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"evidence_io"}\n',
  );
  process.exitCode = 1;
});
