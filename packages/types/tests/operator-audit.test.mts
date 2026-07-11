import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  operatorAuditActionSchema,
  operatorAuditLogDetailResponseSchema,
  operatorAuditLogListQuerySchema,
  operatorAuditLogListResponseSchema,
} from '../src/api/operator-audit.ts';

describe('operator audit api contract', () => {
  it('accepts export request and download audit actions', () => {
    assert.deepEqual(operatorAuditActionSchema.options, [
      'OUTBOX_REQUEUE',
      'AUDIT_EXPORT_REQUEST',
      'AUDIT_EXPORT_DOWNLOAD',
    ]);
  });

  it('parses empty list query with safe defaults', () => {
    assert.deepEqual(operatorAuditLogListQuerySchema.parse({}), { limit: 20 });
  });

  it('caps list query limit at 100', () => {
    assert.throws(() => operatorAuditLogListQuerySchema.parse({ limit: '101' }));
  });

  it('validates redacted list response shape', () => {
    const parsed = operatorAuditLogListResponseSchema.parse({
      items: [
        {
          id: 'audit_1',
          actorUserId: 'user_admin',
          action: 'OUTBOX_REQUEUE',
          status: 'SUCCEEDED',
          targetType: 'OutboxEvent',
          targetId: 'evt_1',
          reason: 'fixed provider config',
          requestId: 'req_1',
          ipAddressHash: 'sha256:abc',
          userAgentHash: 'sha256:def',
          errorCode: null,
          errorPreview: null,
          createdAt: '2026-07-08T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    assert.equal(parsed.items[0]?.action, 'OUTBOX_REQUEUE');
  });

  it('validates redacted detail response shape without raw metadata', () => {
    const parsed = operatorAuditLogDetailResponseSchema.parse({
      id: 'audit_1',
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      status: 'FAILED',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      reason: 'retry after dependency recovery',
      requestId: 'req_1',
      ipAddressHash: 'sha256:abc',
      userAgentHash: 'sha256:def',
      errorCode: 'OUTBOX_EVENT_NOT_REQUEUEABLE',
      errorPreview: 'Only failed or dead events can be requeued',
      createdAt: '2026-07-08T10:00:00.000Z',
    });

    assert.equal(parsed.id, 'audit_1');
    assert.throws(() =>
      operatorAuditLogDetailResponseSchema.parse({
        ...parsed,
        metadata: { payload: 'secret' },
      }),
    );
  });
});
