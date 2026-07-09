import {
  operatorAuditLogListResponseSchema,
  type OperatorAuditLogListQuery,
  type OperatorAuditLogListResponse,
} from '@repo/types/api/operator-audit';

import { apiClient } from './api-client';

export const operatorAuditApi = {
  async list(
    query: Partial<OperatorAuditLogListQuery>,
    accessToken: string,
  ): Promise<OperatorAuditLogListResponse> {
    const params = new URLSearchParams();
    if (query.action) params.set('action', query.action);
    if (query.status) params.set('status', query.status);
    if (query.targetType) params.set('targetType', query.targetType);
    if (query.targetId) params.set('targetId', query.targetId);
    if (query.actorUserId) params.set('actorUserId', query.actorUserId);
    if (query.cursor) params.set('cursor', query.cursor);
    params.set('limit', String(query.limit ?? 30));

    return operatorAuditLogListResponseSchema.parse(
      await apiClient.get(`/operator-audit-logs?${params.toString()}`, { accessToken }),
    );
  },
};
