import assert from 'node:assert/strict';

import { resolveApiClientBaseUrl } from './api-client.ts';

assert.equal(
  resolveApiClientBaseUrl({
    PREPMIND_INTERNAL_API_BASE_URL: 'http://server:3001',
    NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001',
  }),
  'http://server:3001',
);

assert.equal(
  resolveApiClientBaseUrl(
    {
      NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001',
    },
    new URL('http://localhost:3100/worker'),
  ),
  'http://localhost:3001',
);

assert.equal(
  resolveApiClientBaseUrl(
    {
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
    },
    new URL('http://127.0.0.1:3100/worker'),
  ),
  'http://127.0.0.1:3001',
);

assert.equal(
  resolveApiClientBaseUrl(
    {
      NEXT_PUBLIC_API_BASE_URL: 'https://api.example.com',
    },
    new URL('http://localhost:3100/worker'),
  ),
  'https://api.example.com',
);
