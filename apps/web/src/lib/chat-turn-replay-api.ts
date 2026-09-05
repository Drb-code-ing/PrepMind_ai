import {
  chatStreamEventsQuerySchema,
  chatStreamEventsResponseSchema,
  chatTurnStatusResponseSchema,
  type ChatStreamEventsQuery,
  type ChatStreamEventsResponse,
  type ChatTurnStatusResponse,
} from '@repo/types/api/chat-stream';
import { CHAT_TURN_ID_PATTERN } from '@repo/types/api/chat-turn';

import { apiClient } from './api-client.ts';

const safeIdPattern = new RegExp(CHAT_TURN_ID_PATTERN);

type ApiClient = {
  get: <T>(
    path: string,
    options?: {
      accessToken?: string | null;
      expectedStatus?: number | readonly number[];
      signal?: AbortSignal | null;
    },
  ) => Promise<T>;
};

export type ChatTurnReplayRequestOptions = {
  signal?: AbortSignal | null;
};

export function createChatTurnReplayApi(client: ApiClient) {
  return {
    async getStatus(
      accessToken: string,
      turnId: string,
      options: ChatTurnReplayRequestOptions = {},
    ): Promise<ChatTurnStatusResponse> {
      const token = requireAccessToken(accessToken);
      const id = requireSafeId(turnId, 'turnId');
      const response = await client.get<unknown>(`/chat-turns/${encodeURIComponent(id)}`, {
        accessToken: token,
        expectedStatus: 200,
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      });
      return chatTurnStatusResponseSchema.parse(response);
    },

    async getEvents(
      accessToken: string,
      turnId: string,
      query: Partial<ChatStreamEventsQuery> = {},
      options: ChatTurnReplayRequestOptions = {},
    ): Promise<ChatStreamEventsResponse> {
      const token = requireAccessToken(accessToken);
      const id = requireSafeId(turnId, 'turnId');
      const parsedQuery = chatStreamEventsQuerySchema.parse(query);
      const search = new URLSearchParams({ limit: String(parsedQuery.limit) });
      if (parsedQuery.cursor !== undefined) search.set('cursor', parsedQuery.cursor);

      const response = await client.get<unknown>(
        `/chat-turns/${encodeURIComponent(id)}/events?${search.toString()}`,
        {
          accessToken: token,
          expectedStatus: 200,
          ...(options.signal !== undefined ? { signal: options.signal } : {}),
        },
      );
      return chatStreamEventsResponseSchema.parse(response);
    },
  };
}

export const chatTurnReplayApi = createChatTurnReplayApi(apiClient);

function requireAccessToken(value: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Chat turn replay requires an access token');
  }
  return value.trim();
}

function requireSafeId(value: string, field: string) {
  if (typeof value !== 'string') throw new TypeError(`${field} is required`);
  const normalized = value.trim();
  if (!safeIdPattern.test(normalized)) throw new TypeError(`${field} is invalid`);
  return normalized;
}
