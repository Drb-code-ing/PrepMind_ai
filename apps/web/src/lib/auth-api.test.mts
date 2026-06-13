import assert from 'node:assert/strict';

import { mapAuthUserToCurrentUser } from './auth-user-mapper.ts';

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
    avatarUrl: 'https://example.com/avatar.png',
  }),
  {
    id: 'user_1',
    username: '小明',
    email: 'student@example.com',
    phone: undefined,
    avatarUrl: 'https://example.com/avatar.png',
    role: 'STUDENT',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
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
    avatarUrl: undefined,
    role: 'STUDENT',
    createdAt: '2026-06-11T00:00:00.000Z',
    updatedAt: '2026-06-11T00:00:00.000Z',
  },
);
