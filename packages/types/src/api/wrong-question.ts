import { z } from 'zod';

export const wrongQuestionSourceSchema = z.enum(['OCR', 'MANUAL', 'CHAT']);
export const wrongQuestionStatusSchema = z.enum(['UNRESOLVED', 'RESOLVED']);

export const wrongQuestionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  source: wrongQuestionSourceSchema,
  sourceRecordId: z.string().nullable(),
  sourceGroupId: z.string().nullable(),
  imageUrl: z.string().nullable(),
  questionText: z.string().min(1),
  subject: z.string().min(1),
  category: z.string().min(1),
  knowledgePoints: z.array(z.string()),
  analysis: z.string(),
  answer: z.string(),
  errorType: z.string().nullable(),
  userNote: z.string().nullable(),
  rawContent: z.string().nullable(),
  status: wrongQuestionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createWrongQuestionRequestSchema = z.object({
  source: wrongQuestionSourceSchema.default('OCR'),
  sourceRecordId: z.string().min(1).max(100).optional(),
  sourceGroupId: z.string().min(1).max(100).optional(),
  imageUrl: z.string().url().optional(),
  questionText: z.string().min(1).max(20_000),
  subject: z.string().min(1).max(50),
  category: z.string().min(1).max(100),
  knowledgePoints: z.array(z.string().min(1).max(100)).max(20).default([]),
  analysis: z.string().max(30_000).default(''),
  answer: z.string().max(20_000).default(''),
  errorType: z.string().max(100).optional(),
  userNote: z.string().max(5_000).optional(),
  rawContent: z.string().max(50_000).optional(),
});

export const updateWrongQuestionRequestSchema = z
  .object({
    questionText: z.string().min(1).max(20_000).optional(),
    subject: z.string().min(1).max(50).optional(),
    category: z.string().min(1).max(100).optional(),
    knowledgePoints: z.array(z.string().min(1).max(100)).max(20).optional(),
    analysis: z.string().max(30_000).optional(),
    answer: z.string().max(20_000).optional(),
    errorType: z.string().max(100).nullable().optional(),
    userNote: z.string().max(5_000).nullable().optional(),
    status: wrongQuestionStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listWrongQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: wrongQuestionStatusSchema.optional(),
  subject: z.string().min(1).max(50).optional(),
  keyword: z.string().min(1).max(100).optional(),
});

export const wrongQuestionListResponseSchema = z.object({
  items: z.array(wrongQuestionSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type WrongQuestionSource = z.infer<typeof wrongQuestionSourceSchema>;
export type WrongQuestionStatus = z.infer<typeof wrongQuestionStatusSchema>;
export type WrongQuestionResponse = z.infer<typeof wrongQuestionSchema>;
export type CreateWrongQuestionRequest = z.infer<typeof createWrongQuestionRequestSchema>;
export type UpdateWrongQuestionRequest = z.infer<typeof updateWrongQuestionRequestSchema>;
export type ListWrongQuestionsQuery = z.infer<typeof listWrongQuestionsQuerySchema>;
export type WrongQuestionListResponse = z.infer<typeof wrongQuestionListResponseSchema>;
