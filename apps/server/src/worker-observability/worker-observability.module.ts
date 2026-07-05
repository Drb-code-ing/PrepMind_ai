import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WorkerObservabilityController } from './worker-observability.controller';
import { WorkerObservabilityService } from './worker-observability.service';

@Module({
  imports: [
    AuthModule,
    BackgroundJobsModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  controllers: [WorkerObservabilityController],
  providers: [
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
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        backgroundJobs: BackgroundJobsService,
        config: ConfigService<ServerEnv, true>,
      ) => new WorkerObservabilityService(queue, backgroundJobs, config),
    },
  ],
})
export class WorkerObservabilityModule {}
