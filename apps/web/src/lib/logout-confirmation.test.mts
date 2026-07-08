import assert from 'node:assert/strict';

import {
  getLogoutConfirmationView,
  type LogoutConfirmationInput,
} from './logout-confirmation.ts';

function run() {
  testKeepsLogoutBehindConfirmation();
  testPendingStateWinsOverConfirmationCopy();
}

function testKeepsLogoutBehindConfirmation() {
  const base: LogoutConfirmationInput = {
    confirming: false,
    pending: false,
  };

  assert.deepEqual(getLogoutConfirmationView(base), {
    state: 'idle',
    primaryLabel: '退出登录',
    secondaryLabel: null,
    description: null,
  });

  assert.deepEqual(getLogoutConfirmationView({ ...base, confirming: true }), {
    state: 'confirming',
    primaryLabel: '确认退出',
    secondaryLabel: '取消',
    description: '退出后需要重新登录才能继续同步学习记录。',
  });
}

function testPendingStateWinsOverConfirmationCopy() {
  assert.deepEqual(
    getLogoutConfirmationView({
      confirming: true,
      pending: true,
    }),
    {
      state: 'pending',
      primaryLabel: '退出中...',
      secondaryLabel: null,
      description: '正在安全退出当前账号。',
    },
  );
}

run();
