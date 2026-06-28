import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = findRepoRoot(process.cwd());

testMemoryAgentPanelExists();
testProfilePageUsesMemoryAgentPanel();

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

function testMemoryAgentPanelExists() {
  const componentPath = join(
    root,
    'apps',
    'web',
    'src',
    'components',
    'memory-agent',
    'memory-agent-panel.tsx',
  );

  assert.equal(existsSync(componentPath), true, 'MemoryAgent panel should exist');

  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /export function MemoryAgentPanel/);
  assert.match(source, /建议记住/);
  assert.match(source, /已确认记忆/);
  assert.match(source, /生成候选/);
  assert.match(source, /确认/);
  assert.match(source, /忽略/);
  assert.match(source, /停用/);
  assert.match(source, /恢复/);
  assert.match(source, /删除/);
  assert.match(source, /第一版不会自动把这些记忆用于每次对话/);
  assert.match(source, /useMemoryCandidates/);
  assert.match(source, /useState<Extract<UserMemoryStatus, 'ACTIVE' \| 'ARCHIVED'>>\('ACTIVE'\)/);
  assert.match(source, /useUserMemories\(userId, \{ status: memoryStatusFilter \}\)/);
  assert.match(source, /useGenerateMemoryCandidates/);
  assert.match(source, /useAcceptMemoryCandidate/);
  assert.match(source, /useRejectMemoryCandidate/);
  assert.match(source, /useUpdateUserMemory/);
  assert.match(source, /useDeleteUserMemory/);
  assert.match(source, /Sparkles/);
  assert.match(source, /Check/);
  assert.match(source, /X/);
  assert.match(source, /Archive/);
  assert.match(source, /Trash2/);
  assert.match(source, /RotateCcw/);
  assert.match(source, /使用中/);
  assert.match(source, /已停用/);
  assert.match(source, /tap-target|min-h-11/);
  assert.doesNotMatch(source, /\/api\/chat/);
}

function testProfilePageUsesMemoryAgentPanel() {
  const source = readSource('apps', 'web', 'src', 'app', '(main)', 'profile', 'page.tsx');

  assert.match(source, /MemoryAgentPanel/);
  assert.match(source, /<MemoryAgentPanel userId=\{userId\} \/>/);
}
