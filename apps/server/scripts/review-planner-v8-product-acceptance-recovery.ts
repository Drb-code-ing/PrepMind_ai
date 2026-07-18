import { resolve } from 'node:path';

import {
  createDefaultReviewPlannerV8ProductAcceptanceRecoveryPorts,
  parseReviewPlannerV8ProductAcceptanceArguments,
  runReviewPlannerV8ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV8ProductAcceptanceCliSummary,
} from '../src/review-agent/review-planner-v8-product-acceptance-composition';

async function main() {
  const argv = process.argv.slice(2);
  parseReviewPlannerV8ProductAcceptanceArguments(argv, 'recovery');
  const repoRoot = resolve(__dirname, '../../..');
  const summary = await runReviewPlannerV8ProductAcceptanceRecoveryCli({
    argv,
    repoRoot,
    ports: createDefaultReviewPlannerV8ProductAcceptanceRecoveryPorts(repoRoot),
  });
  process.stdout.write(
    `${serializeReviewPlannerV8ProductAcceptanceCliSummary(summary)}\n`,
  );
  if (summary.status !== 'recovered' && summary.status !== 'sealed') {
    process.exitCode = 1;
  }
}

void main().catch(() => {
  process.stdout.write(
    '{"stage":"recovery","status":"failed","code":"recovery_required"}\n',
  );
  process.exitCode = 1;
});
