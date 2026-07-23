import { z } from 'zod';

import { wrongQuestionSchema } from '@repo/types/api/wrong-question';

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

export const wrongQuestionOrganizerRuntimeSourceSchema = z.enum([
  'local_deterministic',
  'hybrid_model',
]);

export const wrongQuestionOrganizerRuntimeDispositionSchema = z.enum([
  'candidate_applied',
  'not_eligible',
  'gate_disabled',
  'safety_blocked',
  'snapshot_stale',
  'fallback_invalid_input',
  'fallback_schema_invalid',
  'fallback_budget_exceeded',
  'fallback_timeout',
  'fallback_aborted',
  'fallback_runtime_error',
  'fallback_usage_invalid',
]);

const nonDegradedOrganizerRuntimeDispositions = new Set([
  'candidate_applied',
  'not_eligible',
  'gate_disabled',
]);

export const wrongQuestionOrganizerRuntimeMetadataSchema = z
  .object({
    source: wrongQuestionOrganizerRuntimeSourceSchema,
    disposition: wrongQuestionOrganizerRuntimeDispositionSchema,
    degraded: z.boolean(),
    traceId: z.string().regex(/^[a-z0-9_-]{1,96}$/i).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hybridApplied =
      value.source === 'hybrid_model' &&
      value.disposition === 'candidate_applied' &&
      !value.degraded &&
      value.traceId !== undefined;
    if ((value.source === 'hybrid_model') !== hybridApplied) {
      context.addIssue({
        code: 'custom',
        message: 'hybrid source requires a persisted applied candidate',
      });
    }
    if (value.disposition === 'candidate_applied' && !hybridApplied) {
      context.addIssue({
        code: 'custom',
        message: 'applied candidate metadata is inconsistent',
      });
    }
    if (value.source === 'local_deterministic' && value.traceId !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'local runtime must not expose a trace id',
      });
    }
    const expectedDegraded = !nonDegradedOrganizerRuntimeDispositions.has(
      value.disposition,
    );
    if (value.degraded !== expectedDegraded) {
      context.addIssue({
        code: 'custom',
        message: 'runtime degraded state is inconsistent',
      });
    }
  });

export const organizedWrongQuestionItemSchema = z
  .object({
    subjectGroup: wrongQuestionSubjectGroupSchema,
    deck: wrongQuestionDeckSchema,
    item: wrongQuestionDeckItemSchema,
    createdSubjectGroup: z.boolean(),
    createdDeck: z.boolean(),
    createdItem: z.boolean(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const organizeWrongQuestionResponseSchema = organizedWrongQuestionItemSchema
  .extend({
    runtime: wrongQuestionOrganizerRuntimeMetadataSchema,
  })
  .strict();

export const organizeWrongQuestionBatchResponseSchema = z
  .object({
    organizedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    items: z.array(organizedWrongQuestionItemSchema),
    runtime: wrongQuestionOrganizerRuntimeMetadataSchema,
  })
  .strict();

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
export type WrongQuestionOrganizerRuntimeSource = z.infer<
  typeof wrongQuestionOrganizerRuntimeSourceSchema
>;
export type WrongQuestionOrganizerRuntimeDisposition = z.infer<
  typeof wrongQuestionOrganizerRuntimeDispositionSchema
>;
export type WrongQuestionOrganizerRuntimeMetadata = z.infer<
  typeof wrongQuestionOrganizerRuntimeMetadataSchema
>;
export type OrganizedWrongQuestionItem = z.infer<
  typeof organizedWrongQuestionItemSchema
>;
export type OrganizeWrongQuestionResponse = z.infer<typeof organizeWrongQuestionResponseSchema>;
export type OrganizeWrongQuestionBatchResponse = z.infer<
  typeof organizeWrongQuestionBatchResponseSchema
>;
export type UpdateWrongQuestionDeckRequest = z.infer<typeof updateWrongQuestionDeckRequestSchema>;
export type MoveWrongQuestionToDeckRequest = z.infer<
  typeof moveWrongQuestionToDeckRequestSchema
>;
