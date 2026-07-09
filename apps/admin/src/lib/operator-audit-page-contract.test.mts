import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pageSource = readFileSync(resolve(process.cwd(), 'apps/admin/src/app/audit/page.tsx'), 'utf8');
const apiSource = readFileSync(
  resolve(process.cwd(), 'apps/admin/src/lib/operator-audit-api.ts'),
  'utf8',
);

test('operator audit page exposes a selectable redacted detail panel', () => {
  assert.match(pageSource, /selectedId/);
  assert.match(pageSource, /operatorAuditApi\.detail/);
  assert.match(pageSource, /审计详情|操作上下文|来源指纹|错误摘要/);
  assert.match(pageSource, /aria-pressed/);
  assert.match(pageSource, /pm-scrollbar/);
  assert.doesNotMatch(pageSource, /metadata/);
  assert.doesNotMatch(pageSource, /payload/);
  assert.doesNotMatch(pageSource, /raw IP|原始 IP|raw User-Agent|原始 User-Agent/);
  assert.doesNotMatch(pageSource, /refreshToken|cookie/i);
});

test('operator audit api client supports redacted detail fetch', () => {
  assert.match(apiSource, /operatorAuditLogDetailResponseSchema/);
  assert.match(apiSource, /async detail/);
  assert.match(apiSource, /operator-audit-logs\/\$\{encodeURIComponent\(id\)\}/);
});
