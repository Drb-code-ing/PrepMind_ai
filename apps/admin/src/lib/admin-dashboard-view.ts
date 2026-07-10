import type { OperatorAuditLogListItem } from '@repo/types/api/operator-audit';
import type { OutboxEventListItem } from '@repo/types/api/outbox';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

export type AdminDashboardTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface AdminDashboardOverviewInput {
  readiness: WorkerReadinessResponse | null;
  failedOutboxEvents: OutboxEventListItem[];
  deadOutboxEvents: OutboxEventListItem[];
  recentAuditLogs: OperatorAuditLogListItem[];
  hasReadError: boolean;
}

export interface AdminDashboardOverview {
  tone: AdminDashboardTone;
  title: string;
  message: string;
  attentionCount: number;
  failedOutboxCount: number;
  deadOutboxCount: number;
  recentAuditCount: number;
}

export function buildAdminDashboardOverview(
  input: AdminDashboardOverviewInput,
): AdminDashboardOverview {
  const failedOutboxCount = input.failedOutboxEvents.length;
  const deadOutboxCount = input.deadOutboxEvents.length;
  const recentAuditCount = input.recentAuditLogs.length;
  const attentionCount =
    failedOutboxCount +
    deadOutboxCount +
    input.recentAuditLogs.filter((item) => item.status === 'FAILED').length +
    (input.readiness?.issues.length ?? 0);

  if (input.hasReadError) {
    return {
      tone: 'danger',
      title: '控制台数据读取异常',
      message: '请先确认后端服务、诊断开关和管理员权限，再进入具体页面排障。',
      attentionCount,
      failedOutboxCount,
      deadOutboxCount,
      recentAuditCount,
    };
  }

  if (input.readiness?.status === 'not_ready' || deadOutboxCount > 0) {
    return {
      tone: 'danger',
      title: '后台任务链路需要立即处理',
      message: '存在不可接流量状态或 DEAD outbox 事件，建议先进入 Outbox Ops 和 Worker Readiness。',
      attentionCount,
      failedOutboxCount,
      deadOutboxCount,
      recentAuditCount,
    };
  }

  if (input.readiness?.status === 'degraded' || failedOutboxCount > 0 || attentionCount > 0) {
    return {
      tone: 'warning',
      title: '后台任务链路有待关注项',
      message: '当前系统仍可查看，但存在失败事件、审计失败或 readiness issue，需要管理员复核。',
      attentionCount,
      failedOutboxCount,
      deadOutboxCount,
      recentAuditCount,
    };
  }

  if (input.readiness?.status === 'ready') {
    return {
      tone: 'success',
      title: '后台任务链路当前健康',
      message: 'Worker readiness、Outbox 和最近审计记录未发现需要立即处理的问题。',
      attentionCount,
      failedOutboxCount,
      deadOutboxCount,
      recentAuditCount,
    };
  }

  return {
    tone: 'neutral',
    title: '等待控制台数据',
    message: '控制台会读取 Worker、Outbox 和操作审计摘要，生成当前运维视图。',
    attentionCount,
    failedOutboxCount,
    deadOutboxCount,
    recentAuditCount,
  };
}

export function formatDashboardTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
