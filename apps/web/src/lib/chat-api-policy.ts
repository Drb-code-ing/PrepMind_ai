import type { ChatContextMessage } from './chat-context.ts';

type ParsedChatApiRequestBody = {
  messages: ChatContextMessage[];
  activeContext: unknown;
  accessToken: string | null;
};

type PolicyOk<T = undefined> = T extends undefined ? { ok: true } : { ok: true; data: T };
type PolicyError = {
  ok: false;
  status: number;
  error: string;
};

export function parseChatApiRequestBody(
  body: unknown,
): PolicyOk<ParsedChatApiRequestBody> | PolicyError {
  if (!body || typeof body !== 'object') {
    return {
      ok: false,
      status: 400,
      error: 'Request body must be a JSON object.',
    };
  }

  const record = body as Record<string, unknown>;
  const rawMessages = record.messages;

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Message list cannot be empty.',
    };
  }

  const messages: ChatContextMessage[] = [];

  for (const rawMessage of rawMessages) {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return {
        ok: false,
        status: 400,
        error: 'Each message must be an object.',
      };
    }

    const message = rawMessage as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') {
      return {
        ok: false,
        status: 400,
        error: 'Client messages may only use user or assistant roles; system role is reserved.',
      };
    }

    if (typeof message.content !== 'string' || !message.content.trim()) {
      return {
        ok: false,
        status: 400,
        error: 'Message content cannot be empty.',
      };
    }

    messages.push({
      role: message.role,
      content: message.content.trim(),
    });
  }

  return {
    ok: true,
    data: {
      messages,
      activeContext: record.activeContext,
      accessToken: normalizeAccessToken(record.accessToken),
    },
  };
}

export function validateChatLiveAccess(
  mode: 'mock' | 'live',
  accessToken: string | null,
): PolicyOk | PolicyError {
  if (mode === 'mock' || accessToken) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 401,
    error: 'Live AI chat requires login.',
  };
}

export function shouldSearchKnowledgeForChat(input: {
  accessToken: string | null;
  requiresRag: boolean;
}) {
  return Boolean(input.accessToken && input.requiresRag);
}

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
