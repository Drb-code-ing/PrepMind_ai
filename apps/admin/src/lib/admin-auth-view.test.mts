import assert from 'node:assert/strict';

import {
  getAdminGateView,
  validateAdminEmail,
  validateAdminPassword,
} from './admin-auth-view.ts';

assert.equal(validateAdminEmail(''), '请输入管理员邮箱');
assert.equal(validateAdminEmail('not-email'), '请输入正确的邮箱格式');
assert.equal(validateAdminEmail('admin@example.com'), null);

assert.equal(validateAdminPassword(''), '请输入密码');
assert.equal(validateAdminPassword('short'), '密码至少 8 位');
assert.equal(validateAdminPassword('Phase715Test!2026'), null);

assert.deepEqual(getAdminGateView({ hydrated: false, user: null }), {
  state: 'loading',
  title: '正在确认管理员身份',
  description: '后台管理需要先确认登录态和账号角色。',
});

assert.deepEqual(
  getAdminGateView({
    hydrated: true,
    user: { id: 'u1', email: 'student@example.com', name: 'student', role: 'STUDENT' },
  }),
  {
    state: 'forbidden',
    title: '当前账号不是管理员',
    description: '后台管理只开放给 ADMIN 账号，普通学习账号不能访问系统级诊断入口。',
  },
);

assert.equal(
  getAdminGateView({
    hydrated: true,
    user: { id: 'u2', email: 'admin@example.com', name: 'admin', role: 'ADMIN' },
  }).state,
  'allowed',
);
