import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = findRepoRoot(process.cwd());

testSuggestionCardExists();
testPlanPageUsesReviewAgentSuggestion();
testTodayPageUsesCompactReviewAgentSuggestion();

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

function testSuggestionCardExists() {
  const componentPath = join(
    root,
    'apps',
    'web',
    'src',
    'components',
    'review-agent',
    'review-agent-suggestion-card.tsx',
  );

  assert.equal(existsSync(componentPath), true, 'ReviewAgent suggestion card should exist');

  const source = readFileSync(componentPath, 'utf8');

  assert.match(source, /export function ReviewAgentSuggestionCard/);
  assert.match(source, /getReviewAgentPriorityMeta/);
  assert.match(source, /suggestion\.planner\.headline/);
  assert.match(source, /suggestion\.review\.weakPoints\.slice\(0, 3\)/);
  assert.match(source, /min-h-11/);
}

function testPlanPageUsesReviewAgentSuggestion() {
  const source = readSource('apps', 'web', 'src', 'app', '(main)', 'plan', 'page.tsx');

  assert.match(source, /useReviewAgentSuggestions/);
  assert.match(source, /ReviewAgentSuggestionCard/);
  assert.match(source, /agentSuggestion=\{reviewAgentSuggestions\.data\}/);
  assert.match(source, /agentSuggestion\?: ReviewAgentSuggestionResponse/);
}

function testTodayPageUsesCompactReviewAgentSuggestion() {
  const source = readSource('apps', 'web', 'src', 'app', '(main)', 'today', 'page.tsx');

  assert.match(source, /useReviewAgentSuggestions/);
  assert.match(source, /ReviewAgentSuggestionCard/);
  assert.match(source, /suggestion=\{reviewAgentSuggestions\.data\} compact/);
}
