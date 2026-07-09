import {
  operatorAuditLogListQuerySchema,
  operatorAuditLogListResponseSchema,
  type OperatorAuditLogListQuery,
  type OperatorAuditLogListResponse,
} from '@repo/types/api/operator-audit';

import { apiClient } from './api-client.ts';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createOperatorAuditApi(client: ApiClient) {
  return {
    async list(
      accessToken: string,
      query: Partial<OperatorAuditLogListQuery>,
    ): Promise<OperatorAuditLogListResponse> {
      const parsed = operatorAuditLogListQuerySchema.parse(query);
      const params = new URLSearchParams();

      if (parsed.action) params.set('action', parsed.action);
      if (parsed.status) params.set('status', parsed.status);
      if (parsed.targetType) params.set('targetType', parsed.targetType);
      if (parsed.targetId) params.set('targetId', parsed.targetId);
      if (parsed.actorUserId) params.set('actorUserId', parsed.actorUserId);
      params.set('limit', String(parsed.limit));
      if (parsed.cursor) params.set('cursor', parsed.cursor);

      return operatorAuditLogListResponseSchema.parse(
        await client.get<unknown>(`/operator-audit-logs?${params.toString()}`, {
          accessToken,
        }),
      );
    },
  };
}

export const operatorAuditApi = createOperatorAuditApi(apiClient);
