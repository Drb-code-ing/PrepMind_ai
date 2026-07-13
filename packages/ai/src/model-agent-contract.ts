import type { z } from 'zod';

export type ModelAgentTask =
  | 'conversation_summary'
  | 'router_fallback'
  | 'knowledge_verification'
  | 'memory_candidate_extraction'
  | 'tool_orchestration';

export type ModelAgentMode = 'mock' | 'live';
export type ModelAgentProvider = 'mock' | 'deepseek' | 'openai';

export const MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES = Object.freeze([
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'transport',
  'structured_output',
  'invalid_response',
  'unknown',
] as const);

export type ModelAgentProviderFailureCategory =
  (typeof MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)[number];

export type ModelAgentRunBudget = {
  maxCalls: number;
  usedCalls: number;
  maxInputTokens: number;
  usedInputTokens: number;
  maxOutputTokens: number;
  usedOutputTokens: number;
};

export type ModelAgentBudgetErrorCode =
  | 'INVALID_MODEL_AGENT_BUDGET'
  | 'CALL_BUDGET_EXCEEDED'
  | 'INPUT_BUDGET_EXCEEDED'
  | 'OUTPUT_BUDGET_EXCEEDED';

export type ModelAgentRequest<T> = {
  runId: string;
  task: ModelAgentTask;
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type StructuredModelExecutor = <T>(input: {
  schema: z.ZodType<T>;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}) => Promise<{
  object: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}>;

export type ModelAgentErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_RUNTIME_CONFIG'
  | 'LIVE_CALLS_DISABLED'
  | 'EXECUTOR_UNAVAILABLE'
  | 'CALL_BUDGET_EXCEEDED'
  | 'INPUT_BUDGET_EXCEEDED'
  | 'OUTPUT_BUDGET_EXCEEDED'
  | 'SCHEMA_INVALID'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PROVIDER_ERROR';

export type ModelAgentError = {
  code: ModelAgentErrorCode;
  message: string;
  retryable: boolean;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};

export type ModelAgentUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ModelAgentTrace = ModelAgentUsage & {
  runIdHash: string;
  task: ModelAgentTask | 'invalid_request';
  mode: ModelAgentMode;
  provider: ModelAgentProvider;
  model: string;
  status: 'succeeded' | 'failed';
  maxOutputTokens: number;
  durationMs: number;
  degraded: boolean;
  errorCode?: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
};

export type ModelAgentResult<T> =
  | {
      ok: true;
      data: T;
      budget: ModelAgentRunBudget;
      usage: ModelAgentUsage;
      trace: ModelAgentTrace;
    }
  | {
      ok: false;
      error: ModelAgentError;
      budget: ModelAgentRunBudget;
      usage: ModelAgentUsage;
      trace: ModelAgentTrace;
    };
