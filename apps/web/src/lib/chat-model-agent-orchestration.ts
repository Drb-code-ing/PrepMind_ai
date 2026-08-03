import 'server-only';

import type { ModelAgentRunBudget, ModelAgentRuntime } from '@repo/ai';

import { buildChatAgentExecution, type ChatAgentExecution } from './chat-agent-runtime.ts';
import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';
import type { ChatModelAgentRuntimeBundle } from './chat-model-agent-runtime.ts';
import type { TutorModelRuntimeBundle } from './tutor-model-runtime.ts';

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
  tutorBundle?: TutorModelRuntimeBundle;
  createTutorBundle?: () => TutorModelRuntimeBundle;
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  runId: string;
  userId: string;
  signal: AbortSignal;
}): Promise<ChatModelAgentOrchestrationResult> {
  const budget = input.bundle.createBudget();
  const tutorBudget = input.tutorBundle?.createBudget();
  const tutorRuntimeAuthority = input.tutorBundle?.config.runtimeAuthority;
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
    ...(input.tutorBundle?.enabled === true &&
    tutorBudget &&
    tutorRuntimeAuthority !== undefined &&
    tutorRuntimeAuthority !== 'disabled'
      ? {
          tutorModel: {
            enabled: true,
            authority: tutorRuntimeAuthority,
            runtime: input.tutorBundle.runtime,
            budget: tutorBudget,
          },
        }
      : {}),
    ...(!input.tutorBundle && input.createTutorBundle
      ? {
          tutorModelFactory: () => {
            const bundle = input.createTutorBundle!();
            if (!bundle.enabled || bundle.config.runtimeAuthority === 'disabled') {
              return undefined;
            }
            return {
              enabled: true,
              authority: bundle.config.runtimeAuthority,
              runtime: bundle.runtime,
              budget: bundle.createBudget(),
            };
          },
        }
      : {}),
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
