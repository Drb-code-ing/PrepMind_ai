import { z } from 'zod';

export const reviewRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export const clientMutationIdSchema = z.string().uuid();

export const reviewCardStateSchema = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export const reviewSourceSchema = z.enum(['wrongQuestion', 'question']);
export const reviewWrongQuestionStatusSchema = z.enum(['UNRESOLVED', 'RESOLVED']);

export const createReviewCardFromWrongQuestionRequestSchema = z.object({
  wrongQuestionId: z.string().min(1),
});

export const reviewCardSchema = z.object({
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

export const reviewLogSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: reviewRatingSchema,
  clientMutationId: clientMutationIdSchema.nullable(),
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  reviewDurationMs: z.number().int().nonnegative().nullable(),
  stabilityBefore: z.number(),
  stabilityAfter: z.number(),
  difficultyBefore: z.number(),
  difficultyAfter: z.number(),
  reviewedAt: z.string().datetime(),
});

export const createReviewCardResponseSchema = z.object({
  card: reviewCardSchema,
  created: z.boolean(),
});

export const reviewWrongQuestionTaskSchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  answer: z.string(),
  analysis: z.string(),
  imageUrl: z.string().nullable(),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewTaskSchema = z.object({
  cardId: z.string().min(1),
  dueAt: z.string().datetime(),
  state: reviewCardStateSchema,
  reviewCount: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  source: reviewSourceSchema,
  wrongQuestion: reviewWrongQuestionTaskSchema.optional(),
});

export const reviewTodayTasksResponseSchema = z.object({
  date: z.string(),
  dueCount: z.number().int().nonnegative(),
  newCount: z.number().int().nonnegative(),
  learningCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  tasks: z.array(reviewTaskSchema),
});

export const reviewStatsRangeSchema = z.enum(['7d', '30d']);

export const reviewStatsQuerySchema = z.object({
  range: reviewStatsRangeSchema.default('7d'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export const reviewRatingCountsSchema = z.object({
  again: z.number().int().nonnegative(),
  hard: z.number().int().nonnegative(),
  good: z.number().int().nonnegative(),
  easy: z.number().int().nonnegative(),
});

export const reviewCardStateCountsSchema = z.object({
  NEW: z.number().int().nonnegative(),
  LEARNING: z.number().int().nonnegative(),
  REVIEW: z.number().int().nonnegative(),
  RELEARNING: z.number().int().nonnegative(),
});

export const reviewDailyCountSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative(),
});

export const reviewStatsResponseSchema = z.object({
  range: reviewStatsRangeSchema,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalReviews: z.number().int().nonnegative(),
  reviewedCards: z.number().int().nonnegative(),
  dueCards: z.number().int().nonnegative(),
  accuracyLikeRate: z.number().min(0).max(1),
  streakDays: z.number().int().nonnegative(),
  ratingCounts: reviewRatingCountsSchema,
  stateCounts: reviewCardStateCountsSchema,
  dailyReviews: z.array(reviewDailyCountSchema),
});

export const reviewLogWrongQuestionSchema = z.object({
  id: z.string().min(1),
  questionText: z.string(),
  subject: z.string(),
  knowledgePoints: z.array(z.string()),
  status: reviewWrongQuestionStatusSchema,
});

export const reviewLogListItemSchema = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  rating: reviewRatingSchema,
  scheduledDays: z.number().int().nonnegative(),
  elapsedDays: z.number().int().nonnegative(),
  reviewDurationMs: z.number().int().nonnegative().nullable(),
  reviewedAt: z.string().datetime(),
  nextReview: z.string().datetime(),
  currentCardState: reviewCardStateSchema,
  wrongQuestion: reviewLogWrongQuestionSchema.optional(),
});

export const reviewLogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewLogListResponseSchema = z.object({
  items: z.array(reviewLogListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export const reviewRatingRequestSchema = z.object({
  rating: reviewRatingSchema,
  clientMutationId: clientMutationIdSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  reviewDurationMs: z.number().int().nonnegative().optional(),
});

export const reviewRatingResponseSchema = z.object({
  card: reviewCardSchema,
  log: reviewLogSchema,
});

export const reviewCardByWrongQuestionResponseSchema = z.object({
  card: reviewCardSchema.nullable(),
});

export type ReviewRating = z.infer<typeof reviewRatingSchema>;
export type ReviewCardState = z.infer<typeof reviewCardStateSchema>;
export type ReviewSource = z.infer<typeof reviewSourceSchema>;
export type CreateReviewCardFromWrongQuestionRequest = z.infer<
  typeof createReviewCardFromWrongQuestionRequestSchema
>;
export type ReviewCardResponse = z.infer<typeof reviewCardSchema>;
export type ReviewLogResponse = z.infer<typeof reviewLogSchema>;
export type CreateReviewCardResponse = z.infer<typeof createReviewCardResponseSchema>;
export type ReviewWrongQuestionTaskResponse = z.infer<typeof reviewWrongQuestionTaskSchema>;
export type ReviewTaskResponse = z.infer<typeof reviewTaskSchema>;
export type ReviewTodayTasksResponse = z.infer<typeof reviewTodayTasksResponseSchema>;
export type ReviewStatsRange = z.infer<typeof reviewStatsRangeSchema>;
export type ReviewStatsQuery = z.infer<typeof reviewStatsQuerySchema>;
export type ReviewStatsResponse = z.infer<typeof reviewStatsResponseSchema>;
export type ReviewRatingCounts = z.infer<typeof reviewRatingCountsSchema>;
export type ReviewCardStateCounts = z.infer<typeof reviewCardStateCountsSchema>;
export type ReviewDailyCount = z.infer<typeof reviewDailyCountSchema>;
export type ReviewLogListItemResponse = z.infer<typeof reviewLogListItemSchema>;
export type ReviewLogListQuery = z.infer<typeof reviewLogListQuerySchema>;
export type ReviewLogListResponse = z.infer<typeof reviewLogListResponseSchema>;
export type ReviewRatingRequest = z.infer<typeof reviewRatingRequestSchema>;
export type ReviewRatingResponse = z.infer<typeof reviewRatingResponseSchema>;
export type ReviewCardByWrongQuestionResponse = z.infer<
  typeof reviewCardByWrongQuestionResponseSchema
>;
