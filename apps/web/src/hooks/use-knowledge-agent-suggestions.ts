'use client';

import { useQuery } from '@tanstack/react-query';
import type { KnowledgeAgentSuggestionQuery } from '@repo/types/api/knowledge-agent';

import { apiClient } from '@/lib/api-client';
import { createKnowledgeAgentApi } from '@/lib/knowledge-agent-api';
import { knowledgeAgentQueryKeys } from '@/lib/knowledge-agent-query-keys';
import { useUserStore } from '@/stores/userStore';

type KnowledgeAgentSuggestionQueryInput = Partial<KnowledgeAgentSuggestionQuery>;

const knowledgeAgentApi = createKnowledgeAgentApi(apiClient);

export { knowledgeAgentQueryKeys };

export function useKnowledgeAgentSuggestions(
  query: KnowledgeAgentSuggestionQueryInput,
) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;

  return useQuery({
    queryKey: knowledgeAgentQueryKeys.suggestions(userId ?? 'anonymous', query),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing knowledge agent context');
      }
      return knowledgeAgentApi.getSuggestions(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}
