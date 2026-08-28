import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { CHAT_RESPONSE_QUEUE } from './chat-response.job';
import {
  resolveChatResponseWorkerConcurrency,
  resolveChatResponseWorkerLockDuration,
} from './chat-response-worker.config';
import { ChatResponseWorkerService } from './chat-response-worker.service';

@Processor(CHAT_RESPONSE_QUEUE, {
  concurrency: resolveChatResponseWorkerConcurrency(),
  lockDuration: resolveChatResponseWorkerLockDuration(),
})
export class ChatResponseProcessor extends WorkerHost {
  constructor(private readonly responseWorker: ChatResponseWorkerService) {
    super();
  }

  process(job: Job<unknown>): Promise<void> {
    return this.responseWorker.process(job);
  }
}
