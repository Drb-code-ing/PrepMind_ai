export const CHAT_EMPTY_ASSISTANT_MESSAGE = '本次回答没有成功生成，请重试';

type ChatCompletionMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatCompletionGuardInput = {
  messages: ChatCompletionMessage[];
  isLoading: boolean;
  streamStarted?: boolean;
};

type ChatCompletionGuardResult = {
  canSync: boolean;
  emptyAssistantReply: boolean;
  userMessageId: string | null;
  message: string | null;
};

export function buildChatCompletionSignature(messages: ChatCompletionMessage[]) {
  return messages
    .map((message) => `${message.id}:${message.role}:${message.content}`)
    .join('\u001f');
}

export function getChatSyncSettleMs(input: { streamStarted?: boolean; throttleMs: number }) {
  if (!input.streamStarted) return 0;
  return Math.max(input.throttleMs * 2 + 40, 120);
}

export function getChatCompletionGuard(
  input: ChatCompletionGuardInput,
): ChatCompletionGuardResult {
  if (input.isLoading || input.messages.length === 0) {
    return {
      canSync: false,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    };
  }

  const latestMessage = input.messages[input.messages.length - 1];
  if (!latestMessage) {
    return {
      canSync: false,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    };
  }

  if (latestMessage.role === 'assistant' && latestMessage.content.trim()) {
    return {
      canSync: true,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    };
  }

  if (!input.streamStarted) {
    return {
      canSync: false,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    };
  }

  if (latestMessage.role === 'user') {
    return {
      canSync: false,
      emptyAssistantReply: true,
      userMessageId: latestMessage.id,
      message: CHAT_EMPTY_ASSISTANT_MESSAGE,
    };
  }

  if (!latestMessage.content.trim()) {
    const previousUserMessage = [...input.messages]
      .reverse()
      .find((message) => message.role === 'user');

    return {
      canSync: false,
      emptyAssistantReply: true,
      userMessageId: previousUserMessage?.id ?? null,
      message: CHAT_EMPTY_ASSISTANT_MESSAGE,
    };
  }

  return {
    canSync: false,
    emptyAssistantReply: false,
    userMessageId: null,
    message: null,
  };
}
