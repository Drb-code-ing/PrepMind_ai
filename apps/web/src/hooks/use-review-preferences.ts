'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewPreferencePatchRequest } from '@repo/types/api/review-preference';

import { apiClient } from '@/lib/api-client';
import { createReviewPreferenceApi } from '@/lib/review-preference-api';
import { useUserStore } from '@/stores/userStore';
import { reviewTaskQueryKeys } from './use-review-tasks';

const reviewPreferenceApi = createReviewPreferenceApi(apiClient);

export const reviewPreferenceQueryKeys = {
  all: ['review-preferences'] as const,
  detail: () => [...reviewPreferenceQueryKeys.all, 'detail'] as const,
};

export function useReviewPreferences() {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewPreferenceQueryKeys.detail(),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewPreferenceApi.get(accessToken);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function usePatchReviewPreferences() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (request: ReviewPreferencePatchRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewPreferenceApi.patch(accessToken, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewPreferenceQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
    },
  });
}

