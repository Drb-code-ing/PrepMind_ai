import { createDataStreamResponse, formatDataStreamPart, streamText } from 'ai';
import type { KnowledgeVerifierResult } from '@repo/agent/knowledge-verifier';
import type { AgentTraceCreateRequest } from '@repo/types/api/agent-trace';
import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';
import { apiClient } from '@/lib/api-client';
import { aiProvider } from '@/lib/ai-provider';
import { createMockChatText } from '@/lib/ai-usage-guard';
import { createAgentTraceApi } from '@/lib/agent-trace-api';
import { buildChatAgentTracePayload } from '@/lib/agent-trace-payload';
import {
  parseChatApiRequestBody,
  shouldSearchKnowledgeForChat,
  validateChatLiveAccess,
} from '@/lib/chat-api-policy';
import { buildChatAgentExecution, type ChatAgentDecision } from '@/lib/chat-agent-runtime';
import {
  type ActiveStudyContext,
  type ChatContextMessage,
} from '@/lib/chat-context';
import {
  assembleChatContextForRoute,
  buildConversationContextHeaders,
  filterKnowledgeForAssembledContext,
  logChatRouteFailureSafely,
  runChatAccessAndContextPreparation,
} from '@/lib/chat-context-orchestration';
import {
  appendCitationMarkdown,
  buildKnowledgeContextPrompt,
  searchKnowledgeForChat,
} from '@/lib/chat-rag-context';
import { buildChatModelAgentObservationHeaders } from '@/lib/chat-model-agent-observation';
import { createChatModelAgentRuntimeBundle } from '@/lib/chat-model-agent-runtime';
import type { RagSafetySummary } from '@/lib/rag-safety';
import { resolveChatProviderStatus } from '@/lib/chat-provider-status';

const AGENT_TRACE_TIMEOUT_MS = 800;
const agentTraceApi = createAgentTraceApi(apiClient);

const CHAT_ERROR_MESSAGE =
  'AI 服务暂时不可用，请检查 API Key、模型配置或稍后重试。';

const BASE_SYSTEM_PROMPT = `你是 PrepMind AI，一个专业的智能备考助手。你的职责是：
1. 帮助学生理解知识点，用简洁清晰的语言讲解。
2. 解答题目时给出解题思路，不只给答案。
3. 鼓励学生思考，适当引导。
4. 回答使用中文，格式清晰，必要时使用 Markdown 列表或代码块。

输出格式要求：
- 解释题目时优先使用 Markdown 有序列表，每个步骤单独成段，不要把“步骤1、步骤2、步骤3”堆在同一段。
- 行内公式使用 $...$，独立公式使用 $$...$$，不要使用 \\[...\\] 或裸方括号包裹公式。
- 多行推导或积分公式必须使用独立公式块，公式前后保留空行。
- 关键结论可以加粗，但不要整段加粗。`;

async function recordAgentTraceSafely(
  accessToken: string | null,
  createPayload: () => AgentTraceCreateRequest,
) {
  if (!accessToken) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_TRACE_TIMEOUT_MS);

  try {
    await agentTraceApi.createTrace(accessToken, createPayload(), {
      signal: controller.signal,
    });
    return true;
  } catch (error) {
    console.warn('[AgentTrace]', error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyAccessTokenForLive(accessToken: string) {
  try {
    await apiClient.get<unknown>('/auth/me', { accessToken });
    return true;
  } catch (error) {
    console.warn('[Chat Auth]', error);
    return false;
  }
}

function resolveTraceModelProvider(mode: 'mock' | 'live', model: string, baseURL: string) {
  if (mode === 'mock') return 'mock';

  const marker = `${model} ${baseURL}`.toLowerCase();
  if (marker.includes('deepseek')) return 'deepseek';
  if (marker.includes('openai')) return 'openai';
  return 'openai-compatible';
}

function getLatestUserText(messages: ChatContextMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content;
}

function splitMockText(text: string) {
  const chunks: string[] = [];
  const chunkSize = 18;

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

function createMockChatResponse(input: {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  knowledgeHits: KnowledgeSearchHit[];
  knowledgeSafetySummary: RagSafetySummary;
  knowledgeVerifierResult?: KnowledgeVerifierResult;
  agentDecision: ChatAgentDecision;
  traceRecorded: boolean;
  contextHeaders: Record<string, string>;
  modelAgentHeaders: Record<string, string>;
}) {
  const mockText = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
    agentRoute: input.agentDecision.route,
    tutorIntent: input.agentDecision.tutorStrategy?.intent,
    verifierStatus: input.knowledgeVerifierResult?.status,
  });
  const responseText = appendCitationMarkdown(
    mockText,
    input.knowledgeHits,
    input.knowledgeVerifierResult,
    input.knowledgeSafetySummary,
  );

  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': 'mock',
      'x-prepmind-rag-hit-count': String(input.knowledgeHits.length),
      'x-prepmind-knowledge-verifier-status':
        input.knowledgeVerifierResult?.status ?? 'skipped',
      'x-prepmind-knowledge-verifier-chunks': String(
        input.knowledgeVerifierResult?.debug.checkedChunkCount ?? 0,
      ),
      'x-prepmind-agent-trace-recorded': String(input.traceRecorded),
      ...input.contextHeaders,
      ...input.agentDecision.debugHeaders,
      ...input.modelAgentHeaders,
    },
    execute: async (dataStream) => {
      for (const chunk of splitMockText(responseText)) {
        dataStream.write(formatDataStreamPart('text', chunk));
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
    },
  });
}

function createLiveChatResponse(input: {
  model: string;
  systemPrompt: string;
  messages: ChatContextMessage[];
  maxOutputTokens: number;
  knowledgeHits: KnowledgeSearchHit[];
  knowledgeSafetySummary: RagSafetySummary;
  knowledgeVerifierResult?: KnowledgeVerifierResult;
  agentDecision: ChatAgentDecision;
  traceRecorded: boolean;
  contextHeaders: Record<string, string>;
  modelAgentHeaders: Record<string, string>;
}) {
  const result = streamText({
    model: aiProvider(input.model),
    system: input.systemPrompt,
    messages: input.messages,
    maxTokens: input.maxOutputTokens,
  });

  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': 'live',
      'x-prepmind-rag-hit-count': String(input.knowledgeHits.length),
      'x-prepmind-knowledge-verifier-status':
        input.knowledgeVerifierResult?.status ?? 'skipped',
      'x-prepmind-knowledge-verifier-chunks': String(
        input.knowledgeVerifierResult?.debug.checkedChunkCount ?? 0,
      ),
      'x-prepmind-agent-trace-recorded': String(input.traceRecorded),
      ...input.contextHeaders,
      ...input.agentDecision.debugHeaders,
      ...input.modelAgentHeaders,
    },
    execute: async (dataStream) => {
      for await (const chunk of result.textStream) {
        dataStream.write(formatDataStreamPart('text', chunk));
      }

      const citationMarkdown = appendCitationMarkdown(
        '',
        input.knowledgeHits,
        input.knowledgeVerifierResult,
        input.knowledgeSafetySummary,
      );
      if (citationMarkdown.trim()) {
        dataStream.write(formatDataStreamPart('text', citationMarkdown));
      }
    },
    onError: () => CHAT_ERROR_MESSAGE,
  });
}

export async function POST(req: Request) {
  try {
    const parsedRequest = parseChatApiRequestBody(await req.json());

    if (!parsedRequest.ok) {
      return Response.json(
        { error: parsedRequest.error },
        { status: parsedRequest.status },
      );
    }

    const { messages, activeContext, accessToken, conversationId } = parsedRequest.data;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    const providerStatus = resolveChatProviderStatus();

    if (!providerStatus.configured) {
      return Response.json({ error: providerStatus.message }, { status: 503 });
    }

    const accessAndContext = await runChatAccessAndContextPreparation(
      {
        mode: providerStatus.mode,
        accessToken,
        conversationId,
        maxInputTokens: providerStatus.maxInputTokens,
        requestSignal: req.signal,
        timeoutValue: process.env.CONVERSATION_CONTEXT_PREPARE_TIMEOUT_MS,
      },
      {
        validateAccess: (mode, token) =>
          validateChatLiveAccess(mode, token, verifyAccessTokenForLive),
      },
    );

    if (!accessAndContext.ok) {
      return Response.json(
        { error: accessAndContext.error },
        { status: accessAndContext.status },
      );
    }
    const conversationContext = accessAndContext.context;

    const normalizedMessages = messages as ChatContextMessage[];
    const normalizedActiveContext = activeContext;
    const normalizedAccessToken = accessToken;
    const traceRunId = crypto.randomUUID();
    const traceStartedAt = new Date();
    const modelAgentBundle = createChatModelAgentRuntimeBundle({ env: process.env });
    const modelAgentBudget = modelAgentBundle.createBudget();
    const agentExecution = await buildChatAgentExecution({
      messages: normalizedMessages,
      activeContext: normalizedActiveContext,
      runId: traceRunId,
      userId: 'web-chat-user',
      signal: req.signal,
      model: {
        enabled: modelAgentBundle.routerEnabled,
        runtime: modelAgentBundle.routerRuntime,
        budget: modelAgentBudget,
      },
    });
    const agentDecision = agentExecution.decision;
    const knowledgeSearch = await searchKnowledgeForChat({
      enabled: shouldSearchKnowledgeForChat({
        accessToken: normalizedAccessToken,
        requiresRag: agentDecision.requiresRag,
        latestUserText: getLatestUserText(normalizedMessages),
      }),
      accessToken: normalizedAccessToken,
      messages: normalizedMessages,
      logger: console,
      model: {
        enabled: modelAgentBundle.verifierEnabled,
        runtime: modelAgentBundle.verifierRuntime,
        budget: agentExecution.budget,
        runId: traceRunId,
        signal: req.signal,
      },
    });
    const modelAgentHeaders = buildChatModelAgentObservationHeaders({
      router: agentExecution.routerObservation,
      ...(knowledgeSearch.verifierObservation === undefined
        ? {}
        : { verifier: knowledgeSearch.verifierObservation }),
    });
    const knowledgeContextPrompt = buildKnowledgeContextPrompt(
      knowledgeSearch.hits,
      knowledgeSearch.verifierResult,
      knowledgeSearch.safetySummary,
    );
    const budget = assembleChatContextForRoute({
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      agentGuidance: agentDecision.promptAddition,
      activeStudyContext: normalizedActiveContext,
      recentMessages: normalizedMessages,
      safeRagContext: knowledgeContextPrompt || undefined,
      preparedContext: conversationContext,
      maxInputTokens: providerStatus.maxInputTokens,
      maxOutputTokens: providerStatus.maxOutputTokens,
    });
    const filteredKnowledge = filterKnowledgeForAssembledContext(
      {
        hits: knowledgeSearch.hits,
        verifierResult: knowledgeSearch.verifierResult,
        safetySummary: knowledgeSearch.safetySummary,
      },
      budget.contextPolicy,
    );
    const citationHits = filteredKnowledge.hits;
    const citationVerifierResult = filteredKnowledge.verifierResult;
    const citationSafetySummary = filteredKnowledge.safetySummary;
    const contextHeaders = buildConversationContextHeaders({
      summaryStatus: conversationContext.summaryStatus,
      summaryVersion: conversationContext.summaryVersion,
      droppedLayers: budget.contextPolicy.droppedLayers,
    });

    if (budget.modelMessages.length === 0) {
      return Response.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    if (budget.exceedsInputLimit) {
      return Response.json(
        {
          error: `本次输入上下文过长，估算 ${budget.estimatedInputTokens} tokens，超过当前上限 ${budget.maxInputTokens} tokens。请缩短问题或开启更高预算后重试。`,
        },
        { status: 413 },
      );
    }

    const traceRecorded = await recordAgentTraceSafely(normalizedAccessToken, () =>
      buildChatAgentTracePayload({
        runId: traceRunId,
        conversationId,
        messages: normalizedMessages,
        mode: providerStatus.mode,
        modelProvider: resolveTraceModelProvider(
          providerStatus.mode,
          providerStatus.model,
          providerStatus.baseURL,
        ),
        modelName: providerStatus.model,
        budget,
        agentDecision,
        knowledgeHits: citationHits,
        knowledgeVerifierResult: citationVerifierResult,
        startedAt: traceStartedAt,
        finishedAt: new Date(),
      }),
    );

    if (providerStatus.mode === 'mock') {
      return createMockChatResponse({
        messages: budget.modelMessages,
        activeContext: normalizedActiveContext,
        knowledgeHits: citationHits,
        knowledgeSafetySummary: citationSafetySummary,
        knowledgeVerifierResult: citationVerifierResult,
        agentDecision,
        traceRecorded,
        contextHeaders,
        modelAgentHeaders,
      });
    }

    console.info(
      `[AI usage estimate] mode=live model=${providerStatus.model} input=${budget.estimatedInputTokens}/${budget.maxInputTokens} maxOutput=${budget.maxOutputTokens} messages=${budget.modelMessages.length} activeContext=${Boolean(normalizedActiveContext)} ragHits=${citationHits.length} agentRoute=${agentDecision.route}`,
    );

    return createLiveChatResponse({
      model: providerStatus.model,
      systemPrompt: budget.systemPrompt,
      messages: budget.modelMessages,
      maxOutputTokens: budget.maxOutputTokens,
      knowledgeHits: citationHits,
      knowledgeSafetySummary: citationSafetySummary,
      knowledgeVerifierResult: citationVerifierResult,
      agentDecision,
      traceRecorded,
      contextHeaders,
      modelAgentHeaders,
    });
  } catch {
    logChatRouteFailureSafely(console);
    return Response.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
