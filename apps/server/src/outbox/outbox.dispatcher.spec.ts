import { OutboxDispatcherService } from './outbox.dispatcher';
import { OutboxHandlerError, type OutboxEventHandler } from './outbox.handlers';

describe('OutboxDispatcherService', () => {
  const now = new Date('2026-07-07T01:00:00.000Z');
  const outbox = {
    claimPending: jest.fn(),
    markSucceeded: jest.fn(),
    markFailedOrRetry: jest.fn(),
  };
  const handler = jest.fn<
    ReturnType<OutboxEventHandler>,
    Parameters<OutboxEventHandler>
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    handler.mockResolvedValue(undefined);
  });

  it('returns an empty result when no events are claimed', async () => {
    outbox.claimPending.mockResolvedValue([]);

    const result = await createService().dispatchBatch({
      workerId: 'worker_1',
      now,
    });

    expect(outbox.claimPending).toHaveBeenCalledWith({
      workerId: 'worker_1',
      limit: 10,
      now,
      lockTimeoutMs: undefined,
    });
    expect(result).toEqual({ claimed: 0, succeeded: 0, failed: 0 });
  });

  it('marks an event succeeded when its handler resolves', async () => {
    outbox.claimPending.mockResolvedValue([event('evt_1', 'known.type')]);
    outbox.markSucceeded.mockResolvedValue({
      id: 'evt_1',
      status: 'SUCCEEDED',
    });

    const result = await createService({ 'known.type': handler }).dispatchBatch(
      {
        workerId: 'worker_1',
        limit: 5,
        now,
      },
    );

    expect(handler).toHaveBeenCalledWith(event('evt_1', 'known.type'));
    expect(outbox.markSucceeded).toHaveBeenCalledWith('evt_1', 'worker_1');
    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
  });

  it('marks an event failed or retry when its handler throws', async () => {
    const error = new Error('handler boom');
    handler.mockRejectedValue(error);
    outbox.claimPending.mockResolvedValue([event('evt_1', 'known.type')]);
    outbox.markFailedOrRetry.mockResolvedValue({
      id: 'evt_1',
      status: 'PENDING',
    });

    const result = await createService({ 'known.type': handler }).dispatchBatch(
      {
        workerId: 'worker_1',
        now,
      },
    );

    expect(outbox.markFailedOrRetry).toHaveBeenCalledWith({
      id: 'evt_1',
      workerId: 'worker_1',
      errorCode: 'OUTBOX_HANDLER_FAILED',
      error,
      now,
    });
    expect(result).toEqual({ claimed: 1, succeeded: 0, failed: 1 });
  });

  it('marks an unknown event type failed or retry', async () => {
    outbox.claimPending.mockResolvedValue([event('evt_1', 'unknown.type')]);

    const result = await createService().dispatchBatch({
      workerId: 'worker_1',
      now,
    });

    expect(outbox.markFailedOrRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt_1',
        errorCode: 'OUTBOX_HANDLER_NOT_FOUND',
      }),
    );
    expect(result.failed).toBe(1);
  });

  it('continues dispatching after one event fails', async () => {
    const failingHandler = jest
      .fn<ReturnType<OutboxEventHandler>, Parameters<OutboxEventHandler>>()
      .mockRejectedValue(
        new OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', 'bad'),
      );
    const succeedingHandler = jest
      .fn<ReturnType<OutboxEventHandler>, Parameters<OutboxEventHandler>>()
      .mockResolvedValue(undefined);
    outbox.claimPending.mockResolvedValue([
      event('evt_1', 'bad.type'),
      event('evt_2', 'good.type'),
    ]);

    const result = await createService({
      'bad.type': failingHandler,
      'good.type': succeedingHandler,
    }).dispatchBatch({ workerId: 'worker_1', now });

    expect(outbox.markFailedOrRetry).toHaveBeenCalledTimes(1);
    expect(outbox.markSucceeded).toHaveBeenCalledWith('evt_2', 'worker_1');
    expect(result).toEqual({ claimed: 2, succeeded: 1, failed: 1 });
  });

  function createService(handlers: Record<string, OutboxEventHandler> = {}) {
    return new OutboxDispatcherService(outbox as never, handlers);
  }

  function event(id: string, type: string) {
    return {
      id,
      type,
      payload: {
        userId: 'user_1',
        documentId: 'doc_1',
        backgroundJobId: 'job_1',
        force: false,
      },
    };
  }
});
