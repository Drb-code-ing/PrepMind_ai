import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  MAINTAIN_OPERATOR_AUDIT_JOB,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_SCHEDULER,
} from '../operator-audit-export.constants';

@Injectable()
export class OperatorAuditMaintenanceScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(OPERATOR_AUDIT_MAINTENANCE_QUEUE)
    private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      OPERATOR_AUDIT_MAINTENANCE_SCHEDULER,
      { every: 3_600_000 },
      {
        name: MAINTAIN_OPERATOR_AUDIT_JOB,
        data: { schemaVersion: 1 },
        opts: {
          removeOnComplete: { age: 172800, count: 100 },
          removeOnFail: { age: 604800, count: 500 },
        },
      },
    );
  }
}
