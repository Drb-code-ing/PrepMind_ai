import { chatTurnHandoffAnnotationSchema } from '@repo/types/api/chat-turn';
import type { JSONValue } from 'ai';

import type { StoredChatTurnRecovery } from './db.ts';
import { getChatTurnHandoff } from './chat-turn-handoff.ts';
import type { ChatTurnReplayProgress, ChatTurnReplayResult } from './chat-turn-replay.ts';

export type ChatTurnRecoveryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  annotations?: JSONValue[];
};

export class ChatTurnRecoveryHistoryError extends Error {
  constructor() {
    super('The durable ChatTurn response does not fit the hydrated message history');
    this.name = 'ChatTurnRecoveryHistoryError';
  }
}

export function upsertChatTurnRecoveryMessage(
  messages: readonly ChatTurnRecoveryMessage[],
  recovery: StoredChatTurnRecovery,
  progress: ChatTurnReplayProgress,
) {
  const content = buildChatTurnRecoveryContent(progress);
  const annotation = chatTurnHandoffAnnotationSchema.parse({
    type: 'prepmind-chat-turn-handoff-v1',
    turnId: recovery.turnId,
    conversationId: recovery.conversationId,
    status: progress.status,
    backgroundJobId: recovery.backgroundJobId,
  });
  const index = messages.findIndex(
    (message) => getChatTurnHandoff(message)?.turnId === recovery.turnId,
  );
  if (index >= 0) {
    const current = messages[index];
    if (current?.content === content && getChatTurnHandoff(current)?.status === annotation.status) {
      return messages as ChatTurnRecoveryMessage[];
    }
    return messages.map((message, messageIndex) =>
      messageIndex === index ? { ...message, content, annotations: [annotation] } : message,
    );
  }
  if (messages.some((message) => message.id === recovery.placeholderMessageId)) {
    return messages as ChatTurnRecoveryMessage[];
  }
  return [
    ...messages,
    {
      id: recovery.placeholderMessageId,
      role: 'assistant' as const,
      content,
      annotations: [annotation],
    },
  ];
}

export function resolveChatTurnRecoveryMessage(
  messages: readonly ChatTurnRecoveryMessage[],
  recovery: StoredChatTurnRecovery,
  result: Extract<ChatTurnReplayResult, { kind: 'succeeded' }>,
) {
  const response = result.response;
  const withoutPlaceholder = removeChatTurnRecoveryMessage(messages, recovery.turnId);
  const existingResponseIndex = withoutPlaceholder.findIndex(
    (message) => message.id === response.id,
  );
  if (existingResponseIndex >= 0) {
    if (existingResponseIndex !== response.order) throw new ChatTurnRecoveryHistoryError();
    return withoutPlaceholder;
  }
  const responseMessage = {
    id: response.id,
    role: 'assistant' as const,
    content: response.content,
  };
  const placeholderIndex = messages.findIndex(
    (message) =>
      message.id === recovery.placeholderMessageId &&
      getChatTurnHandoff(message)?.turnId === recovery.turnId,
  );
  if (placeholderIndex >= 0) {
    if (placeholderIndex !== response.order) throw new ChatTurnRecoveryHistoryError();
    const insertionIndex = Math.min(placeholderIndex, withoutPlaceholder.length);
    return [
      ...withoutPlaceholder.slice(0, insertionIndex),
      responseMessage,
      ...withoutPlaceholder.slice(insertionIndex),
    ];
  }

  if (response.order > withoutPlaceholder.length) throw new ChatTurnRecoveryHistoryError();
  const insertionIndex = Math.min(response.order, withoutPlaceholder.length);
  return [
    ...withoutPlaceholder.slice(0, insertionIndex),
    responseMessage,
    ...withoutPlaceholder.slice(insertionIndex),
  ];
}

export function removeChatTurnRecoveryMessage(
  messages: readonly ChatTurnRecoveryMessage[],
  turnId: string,
) {
  return messages.filter((message) => getChatTurnHandoff(message)?.turnId !== turnId);
}

export function buildChatTurnRecoveryContent(progress: ChatTurnReplayProgress) {
  const statusText = progress.reconnecting
    ? '连接暂时中断，正在恢复后台回答...'
    : progress.transport === 'status_only'
      ? '实时进度暂不可用，正在从服务器确认后台回答...'
      : progress.status === 'QUEUED'
        ? '回答已加入后台队列，正在等待处理...'
        : progress.attempt > 1
          ? `后台回答正在重试（第 ${progress.attempt}/${progress.maxAttempts} 次）...`
          : '正在后台生成回答...';
  return progress.previewText ? `${progress.previewText}\n\n> ${statusText}` : statusText;
}
