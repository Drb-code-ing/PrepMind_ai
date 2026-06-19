import { createDataStreamResponse, formatDataStreamPart, streamText } from 'ai';
import { aiProvider, getAiProviderStatus } from '@/lib/ai-provider';
import { buildChatRequestBudget, createMockChatText } from '@/lib/ai-usage-guard';
import {
  type ActiveStudyContext,
  type ChatContextMessage,
} from '@/lib/chat-context';

const BASE_SYSTEM_PROMPT = `你是 PrepMind AI，一个专业的智能备考助手。你的职责是：
1. 帮助学生理解知识点，用简洁清晰的语言讲解
2. 解答题目时给出解题思路，不只给答案
3. 鼓励学生思考，适当引导
4. 回答使用中文，格式清晰，必要时使用 Markdown 列表或代码块

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

function createMockChatResponse(input: {
  messages: ChatContextMessage[];
  activeContext: ActiveStudyContext | null;
}) {
  const mockText = createMockChatText({
    hasActiveContext: Boolean(input.activeContext),
    latestUserText: getLatestUserText(input.messages),
  });

  return createDataStreamResponse({
    headers: {
      'x-prepmind-ai-mode': 'mock',
    },
    execute: async (dataStream) => {
      for (const chunk of splitMockText(mockText)) {
        dataStream.write(formatDataStreamPart('text', chunk));
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
    },
  });
}

export async function POST(req: Request) {
  try {
    const { messages, activeContext } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: '消息列表不能为空' }, { status: 400 });
    }

    const providerStatus = getAiProviderStatus();

    if (!providerStatus.configured) {
      return Response.json({ error: providerStatus.message }, { status: 503 });
    }

    const normalizedActiveContext = isActiveStudyContext(activeContext) ? activeContext : null;
    const budget = buildChatRequestBudget({
      baseSystemPrompt: BASE_SYSTEM_PROMPT,
      activeContext: normalizedActiveContext,
      messages: messages as ChatContextMessage[],
      maxInputTokens: providerStatus.maxInputTokens,
      maxOutputTokens: providerStatus.maxOutputTokens,
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

    if (providerStatus.mode === 'mock') {
      return createMockChatResponse({
        messages: budget.modelMessages,
        activeContext: normalizedActiveContext,
      });
    }

    console.info(
      `[AI usage estimate] mode=live model=${providerStatus.model} input≈${budget.estimatedInputTokens}/${budget.maxInputTokens} maxOutput=${budget.maxOutputTokens} messages=${budget.modelMessages.length} activeContext=${Boolean(normalizedActiveContext)}`,
    );

    const result = streamText({
      model: aiProvider(providerStatus.model),
      system: budget.systemPrompt,
      messages: budget.modelMessages,
      maxTokens: budget.maxOutputTokens,
    });

    return result.toDataStreamResponse({
      headers: {
        'x-prepmind-ai-mode': 'live',
      },
      getErrorMessage: () => 'AI 服务暂时不可用，请检查 API Key、模型配置或稍后重试。',
    });
  } catch (error) {
    console.error('[Chat API]', error);
    return Response.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
