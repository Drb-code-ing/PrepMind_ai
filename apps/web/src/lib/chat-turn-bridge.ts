import type { ChatTurnEnqueueResponse } from '@repo/types/api/chat-turn';
import {
  MAX_PREPARE_CHAT_MESSAGES,
  MAX_PREPARE_CHAT_MESSAGES_TOTAL_CONTENT_LENGTH,
  prepareChatMessagesRequestSchema,
  type PrepareChatMessagesRequest,
} from '@repo/types/api/chat-message';
import { CHAT_TURN_ID_PATTERN } from '@repo/types/api/chat-turn';

import type { PreparedChatMessagesResult } from './chat-message-api.ts';
import {
  buildChatTurnEnqueueRequest,
  type ChatTurnEnqueueRequestOptions,
} from './chat-turn-api.ts';

export const CHAT_TURN_BRIDGE_DEFAULT_BUDGET_POLICY_VERSION = 'chat-budget-v1';

const safeIdPattern = new RegExp(CHAT_TURN_ID_PATTERN);

export type ChatTurnBridgeConfig = Readonly<{
  enabled: boolean;
  budgetPolicyVersion: string;
}>;

export type ChatTurnBridgeMessage = Readonly<{
  id: string | null;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}>;

export type ChatTurnBridgeDecision =
  | Readonly<{
      kind: 'legacy';
      reason: 'disabled' | 'conversation-not-ready';
    }>
  | Readonly<{
      kind: 'reject';
      reason: 'message-identity-unavailable' | 'message-window-invalid';
    }>
  | Readonly<{
      kind: 'enqueue';
      budgetPolicyVersion: string;
      prepareRequest: PrepareChatMessagesRequest;
    }>;

type ChatTurnBridgeDependencies = Readonly<{
  prepareMessages: (
    accessToken: string,
    request: PrepareChatMessagesRequest,
    options?: ChatTurnEnqueueRequestOptions,
  ) => Promise<PreparedChatMessagesResult>;
  enqueueTurn: (
    accessToken: string,
    request: Awaited<ReturnType<typeof buildChatTurnEnqueueRequest>>,
    options?: ChatTurnEnqueueRequestOptions,
  ) => Promise<ChatTurnEnqueueResponse>;
}>;

export function resolveChatTurnBridgeConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ChatTurnBridgeConfig {
  const enabled = env.PREPMIND_CHAT_TURN_BRIDGE_ENABLED === 'true';
  const rawBudgetPolicyVersion =
    env.PREPMIND_CHAT_TURN_BUDGET_POLICY_VERSION ?? CHAT_TURN_BRIDGE_DEFAULT_BUDGET_POLICY_VERSION;
  const budgetPolicyVersion = rawBudgetPolicyVersion.trim();

  if (enabled && (!budgetPolicyVersion || budgetPolicyVersion.length > 80)) {
    throw new Error('ChatTurn bridge budget policy version is invalid');
  }

  return Object.freeze({
    enabled,
    budgetPolicyVersion: budgetPolicyVersion || CHAT_TURN_BRIDGE_DEFAULT_BUDGET_POLICY_VERSION,
  });
}

export function resolveChatTurnBridgeDecision(
  input: Readonly<{
    config: ChatTurnBridgeConfig;
    conversationId: string | null;
    messages: readonly ChatTurnBridgeMessage[];
  }>,
): ChatTurnBridgeDecision {
  if (!input.config.enabled) return { kind: 'legacy', reason: 'disabled' };
  if (!input.conversationId?.trim()) {
    return { kind: 'legacy', reason: 'conversation-not-ready' };
  }

  const windowStart = resolveBoundedWindowStart(input.messages);
  const boundedMessages = input.messages.slice(windowStart);
  const ids = boundedMessages.map((message) => message.id?.trim() ?? '');
  if (ids.some((id) => !safeIdPattern.test(id)) || new Set(ids).size !== ids.length) {
    return { kind: 'reject', reason: 'message-identity-unavailable' };
  }

  const prepared = prepareChatMessagesRequestSchema.safeParse({
    conversationId: input.conversationId,
    messages: boundedMessages.map((message, index) => ({
      id: ids[index],
      role: message.role === 'user' ? 'USER' : 'ASSISTANT',
      content: message.content,
      order: windowStart + index,
      ...(message.createdAt === undefined ? {} : { createdAt: message.createdAt }),
    })),
  });
  if (!prepared.success) {
    return { kind: 'reject', reason: 'message-window-invalid' };
  }

  return {
    kind: 'enqueue',
    budgetPolicyVersion: input.config.budgetPolicyVersion,
    prepareRequest: prepared.data,
  };
}

function resolveBoundedWindowStart(messages: readonly ChatTurnBridgeMessage[]) {
  const minimumIndex = Math.max(0, messages.length - MAX_PREPARE_CHAT_MESSAGES);
  let start = messages.length;
  let contentLength = 0;

  for (let index = messages.length - 1; index >= minimumIndex; index -= 1) {
    const message = messages[index];
    if (!message) break;
    const nextLength = contentLength + message.content.length;
    if (nextLength > MAX_PREPARE_CHAT_MESSAGES_TOTAL_CONTENT_LENGTH) break;
    contentLength = nextLength;
    start = index;
  }

  return start;
}

export async function admitChatTurnBridge(
  input: Readonly<{
    ownerId: string;
    accessToken: string;
    decision: Extract<ChatTurnBridgeDecision, { kind: 'enqueue' }>;
    signal?: AbortSignal | null;
  }>,
  dependencies: ChatTurnBridgeDependencies,
) {
  if (!input.ownerId.trim()) throw new Error('ChatTurn bridge owner is unavailable');
  if (!input.accessToken.trim()) throw new Error('ChatTurn bridge access token is unavailable');

  const requestOptions = input.signal === undefined ? {} : { signal: input.signal };
  const prepared = await dependencies.prepareMessages(
    input.accessToken,
    input.decision.prepareRequest,
    requestOptions,
  );
  assertPreparedSnapshot(input.ownerId, input.decision.prepareRequest, prepared);
  const enqueueRequest = await buildChatTurnEnqueueRequest({
    ownerId: input.ownerId,
    conversationId: prepared.conversationId,
    messages: prepared.messages,
    budgetPolicyVersion: input.decision.budgetPolicyVersion,
  });

  return dependencies.enqueueTurn(input.accessToken, enqueueRequest, requestOptions);
}

function assertPreparedSnapshot(
  ownerId: string,
  request: PrepareChatMessagesRequest,
  prepared: PreparedChatMessagesResult,
) {
  if (prepared.conversationId !== request.conversationId) {
    throw new Error('ChatTurn bridge conversation binding is invalid');
  }
  if (prepared.messages.length !== request.messages.length) {
    throw new Error('ChatTurn bridge prepared snapshot is incomplete');
  }

  const requested = [...request.messages].sort((left, right) => left.order - right.order);
  const persisted = [...prepared.messages].sort((left, right) => left.order - right.order);
  for (const [index, message] of persisted.entries()) {
    const expected = requested[index];
    if (!expected) throw new Error('ChatTurn bridge prepared snapshot is incomplete');
    if (message.userId !== ownerId) {
      throw new Error('ChatTurn bridge owner binding is invalid');
    }
    if (
      message.id !== expected.id ||
      message.role !== (expected.role === 'USER' ? 'user' : 'assistant') ||
      message.content !== expected.content ||
      message.order !== expected.order ||
      (expected.createdAt !== undefined && message.createdAt !== Date.parse(expected.createdAt))
    ) {
      throw new Error('ChatTurn bridge prepared snapshot facts are invalid');
    }
  }
}
