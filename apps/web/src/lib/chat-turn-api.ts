import {
  CHAT_TURN_ID_PATTERN,
  chatTurnEnqueueRequestSchema,
  chatTurnEnqueueResponseSchema,
  type ChatTurnEnqueueRequest,
  type ChatTurnEnqueueResponse,
} from '@repo/types/api/chat-turn';

import { ApiClientError, apiClient } from './api-client.ts';
import type { StoredMessage } from './db.ts';

export const CHAT_TURN_ENQUEUE_PATH = '/chat-turns' as const;
export const CHAT_TURN_INPUT_SCHEMA_VERSION = 'chat-turn-input-v1' as const;
export const CHAT_TURN_REQUEST_SCHEMA_VERSION = 'chat-turn-request-v1' as const;
export const MAX_CHAT_TURN_INPUT_MESSAGES = 1000;
export const MAX_CHAT_TURN_MESSAGE_CONTENT_LENGTH = 100_000;
export const MAX_CHAT_TURN_TOTAL_CONTENT_LENGTH = 2_000_000;

const safeIdPattern = new RegExp(CHAT_TURN_ID_PATTERN);

type ApiClient = {
  post: <T>(
    path: string,
    body?: unknown,
    options?: {
      accessToken?: string | null;
      expectedStatus?: number | readonly number[];
      signal?: AbortSignal | null;
    },
  ) => Promise<T>;
};

export type BuildChatTurnEnqueueRequestInput = {
  ownerId: string;
  conversationId: string;
  messages: readonly StoredMessage[];
  budgetPolicyVersion: string;
};

export type ChatTurnEnqueueBuildOptions = {
  digest?: Sha256Digest;
};

export type Sha256Digest = (canonicalValue: string) => Promise<string>;

export type ChatTurnSubmissionPath =
  | { kind: 'enqueue' }
  | {
      kind: 'snapshot-sync';
      reason: 'conversation-not-ready' | 'messages-not-persisted';
    };

export type PrepareChatTurnSubmissionInput = Omit<
  BuildChatTurnEnqueueRequestInput,
  'conversationId'
> & {
  conversationId: string | null | undefined;
  messagesPersisted: boolean;
};

export type PreparedChatTurnSubmission =
  | { kind: 'enqueue'; request: ChatTurnEnqueueRequest }
  | Exclude<ChatTurnSubmissionPath, { kind: 'enqueue' }>;

export type ChatTurnEnqueueRequestOptions = {
  signal?: AbortSignal | null;
};

/**
 * Builds the bounded facts accepted by POST /chat-turns. Message content is
 * used only inside the local digest and is never included in the returned
 * request body.
 */
export async function buildChatTurnEnqueueRequest(
  input: BuildChatTurnEnqueueRequestInput,
  options: ChatTurnEnqueueBuildOptions = {},
): Promise<ChatTurnEnqueueRequest> {
  const ownerId = normalizeOwnerId(input.ownerId);
  const conversationId = normalizeSafeId(input.conversationId, 'conversationId');
  const budgetPolicyVersion = normalizeBudgetPolicyVersion(input.budgetPolicyVersion);
  const messages = normalizeMessages(input.messages, ownerId);
  const digest = options.digest ?? sha256Hex;

  const inputCanonicalValue = JSON.stringify({
    schema: CHAT_TURN_INPUT_SCHEMA_VERSION,
    conversationId,
    messages,
  });
  const inputDigest = await digest(inputCanonicalValue);
  assertDigest(inputDigest);
  const inputHash = `sha256:${inputDigest}`;

  const requestCanonicalValue = JSON.stringify({
    schema: CHAT_TURN_REQUEST_SCHEMA_VERSION,
    ownerId,
    conversationId,
    inputHash,
    inputMessageIds: messages.map((message) => message.id),
    budgetPolicyVersion,
  });
  const requestDigest = await digest(requestCanonicalValue);
  assertDigest(requestDigest);

  return chatTurnEnqueueRequestSchema.parse({
    conversationId,
    clientRequestId: `web-chat-turn-v1-${requestDigest}`,
    inputHash,
    inputMessageIds: messages.map((message) => message.id),
    budgetPolicyVersion,
  });
}

export function resolveChatTurnSubmissionPath(input: {
  conversationId: string | null | undefined;
  messagesPersisted: boolean;
}): ChatTurnSubmissionPath {
  if (!input.conversationId?.trim()) {
    return { kind: 'snapshot-sync', reason: 'conversation-not-ready' };
  }
  if (!input.messagesPersisted) {
    return { kind: 'snapshot-sync', reason: 'messages-not-persisted' };
  }
  return { kind: 'enqueue' };
}

export async function prepareChatTurnSubmission(
  input: PrepareChatTurnSubmissionInput,
  options: ChatTurnEnqueueBuildOptions = {},
): Promise<PreparedChatTurnSubmission> {
  const path = resolveChatTurnSubmissionPath(input);
  if (path.kind === 'snapshot-sync') return path;

  return {
    kind: 'enqueue',
    request: await buildChatTurnEnqueueRequest(
      {
        ownerId: input.ownerId,
        conversationId: input.conversationId as string,
        messages: input.messages,
        budgetPolicyVersion: input.budgetPolicyVersion,
      },
      options,
    ),
  };
}

export function isRetryableChatTurnEnqueueError(error: unknown) {
  if (!(error instanceof ApiClientError)) return false;
  if (error.code === 'REQUEST_ABORTED') return false;

  return (
    error.status === 0 ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  );
}

export function createChatTurnApi(client: ApiClient) {
  const enqueue = async (
    accessToken: string,
    request: ChatTurnEnqueueRequest,
    options: ChatTurnEnqueueRequestOptions = {},
  ): Promise<ChatTurnEnqueueResponse> => {
    if (!accessToken.trim()) {
      throw new Error('Chat turn enqueue requires an access token');
    }

    const parsedRequest = chatTurnEnqueueRequestSchema.parse(request);
    const response = await client.post<unknown>(CHAT_TURN_ENQUEUE_PATH, parsedRequest, {
      accessToken,
      expectedStatus: 202,
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });

    return chatTurnEnqueueResponseSchema.parse(response);
  };

  return { enqueue };
}

export const chatTurnApi = createChatTurnApi(apiClient);

export async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API is unavailable');
  }

  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeOwnerId(value: string) {
  if (typeof value !== 'string') {
    throw new TypeError('ownerId is required');
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 128) {
    throw new TypeError('ownerId is invalid');
  }
  return normalized;
}

function normalizeSafeId(value: string, field: string) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} is required`);
  }

  const normalized = value.trim();
  if (!safeIdPattern.test(normalized)) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

function normalizeBudgetPolicyVersion(value: string) {
  if (typeof value !== 'string') {
    throw new TypeError('budgetPolicyVersion is required');
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 80) {
    throw new TypeError('budgetPolicyVersion is invalid');
  }
  return normalized;
}

function normalizeMessages(messages: readonly StoredMessage[], ownerId: string) {
  if (!Array.isArray(messages) || messages.length < 1) {
    throw new TypeError('at least one persisted message is required');
  }
  if (messages.length > MAX_CHAT_TURN_INPUT_MESSAGES) {
    throw new RangeError(`at most ${MAX_CHAT_TURN_INPUT_MESSAGES} messages are allowed`);
  }

  const seenIds = new Set<string>();
  let totalContentLength = 0;
  const normalized = messages.map((message) => {
    if (!message || typeof message !== 'object') {
      throw new TypeError('message is invalid');
    }

    const id = normalizeSafeId(message.id, 'message id');
    if (seenIds.has(id)) {
      throw new TypeError('message ids must be unique');
    }
    seenIds.add(id);

    if (typeof message.userId !== 'string' || message.userId !== ownerId) {
      throw new TypeError('all messages must belong to the authenticated owner');
    }
    if (message.role !== 'user' && message.role !== 'assistant') {
      throw new TypeError('message role is invalid');
    }
    if (!Number.isSafeInteger(message.order) || message.order < 0) {
      throw new TypeError('message order is invalid');
    }
    if (
      typeof message.createdAt !== 'number' ||
      !Number.isSafeInteger(message.createdAt) ||
      Number.isNaN(new Date(message.createdAt).getTime())
    ) {
      throw new TypeError('message createdAt is invalid');
    }
    if (
      typeof message.content !== 'string' ||
      message.content.length > MAX_CHAT_TURN_MESSAGE_CONTENT_LENGTH
    ) {
      throw new RangeError(
        `message content must be at most ${MAX_CHAT_TURN_MESSAGE_CONTENT_LENGTH} characters`,
      );
    }
    totalContentLength += message.content.length;
    if (totalContentLength > MAX_CHAT_TURN_TOTAL_CONTENT_LENGTH) {
      throw new RangeError(
        `total message content must be at most ${MAX_CHAT_TURN_TOTAL_CONTENT_LENGTH} characters`,
      );
    }

    return {
      id,
      role: message.role,
      order: message.order,
      createdAt: new Date(message.createdAt).toISOString(),
      content: message.content,
    };
  });

  return normalized.sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function assertDigest(value: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error('SHA-256 digest must be 64 lowercase hexadecimal characters');
  }
}
