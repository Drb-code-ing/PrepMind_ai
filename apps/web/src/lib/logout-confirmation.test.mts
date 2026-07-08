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
    title: null,
    description: null,
  });

  assert.deepEqual(getLogoutConfirmationView({ ...base, confirming: true }), {
    state: 'confirming',
    primaryLabel: '退出登录',
    secondaryLabel: '继续学习',
    title: '退出当前账号？',
    description: '本机登录状态会清除，学习记录仍会保存在账号中。',
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
      title: '正在退出',
      description: '正在安全退出当前账号。',
    },
  );
}

run();
