import {
  workerReadinessResponseSchema,
  type WorkerReadinessResponse,
} from '@repo/types/api/worker-readiness';

import { apiClient } from './api-client';

export const workerReadinessApi = {
  async get(accessToken: string): Promise<WorkerReadinessResponse> {
    return workerReadinessResponseSchema.parse(
      await apiClient.get('/worker-readiness', { accessToken }),
    );
  },
};
