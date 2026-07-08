import assert from 'node:assert/strict';
import test from 'node:test';

import { loginRequestSchema, registerRequestSchema } from '../src/api/auth.ts';

test('auth request schemas reject impossible short passwords consistently', () => {
  assert.equal(
    registerRequestSchema.safeParse({
      email: 'student@example.com',
      password: '1234',
      name: '小明',
    }).success,
    false,
  );

  assert.equal(
    loginRequestSchema.safeParse({
      email: 'student@example.com',
      password: '1234',
    }).success,
    false,
  );
});
