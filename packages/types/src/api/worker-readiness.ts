import { z } from 'zod';

export const workerReadinessOverallStatusSchema = z.enum([
  'ready',
  'degraded',
  'not_ready',
]);

export const workerReadinessCheckStatusSchema = z.enum([
  'pass',
  'warn',
  'fail',
]);

export const workerReadinessServerRoleSchema = z.enum([
  'api',
  'worker',
  'both',
]);

export const workerReadinessKnowledgeProcessingModeSchema = z.enum([
  'inline',
  'queue',
]);

export const workerReadinessQueueCountsSchema = z
  .object({
    waiting: z.number().int().min(0),
    active: z.number().int().min(0),
    delayed: z.number().int().min(0),
    completed: z.number().int().min(0),
    failed: z.number().int().min(0),
    paused: z.number().int().min(0),
  })
  .strict();

export const workerReadinessResponseSchema = z
  .object({
    ready: z.boolean(),
    status: workerReadinessOverallStatusSchema,
    checkedAt: z.string().datetime(),
    server: z
      .object({
        role: workerReadinessServerRoleSchema,
        knowledgeProcessingMode: workerReadinessKnowledgeProcessingModeSchema,
      })
      .strict(),
    checks: z
      .object({
        redis: z
          .object({
            status: workerReadinessCheckStatusSchema,
          })
          .strict(),
        queue: z
          .object({
            status: workerReadinessCheckStatusSchema,
            counts: workerReadinessQueueCountsSchema,
            isPaused: z.boolean(),
            hasBacklog: z.boolean(),
          })
          .strict(),
        workers: z
          .object({
            status: workerReadinessCheckStatusSchema,
            onlineCount: z.number().int().min(0),
            latestHeartbeatAt: z.string().datetime().nullable(),
          })
          .strict(),
        outbox: z
          .object({
            status: workerReadinessCheckStatusSchema,
            deadCount: z.number().int().min(0),
            hasBacklog: z.boolean(),
            oldestPendingAgeMs: z.number().int().min(0).nullable(),
          })
          .strict(),
      })
      .strict(),
    issues: z.array(z.string().min(1)),
  })
  .strict();

export type WorkerReadinessOverallStatus = z.infer<
  typeof workerReadinessOverallStatusSchema
>;
export type WorkerReadinessCheckStatus = z.infer<
  typeof workerReadinessCheckStatusSchema
>;
export type WorkerReadinessResponse = z.infer<
  typeof workerReadinessResponseSchema
>;
