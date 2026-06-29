import type { KnowledgeAgentSuggestionQuery } from '@repo/types/api/knowledge-agent';

type KnowledgeAgentSuggestionQueryInput = Partial<KnowledgeAgentSuggestionQuery>;

function normalizeSuggestionQuery(query: KnowledgeAgentSuggestionQueryInput) {
  return {
    documentId: query.documentId,
    limit: query.limit ?? 20,
  };
}

export const knowledgeAgentQueryKeys = {
  all: ['knowledge-agent'] as const,
  suggestions: (userId: string, query: KnowledgeAgentSuggestionQueryInput) =>
    [
      ...knowledgeAgentQueryKeys.all,
      userId,
      'suggestions',
      normalizeSuggestionQuery(query),
    ] as const,
};
