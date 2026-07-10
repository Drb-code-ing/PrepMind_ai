import { z } from 'zod';

import { backgroundJobSummaryResponseSchema } from '@repo/types/api/background-job';

export const workerObservabilityServerRoleSchema = z.enum(['api', 'worker', 'both']);

export const workerObservabilityProcessingModeSchema = z.enum(['inline', 'queue']);

export const workerObservabilityStatusSchema = z.enum(['healthy', 'degraded', 'attention', 'idle']);

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

const workerObservabilityQueueSchema = z.object({
  name: z.enum([
    'knowledge-document-processing',
    'operator-audit-export',
    'operator-audit-maintenance',
  ]),
  counts: workerObservabilityQueueCountsSchema,
  isPaused: z.boolean(),
  hasBacklog: z.boolean(),
});

const workerObservabilityAuditMaintenanceSchema = z.object({
  status: z.enum(['pass', 'warn', 'fail']),
  message: z.string().min(1),
  enabled: z.boolean(),
  lastSucceededAt: z.string().datetime().nullable(),
  overdue: z.boolean(),
});

export const workerObservabilityOutboxStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'FAILED',
  'DEAD',
]);

export const workerObservabilityOutboxCountsSchema = z.object({
  pending: z.number().int().min(0),
  processing: z.number().int().min(0),
  succeeded: z.number().int().min(0),
  failed: z.number().int().min(0),
  dead: z.number().int().min(0),
  total: z.number().int().min(0),
});

export const workerObservabilityOutboxRecentErrorSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: workerObservabilityOutboxStatusSchema,
  lastErrorCode: z.string().min(1).nullable(),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  updatedAt: z.string().datetime(),
});

export const workerObservabilityOutboxSummarySchema = z.object({
  counts: workerObservabilityOutboxCountsSchema,
  hasBacklog: z.boolean(),
  oldestPendingAgeMs: z.number().int().min(0).nullable(),
  recentErrors: z.array(workerObservabilityOutboxRecentErrorSchema),
});

export const workerObservabilitySummaryResponseSchema = z.object({
  server: z.object({
    role: workerObservabilityServerRoleSchema,
    knowledgeProcessingMode: workerObservabilityProcessingModeSchema,
  }),
  queue: workerObservabilityQueueSchema.extend({
    name: z.literal('knowledge-document-processing'),
  }),
  auditExportQueue: workerObservabilityQueueSchema.extend({
    name: z.literal('operator-audit-export'),
  }),
  auditMaintenanceQueue: workerObservabilityQueueSchema.extend({
    name: z.literal('operator-audit-maintenance'),
  }),
  auditMaintenance: workerObservabilityAuditMaintenanceSchema,
  workers: z.object({
    heartbeatTtlSeconds: z.number().int().min(1),
    onlineCount: z.number().int().min(0),
    latestHeartbeat: workerHeartbeatResponseSchema.nullable(),
  }),
  backgroundJobs: backgroundJobSummaryResponseSchema,
  outbox: workerObservabilityOutboxSummarySchema,
  signals: z.object({
    status: workerObservabilityStatusSchema,
    hasWorkerHeartbeat: z.boolean(),
    queueModeWithoutWorker: z.boolean(),
    queueBacklogWithoutWorker: z.boolean(),
    hasRecentFailures: z.boolean(),
    hasOutboxBacklog: z.boolean(),
    hasDeadOutboxEvents: z.boolean(),
    message: z.string().min(1),
  }),
});

export type WorkerHeartbeatResponse = z.infer<typeof workerHeartbeatResponseSchema>;
export type WorkerObservabilitySummaryResponse = z.infer<
  typeof workerObservabilitySummaryResponseSchema
>;
export type WorkerObservabilityOutboxSummary = z.infer<
  typeof workerObservabilityOutboxSummarySchema
>;
export type WorkerObservabilityStatus = z.infer<typeof workerObservabilityStatusSchema>;
