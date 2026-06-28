import {
  acceptMemoryCandidateResponseSchema,
  deleteUserMemoryResponseSchema,
  generateMemoryCandidatesRequestSchema,
  generateMemoryCandidatesResponseSchema,
  memoryCandidateListQuerySchema,
  memoryCandidateListResponseSchema,
  rejectMemoryCandidateResponseSchema,
  updateUserMemoryRequestSchema,
  userMemoryListQuerySchema,
  userMemoryListResponseSchema,
  userMemorySchema,
  type GenerateMemoryCandidatesRequest,
  type MemoryCandidateListQuery,
  type UpdateUserMemoryRequest,
  type UserMemoryListQuery,
} from '@repo/types/api/memory-agent';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  patch: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export function createMemoryAgentApi(client: ApiClient) {
  return {
    async listCandidates(accessToken: string, query: MemoryCandidateListQuery) {
      const parsed = memoryCandidateListQuerySchema.parse(query);
      const params = new URLSearchParams({
        status: parsed.status,
        limit: String(parsed.limit),
      });

      return memoryCandidateListResponseSchema.parse(
        await client.get<unknown>(`/memory-agent/candidates?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async generateCandidates(accessToken: string, input: GenerateMemoryCandidatesRequest) {
      const parsed = generateMemoryCandidatesRequestSchema.parse(input);

      return generateMemoryCandidatesResponseSchema.parse(
        await client.post<unknown>('/memory-agent/candidates/generate', parsed, {
          accessToken,
        }),
      );
    },

    async acceptCandidate(accessToken: string, candidateId: string) {
      return acceptMemoryCandidateResponseSchema.parse(
        await client.post<unknown>(
          `/memory-agent/candidates/${candidateId}/accept`,
          {},
          { accessToken },
        ),
      );
    },

    async rejectCandidate(accessToken: string, candidateId: string) {
      return rejectMemoryCandidateResponseSchema.parse(
        await client.post<unknown>(
          `/memory-agent/candidates/${candidateId}/reject`,
          {},
          { accessToken },
        ),
      );
    },

    async listMemories(accessToken: string, query: UserMemoryListQuery) {
      const parsed = userMemoryListQuerySchema.parse(query);
      const params = new URLSearchParams({ status: parsed.status });
      if (parsed.type) params.set('type', parsed.type);

      return userMemoryListResponseSchema.parse(
        await client.get<unknown>(`/user-memories?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async updateMemory(accessToken: string, memoryId: string, input: UpdateUserMemoryRequest) {
      const parsed = updateUserMemoryRequestSchema.parse(input);

      return userMemorySchema.parse(
        await client.patch<unknown>(`/user-memories/${memoryId}`, parsed, {
          accessToken,
        }),
      );
    },

    async deleteMemory(accessToken: string, memoryId: string) {
      return deleteUserMemoryResponseSchema.parse(
        await client.delete<unknown>(`/user-memories/${memoryId}`, {
          accessToken,
        }),
      );
    },
  };
}
