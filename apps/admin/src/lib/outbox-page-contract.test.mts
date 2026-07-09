import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const pageSource = readFileSync(
  resolve(process.cwd(), 'apps/admin/src/app/outbox/page.tsx'),
  'utf8',
);

test('outbox page exposes operator workflow sections without payload disclosure', () => {
  assert.match(pageSource, /生命周期/);
  assert.match(pageSource, /事件身份/);
  assert.match(pageSource, /诊断建议/);
  assert.match(pageSource, /重新入队操作/);
  assert.match(pageSource, /后续验证/);
  assert.match(pageSource, /getOutboxAftercare/);
  assert.doesNotMatch(pageSource, />\s*Payload\s*</i);
  assert.doesNotMatch(pageSource, /payload\s*内容|完整 payload|查看 payload/i);
});

test('outbox page keeps dangerous operations out of the UI', () => {
  assert.doesNotMatch(pageSource, /批量重新入队|批量 requeue/i);
  assert.doesNotMatch(pageSource, /删除事件|delete event/i);
  assert.doesNotMatch(pageSource, /强制成功|force success/i);
  assert.doesNotMatch(pageSource, /跳过事件|skip event/i);
  assert.doesNotMatch(pageSource, /直接执行 handler|dispatch now/i);
  assert.doesNotMatch(pageSource, /编辑 payload|edit payload/i);
});
