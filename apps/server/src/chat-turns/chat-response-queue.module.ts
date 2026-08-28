import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { CHAT_RESPONSE_QUEUE } from './chat-turn.constants';

/**
 * Owns the single BullMQ queue provider shared by the outbox bridge and the
 * worker processor. Keeping registration in one module avoids duplicate Queue
 * instances and duplicate Redis connections in the Nest module graph.
 */
@Module({
  imports: [BullModule.registerQueue({ name: CHAT_RESPONSE_QUEUE })],
  exports: [BullModule],
})
export class ChatResponseQueueModule {}
