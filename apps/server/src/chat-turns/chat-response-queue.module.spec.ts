import { Injectable, Module } from '@nestjs/common';
import { BullModule, getQueueToken, InjectQueue } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';

import { CHAT_RESPONSE_QUEUE } from './chat-turn.constants';
import { ChatResponseQueueModule } from './chat-response-queue.module';

@Injectable()
class QueueProbe {
  constructor(@InjectQueue(CHAT_RESPONSE_QUEUE) readonly queue: Queue) {}
}

@Module({
  imports: [ChatResponseQueueModule],
  providers: [QueueProbe],
  exports: [QueueProbe],
})
class QueueProbeModule {}

describe('ChatResponseQueueModule', () => {
  it('shares one queue provider when imported by bridge and worker modules', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({
          connection: { host: '127.0.0.1', port: 63999 },
          prefix: 'chat-response-module-test',
        }),
        ChatResponseQueueModule,
        QueueProbeModule,
      ],
    }).compile();

    try {
      const direct = moduleRef.get<Queue>(getQueueToken(CHAT_RESPONSE_QUEUE));
      const throughProbe = moduleRef.get(QueueProbe).queue;

      expect(throughProbe).toBe(direct);
      expect(direct.name).toBe(CHAT_RESPONSE_QUEUE);
    } finally {
      await moduleRef.close();
    }
  });
});
