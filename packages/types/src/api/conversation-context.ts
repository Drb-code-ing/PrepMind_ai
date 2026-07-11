import { z } from 'zod';

export const conversationSummaryStatusSchema = z.enum([
  'not_needed',
  'reused',
  'generated',
  'degraded',
  'stale_snapshot',
  'cas_conflict',
]);

export const conversationSummaryTriggerReasonSchema = z.enum([
  'message_count',
  'token_pressure',
  'none',
]);

export const conversationSummaryOutputSchema = z
  .object({
    summary: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const conversationStateSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    activeGoal: z.string().max(300).nullable(),
    activeQuestionId: z.string().max(100).nullable(),
    stateVersion: z.number().int().safe().positive(),
    expiresAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.expiresAt) <= Date.parse(value.updatedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'expiresAt must be later than updatedAt',
        path: ['expiresAt'],
      });
    }
  });

export const conversationContextPrepareRequestSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    maxInputTokens: z.number().int().safe().min(200).max(12_000),
    statePatch: z
      .object({
        activeGoal: z.string().trim().max(300).nullable().optional(),
        activeQuestionId: z.string().trim().max(100).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const conversationContextPrepareResponseSchema = z
  .object({
    conversationId: z.string().min(1).max(100),
    summaryBuffer: z.string().min(1).max(4_000).nullable(),
    coveredThroughOrder: z.number().int().safe().min(0).nullable(),
    summaryVersion: z.number().int().safe().positive().nullable(),
    summaryStatus: conversationSummaryStatusSchema,
    state: conversationStateSchema.nullable(),
    debug: z
      .object({
        uncoveredMessageCount: z.number().int().safe().min(0),
        triggerReason: conversationSummaryTriggerReasonSchema,
        modelMode: z.enum(['mock', 'live', 'none']),
        errorCode: z.string().min(1).max(120).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const summaryFields = [
      value.summaryBuffer,
      value.coveredThroughOrder,
      value.summaryVersion,
    ];
    const allNull = summaryFields.every((field) => field === null);
    const allPresent = summaryFields.every((field) => field !== null);

    if (!allNull && !allPresent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'summary fields must be all null or all present',
        path: ['summaryBuffer'],
      });
    }

    if (
      (value.summaryStatus === 'generated' || value.summaryStatus === 'reused') &&
      !allPresent
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.summaryStatus} requires summary fields`,
        path: ['summaryStatus'],
      });
    }

    if (value.state !== null && value.state.conversationId !== value.conversationId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'state conversationId must match response conversationId',
        path: ['state', 'conversationId'],
      });
    }
  });

export type ConversationContextPrepareRequest = z.infer<
  typeof conversationContextPrepareRequestSchema
>;
export type ConversationContextPrepareResponse = z.infer<
  typeof conversationContextPrepareResponseSchema
>;
export type ConversationStateResponse = z.infer<typeof conversationStateSchema>;
export type ConversationSummaryStatus = z.infer<typeof conversationSummaryStatusSchema>;
export type ConversationSummaryTriggerReason = z.infer<
  typeof conversationSummaryTriggerReasonSchema
>;
export type ConversationSummaryOutput = z.infer<
  typeof conversationSummaryOutputSchema
>;
