import type {
  MemoryCandidateListQuery,
  UserMemoryListQuery,
} from '@repo/types/api/memory-agent';

type MemoryCandidateListQueryInput = Partial<MemoryCandidateListQuery>;
type UserMemoryListQueryInput = Partial<UserMemoryListQuery>;

function normalizeCandidateQuery(query: MemoryCandidateListQueryInput) {
  return {
    status: query.status ?? 'PENDING',
    limit: query.limit ?? 20,
  };
}

function normalizeMemoryQuery(query: UserMemoryListQueryInput) {
  return {
    status: query.status ?? 'ACTIVE',
    type: query.type,
  };
}

export const memoryAgentQueryKeys = {
  all: ['memory-agent'] as const,
  user: (userId: string) => [...memoryAgentQueryKeys.all, userId] as const,
  candidates: (userId: string, query: MemoryCandidateListQueryInput) =>
    [
      ...memoryAgentQueryKeys.user(userId),
      'candidates',
      normalizeCandidateQuery(query),
    ] as const,
  memories: (userId: string, query: UserMemoryListQueryInput) =>
    [...memoryAgentQueryKeys.user(userId), 'memories', normalizeMemoryQuery(query)] as const,
};
