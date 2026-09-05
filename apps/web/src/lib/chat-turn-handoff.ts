import { chatTurnHandoffAnnotationSchema } from '@repo/types/api/chat-turn';

type ChatTurnHandoffMessage = Readonly<{
  id?: string;
  role: string;
  content?: string;
  annotations?: readonly unknown[];
}>;

export function getChatTurnHandoff(message: ChatTurnHandoffMessage) {
  if (message.role !== 'assistant' || !Array.isArray(message.annotations)) {
    return null;
  }

  for (const annotation of message.annotations) {
    const parsed = chatTurnHandoffAnnotationSchema.safeParse(annotation);
    if (parsed.success) return parsed.data;
  }
  return null;
}

export function isChatTurnHandoffMessage(message: ChatTurnHandoffMessage) {
  return getChatTurnHandoff(message) !== null;
}

export function hasPendingChatTurnHandoff(messages: readonly ChatTurnHandoffMessage[]) {
  const latest = messages.at(-1);
  return latest !== undefined && isChatTurnHandoffMessage(latest);
}

export function omitChatTurnHandoffMessages<T extends ChatTurnHandoffMessage>(
  messages: readonly T[],
) {
  return messages.filter((message) => !isChatTurnHandoffMessage(message));
}

export function getLatestChatTurnHandoff<T extends ChatTurnHandoffMessage>(messages: readonly T[]) {
  const message = messages.at(-1);
  if (!message) return null;
  const handoff = getChatTurnHandoff(message);
  return handoff ? { message, handoff } : null;
}
