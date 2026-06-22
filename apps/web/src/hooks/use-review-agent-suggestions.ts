'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReviewAgentSuggestionQuery } from '@repo/types/api/review-agent';

import { apiClient } from '@/lib/api-client';
import { createReviewAgentApi } from '@/lib/review-agent-api';
import { useUserStore } from '@/stores/userStore';

const reviewAgentApi = createReviewAgentApi(apiClient);

export const reviewAgentQueryKeys = {
  all: ['review-agent'] as const,
  suggestions: (query: ReviewAgentSuggestionQuery) =>
    [...reviewAgentQueryKeys.all, 'suggestions', query] as const,
};

export function useReviewAgentSuggestions(query: ReviewAgentSuggestionQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewAgentQueryKeys.suggestions(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewAgentApi.getSuggestions(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}
