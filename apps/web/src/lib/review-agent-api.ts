import {
  reviewAgentSuggestionQuerySchema,
  reviewAgentSuggestionResponseSchema,
  type ReviewAgentSuggestionQuery,
} from '@repo/types/api/review-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createReviewAgentApi(client: ApiClient) {
  return {
    async getSuggestions(accessToken: string, query: ReviewAgentSuggestionQuery) {
      const parsedQuery = reviewAgentSuggestionQuerySchema.parse(query);
      const params = new URLSearchParams();
      params.set('days', String(parsedQuery.days));
      if (parsedQuery.startDate) {
        params.set('startDate', parsedQuery.startDate);
      }
      params.set(
        'timezoneOffsetMinutes',
        String(parsedQuery.timezoneOffsetMinutes),
      );

      return reviewAgentSuggestionResponseSchema.parse(
        await client.get<unknown>(`/review-agent/suggestions?${params.toString()}`, {
          accessToken,
        }),
      );
    },
  };
}
