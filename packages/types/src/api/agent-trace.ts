import { z } from 'zod';

import { agentRouteSchema } from '@repo/types/api/agent';

export const agentTraceStatusSchema = z.enum(['running', 'completed', 'failed', 'degraded']);
export const agentTraceTerminalStatusSchema = z.enum(['completed', 'failed', 'degraded']);
export const agentTraceModeSchema = z.enum(['mock', 'live']);
export const agentTraceFinishReasonSchema = z.enum([
  'stop',
  'length',
  'content_filter',
  'failed',
  'aborted',
]);
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

export const createAgentTraceStepRequestSchema = agentTraceStepSchema
  .omit({
    id: true,
    runId: true,
    inputSummary: true,
    outputSummary: true,
    errorMessage: true,
  })
  .extend({
    inputSummary: z.string().max(2000),
    outputSummary: z.string().max(2000),
    errorMessage: z.string().max(2000).nullable(),
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
  modelCallId: z.string().min(1).max(128).nullable(),
  firstTokenLatencyMs: z.number().int().min(0).nullable(),
  finishReason: agentTraceFinishReasonSchema.nullable(),
  verifiedInputTokens: z.number().int().min(0).nullable(),
  verifiedOutputTokens: z.number().int().min(0).nullable(),
  priceProfile: z.string().min(1).max(128).nullable(),
  verifiedCostCny: z.number().min(0).nullable(),
  qualityAuthority: z.literal('none'),
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
    modelCallId: true,
    firstTokenLatencyMs: true,
    finishReason: true,
    verifiedInputTokens: true,
    verifiedOutputTokens: true,
    priceProfile: true,
    verifiedCostCny: true,
    qualityAuthority: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    runId: z.string().min(1).optional(),
    route: agentRouteSchema.nullable().optional(),
    status: agentTraceTerminalStatusSchema,
    inputPreview: z.string().max(2000).optional(),
    steps: z.array(createAgentTraceStepRequestSchema).max(20),
  });

const REALTIME_TRACE_IDENTITY_SCHEMA = z.object({
  runId: z.string().min(1).max(128),
  modelCallId: z.string().min(1).max(128),
});

const realtimeAgentTraceSummarySchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9_.=, -]+$/u);

export const realtimeAgentTraceStepRequestSchema = z
  .object({
    node: z.enum([
      'RouterAgent',
      'TutorAgent',
      'RetrieverQueryRewriteCandidate',
      'RetrieverAgent',
      'KnowledgeVerifierAgent',
      'EvidenceProjector',
      'FinalResponseAgent',
    ]),
    status: agentTraceStatusSchema,
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime().nullable(),
    durationMs: z.number().int().min(0).nullable(),
    inputSummary: realtimeAgentTraceSummarySchema,
    outputSummary: realtimeAgentTraceSummarySchema,
    errorMessage: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_]+$/u)
      .nullable(),
  })
  .strict();

export const agentTraceRealtimePreparationSchema = z
  .object({
    route: agentRouteSchema.nullable(),
    confidence: z.number().min(0).max(1),
    modelProvider: z.string().min(1).max(80),
    modelName: z.string().min(1).max(128),
    inputTokenEstimate: z.number().int().min(0),
    outputTokenEstimate: z.number().int().min(0),
    maxOutputTokens: z.number().int().min(0),
    pricingKnown: z.boolean(),
    costEstimate: z.number().min(0),
    ragHitCount: z.number().int().min(0),
    verifierStatus: agentTraceVerifierStatusSchema.optional(),
    verifierChunkCount: z.number().int().min(0),
    tutorIntent: z.string().min(1).max(80).optional(),
    tutorDepth: z.string().min(1).max(80).optional(),
    degraded: z.boolean(),
    preparedAt: z.string().datetime(),
    steps: z.array(realtimeAgentTraceStepRequestSchema).max(19),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.steps.some((step) => step.node === 'FinalResponseAgent')) {
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'running trace cannot contain a FinalResponse terminal step',
      });
    }
    if (new Set(value.steps.map((step) => step.node)).size !== value.steps.length) {
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'realtime preparation cannot contain duplicate step nodes',
      });
    }
    if (
      value.steps.some(
        (step) => step.status === 'running' || step.finishedAt === null || step.durationMs === null,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'realtime preparation steps must already be terminal',
      });
    }
  });

export const agentTraceRealtimeStartRequestSchema = REALTIME_TRACE_IDENTITY_SCHEMA.extend({
  conversationId: z.string().min(1).nullable(),
  mode: agentTraceModeSchema,
  startedAt: z.string().datetime(),
}).strict();

export const agentTraceRealtimePrepareRequestSchema = REALTIME_TRACE_IDENTITY_SCHEMA.extend({
  preparation: agentTraceRealtimePreparationSchema,
}).strict();

export const agentTraceRealtimeFinalizeRequestSchema = REALTIME_TRACE_IDENTITY_SCHEMA.extend({
  status: agentTraceTerminalStatusSchema,
  pricingKnown: z.boolean(),
  degraded: z.boolean(),
  finishedAt: z.string().datetime(),
  totalDurationMs: z.number().int().min(0),
  firstTokenLatencyMs: z.number().int().min(0).nullable(),
  finishReason: agentTraceFinishReasonSchema.nullable(),
  verifiedInputTokens: z.number().int().min(0).nullable(),
  verifiedOutputTokens: z.number().int().min(0).nullable(),
  priceProfile: z.string().min(1).max(128).nullable(),
  verifiedCostCny: z.number().min(0).nullable(),
  qualityAuthority: z.literal('none'),
  preparation: agentTraceRealtimePreparationSchema.optional(),
  steps: z.array(realtimeAgentTraceStepRequestSchema).max(20),
})
  .strict()
  .superRefine((value, context) => {
    if (value.firstTokenLatencyMs !== null && value.firstTokenLatencyMs > value.totalDurationMs) {
      context.addIssue({
        code: 'custom',
        path: ['firstTokenLatencyMs'],
        message: 'first token latency cannot exceed total duration',
      });
    }
    const usageFields = [
      value.verifiedInputTokens,
      value.verifiedOutputTokens,
      value.priceProfile,
      value.verifiedCostCny,
    ];
    const usageComplete = usageFields.every((field) => field !== null);
    const usageEmpty = usageFields.every((field) => field === null);
    if (!usageComplete && !usageEmpty) {
      context.addIssue({
        code: 'custom',
        path: ['verifiedInputTokens'],
        message: 'verified usage attribution must be complete or empty',
      });
    }
    const successfulTerminal = value.status === 'completed' || value.status === 'degraded';
    if (successfulTerminal) {
      if (
        value.finishReason === null ||
        value.finishReason === 'failed' ||
        value.finishReason === 'aborted' ||
        !usageComplete ||
        !value.pricingKnown ||
        value.degraded !== (value.status === 'degraded')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'successful terminal requires coherent finish, usage, pricing, and status',
        });
      }
    } else {
      if (
        !usageEmpty ||
        value.pricingKnown ||
        (value.finishReason !== 'failed' && value.finishReason !== 'aborted') ||
        !value.degraded
      ) {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'failed terminal requires empty usage and a failure finish reason',
        });
      }
    }
    const finalResponseSteps = value.steps.filter((step) => step.node === 'FinalResponseAgent');
    if (successfulTerminal) {
      if (value.preparation === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['preparation'],
          message: 'successful terminal requires a preparation snapshot',
        });
      }
      if (
        finalResponseSteps.length !== 1 ||
        finalResponseSteps[0]?.finishedAt === null ||
        finalResponseSteps[0]?.durationMs === null ||
        finalResponseSteps[0]?.status !== 'completed'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['steps'],
          message: 'successful terminal requires exactly one completed FinalResponse step',
        });
      }
      if (value.preparation !== undefined && value.degraded !== value.preparation.degraded) {
        context.addIssue({
          code: 'custom',
          path: ['degraded'],
          message: 'successful terminal must preserve preparation degradation',
        });
      }
    } else if (value.preparation === undefined) {
      if (value.steps.length !== 0) {
        context.addIssue({
          code: 'custom',
          path: ['steps'],
          message: 'unprepared failure cannot claim any Agent step',
        });
      }
    } else if (
      finalResponseSteps.length > 1 ||
      finalResponseSteps.some(
        (step) => step.status !== 'failed' || step.finishedAt === null || step.durationMs === null,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'prepared failure may contain at most one failed FinalResponse step',
      });
    }

    if (
      value.preparation !== undefined &&
      !traceStepMultisetContains(value.steps, value.preparation.steps)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['steps'],
        message: 'terminal steps must contain the exact preparation steps',
      });
    }
    if (value.preparation !== undefined) {
      const expectedLength =
        value.preparation.steps.length + (finalResponseSteps.length === 1 ? 1 : 0);
      if (value.steps.length !== expectedLength) {
        context.addIssue({
          code: 'custom',
          path: ['steps'],
          message: 'terminal steps cannot add claims outside preparation and FinalResponse',
        });
      }
    }
  });

function traceStepMultisetContains(
  candidate: readonly z.infer<typeof realtimeAgentTraceStepRequestSchema>[],
  required: readonly z.infer<typeof realtimeAgentTraceStepRequestSchema>[],
) {
  const counts = new Map<string, number>();
  for (const step of candidate) {
    const key = JSON.stringify(step);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const step of required) {
    const key = JSON.stringify(step);
    const count = counts.get(key) ?? 0;
    if (count === 0) return false;
    counts.set(key, count - 1);
  }
  return true;
}

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
  runningRuns: z.number().int().min(0),
  liveRuns: z.number().int().min(0),
  mockRuns: z.number().int().min(0),
  degradedRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  totalCostEstimate: z.number().min(0),
  verifiedUsageRuns: z.number().int().min(0),
  totalVerifiedInputTokens: z.number().int().min(0),
  totalVerifiedOutputTokens: z.number().int().min(0),
  totalVerifiedCostCny: z.number().min(0),
  lastRunAt: z.string().datetime().nullable(),
  routeBreakdown: z.array(z.object({ route: agentRouteSchema, count: z.number().int().min(0) })),
  verifierBreakdown: z.array(
    z.object({
      status: agentTraceVerifierStatusSchema,
      count: z.number().int().min(0),
    }),
  ),
});

export type AgentTraceStatus = z.infer<typeof agentTraceStatusSchema>;
export type AgentTraceTerminalStatus = z.infer<typeof agentTraceTerminalStatusSchema>;
export type AgentTraceMode = z.infer<typeof agentTraceModeSchema>;
export type AgentTraceFinishReason = z.infer<typeof agentTraceFinishReasonSchema>;
export type AgentTraceVerifierStatus = z.infer<typeof agentTraceVerifierStatusSchema>;
export type AgentTraceRun = z.infer<typeof agentTraceRunSchema>;
export type AgentTraceStep = z.infer<typeof agentTraceStepSchema>;
export type CreateAgentTraceStepRequest = z.infer<typeof createAgentTraceStepRequestSchema>;
export type AgentTraceCreateRequest = z.infer<typeof agentTraceCreateRequestSchema>;
export type AgentTraceRealtimeStartRequest = z.infer<typeof agentTraceRealtimeStartRequestSchema>;
export type RealtimeAgentTraceStepRequest = z.infer<typeof realtimeAgentTraceStepRequestSchema>;
export type AgentTraceRealtimePreparation = z.infer<typeof agentTraceRealtimePreparationSchema>;
export type AgentTraceRealtimePrepareRequest = z.infer<
  typeof agentTraceRealtimePrepareRequestSchema
>;
export type AgentTraceRealtimeFinalizeRequest = z.infer<
  typeof agentTraceRealtimeFinalizeRequestSchema
>;
export type AgentTraceListQuery = z.infer<typeof agentTraceListQuerySchema>;
export type AgentTraceSummaryQuery = z.infer<typeof agentTraceSummaryQuerySchema>;
export type AgentTraceListResponse = z.infer<typeof agentTraceListResponseSchema>;
export type AgentTraceDetailResponse = z.infer<typeof agentTraceDetailResponseSchema>;
export type AgentTraceSummaryResponse = z.infer<typeof agentTraceSummaryResponseSchema>;
