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
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
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
        BackgroundJobsService,
        OutboxMetricsService,
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        backgroundJobs: BackgroundJobsService,
        outbox: OutboxMetricsService,
        config: ConfigService<ServerEnv, true>,
      ) =>
        new WorkerObservabilityService(queue, backgroundJobs, outbox, config),
    },
  ],
})
export class WorkerObservabilityModule {}
