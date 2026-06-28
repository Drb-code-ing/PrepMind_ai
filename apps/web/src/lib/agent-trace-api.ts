import {
  agentTraceCreateRequestSchema,
  agentTraceDetailResponseSchema,
  type AgentTraceCreateRequest,
  type AgentTraceDetailResponse,
} from '@repo/types/api/agent-trace';

type AgentTraceRequestOptions = {
  signal?: AbortSignal;
};

type AgentTraceApiClient = {
  post<T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null; signal?: AbortSignal },
  ): Promise<T>;
};

export function createAgentTraceApi(client: AgentTraceApiClient) {
  return {
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
  };
}
