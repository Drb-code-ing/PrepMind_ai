'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReviewAgentSuggestionQuery } from '@repo/types/api/review-agent';

import { apiClient } from '@/lib/api-client';
import { createReviewAgentApi } from '@/lib/review-agent-api';
import { reviewAgentQueryKeys } from '@/lib/review-agent-query-keys';
import { useUserStore } from '@/stores/userStore';

const reviewAgentApi = createReviewAgentApi(apiClient);

export { reviewAgentQueryKeys };

export function useReviewAgentSuggestions(query: ReviewAgentSuggestionQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;

  return useQuery({
    queryKey: reviewAgentQueryKeys.suggestions(userId ?? 'anonymous', query),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing access token');
      }
      return reviewAgentApi.getSuggestions(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}
