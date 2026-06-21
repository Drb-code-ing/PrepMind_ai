import { z } from 'zod';

import { wrongQuestionSchema } from './wrong-question';

export const wrongQuestionDeckSourceSchema = z.enum(['AI', 'USER', 'SYSTEM']);
export const wrongQuestionDeckItemSourceSchema = z.enum(['AI', 'USER', 'SYSTEM']);

export const wrongQuestionSubjectGroupSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  subject: z.string().min(1),
  displayName: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  deckCount: z.number().int().nonnegative(),
  topKnowledgePoints: z.array(z.string()),
  lastUpdatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionDeckSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  subjectGroupId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  source: wrongQuestionDeckSourceSchema,
  nameLocked: z.boolean(),
  confidence: z.number().min(0).max(1),
  totalCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  topKnowledgePoints: z.array(z.string()),
  lastUpdatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionDeckItemSchema = z.object({
  id: z.string().min(1),
  deckId: z.string().min(1),
  wrongQuestionId: z.string().min(1),
  reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: wrongQuestionDeckItemSourceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const wrongQuestionGroupListResponseSchema = z.object({
  items: z.array(wrongQuestionSubjectGroupSchema),
});

export const wrongQuestionDeckListResponseSchema = z.object({
  subjectGroup: wrongQuestionSubjectGroupSchema,
  items: z.array(wrongQuestionDeckSchema),
});

export const wrongQuestionDeckQuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const wrongQuestionDeckQuestionListResponseSchema = z.object({
  deck: wrongQuestionDeckSchema,
  items: z.array(wrongQuestionSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const organizeWrongQuestionRequestSchema = z.object({
  force: z.boolean().default(false),
});

export const organizeWrongQuestionBatchRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

export const organizeWrongQuestionResponseSchema = z.object({
  subjectGroup: wrongQuestionSubjectGroupSchema,
  deck: wrongQuestionDeckSchema,
  item: wrongQuestionDeckItemSchema,
  createdSubjectGroup: z.boolean(),
  createdDeck: z.boolean(),
  createdItem: z.boolean(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const organizeWrongQuestionBatchResponseSchema = z.object({
  organizedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  items: z.array(organizeWrongQuestionResponseSchema),
});

export const updateWrongQuestionDeckRequestSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().max(240).nullable().optional(),
    nameLocked: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const moveWrongQuestionToDeckRequestSchema = z.object({
  wrongQuestionId: z.string().min(1),
  source: wrongQuestionDeckItemSourceSchema.default('USER'),
});

export const removeWrongQuestionDeckItemResponseSchema = z.object({
  ok: z.literal(true),
});

export type WrongQuestionDeckSource = z.infer<typeof wrongQuestionDeckSourceSchema>;
export type WrongQuestionDeckItemSource = z.infer<typeof wrongQuestionDeckItemSourceSchema>;
export type WrongQuestionSubjectGroupResponse = z.infer<typeof wrongQuestionSubjectGroupSchema>;
export type WrongQuestionDeckResponse = z.infer<typeof wrongQuestionDeckSchema>;
export type WrongQuestionDeckItemResponse = z.infer<typeof wrongQuestionDeckItemSchema>;
export type WrongQuestionGroupListResponse = z.infer<typeof wrongQuestionGroupListResponseSchema>;
export type WrongQuestionDeckListResponse = z.infer<typeof wrongQuestionDeckListResponseSchema>;
export type WrongQuestionDeckQuestionListQuery = z.infer<
  typeof wrongQuestionDeckQuestionListQuerySchema
>;
export type WrongQuestionDeckQuestionListResponse = z.infer<
  typeof wrongQuestionDeckQuestionListResponseSchema
>;
export type OrganizeWrongQuestionRequest = z.infer<typeof organizeWrongQuestionRequestSchema>;
export type OrganizeWrongQuestionBatchRequest = z.infer<
  typeof organizeWrongQuestionBatchRequestSchema
>;
export type OrganizeWrongQuestionResponse = z.infer<typeof organizeWrongQuestionResponseSchema>;
export type OrganizeWrongQuestionBatchResponse = z.infer<
  typeof organizeWrongQuestionBatchResponseSchema
>;
export type UpdateWrongQuestionDeckRequest = z.infer<typeof updateWrongQuestionDeckRequestSchema>;
export type MoveWrongQuestionToDeckRequest = z.infer<
  typeof moveWrongQuestionToDeckRequestSchema
>;
