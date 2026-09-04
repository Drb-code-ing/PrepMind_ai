import { chatTurnHandoffAnnotationSchema } from '@repo/types/api/chat-turn';

type ChatTurnHandoffMessage = Readonly<{
  role: string;
  annotations?: readonly unknown[];
}>;

export function isChatTurnHandoffMessage(message: ChatTurnHandoffMessage) {
  if (message.role !== 'assistant' || !Array.isArray(message.annotations)) {
    return false;
  }

  return message.annotations.some(
    (annotation) => chatTurnHandoffAnnotationSchema.safeParse(annotation).success,
  );
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
