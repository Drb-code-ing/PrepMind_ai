import { routeAgentRequest, type AgentState } from '@repo/agent';
import type { AgentRoute, RouterResult } from '@repo/types/api/agent';

import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

export type ChatAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
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
};

export function buildChatAgentDecision(
  input: BuildChatAgentDecisionInput,
): ChatAgentDecision {
  try {
    const state = createChatAgentState(input);
    const route = (input.router ?? routeAgentRequest)(state);

    return toDecision(route, false);
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

export function combineChatAdditionalPrompts(agentPrompt: string, knowledgePrompt: string) {
  const sections = [agentPrompt.trim(), knowledgePrompt.trim()].filter(Boolean);
  return sections.join('\n\n---\n\n');
}

function createChatAgentState(input: BuildChatAgentDecisionInput): AgentState {
  return {
    runId: input.runId,
    userId: input.userId,
    conversationId: input.conversationId,
    input: {
      text: getLatestUserText(input.messages),
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

function toDecision(route: RouterResult, degraded: boolean): ChatAgentDecision {
  const debugHeaders: Record<string, string> = {
    'x-prepmind-agent-route': route.name,
    'x-prepmind-agent-confidence': route.confidence.toFixed(2),
    'x-prepmind-agent-rag-required': String(route.requiresRag),
  };

  if (degraded) {
    debugHeaders['x-prepmind-agent-degraded'] = 'true';
  }

  return {
    route: route.name,
    confidence: route.confidence,
    reason: route.reason,
    requiresRag: route.requiresRag,
    requiresHumanApproval: route.requiresHumanApproval,
    promptAddition: buildRoutePromptAddition(route.name),
    debugHeaders,
    degraded,
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
