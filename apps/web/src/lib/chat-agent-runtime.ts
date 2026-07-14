import { routeAgentRequest } from '@repo/agent/router';
import {
  isRouterModelEligible,
  runRouterModelCandidate,
  type RouterModelCandidateEnvelope,
} from '@repo/agent/model-candidates';
import {
  buildGenericTutorPrompt,
  buildTutorStrategy,
  type BuildTutorStrategyInput,
  type TutorStrategy,
} from '@repo/agent/tutor';
import {
  createModelAgentBudget,
  createModelAgentRuntime,
  isModelAgentRunBudget,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import type { AgentRoute, AgentState, RouterResult } from '@repo/types/api/agent';

import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

export type ChatAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
  tutorStrategy?: TutorStrategy;
  promptAddition: string;
  debugHeaders: Record<string, string>;
  degraded: boolean;
};

export type BuildChatAgentDecisionInput = {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  runId: string;
  userId: string;
  conversationId?: string;
  router?: (state: AgentState) => RouterResult;
  tutorPolicy?: (input: BuildTutorStrategyInput) => TutorStrategy;
};

export type ChatAgentExecution = {
  decision: ChatAgentDecision;
  routerObservation: RouterModelCandidateEnvelope['observation'];
  budget: ModelAgentRunBudget;
};

export type BuildChatAgentExecutionInput = {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  runId: string;
  userId: string;
  signal?: AbortSignal;
  model: {
    enabled: boolean;
    runtime: ModelAgentRuntime;
    budget: ModelAgentRunBudget;
  };
};

export function buildChatAgentDecision(
  input: BuildChatAgentDecisionInput,
): ChatAgentDecision {
  try {
    const latestUserText = getLatestUserText(input.messages);
    const state = createChatAgentState(input, latestUserText);
    const route = (input.router ?? routeAgentRequest)(state);

    return toDecision(route, false, {
      latestUserText,
      activeStudyContext: input.activeContext?.questionText,
      tutorPolicy: input.tutorPolicy,
    });
  } catch {
    return toDecision(
      {
        name: 'chat',
        confidence: 0.4,
        reason: 'RouterAgent failed; degraded to normal chat.',
        requiresRag: false,
        requiresHumanApproval: false,
      },
      true,
    );
  }
}

export async function buildChatAgentExecution(
  input: BuildChatAgentExecutionInput,
): Promise<ChatAgentExecution> {
  try {
    const latestUserText = getLatestUserText(input.messages);
    const state = createChatAgentState(input, latestUserText);
    const deterministic = routeAgentRequest(state);
    const candidateEligible =
      input.model.enabled === true &&
      isRouterModelEligible({
        text: latestUserText,
        activeStudyContext: input.activeContext?.questionText,
        deterministic,
      });
    const capabilities = candidateEligible
      ? {
          budget: input.model.budget,
          runtime: input.model.runtime,
        }
      : createIneligibleRouterCapabilities();

    const envelope = await runRouterModelCandidate({
      runId: input.runId,
      text: latestUserText,
      activeStudyContext: input.activeContext?.questionText,
      deterministic,
      candidateEligible,
      budget: capabilities.budget,
      signal: input.signal,
      runtime: capabilities.runtime,
    });
    const route =
      envelope.observation.disposition === 'candidate_applied'
        ? withCanonicalRoutePermissions(envelope.result)
        : envelope.result;

    return {
      decision: toDecision(route, false, {
        latestUserText,
        activeStudyContext: input.activeContext?.questionText,
      }),
      routerObservation: envelope.observation,
      budget: safeRunBudgetSnapshot(envelope.observation.budget),
    };
  } catch {
    return localChatAgentExecution(
      toDecision(
        {
          name: 'chat',
          confidence: 0.4,
          reason: 'RouterAgent execution unavailable; degraded to normal chat.',
          requiresRag: false,
          requiresHumanApproval: false,
        },
        true,
      ),
    );
  }
}

function createIneligibleRouterCapabilities(): {
  budget: ModelAgentRunBudget;
  runtime: ModelAgentRuntime;
} {
  return {
    budget: createModelAgentBudget({
      maxCalls: 2,
      maxInputTokens: 2_400,
      maxOutputTokens: 800,
    }),
    runtime: createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'router-ineligible-placeholder',
      liveCallsEnabled: false,
      timeoutMs: 50,
    }),
  };
}

export function combineChatAdditionalPrompts(agentPrompt: string, knowledgePrompt: string) {
  const sections = [agentPrompt.trim(), knowledgePrompt.trim()].filter(Boolean);
  return sections.join('\n\n---\n\n');
}

function createChatAgentState(
  input: BuildChatAgentDecisionInput,
  latestUserText: string,
): AgentState {
  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    input: {
      text: latestUserText,
      attachments: [],
    },
    chatContext: {
      recentMessages: input.messages,
      activeStudyContext: input.activeContext?.questionText,
    },
    proposals: [],
    errors: [],
  };
}

function getLatestUserText(messages: ChatContextMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim() ?? ''
  );
}

function toDecision(
  route: RouterResult,
  degraded: boolean,
  tutorInput?: BuildTutorStrategyInput & {
    tutorPolicy?: (input: BuildTutorStrategyInput) => TutorStrategy;
  },
): ChatAgentDecision {
  const debugHeaders: Record<string, string> = {
    'x-prepmind-agent-route': route.name,
    'x-prepmind-agent-confidence': route.confidence.toFixed(2),
    'x-prepmind-agent-rag-required': String(route.requiresRag),
  };

  let tutorStrategy: TutorStrategy | undefined;
  let promptAddition = buildRoutePromptAddition(route.name);
  let isDegraded = degraded;

  if (route.name === 'tutor' && tutorInput) {
    try {
      tutorStrategy = (tutorInput.tutorPolicy ?? buildTutorStrategy)({
        latestUserText: tutorInput.latestUserText,
        activeStudyContext: tutorInput.activeStudyContext,
      });
      promptAddition = tutorStrategy.promptAddition;
      debugHeaders['x-prepmind-tutor-intent'] = tutorStrategy.intent;
      debugHeaders['x-prepmind-tutor-depth'] = tutorStrategy.depth;
    } catch {
      promptAddition = buildGenericTutorPrompt();
      isDegraded = true;
    }
  }

  if (isDegraded) {
    debugHeaders['x-prepmind-agent-degraded'] = 'true';
  }

  return {
    route: route.name,
    confidence: route.confidence,
    reason: route.reason,
    requiresRag: route.requiresRag,
    requiresHumanApproval: route.requiresHumanApproval,
    tutorStrategy,
    promptAddition,
    debugHeaders,
    degraded: isDegraded,
  };
}

function withCanonicalRoutePermissions(route: RouterResult): RouterResult {
  if (route.name === 'rag_answer') {
    return { ...route, requiresRag: true, requiresHumanApproval: false };
  }
  if (
    route.name === 'study_plan' ||
    route.name === 'review_analysis' ||
    route.name === 'wrong_question_organize'
  ) {
    return { ...route, requiresRag: false, requiresHumanApproval: true };
  }
  return { ...route, requiresRag: false, requiresHumanApproval: false };
}

function localChatAgentExecution(
  decision: ChatAgentDecision,
): ChatAgentExecution {
  const budget = safeRunBudgetSnapshot(undefined);
  const routerObservation: RouterModelCandidateEnvelope['observation'] = {
    attempted: false,
    disposition: 'fallback_invalid_input',
    budget: { ...budget },
    usage: { inputTokens: 0, outputTokens: 0 },
    reasonCodes: ['fallback_invalid_input'],
  };
  return {
    decision,
    routerObservation,
    budget,
  };
}

function safeRunBudgetSnapshot(value: unknown): ModelAgentRunBudget {
  return isModelAgentRunBudget(value)
    ? { ...value }
    : {
        maxCalls: 1,
        usedCalls: 0,
        maxInputTokens: 1,
        usedInputTokens: 0,
        maxOutputTokens: 1,
        usedOutputTokens: 0,
      };
}

function buildRoutePromptAddition(route: AgentRoute) {
  if (route === 'tutor') {
    return [
      'RouterAgent selected the TutorAgent route.',
      'Use a Socratic tutoring style: clarify known conditions, then guide reasoning step by step.',
      'When the user asks why a step works, explain the key basis before giving any final answer.',
      'Answer in Chinese unless the user explicitly asks for another language.',
    ].join('\n');
  }

  if (route === 'rag_answer') {
    return [
      'RouterAgent selected the knowledge base answer route.',
      'Use retrieved user knowledge only as supporting evidence, not as guaranteed truth.',
      'If retrieval has no useful hit, answer normally from general knowledge and do not invent citations.',
      'Answer in Chinese unless the user explicitly asks for another language.',
    ].join('\n');
  }

  if (
    route === 'study_plan' ||
    route === 'review_analysis' ||
    route === 'wrong_question_organize' ||
    route === 'memory_reflection' ||
    route === 'knowledge_dedup'
  ) {
    return [
      'RouterAgent selected an advisory workflow route.',
      'Phase 6.1 may only provide normal chat advice for this route.',
      'Do not claim that a study plan, review analysis, memory, knowledge document, or wrong-question organization has been written.',
      'Answer in Chinese unless the user explicitly asks for another language.',
    ].join('\n');
  }

  return '';
}
