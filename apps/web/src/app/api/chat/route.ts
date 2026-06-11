import { streamText } from 'ai';
import { aiProvider, DEFAULT_MODEL, getAiProviderStatus } from '@/lib/ai-provider';
import {
  buildChatContextMessages,
  buildChatSystemPrompt,
  CHAT_CONTEXT_MAX_INPUT_TOKENS,
  type ActiveStudyContext,
  type ChatContextMessage,
} from '@/lib/chat-context';

const BASE_SYSTEM_PROMPT = `你是 PrepMind AI，一个专业的智能备考助手。你的职责是：
1. 帮助学生理解知识点，用简洁清晰的语言讲解
2. 解答题目时给出解题思路，不只给答案
3. 鼓励学生思考，适当引导
4. 回答使用中文，格式清晰，必要时使用 Markdown 列表或代码块`;

function isActiveStudyContext(value: unknown): value is ActiveStudyContext {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'ocr-question' && typeof record.questionText === 'string';
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

    const modelMessages = buildChatContextMessages(messages as ChatContextMessage[], {
      maxInputTokens: CHAT_CONTEXT_MAX_INPUT_TOKENS,
    });
    if (modelMessages.length === 0) {
      return Response.json({ error: '消息内容不能为空' }, { status: 400 });
    }

    const systemPrompt = buildChatSystemPrompt(
      BASE_SYSTEM_PROMPT,
      isActiveStudyContext(activeContext) ? activeContext : null,
    );

    const result = streamText({
      model: aiProvider(DEFAULT_MODEL),
      system: systemPrompt,
      messages: modelMessages,
    });

    return result.toDataStreamResponse({
      getErrorMessage: () => 'AI 服务暂时不可用，请检查 API Key、模型配置或稍后重试。',
    });
  } catch (error) {
    console.error('[Chat API]', error);
    return Response.json({ error: 'AI 服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
