import { z } from 'zod';

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

export const chatMessagesResponseSchema = z.object({
  conversationId: z.string().nullable(),
  messages: z.array(chatMessageSchema),
});

export const clearChatMessagesQuerySchema = z.object({
  conversationId: z.string().min(1).optional(),
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessageResponse = z.infer<typeof chatMessageSchema>;
export type ListChatMessagesQuery = z.infer<typeof listChatMessagesQuerySchema>;
export type SyncChatMessageItem = z.infer<typeof syncChatMessageItemSchema>;
export type SyncChatMessagesRequest = z.infer<typeof syncChatMessagesRequestSchema>;
export type ChatMessagesResponse = z.infer<typeof chatMessagesResponseSchema>;
export type ClearChatMessagesQuery = z.infer<typeof clearChatMessagesQuerySchema>;
