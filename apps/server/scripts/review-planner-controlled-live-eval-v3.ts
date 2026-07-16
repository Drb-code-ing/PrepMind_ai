import { resolve } from 'node:path';

import {
  executeReviewPlannerControlledLiveV3Cli,
  serializeReviewPlannerControlledLiveV3Summary,
} from '../src/review-agent/review-planner-controlled-live-eval-cli';

async function main() {
  const result = await executeReviewPlannerControlledLiveV3Cli({
    argv: process.argv.slice(2),
    env: process.env,
    root: resolve(__dirname, '../../..'),
  });

  process.stdout.write(
    `${serializeReviewPlannerControlledLiveV3Summary(result)}\n`,
  );
  process.exitCode = result.status === 'complete' && result.gate === 'open' ? 0 : 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"status":"diagnostic_blocked","gate":"closed","providerAttemptCount":0,"usageKnown":false,"diagnosticCode":"preflight_invalid"}\n',
  );
  process.exitCode = 1;
});
