import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDailyIntensityLabel,
  getExplanationStyleLabel,
  getProfileSuccessMessage,
} from './profile-feedback.ts';

test('maps explanation style labels', () => {
  assert.equal(getExplanationStyleLabel('direct'), '先结论后推导');
  assert.equal(getExplanationStyleLabel('socratic'), '引导式追问');
  assert.equal(getExplanationStyleLabel('detailed'), '详细步骤拆解');
});

test('maps daily intensity labels', () => {
  assert.equal(getDailyIntensityLabel('light'), '轻量 20 分钟');
  assert.equal(getDailyIntensityLabel('standard'), '标准 35 分钟');
  assert.equal(getDailyIntensityLabel('intense'), '强化 60 分钟');
});

test('builds profile success messages', () => {
  assert.equal(getProfileSuccessMessage('name'), '昵称已更新');
  assert.equal(getProfileSuccessMessage('preferences'), '学习偏好已保存');
});
