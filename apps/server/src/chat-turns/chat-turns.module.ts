import { Module, type Provider } from '@nestjs/common';

import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { DatabaseModule } from '../database/database.module';
import type { ServerEnv } from '../config/env';
import { shouldRegisterWorkers } from '../jobs/worker-role';
import { OutboxModule } from '../outbox/outbox.module';
import { ChatResponseProcessor } from './chat-response.processor';
import { ChatResponseQueueModule } from './chat-response-queue.module';
import {
  CHAT_RESPONSE_GENERATOR,
  ChatResponseWorkerService,
  DeterministicChatResponseGenerator,
} from './chat-response-worker.service';
import { ChatTurnEnqueueService } from './chat-turn-enqueue.service';
import { ChatTurnsRepository } from './chat-turns.repository';

export function createChatResponseWorkerProviders(
  role: ServerEnv['SERVER_ROLE'],
): Provider[] {
  return shouldRegisterWorkers(role) ? [ChatResponseProcessor] : [];
}

const chatResponseWorkerProviders = createChatResponseWorkerProviders(
  (process.env.SERVER_ROLE ?? 'both') as ServerEnv['SERVER_ROLE'],
);

@Module({
  imports: [
    BackgroundJobsModule,
    DatabaseModule,
    OutboxModule,
    ChatResponseQueueModule,
  ],
  providers: [
    ChatTurnsRepository,
    ChatTurnEnqueueService,
    ChatResponseWorkerService,
    DeterministicChatResponseGenerator,
    {
      provide: CHAT_RESPONSE_GENERATOR,
      useExisting: DeterministicChatResponseGenerator,
    },
    ...chatResponseWorkerProviders,
  ],
  exports: [ChatTurnsRepository, ChatTurnEnqueueService],
})
export class ChatTurnsModule {}
