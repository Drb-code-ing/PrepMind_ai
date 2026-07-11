import {
  chatMessagesResponseSchema,
  syncChatMessagesRequestSchema,
  type ChatMessageResponse,
  type ChatMessageRole,
  type ListChatMessagesQuery,
  type SyncChatMessagesRequest,
} from '@repo/types/api/chat-message';
import type { ConversationStateResponse } from '@repo/types/api/conversation-context';

import type { StoredMessage } from './db';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export type ChatMessageListFilters = {
  conversationId?: string;
};

export type LocalChatMessagesResult = {
  conversationId: string | null;
  messages: StoredMessage[];
  state: ConversationStateResponse | null;
};

export function createChatMessageApi(client: ApiClient) {
  return {
    async list(
      accessToken: string,
      filters: ChatMessageListFilters = {},
    ): Promise<LocalChatMessagesResult> {
      const response = chatMessagesResponseSchema.parse(
        await client.get<unknown>(`/chat-messages${toQueryString(filters)}`, {
          accessToken,
        }),
      );

      return {
        conversationId: response.conversationId,
        messages: response.messages.map(mapChatMessageResponseToLocalRecord),
        state: response.state ?? null,
      };
    },

    async sync(
      accessToken: string,
      messages: StoredMessage[],
      conversationId?: string | null,
    ): Promise<LocalChatMessagesResult> {
      const request = mapLocalMessagesToSyncRequest(messages, conversationId);
      const response = chatMessagesResponseSchema.parse(
        await client.post<unknown>('/chat-messages/sync', request, {
          accessToken,
        }),
      );

      return {
        conversationId: response.conversationId,
        messages: response.messages.map(mapChatMessageResponseToLocalRecord),
        state: response.state ?? null,
      };
    },

    async clear(accessToken: string, conversationId?: string | null) {
      return client.delete<{ ok: true }>(
        `/chat-messages${toQueryString({ conversationId: conversationId ?? undefined })}`,
        {
          accessToken,
        },
      );
    },
  };
}

export function mapChatMessageResponseToLocalRecord(
  response: ChatMessageResponse,
): StoredMessage {
  return {
    id: response.id,
    userId: response.userId,
    role: mapChatMessageRoleToLocal(response.role),
    content: response.content,
    order: response.order,
    createdAt: Date.parse(response.createdAt),
  };
}

export function mapLocalMessagesToSyncRequest(
  messages: StoredMessage[],
  conversationId?: string | null,
): SyncChatMessagesRequest {
  const request = syncChatMessagesRequestSchema.parse({
    conversationId: conversationId || undefined,
    messages: messages.map((message, index) => ({
      id: message.id,
      role: mapLocalRoleToApi(message.role),
      content: message.content,
      order: message.order ?? index,
      createdAt: new Date(message.createdAt).toISOString(),
    })),
  });

  return stripUndefined(request);
}

function mapLocalRoleToApi(role: StoredMessage['role']): ChatMessageRole {
  return role === 'user' ? 'USER' : 'ASSISTANT';
}

function mapChatMessageRoleToLocal(role: ChatMessageRole): StoredMessage['role'] {
  return role === 'USER' ? 'user' : 'assistant';
}

function toQueryString(filters: ChatMessageListFilters) {
  const query: Partial<ListChatMessagesQuery> = {};
  if (filters.conversationId) query.conversationId = filters.conversationId;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    search.set(key, String(value));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
