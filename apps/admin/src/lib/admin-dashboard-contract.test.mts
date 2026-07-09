import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pageSource = readFileSync(resolve(process.cwd(), 'apps/admin/src/app/page.tsx'), 'utf8');
const adminCssSource = readFileSync(resolve(process.cwd(), 'apps/admin/src/app/globals.css'), 'utf8');
const webCssSource = readFileSync(resolve(process.cwd(), 'apps/web/src/app/globals.css'), 'utf8');

test('admin dashboard is an operational overview rather than a jump-card grid', () => {
  assert.match(pageSource, /Worker Readiness|后台任务链路|Outbox/);
  assert.match(pageSource, /最近需要关注|处理队列|操作审计/);
  assert.match(pageSource, /useQuery/);
  assert.match(pageSource, /workerReadinessApi\.get/);
  assert.match(pageSource, /outboxApi\.list/);
  assert.match(pageSource, /operatorAuditApi\.list/);
  assert.match(pageSource, /<Link/);
  assert.doesNotMatch(pageSource, /getAdminNavItems\(\)\.map/);
  assert.doesNotMatch(pageSource, /<a\s+key=\{item\.href\}/);
});

test('admin and learning app share low-visibility scrollbar utilities', () => {
  assert.match(adminCssSource, /\.pm-scrollbar/);
  assert.match(adminCssSource, /scrollbar-width:\s*thin/);
  assert.match(adminCssSource, /::-webkit-scrollbar/);
  assert.match(adminCssSource, /html::-webkit-scrollbar/);
  assert.match(webCssSource, /\.pm-scrollbar/);
  assert.match(webCssSource, /scrollbar-width:\s*thin/);
  assert.match(webCssSource, /html::-webkit-scrollbar/);
  assert.match(webCssSource, /@media\s*\(max-width:\s*768px\)/);
});
