import {
  conversationContextPrepareRequestSchema,
  conversationContextPrepareResponseSchema,
  type ConversationContextPrepareRequest,
  type ConversationContextPrepareResponse,
} from '@repo/types/api/conversation-context';

import { apiClient } from './api-client.ts';

export const CONVERSATION_CONTEXT_PREPARE_FAILED =
  'CONVERSATION_CONTEXT_PREPARE_FAILED' as const;

type ConversationContextApiClient = {
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null; signal?: AbortSignal | null },
  ) => Promise<T>;
};

type PrepareConversationContextInput = {
  accessToken: string;
  request: ConversationContextPrepareRequest;
  signal?: AbortSignal | null;
};

type SafeLogger = {
  warn: (...values: unknown[]) => void;
};

export type SafeConversationContextPrepareResult =
  | (ConversationContextPrepareResponse & { safeErrorCode: null })
  | {
      conversationId: string;
      summaryBuffer: null;
      coveredThroughOrder: null;
      summaryVersion: null;
      summaryStatus: 'degraded';
      state: null;
      safeErrorCode: typeof CONVERSATION_CONTEXT_PREPARE_FAILED;
    };

export async function prepareConversationContext(
  input: PrepareConversationContextInput,
  client: ConversationContextApiClient = apiClient,
): Promise<ConversationContextPrepareResponse> {
  const request = conversationContextPrepareRequestSchema.parse(input.request);
  const response = await client.post<unknown>(
    '/conversation-context/prepare',
    request,
    {
      accessToken: input.accessToken,
      signal: input.signal,
    },
  );

  return conversationContextPrepareResponseSchema.parse(response);
}

export async function prepareConversationContextSafely(
  input: PrepareConversationContextInput,
  client: ConversationContextApiClient = apiClient,
  logger: SafeLogger = console,
): Promise<SafeConversationContextPrepareResult> {
  try {
    return {
      ...(await prepareConversationContext(input, client)),
      safeErrorCode: null,
    };
  } catch {
    logger.warn('[ConversationContext] prepare failed');
    return {
      conversationId: input.request.conversationId,
      summaryBuffer: null,
      coveredThroughOrder: null,
      summaryVersion: null,
      summaryStatus: 'degraded',
      state: null,
      safeErrorCode: CONVERSATION_CONTEXT_PREPARE_FAILED,
    };
  }
}
