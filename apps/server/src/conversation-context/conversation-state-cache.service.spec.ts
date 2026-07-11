import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';

import { ConversationStateCacheService } from './conversation-state-cache.service';

describe('ConversationStateCacheService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.useFakeTimers().setSystemTime(new Date('2026-07-11T00:00:00.000Z'));
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  it('uses a hashed tenant key and a maximum 24 hour TTL', async () => {
    redis.set.mockResolvedValue('OK');
    const service = new ConversationStateCacheService(redis);
    const state = {
      conversationId: 'conv_1',
      activeGoal: null,
      activeQuestionId: null,
      stateVersion: 1,
      expiresAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    };

    await service.set('user_1', state);

    const digest = createHash('sha256')
      .update('user_1\u0000conv_1')
      .digest('hex');
    expect(redis.set).toHaveBeenCalledWith(
      `prepmind:conversation-state:${digest}`,
      JSON.stringify(state),
      'EX',
      86_400,
    );
  });

  it('rejects invalid JSON and cached data for another conversation', async () => {
    const service = new ConversationStateCacheService(redis);
    redis.get.mockResolvedValueOnce('{bad json');
    await expect(service.get('user_1', 'conv_1')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'CONVERSATION_STATE_CACHE_READ_FAILED',
    );
    warnSpy.mockClear();

    redis.get.mockResolvedValueOnce(
      JSON.stringify({
        conversationId: 'conv_other',
        activeGoal: null,
        activeQuestionId: null,
        stateVersion: 1,
        expiresAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-11T00:00:00.000Z',
      }),
    );
    await expect(service.get('user_1', 'conv_1')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'CONVERSATION_STATE_CACHE_READ_FAILED',
    );
  });

  it('fails open on Redis errors and never exposes raw error text', async () => {
    redis.get.mockRejectedValue(new Error('redis://user:secret@example'));
    const service = new ConversationStateCacheService(redis);

    await expect(service.get('user_1', 'conv_1')).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'CONVERSATION_STATE_CACHE_READ_FAILED',
    );
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'redis://user:secret@example',
    );
  });
});
