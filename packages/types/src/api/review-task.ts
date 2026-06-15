import { z } from 'zod';

import { reviewLogSchema } from '@repo/types/api/review';

const reviewCardStateSchema = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
const reviewWrongQuestionStatusSchema = z.enum(['UNRESOLVED', 'RESOLVED']);

const reviewCardSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  questionId: z.string().nullable(),
  wrongQuestionId: z.string().nullable(),
  difficulty: z.number(),
  stability: z.number(),
  retrievability: z.number(),
  lastReview: z.string().datetime().nullable(),
  nextReview: z.string().datetime(),
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: reviewCardStateSchema,
  suspendedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const reviewTaskStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
]);

export const reviewTaskSourceSchema = z.enum(['FSRS', 'MANUAL', 'PLANNER']);

export const reviewTaskWrongQuestionSummarySchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  answer: z.string(),
  analysis: z.string(),
  imageUrl: z.string().nullable(),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewTaskCardSummarySchema = reviewCardSchema.pick({
  id: true,
  userId: true,
  questionId: true,
  wrongQuestionId: true,
  difficulty: true,
  stability: true,
  retrievability: true,
  lastReview: true,
  nextReview: true,
  reviewCount: true,
  lapses: true,
  state: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const reviewTaskItemSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  cardId: z.string().min(1),
  reviewLogId: z.string().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueAt: z.string().datetime(),
  status: reviewTaskStatusSchema,
  source: reviewTaskSourceSchema,
  completedAt: z.string().datetime().nullable(),
  skippedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  card: reviewTaskCardSummarySchema,
  wrongQuestion: reviewTaskWrongQuestionSummarySchema.optional(),
});

const includeCompletedSchema = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value;
}, z.enum(['true', 'false']).optional());

export const reviewTaskTodayQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
  includeCompleted: includeCompletedSchema.transform((value) =>
    value === undefined ? true : value === 'true',
  ),
});

export const reviewTaskTodayResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pendingCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  tasks: z.array(reviewTaskItemSchema),
});

export const reviewTaskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: reviewTaskStatusSchema.optional(),
});

export const reviewTaskListResponseSchema = z.object({
  items: z.array(reviewTaskItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const reviewTaskRatingResponseSchema = z.object({
  task: reviewTaskItemSchema,
  card: reviewCardSchema,
  log: reviewLogSchema,
});

export const reviewTaskActionResponseSchema = z.object({
  task: reviewTaskItemSchema,
});

export type ReviewTaskStatus = z.infer<typeof reviewTaskStatusSchema>;
export type ReviewTaskSource = z.infer<typeof reviewTaskSourceSchema>;
export type ReviewTaskCardState = z.infer<typeof reviewCardStateSchema>;
export type ReviewTaskCardSummaryResponse = z.infer<typeof reviewTaskCardSummarySchema>;
export type ReviewTaskWrongQuestionSummaryResponse = z.infer<
  typeof reviewTaskWrongQuestionSummarySchema
>;
export type ReviewTaskItemResponse = z.infer<typeof reviewTaskItemSchema>;
export type ReviewTaskTodayQuery = z.infer<typeof reviewTaskTodayQuerySchema>;
export type ReviewTaskTodayResponse = z.infer<typeof reviewTaskTodayResponseSchema>;
export type ReviewTaskListQuery = z.infer<typeof reviewTaskListQuerySchema>;
export type ReviewTaskListResponse = z.infer<typeof reviewTaskListResponseSchema>;
export type ReviewTaskRatingResponse = z.infer<typeof reviewTaskRatingResponseSchema>;
export type ReviewTaskActionResponse = z.infer<typeof reviewTaskActionResponseSchema>;
