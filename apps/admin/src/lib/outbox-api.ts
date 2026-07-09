import {
  outboxEventDetailResponseSchema,
  outboxEventListResponseSchema,
  type OutboxEventDetailResponse,
  type OutboxEventListQuery,
  type OutboxEventListResponse,
  type OutboxEventRequeueRequest,
} from '@repo/types/api/outbox';

import { apiClient } from './api-client';

export const outboxApi = {
  async list(
    query: Partial<OutboxEventListQuery>,
    accessToken: string,
  ): Promise<OutboxEventListResponse> {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.type) params.set('type', query.type);
    if (query.cursor) params.set('cursor', query.cursor);
    params.set('limit', String(query.limit ?? 20));

    const path = `/outbox-events?${params.toString()}`;
    return outboxEventListResponseSchema.parse(await apiClient.get(path, { accessToken }));
  },

  async detail(id: string, accessToken: string): Promise<OutboxEventDetailResponse> {
    return outboxEventDetailResponseSchema.parse(
      await apiClient.get(`/outbox-events/${encodeURIComponent(id)}`, { accessToken }),
    );
  },

  async requeue(
    id: string,
    request: OutboxEventRequeueRequest,
    accessToken: string,
  ): Promise<OutboxEventDetailResponse> {
    return outboxEventDetailResponseSchema.parse(
      await apiClient.post(`/outbox-events/${encodeURIComponent(id)}/requeue`, request, {
        accessToken,
      }),
    );
  },
};
