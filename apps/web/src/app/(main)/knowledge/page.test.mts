import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const suggestionsPanel = pageSource.match(
  /function KnowledgeAgentSuggestionsPanel[\s\S]*?(?=function KnowledgeDedupSuggestionCard)/,
);

test('knowledge suggestions render a wrapping read-only source state', () => {
  assert.ok(suggestionsPanel, 'expected to find the knowledge suggestions panel');
  assert.match(suggestionsPanel[0], /getKnowledgeAgentSourceView\(suggestions\)/);
  assert.match(suggestionsPanel[0], /{sourceView\.label}/);
  assert.match(suggestionsPanel[0], /{sourceView\.description}/);
  assert.match(suggestionsPanel[0], /\bmin-w-0\b/);
  assert.match(suggestionsPanel[0], /\bbreak-words\b/);
});

test('knowledge source state keeps existing loading and request error fallbacks', () => {
  assert.ok(suggestionsPanel, 'expected to find the knowledge suggestions panel');
  assert.match(suggestionsPanel[0], /正在分析资料关系/);
  assert.match(suggestionsPanel[0], /资料管理建议暂时不可用，资料上传和检索不受影响/);
  assert.match(suggestionsPanel[0], /getKnowledgeAgentEmptyMessage\(\)/);
});

test('knowledge source state exposes no retry, cost, or automatic mutation action', () => {
  assert.ok(suggestionsPanel, 'expected to find the knowledge suggestions panel');
  assert.doesNotMatch(suggestionsPanel[0], /<button/);
  assert.doesNotMatch(suggestionsPanel[0], /estimatedCostCny|inputTokens|outputTokens/);
  assert.doesNotMatch(suggestionsPanel[0], /自动整理|重试语义建议/);
});
