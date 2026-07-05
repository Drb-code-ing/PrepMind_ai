import {
  workerObservabilitySummaryResponseSchema,
  type WorkerObservabilitySummaryResponse,
} from '@repo/types/api/worker-observability';

import { apiClient } from './api-client.ts';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createWorkerObservabilityApi(client: ApiClient) {
  return {
    async getSummary(
      accessToken: string,
    ): Promise<WorkerObservabilitySummaryResponse> {
      return workerObservabilitySummaryResponseSchema.parse(
        await client.get<unknown>('/worker-observability/summary', {
          accessToken,
        }),
      );
    },
  };
}

export const workerObservabilityApi =
  createWorkerObservabilityApi(apiClient);
