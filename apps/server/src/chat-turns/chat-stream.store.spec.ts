import { ChatStreamStore, type ChatStreamRedis } from './chat-stream.store';

describe('ChatStreamStore', () => {
  it('uses an owner-hashed key and an atomic bounded append script', async () => {
    const redis = createRedis();
    redis.eval.mockResolvedValueOnce([1, '100-0', '0']);
    const store = createStore(redis);

    await expect(
      store.append('user_1', 'turn_1', {
        eventId: 'evt_started',
        type: 'response_started',
        mode: 'mock',
        generator: 'deterministic-worker-v1',
      }),
    ).resolves.toEqual({ disposition: 'appended', cursor: '100-0' });

    const [script, numberOfKeys, key, sequenceKey, terminalKey] = redis.eval
      .mock.calls[0] as [string, number, string, string, string];
    expect(numberOfKeys).toBe(3);
    expect(key).toMatch(/^test:chat-stream:[a-f0-9]{64}$/);
    expect(key).not.toContain('user_1');
    expect(key).not.toContain('turn_1');
    expect(sequenceKey).toBe(`${key}:sequence`);
    expect(terminalKey).toBe(`${key}:terminal`);
    expect(script).toContain("'XADD'");
    expect(script).toContain("'XTRIM'");
    expect(script).toContain("'EXPIRE'");
    expect(redis.eval.mock.calls[0]?.slice(5)).toEqual(
      expect.arrayContaining(['evt_started', '0', '16384', '60']),
    );
  });

  it('treats duplicate, terminal, and Redis-failure dispositions as bounded outcomes', async () => {
    const redis = createRedis();
    const store = createStore(redis);
    redis.eval
      .mockResolvedValueOnce([0, '100-0'])
      .mockResolvedValueOnce([-4, ''])
      .mockRejectedValueOnce(new Error('redis://secret'));
    const event = {
      eventId: 'evt_done',
      type: 'response_completed' as const,
      responseMessageId: 'response_1',
      finishReason: 'stop' as const,
      generator: 'deterministic-worker-v1',
    };

    await expect(store.append('user_1', 'turn_1', event)).resolves.toEqual({
      disposition: 'duplicate',
      cursor: '100-0',
    });
    await expect(store.append('user_1', 'turn_1', event)).resolves.toEqual({
      disposition: 'rejected',
      reason: 'terminal',
    });
    await expect(store.append('user_1', 'turn_1', event)).resolves.toEqual({
      disposition: 'unavailable',
    });
  });

  it('replays ordered entries and reports a cursor that fell out of the bound', async () => {
    const redis = createRedis();
    const store = createStore(redis);
    const entries = [
      entry(
        '200-0',
        {
          eventId: 'evt_started',
          type: 'response_started',
          mode: 'mock',
          generator: 'deterministic-worker-v1',
        },
        0,
      ),
      entry(
        '200-1',
        {
          eventId: 'evt_delta',
          type: 'text_delta',
          text: 'answer',
        },
        1,
      ),
    ];
    redis.xrange.mockResolvedValueOnce(entries);
    const result = await store.read('user_1', 'turn_1', { limit: 1 });
    expect(result).toMatchObject({
      disposition: 'available',
      cursorState: 'initial',
      hasMore: true,
      nextCursor: '200-0',
    });
    expect(result.events[0]?.event.type).toBe('response_started');

    redis.xrange.mockResolvedValueOnce([]);
    await expect(
      store.read('user_1', 'turn_1', { cursor: '100-0', limit: 10 }),
    ).resolves.toMatchObject({
      disposition: 'cursor_expired',
      cursorState: 'expired',
    });
  });

  it('fails open on Redis read errors and ignores malformed entries', async () => {
    const redis = createRedis();
    const store = createStore(redis);
    redis.xrange.mockRejectedValueOnce(new Error('redis://secret'));
    await expect(
      store.read('user_1', 'turn_1', { limit: 10 }),
    ).resolves.toMatchObject({ disposition: 'unavailable', events: [] });

    redis.xrange.mockResolvedValueOnce([
      ['300-0', ['event', '{bad', 'sequence', '0']],
    ]);
    const malformed = await store.read('user_1', 'turn_1', { limit: 10 });
    expect(malformed.disposition).toBe('unavailable');
    expect(malformed.events).toEqual([]);

    redis.xrange.mockResolvedValueOnce({ malformed: true });
    await expect(
      store.read('user_1', 'turn_1', { limit: 10 }),
    ).resolves.toMatchObject({ disposition: 'unavailable', events: [] });
  });

  function createRedis() {
    return {
      eval: jest.fn(),
      xrange: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as jest.Mocked<ChatStreamRedis>;
  }

  function createStore(redis: jest.Mocked<ChatStreamRedis>) {
    return new ChatStreamStore(redis, {
      prefix: 'test',
      maxEvents: 4,
      maxBytes: 16_384,
      ttlSeconds: 60,
    });
  }

  function entry(
    cursor: string,
    draft: Record<string, unknown>,
    sequence: number,
  ): [string, string[]] {
    return [
      cursor,
      [
        'eventId',
        String(draft.eventId),
        'eventHash',
        'hash',
        'sequence',
        String(sequence),
        'event',
        JSON.stringify(draft),
        'bytes',
        '10',
        'terminal',
        '0',
      ],
    ];
  }
});
