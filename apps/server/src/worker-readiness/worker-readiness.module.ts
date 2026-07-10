import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxMetricsService } from '../outbox/outbox-metrics.service';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
} from '../operator-audit-exports/operator-audit-export.constants';
import {
  WorkerReadinessController,
  WorkerReadinessEnabledGuard,
} from './worker-readiness.controller';
import { WorkerReadinessService } from './worker-readiness.service';

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    DatabaseModule,
    BullModule.registerQueue(
      { name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE },
      { name: OPERATOR_AUDIT_EXPORT_QUEUE },
      { name: OPERATOR_AUDIT_MAINTENANCE_QUEUE },
    ),
  ],
  controllers: [WorkerReadinessController],
  providers: [
    WorkerReadinessEnabledGuard,
    {
      provide: WorkerReadinessService,
      inject: [
        getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        getQueueToken(OPERATOR_AUDIT_EXPORT_QUEUE),
        getQueueToken(OPERATOR_AUDIT_MAINTENANCE_QUEUE),
        OutboxMetricsService,
        PrismaService,
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        auditExportQueue: Queue,
        auditMaintenanceQueue: Queue,
        outbox: OutboxMetricsService,
        prisma: PrismaService,
        config: ConfigService<ServerEnv, true>,
      ) =>
        new WorkerReadinessService(
          queue,
          auditExportQueue,
          auditMaintenanceQueue,
          outbox,
          prisma,
          config,
        ),
    },
  ],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessModule {}
