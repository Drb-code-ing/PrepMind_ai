import {
  backgroundJobListQuerySchema,
  backgroundJobListResponseSchema,
  backgroundJobResponseSchema,
  type BackgroundJobListQuery,
  type BackgroundJobListResponse,
  type BackgroundJobResponse,
} from '@repo/types/api/background-job';

import { apiClient } from './api-client.ts';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createBackgroundJobApi(client: ApiClient) {
  return {
    async list(
      accessToken: string,
      query: BackgroundJobListQuery,
    ): Promise<BackgroundJobListResponse> {
      const parsed = backgroundJobListQuerySchema.parse(query);
      const params = new URLSearchParams();

      if (parsed.resourceType) params.set('resourceType', parsed.resourceType);
      if (parsed.resourceId) params.set('resourceId', parsed.resourceId);
      if (parsed.status) params.set('status', parsed.status);
      params.set('limit', String(parsed.limit));

      return backgroundJobListResponseSchema.parse(
        await client.get<unknown>(`/background-jobs?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getById(accessToken: string, id: string): Promise<BackgroundJobResponse> {
      return backgroundJobResponseSchema.parse(
        await client.get<unknown>(`/background-jobs/${encodeURIComponent(id)}`, {
          accessToken,
        }),
      );
    },
  };
}

export const backgroundJobApi = createBackgroundJobApi(apiClient);
