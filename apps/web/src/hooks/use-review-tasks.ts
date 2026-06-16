'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewRatingRequest } from '@repo/types/api/review';
import type {
  ReviewTaskListQuery,
  ReviewTaskPlanQuery,
  ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';

import { apiClient } from '@/lib/api-client';
import { createReviewTaskApi } from '@/lib/review-task-api';
import { useUserStore } from '@/stores/userStore';
import { reviewQueryKeys } from './use-reviews';

const reviewTaskApi = createReviewTaskApi(apiClient);

export const reviewTaskQueryKeys = {
  all: ['review-tasks'] as const,
  today: (query: ReviewTaskTodayQuery) =>
    [...reviewTaskQueryKeys.all, 'today', query] as const,
  list: (query: ReviewTaskListQuery) =>
    [...reviewTaskQueryKeys.all, 'list', query] as const,
  plan: (query: ReviewTaskPlanQuery) =>
    [...reviewTaskQueryKeys.all, 'plan', query] as const,
};

export function useTodayReviewTaskList(query: ReviewTaskTodayQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.today(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.getToday(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useReviewTaskList(query: ReviewTaskListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.list(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.list(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useReviewTaskPlan(query: ReviewTaskPlanQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: reviewTaskQueryKeys.plan(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.getPlan(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useSubmitReviewTaskRating() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      taskId,
      request,
    }: {
      taskId: string;
      request: ReviewRatingRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.submitRating(accessToken, taskId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}

export function useSkipReviewTask() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.skip(accessToken, taskId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}

export function useReopenReviewTask() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return reviewTaskApi.reopen(accessToken, taskId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
    },
  });
}
