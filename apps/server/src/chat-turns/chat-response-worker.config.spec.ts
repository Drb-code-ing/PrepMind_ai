import {
  resolveChatResponseGenerationTimeout,
  resolveChatResponseWorkerConcurrency,
  resolveChatResponseWorkerLockDuration,
} from './chat-response-worker.config';

describe('chat response worker configuration', () => {
  it('uses bounded concurrency and generation defaults', () => {
    expect(resolveChatResponseWorkerConcurrency('')).toBe(2);
    expect(resolveChatResponseGenerationTimeout('')).toBe(120_000);
  });

  it('keeps the Bull lease beyond the generation timeout', () => {
    expect(resolveChatResponseWorkerLockDuration(undefined, 120_000)).toBe(
      180_000,
    );
    expect(resolveChatResponseWorkerLockDuration('150000', 120_000)).toBe(
      150_000,
    );
    expect(resolveChatResponseWorkerLockDuration(undefined, 600_000)).toBe(
      630_000,
    );
  });

  it('falls back for malformed values without returning an unsafe lease', () => {
    expect(resolveChatResponseWorkerConcurrency('0')).toBe(2);
    expect(resolveChatResponseGenerationTimeout('not-a-number')).toBe(120_000);
    expect(resolveChatResponseWorkerLockDuration('999999999', 120_000)).toBe(
      900_000,
    );
  });
});
