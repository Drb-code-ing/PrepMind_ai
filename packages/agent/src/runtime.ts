import type {
  AgentRun,
  AgentRunStatus,
  AgentStep,
  RouterResult,
} from '@repo/types/api/agent';

import type { AgentRunRecorder } from './recorder.ts';
import { routeAgentRequest } from './router.ts';
import { appendRecoverableError, createInitialAgentState } from './state.ts';

export type RunAgentRuntimeInput = {
  runId: string;
  userId: string;
  conversationId?: string;
  text: string;
};

export type RunAgentRuntimeOptions = {
  recorder?: AgentRunRecorder;
  router?: typeof routeAgentRequest;
  now?: () => Date;
};

export async function runAgentRuntime(
  input: RunAgentRuntimeInput,
  options: RunAgentRuntimeOptions = {},
) {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const recorder = options.recorder;
  let state = createInitialAgentState({
    ...input,
    startedAt: startedAt.toISOString(),
  });

  recorder?.startRun(createRun(input, startedAt));

  try {
    const router = options.router ?? routeAgentRequest;
    const route = router(state);
    state = {
      ...state,
      route,
      finalResponse: {
        markdown: createPlaceholderResponse(route, input.text),
      },
    };
    recorder?.recordStep(
      createStep(
        input.runId,
        'RouterAgent',
        'completed',
        startedAt,
        now(),
        input.text,
        route.name,
      ),
    );
  } catch (error) {
    state = appendRecoverableError(state, 'RouterAgent', error);
    const route: RouterResult = {
      name: 'chat',
      confidence: 0.4,
      reason: 'RouterAgent failed; degraded to normal chat.',
      requiresRag: false,
      requiresHumanApproval: false,
    };
    state = {
      ...state,
      route,
      finalResponse: {
        markdown: `我先按普通问题回答：${input.text}`,
      },
    };
    recorder?.recordStep(
      createStep(
        input.runId,
        'RouterAgent',
        'degraded',
        startedAt,
        now(),
        input.text,
        'route=chat',
      ),
    );
  }

  const finishedAt = now();
  recorder?.finishRun(input.runId, {
    status: state.errors.length > 0 ? 'degraded' : 'completed',
    finishedAt: finishedAt.toISOString(),
    totalDurationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
  });

  return { state };
}

function createRun(input: RunAgentRuntimeInput, startedAt: Date): AgentRun {
  return {
    id: input.runId,
    userId: input.userId,
    conversationId: input.conversationId ?? null,
    route: null,
    status: 'running',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    totalDurationMs: null,
    inputTokenEstimate: estimateTokens(input.text),
    outputTokenEstimate: 0,
    modelProvider: 'mock',
    modelName: 'phase-6-runtime-skeleton',
    costEstimate: 0,
  };
}

function createStep(
  runId: string,
  node: string,
  status: AgentRunStatus,
  startedAt: Date,
  finishedAt: Date,
  inputSummary: string,
  outputSummary: string,
): AgentStep {
  return {
    id: `${runId}_${node}`,
    runId,
    node,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
    inputSummary: summarize(inputSummary),
    outputSummary,
    errorMessage: status === 'degraded' ? outputSummary : null,
  };
}

function createPlaceholderResponse(route: RouterResult, text: string): string {
  if (route.name === 'tutor') {
    return `我们先看题目条件，再一步步拆解：${text}`;
  }

  if (route.name === 'rag_answer') {
    return `我会优先检索你的资料，再给出回答：${text}`;
  }

  if (route.name === 'study_plan') {
    return '我可以先生成学习计划建议，确认后再写入你的计划。';
  }

  return `你好，我会按当前问题回答：${text}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function summarize(text: string): string {
  return text.length > 80 ? `${text.slice(0, 80)}...` : text;
}
