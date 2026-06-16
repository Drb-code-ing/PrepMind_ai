import { reviewRatingRequestSchema, type ReviewRatingRequest } from '@repo/types/api/review';
import {
  reviewTaskActionResponseSchema,
  reviewTaskListResponseSchema,
  reviewTaskPlanResponseSchema,
  reviewTaskRatingResponseSchema,
  reviewTaskTodayResponseSchema,
  type ReviewTaskListQuery,
  type ReviewTaskPlanQuery,
  type ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
};

export function createReviewTaskApi(client: ApiClient) {
  return {
    async getToday(accessToken: string, query: ReviewTaskTodayQuery) {
      const params = new URLSearchParams();
      if (query.date) {
        params.set('date', query.date);
      }
      params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));
      params.set('includeCompleted', String(query.includeCompleted));

      return reviewTaskTodayResponseSchema.parse(
        await client.get<unknown>(`/review-tasks/today?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async list(accessToken: string, query: ReviewTaskListQuery) {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('pageSize', String(query.pageSize));
      if (query.date) {
        params.set('date', query.date);
      }
      if (query.status) {
        params.set('status', query.status);
      }

      return reviewTaskListResponseSchema.parse(
        await client.get<unknown>(`/review-tasks?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getPlan(accessToken: string, query: ReviewTaskPlanQuery) {
      const params = new URLSearchParams();
      params.set('days', String(query.days));
      if (query.startDate) {
        params.set('startDate', query.startDate);
      }
      params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));

      return reviewTaskPlanResponseSchema.parse(
        await client.get<unknown>(`/review-tasks/plan?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async submitRating(accessToken: string, taskId: string, request: ReviewRatingRequest) {
      const body = reviewRatingRequestSchema.parse(request);
      return reviewTaskRatingResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/rating`, body, {
          accessToken,
        }),
      );
    },

    async skip(accessToken: string, taskId: string) {
      return reviewTaskActionResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/skip`, undefined, {
          accessToken,
        }),
      );
    },

    async reopen(accessToken: string, taskId: string) {
      return reviewTaskActionResponseSchema.parse(
        await client.post<unknown>(`/review-tasks/${taskId}/reopen`, undefined, {
          accessToken,
        }),
      );
    },
  };
}
