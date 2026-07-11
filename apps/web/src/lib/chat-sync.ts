import type { StoredMessage } from './db';

type SyncableMessage = Pick<StoredMessage, 'id' | 'role' | 'content' | 'order' | 'createdAt'>;

export function buildChatSyncSignature(
  messages: SyncableMessage[],
  conversationId?: string | null,
) {
  const scope = conversationId || 'default';
  const payload = messages
    .map((message, index) =>
      [
        message.id,
        message.role,
        message.order ?? index,
        message.createdAt,
        message.content.length,
        message.content,
      ].join('\u001f'),
    )
    .join('\u001e');

  return `${scope}\u001d${payload}`;
}

export function shouldSkipChatServerSync(input: {
  syncKey: string;
  lastServerSyncKey: string;
  inFlightServerSyncKey: string;
}) {
  return (
    input.syncKey === input.lastServerSyncKey ||
    input.syncKey === input.inFlightServerSyncKey
  );
}

export function beginChatServerSync(input: {
  syncKey: string;
  lastServerSyncKey: string;
  inFlightServerSyncKey: string;
}) {
  if (shouldSkipChatServerSync(input)) {
    return {
      shouldSync: false as const,
      nextInFlightServerSyncKey: input.inFlightServerSyncKey,
    };
  }

  return {
    shouldSync: true as const,
    nextInFlightServerSyncKey: input.syncKey,
  };
}
