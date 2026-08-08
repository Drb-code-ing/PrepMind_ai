import {
  agentTraceCreateRequestSchema,
  agentTraceDetailResponseSchema,
  agentTraceListQuerySchema,
  agentTraceListResponseSchema,
  agentTraceRealtimeFinalizeRequestSchema,
  agentTraceRealtimePrepareRequestSchema,
  agentTraceRealtimeStartRequestSchema,
  agentTraceSummaryQuerySchema,
  agentTraceSummaryResponseSchema,
  type AgentTraceCreateRequest,
  type AgentTraceDetailResponse,
  type AgentTraceListQuery,
  type AgentTraceListResponse,
  type AgentTraceRealtimeFinalizeRequest,
  type AgentTraceRealtimePrepareRequest,
  type AgentTraceRealtimeStartRequest,
  type AgentTraceSummaryQuery,
  type AgentTraceSummaryResponse,
} from '@repo/types/api/agent-trace';

type AgentTraceRequestOptions = {
  signal?: AbortSignal;
};

type AgentTraceApiClient = {
  get<T>(path: string, options?: { accessToken?: string | null; signal?: AbortSignal }): Promise<T>;
  post<T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null; signal?: AbortSignal },
  ): Promise<T>;
  patch<T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null; signal?: AbortSignal },
  ): Promise<T>;
};

export function createAgentTraceApi(client: AgentTraceApiClient) {
  return {
    async listTraces(
      accessToken: string,
      query: Partial<AgentTraceListQuery>,
    ): Promise<AgentTraceListResponse> {
      const parsed = agentTraceListQuerySchema.parse(query);
      const params = new URLSearchParams({ limit: String(parsed.limit) });
      if (parsed.route) params.set('route', parsed.route);
      if (parsed.mode) params.set('mode', parsed.mode);
      if (parsed.status) params.set('status', parsed.status);

      return agentTraceListResponseSchema.parse(
        await client.get<unknown>(`/agent-traces?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getSummary(
      accessToken: string,
      query: Partial<AgentTraceSummaryQuery>,
    ): Promise<AgentTraceSummaryResponse> {
      const parsed = agentTraceSummaryQuerySchema.parse(query);
      const params = new URLSearchParams({ days: String(parsed.days) });

      return agentTraceSummaryResponseSchema.parse(
        await client.get<unknown>(`/agent-traces/summary?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getTrace(accessToken: string, runId: string): Promise<AgentTraceDetailResponse> {
      return agentTraceDetailResponseSchema.parse(
        await client.get<unknown>(`/agent-traces/${encodeURIComponent(runId)}`, {
          accessToken,
        }),
      );
    },

    async createTrace(
      accessToken: string,
      body: AgentTraceCreateRequest,
      options: AgentTraceRequestOptions = {},
    ): Promise<AgentTraceDetailResponse> {
      const payload = agentTraceCreateRequestSchema.parse(body);
      const response = await client.post<unknown>('/agent-traces', payload, {
        accessToken,
        signal: options.signal,
      });

      return agentTraceDetailResponseSchema.parse(response);
    },

    async startRealtimeTrace(
      accessToken: string,
      body: AgentTraceRealtimeStartRequest,
      options: AgentTraceRequestOptions = {},
    ): Promise<AgentTraceDetailResponse> {
      const payload = agentTraceRealtimeStartRequestSchema.parse(body);
      const response = await client.post<unknown>('/agent-traces/realtime', payload, {
        accessToken,
        signal: options.signal,
      });
      return agentTraceDetailResponseSchema.parse(response);
    },

    async finalizeRealtimeTrace(
      accessToken: string,
      runId: string,
      body: AgentTraceRealtimeFinalizeRequest,
      options: AgentTraceRequestOptions = {},
    ): Promise<AgentTraceDetailResponse> {
      const payload = agentTraceRealtimeFinalizeRequestSchema.parse(body);
      if (payload.runId !== runId) throw new Error('REALTIME_TRACE_RUN_ID_MISMATCH');
      const response = await client.patch<unknown>(
        `/agent-traces/realtime/${encodeURIComponent(runId)}/terminal`,
        payload,
        { accessToken, signal: options.signal },
      );
      return agentTraceDetailResponseSchema.parse(response);
    },

    async prepareRealtimeTrace(
      accessToken: string,
      runId: string,
      body: AgentTraceRealtimePrepareRequest,
      options: AgentTraceRequestOptions = {},
    ): Promise<AgentTraceDetailResponse> {
      const payload = agentTraceRealtimePrepareRequestSchema.parse(body);
      if (payload.runId !== runId) throw new Error('REALTIME_TRACE_RUN_ID_MISMATCH');
      const response = await client.patch<unknown>(
        `/agent-traces/realtime/${encodeURIComponent(runId)}/prepare`,
        payload,
        { accessToken, signal: options.signal },
      );
      return agentTraceDetailResponseSchema.parse(response);
    },
  };
}
