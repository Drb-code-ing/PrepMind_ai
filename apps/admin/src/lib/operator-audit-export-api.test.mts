import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorAuditExportApi } from './operator-audit-export-api.ts';

const readyExport = {
  id: 'export_1',
  requestedByUserId: 'user_admin',
  backgroundJobId: 'job_1',
  status: 'READY' as const,
  filters: {
    action: 'OUTBOX_REQUEUE' as const,
    status: 'FAILED' as const,
    targetType: 'OutboxEvent',
    targetId: 'evt_1',
    actorUserId: 'user_admin',
  },
  reason: 'incident review',
  startAt: '2026-07-01T00:00:00.000Z',
  endAt: '2026-07-10T00:00:00.000Z',
  snapshotAt: '2026-07-10T00:00:00.000Z',
  fileName: 'prepmind-operator-audit-export.zip',
  archiveSize: 1024,
  recordCount: 3,
  csvSha256: `sha256:${'a'.repeat(64)}`,
  archiveSha256: `sha256:${'b'.repeat(64)}`,
  schemaVersion: 1,
  errorCode: null,
  errorPreview: null,
  requestedAt: '2026-07-10T00:00:00.000Z',
  startedAt: '2026-07-10T00:00:01.000Z',
  completedAt: '2026-07-10T00:00:02.000Z',
  expiresAt: '2026-07-11T00:00:02.000Z',
  expiredAt: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:02.000Z',
  canDownload: true,
};

test('create/list/detail parse JSON through shared strict schemas', async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const client = {
    async get(path: string) {
      calls.push({ method: 'GET', path });
      return path.includes('/export_1')
        ? readyExport
        : { items: [readyExport], nextCursor: 'cursor_2' };
    },
    async post(path: string, body: unknown) {
      calls.push({ method: 'POST', path, body });
      return readyExport;
    },
    async download() {
      return {
        blob: new Blob(['zip']),
        fileName: 'prepmind-operator-audit-export.zip',
        sha256: readyExport.archiveSha256,
      };
    },
  };
  const api = createOperatorAuditExportApi(client);
  const input = {
    clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-10T00:00:00.000Z',
    reason: 'incident review',
  };

  assert.equal((await api.create(input, 'token')).id, 'export_1');
  assert.equal(
    (
      await api.list(
        {
          status: 'READY',
          requestedByUserId: 'user_admin',
          createdFrom: '2026-07-01T00:00:00.000Z',
          createdTo: '2026-07-10T00:00:00.000Z',
          limit: 40,
          cursor: 'cursor_1',
        },
        'token',
      )
    ).nextCursor,
    'cursor_2',
  );
  assert.equal((await api.detail('export_1', 'token')).backgroundJobId, 'job_1');
  assert.match(calls[1]?.path ?? '', /^\/operator-audit-exports\?status=READY&requestedByUserId=/);
  assert.match(calls[1]?.path ?? '', /createdFrom=.*&createdTo=.*&limit=40&cursor=cursor_1$/);
});

test('strict response parsing rejects internal export fields', async () => {
  const api = createOperatorAuditExportApi({
    async get() {
      return { ...readyExport, objectKey: 'operator-audit-exports/private.zip' };
    },
    async post() {
      return { ...readyExport, processingToken: 'private-token' };
    },
    async download() {
      throw new Error('unused');
    },
  });

  await assert.rejects(() => api.detail('export_1', 'token'));
  await assert.rejects(() =>
    api.create(
      {
        clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
        startAt: '2026-07-01T00:00:00.000Z',
        endAt: '2026-07-10T00:00:00.000Z',
        reason: 'incident review',
      },
      'token',
    ),
  );
});

test('list emits only the approved query keys and download uses the binary client', async () => {
  const paths: string[] = [];
  const client = {
    async get(path: string) {
      paths.push(path);
      return { items: [], nextCursor: null };
    },
    async post() {
      return readyExport;
    },
    async download(path: string, options: { accessToken?: string | null }) {
      paths.push(path);
      assert.equal(options.accessToken, 'token');
      return {
        blob: new Blob(['zip']),
        fileName: 'evidence.zip',
        sha256: readyExport.archiveSha256,
      };
    },
  };
  const api = createOperatorAuditExportApi(client);

  await api.list({ status: 'FAILED', limit: 20 }, 'token');
  const downloaded = await api.download('export/with slash', 'token');

  assert.equal(paths[0], '/operator-audit-exports?status=FAILED&limit=20');
  assert.equal(paths[1], '/operator-audit-exports/export%2Fwith%20slash/download');
  assert.equal(await downloaded.blob.text(), 'zip');
  assert.equal(downloaded.fileName, 'evidence.zip');
});
