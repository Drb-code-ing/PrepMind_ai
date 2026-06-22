'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import {
  createWrongQuestionApi,
  type UpdateLocalWrongQuestionRequest,
  type WrongQuestionListFilters,
} from '@/lib/wrong-question-api';
import { createWrongQuestionOrganizerApi } from '@/lib/wrong-question-organizer-api';
import type { WrongQuestionRecord } from '@/lib/db';
import { useUserStore } from '@/stores/userStore';

const wrongQuestionApi = createWrongQuestionApi(apiClient);
const wrongQuestionOrganizerApi = createWrongQuestionOrganizerApi(apiClient);
const wrongQuestionOrganizerAllQueryKey = ['wrong-question-organizer'] as const;

export const wrongQuestionQueryKeys = {
  all: ['wrong-questions'] as const,
  list: (filters: WrongQuestionListFilters) =>
    [...wrongQuestionQueryKeys.all, 'list', filters] as const,
};

export function useWrongQuestions(filters: WrongQuestionListFilters = {}) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: wrongQuestionQueryKeys.list(filters),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionApi.list(accessToken, filters);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useCreateWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (record: WrongQuestionRecord) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionApi.create(accessToken, record);
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerAllQueryKey });

      if (!accessToken) {
        return;
      }

      void wrongQuestionOrganizerApi
        .organizeOne(accessToken, created.id, { force: false })
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerAllQueryKey });
        })
        .catch((error: unknown) => {
          console.warn('保存错题成功，但自动归类失败。', error);
        });
    },
  });
}

export function useUpdateWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateLocalWrongQuestionRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionApi.update(accessToken, id, patch);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerAllQueryKey });
    },
  });
}

export function useDeleteWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      await wrongQuestionApi.delete(accessToken, id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerAllQueryKey });
    },
  });
}
