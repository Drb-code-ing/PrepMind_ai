import { z } from 'zod';

export const operatorAuditActionSchema = z.enum(['OUTBOX_REQUEUE']);

export const operatorAuditStatusSchema = z.enum(['SUCCEEDED', 'FAILED']);

export const operatorAuditLogListQuerySchema = z.object({
  action: operatorAuditActionSchema.optional(),
  status: operatorAuditStatusSchema.optional(),
  targetType: z.string().trim().min(1).max(120).optional(),
  targetId: z.string().trim().min(1).max(200).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export const operatorAuditLogListItemSchema = z
  .object({
    id: z.string().min(1),
    actorUserId: z.string().min(1).nullable(),
    action: operatorAuditActionSchema,
    status: operatorAuditStatusSchema,
    targetType: z.string().min(1),
    targetId: z.string().min(1).nullable(),
    reason: z.string().min(1).nullable(),
    requestId: z.string().min(1).nullable(),
    ipAddressHash: z.string().min(1).nullable(),
    userAgentHash: z.string().min(1).nullable(),
    errorCode: z.string().min(1).nullable(),
    errorPreview: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const operatorAuditLogListResponseSchema = z
  .object({
    items: z.array(operatorAuditLogListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const operatorAuditLogDetailResponseSchema =
  operatorAuditLogListItemSchema;

export type OperatorAuditAction = z.infer<typeof operatorAuditActionSchema>;
export type OperatorAuditStatus = z.infer<typeof operatorAuditStatusSchema>;
export type OperatorAuditLogListQuery = z.infer<
  typeof operatorAuditLogListQuerySchema
>;
export type OperatorAuditLogListItem = z.infer<
  typeof operatorAuditLogListItemSchema
>;
export type OperatorAuditLogListResponse = z.infer<
  typeof operatorAuditLogListResponseSchema
>;
export type OperatorAuditLogDetailResponse = z.infer<
  typeof operatorAuditLogDetailResponseSchema
>;
