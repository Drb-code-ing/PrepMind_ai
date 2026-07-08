import assert from 'node:assert/strict';
import test from 'node:test';

import { createOperatorAuditApi } from './operator-audit-api.ts';

test('lists operator audit logs with all supported filters', async () => {
  const calls: Array<{ path: string; accessToken?: string | null }> = [];
  const api = createOperatorAuditApi({
    get: async (path, options) => {
      calls.push({ path, accessToken: options?.accessToken });
      return createListResponse();
    },
  });

  const result = await api.list('token_1', {
    action: 'OUTBOX_REQUEUE',
    status: 'FAILED',
    targetType: 'OUTBOX_EVENT',
    targetId: 'event_1',
    actorUserId: 'user_admin',
    limit: 50,
    cursor: 'cursor_1',
  });

  assert.equal(
    calls[0]?.path,
    '/operator-audit-logs?action=OUTBOX_REQUEUE&status=FAILED&targetType=OUTBOX_EVENT&targetId=event_1&actorUserId=user_admin&limit=50&cursor=cursor_1',
  );
  assert.equal(calls[0]?.accessToken, 'token_1');
  assert.equal(result.items[0]?.id, 'audit_1');
  assert.equal(result.nextCursor, 'cursor_2');
});

test('lists operator audit logs with schema defaults', async () => {
  const calls: Array<{ path: string; accessToken?: string | null }> = [];
  const api = createOperatorAuditApi({
    get: async (path, options) => {
      calls.push({ path, accessToken: options?.accessToken });
      return createListResponse();
    },
  });

  await api.list('token_1', {});

  assert.equal(calls[0]?.path, '/operator-audit-logs?limit=20');
});

function createListResponse() {
  return {
    items: [
      {
        id: 'audit_1',
        actorUserId: 'user_admin',
        action: 'OUTBOX_REQUEUE' as const,
        status: 'FAILED' as const,
        targetType: 'OUTBOX_EVENT',
        targetId: 'event_1',
        reason: 'manual retry after transient failure',
        requestId: 'req_1',
        ipAddressHash: 'ip_hash_1',
        userAgentHash: 'ua_hash_1',
        errorCode: 'OUTBOX_REQUEUE_FAILED',
        errorPreview: 'handler failed with sanitized error',
        createdAt: '2026-07-08T08:30:00.000Z',
      },
    ],
    nextCursor: 'cursor_2',
  };
}
