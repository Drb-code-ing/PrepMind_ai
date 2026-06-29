import type { AgentToolError, AgentToolResult } from '@repo/types/api/agent-tool';

export function createToolSuccess(
  toolName: string,
  data: Record<string, unknown>,
): AgentToolResult {
  return {
    ok: true,
    toolName,
    data,
    retryable: false,
  };
}

export function createToolFailure(input: {
  toolName: string;
  code: AgentToolError['code'];
  message: string;
  retryable: boolean;
  issues?: Array<{ path: string; message: string }>;
}): AgentToolResult {
  const error: AgentToolError = {
    code: input.code,
    message: input.message,
  };

  if (input.issues !== undefined) {
    error.issues = input.issues;
  }

  return {
    ok: false,
    toolName: input.toolName,
    error,
    retryable: input.retryable,
  };
}
