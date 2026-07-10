import { z } from 'zod';

import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
} from '../operator-audit-export.constants';

export { GENERATE_OPERATOR_AUDIT_EXPORT_JOB, OPERATOR_AUDIT_EXPORT_QUEUE };

export const generateOperatorAuditExportPayloadSchema = z
  .object({
    exportId: z.string().min(1),
    backgroundJobId: z.string().min(1),
  })
  .strict();

export type GenerateOperatorAuditExportPayload = z.infer<
  typeof generateOperatorAuditExportPayloadSchema
>;
