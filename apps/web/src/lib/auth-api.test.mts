import assert from 'node:assert/strict';

import { mapAuthUserToCurrentUser } from './auth-api.ts';

const baseUser = {
  id: 'user_1',
  email: 'student@example.com',
  phone: null,
  avatarUrl: null,
  role: 'STUDENT' as const,
  createdAt: '2026-06-11T00:00:00.000Z',
  updatedAt: '2026-06-11T00:00:00.000Z',
};

assert.deepEqual(
  mapAuthUserToCurrentUser({
    ...baseUser,
    name: '小明',
  }),
  {
    id: 'user_1',
    username: '小明',
    email: 'student@example.com',
    phone: undefined,
  },
);

assert.deepEqual(
  mapAuthUserToCurrentUser({
    ...baseUser,
    name: null,
  }),
  {
    id: 'user_1',
    username: 'student',
    email: 'student@example.com',
    phone: undefined,
  },
);

