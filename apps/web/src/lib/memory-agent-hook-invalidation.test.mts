import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = findRepoRoot(process.cwd());
const source = readFileSync(
  join(root, 'apps', 'web', 'src', 'hooks', 'use-memory-agent.ts'),
  'utf8',
);

assert.doesNotMatch(
  source,
  /void queryClient\.invalidateQueries\(\{ queryKey: memoryAgentQueryKeys\.user\(userId\) \}\)/,
);

const awaitedInvalidations = source.match(
  /return queryClient\.invalidateQueries\(\{ queryKey: memoryAgentQueryKeys\.user\(userId\) \}\)/g,
);

assert.equal(
  awaitedInvalidations?.length,
  5,
  'all MemoryAgent mutations should keep pending state until cache invalidation resolves',
);

function findRepoRoot(start: string) {
  let current = start;

  while (current !== dirname(current)) {
    if (existsSync(join(current, 'apps', 'web', 'src')) && existsSync(join(current, 'packages'))) {
      return current;
    }

    current = dirname(current);
  }

  return start;
}
