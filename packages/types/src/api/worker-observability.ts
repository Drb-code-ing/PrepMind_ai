import { z } from 'zod';

import { backgroundJobSummaryResponseSchema } from '@repo/types/api/background-job';

export const workerObservabilityServerRoleSchema = z.enum([
  'api',
  'worker',
  'both',
]);

export const workerObservabilityProcessingModeSchema = z.enum([
  'inline',
  'queue',
]);

export const workerObservabilityStatusSchema = z.enum([
  'healthy',
  'degraded',
  'attention',
  'idle',
]);

export const workerHeartbeatResponseSchema = z.object({
  workerId: z.string().min(1),
  serverRole: z.enum(['worker', 'both']),
  queues: z.array(z.string().min(1)),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});

export const workerObservabilityQueueCountsSchema = z.object({
  waiting: z.number().int().min(0),
  active: z.number().int().min(0),
  delayed: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  paused: z.number().int().min(0),
});

export const workerObservabilitySummaryResponseSchema = z.object({
  server: z.object({
    role: workerObservabilityServerRoleSchema,
    knowledgeProcessingMode: workerObservabilityProcessingModeSchema,
  }),
  queue: z.object({
    name: z.literal('knowledge-document-processing'),
    counts: workerObservabilityQueueCountsSchema,
    isPaused: z.boolean(),
    hasBacklog: z.boolean(),
  }),
  workers: z.object({
    heartbeatTtlSeconds: z.number().int().min(1),
    onlineCount: z.number().int().min(0),
    latestHeartbeat: workerHeartbeatResponseSchema.nullable(),
  }),
  backgroundJobs: backgroundJobSummaryResponseSchema,
  signals: z.object({
    status: workerObservabilityStatusSchema,
    hasWorkerHeartbeat: z.boolean(),
    queueModeWithoutWorker: z.boolean(),
    queueBacklogWithoutWorker: z.boolean(),
    hasRecentFailures: z.boolean(),
    message: z.string().min(1),
  }),
});

export type WorkerHeartbeatResponse = z.infer<
  typeof workerHeartbeatResponseSchema
>;
export type WorkerObservabilitySummaryResponse = z.infer<
  typeof workerObservabilitySummaryResponseSchema
>;
export type WorkerObservabilityStatus = z.infer<
  typeof workerObservabilityStatusSchema
>;
