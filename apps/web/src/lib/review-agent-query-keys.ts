import type { ReviewAgentSuggestionQuery } from '@repo/types/api/review-agent';

type ReviewAgentSuggestionQueryInput = Partial<ReviewAgentSuggestionQuery>;

function normalizeSuggestionQuery(query: ReviewAgentSuggestionQueryInput) {
  return {
    days: query.days ?? 7,
    startDate: query.startDate,
    timezoneOffsetMinutes: query.timezoneOffsetMinutes ?? 0,
  };
}

export const reviewAgentQueryKeys = {
  all: ['review-agent'] as const,
  suggestions: (userId: string, query: ReviewAgentSuggestionQueryInput) =>
    [
      ...reviewAgentQueryKeys.all,
      userId,
      'suggestions',
      normalizeSuggestionQuery(query),
    ] as const,
};
