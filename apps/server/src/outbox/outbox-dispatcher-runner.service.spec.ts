import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';

describe('OutboxDispatcherRunnerService', () => {
  const now = new Date('2026-07-07T02:00:00.000Z');
  const dispatcher = { dispatchBatch: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    dispatcher.dispatchBatch.mockResolvedValue({
      claimed: 0,
      succeeded: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not run in api role', async () => {
    const service = createService({ role: 'api', enabled: true });

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).not.toHaveBeenCalled();
  });

  it('does not run when disabled', async () => {
    const service = createService({ role: 'worker', enabled: false });

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).not.toHaveBeenCalled();
  });

  it('dispatches immediately and then on interval for worker role', async () => {
    const service = createService({ role: 'worker', enabled: true });

    service.onModuleInit();
    await Promise.resolve();
    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);
    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(2);
  });

  it('passes configured dispatch controls', async () => {
    const service = createService({
      role: 'both',
      enabled: true,
      workerId: 'outbox-worker-test',
      batchSize: 7,
      lockTimeoutMs: 45000,
    });

    service.onModuleInit();
    await Promise.resolve();

    expect(dispatcher.dispatchBatch).toHaveBeenCalledWith({
      workerId: 'outbox-worker-test',
      limit: 7,
      lockTimeoutMs: 45000,
      now,
    });
  });

  it('skips overlapping ticks while a dispatch is running', async () => {
    const service = createService({ role: 'worker', enabled: true });
    service.onModuleInit();
    await Promise.resolve();

    let resolveDispatch: (value: unknown) => void = () => undefined;
    dispatcher.dispatchBatch.mockReturnValue(
      new Promise((resolve) => {
        resolveDispatch = resolve;
      }),
    );

    await jest.advanceTimersByTimeAsync(5000);
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenCalledWith(
      'Outbox dispatcher tick skipped because a previous tick is still running',
    );

    resolveDispatch({ claimed: 0, succeeded: 0, failed: 0 });
    await Promise.resolve();
  });

  it('logs dispatch failures without throwing', async () => {
    dispatcher.dispatchBatch.mockRejectedValue(new Error('dispatch failed'));
    const service = createService({ role: 'worker', enabled: true });

    expect(() => service.onModuleInit()).not.toThrow();
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith(
      'Outbox dispatcher tick failed: dispatch failed',
    );
  });

  it('clears the timer on destroy', async () => {
    const service = createService({ role: 'worker', enabled: true });

    service.onModuleInit();
    await Promise.resolve();
    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);

    expect(dispatcher.dispatchBatch).toHaveBeenCalledTimes(1);
  });

  function createService(
    overrides: Partial<{
      role: 'api' | 'worker' | 'both';
      enabled: boolean;
      intervalMs: number;
      batchSize: number;
      lockTimeoutMs: number;
      workerId: string;
    }> = {},
  ) {
    return new OutboxDispatcherRunnerService(dispatcher as never, {
      role: overrides.role ?? 'worker',
      enabled: overrides.enabled ?? true,
      intervalMs: overrides.intervalMs ?? 5000,
      batchSize: overrides.batchSize ?? 20,
      lockTimeoutMs: overrides.lockTimeoutMs ?? 300000,
      workerId: overrides.workerId ?? 'outbox-worker-1',
      now: () => now,
      logger,
    });
  }
});
