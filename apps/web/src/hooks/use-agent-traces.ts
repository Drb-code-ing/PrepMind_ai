'use client';

import { useQuery } from '@tanstack/react-query';
import type { AgentTraceListQuery } from '@repo/types/api/agent-trace';

import { apiClient } from '@/lib/api-client';
import { createAgentTraceApi } from '@/lib/agent-trace-api';
import { agentTraceQueryKeys } from '@/lib/agent-trace-query-keys';
import { useUserStore } from '@/stores/userStore';

const agentTraceApi = createAgentTraceApi(apiClient);

export { agentTraceQueryKeys };

export function useAgentTraceSummary(days: number) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;

  return useQuery({
    queryKey: agentTraceQueryKeys.summary(userId ?? 'anonymous', days),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing agent trace context');
      }
      return agentTraceApi.getSummary(accessToken, { days });
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}

export function useAgentTraceRuns(limit: number, query: Partial<AgentTraceListQuery> = {}) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;
  const fullQuery = { ...query, limit };

  return useQuery({
    queryKey: agentTraceQueryKeys.runs(userId ?? 'anonymous', fullQuery),
    queryFn: async () => {
      if (!accessToken || !userId) {
        throw new Error('Missing agent trace context');
      }
      return agentTraceApi.listTraces(accessToken, fullQuery);
    },
    enabled: sessionHydrated && !!accessToken && !!userId,
    retry: false,
  });
}

export function useAgentTraceDetail(runId: string | null) {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const userId = currentUser?.id;

  return useQuery({
    queryKey: agentTraceQueryKeys.detail(userId ?? 'anonymous', runId ?? 'none'),
    queryFn: async () => {
      if (!accessToken || !userId || !runId) {
        throw new Error('Missing agent trace context');
      }
      return agentTraceApi.getTrace(accessToken, runId);
    },
    enabled: sessionHydrated && !!accessToken && !!userId && !!runId,
    retry: false,
  });
}
