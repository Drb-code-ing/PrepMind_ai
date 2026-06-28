import { z } from 'zod';

export const userMemoryTypeSchema = z.enum([
  'LEARNING_GOAL',
  'EXPLANATION_PREFERENCE',
  'WEAK_POINT',
  'STUDY_HABIT',
]);

export const memoryCandidateStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

export const userMemoryStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const memoryEvidenceSchema = z.object({
  sourceType: z.enum(['chat', 'wrong-question', 'review', 'preference']),
  sourceId: z.string().min(1).optional(),
  summary: z.string().min(1),
});

export const memoryCandidateSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: userMemoryTypeSchema,
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(500),
  reason: z.string().min(1).max(500),
  evidence: z.array(memoryEvidenceSchema).min(1).max(5),
  confidence: z.number().min(0).max(1),
  status: memoryCandidateStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});

export const userMemorySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  type: userMemoryTypeSchema,
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(500),
  status: userMemoryStatusSchema,
  confidence: z.number().min(0).max(1),
  lastUsedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const memoryCandidateListQuerySchema = z.object({
  status: memoryCandidateStatusSchema.default('PENDING'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const memoryCandidateListResponseSchema = z.object({
  items: z.array(memoryCandidateSchema),
});

export const generateMemoryCandidatesRequestSchema = z.object({
  source: z.enum(['profile', 'manual']).default('profile'),
  force: z.boolean().default(false),
});

export const generateMemoryCandidatesResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  createdCount: z.number().int().nonnegative(),
  candidates: z.array(memoryCandidateSchema),
  summary: z.string().min(1),
});

export const acceptMemoryCandidateResponseSchema = z.object({
  candidate: memoryCandidateSchema,
  memory: userMemorySchema,
});

export const rejectMemoryCandidateResponseSchema = z.object({
  candidate: memoryCandidateSchema,
});

export const userMemoryListQuerySchema = z.object({
  status: z.union([userMemoryStatusSchema, z.literal('all')]).default('ACTIVE'),
  type: userMemoryTypeSchema.optional(),
});

export const userMemoryListResponseSchema = z.object({
  items: z.array(userMemorySchema),
});

export const updateUserMemoryRequestSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    content: z.string().min(1).max(500).optional(),
    status: userMemoryStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const deleteUserMemoryResponseSchema = z.object({
  ok: z.literal(true),
});

export type UserMemoryType = z.infer<typeof userMemoryTypeSchema>;
export type MemoryCandidateStatus = z.infer<typeof memoryCandidateStatusSchema>;
export type UserMemoryStatus = z.infer<typeof userMemoryStatusSchema>;
export type MemoryEvidence = z.infer<typeof memoryEvidenceSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export type UserMemory = z.infer<typeof userMemorySchema>;
export type MemoryCandidateListQuery = z.infer<typeof memoryCandidateListQuerySchema>;
export type MemoryCandidateListResponse = z.infer<
  typeof memoryCandidateListResponseSchema
>;
export type GenerateMemoryCandidatesRequest = z.infer<
  typeof generateMemoryCandidatesRequestSchema
>;
export type GenerateMemoryCandidatesResponse = z.infer<
  typeof generateMemoryCandidatesResponseSchema
>;
export type AcceptMemoryCandidateResponse = z.infer<
  typeof acceptMemoryCandidateResponseSchema
>;
export type RejectMemoryCandidateResponse = z.infer<
  typeof rejectMemoryCandidateResponseSchema
>;
export type UserMemoryListQuery = z.infer<typeof userMemoryListQuerySchema>;
export type UserMemoryListResponse = z.infer<typeof userMemoryListResponseSchema>;
export type UpdateUserMemoryRequest = z.infer<typeof updateUserMemoryRequestSchema>;
