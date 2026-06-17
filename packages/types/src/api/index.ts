import { z } from 'zod';

export const CreateQuestionSchema = z.object({
  content: z.string(),
  imageUrl: z.string().optional(),
  answer: z.string().optional(),
  knowledgePoints: z.array(z.string()).optional(),
});

export const ReviewFeedbackSchema = z.object({
  cardId: z.string(),
  rating: z.enum(['1', '2', '3', '4']),
});

export const ChatMessageSchema = z.object({
  message: z.string(),
  conversationId: z.string().optional(),
  context: z
    .object({
      includeRAG: z.boolean().optional(),
      includeFSRS: z.boolean().optional(),
    })
    .optional(),
});

export const RAGSearchSchema = z.object({
  query: z.string(),
  topK: z.number().default(5),
});

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type ReviewFeedbackInput = z.infer<typeof ReviewFeedbackSchema>;
export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
export type RAGSearchInput = z.infer<typeof RAGSearchSchema>;

export * from './review';
export * from './review-preference';
