import {
  knowledgeAgentSuggestionQuerySchema,
  knowledgeAgentSuggestionResponseSchema,
  type KnowledgeAgentSuggestionQuery,
} from '@repo/types/api/knowledge-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

type KnowledgeAgentSuggestionQueryInput = Partial<KnowledgeAgentSuggestionQuery>;

export function createKnowledgeAgentApi(client: ApiClient) {
  return {
    async getSuggestions(
      accessToken: string,
      query: KnowledgeAgentSuggestionQueryInput,
    ) {
      const parsed = knowledgeAgentSuggestionQuerySchema.parse(query);
      const params = new URLSearchParams();
      params.set('limit', String(parsed.limit));
      if (parsed.documentId) {
        params.set('documentId', parsed.documentId);
      }

      return knowledgeAgentSuggestionResponseSchema.parse(
        await client.get<unknown>(
          `/knowledge-agent/suggestions?${params.toString()}`,
          {
            accessToken,
          },
        ),
      );
    },
  };
}
