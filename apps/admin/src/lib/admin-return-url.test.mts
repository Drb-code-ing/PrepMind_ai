import assert from 'node:assert/strict';

import { resolveLearningAppUrl } from './admin-return-url.ts';

assert.equal(
  resolveLearningAppUrl({
    explicitUrl: undefined,
    location: new URL('http://localhost:3100/outbox'),
  }),
  'http://localhost:3000',
);

assert.equal(
  resolveLearningAppUrl({
    explicitUrl: undefined,
    location: new URL('http://127.0.0.1:3100/worker'),
  }),
  'http://127.0.0.1:3000',
);

assert.equal(
  resolveLearningAppUrl({
    explicitUrl: 'http://learning.local:3000',
    location: new URL('http://admin.local:3100/audit'),
  }),
  'http://learning.local:3000',
);

assert.equal(
  resolveLearningAppUrl({
    explicitUrl: '   ',
    location: undefined,
  }),
  'http://127.0.0.1:3000',
);
