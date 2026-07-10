import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
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
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import {
  WorkerObservabilityController,
  WorkerObservabilityEnabledGuard,
} from './worker-observability.controller';
import { WorkerObservabilityService } from './worker-observability.service';

@Module({
  imports: [
    AuthModule,
    BackgroundJobsModule,
    OutboxModule,
    DatabaseModule,
    BullModule.registerQueue(
      { name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE },
      { name: OPERATOR_AUDIT_EXPORT_QUEUE },
      { name: OPERATOR_AUDIT_MAINTENANCE_QUEUE },
    ),
  ],
  controllers: [WorkerObservabilityController],
  providers: [
    WorkerObservabilityEnabledGuard,
    {
      provide: WorkerHeartbeatService,
      inject: [getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE), ConfigService],
      useFactory: (queue: Queue, config: ConfigService<ServerEnv, true>) =>
        new WorkerHeartbeatService(queue, config),
    },
    {
      provide: WorkerObservabilityService,
      inject: [
        getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        getQueueToken(OPERATOR_AUDIT_EXPORT_QUEUE),
        getQueueToken(OPERATOR_AUDIT_MAINTENANCE_QUEUE),
        BackgroundJobsService,
        OutboxMetricsService,
        PrismaService,
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        auditExportQueue: Queue,
        auditMaintenanceQueue: Queue,
        backgroundJobs: BackgroundJobsService,
        outbox: OutboxMetricsService,
        prisma: PrismaService,
        config: ConfigService<ServerEnv, true>,
      ) =>
        new WorkerObservabilityService(
          queue,
          auditExportQueue,
          auditMaintenanceQueue,
          backgroundJobs,
          outbox,
          prisma,
          config,
        ),
    },
  ],
})
export class WorkerObservabilityModule {}
