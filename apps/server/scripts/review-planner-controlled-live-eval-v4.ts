import { resolve } from 'node:path';

import {
  executeReviewPlannerControlledLiveV4Cli,
  serializeReviewPlannerControlledLiveV4Summary,
} from '../src/review-agent/review-planner-controlled-live-eval-v4-cli';

async function main() {
  const result = await executeReviewPlannerControlledLiveV4Cli({
    argv: process.argv.slice(2),
    env: process.env,
    root: resolve(__dirname, '../../..'),
  });
  process.stdout.write(
    `${serializeReviewPlannerControlledLiveV4Summary(result)}\n`,
  );
  process.exitCode = result.status === 'complete' && result.gate === 'open' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"status":"invalid_attempted","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"evidence_io"}\n',
  );
  process.exitCode = 1;
});
