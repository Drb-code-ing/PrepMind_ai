import assert from 'node:assert/strict';
import test from 'node:test';

import {
  operatorAuditExportCreateRequestSchema,
  operatorAuditExportDetailResponseSchema,
  operatorAuditExportListQuerySchema,
  operatorAuditExportListResponseSchema,
} from '../src/api/operator-audit-export.ts';

const safeDetail = {
  id: 'export_1',
  requestedByUserId: 'user_admin',
  backgroundJobId: 'job_1',
  status: 'READY',
  filters: {
    action: null,
    status: null,
    targetType: null,
    targetId: null,
    actorUserId: null,
  },
  reason: 'incident review',
  startAt: '2026-07-01T00:00:00.000Z',
  endAt: '2026-07-10T00:00:00.000Z',
  snapshotAt: '2026-07-10T00:00:00.000Z',
  fileName: 'prepmind-operator-audit-20260701-20260710-export1.zip',
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
} as const;

test('accepts a strict export request with optional audit filters', () => {
  const parsed = operatorAuditExportCreateRequestSchema.parse({
    clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-10T00:00:00.000Z',
    reason: '  INC-2026-0710 Outbox retry review  ',
    action: 'OUTBOX_REQUEUE',
    status: 'FAILED',
    targetType: 'OutboxEvent',
    targetId: 'evt_1',
    actorUserId: 'user_admin',
  });

  assert.equal(parsed.reason, 'INC-2026-0710 Outbox retry review');
});

test('rejects unknown request fields', () => {
  assert.throws(() =>
    operatorAuditExportCreateRequestSchema.parse({
      clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
      startAt: '2026-07-01T00:00:00.000Z',
      endAt: '2026-07-10T00:00:00.000Z',
      reason: 'review export',
      objectKey: 'operator-audit-exports/secret.zip',
    }),
  );
});

test('rejects an export request whose local time range is not increasing', () => {
  assert.throws(() =>
    operatorAuditExportCreateRequestSchema.parse({
      clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
      startAt: '2026-07-10T00:00:00.000Z',
      endAt: '2026-07-01T00:00:00.000Z',
      reason: 'review export',
    }),
  );
});

test('parses strict stable list cursor filters', () => {
  const query = operatorAuditExportListQuerySchema.parse({
    status: 'READY',
    requestedByUserId: 'user_admin',
    createdFrom: '2026-07-01T00:00:00.000Z',
    createdTo: '2026-07-10T00:00:00.000Z',
    limit: '40',
    cursor: 'export_cursor',
  });

  assert.equal(query.limit, 40);
  assert.throws(() => operatorAuditExportListQuerySchema.parse({ ...query, payload: 'secret' }));
});

test('rejects a reversed export list creation window', () => {
  assert.throws(() =>
    operatorAuditExportListQuerySchema.parse({
      createdFrom: '2026-07-10T00:00:00.000Z',
      createdTo: '2026-07-01T00:00:00.000Z',
    }),
  );
});

test('allows an equal export list creation boundary', () => {
  const boundary = '2026-07-10T00:00:00.000Z';
  const query = operatorAuditExportListQuerySchema.parse({
    createdFrom: boundary,
    createdTo: boundary,
  });

  assert.equal(query.createdFrom, query.createdTo);
});

test('detail DTO rejects storage and internal delivery fields', () => {
  assert.deepEqual(operatorAuditExportDetailResponseSchema.parse(safeDetail), safeDetail);

  for (const field of ['objectKey', 'requestHash', 'processingToken', 'payload', 'metadata']) {
    assert.throws(
      () =>
        operatorAuditExportDetailResponseSchema.parse({
          ...safeDetail,
          [field]: 'secret',
        }),
      `expected ${field} to be rejected`,
    );
  }
});

test('detail DTO rejects unknown fields nested inside filters', () => {
  assert.throws(() =>
    operatorAuditExportDetailResponseSchema.parse({
      ...safeDetail,
      filters: {
        ...safeDetail.filters,
        objectKey: 'operator-audit-exports/export_1/attempts/token.zip',
      },
    }),
  );
});

test('list response contains only strict safe detail items', () => {
  const response = operatorAuditExportListResponseSchema.parse({
    items: [safeDetail],
    nextCursor: 'export_cursor',
  });

  assert.equal(response.items[0]?.id, 'export_1');
  assert.throws(() =>
    operatorAuditExportListResponseSchema.parse({
      items: [{ ...safeDetail, requestHash: `sha256:${'c'.repeat(64)}` }],
      nextCursor: null,
    }),
  );
});
