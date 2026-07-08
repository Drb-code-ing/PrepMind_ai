import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAuthFieldChangeError,
  validateAuthEmail,
  validateAuthUsername,
  validateConfirmPassword,
  validateLoginPassword,
  validateRegisterPassword,
} from './auth-form-validation.ts';

test('validates auth email format before submit', () => {
  assert.equal(validateAuthEmail(''), '请输入邮箱');
  assert.equal(validateAuthEmail('student'), '请输入正确的邮箱格式');
  assert.equal(validateAuthEmail(' student@example.com '), null);
});

test('validates register name and password fields against backend contract', () => {
  assert.equal(validateAuthUsername(''), '请输入用户名');
  assert.equal(validateAuthUsername('a'.repeat(51)), '用户名最多 50 个字符');
  assert.equal(validateAuthUsername('小明'), null);

  assert.equal(validateRegisterPassword(''), '请输入密码');
  assert.equal(validateRegisterPassword('1234567'), '密码至少 8 位');
  assert.equal(validateRegisterPassword('a'.repeat(129)), '密码最多 128 位');
  assert.equal(validateRegisterPassword('password123'), null);
});

test('validates login password and register confirmation fields', () => {
  assert.equal(validateLoginPassword(''), '请输入密码');
  assert.equal(validateLoginPassword('a'.repeat(129)), '密码最多 128 位');
  assert.equal(validateLoginPassword('secret'), null);

  assert.equal(validateConfirmPassword('', 'password123'), '请确认密码');
  assert.equal(validateConfirmPassword('password124', 'password123'), '两次密码不一致');
  assert.equal(validateConfirmPassword('password123', 'password123'), null);
});

test('keeps field feedback active after submit or blur while allowing quiet first input', () => {
  assert.equal(
    getAuthFieldChangeError({
      feedbackActive: false,
      value: 'student',
      validate: validateAuthEmail,
    }),
    null,
  );

  assert.equal(
    getAuthFieldChangeError({
      feedbackActive: true,
      value: 'student',
      validate: validateAuthEmail,
    }),
    '请输入正确的邮箱格式',
  );

  assert.equal(
    getAuthFieldChangeError({
      feedbackActive: true,
      value: 'student@example.com',
      validate: validateAuthEmail,
    }),
    null,
  );
});
