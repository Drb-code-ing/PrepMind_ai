import { createDataStreamResponse, formatDataStreamPart } from 'ai';
import { runFinalResponseAgentNodeV1 } from '@repo/agent/final-response';
import type {
  KnowledgeVerifierChunk,
  KnowledgeVerifierResult,
} from '@repo/agent/knowledge-verifier';
import type {
  AgentTraceRealtimeFinalizeRequest,
  AgentTraceRealtimePrepareRequest,
  AgentTraceRealtimeStartRequest,
} from '@repo/types/api/agent-trace';
import { ApiClientError, apiClient } from '@/lib/api-client';
import { createMockChatText } from '@/lib/ai-usage-guard';
import { createAgentTraceApi } from '@/lib/agent-trace-api';
import { buildChatAgentTracePayload } from '@/lib/agent-trace-payload';
import { parseChatApiRequestBody, shouldSearchKnowledgeForChat } from '@/lib/chat-api-policy';
import { createChatMessageApi } from '@/lib/chat-message-api';
import {
  readCanonicalChatBearerToken,
  resolveCanonicalChatAgentAccess,
} from '@/lib/chat-agent-access';
import type { ChatAgentDecision } from '@/lib/chat-agent-runtime';
import { type ActiveStudyContext, type ChatContextMessage } from '@/lib/chat-context';
import {
  assembleChatContextForRoute,
  buildConversationContextHeaders,
  logChatRouteFailureSafely,
  runChatContextPreparation,
} from '@/lib/chat-context-orchestration';
import { verifyKnowledgeChunksForChat } from '@/lib/chat-rag-context';
import {
  admitChatTurnBridge,
  resolveChatTurnBridgeConfig,
  resolveChatTurnBridgeDecision,
} from '@/lib/chat-turn-bridge';
import { createChatTurnHandoffResponse } from '@/lib/chat-turn-handoff-response';
import { chatTurnApi } from '@/lib/chat-turn-api';
import { createChatFinalResponseRuntimeV1 } from '@/lib/chat-final-response-runtime';
import { createFinalResponseDataStreamAdapterV1 } from '@/lib/final-response-data-stream-adapter';
import {
  buildChatModelAgentObservationHeaders,
  projectChatModelAgentObservation,
  projectTutorModelAgentObservation,
} from '@/lib/chat-model-agent-observation';
import { orchestrateChatModelAgents } from '@/lib/chat-model-agent-orchestration';
import { createChatModelAgentRuntimeBundle } from '@/lib/chat-model-agent-runtime';
import { createTutorModelRuntimeBundle } from '@/lib/tutor-model-runtime';
import { resolveChatProviderRuntime } from '@/lib/chat-provider-status';
import {
  buildVerifiedEvidenceContextPromptV1,
  prepareRealtimeFinalResponseV1,
  runRealtimeRetrieverCompositionV1,
  type PreparedRealtimeFinalResponseV1,
} from '@/lib/chat-realtime-composition';
import {
  buildRealtimeChatTraceFailureFinalizeV1,
  buildRealtimeChatTraceFinalizeV1,
  buildRealtimeChatTracePreparationV1,
  buildRealtimeChatTraceStartV1,
} from '@/lib/chat-realtime-trace';
import { createChatKnowledgeRetrieverSearchPortV1 } from '@/lib/retriever-search-port';
import { createRetrieverQueryRewriteModelRuntimeBundle } from '@/lib/retriever-query-rewrite-model-runtime';
import {
  bindResponseBodyCancellationV1,
  createRequestAbortScopeV1,
} from '@/lib/response-abort-bridge';

const AGENT_TRACE_TIMEOUT_MS = 800;
const CHAT_REQUEST_DEADLINE_MS = 120_000;
const agentTraceApi = createAgentTraceApi(apiClient);
const chatMessageApi = createChatMessageApi(apiClient);

const CHAT_ERROR_MESSAGE = 'AI 服务暂时不可用，请检查 API Key、模型配置或稍后重试。';

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

async function startAgentTraceSafely(
  accessToken: string | null,
  payload: AgentTraceRealtimeStartRequest,
  parentSignal: AbortSignal,
) {
  if (!accessToken) return false;
  return runTraceWriteSafely(
    (signal) => agentTraceApi.startRealtimeTrace(accessToken, payload, { signal }),
    parentSignal,
  );
}

async function finalizeAgentTraceSafely(
  accessToken: string | null,
  payload: AgentTraceRealtimeFinalizeRequest,
) {
  if (!accessToken) return false;
  return runTraceWriteSafely((signal) =>
    agentTraceApi.finalizeRealtimeTrace(accessToken, payload.runId, payload, { signal }),
  );
}

async function prepareAgentTraceSafely(
  accessToken: string | null,
  payload: AgentTraceRealtimePrepareRequest,
  parentSignal: AbortSignal,
) {
  if (!accessToken) return false;
  return runTraceWriteSafely(
    (signal) => agentTraceApi.prepareRealtimeTrace(accessToken, payload.runId, payload, { signal }),
    parentSignal,
  );
}

async function runTraceWriteSafely(
  write: (signal: AbortSignal) => Promise<unknown>,
  parentSignal?: AbortSignal,
) {
  if (parentSignal?.aborted) return false;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });
  if (parentSignal?.aborted) onParentAbort();
  const timeout = setTimeout(() => controller.abort(), AGENT_TRACE_TIMEOUT_MS);
  try {
    await write(controller.signal);
    return true;
  } catch {
    console.warn('[AgentTrace] persistence unavailable');
    return false;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

async function finalizeUnexpectedAgentTraceSafely(
  input: Readonly<{
    accessToken: string | null;
    traceStartPayload: AgentTraceRealtimeStartRequest;
    tracePreparationPayload?: AgentTraceRealtimePrepareRequest;
    reasonCode: Parameters<typeof buildRealtimeChatTraceFailureFinalizeV1>[0]['reasonCode'];
    finalResponseAttempted?: boolean;
  }>,
) {
  try {
    const terminal = buildRealtimeChatTraceFailureFinalizeV1({
      start: input.traceStartPayload,
      ...(input.tracePreparationPayload === undefined
        ? {}
        : { preparation: input.tracePreparationPayload }),
      finishedAt: new Date(),
      reasonCode: input.reasonCode,
      ...(input.finalResponseAttempted === undefined
        ? {}
        : { finalResponseAttempted: input.finalResponseAttempted }),
    });
    await finalizeAgentTraceSafely(input.accessToken, terminal);
  } catch {
    console.warn('[AgentTrace] terminal projection unavailable');
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

function createRealtimeChatResponse(input: {
  mode: 'mock' | 'live';
  prepared: PreparedRealtimeFinalResponseV1;
  runtime: ReturnType<typeof createChatFinalResponseRuntimeV1>;
  executionContext: Parameters<typeof runFinalResponseAgentNodeV1>[0]['context'];
  responseId: string;
  modelCallId: string;
  traceStarted: boolean;
  tracePrepared: boolean;
  traceStartPayload: AgentTraceRealtimeStartRequest;
  tracePreparationPayload: AgentTraceRealtimePrepareRequest;
  accessToken: string | null;
  verifierResult?: KnowledgeVerifierResult;
  agentDecision: ChatAgentDecision;
  contextHeaders: Record<string, string>;
  modelAgentHeaders: Record<string, string>;
}) {
  const ragHitCount = input.prepared.evidence.traceSummary.projectedCount;
  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': input.mode,
      'x-prepmind-rag-hit-count': String(ragHitCount),
      'x-prepmind-knowledge-verifier-status': input.verifierResult?.status ?? 'skipped',
      'x-prepmind-knowledge-verifier-chunks': String(
        input.verifierResult?.debug.checkedChunkCount ?? 0,
      ),
      'x-prepmind-agent-trace-recorded': String(input.traceStarted && input.tracePrepared),
      ...input.contextHeaders,
      ...input.agentDecision.debugHeaders,
      ...input.modelAgentHeaders,
    },
    execute: async (dataStream) => {
      const adapter = createFinalResponseDataStreamAdapterV1({
        citationMarkdown: input.prepared.evidence.citationProjection.markdown,
        writeText: (text) => dataStream.write(formatDataStreamPart('text', text)),
      });
      try {
        const execution = await runFinalResponseAgentNodeV1({
          request: input.prepared.request,
          context: input.executionContext,
          config: input.runtime.config,
          responseId: input.responseId,
          modelCallId: input.modelCallId,
          ...(input.runtime.executor === undefined ? {} : { executor: input.runtime.executor }),
          emit: adapter.emit,
          traceAvailable: input.traceStarted && input.tracePrepared,
        });
        if (!execution.ok) throw new Error('FINAL_RESPONSE_COMPOSITION_INVALID');
        if (!adapter.isTerminal()) throw new Error('FINAL_RESPONSE_STREAM_TERMINAL_MISSING');
        const terminalPayload = buildRealtimeChatTraceFinalizeV1({
          start: input.traceStartPayload,
          preparation: input.tracePreparationPayload,
          observation: execution.observation,
          finishedAt: new Date(),
        });
        await finalizeAgentTraceSafely(input.accessToken, terminalPayload);
      } catch (error) {
        await finalizeUnexpectedAgentTraceSafely({
          accessToken: input.accessToken,
          traceStartPayload: input.traceStartPayload,
          tracePreparationPayload: input.tracePreparationPayload,
          finalResponseAttempted: true,
          reasonCode: input.executionContext.signal.aborted
            ? 'request_aborted'
            : error instanceof Error && error.message === 'FINAL_RESPONSE_COMPOSITION_INVALID'
              ? 'composition_invalid'
              : error instanceof Error && error.message === 'FINAL_RESPONSE_STREAM_TERMINAL_MISSING'
                ? 'terminal_missing'
                : 'unexpected_failure',
        });
        throw error;
      }
    },
    onError: () => CHAT_ERROR_MESSAGE,
  });
}

function createAnonymousMockChatResponse(input: {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
}) {
  const text = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
    agentRoute: 'chat',
  });
  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': 'mock',
      'x-prepmind-rag-hit-count': '0',
      'x-prepmind-knowledge-verifier-status': 'skipped',
      'x-prepmind-knowledge-verifier-chunks': '0',
      'x-prepmind-agent-trace-recorded': 'false',
      'x-prepmind-agent-route': 'chat',
    },
    execute: async (dataStream) => {
      for (let index = 0; index < text.length; index += 18) {
        dataStream.write(formatDataStreamPart('text', text.slice(index, index + 18)));
      }
    },
  });
}

function createChatTurnBridgeFailureResponse(error: unknown) {
  if (error instanceof ApiClientError) {
    const status =
      error.code === 'REQUEST_ABORTED'
        ? 499
        : error.status === 0
          ? 503
          : error.status >= 400 && error.status <= 599
            ? error.status
            : 500;
    const message =
      status === 401
        ? '登录状态已失效，请重新登录'
        : status === 403 || status === 404
          ? '聊天会话权限或状态已变化，请刷新后重试'
          : status === 409
            ? '聊天消息已发生变化，请刷新后重试'
            : status === 499
              ? '请求已取消'
              : '后台回答暂时无法入队，请稍后重试';
    return Response.json(
      { error: message },
      {
        status,
        headers: { 'x-prepmind-chat-turn-path': 'turn-backed-rejected' },
      },
    );
  }

  return Response.json(
    { error: '后台回答暂时无法入队，请稍后重试' },
    {
      status: 500,
      headers: { 'x-prepmind-chat-turn-path': 'turn-backed-rejected' },
    },
  );
}

export async function POST(req: Request) {
  const requestScope = createRequestAbortScopeV1(req.signal);
  let responseOwnsRequestScope = false;
  let traceStartPayload: AgentTraceRealtimeStartRequest | undefined;
  let tracePreparationPayload: AgentTraceRealtimePrepareRequest | undefined;
  let canonicalAccessToken: string | null = null;
  try {
    const parsedRequest = parseChatApiRequestBody(await req.json());

    if (!parsedRequest.ok) {
      return Response.json({ error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const { messages, turnInputMessages, activeContext, accessToken, conversationId } =
      parsedRequest.data;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    const { environment: chatRuntimeEnv, status: providerStatus } = resolveChatProviderRuntime();
    const traceRunId = crypto.randomUUID();
    const modelCallId = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const traceStartedAt = new Date();
    const canonicalAccess = await resolveCanonicalChatAgentAccess(
      {
        mode: providerStatus.mode,
        accessToken,
        request: req,
        runId: traceRunId,
        requestId,
        deadlineAt: new Date(traceStartedAt.getTime() + CHAT_REQUEST_DEADLINE_MS).toISOString(),
        signal: requestScope.signal,
      },
      {
        authenticate: ({ accessToken: canonicalToken, signal }) =>
          apiClient.get<unknown>('/auth/me', {
            accessToken: canonicalToken,
            signal,
          }),
      },
    );

    if (!canonicalAccess.ok) {
      return Response.json({ error: canonicalAccess.error }, { status: canonicalAccess.status });
    }
    const executionContext = canonicalAccess.access.executionContext;
    const canonicalBearer = readCanonicalChatBearerToken({
      access: canonicalAccess.access,
      request: req,
      executionContext,
    });
    if (!canonicalBearer.ok) {
      return Response.json({ error: canonicalBearer.error }, { status: canonicalBearer.status });
    }
    canonicalAccessToken = canonicalBearer.accessToken;

    const normalizedMessages = messages as ChatContextMessage[];
    const normalizedActiveContext = activeContext;
    if (executionContext.principal.kind === 'anonymous') {
      const response = bindResponseBodyCancellationV1(
        createAnonymousMockChatResponse({
          messages: normalizedMessages,
          activeContext: normalizedActiveContext,
        }),
        requestScope,
      );
      responseOwnsRequestScope = true;
      return response;
    }

    if (canonicalAccessToken === null) {
      return Response.json(
        { error: 'Chat authorization context is unavailable.' },
        { status: 500 },
      );
    }

    const chatTurnBridgeDecision = resolveChatTurnBridgeDecision({
      config: resolveChatTurnBridgeConfig(process.env),
      conversationId,
      messages: turnInputMessages,
    });
    if (chatTurnBridgeDecision.kind === 'reject') {
      return Response.json(
        { error: '聊天消息状态无效，请刷新后重试' },
        {
          status: 400,
          headers: { 'x-prepmind-chat-turn-path': 'turn-backed-rejected' },
        },
      );
    }
    if (chatTurnBridgeDecision.kind === 'enqueue') {
      try {
        const handoff = await admitChatTurnBridge(
          {
            ownerId: executionContext.principal.ownerId,
            accessToken: canonicalAccessToken,
            decision: chatTurnBridgeDecision,
            signal: executionContext.signal,
          },
          {
            prepareMessages: (token, request, options) =>
              chatMessageApi.prepareForTurn(token, request, options),
            enqueueTurn: (token, request, options) => chatTurnApi.enqueue(token, request, options),
          },
        );
        const response = bindResponseBodyCancellationV1(
          createChatTurnHandoffResponse(handoff),
          requestScope,
        );
        responseOwnsRequestScope = true;
        return response;
      } catch (error) {
        return createChatTurnBridgeFailureResponse(error);
      }
    }

    if (!providerStatus.configured) {
      return Response.json({ error: providerStatus.message }, { status: 503 });
    }

    traceStartPayload = buildRealtimeChatTraceStartV1({
      runId: traceRunId,
      modelCallId,
      conversationId,
      mode: providerStatus.mode,
      startedAt: traceStartedAt,
    });
    const traceStarted = await startAgentTraceSafely(
      canonicalAccessToken,
      traceStartPayload,
      executionContext.signal,
    );

    let accessAndContext: Awaited<ReturnType<typeof runChatContextPreparation>>;
    try {
      accessAndContext = await runChatContextPreparation({
        accessToken: canonicalAccessToken,
        conversationId,
        maxInputTokens: providerStatus.maxInputTokens,
        requestSignal: executionContext.signal,
        timeoutValue: process.env.CONVERSATION_CONTEXT_PREPARE_TIMEOUT_MS,
      });
    } catch {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: executionContext.signal.aborted
          ? 'request_aborted'
          : 'context_preparation_failed',
      });
      return Response.json(
        { error: executionContext.signal.aborted ? '请求已取消' : '会话上下文准备失败' },
        { status: executionContext.signal.aborted ? 499 : 500 },
      );
    }

    const conversationContext = accessAndContext.context;

    const modelAgentBundle = createChatModelAgentRuntimeBundle({ env: chatRuntimeEnv });
    let agentExecutionResult: Awaited<ReturnType<typeof orchestrateChatModelAgents>>;
    try {
      agentExecutionResult = await orchestrateChatModelAgents({
        bundle: modelAgentBundle,
        createTutorBundle: () => createTutorModelRuntimeBundle({ env: chatRuntimeEnv }),
        messages: normalizedMessages,
        activeContext: normalizedActiveContext,
        executionContext,
      });
    } catch {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: executionContext.signal.aborted ? 'request_aborted' : 'router_failed',
      });
      return Response.json(
        { error: executionContext.signal.aborted ? '请求已取消' : 'Agent 路由失败' },
        { status: executionContext.signal.aborted ? 499 : 500 },
      );
    }
    const { agentExecution, verifierModel } = agentExecutionResult;
    const routedDecision = agentExecution.decision;
    const agentDecision: ChatAgentDecision = {
      ...routedDecision,
      requiresRag: shouldSearchKnowledgeForChat({
        authenticated: true,
        requiresRag: routedDecision.requiresRag,
        latestUserText: getLatestUserText(normalizedMessages),
      }),
    };
    const retrieverPort = createChatKnowledgeRetrieverSearchPortV1({
      access: canonicalAccess.access,
      request: req,
      executionContext,
    });
    if (!retrieverPort.ok) {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: 'retrieval_failed',
      });
      return Response.json({ error: '知识检索权限绑定失败' }, { status: 403 });
    }
    const queryRewrite = createRetrieverQueryRewriteModelRuntimeBundle({
      env: chatRuntimeEnv,
    });
    const retrieval = await runRealtimeRetrieverCompositionV1({
      context: executionContext,
      messages: normalizedMessages,
      activeContext: normalizedActiveContext,
      decision: agentDecision,
      port: retrieverPort.port,
      queryRewrite,
      verify: async ({ query, result }) => {
        const verified = await verifyKnowledgeChunksForChat({
          query,
          chunks: toKnowledgeVerifierChunks(result),
          model: verifierModel,
        });
        return {
          assessment: {
            status: verified.result.status,
            availability: 'available',
          },
          detail: verified.result,
          ...(verified.observation === undefined ? {} : { observation: verified.observation }),
        };
      },
    });
    if (!retrieval.ok) {
      const requestAborted = retrieval.reasonCode === 'aborted';
      const principalBindingInvalid = retrieval.reasonCode === 'principal_binding_invalid';
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: requestAborted ? 'request_aborted' : 'retrieval_failed',
      });
      return Response.json(
        {
          error: requestAborted
            ? '请求已取消'
            : principalBindingInvalid
              ? '知识检索权限绑定失败'
              : '实时 Agent 检索编排失败',
        },
        { status: requestAborted ? 499 : principalBindingInvalid ? 403 : 400 },
      );
    }
    const knowledgeVerifierResult = retrieval.value.verifier.detail;
    const routerModelObservation = projectChatModelAgentObservation(
      agentExecution.routerObservation,
    );
    const verifierModelObservation =
      retrieval.value.verifier.observation === undefined
        ? undefined
        : projectChatModelAgentObservation(retrieval.value.verifier.observation);
    const tutorModelObservation = projectTutorModelAgentObservation(
      agentExecution.tutorObservation,
    );
    const modelAgentHeaders = buildChatModelAgentObservationHeaders({
      router: agentExecution.routerObservation,
      tutor: agentExecution.tutorObservation,
      ...(retrieval.value.verifier.observation === undefined
        ? {}
        : { verifier: retrieval.value.verifier.observation }),
    });
    const knowledgeContextPrompt = buildVerifiedEvidenceContextPromptV1(retrieval.value);
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
    const contextHeaders = buildConversationContextHeaders({
      summaryStatus: conversationContext.summaryStatus,
      summaryVersion: conversationContext.summaryVersion,
      droppedLayers: budget.contextPolicy.droppedLayers,
    });

    if (budget.modelMessages.length === 0) {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: 'budget_invalid',
      });
      return Response.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    if (budget.exceedsInputLimit) {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode: 'budget_invalid',
      });
      return Response.json(
        {
          error: `本次输入上下文过长，估算 ${budget.estimatedInputTokens} tokens，超过当前上限 ${budget.maxInputTokens} tokens。请缩短问题或开启更高预算后重试。`,
        },
        { status: 413 },
      );
    }
    const ragIncluded =
      agentDecision.requiresRag &&
      knowledgeContextPrompt.length > 0 &&
      !(budget.contextPolicy.droppedLayers ?? []).includes('rag');
    const prepared = prepareRealtimeFinalResponseV1({
      context: executionContext,
      messages: budget.modelMessages,
      decision: agentDecision,
      retriever: retrieval.value,
      ragIncluded,
      maxInputTokens: budget.maxInputTokens,
    });
    if (!prepared.ok) {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        reasonCode:
          prepared.reasonCode === 'aborted' ? 'request_aborted' : 'final_response_prepare_failed',
      });
      return Response.json({ error: '最终回答上下文校验失败' }, { status: 400 });
    }
    const mockText = createMockChatText({
      hasActiveContext: Boolean(normalizedActiveContext),
      latestUserText: getLatestUserText(budget.modelMessages),
      agentRoute: agentDecision.route,
      tutorIntent: agentDecision.tutorStrategy?.intent,
      verifierStatus: knowledgeVerifierResult?.status,
    });
    const runtime = createChatFinalResponseRuntimeV1({
      mode: providerStatus.mode,
      mockText,
      env: chatRuntimeEnv,
    });
    const preparedAt = new Date();
    const traceBase = buildChatAgentTracePayload({
      runId: traceRunId,
      conversationId,
      messages: normalizedMessages,
      mode: providerStatus.mode,
      modelProvider: resolveTraceModelProvider(
        providerStatus.mode,
        providerStatus.model,
        providerStatus.baseURL,
      ),
      modelName: runtime.config.modelRef,
      budget,
      agentDecision,
      knowledgeHits: retrieval.value.retriever.result.evidenceCandidates.map((candidate) => ({
        documentId: candidate.documentId,
        chunkId: candidate.chunkId,
        documentName: candidate.sourceRef,
        content: candidate.excerpt,
        score: candidate.score,
      })),
      knowledgeVerifierResult,
      modelAgentObservations: {
        router: routerModelObservation,
        tutor: tutorModelObservation,
        ...(verifierModelObservation === undefined ? {} : { verifier: verifierModelObservation }),
      },
      startedAt: traceStartedAt,
      finishedAt: preparedAt,
    });
    tracePreparationPayload = buildRealtimeChatTracePreparationV1({
      start: traceStartPayload,
      base: traceBase,
      requiresRag: agentDecision.requiresRag,
      retriever: retrieval.value,
      evidence: prepared.value.evidence,
      preparedAt,
    });
    const tracePrepared = await prepareAgentTraceSafely(
      canonicalAccessToken,
      tracePreparationPayload,
      executionContext.signal,
    );

    const response = bindResponseBodyCancellationV1(
      createRealtimeChatResponse({
        mode: providerStatus.mode,
        prepared: prepared.value,
        runtime,
        executionContext,
        responseId: crypto.randomUUID(),
        modelCallId,
        traceStarted,
        tracePrepared,
        traceStartPayload,
        tracePreparationPayload,
        accessToken: canonicalAccessToken,
        verifierResult: knowledgeVerifierResult,
        agentDecision,
        contextHeaders,
        modelAgentHeaders,
      }),
      requestScope,
    );
    responseOwnsRequestScope = true;
    return response;
  } catch {
    const requestAborted = requestScope.signal.aborted;
    if (traceStartPayload !== undefined) {
      await finalizeUnexpectedAgentTraceSafely({
        accessToken: canonicalAccessToken,
        traceStartPayload,
        ...(tracePreparationPayload === undefined ? {} : { tracePreparationPayload }),
        reasonCode: requestAborted ? 'request_aborted' : 'unexpected_failure',
      });
    }
    logChatRouteFailureSafely(console);
    return Response.json(
      { error: requestAborted ? '请求已取消' : 'AI 服务暂时不可用，请稍后重试' },
      { status: requestAborted ? 499 : 500 },
    );
  } finally {
    if (!responseOwnsRequestScope) requestScope.dispose();
  }
}

function toKnowledgeVerifierChunks(
  result: Parameters<
    Parameters<typeof runRealtimeRetrieverCompositionV1>[0]['verify']
  >[0]['result'],
): KnowledgeVerifierChunk[] {
  return result.evidenceCandidates.map((candidate) => ({
    documentId: candidate.documentId,
    documentTitle: candidate.sourceRef,
    chunkId: candidate.chunkId,
    content: candidate.excerpt,
    score: candidate.score,
    metadata: {
      safety: {
        riskLevel:
          candidate.safety.status === 'blocked'
            ? 'high'
            : candidate.safety.status === 'caution'
              ? 'medium'
              : 'low',
        categories: [...candidate.safety.codes],
        matchedPatterns: [],
        safeForPrompt: candidate.safety.status === 'safe' || candidate.safety.status === 'caution',
      },
    },
  }));
}
