import { z } from 'zod';

import { reviewPreferenceSchema } from './review-preference';
import {
  reviewTaskPlanCapacityStatusSchema,
  reviewTaskPlanIntensitySchema,
  reviewTaskPlanQuerySchema,
  reviewTaskPlanResponseSchema,
} from './review-task';

export const reviewAgentPrioritySchema = z.enum(['low', 'medium', 'high']);

export const reviewAgentWeakPointInputSchema = z.object({
  label: z.string().min(1),
  subject: z.string().min(1).optional(),
  deckName: z.string().min(1).optional(),
  wrongCount: z.number().int().nonnegative(),
  recentAgainCount: z.number().int().nonnegative(),
  averageDifficulty: z.number().nonnegative(),
  averageStability: z.number().nonnegative(),
});

export const reviewAgentInputSchema = z.object({
  now: z.string().datetime(),
  weakKnowledgePoints: z.array(reviewAgentWeakPointInputSchema),
  cardSummary: z.object({
    dueCount: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
    highDifficultyCount: z.number().int().nonnegative(),
    lowStabilityCount: z.number().int().nonnegative(),
  }),
  recentReviewSummary: z.object({
    totalReviews: z.number().int().nonnegative(),
    againCount: z.number().int().nonnegative(),
    hardCount: z.number().int().nonnegative(),
    goodCount: z.number().int().nonnegative(),
    easyCount: z.number().int().nonnegative(),
  }),
});

export const reviewAgentWeakPointSchema = z.object({
  label: z.string().min(1),
  reason: z.string().min(1),
  priority: reviewAgentPrioritySchema,
  confidence: z.number().min(0).max(1),
});

export const reviewAgentActionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  targetHref: z.string().min(1),
});

export const reviewAgentResultSchema = z.object({
  priority: reviewAgentPrioritySchema,
  summary: z.string().min(1),
  weakPoints: z.array(reviewAgentWeakPointSchema),
  actions: z.array(reviewAgentActionSchema),
  signals: z.array(z.string().min(1)),
});

export const plannerAgentInputSchema = z.object({
  review: reviewAgentResultSchema,
  plan: reviewTaskPlanResponseSchema,
  preference: reviewPreferenceSchema,
});

export const plannerAgentBlockSchema = z.object({
  title: z.string().min(1),
  minutes: z.number().int().positive(),
  reason: z.string().min(1),
  targetHref: z.string().min(1),
});

export const plannerAgentResultSchema = z.object({
  headline: z.string().min(1),
  todayFocus: z.string().min(1),
  weekStrategy: z.string().min(1),
  capacityNotice: z.string().min(1).optional(),
  suggestedBlocks: z.array(plannerAgentBlockSchema),
  signals: z.array(z.string().min(1)),
});

export const reviewAgentSuggestionQuerySchema = reviewTaskPlanQuerySchema;

export const reviewAgentSuggestionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  review: reviewAgentResultSchema,
  planner: plannerAgentResultSchema,
  planSummary: z.object({
    overdueCount: z.number().int().nonnegative(),
    todayDueCount: z.number().int().nonnegative(),
    upcomingDueCount: z.number().int().nonnegative(),
    estimatedTotalMinutes: z.number().int().nonnegative(),
    peakDay: z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        count: z.number().int().nonnegative(),
      })
      .nullable(),
    intensity: reviewTaskPlanIntensitySchema,
    capacityStatus: reviewTaskPlanCapacityStatusSchema,
    dailyMinutes: z.number().int().positive(),
    dailyCardLimit: z.number().int().positive(),
  }),
});

export type ReviewAgentPriority = z.infer<typeof reviewAgentPrioritySchema>;
export type ReviewAgentWeakPointInput = z.infer<typeof reviewAgentWeakPointInputSchema>;
export type ReviewAgentInput = z.infer<typeof reviewAgentInputSchema>;
export type ReviewAgentWeakPoint = z.infer<typeof reviewAgentWeakPointSchema>;
export type ReviewAgentAction = z.infer<typeof reviewAgentActionSchema>;
export type ReviewAgentResult = z.infer<typeof reviewAgentResultSchema>;
export type PlannerAgentInput = z.infer<typeof plannerAgentInputSchema>;
export type PlannerAgentBlock = z.infer<typeof plannerAgentBlockSchema>;
export type PlannerAgentResult = z.infer<typeof plannerAgentResultSchema>;
export type ReviewAgentSuggestionQuery = z.infer<typeof reviewAgentSuggestionQuerySchema>;
export type ReviewAgentSuggestionResponse = z.infer<
  typeof reviewAgentSuggestionResponseSchema
>;
