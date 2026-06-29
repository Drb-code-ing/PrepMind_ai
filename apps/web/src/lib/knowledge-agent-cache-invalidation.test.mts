import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = findRepoRoot(process.cwd());
const source = readFileSync(
  join(root, 'apps', 'web', 'src', 'hooks', 'use-knowledge.ts'),
  'utf8',
);

assert.match(
  source,
  /knowledgeAgentQueryKeys/,
  'knowledge mutations should know about the knowledge agent cache',
);

const agentInvalidations = source.match(
  /queryClient\.invalidateQueries\(\{ queryKey: knowledgeAgentQueryKeys\.all \}\)/g,
);

assert.equal(
  agentInvalidations?.length,
  4,
  'upload, replace, process, and delete should refresh knowledge agent suggestions',
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
