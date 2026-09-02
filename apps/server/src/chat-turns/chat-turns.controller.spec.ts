import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatTurnsController } from './chat-turns.controller';

describe('ChatTurnsController', () => {
  it('requires JWT authentication for status and replay endpoints', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ChatTurnsController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('parses the replay query before delegating an owner-bound request', async () => {
    const service = {
      getEvents: jest.fn().mockResolvedValue({ ok: true }),
      getStatus: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new ChatTurnsController(service as never);

    await expect(
      controller.events({ id: 'user_1' } as never, 'turn_1', { limit: '2' }),
    ).resolves.toEqual({ ok: true });
    expect(service.getEvents).toHaveBeenCalledWith('user_1', 'turn_1', {
      limit: 2,
    });

    await controller.status({ id: 'user_1' } as never, 'turn_1');
    expect(service.getStatus).toHaveBeenCalledWith('user_1', 'turn_1');
  });
});
