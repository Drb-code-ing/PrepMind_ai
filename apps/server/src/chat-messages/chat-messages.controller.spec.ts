import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { HttpStatus, RequestMethod } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatMessagesController } from './chat-messages.controller';

describe('ChatMessagesController', () => {
  it('exposes an authenticated owner-bound turn preparation endpoint', async () => {
    const prepared = {
      conversationId: 'conv_1',
      messages: [
        {
          id: 'msg_1',
          userId: 'user_1',
          conversationId: 'conv_1',
          role: 'USER' as const,
          content: 'Question',
          order: 0,
          metadata: null,
          createdAt: '2026-09-04T00:00:00.000Z',
        },
      ],
    };
    const service = {
      prepareForTurn: jest.fn().mockResolvedValue(prepared),
    };
    const controller = new ChatMessagesController(service as never);
    const request = {
      conversationId: 'conv_1',
      messages: [
        {
          id: 'msg_1',
          role: 'USER',
          content: 'Question',
          order: 0,
        },
      ],
    };

    await expect(
      controller.prepareForTurn({ id: 'user_1' } as never, request),
    ).resolves.toEqual(prepared);
    expect(service.prepareForTurn).toHaveBeenCalledWith('user_1', request);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ChatMessagesController),
    ).toEqual([JwtAuthGuard]);

    const method = Reflect.get(
      ChatMessagesController.prototype,
      'prepareForTurn',
    ) as object;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe('prepare');
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, method)).toBe(HttpStatus.OK);
  });

  it('rejects malformed preparation input before calling the service', () => {
    const service = { prepareForTurn: jest.fn() };
    const controller = new ChatMessagesController(service as never);

    expect(() =>
      controller.prepareForTurn({ id: 'user_1' } as never, {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'ASSISTANT',
            content: 'Assistant cannot be the tail',
            order: 0,
          },
        ],
      }),
    ).toThrow();
    expect(service.prepareForTurn).not.toHaveBeenCalled();
  });
});
