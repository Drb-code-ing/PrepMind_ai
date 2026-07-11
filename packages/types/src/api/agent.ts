import { z } from 'zod';

export const agentRouteSchema = z.enum([
  'chat',
  'tutor',
  'rag_answer',
  'wrong_question_organize',
  'review_analysis',
  'study_plan',
  'memory_reflection',
  'knowledge_dedup',
]);

export const actionProposalTypeSchema = z.enum([
  'SAVE_MEMORY',
  'ORGANIZE_WRONG_QUESTION',
  'MERGE_WRONG_QUESTION_DECK',
  'CREATE_STUDY_PLAN',
  'REPLACE_KNOWLEDGE_DOCUMENT',
  'MERGE_KNOWLEDGE_DOCUMENT',
]);

export const actionProposalStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'expired',
]);

export const actionProposalSchema = z.object({
  id: z.string().min(1),
  type: actionProposalTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
  payload: z.record(z.unknown()),
  status: actionProposalStatusSchema,
  createdAt: z.string().datetime(),
});

export const agentAttachmentSchema = z.object({
  type: z.enum(['image', 'document']),
  url: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const agentMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const agentContextPolicySchema = z.object({
  recentMessageCount: z.number().int().safe().min(0),
  summaryIncluded: z.boolean(),
  droppedMessageCount: z.number().int().safe().min(0),
  estimatedTokenCount: z.number().int().safe().min(0),
  layerTokenCounts: z
    .object({
      mandatory: z.number().int().safe().min(0),
      agentGuidance: z.number().int().safe().min(0),
      stateGuidance: z.number().int().safe().min(0).default(0),
      activeStudy: z.number().int().safe().min(0),
      recentMessages: z.number().int().safe().min(0),
      rag: z.number().int().safe().min(0),
      summary: z.number().int().safe().min(0),
    })
    .strict()
    .optional(),
  droppedLayers: z
    .array(
      z.enum(['agentGuidance', 'stateGuidance', 'activeStudy', 'rag', 'summary']),
    )
    .max(5)
    .refine((layers) => new Set(layers).size === layers.length, 'droppedLayers must be unique')
    .optional(),
  summaryVersion: z.number().int().safe().positive().optional(),
  summaryStatus: z
    .enum(['not_needed', 'reused', 'generated', 'degraded', 'stale_snapshot', 'cas_conflict'])
    .optional(),
});

export const agentLoopControlSchema = z.object({
  stepCount: z.number().int().min(0),
  maxSteps: z.number().int().min(1).max(20),
  maxRepeatedTransition: z.number().int().min(1).max(5),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime().optional(),
  transitions: z.array(z.string()),
});

export const routerResultSchema = z.object({
  name: agentRouteSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  requiresRag: z.boolean(),
  requiresHumanApproval: z.boolean(),
});

export const ragContextSchema = z.object({
  query: z.string().min(1),
  chunks: z.array(
    z.object({
      documentId: z.string().min(1),
      documentTitle: z.string().min(1),
      chunkId: z.string().min(1),
      content: z.string().min(1),
      score: z.number().min(0).max(1),
    }),
  ),
});

export const verifierResultSchema = z.object({
  status: z.enum(['trusted', 'suspicious', 'conflict', 'insufficient', 'skipped']),
  reason: z.string().min(1),
  userNotice: z.string().min(1).optional(),
});

export const agentErrorSchema = z.object({
  node: z.string().min(1),
  message: z.string().min(1),
  recoverable: z.boolean(),
});

export const agentStateSchema = z.object({
  runId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  input: z.object({
    text: z.string(),
    attachments: z.array(agentAttachmentSchema).optional(),
  }),
  route: routerResultSchema.optional(),
  chatContext: z
    .object({
      recentMessages: z.array(agentMessageSchema),
      summaryBuffer: z.string().optional(),
      activeStudyContext: z.string().optional(),
      contextPolicy: agentContextPolicySchema.optional(),
    })
    .optional(),
  loopControl: agentLoopControlSchema.optional(),
  ragContext: ragContextSchema.optional(),
  verifierResult: verifierResultSchema.optional(),
  reviewContext: z
    .object({
      dueCount: z.number().int().min(0).optional(),
      overdueCount: z.number().int().min(0).optional(),
      weakKnowledgePoints: z.array(z.string()).optional(),
    })
    .optional(),
  proposals: z.array(actionProposalSchema),
  finalResponse: z
    .object({
      markdown: z.string(),
      citations: z
        .array(
          z.object({
            documentId: z.string().min(1),
            title: z.string().min(1),
            chunkId: z.string().min(1),
            score: z.number().min(0).max(1),
          }),
        )
        .optional(),
    })
    .optional(),
  errors: z.array(agentErrorSchema),
});

export const agentRunStatusSchema = z.enum(['running', 'completed', 'failed', 'degraded']);

export const agentRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1).nullable(),
  route: agentRouteSchema.nullable(),
  status: agentRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  totalDurationMs: z.number().int().min(0).nullable(),
  inputTokenEstimate: z.number().int().min(0),
  outputTokenEstimate: z.number().int().min(0),
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  costEstimate: z.number().min(0),
});

export const agentStepSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  node: z.string().min(1),
  status: agentRunStatusSchema,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().min(0).nullable(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  errorMessage: z.string().nullable(),
});

export const shouldUseLiveAgentModelSchema = z
  .object({
    providerMode: z.enum(['mock', 'live']),
    enableLiveCalls: z.boolean(),
    inputTokenBudget: z.number().int().min(1).max(5000),
    outputTokenBudget: z.number().int().min(1).max(2000),
  })
  .transform((value) => value.providerMode === 'live' && value.enableLiveCalls);

export type AgentRoute = z.infer<typeof agentRouteSchema>;
export type ActionProposalType = z.infer<typeof actionProposalTypeSchema>;
export type ActionProposalStatus = z.infer<typeof actionProposalStatusSchema>;
export type ActionProposal = z.infer<typeof actionProposalSchema>;
export type RouterResult = z.infer<typeof routerResultSchema>;
export type AgentContextPolicy = z.infer<typeof agentContextPolicySchema>;
export type AgentLoopControl = z.infer<typeof agentLoopControlSchema>;
export type AgentState = z.infer<typeof agentStateSchema>;
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
