import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkerReadinessController } from './worker-readiness.controller';
import { WorkerReadinessService } from './worker-readiness.service';

@Module({
  imports: [
    AuthModule,
    OutboxModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  controllers: [WorkerReadinessController],
  providers: [WorkerReadinessService],
  exports: [WorkerReadinessService],
})
export class WorkerReadinessModule {}
