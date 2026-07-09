import type {
  OperatorAuditAction,
  OperatorAuditLogListQuery,
  OperatorAuditStatus,
} from '@repo/types/api/operator-audit';

export type OperatorAuditTone = 'success' | 'danger';

export function getOperatorAuditActionLabel(action: OperatorAuditAction) {
  if (action === 'OUTBOX_REQUEUE') return 'Outbox 重新入队';
  return action;
}

export function getOperatorAuditStatusLabel(status: OperatorAuditStatus) {
  return status === 'SUCCEEDED' ? '成功' : '失败';
}

export function getOperatorAuditStatusTone(status: OperatorAuditStatus): OperatorAuditTone {
  return status === 'SUCCEEDED' ? 'success' : 'danger';
}

export function hasOperatorAuditFilters(query: Partial<OperatorAuditLogListQuery>) {
  return Boolean(
    query.action ||
      query.status ||
      query.targetType?.trim() ||
      query.targetId?.trim() ||
      query.actorUserId?.trim(),
  );
}

export function formatOperatorAuditTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
