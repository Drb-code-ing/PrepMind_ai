import type { AgentTraceListQuery } from '@repo/types/api/agent-trace';

type AgentTraceListQueryInput = Partial<AgentTraceListQuery>;

function normalizeRunsQuery(query: AgentTraceListQueryInput) {
  return {
    limit: query.limit ?? 20,
    mode: query.mode,
    route: query.route,
    status: query.status,
  };
}

export const agentTraceQueryKeys = {
  all: ['agent-traces'] as const,
  user: (userId: string) => [...agentTraceQueryKeys.all, userId] as const,
  summary: (userId: string, days: number) =>
    [...agentTraceQueryKeys.user(userId), 'summary', { days }] as const,
  runs: (userId: string, query: AgentTraceListQueryInput) =>
    [...agentTraceQueryKeys.user(userId), 'runs', normalizeRunsQuery(query)] as const,
  detail: (userId: string, runId: string) =>
    [...agentTraceQueryKeys.user(userId), 'detail', runId] as const,
};
