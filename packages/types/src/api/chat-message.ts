import { z } from 'zod';

import { conversationStateSchema } from '@repo/types/api/conversation-context';
import { CHAT_TURN_ID_PATTERN } from '@repo/types/api/chat-turn';

export const MAX_PREPARE_CHAT_MESSAGES = 1000;
export const MAX_PREPARE_CHAT_MESSAGE_CONTENT_LENGTH = 100_000;
export const MAX_PREPARE_CHAT_MESSAGES_TOTAL_CONTENT_LENGTH = 2_000_000;

const chatTurnBoundedIdSchema = z.string().trim().regex(new RegExp(CHAT_TURN_ID_PATTERN));

export const chatMessageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  role: chatMessageRoleSchema,
  content: z.string(),
  order: z.number().int().min(0),
  metadata: z.unknown().nullable(),
  createdAt: z.string().datetime(),
});

export const listChatMessagesQuerySchema = z.object({
  conversationId: z.string().min(1).optional(),
});

export const syncChatMessageItemSchema = z.object({
  id: z.string().min(1).max(100),
  role: chatMessageRoleSchema,
  content: z.string().max(100_000),
  order: z.number().int().min(0),
  metadata: z.unknown().optional(),
  createdAt: z.string().datetime().optional(),
});

export const syncChatMessagesRequestSchema = z.object({
  conversationId: z.string().min(1).optional(),
  messages: z.array(syncChatMessageItemSchema).max(500),
});

export const prepareChatMessageItemSchema = z
  .object({
    id: chatTurnBoundedIdSchema,
    role: z.enum(['USER', 'ASSISTANT']),
    content: z.string().min(1).max(MAX_PREPARE_CHAT_MESSAGE_CONTENT_LENGTH),
    order: z.number().int().min(0),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export const prepareChatMessagesRequestSchema = z
  .object({
    conversationId: chatTurnBoundedIdSchema,
    messages: z.array(prepareChatMessageItemSchema).min(1).max(MAX_PREPARE_CHAT_MESSAGES),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const orders = new Set<number>();
    let totalContentLength = 0;

    for (const [index, message] of value.messages.entries()) {
      if (ids.has(message.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages', index, 'id'],
          message: 'message ids must be unique',
        });
      }
      ids.add(message.id);

      if (orders.has(message.order)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages', index, 'order'],
          message: 'message orders must be unique',
        });
      }
      orders.add(message.order);

      if (!message.content.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages', index, 'content'],
          message: 'message content must not be blank',
        });
      }
      totalContentLength += message.content.length;
    }

    if (totalContentLength > MAX_PREPARE_CHAT_MESSAGES_TOTAL_CONTENT_LENGTH) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['messages'],
        message: `total message content must be at most ${MAX_PREPARE_CHAT_MESSAGES_TOTAL_CONTENT_LENGTH} characters`,
      });
    }

    const ordered = [...value.messages].sort((left, right) => left.order - right.order);
    const firstOrder = ordered[0]?.order ?? 0;
    for (const [index, message] of ordered.entries()) {
      if (message.order !== firstOrder + index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages'],
          message: 'message orders must form a contiguous sequence',
        });
        break;
      }
    }

    if (ordered.at(-1)?.role !== 'USER') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['messages'],
        message: 'the latest prepared message must be a user message',
      });
    }
  });

export const prepareChatMessagesResponseSchema = z
  .object({
    conversationId: chatTurnBoundedIdSchema,
    messages: z.array(chatMessageSchema.strict()).min(1).max(MAX_PREPARE_CHAT_MESSAGES),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [index, message] of value.messages.entries()) {
      if (message.conversationId !== value.conversationId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['messages', index, 'conversationId'],
          message: 'message conversationId must match the response conversationId',
        });
      }
    }
  });

export const chatMessagesResponseSchema = z
  .object({
    conversationId: z.string().nullable(),
    messages: z.array(chatMessageSchema),
    state: conversationStateSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state && value.state.conversationId !== value.conversationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['state', 'conversationId'],
        message: 'state conversationId must match the response conversationId',
      });
    }
  });

export const clearChatMessagesQuerySchema = z.object({
  conversationId: z.string().min(1).optional(),
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessageResponse = z.infer<typeof chatMessageSchema>;
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;
export type SyncChatMessageItem = z.infer<typeof syncChatMessageItemSchema>;
export type SyncChatMessagesRequest = z.infer<typeof syncChatMessagesRequestSchema>;
export type PrepareChatMessageItem = z.infer<typeof prepareChatMessageItemSchema>;
export type PrepareChatMessagesRequest = z.infer<typeof prepareChatMessagesRequestSchema>;
export type PrepareChatMessagesResponse = z.infer<typeof prepareChatMessagesResponseSchema>;
export type ChatMessagesResponse = z.infer<typeof chatMessagesResponseSchema>;
export type ClearChatMessagesQuery = z.infer<typeof clearChatMessagesQuerySchema>;
