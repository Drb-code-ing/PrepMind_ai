import assert from 'node:assert/strict';
import test from 'node:test';

import type { OperatorAuditLogListItem } from '@repo/types/api/operator-audit';
import type { OutboxEventListItem } from '@repo/types/api/outbox';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

import { buildAdminDashboardOverview } from './admin-dashboard-view.ts';

const baseTime = '2026-07-09T00:00:00.000Z';

function makeReadiness(status: WorkerReadinessResponse['status']): WorkerReadinessResponse {
  return {
    ready: status === 'ready',
    status,
    checkedAt: baseTime,
    server: {
      role: 'worker',
      knowledgeProcessingMode: 'queue',
    },
    checks: {
      redis: { status: 'pass', message: 'redis ok' },
      queue: {
        status: 'pass',
        message: 'queue ok',
        counts: { waiting: 0, active: 0, delayed: 0, failed: 0, paused: 0 },
        isPaused: false,
        hasBacklog: false,
      },
      workers: {
        status: 'pass',
        message: 'worker ok',
        onlineCount: 1,
        latestHeartbeatAt: baseTime,
      },
      outbox: {
        status: 'pass',
        message: 'outbox ok',
        deadCount: 0,
        hasBacklog: false,
        oldestPendingAgeMs: null,
      },
    },
    issues: status === 'ready' ? [] : ['worker heartbeat stale'],
  };
}

function makeOutbox(status: OutboxEventListItem['status']): OutboxEventListItem {
  return {
    id: `outbox-${status}`,
    type: 'knowledge.document.processing.requested',
    status,
    attempts: 1,
    maxAttempts: 3,
    nextRunAt: null,
    lockedAt: null,
    processedAt: null,
    lastErrorCode: status === 'SUCCEEDED' ? null : 'REDIS_TIMEOUT',
    createdAt: baseTime,
    updatedAt: baseTime,
    hasPayload: true,
    hasLastError: status !== 'SUCCEEDED',
    canRequeue: status === 'FAILED' || status === 'DEAD',
  };
}

function makeAudit(status: OperatorAuditLogListItem['status']): OperatorAuditLogListItem {
  return {
    id: `audit-${status}`,
    actorUserId: 'admin-user',
    action: 'OUTBOX_REQUEUE',
    status,
    targetType: 'OutboxEvent',
    targetId: 'outbox-1',
    reason: '已确认依赖恢复',
    requestId: 'req-1',
    ipAddressHash: 'ip-hash',
    userAgentHash: 'ua-hash',
    errorCode: status === 'FAILED' ? 'OUTBOX_EVENT_NOT_REQUEUEABLE' : null,
    errorPreview: null,
    createdAt: baseTime,
  };
}

test('admin dashboard reports healthy state when readiness is ready and no attention items exist', () => {
  const overview = buildAdminDashboardOverview({
    readiness: makeReadiness('ready'),
    failedOutboxEvents: [],
    deadOutboxEvents: [],
    recentAuditLogs: [makeAudit('SUCCEEDED')],
    hasReadError: false,
  });

  assert.equal(overview.tone, 'success');
  assert.equal(overview.attentionCount, 0);
  assert.match(overview.title, /健康/);
});

test('admin dashboard escalates dead outbox events above degraded warnings', () => {
  const overview = buildAdminDashboardOverview({
    readiness: makeReadiness('degraded'),
    failedOutboxEvents: [makeOutbox('FAILED')],
    deadOutboxEvents: [makeOutbox('DEAD')],
    recentAuditLogs: [],
    hasReadError: false,
  });

  assert.equal(overview.tone, 'danger');
  assert.equal(overview.deadOutboxCount, 1);
  assert.equal(overview.failedOutboxCount, 1);
});

test('admin dashboard treats read errors as an operator-visible state', () => {
  const overview = buildAdminDashboardOverview({
    readiness: null,
    failedOutboxEvents: [],
    deadOutboxEvents: [],
    recentAuditLogs: [makeAudit('FAILED')],
    hasReadError: true,
  });

  assert.equal(overview.tone, 'danger');
  assert.equal(overview.attentionCount, 1);
  assert.match(overview.message, /管理员权限/);
});
