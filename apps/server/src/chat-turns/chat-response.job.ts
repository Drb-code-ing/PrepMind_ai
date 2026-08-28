import { z } from 'zod';

import { CHAT_RESPONSE_JOB, CHAT_RESPONSE_QUEUE } from './chat-turn.constants';

export { CHAT_RESPONSE_JOB, CHAT_RESPONSE_QUEUE };

/**
 * The queue payload is a capability to re-load server-owned facts, not a
 * copy of the user's prompt or an authorization assertion.
 */
export const chatResponseJobPayloadSchema = z
  .object({
    turnId: z.string().min(1).max(128),
    backgroundJobId: z.string().min(1).max(128),
    inputHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    budgetPolicyVersion: z.string().min(1).max(80),
  })
  .strict();

export type ChatResponseJobPayload = z.infer<
  typeof chatResponseJobPayloadSchema
>;

export const chatResponseCompletedEventPayloadSchema = z
  .object({
    turnId: z.string().min(1).max(128),
    backgroundJobId: z.string().min(1).max(128),
    responseMessageId: z.string().min(1).max(128),
    inputHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    budgetPolicyVersion: z.string().min(1).max(80),
  })
  .strict();

export const chatResponseFailedEventPayloadSchema = z
  .object({
    turnId: z.string().min(1).max(128),
    backgroundJobId: z.string().min(1).max(128),
    inputHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    budgetPolicyVersion: z.string().min(1).max(80),
    errorCode: z.enum([
      'CANCELLED_BY_USER',
      'BUDGET_EXHAUSTED',
      'GENERATION_ABORTED',
      'GENERATION_TIMEOUT',
      'PROVIDER_FAILURE',
      'OUTPUT_INVALID',
      'INTERNAL_FAILURE',
    ]),
  })
  .strict();

export type ChatResponseCompletedEventPayload = z.infer<
  typeof chatResponseCompletedEventPayloadSchema
>;

export type ChatResponseFailedEventPayload = z.infer<
  typeof chatResponseFailedEventPayloadSchema
>;
