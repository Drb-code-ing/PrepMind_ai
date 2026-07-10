import assert from 'node:assert/strict';
import test from 'node:test';

import type { OperatorAuditExportDetailResponse } from '@repo/types/api/operator-audit-export';

import {
  canDownloadOperatorAuditExport,
  getOperatorAuditExportPollInterval,
  getOperatorAuditExportStatusPresentation,
  mergeOperatorAuditExportPages,
  transitionOperatorAuditExportRequest,
  triggerOperatorAuditExportDownload,
  validateOperatorAuditExportRange,
} from './operator-audit-export-view.ts';

function exportItem(
  status: OperatorAuditExportDetailResponse['status'],
  canDownload = false,
): OperatorAuditExportDetailResponse {
  return {
    id: `export_${status}`,
    requestedByUserId: 'admin_1',
    backgroundJobId: 'job_1',
    status,
    filters: { action: null, status: null, targetType: null, targetId: null, actorUserId: null },
    reason: 'incident review',
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-02T00:00:00.000Z',
    snapshotAt: '2026-07-02T00:00:00.000Z',
    fileName: status === 'READY' ? 'evidence.zip' : null,
    archiveSize: status === 'READY' ? 100 : null,
    recordCount: status === 'READY' ? 1 : null,
    csvSha256: status === 'READY' ? `sha256:${'a'.repeat(64)}` : null,
    archiveSha256: status === 'READY' ? `sha256:${'b'.repeat(64)}` : null,
    schemaVersion: 1,
    errorCode: status === 'FAILED' ? 'EXPORT_FAILED' : null,
    errorPreview: status === 'FAILED' ? 'safe failure' : null,
    requestedAt: '2026-07-02T00:00:00.000Z',
    startedAt: status === 'QUEUED' ? null : '2026-07-02T00:00:01.000Z',
    completedAt: ['READY', 'FAILED', 'EXPIRED'].includes(status)
      ? '2026-07-02T00:00:02.000Z'
      : null,
    expiresAt: ['READY', 'EXPIRED'].includes(status) ? '2026-07-03T00:00:02.000Z' : null,
    expiredAt: status === 'EXPIRED' ? '2026-07-03T00:00:03.000Z' : null,
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:02.000Z',
    canDownload,
  };
}

test('all export states have Chinese text and a non-color-only explanation', () => {
  const expected = {
    QUEUED: '排队中',
    PROCESSING: '生成中',
    READY: '可下载',
    FAILED: '生成失败',
    EXPIRED: '已过期',
  } as const;

  for (const [status, label] of Object.entries(expected)) {
    const presentation = getOperatorAuditExportStatusPresentation(
      status as OperatorAuditExportDetailResponse['status'],
    );
    assert.equal(presentation.label, label);
    assert.ok(presentation.tone.length > 0);
    assert.ok(presentation.description.length > 8);
  }
});

test('polls every five seconds only while at least one export is active', () => {
  assert.equal(getOperatorAuditExportPollInterval(undefined), false);
  assert.equal(getOperatorAuditExportPollInterval([]), false);
  assert.equal(getOperatorAuditExportPollInterval([exportItem('READY', true)]), false);
  assert.equal(getOperatorAuditExportPollInterval([exportItem('FAILED')]), false);
  assert.equal(getOperatorAuditExportPollInterval([exportItem('EXPIRED')]), false);
  assert.equal(getOperatorAuditExportPollInterval([exportItem('QUEUED')]), 5000);
  assert.equal(
    getOperatorAuditExportPollInterval([exportItem('READY', true), exportItem('PROCESSING')]),
    5000,
  );
});

test('validates missing, reversed, equal, and over-31-day ranges', () => {
  assert.deepEqual(validateOperatorAuditExportRange('', ''), {
    startAt: '请选择开始时间。',
    endAt: '请选择结束时间。',
  });
  assert.ok(validateOperatorAuditExportRange('2026-07-02T00:00', '2026-07-01T00:00').endAt);
  assert.ok(validateOperatorAuditExportRange('2026-07-01T00:00', '2026-07-01T00:00').endAt);
  assert.ok(validateOperatorAuditExportRange('2026-06-01T00:00', '2026-07-03T00:00').endAt);
  assert.deepEqual(validateOperatorAuditExportRange('2026-06-02T00:00', '2026-07-03T00:00'), {});
});

test('download is available only for READY DTOs whose canDownload is true', () => {
  assert.equal(canDownloadOperatorAuditExport(exportItem('READY', true)), true);
  assert.equal(canDownloadOperatorAuditExport(exportItem('READY', false)), false);
  assert.equal(canDownloadOperatorAuditExport(exportItem('EXPIRED', true)), false);
  assert.equal(canDownloadOperatorAuditExport(exportItem('FAILED', true)), false);
});

test('network and 5xx failures reuse the pending id only for the same request signature', () => {
  const first = transitionOperatorAuditExportRequest(null, {
    type: 'submit',
    requestSignature: 'range-a|reason-a|filters-a',
    generatedClientRequestId: 'request-1',
  });
  const afterNetwork = transitionOperatorAuditExportRequest(first, {
    type: 'retryable-failure',
  });
  const networkRetry = transitionOperatorAuditExportRequest(afterNetwork, {
    type: 'submit',
    requestSignature: 'range-a|reason-a|filters-a',
    generatedClientRequestId: 'request-2',
  });
  const after5xx = transitionOperatorAuditExportRequest(networkRetry, {
    type: 'retryable-failure',
  });

  assert.equal(networkRetry?.clientRequestId, 'request-1');
  assert.equal(after5xx?.clientRequestId, 'request-1');
});

test('any form or inherited-filter change clears the id and changing back never revives it', () => {
  let state = transitionOperatorAuditExportRequest(null, {
    type: 'submit',
    requestSignature: 'date-a|reason-a|filters-a',
    generatedClientRequestId: 'request-1',
  });
  for (const changedField of ['reason', 'date', 'parent-filters']) {
    state = transitionOperatorAuditExportRequest(state, { type: 'request-changed' });
    assert.equal(state, null, `${changedField} change must clear pending id`);
    state = transitionOperatorAuditExportRequest(state, {
      type: 'submit',
      requestSignature: `changed-${changedField}`,
      generatedClientRequestId: `request-${changedField}`,
    });
  }
  state = transitionOperatorAuditExportRequest(state, { type: 'request-changed' });
  const changedBack = transitionOperatorAuditExportRequest(state, {
    type: 'submit',
    requestSignature: 'date-a|reason-a|filters-a',
    generatedClientRequestId: 'request-new',
  });
  assert.equal(changedBack?.clientRequestId, 'request-new');
});

test('confirmed success and final request failures clear pending id', () => {
  const pending = transitionOperatorAuditExportRequest(null, {
    type: 'submit',
    requestSignature: 'request-a',
    generatedClientRequestId: 'request-1',
  });
  assert.equal(transitionOperatorAuditExportRequest(pending, { type: 'success' }), null);
  assert.equal(transitionOperatorAuditExportRequest(pending, { type: 'final-failure' }), null);
});

test('cursor page merge keeps newest-page order and first version for duplicate ids', () => {
  const newestA = exportItem('READY', true);
  const newestB = {
    ...exportItem('PROCESSING'),
    id: 'export_shared',
    updatedAt: '2026-07-03T00:00:00.000Z',
  };
  const staleB = { ...newestB, status: 'QUEUED' as const, updatedAt: '2026-07-01T00:00:00.000Z' };
  const olderC = { ...exportItem('FAILED'), id: 'export_older' };

  const merged = mergeOperatorAuditExportPages([
    [newestA, newestB],
    [staleB, olderC],
  ]);

  assert.deepEqual(
    merged.map((item) => item.id),
    [newestA.id, 'export_shared', 'export_older'],
  );
  assert.equal(merged[1], newestB);
});

test('temporary Blob URL is revoked even when clicking the download anchor fails', () => {
  const events: string[] = [];
  const anchor = {
    download: '',
    href: '',
    click() {
      events.push('click');
      throw new Error('click failed');
    },
    remove() {
      events.push('remove');
    },
  };

  assert.throws(() =>
    triggerOperatorAuditExportDownload(
      { blob: new Blob(['zip']), fileName: 'evidence.zip' },
      {
        createObjectURL() {
          events.push('create');
          return 'blob:download';
        },
        revokeObjectURL(url) {
          events.push(`revoke:${url}`);
        },
        createAnchor() {
          events.push('anchor');
          return anchor;
        },
      },
    ),
  );

  assert.deepEqual(events, ['create', 'anchor', 'click', 'remove', 'revoke:blob:download']);
  assert.equal(anchor.download, 'evidence.zip');
  assert.equal(anchor.href, 'blob:download');
});
