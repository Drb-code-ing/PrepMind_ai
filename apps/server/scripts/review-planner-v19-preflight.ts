import { resolve } from 'node:path';

import { parseReviewPlannerV19ProductAcceptanceArguments } from '../src/review-agent/review-planner-v19-product-acceptance-cli';
import { createDefaultReviewPlannerV19ProductAcceptanceComposition } from '../src/review-agent/review-planner-v19-product-acceptance-composition';

export async function runReviewPlannerV19ReadOnlyPreflight(input: {
  argv: readonly string[];
  repoRoot: string;
}): Promise<
  | Readonly<{ stage: 'preflight'; status: 'ready'; environment: 'branch' | 'main' }>
  | Readonly<{ stage: 'preflight'; status: 'blocked'; code: 'default_off' }>
> {
  const { environment } = parseReviewPlannerV19ProductAcceptanceArguments(
    input.argv,
    'product',
  );
  const composition = createDefaultReviewPlannerV19ProductAcceptanceComposition(
    input.repoRoot,
  );
  const result = await composition.ports.preflight({
    environment,
    repoRoot: input.repoRoot,
  });
  if (
    result.status !== 'ready' ||
    result.environment !== environment ||
    result.repoRoot !== input.repoRoot
  ) {
    return Object.freeze({
      stage: 'preflight' as const,
      status: 'blocked' as const,
      code: 'default_off' as const,
    });
  }
  return Object.freeze({
    stage: 'preflight' as const,
    status: 'ready' as const,
    environment,
  });
}

async function main() {
  const result = await runReviewPlannerV19ReadOnlyPreflight({
    argv: process.argv.slice(2),
    repoRoot: resolve(__dirname, '../../..'),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'ready') process.exitCode = 1;
}

void main().catch(() => {
  process.stdout.write(
    '{"stage":"preflight","status":"blocked","code":"default_off"}\n',
  );
  process.exitCode = 1;
});
