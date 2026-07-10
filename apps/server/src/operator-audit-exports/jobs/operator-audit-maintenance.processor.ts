import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';

import { OperatorAuditMaintenanceService } from '../operator-audit-maintenance.service';
import { OPERATOR_AUDIT_MAINTENANCE_QUEUE } from '../operator-audit-export.constants';

export const operatorAuditMaintenancePayloadSchema = z
  .object({ schemaVersion: z.literal(1) })
  .strict();

@Processor(OPERATOR_AUDIT_MAINTENANCE_QUEUE, { concurrency: 1 })
export class OperatorAuditMaintenanceProcessor extends WorkerHost {
  constructor(private readonly maintenance: OperatorAuditMaintenanceService) {
    super();
  }

  async process(job: Job<unknown>) {
    const parsed = operatorAuditMaintenancePayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      job.discard();
      throw new Error('Operator audit maintenance payload is invalid');
    }
    return this.maintenance.run();
  }
}
