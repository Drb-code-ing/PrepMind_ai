import { resolve } from 'node:path';

import { executeReviewPlannerV21ProductAcceptanceProductCli } from '../src/review-agent/review-planner-v21-product-acceptance-cli';

export async function runReviewPlannerV21ReadOnlyPreflight(input: {
  argv: readonly string[];
  repoRoot: string;
}): Promise<
  | Readonly<{ stage: 'preflight'; status: 'ready'; environment: 'branch' | 'main' }>
  | Readonly<{ stage: 'preflight'; status: 'blocked'; code: 'default_off' }>
> {
  const result = await executeReviewPlannerV21ProductAcceptanceProductCli({
    argv: input.argv,
    repoRoot: input.repoRoot,
    preflightOnly: true,
  });
  if (
    result.status !== 'blocked' ||
    result.stage !== 'owner' ||
    result.code !== 'owner_active'
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
    environment:
      input.argv[1] === '--environment=main' ? ('main' as const) : ('branch' as const),
  });
}

async function main() {
  const result = await runReviewPlannerV21ReadOnlyPreflight({
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
