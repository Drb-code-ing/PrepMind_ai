import {
  createReviewCardResponseSchema,
  reviewCardByWrongQuestionResponseSchema,
  reviewLogListResponseSchema,
  reviewRatingResponseSchema,
  reviewStatsResponseSchema,
  reviewTodayTasksResponseSchema,
  type ReviewLogListQuery,
  type ReviewRatingRequest,
  type ReviewStatsQuery,
} from '@repo/types/api/review';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
};

export function createReviewApi(client: ApiClient) {
  return {
    async createFromWrongQuestion(accessToken: string, wrongQuestionId: string) {
      return createReviewCardResponseSchema.parse(
        await client.post<unknown>(
          '/reviews/cards/from-wrong-question',
          { wrongQuestionId },
          { accessToken },
        ),
      );
    },

    async getByWrongQuestion(accessToken: string, wrongQuestionId: string) {
      return reviewCardByWrongQuestionResponseSchema.parse(
        await client.get<unknown>(`/reviews/cards/by-wrong-question/${wrongQuestionId}`, {
          accessToken,
        }),
      );
    },

    async getTodayTasks(accessToken: string, date?: string) {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      return reviewTodayTasksResponseSchema.parse(
        await client.get<unknown>(`/reviews/tasks/today${query}`, { accessToken }),
      );
    },

    async getStats(accessToken: string, query: ReviewStatsQuery) {
      const params = new URLSearchParams();
      params.set('range', query.range);
      if (query.endDate) {
        params.set('endDate', query.endDate);
      }
      params.set('timezoneOffsetMinutes', String(query.timezoneOffsetMinutes));

      return reviewStatsResponseSchema.parse(
        await client.get<unknown>(`/reviews/stats?${params.toString()}`, { accessToken }),
      );
    },

    async getLogs(accessToken: string, query: ReviewLogListQuery) {
      const params = new URLSearchParams();
      params.set('page', String(query.page));
      params.set('pageSize', String(query.pageSize));

      return reviewLogListResponseSchema.parse(
        await client.get<unknown>(`/reviews/logs?${params.toString()}`, { accessToken }),
      );
    },

    async submitRating(accessToken: string, cardId: string, request: ReviewRatingRequest) {
      return reviewRatingResponseSchema.parse(
        await client.post<unknown>(`/reviews/cards/${cardId}/rating`, request, {
          accessToken,
        }),
      );
    },
  };
}
