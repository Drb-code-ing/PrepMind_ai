import { z } from 'zod';

export const OPERATOR_AUDIT_EXPORT_QUEUE = 'operator-audit-export';
export const GENERATE_OPERATOR_AUDIT_EXPORT_JOB =
  'generate-operator-audit-export';
export const OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT =
  'operator.audit.export.requested';
export const OPERATOR_AUDIT_RETENTION_LOCK =
  'prepmind:operator-audit-retention';
export const OPERATOR_AUDIT_EXPORT_QUOTA_LOCK =
  'prepmind:operator-audit-export-quota';
export const OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE = 'OPERATOR_AUDIT_EXPORT';

export const operatorAuditExportRequestedPayloadSchema = z
  .object({
    exportId: z.string().min(1),
    backgroundJobId: z.string().min(1),
  })
  .strict();

export type OperatorAuditExportRequestedPayload = z.infer<
  typeof operatorAuditExportRequestedPayloadSchema
>;
