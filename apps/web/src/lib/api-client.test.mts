import assert from 'node:assert/strict';

import { ApiClientError, createApiClient } from './api-client.ts';

async function run() {
  await testParsesSuccessEnvelope();
  await testThrowsApiFailure();
  await testThrowsInvalidJson();
  await testThrowsNetworkFailure();
}

async function testParsesSuccessEnvelope() {
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      assert.equal(String(input), 'http://localhost:3001/health');
      assert.equal(init?.credentials, 'include');

      return new Response(
        JSON.stringify({
          success: true,
          data: { ok: true },
          requestId: 'req_1',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });

  const result = await client.get<{ ok: boolean }>('/health');

  assert.deepEqual(result, { ok: true });
}

async function testThrowsApiFailure() {
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
          requestId: 'req_2',
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      ),
  });

  await assert.rejects(client.get('/auth/me'), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'UNAUTHORIZED');
    assert.equal(error.message, '请先登录');
    assert.equal(error.requestId, 'req_2');
    return true;
  });
}

async function testThrowsInvalidJson() {
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () =>
      new Response('not json', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      }),
  });

  await assert.rejects(client.get('/broken'), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 500);
    assert.equal(error.code, 'INVALID_API_RESPONSE');
    return true;
  });
}

async function testThrowsNetworkFailure() {
  const client = createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });

  await assert.rejects(client.post('/auth/login', {}), (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 0);
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(error.message, '网络连接失败，请稍后重试');
    return true;
  });
}

await run();

