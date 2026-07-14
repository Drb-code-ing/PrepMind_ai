import 'server-only';

import type {
  ModelAgentRunBudget,
  ModelAgentRuntime,
} from '@repo/ai';

import {
  buildChatAgentExecution,
  type ChatAgentExecution,
} from './chat-agent-runtime.ts';
import type {
  ActiveStudyContext,
  ChatContextMessage,
} from './chat-context.ts';
import type { ChatModelAgentRuntimeBundle } from './chat-model-agent-runtime.ts';

export type ChatVerifierModelContext = {
  enabled: boolean;
  runtime: ModelAgentRuntime;
  budget: ModelAgentRunBudget;
  runId: string;
  signal: AbortSignal;
};

export type ChatModelAgentOrchestrationResult = {
  agentExecution: ChatAgentExecution;
  verifierModel: ChatVerifierModelContext;
};

export async function orchestrateChatModelAgents(input: {
  bundle: ChatModelAgentRuntimeBundle;
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  runId: string;
  userId: string;
  signal: AbortSignal;
}): Promise<ChatModelAgentOrchestrationResult> {
  const budget = input.bundle.createBudget();
  const agentExecution = await buildChatAgentExecution({
    messages: input.messages,
    activeContext: input.activeContext,
    runId: input.runId,
    userId: input.userId,
    signal: input.signal,
    model: {
      enabled: input.bundle.routerEnabled,
      runtime: input.bundle.routerRuntime,
      budget,
    },
  });

  return {
    agentExecution,
    verifierModel: {
      enabled: input.bundle.verifierEnabled,
      runtime: input.bundle.verifierRuntime,
      budget: agentExecution.budget,
      runId: input.runId,
      signal: input.signal,
    },
  };
}
