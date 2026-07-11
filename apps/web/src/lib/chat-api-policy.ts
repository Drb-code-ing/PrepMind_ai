import type { ActiveStudyContext, ChatContextMessage } from './chat-context.ts';

type ParsedChatApiRequestBody = {
  messages: ChatContextMessage[];
  conversationId: string | null;
  activeContext: ActiveStudyContext | null;
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
  const conversationId = normalizeConversationId(record.conversationId);

  if (!conversationId.ok) return conversationId;

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
      conversationId: conversationId.value,
      activeContext: normalizeActiveStudyContext(record.activeContext),
      accessToken: normalizeAccessToken(record.accessToken),
    },
  };
}

function normalizeConversationId(
  value: unknown,
): { ok: true; value: string | null } | PolicyError {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') {
    return { ok: false, status: 400, error: 'conversationId must be a string.' };
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 100) {
    return { ok: false, status: 400, error: 'conversationId must contain 1 to 100 characters.' };
  }

  return { ok: true, value: normalized };
}

export async function validateChatLiveAccess(
  mode: 'mock' | 'live',
  accessToken: string | null,
  verifyAccessToken: (accessToken: string) => Promise<boolean>,
): Promise<PolicyOk | PolicyError> {
  if (mode === 'mock') {
    return { ok: true };
  }

  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      error: 'Live AI chat requires login.',
    };
  }

  const valid = await verifyAccessToken(accessToken);
  if (valid) return { ok: true };

  return {
    ok: false,
    status: 401,
    error: 'Live AI chat requires a valid login session.',
  };
}

export function shouldSearchKnowledgeForChat(input: {
  accessToken: string | null;
  requiresRag: boolean;
  latestUserText?: string;
}) {
  if (!input.accessToken) return false;
  return input.requiresRag || hasExplicitKnowledgeIntent(input.latestUserText ?? '');
}

function hasExplicitKnowledgeIntent(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  return [
    'notes',
    'knowledge base',
    'my uploaded',
    'uploaded document',
    'reference material',
  ].some((keyword) => normalized.includes(keyword));
}

function normalizeAccessToken(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeActiveStudyContext(value: unknown): ActiveStudyContext | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.type !== 'ocr-question' || typeof record.questionText !== 'string') return null;

  const stringFields = [
    'sourceGroupId',
    'questionId',
    'subject',
    'questionType',
    'difficulty',
    'analysis',
    'answer',
    'rawContent',
  ] as const;
  const stringArrayFields = ['knowledgePoints', 'warnings'] as const;
  for (const field of stringFields) {
    if (record[field] !== undefined && typeof record[field] !== 'string') return null;
  }
  for (const field of stringArrayFields) {
    if (
      record[field] !== undefined &&
      (!Array.isArray(record[field]) || !record[field].every((item) => typeof item === 'string'))
    ) {
      return null;
    }
  }
  if (
    record.updatedAt !== undefined &&
    (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt))
  ) {
    return null;
  }

  return {
    type: 'ocr-question',
    questionText: record.questionText,
    ...Object.fromEntries(
      stringFields
        .filter((field) => record[field] !== undefined)
        .map((field) => [field, record[field]]),
    ),
    ...Object.fromEntries(
      stringArrayFields
        .filter((field) => record[field] !== undefined)
        .map((field) => [field, record[field]]),
    ),
    ...(record.updatedAt !== undefined ? { updatedAt: record.updatedAt as number } : {}),
  } as ActiveStudyContext;
}
