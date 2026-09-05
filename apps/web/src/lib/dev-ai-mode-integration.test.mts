import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

const root = findRepoRoot(process.cwd());

test('agent trace keeps the local Mock Live control visible and selectable', () => {
  const source = readSource('apps', 'web', 'src', 'app', '(main)', 'agent-trace', 'page.tsx');

  assert.match(source, /<DevAiModeSwitch/);
  assert.match(source, /disabled=\{pending \|\| liveActive\}/);
  assert.doesNotMatch(source, /disabled=\{liveDisabled \|\| liveActive\}/);
});

test('chat route sends the same effective environment through every model runtime', () => {
  const source = readSource('apps', 'web', 'src', 'app', 'api', 'chat', 'route.ts');

  assert.match(source, /resolveChatProviderRuntime\(\)/);
  assert.match(source, /createChatModelAgentRuntimeBundle\(\{ env: chatRuntimeEnv \}\)/);
  assert.match(source, /createTutorModelRuntimeBundle\(\{ env: chatRuntimeEnv \}\)/);
  assert.match(
    source,
    /createRetrieverQueryRewriteModelRuntimeBundle\(\{\s*env: chatRuntimeEnv,?\s*\}\)/,
  );
  assert.match(source, /createChatFinalResponseRuntimeV1\([\s\S]*?env: chatRuntimeEnv/);
});

function readSource(...segments: string[]) {
  return readFileSync(join(root, ...segments), 'utf8');
}

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
