import { z } from 'zod';

export const ocrRecordStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'DONE',
  'FAILED',
]);

export const ocrParsedPayloadSchema = z
  .object({
    isQuestion: z.boolean(),
    nonQuestionSummary: z.string().max(5_000).optional(),
    subject: z.string().max(50).optional(),
    questionText: z.string().max(20_000).optional(),
    category: z.string().max(100).optional(),
    knowledgePoints: z.array(z.string().min(1).max(100)).max(20).optional(),
    analysis: z.string().max(30_000).optional(),
    answer: z.string().max(20_000).optional(),
    errorSuggestion: z.string().max(100).optional(),
  })
  .passthrough();

export const serverImageUrlSchema = z
  .string()
  .min(1)
  .max(2_048);

export const ocrRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  groupId: z.string().min(1),
  imageUrl: z.string().nullable(),
  rawText: z.string(),
  parsedJson: ocrParsedPayloadSchema.nullable(),
  status: ocrRecordStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createOcrRecordRequestSchema = z.object({
  groupId: z.string().min(1).max(100),
  rawText: z.string().trim().min(1).max(100_000),
  parsedJson: ocrParsedPayloadSchema.optional(),
  imageUrl: serverImageUrlSchema.optional(),
  status: ocrRecordStatusSchema.default('DONE'),
});

export const listOcrRecordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: ocrRecordStatusSchema.optional(),
  keyword: z.string().min(1).max(100).optional(),
  isQuestion: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const ocrRecordListResponseSchema = z.object({
  items: z.array(ocrRecordSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type OcrRecordStatus = z.infer<typeof ocrRecordStatusSchema>;
export type OcrParsedPayload = z.infer<typeof ocrParsedPayloadSchema>;
export type OcrRecordResponse = z.infer<typeof ocrRecordSchema>;
export type CreateOcrRecordRequest = z.infer<
  typeof createOcrRecordRequestSchema
>;
export type ListOcrRecordsQuery = z.infer<typeof listOcrRecordsQuerySchema>;
export type OcrRecordListResponse = z.infer<
  typeof ocrRecordListResponseSchema
>;
