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

export const backgroundJobStatusSchema = z.enum([
  'QUEUED',
  'ACTIVE',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'STALE_SKIPPED',
]);

export const backgroundJobResourceTypeSchema = z.enum(['KNOWLEDGE_DOCUMENT']);

export const backgroundJobResponseSchema = z.object({
  id: z.string(),
  queueName: z.string(),
  jobName: z.string(),
  status: backgroundJobStatusSchema,
  resourceType: backgroundJobResourceTypeSchema,
  resourceId: z.string(),
  attempt: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  progress: z.number().int().min(0).max(100),
  payloadPreview: z.record(z.unknown()).nullable(),
  resultSummary: z.record(z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  requestedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const backgroundJobListQuerySchema = z
  .object({
    resourceType: backgroundJobResourceTypeSchema.optional(),
    resourceId: z.string().trim().min(1).optional(),
    status: backgroundJobStatusSchema.optional(),
    limit: numericQuerySchema(10, 1, 50),
  })
  .strict();

export const backgroundJobListResponseSchema = z.object({
  items: z.array(backgroundJobResponseSchema),
});

export const backgroundJobSummaryResponseSchema = z.object({
  activeCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  staleSkippedCount: z.number().int().min(0),
  succeededCount: z.number().int().min(0),
  totalRecentCount: z.number().int().min(0),
  latestJob: backgroundJobResponseSchema.nullable(),
});

export type BackgroundJobStatus = z.infer<typeof backgroundJobStatusSchema>;
export type BackgroundJobResourceType = z.infer<typeof backgroundJobResourceTypeSchema>;
export type BackgroundJobResponse = z.infer<typeof backgroundJobResponseSchema>;
export type BackgroundJobListQuery = z.infer<typeof backgroundJobListQuerySchema>;
export type BackgroundJobListResponse = z.infer<typeof backgroundJobListResponseSchema>;
export type BackgroundJobSummaryResponse = z.infer<typeof backgroundJobSummaryResponseSchema>;
