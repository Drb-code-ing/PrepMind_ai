import { z } from 'zod';

const numericQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  }, z.number().int().min(min).max(max).default(defaultValue));

const documentIdSchema = z.string().trim().min(1);

export const knowledgeDedupSuggestionKindSchema = z.enum([
  'exact_duplicate',
  'semantic_duplicate',
  'possible_revision',
  'complementary',
  'insufficient_signal',
]);

export const knowledgeDedupRecommendationSchema = z.enum([
  'use_existing',
  'replace_old',
  'keep_both',
  'review_manually',
]);

export const knowledgeAgentSuggestionQuerySchema = z
  .object({
    documentId: documentIdSchema.optional(),
    limit: numericQuerySchema(20, 1, 50),
  })
  .strict();

export const knowledgeDedupItemSchema = z.object({
  kind: knowledgeDedupSuggestionKindSchema,
  severity: z.enum(['info', 'warning']),
  documentIds: z.array(documentIdSchema).min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  recommendation: knowledgeDedupRecommendationSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});

export const knowledgeDedupResultSchema = z.object({
  summary: z.string(),
  items: z.array(knowledgeDedupItemSchema),
  signals: z.array(z.string()),
});

export const knowledgeOrganizerCollectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  documentIds: z.array(documentIdSchema).min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
});

export const knowledgeOrganizerTagSchema = z.object({
  documentId: documentIdSchema,
  labels: z.array(z.string()).min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const knowledgeOrganizerResultSchema = z.object({
  summary: z.string(),
  collections: z.array(knowledgeOrganizerCollectionSchema),
  tags: z.array(knowledgeOrganizerTagSchema),
  signals: z.array(z.string()),
});

export const knowledgeAgentRuntimeMetadataSchema = z
  .object({
    source: z.enum(['local_deterministic', 'hybrid_model']),
    disposition: z.enum([
      'candidate_applied',
      'not_eligible',
      'gate_disabled',
      'safety_blocked',
      'snapshot_stale',
      'fallback_aborted',
      'fallback_budget_exhausted',
      'fallback_schema_invalid',
      'fallback_runtime_error',
      'fallback_usage_invalid',
    ]),
    reasonCode: z.string().regex(/^[a-z0-9_]+$/),
    attempted: z.boolean(),
    degraded: z.boolean(),
    usage: z
      .object({
        inputTokens: z.number().int().safe().nonnegative(),
        outputTokens: z.number().int().safe().nonnegative(),
        pricingKnown: z.boolean(),
        estimatedCostCny: z.number().positive().nullable(),
      })
      .strict(),
    traceId: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const hybridApplied =
      value.source === 'hybrid_model' &&
      value.disposition === 'candidate_applied' &&
      value.attempted &&
      !value.degraded &&
      value.traceId !== null;
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
    if (
      value.usage.pricingKnown !==
      (value.usage.estimatedCostCny !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'pricing provenance is inconsistent',
      });
    }
    if (
      value.usage.pricingKnown &&
      (value.usage.inputTokens <= 0 || value.usage.outputTokens <= 0)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'known pricing requires verified positive usage',
      });
    }
  });

export const knowledgeAgentSuggestionResponseSchema = z
  .object({
    generatedAt: z.string().datetime(),
    dedup: knowledgeDedupResultSchema.extend({
      runtime: knowledgeAgentRuntimeMetadataSchema,
    }),
    organizer: knowledgeOrganizerResultSchema.extend({
      runtime: knowledgeAgentRuntimeMetadataSchema,
    }),
  })
  .strict();

export type KnowledgeAgentSuggestionQuery = z.infer<
  typeof knowledgeAgentSuggestionQuerySchema
>;
export type KnowledgeDedupSuggestionKind = z.infer<
  typeof knowledgeDedupSuggestionKindSchema
>;
export type KnowledgeDedupRecommendation = z.infer<
  typeof knowledgeDedupRecommendationSchema
>;
export type KnowledgeDedupItem = z.infer<typeof knowledgeDedupItemSchema>;
export type KnowledgeDedupResult = z.infer<typeof knowledgeDedupResultSchema>;
export type KnowledgeOrganizerCollection = z.infer<
  typeof knowledgeOrganizerCollectionSchema
>;
export type KnowledgeOrganizerTag = z.infer<typeof knowledgeOrganizerTagSchema>;
export type KnowledgeOrganizerResult = z.infer<typeof knowledgeOrganizerResultSchema>;
export type KnowledgeAgentRuntimeMetadata = z.infer<
  typeof knowledgeAgentRuntimeMetadataSchema
>;
export type KnowledgeAgentSuggestionResponse = z.infer<
  typeof knowledgeAgentSuggestionResponseSchema
>;
