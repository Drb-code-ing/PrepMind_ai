import { createDataStreamResponse, formatDataStreamPart, streamText } from 'ai';
import { aiProvider, getAiProviderStatus } from '@/lib/ai-provider';
import { buildChatRequestBudget, createMockChatText } from '@/lib/ai-usage-guard';
import {
  buildChatAgentDecision,
  combineChatAdditionalPrompts,
} from '@/lib/chat-agent-runtime';
import {
  type ActiveStudyContext,
  type ChatContextMessage,
} from '@/lib/chat-context';
import {
  appendCitationMarkdown,
  buildKnowledgeContextPrompt,
  searchKnowledgeForChat,
} from '@/lib/chat-rag-context';
import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

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

function isActiveStudyContext(value: unknown): value is ActiveStudyContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'ocr-question' && typeof record.questionText === 'string';
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

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function createMockChatResponse(input: {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
  knowledgeHits: KnowledgeSearchHit[];
  agentDecision: ReturnType<typeof buildChatAgentDecision>;
}) {
  const mockText = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
    agentRoute: input.agentDecision.route,
  });
  const responseText = appendCitationMarkdown(mockText, input.knowledgeHits);

  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': 'mock',
      'x-prepmind-rag-hit-count': String(input.knowledgeHits.length),
      ...input.agentDecision.debugHeaders,
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
  agentDecision: ReturnType<typeof buildChatAgentDecision>;
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
      ...input.agentDecision.debugHeaders,
    },
    execute: async (dataStream) => {
      for await (const chunk of result.textStream) {
        dataStream.write(formatDataStreamPart('text', chunk));
      }

      const citationMarkdown = appendCitationMarkdown('', input.knowledgeHits);
      if (citationMarkdown.trim()) {
        dataStream.write(formatDataStreamPart('text', citationMarkdown));
      }
    },
    onError: () => CHAT_ERROR_MESSAGE,
  });
}

export async function POST(req: Request) {
  try {
    const { messages, activeContext, accessToken } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    const providerStatus = getAiProviderStatus();

    if (!providerStatus.configured) {
      return Response.json({ error: providerStatus.message }, { status: 503 });
    }

    const normalizedMessages = messages as ChatContextMessage[];
    const normalizedActiveContext = isActiveStudyContext(activeContext) ? activeContext : null;
    const agentDecision = buildChatAgentDecision({
      messages: normalizedMessages,
      activeContext: normalizedActiveContext,
      runId: crypto.randomUUID(),
      userId: 'web-chat-user',
    });
    const knowledgeSearch = await searchKnowledgeForChat({
      accessToken: normalizeAccessToken(accessToken),
      messages: normalizedMessages,
      logger: console,
    });
    const knowledgeContextPrompt = buildKnowledgeContextPrompt(knowledgeSearch.hits);
    const additionalSystemPrompt = combineChatAdditionalPrompts(
      agentDecision.promptAddition,
      knowledgeContextPrompt,
    );
    const baseBudgetInput = {
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      activeContext: normalizedActiveContext,
      messages: normalizedMessages,
      maxInputTokens: providerStatus.maxInputTokens,
      maxOutputTokens: providerStatus.maxOutputTokens,
    };
    let budget = buildChatRequestBudget({
      ...baseBudgetInput,
      additionalSystemPrompt: additionalSystemPrompt || undefined,
    });
    let citationHits = knowledgeSearch.hits;

    if (budget.exceedsInputLimit && knowledgeContextPrompt) {
      const fallbackAgentPrompt = combineChatAdditionalPrompts(agentDecision.promptAddition, '');
      const fallbackBudget = buildChatRequestBudget({
        ...baseBudgetInput,
        additionalSystemPrompt: fallbackAgentPrompt || undefined,
      });
      if (!fallbackBudget.exceedsInputLimit) {
        budget = fallbackBudget;
        citationHits = [];
      }
    }

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

    if (providerStatus.mode === 'mock') {
      return createMockChatResponse({
        messages: budget.modelMessages,
        activeContext: normalizedActiveContext,
        knowledgeHits: citationHits,
        agentDecision,
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
      agentDecision,
    });
  } catch (error) {
    console.error('[Chat API]', error);
    return Response.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
