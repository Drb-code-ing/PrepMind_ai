'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ReviewLogListQuery,
  ReviewRatingRequest,
  ReviewStatsQuery,
} from '@repo/types/api/review';

import { apiClient } from '@/lib/api-client';
import { createReviewApi } from '@/lib/review-api';
import { useUserStore } from '@/stores/userStore';
import { wrongQuestionQueryKeys } from './use-wrong-questions';

const reviewApi = createReviewApi(apiClient);

export const reviewQueryKeys = {
  all: ['reviews'] as const,
  today: (date?: string) => [...reviewQueryKeys.all, 'today', date ?? 'server-date'] as const,
  byWrongQuestion: (wrongQuestionId: string) =>
    [...reviewQueryKeys.all, 'by-wrong-question', wrongQuestionId] as const,
  stats: (query: ReviewStatsQuery) => [...reviewQueryKeys.all, 'stats', query] as const,
  logs: (query: ReviewLogListQuery) => [...reviewQueryKeys.all, 'logs', query] as const,
};

export function useTodayReviewTasks(date?: string) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.today(date),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.getTodayTasks(accessToken, date);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useWrongQuestionReviewCard(wrongQuestionId: string | null | undefined) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.byWrongQuestion(wrongQuestionId ?? ''),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      if (!wrongQuestionId) {
        return { card: null };
      }
      return reviewApi.getByWrongQuestion(accessToken, wrongQuestionId);
    },
    enabled: sessionHydrated && !!accessToken && !!wrongQuestionId,
    retry: false,
  });
}

export function useReviewStats(query: ReviewStatsQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.stats(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.getStats(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useReviewLogs(query: ReviewLogListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewQueryKeys.logs(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.getLogs(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreateReviewCardFromWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (wrongQuestionId: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.createFromWrongQuestion(accessToken, wrongQuestionId);
    },
    onSuccess: (_data, wrongQuestionId) => {
      void queryClient.invalidateQueries({
        queryKey: reviewQueryKeys.byWrongQuestion(wrongQuestionId),
      });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
    },
  });
}

export function useSubmitReviewRating() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      cardId,
      request,
    }: {
      cardId: string;
      request: ReviewRatingRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewApi.submitRating(accessToken, cardId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}
