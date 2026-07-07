import { z } from 'zod';

export const outboxEventStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'DEAD',
]);

export const outboxEventListQuerySchema = z.object({
  status: outboxEventStatusSchema.optional(),
  type: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export const outboxEventListItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    status: outboxEventStatusSchema,
    attempts: z.number().int().min(0),
    maxAttempts: z.number().int().min(1),
    nextRunAt: z.string().datetime().nullable(),
    lockedAt: z.string().datetime().nullable(),
    processedAt: z.string().datetime().nullable(),
    lastErrorCode: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    hasPayload: z.boolean(),
    hasLastError: z.boolean(),
    canRequeue: z.boolean(),
  })
  .strict();

export const outboxEventDetailResponseSchema = outboxEventListItemSchema
  .extend({
    lockedBy: z.string().min(1).nullable(),
    lastErrorPreview: z.string().min(1).nullable(),
    payloadHash: z.string().min(1).nullable(),
  })
  .strict();

export const outboxEventListResponseSchema = z
  .object({
    items: z.array(outboxEventListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const outboxEventRequeueRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(300).optional(),
  })
  .strict()
  .default({});

export type OutboxEventStatus = z.infer<typeof outboxEventStatusSchema>;
export type OutboxEventListQuery = z.infer<
  typeof outboxEventListQuerySchema
>;
export type OutboxEventListItem = z.infer<typeof outboxEventListItemSchema>;
export type OutboxEventDetailResponse = z.infer<
  typeof outboxEventDetailResponseSchema
>;
export type OutboxEventListResponse = z.infer<
  typeof outboxEventListResponseSchema
>;
export type OutboxEventRequeueRequest = z.infer<
  typeof outboxEventRequeueRequestSchema
>;
