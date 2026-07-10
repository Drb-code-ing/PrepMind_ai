import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError, createApiClient, resolveApiClientBaseUrl } from './api-client.ts';

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

test('downloads an authenticated ZIP and accepts only a safe attachment filename', async () => {
  let receivedUrl = '';
  let receivedInit: RequestInit | undefined;
  const client = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async (input, init) => {
      receivedUrl = String(input);
      receivedInit = init;
      return new Response(new Blob(['zip-bytes'], { type: 'application/zip' }), {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="audit-export_2026-07-11.zip"',
          'content-type': 'application/zip',
          'x-content-sha256': `sha256:${'a'.repeat(64)}`,
        },
      });
    },
  });

  const result = await client.download('/operator-audit-exports/export_1/download', {
    accessToken: 'access-token',
  });

  assert.equal(receivedUrl, 'http://127.0.0.1:3001/operator-audit-exports/export_1/download');
  assert.equal(receivedInit?.method, 'POST');
  assert.equal(new Headers(receivedInit?.headers).get('authorization'), 'Bearer access-token');
  assert.equal(receivedInit?.credentials, 'include');
  assert.equal(result.blob.type, 'application/zip');
  assert.equal(await result.blob.text(), 'zip-bytes');
  assert.equal(result.fileName, 'audit-export_2026-07-11.zip');
  assert.equal(result.sha256, `sha256:${'a'.repeat(64)}`);
});

test('falls back when a download filename is missing or unsafe', async () => {
  for (const contentDisposition of [
    null,
    'attachment; filename="../secret.zip"',
    'attachment; filename="audit export.zip"',
    "attachment; filename*=UTF-8''%2e%2e%2fsecret.zip",
  ]) {
    const client = createApiClient({
      baseUrl: 'http://127.0.0.1:3001',
      fetchImpl: async () =>
        new Response(new Blob(['zip']), {
          status: 200,
          headers: contentDisposition ? { 'content-disposition': contentDisposition } : {},
        }),
    });

    const result = await client.download('/download');
    assert.equal(result.fileName, 'prepmind-operator-audit-export.zip');
  }
});

test('parses the existing JSON error envelope only for failed downloads', async () => {
  const client = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async () =>
      Response.json(
        {
          success: false,
          error: { code: 'OPERATOR_AUDIT_EXPORT_EXPIRED', message: '证据包已过期' },
          requestId: 'request_1',
        },
        { status: 410 },
      ),
  });

  await assert.rejects(
    () => client.download('/download', { accessToken: 'access-token' }),
    (error: unknown) =>
      error instanceof ApiClientError &&
      error.status === 410 &&
      error.code === 'OPERATOR_AUDIT_EXPORT_EXPIRED' &&
      error.requestId === 'request_1',
  );
});

test('reports safe errors for failed download responses and network failures', async () => {
  const invalidClient = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async () => new Response('<html>failure</html>', { status: 502 }),
  });
  await assert.rejects(
    () => invalidClient.download('/download'),
    (error: unknown) =>
      error instanceof ApiClientError &&
      error.code === 'INVALID_API_RESPONSE' &&
      !error.message.includes('html'),
  );

  const networkClient = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async () => {
      throw new Error('secret network detail');
    },
  });
  await assert.rejects(
    () => networkClient.download('/download'),
    (error: unknown) =>
      error instanceof ApiClientError &&
      error.code === 'NETWORK_ERROR' &&
      !error.message.includes('secret'),
  );
});

test('keeps normal JSON request behavior after extracting API error conversion', async () => {
  const successClient = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async () => Response.json({ success: true, data: { id: 'record_1' } }),
  });
  assert.deepEqual(await successClient.get<{ id: string }>('/records'), { id: 'record_1' });

  const failureClient = createApiClient({
    baseUrl: 'http://127.0.0.1:3001',
    fetchImpl: async () =>
      Response.json(
        { success: false, error: { code: 'FORBIDDEN', message: '无权限' } },
        { status: 403 },
      ),
  });
  await assert.rejects(
    () => failureClient.get('/records'),
    (error: unknown) =>
      error instanceof ApiClientError && error.status === 403 && error.code === 'FORBIDDEN',
  );
});
