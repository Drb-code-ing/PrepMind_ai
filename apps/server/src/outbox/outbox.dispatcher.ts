import { Inject, Injectable } from '@nestjs/common';

import {
  OUTBOX_HANDLERS,
  OutboxHandlerError,
  type OutboxEventHandler,
  type OutboxEventLike,
} from './outbox.handlers';
import { OutboxService } from './outbox.service';

export type DispatchOutboxBatchInput = {
  workerId: string;
  limit?: number;
  now?: Date;
  lockTimeoutMs?: number;
};

export type DispatchOutboxBatchResult = {
  claimed: number;
  succeeded: number;
  failed: number;
};

@Injectable()
export class OutboxDispatcherService {
  constructor(
    private readonly outboxService: OutboxService,
    @Inject(OUTBOX_HANDLERS)
    private readonly handlers: Record<string, OutboxEventHandler>,
  ) {}

  async dispatchBatch(
    input: DispatchOutboxBatchInput,
  ): Promise<DispatchOutboxBatchResult> {
    const now = input.now ?? new Date();
    const events = await this.outboxService.claimPending({
      workerId: input.workerId,
      limit: input.limit ?? 10,
      now,
      lockTimeoutMs: input.lockTimeoutMs,
    });

    let succeeded = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await this.dispatchOne(event);
        const transitioned = await this.outboxService.markSucceeded(
          event.id,
          input.workerId,
        );
        if (transitioned) succeeded += 1;
      } catch (error) {
        const transitioned = await this.outboxService.markFailedOrRetry({
          id: event.id,
          workerId: input.workerId,
          errorCode: getOutboxErrorCode(error),
          error,
          now,
        });
        if (transitioned) failed += 1;
      }
    }

    return { claimed: events.length, succeeded, failed };
  }

  private async dispatchOne(event: OutboxEventLike) {
    const handler = this.handlers[event.type];
    if (!handler) {
      throw new OutboxHandlerError(
        'OUTBOX_HANDLER_NOT_FOUND',
        `No outbox handler registered for ${event.type}`,
      );
    }

    await handler(event);
  }
}

function getOutboxErrorCode(error: unknown) {
  if (error instanceof OutboxHandlerError) return error.code;
  return 'OUTBOX_HANDLER_FAILED';
}
