import { routeAgentRequest } from '@repo/agent/router';
import {
  isRouterModelEligible,
  runRouterModelCandidate,
  type RouterModelCandidateEnvelope,
  runTutorModelCandidate,
  type TutorModelCandidateEnvelope,
  type TutorModelCandidateReasonCode,
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
import { estimateTutorRequestCostCny } from './tutor-model-pricing.ts';

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
  tutorObservation: TutorModelCandidateEnvelope['observation'];
  budget: ModelAgentRunBudget;
  tutorBudget: ModelAgentRunBudget;
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
  tutorModel?: {
    enabled: boolean;
    runtime: ModelAgentRuntime;
    budget: ModelAgentRunBudget;
  };
  tutorModelFactory?: () => {
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
      : createIneligibleRouterCapabilities(input.model);

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

    const deterministicDecision = toDecision(route, false, {
      latestUserText,
      activeStudyContext: input.activeContext?.questionText,
    });
    const tutorExecution = await resolveTutorCandidateSafely({
      decision: deterministicDecision,
      finalRoute: route,
      latestUserText,
      activeStudyContext: input.activeContext?.questionText,
      runId: input.runId,
      signal: input.signal,
      tutorModel: input.tutorModel,
      tutorModelFactory: input.tutorModelFactory,
    });

    return {
      decision: tutorExecution.decision,
      routerObservation: envelope.observation,
      tutorObservation: tutorExecution.observation,
      budget: safeRunBudgetSnapshot(envelope.observation.budget),
      tutorBudget: safeRunBudgetSnapshot(tutorExecution.observation.budget),
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

function createIneligibleRouterCapabilities(
  model: BuildChatAgentExecutionInput['model'],
): {
  budget: ModelAgentRunBudget;
  runtime: ModelAgentRuntime;
} {
  return {
    budget:
      snapshotOwnDataBudget(model) ??
      createModelAgentBudget({
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

const MODEL_AGENT_BUDGET_FIELDS = [
  'maxCalls',
  'usedCalls',
  'maxInputTokens',
  'usedInputTokens',
  'maxOutputTokens',
  'usedOutputTokens',
] as const satisfies readonly (keyof ModelAgentRunBudget)[];

function snapshotOwnDataBudget(
  model: unknown,
): ModelAgentRunBudget | null {
  try {
    if (typeof model !== 'object' || model === null) return null;
    const modelBudget = Object.getOwnPropertyDescriptor(model, 'budget');
    if (!modelBudget || !('value' in modelBudget)) return null;

    const values: Partial<ModelAgentRunBudget> = {};
    for (const field of MODEL_AGENT_BUDGET_FIELDS) {
      const descriptor = Object.getOwnPropertyDescriptor(modelBudget.value, field);
      if (!descriptor || !('value' in descriptor)) return null;
      values[field] = descriptor.value;
    }
    if (!isModelAgentRunBudget(values)) return null;
    return Object.freeze({ ...values });
  } catch {
    return null;
  }
}

async function resolveTutorCandidateSafely(input: {
  decision: ChatAgentDecision;
  finalRoute: RouterResult;
  latestUserText: string;
  activeStudyContext?: string;
  runId: string;
  signal?: AbortSignal;
  tutorModel?: BuildChatAgentExecutionInput['tutorModel'];
  tutorModelFactory?: BuildChatAgentExecutionInput['tutorModelFactory'];
}): Promise<{
  decision: ChatAgentDecision;
  observation: TutorModelCandidateEnvelope['observation'];
}> {
  let activeBudget = createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 1_200,
    maxOutputTokens: 300,
  });
  if (input.finalRoute.name !== 'tutor') {
    return {
      decision: input.decision,
      observation: localTutorObservation(activeBudget, 'not_eligible', 'route_not_tutor'),
    };
  }
  if (!input.decision.tutorStrategy) {
    return {
      decision: markDecisionDegraded(input.decision),
      observation: localTutorObservation(
        activeBudget,
        'fallback_invalid_input',
        'invalid_input',
      ),
    };
  }

  try {
    const tutorModel = input.tutorModel ?? input.tutorModelFactory?.();
    activeBudget = snapshotOwnDataBudget(tutorModel) ?? activeBudget;
    if (tutorModel?.enabled !== true) {
      return {
        decision: input.decision,
        observation: localTutorObservation(
          activeBudget,
          'not_eligible',
          'LIVE_CALLS_DISABLED',
        ),
      };
    }
    const envelope = await runTutorModelCandidate({
      runId: input.runId,
      finalRoute: input.finalRoute.name,
      latestUserText: input.latestUserText,
      ...(input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: input.activeStudyContext }),
      deterministic: input.decision.tutorStrategy,
      safety: {
        latestUserText: 'safe_for_model',
        ...(input.activeStudyContext === undefined
          ? {}
          : { activeStudyContext: 'safe_for_model' }),
      },
      runtime: tutorModel.runtime,
      budget: activeBudget,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    if (envelope.observation.disposition === 'candidate_applied') {
      const costCny = estimateTutorRequestCostCny(envelope.observation.usage);
      if (costCny === null) {
        return {
          decision: markDecisionDegraded(input.decision),
          observation: rejectUnpricedTutorObservation(envelope.observation),
        };
      }
      return {
        decision: withTutorStrategy(input.decision, envelope.result),
        observation: envelope.observation,
      };
    }
    return {
      decision: envelope.observation.attempted
        ? markDecisionDegraded(input.decision)
        : input.decision,
      observation: envelope.observation,
    };
  } catch {
    return {
      decision: markDecisionDegraded(input.decision),
      observation: localTutorObservation(
        activeBudget,
        'fallback_runtime_error',
        'EXECUTOR_UNAVAILABLE',
      ),
    };
  }
}

function withTutorStrategy(
  decision: ChatAgentDecision,
  tutorStrategy: TutorStrategy,
): ChatAgentDecision {
  return {
    ...decision,
    tutorStrategy,
    promptAddition: tutorStrategy.promptAddition,
    debugHeaders: {
      ...decision.debugHeaders,
      'x-prepmind-tutor-intent': tutorStrategy.intent,
      'x-prepmind-tutor-depth': tutorStrategy.depth,
    },
  };
}

function markDecisionDegraded(decision: ChatAgentDecision): ChatAgentDecision {
  return {
    ...decision,
    degraded: true,
    debugHeaders: {
      ...decision.debugHeaders,
      'x-prepmind-agent-degraded': 'true',
    },
  };
}

function localTutorObservation(
  budget: ModelAgentRunBudget,
  disposition: TutorModelCandidateEnvelope['observation']['disposition'],
  reasonCode?: TutorModelCandidateReasonCode,
): TutorModelCandidateEnvelope['observation'] {
  return {
    attempted: false,
    disposition,
    budget: safeRunBudgetSnapshot(budget),
    usage: { inputTokens: 0, outputTokens: 0 },
    reasonCodes: reasonCode ? [disposition, reasonCode] : [disposition],
  } as TutorModelCandidateEnvelope['observation'];
}

function rejectUnpricedTutorObservation(
  observation: TutorModelCandidateEnvelope['observation'],
): TutorModelCandidateEnvelope['observation'] {
  if (observation.attempted !== true) {
    return localTutorObservation(
      observation.budget,
      'fallback_runtime_error',
      'INVALID_REQUEST',
    );
  }
  const common = {
    attempted: true as const,
    disposition: 'fallback_runtime_error' as const,
    budget: safeRunBudgetSnapshot(observation.budget),
    usage: { ...observation.usage },
    reasonCodes: ['fallback_runtime_error', 'INVALID_REQUEST'] as const,
  };
  if ('trace' in observation && observation.trace !== undefined) {
    return { ...common, trace: observation.trace };
  }
  return {
    ...common,
    traceUnavailable: true,
    usageUnavailable: true,
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
  const tutorBudget = createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 1_200,
    maxOutputTokens: 300,
  });
  const tutorObservation = localTutorObservation(
    tutorBudget,
    'fallback_invalid_input',
    'invalid_input',
  );
  return {
    decision,
    routerObservation,
    tutorObservation,
    budget,
    tutorBudget,
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
