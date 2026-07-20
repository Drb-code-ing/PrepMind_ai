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
  assert.match(source, /break-words/);
  assert.match(source, /normalizeSuggestionHref/);
  assert.match(source, /min-h-11/);
  assert.match(source, /getReviewPlannerModelStatus/);
  assert.match(source, /reviewPlannerModelStatusLabels/);
  assert.match(source, /reviewPlannerModelStatusLabels\[modelStatus\]/);
  assert.match(source, /onPrimaryAction\?: \(\) => void/);
  assert.match(
    source,
    /onPrimaryAction \? \([\s\S]*?<button[\s\S]*?onClick=\{onPrimaryAction\}[\s\S]*?: \([\s\S]*?<Link/,
  );
  assert.doesNotMatch(source, /deepseek|api[_ -]?key|token|provider|raw error/i);
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
  assert.match(
    source,
    /suggestion=\{reviewAgentSuggestions\.data\}[\s\S]*?compact[\s\S]*?onPrimaryAction=\{focusTodayReview\}/,
  );
  assert.match(source, /id="today-review"/);
  assert.match(source, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /!todayReviewTasks\.isLoading[\s\S]*?!todayReviewTasks\.isError/);
  assert.match(source, /今天暂时没有待复习任务，可先按今日清单学习。/);
}
