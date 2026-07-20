import { z } from 'zod';

import { reviewPreferenceSchema } from '@repo/types/api/review-preference';
import {
  reviewTaskPlanCapacityStatusSchema,
  reviewTaskPlanIntensitySchema,
  reviewTaskPlanQuerySchema,
  reviewTaskPlanResponseSchema,
} from '@repo/types/api/review-task';

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

export const reviewPlannerModelObservationDispositionSchema = z.enum([
  'not_eligible',
  'safety_blocked',
  'candidate_applied',
  'fallback_invalid_input',
  'fallback_schema_invalid',
  'fallback_budget_exceeded',
  'fallback_timeout',
  'fallback_aborted',
  'fallback_runtime_error',
]);

export const reviewPlannerModelObservationErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
]);

export const reviewPlannerModelProviderFailureCategorySchema = z.enum([
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'transport',
  'structured_output',
  'invalid_response',
  'unknown',
]);

export const reviewPlannerModelObservationSchema = z
  .object({
    attempted: z.boolean(),
    disposition: reviewPlannerModelObservationDispositionSchema,
    durationMs: z.number().int().nonnegative(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
      })
      .strict(),
    errorCode: reviewPlannerModelObservationErrorCodeSchema.optional(),
    providerFailureCategory:
      reviewPlannerModelProviderFailureCategorySchema.optional(),
    provenance: z.enum([
      'local_deterministic',
      'mock_candidate',
      'live_candidate',
    ]),
    degraded: z.boolean(),
    cached: z.literal(false),
  })
  .strict()
  .superRefine((observation, context) => {
    if (
      observation.providerFailureCategory !== undefined &&
      (observation.errorCode !== 'PROVIDER_ERROR' ||
        !observation.attempted ||
        observation.provenance !== 'live_candidate')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['providerFailureCategory'],
        message:
          'providerFailureCategory is only valid for attempted live provider failures.',
      });
    }
  });

export const reviewPlannerModelObservationsSchema = z
  .object({
    version: z.literal(1),
    review: reviewPlannerModelObservationSchema,
    planner: reviewPlannerModelObservationSchema,
  })
  .strict();

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
  modelObservations: reviewPlannerModelObservationsSchema.optional(),
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
export type ReviewPlannerModelObservation = z.infer<
  typeof reviewPlannerModelObservationSchema
>;
export type ReviewPlannerModelObservations = z.infer<
  typeof reviewPlannerModelObservationsSchema
>;
export type ReviewAgentSuggestionResponse = z.infer<
  typeof reviewAgentSuggestionResponseSchema
>;
