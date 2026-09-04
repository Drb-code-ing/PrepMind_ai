import { z } from 'zod';

export const CHAT_TURN_ID_PATTERN = '^[A-Za-z0-9._:-]{1,128}$';

const boundedIdSchema = z.string().trim().regex(new RegExp(CHAT_TURN_ID_PATTERN));
const inputHashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const isoDateSchema = z.string().datetime();

const chatTurnStatusSchema = z.enum(['QUEUED', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'CANCELLED']);

const backgroundJobStatusSchema = z.enum([
  'QUEUED',
  'ACTIVE',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'STALE_SKIPPED',
]);

export const chatTurnEnqueueRequestSchema = z
  .object({
    conversationId: boundedIdSchema,
    clientRequestId: z.string().trim().min(1).max(120),
    inputHash: inputHashSchema,
    inputMessageIds: z
      .array(boundedIdSchema)
      .min(1)
      .max(1000)
      .superRefine((ids, context) => {
        if (new Set(ids).size !== ids.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'inputMessageIds must be unique',
          });
        }
      }),
    budgetPolicyVersion: z.string().trim().min(1).max(80),
  })
  .strict();

const queuedTurnSchema = z
  .object({
    id: boundedIdSchema,
    conversationId: boundedIdSchema,
    status: chatTurnStatusSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

const queuedBackgroundJobSchema = z
  .object({
    id: boundedIdSchema,
    status: backgroundJobStatusSchema,
    attempt: z.number().int().min(0),
    maxAttempts: z.number().int().min(1),
    progress: z.number().int().min(0).max(100),
    requestedAt: isoDateSchema,
  })
  .strict();

export const chatTurnEnqueueResponseSchema = z
  .object({
    kind: z.enum(['created', 'existing']),
    turn: queuedTurnSchema,
    backgroundJob: queuedBackgroundJobSchema,
  })
  .strict();

export type ChatTurnEnqueueRequest = z.infer<typeof chatTurnEnqueueRequestSchema>;
export type ChatTurnEnqueueResponse = z.infer<typeof chatTurnEnqueueResponseSchema>;
