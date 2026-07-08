import type { OperatorAuditLogListQuery } from '@repo/types/api/operator-audit';

type OperatorAuditLogListQueryInput = Partial<OperatorAuditLogListQuery>;

function normalizeListQuery(query: OperatorAuditLogListQueryInput) {
  return {
    action: query.action,
    status: query.status,
    targetType: query.targetType,
    targetId: query.targetId,
    actorUserId: query.actorUserId,
    limit: query.limit ?? 20,
    cursor: query.cursor,
  };
}

export const operatorAuditQueryKeys = {
  all: ['operator-audit-logs'] as const,
  user: (userId: string) => [...operatorAuditQueryKeys.all, userId] as const,
  list: (userId: string, query: OperatorAuditLogListQueryInput) =>
    [...operatorAuditQueryKeys.user(userId), 'list', normalizeListQuery(query)] as const,
};
