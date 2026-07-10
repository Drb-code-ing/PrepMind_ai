import { z } from 'zod';

import { operatorAuditActionSchema, operatorAuditStatusSchema } from './operator-audit';

const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const nullableDateTimeSchema = z.string().datetime().nullable();

export const operatorAuditExportStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
  'EXPIRED',
]);

export const operatorAuditExportCreateRequestSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().trim().min(3).max(240),
    action: operatorAuditActionSchema.optional(),
    status: operatorAuditStatusSchema.optional(),
    targetType: z.string().trim().min(1).max(120).optional(),
    targetId: z.string().trim().min(1).max(200).optional(),
    actorUserId: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.startAt) >= Date.parse(value.endAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endAt'],
        message: 'endAt must be later than startAt',
      });
    }
  });

export const operatorAuditExportFiltersSchema = z
  .object({
    action: operatorAuditActionSchema.nullable(),
    status: operatorAuditStatusSchema.nullable(),
    targetType: z.string().min(1).nullable(),
    targetId: z.string().min(1).nullable(),
    actorUserId: z.string().min(1).nullable(),
  })
  .strict();

export const operatorAuditExportDetailResponseSchema = z
  .object({
    id: z.string().min(1),
    requestedByUserId: z.string().min(1).nullable(),
    backgroundJobId: z.string().min(1),
    status: operatorAuditExportStatusSchema,
    filters: operatorAuditExportFiltersSchema,
    reason: z.string().min(1),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    snapshotAt: z.string().datetime(),
    fileName: z.string().min(1).nullable(),
    archiveSize: z.number().int().min(0).nullable(),
    recordCount: z.number().int().min(0).nullable(),
    csvSha256: sha256Schema.nullable(),
    archiveSha256: sha256Schema.nullable(),
    schemaVersion: z.number().int().positive(),
    errorCode: z.string().min(1).nullable(),
    errorPreview: z.string().min(1).nullable(),
    requestedAt: z.string().datetime(),
    startedAt: nullableDateTimeSchema,
    completedAt: nullableDateTimeSchema,
    expiresAt: nullableDateTimeSchema,
    expiredAt: nullableDateTimeSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    canDownload: z.boolean(),
  })
  .strict();

export const operatorAuditExportListItemSchema = operatorAuditExportDetailResponseSchema;

export const operatorAuditExportListQuerySchema = z
  .object({
    status: operatorAuditExportStatusSchema.optional(),
    requestedByUserId: z.string().trim().min(1).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.createdFrom &&
      value.createdTo &&
      Date.parse(value.createdFrom) > Date.parse(value.createdTo)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['createdTo'],
        message: 'createdTo must not be earlier than createdFrom',
      });
    }
  });

export const operatorAuditExportListResponseSchema = z
  .object({
    items: z.array(operatorAuditExportListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export type OperatorAuditExportStatus = z.infer<typeof operatorAuditExportStatusSchema>;
export type OperatorAuditExportCreateRequest = z.infer<
  typeof operatorAuditExportCreateRequestSchema
>;
export type OperatorAuditExportDetailResponse = z.infer<
  typeof operatorAuditExportDetailResponseSchema
>;
export type OperatorAuditExportListItem = z.infer<typeof operatorAuditExportListItemSchema>;
export type OperatorAuditExportListQuery = z.infer<typeof operatorAuditExportListQuerySchema>;
export type OperatorAuditExportListResponse = z.infer<typeof operatorAuditExportListResponseSchema>;
