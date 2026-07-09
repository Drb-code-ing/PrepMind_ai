import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDevAiModeMutationRequest } from './dev-ai-mode-request-policy.ts';

test('allows localhost dev mode mutations with a valid access token', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://localhost:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async (token) => token === 'valid-token',
  });

  assert.deepEqual(result, { ok: true });
});

test('allows Docker standalone requests bound to 0.0.0.0 when host and origin are local', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://0.0.0.0:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async (token) => token === 'valid-token',
  });

  assert.deepEqual(result, { ok: true });
});

test('does not allow 0.0.0.0 as the external host header', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://0.0.0.0:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: '0.0.0.0:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});

test('rejects dev mode mutations without an access token', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://localhost:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: '',
    validateAccessToken: async () => true,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
  }
});

test('rejects dev mode mutations when the token fails server validation', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://localhost:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'invalid-token',
    validateAccessToken: async () => false,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
  }
});

test('rejects dev mode mutations from non-local hosts or origins', async () => {
  const remoteHostResult = await validateDevAiModeMutationRequest({
    request: new Request('http://192.168.1.20:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: '192.168.1.20:3000',
        origin: 'http://192.168.1.20:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.equal(remoteHostResult.ok, false);
  if (!remoteHostResult.ok) {
    assert.equal(remoteHostResult.status, 403);
  }

  const remoteOriginResult = await validateDevAiModeMutationRequest({
    request: new Request('http://localhost:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://example.test',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.equal(remoteOriginResult.ok, false);
  if (!remoteOriginResult.ok) {
    assert.equal(remoteOriginResult.status, 403);
  }
});

test('rejects malformed localhost targets and non-local request URLs', async () => {
  const malformedPortResult = await validateDevAiModeMutationRequest({
    request: new Request('http://localhost:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:not-a-port',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.equal(malformedPortResult.ok, false);
  if (!malformedPortResult.ok) {
    assert.equal(malformedPortResult.status, 403);
  }

  const remoteUrlResult = await validateDevAiModeMutationRequest({
    request: new Request('http://example.test/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.equal(remoteUrlResult.ok, false);
  if (!remoteUrlResult.ok) {
    assert.equal(remoteUrlResult.status, 403);
  }
});

test('accepts bracketed ipv6 localhost with a numeric port', async () => {
  const result = await validateDevAiModeMutationRequest({
    request: new Request('http://[::1]:3000/api/dev/ai-mode', {
      method: 'PUT',
      headers: {
        host: '[::1]:3000',
        origin: 'http://[::1]:3000',
      },
    }),
    accessToken: 'valid-token',
    validateAccessToken: async () => true,
  });

  assert.deepEqual(result, { ok: true });
});
