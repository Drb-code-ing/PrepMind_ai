import type { AgentState } from '@repo/types/api/agent';

import { createAgentLoopControl } from './control-plane.ts';

export type { AgentState } from '@repo/types/api/agent';

export type CreateAgentStateInput = {
  runId: string;
  userId: string;
  conversationId?: string;
  text: string;
  startedAt?: string;
};

export function createInitialAgentState(input: CreateAgentStateInput): AgentState {
  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    input: {
      text: input.text,
      attachments: [],
    },
    loopControl: createAgentLoopControl({
      maxSteps: 6,
      maxRepeatedTransition: 2,
      startedAt: input.startedAt ?? new Date().toISOString(),
    }),
    proposals: [],
    errors: [],
  };
}

export function appendRecoverableError(
  state: AgentState,
  node: string,
  error: unknown,
): AgentState {
  const message = error instanceof Error ? error.message : String(error);

  return {
    ...state,
    errors: [
      ...state.errors,
      {
        node,
        message,
        recoverable: true,
      },
    ],
  };
}
