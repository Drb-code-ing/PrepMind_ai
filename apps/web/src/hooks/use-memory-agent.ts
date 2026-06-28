'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GenerateMemoryCandidatesRequest,
  MemoryCandidateListQuery,
  UpdateUserMemoryRequest,
  UserMemoryListQuery,
} from '@repo/types/api/memory-agent';

import { apiClient } from '@/lib/api-client';
import { createMemoryAgentApi } from '@/lib/memory-agent-api';
import { memoryAgentQueryKeys } from '@/lib/memory-agent-query-keys';
import { useUserStore } from '@/stores/userStore';

const memoryAgentApi = createMemoryAgentApi(apiClient);

export { memoryAgentQueryKeys };

export function useMemoryCandidates(userId: string, query: MemoryCandidateListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: memoryAgentQueryKeys.candidates(userId || 'anonymous', query),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.listCandidates(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}

export function useUserMemories(userId: string, query: UserMemoryListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: memoryAgentQueryKeys.memories(userId || 'anonymous', query),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.listMemories(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}

export function useGenerateMemoryCandidates(userId: string) {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (input: GenerateMemoryCandidatesRequest) => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.generateCandidates(accessToken, input);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: memoryAgentQueryKeys.user(userId) });
    },
  });
}

export function useAcceptMemoryCandidate(userId: string) {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (candidateId: string) => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.acceptCandidate(accessToken, candidateId);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: memoryAgentQueryKeys.user(userId) });
    },
  });
}

export function useRejectMemoryCandidate(userId: string) {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (candidateId: string) => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.rejectCandidate(accessToken, candidateId);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: memoryAgentQueryKeys.user(userId) });
    },
  });
}

export function useUpdateUserMemory(userId: string) {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      memoryId,
      input,
    }: {
      memoryId: string;
      input: UpdateUserMemoryRequest;
    }) => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.updateMemory(accessToken, memoryId, input);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: memoryAgentQueryKeys.user(userId) });
    },
  });
}

export function useDeleteUserMemory(userId: string) {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (memoryId: string) => {
      if (!accessToken || !userId) {
        throw new Error('Missing memory agent context');
      }
      return memoryAgentApi.deleteMemory(accessToken, memoryId);
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: memoryAgentQueryKeys.user(userId) });
    },
  });
}
