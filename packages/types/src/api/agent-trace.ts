import { z } from 'zod';

import { agentRouteSchema } from '@repo/types/api/agent';

export const agentTraceStatusSchema = z.enum(['completed', 'failed', 'degraded']);
export const agentTraceModeSchema = z.enum(['mock', 'live']);
export const agentTraceVerifierStatusSchema = z.enum([
  'trusted',
  'suspicious',
  'conflict',
  'insufficient',
  'skipped',
]);

export const agentTraceStepSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  node: z.string().min(1),
  status: agentTraceStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().min(0).nullable(),
  inputSummary: z.string().max(160),
  outputSummary: z.string().max(160),
  errorMessage: z.string().max(240).nullable(),
});

export const createAgentTraceStepRequestSchema = agentTraceStepSchema.omit({
  id: true,
  runId: true,
});

export const agentTraceRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).nullable(),
  route: agentRouteSchema.nullable(),
  confidence: z.number().min(0).max(1),
  status: agentTraceStatusSchema,
  mode: agentTraceModeSchema,
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  inputTokenEstimate: z.number().int().min(0),
  outputTokenEstimate: z.number().int().min(0),
  maxOutputTokens: z.number().int().min(0),
  pricingKnown: z.boolean(),
  costEstimate: z.number().min(0),
  ragHitCount: z.number().int().min(0),
  verifierStatus: agentTraceVerifierStatusSchema.optional(),
  verifierChunkCount: z.number().int().min(0),
  tutorIntent: z.string().min(1).optional(),
  tutorDepth: z.string().min(1).optional(),
  degraded: z.boolean(),
  inputHash: z.string().min(1).optional(),
  inputPreview: z.string().max(80).optional(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  totalDurationMs: z.number().int().min(0).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const agentTraceCreateRequestSchema = agentTraceRunSchema
  .omit({
    id: true,
    userId: true,
    route: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    runId: z.string().min(1).optional(),
    route: agentRouteSchema.nullable().optional(),
    steps: z.array(createAgentTraceStepRequestSchema).max(20),
  });

export const agentTraceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  route: agentRouteSchema.optional(),
  mode: agentTraceModeSchema.optional(),
  status: agentTraceStatusSchema.optional(),
});

export const agentTraceSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export const agentTraceListResponseSchema = z.object({
  runs: z.array(agentTraceRunSchema),
});

export const agentTraceDetailResponseSchema = z.object({
  run: agentTraceRunSchema,
  steps: z.array(agentTraceStepSchema),
});

export const agentTraceSummaryResponseSchema = z.object({
  days: z.number().int().min(1).max(30),
  totalRuns: z.number().int().min(0),
  liveRuns: z.number().int().min(0),
  mockRuns: z.number().int().min(0),
  degradedRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalCostEstimate: z.number().min(0),
  lastRunAt: z.string().datetime().nullable(),
  routeBreakdown: z.array(
    z.object({ route: agentRouteSchema, count: z.number().int().min(0) }),
  ),
  verifierBreakdown: z.array(
    z.object({
      status: agentTraceVerifierStatusSchema,
      count: z.number().int().min(0),
    }),
  ),
});

export type AgentTraceStatus = z.infer<typeof agentTraceStatusSchema>;
export type AgentTraceMode = z.infer<typeof agentTraceModeSchema>;
export type AgentTraceVerifierStatus = z.infer<typeof agentTraceVerifierStatusSchema>;
export type AgentTraceRun = z.infer<typeof agentTraceRunSchema>;
export type AgentTraceStep = z.infer<typeof agentTraceStepSchema>;
export type CreateAgentTraceStepRequest = z.infer<
  typeof createAgentTraceStepRequestSchema
>;
export type AgentTraceCreateRequest = z.infer<
  typeof agentTraceCreateRequestSchema
>;
export type AgentTraceListQuery = z.infer<typeof agentTraceListQuerySchema>;
export type AgentTraceSummaryQuery = z.infer<typeof agentTraceSummaryQuerySchema>;
export type AgentTraceListResponse = z.infer<typeof agentTraceListResponseSchema>;
export type AgentTraceDetailResponse = z.infer<
  typeof agentTraceDetailResponseSchema
>;
export type AgentTraceSummaryResponse = z.infer<
  typeof agentTraceSummaryResponseSchema
>;
