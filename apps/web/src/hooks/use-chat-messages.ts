'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api-client';
import {
  createChatMessageApi,
  type ChatMessageListFilters,
  type LocalChatMessagesResult,
} from '@/lib/chat-message-api';
import type { StoredMessage } from '@/lib/db';
import { useUserStore } from '@/stores/userStore';

const chatMessageApi = createChatMessageApi(apiClient);

export const chatMessageQueryKeys = {
  all: ['chat-messages'] as const,
  list: (filters: ChatMessageListFilters) =>
    [...chatMessageQueryKeys.all, 'list', filters] as const,
};

export function useChatMessages(filters: ChatMessageListFilters = {}) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: chatMessageQueryKeys.list(filters),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return chatMessageApi.list(accessToken, filters);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useSyncChatMessages() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      messages,
      conversationId,
    }: {
      messages: StoredMessage[];
      conversationId?: string | null;
    }): Promise<LocalChatMessagesResult> => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return chatMessageApi.sync(accessToken, messages, conversationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatMessageQueryKeys.all });
    },
  });
}

export function useClearChatMessages() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (conversationId?: string | null) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      await chatMessageApi.clear(accessToken, conversationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chatMessageQueryKeys.all });
    },
  });
}
