import {
  createReviewCardResponseSchema,
  reviewCardByWrongQuestionResponseSchema,
  reviewRatingResponseSchema,
  reviewTodayTasksResponseSchema,
  type ReviewRatingRequest,
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

    async submitRating(accessToken: string, cardId: string, request: ReviewRatingRequest) {
      return reviewRatingResponseSchema.parse(
        await client.post<unknown>(`/reviews/cards/${cardId}/rating`, request, {
          accessToken,
        }),
      );
    },
  };
}
