import { z } from 'zod';

import { backgroundJobStatusSchema } from '@repo/types/api/background-job';

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

const floatQuerySchema = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  }, z.number().min(min).max(max).default(defaultValue));

export const knowledgeDocumentTypeSchema = z.enum(['PDF', 'DOCX', 'MD', 'TXT']);
export const knowledgeDocumentMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
]);
export const knowledgeDocumentStatusSchema = z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']);
export const knowledgeDocumentSourceTypeSchema = z.enum([
  'UPLOAD',
  'NOTE',
  'WRONG_QUESTION',
  'OCR',
  'CHAT',
]);

export const knowledgeDocumentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: knowledgeDocumentTypeSchema,
  size: z.number().int().nonnegative(),
  mimeType: knowledgeDocumentMimeTypeSchema,
  status: knowledgeDocumentStatusSchema,
  sourceType: knowledgeDocumentSourceTypeSchema,
  errorMessage: z.string().nullable(),
  contentHash: z.string().nullable(),
  chunkCount: z.number().int().nonnegative(),
  processedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const knowledgeDocumentUploadResponseSchema = knowledgeDocumentResponseSchema;

export const knowledgeDocumentReplaceResponseSchema = knowledgeDocumentResponseSchema;

export const knowledgeDocumentDetailResponseSchema = knowledgeDocumentResponseSchema;

export const knowledgeDocumentDeleteResponseSchema = z.object({
  ok: z.literal(true),
});

export const knowledgeDocumentProcessRequestSchema = z
  .object({
    force: z.boolean().default(false),
  })
  .strict();

export const knowledgeDocumentProcessingMetadataSchema = z.object({
  mode: z.literal('queue'),
  backgroundJobId: z.string().min(1),
  status: backgroundJobStatusSchema,
  queuedAt: z.string().datetime(),
});

export const knowledgeDocumentProcessResponseSchema = knowledgeDocumentResponseSchema.extend({
  processing: knowledgeDocumentProcessingMetadataSchema.optional(),
});

export const knowledgeDocumentListQuerySchema = z
  .object({
    status: knowledgeDocumentStatusSchema.optional(),
    sourceType: knowledgeDocumentSourceTypeSchema.optional(),
    limit: numericQuerySchema(20, 1, 100),
    cursor: z.string().optional(),
  })
  .strict();

export const knowledgeDocumentListResponseSchema = z.object({
  items: z.array(knowledgeDocumentResponseSchema),
  nextCursor: z.string().nullable(),
});

export const knowledgeSearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(2000),
    topK: numericQuerySchema(5, 1, 20),
    minScore: floatQuerySchema(0.7, 0, 1),
  })
  .strict();

export const knowledgeSearchHitSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  content: z.string(),
  score: z.number().min(0).max(1),
  metadata: z.record(z.unknown()),
});

export const knowledgeSearchResponseSchema = z.object({
  hits: z.array(knowledgeSearchHitSchema),
});

export type KnowledgeDocumentType = z.infer<typeof knowledgeDocumentTypeSchema>;
export type KnowledgeDocumentMimeType = z.infer<typeof knowledgeDocumentMimeTypeSchema>;
export type KnowledgeDocumentStatus = z.infer<typeof knowledgeDocumentStatusSchema>;
export type KnowledgeDocumentSourceType = z.infer<typeof knowledgeDocumentSourceTypeSchema>;
export type KnowledgeDocumentResponse = z.infer<typeof knowledgeDocumentResponseSchema>;
export type KnowledgeDocumentUploadResponse = z.infer<
  typeof knowledgeDocumentUploadResponseSchema
>;
export type KnowledgeDocumentReplaceResponse = z.infer<
  typeof knowledgeDocumentReplaceResponseSchema
>;
export type KnowledgeDocumentDetailResponse = z.infer<
  typeof knowledgeDocumentDetailResponseSchema
>;
export type KnowledgeDocumentDeleteResponse = z.infer<
  typeof knowledgeDocumentDeleteResponseSchema
>;
export type KnowledgeDocumentProcessRequest = z.infer<
  typeof knowledgeDocumentProcessRequestSchema
>;
export type KnowledgeDocumentProcessingMetadata = z.infer<
  typeof knowledgeDocumentProcessingMetadataSchema
>;
export type KnowledgeDocumentProcessResponse = z.infer<
  typeof knowledgeDocumentProcessResponseSchema
>;
export type KnowledgeDocumentListQuery = z.infer<typeof knowledgeDocumentListQuerySchema>;
export type KnowledgeDocumentListResponse = z.infer<typeof knowledgeDocumentListResponseSchema>;
export type KnowledgeSearchRequest = z.infer<typeof knowledgeSearchRequestSchema>;
export type KnowledgeSearchHit = z.infer<typeof knowledgeSearchHitSchema>;
export type KnowledgeSearchResponse = z.infer<typeof knowledgeSearchResponseSchema>;
