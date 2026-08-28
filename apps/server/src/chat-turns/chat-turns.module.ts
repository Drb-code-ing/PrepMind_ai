import { Module } from '@nestjs/common';

import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { DatabaseModule } from '../database/database.module';
import { OutboxModule } from '../outbox/outbox.module';
import { ChatTurnEnqueueService } from './chat-turn-enqueue.service';
import { ChatTurnsRepository } from './chat-turns.repository';

@Module({
  imports: [BackgroundJobsModule, DatabaseModule, OutboxModule],
  providers: [ChatTurnsRepository, ChatTurnEnqueueService],
  exports: [ChatTurnsRepository, ChatTurnEnqueueService],
})
export class ChatTurnsModule {}
