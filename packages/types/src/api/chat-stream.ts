import { z } from 'zod';

const boundedIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);

const chatTurnStatusSchema = z.enum(['QUEUED', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'CANCELLED']);

const chatTurnErrorCodeSchema = z.enum([
  'CANCELLED_BY_USER',
  'BUDGET_EXHAUSTED',
  'GENERATION_ABORTED',
  'GENERATION_TIMEOUT',
  'PROVIDER_FAILURE',
  'OUTPUT_INVALID',
  'INTERNAL_FAILURE',
]);

const eventDraftBaseSchema = z
  .object({
    eventId: boundedIdSchema,
  })
  .strict();

const responseStartedDraftSchema = eventDraftBaseSchema
  .extend({
    type: z.literal('response_started'),
    mode: z.enum(['mock', 'live']),
    generator: z.string().trim().min(1).max(80),
  })
  .strict();

const textDeltaDraftSchema = eventDraftBaseSchema
  .extend({
    type: z.literal('text_delta'),
    text: z.string().min(1).max(4_000),
  })
  .strict();

const citationsDraftSchema = eventDraftBaseSchema
  .extend({
    type: z.literal('citations'),
    items: z
      .array(
        z
          .object({
            citationId: boundedIdSchema,
            sourceLabel: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

const responseCompletedDraftSchema = eventDraftBaseSchema
  .extend({
    type: z.literal('response_completed'),
    responseMessageId: boundedIdSchema,
    finishReason: z.enum(['stop', 'length', 'content_filter']),
    generator: z.string().trim().min(1).max(80),
  })
  .strict();

const responseFailedDraftSchema = eventDraftBaseSchema
  .extend({
    type: z.literal('response_failed'),
    errorCode: chatTurnErrorCodeSchema,
    phase: z.enum(['before_first_token', 'after_first_token', 'aborted']),
  })
  .strict();

/**
 * A Redis entry stores this bounded draft plus stream metadata. `sequence`,
 * `turnId`, and `schemaVersion` are added by the stream store after the atomic
 * Redis append assigns the sequence number.
 */
export const chatStreamEventDraftSchema = z.discriminatedUnion('type', [
  responseStartedDraftSchema,
  textDeltaDraftSchema,
  citationsDraftSchema,
  responseCompletedDraftSchema,
  responseFailedDraftSchema,
]);

const eventEnvelopeFields = {
  schemaVersion: z.literal('chat-turn-stream-v1'),
  turnId: boundedIdSchema,
  sequence: z.number().int().min(0).max(1_000_000),
};

export const chatStreamEventSchema = z.discriminatedUnion('type', [
  responseStartedDraftSchema.extend(eventEnvelopeFields),
  textDeltaDraftSchema.extend(eventEnvelopeFields),
  citationsDraftSchema.extend(eventEnvelopeFields),
  responseCompletedDraftSchema.extend(eventEnvelopeFields),
  responseFailedDraftSchema.extend(eventEnvelopeFields),
]);

export const chatStreamCursorSchema = z
  .string()
  .regex(/^\d+-\d+$/)
  .max(64);

const numericQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (typeof value === 'string') return Number(value);
    return value;
  }, z.number().int().min(min).max(max).default(defaultValue));

export const chatStreamEventsQuerySchema = z
  .object({
    cursor: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      chatStreamCursorSchema.optional(),
    ),
    limit: numericQuerySchema(100, 1, 256),
  })
  .strict();

export const chatStreamEventRecordSchema = z
  .object({
    cursor: chatStreamCursorSchema,
    event: chatStreamEventSchema,
  })
  .strict();

export const chatStreamEventsResponseSchema = z
  .object({
    events: z.array(chatStreamEventRecordSchema).max(256),
    nextCursor: chatStreamCursorSchema.nullable(),
    cursorState: z.enum(['initial', 'ok', 'expired']),
    transport: z.enum(['available', 'unavailable']),
    hasMore: z.boolean(),
    terminal: z.boolean(),
  })
  .strict();

const isoDateSchema = z.string().datetime();

export const chatTurnStatusResponseSchema = z
  .object({
    turn: z
      .object({
        id: boundedIdSchema,
        conversationId: boundedIdSchema,
        status: chatTurnStatusSchema,
        responseMessageId: boundedIdSchema.nullable(),
        errorCode: chatTurnErrorCodeSchema.nullable(),
        startedAt: isoDateSchema.nullable(),
        finishedAt: isoDateSchema.nullable(),
        createdAt: isoDateSchema,
        updatedAt: isoDateSchema,
      })
      .strict(),
    backgroundJob: z
      .object({
        id: boundedIdSchema,
        status: z.enum(['QUEUED', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'STALE_SKIPPED']),
        attempt: z.number().int().min(0),
        maxAttempts: z.number().int().min(1),
        progress: z.number().int().min(0).max(100),
        errorCode: z.string().max(80).nullable(),
        requestedAt: isoDateSchema,
        startedAt: isoDateSchema.nullable(),
        finishedAt: isoDateSchema.nullable(),
      })
      .strict()
      .nullable(),
    response: z
      .object({
        id: boundedIdSchema,
        role: z.literal('ASSISTANT'),
        content: z.string().max(100_000),
        order: z.number().int().min(0),
        createdAt: isoDateSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export type ChatStreamEventDraft = z.infer<typeof chatStreamEventDraftSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
export type ChatStreamCursor = z.infer<typeof chatStreamCursorSchema>;
export type ChatStreamEventsQuery = z.infer<typeof chatStreamEventsQuerySchema>;
export type ChatStreamEventRecord = z.infer<typeof chatStreamEventRecordSchema>;
export type ChatStreamEventsResponse = z.infer<typeof chatStreamEventsResponseSchema>;
export type ChatTurnStatusResponse = z.infer<typeof chatTurnStatusResponseSchema>;
export type ChatTurnStatus = z.infer<typeof chatTurnStatusSchema>;
export type ChatTurnErrorCode = z.infer<typeof chatTurnErrorCodeSchema>;
