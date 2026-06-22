'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MoveWrongQuestionToDeckRequest,
  OrganizeWrongQuestionBatchRequest,
  OrganizeWrongQuestionRequest,
  UpdateWrongQuestionDeckRequest,
} from '@repo/types/api/wrong-question-organizer';

import { apiClient } from '@/lib/api-client';
import {
  createWrongQuestionOrganizerApi,
  type WrongQuestionDeckQuestionListQueryInput,
} from '@/lib/wrong-question-organizer-api';
import { useUserStore } from '@/stores/userStore';
import { wrongQuestionQueryKeys } from './use-wrong-questions';

const wrongQuestionOrganizerApi = createWrongQuestionOrganizerApi(apiClient);

export const wrongQuestionOrganizerQueryKeys = {
  all: ['wrong-question-organizer'] as const,
  groups: () => [...wrongQuestionOrganizerQueryKeys.all, 'groups'] as const,
  decks: (subjectGroupId: string | null | undefined) =>
    [...wrongQuestionOrganizerQueryKeys.all, 'decks', subjectGroupId ?? ''] as const,
  deckQuestions: (
    deckId: string | null | undefined,
    query: WrongQuestionDeckQuestionListQueryInput,
  ) => {
    const normalized = normalizeDeckQuestionQuery(query);
    return [
      ...wrongQuestionOrganizerQueryKeys.all,
      'deck-questions',
      deckId ?? '',
      normalized.page,
      normalized.pageSize,
    ] as const;
  },
};

export function useWrongQuestionGroups() {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: wrongQuestionOrganizerQueryKeys.groups(),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.listGroups(accessToken);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useWrongQuestionDecks(subjectGroupId: string | null | undefined) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: wrongQuestionOrganizerQueryKeys.decks(subjectGroupId),
    queryFn: async () => {
      if (!accessToken || !subjectGroupId) {
        throw new Error('Missing wrong question subject group context');
      }
      return wrongQuestionOrganizerApi.listDecks(accessToken, subjectGroupId);
    },
    enabled: sessionHydrated && !!accessToken && !!subjectGroupId,
    retry: false,
  });
}

export function useWrongQuestionDeckQuestions(
  deckId: string | null | undefined,
  query: WrongQuestionDeckQuestionListQueryInput,
) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: wrongQuestionOrganizerQueryKeys.deckQuestions(deckId, query),
    queryFn: async () => {
      if (!accessToken || !deckId) {
        throw new Error('Missing wrong question deck context');
      }
      return wrongQuestionOrganizerApi.listDeckQuestions(
        accessToken,
        deckId,
        normalizeDeckQuestionQuery(query),
      );
    },
    enabled: sessionHydrated && !!accessToken && !!deckId,
    retry: false,
  });
}

export function useOrganizeWrongQuestion() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      wrongQuestionId,
      request,
    }: {
      wrongQuestionId: string;
      request: OrganizeWrongQuestionRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.organizeOne(accessToken, wrongQuestionId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
    },
  });
}

export function useOrganizeWrongQuestionBatch() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (request: OrganizeWrongQuestionBatchRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.organizeBatch(accessToken, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
    },
  });
}

export function useUpdateWrongQuestionDeck() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      deckId,
      request,
    }: {
      deckId: string;
      request: UpdateWrongQuestionDeckRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.updateDeck(accessToken, deckId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
    },
  });
}

export function useMoveWrongQuestionToDeck() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      deckId,
      request,
    }: {
      deckId: string;
      request: MoveWrongQuestionToDeckRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.moveToDeck(accessToken, deckId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
    },
  });
}

export function useRemoveWrongQuestionDeckItem() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      deckId,
      wrongQuestionId,
    }: {
      deckId: string;
      wrongQuestionId: string;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return wrongQuestionOrganizerApi.removeDeckItem(accessToken, deckId, wrongQuestionId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: wrongQuestionOrganizerQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: wrongQuestionQueryKeys.all });
    },
  });
}

function normalizeDeckQuestionQuery(query: WrongQuestionDeckQuestionListQueryInput) {
  return {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 20,
  };
}
