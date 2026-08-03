import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const sourceStatus = pageSource.match(
  /function OrganizerSourceStatus[\s\S]*?(?=function OrganizeHistoryButton)/,
);

test('error book shows request-level organizer source only after active batch success', () => {
  assert.match(pageSource, /setOrganizerRuntime\(null\)/);
  assert.match(pageSource, /setOrganizerRuntime\(result\.runtime\)/);
  assert.match(
    pageSource,
    /organizerRuntime \? \([\s\S]*?<OrganizerSourceStatus runtime={organizerRuntime}/,
  );
});

test('organizer source status wraps safely at 390, 510, and 1440 widths', () => {
  assert.ok(sourceStatus, 'expected to find OrganizerSourceStatus');
  for (const viewportWidth of [390, 510, 1440]) {
    assert.match(sourceStatus[0], /\bw-full\b/, `${viewportWidth}px needs a bounded row`);
    assert.match(sourceStatus[0], /\bmin-w-0\b/, `${viewportWidth}px needs shrinkable text`);
    assert.match(sourceStatus[0], /\bflex-wrap\b/, `${viewportWidth}px needs wrapping`);
    assert.match(sourceStatus[0], /\bbreak-words\b/, `${viewportWidth}px needs safe word breaks`);
  }
});

test('organizer source status exposes no model retry, provider, token, cost, or trace control', () => {
  assert.ok(sourceStatus, 'expected to find OrganizerSourceStatus');
  assert.doesNotMatch(sourceStatus[0], /<button|重试模型|providerError|inputTokens|outputTokens|cost|traceId/);
});
