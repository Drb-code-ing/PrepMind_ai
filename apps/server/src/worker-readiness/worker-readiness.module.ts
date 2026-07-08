import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import type { ServerEnv } from '../config/env';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxMetricsService } from '../outbox/outbox-metrics.service';
import {
  WorkerReadinessController,
  WorkerReadinessEnabledGuard,
} from './worker-readiness.controller';
import { WorkerReadinessService } from './worker-readiness.service';

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  controllers: [WorkerReadinessController],
  providers: [
    WorkerReadinessEnabledGuard,
    {
      provide: WorkerReadinessService,
      inject: [
        getQueueToken(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        OutboxMetricsService,
        ConfigService,
      ],
      useFactory: (
        queue: Queue,
        outbox: OutboxMetricsService,
        config: ConfigService<ServerEnv, true>,
      ) => new WorkerReadinessService(queue, outbox, config),
    },
  ],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessModule {}
