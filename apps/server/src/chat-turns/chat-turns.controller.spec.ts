import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { HttpStatus, RequestMethod } from '@nestjs/common';

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
    const controller = new ChatTurnsController(
      service as never,
      {
        enqueue: jest.fn(),
      } as never,
    );

    await expect(
      controller.events({ id: 'user_1' } as never, 'turn_1', { limit: '2' }),
    ).resolves.toEqual({ ok: true });
    expect(service.getEvents).toHaveBeenCalledWith('user_1', 'turn_1', {
      limit: 2,
    });

    await controller.status({ id: 'user_1' } as never, 'turn_1');
    expect(service.getStatus).toHaveBeenCalledWith('user_1', 'turn_1');
  });

  it('exposes an accepted, owner-bound enqueue route with a safe projection', async () => {
    const enqueueResult = {
      kind: 'created' as const,
      turn: {
        id: 'turn_1',
        userId: 'user_1',
        conversationId: 'conversation_1',
        status: 'QUEUED' as const,
        createdAt: new Date('2026-09-04T00:00:00.000Z'),
        updatedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
      backgroundJob: {
        id: 'job_1',
        status: 'QUEUED' as const,
        attempt: 0,
        maxAttempts: 3,
        progress: 0,
        requestedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
      outboxEvent: {
        id: 'outbox_1',
        payload: { prompt: 'must not leak' },
      },
    };
    const service = {
      enqueue: jest.fn().mockResolvedValue(enqueueResult),
      getEvents: jest.fn(),
      getStatus: jest.fn(),
    };
    const controller = new ChatTurnsController(
      service as never,
      service as never,
    );
    const body = {
      conversationId: 'conversation_1',
      clientRequestId: 'request_1',
      inputHash: `sha256:${'a'.repeat(64)}`,
      inputMessageIds: ['message_1'],
      budgetPolicyVersion: 'chat-budget-v1',
    };

    await expect(
      controller.enqueue({ id: 'user_1' } as never, body),
    ).resolves.toEqual({
      kind: 'created',
      turn: {
        id: 'turn_1',
        conversationId: 'conversation_1',
        status: 'QUEUED',
        createdAt: '2026-09-04T00:00:00.000Z',
        updatedAt: '2026-09-04T00:00:00.000Z',
      },
      backgroundJob: {
        id: 'job_1',
        status: 'QUEUED',
        attempt: 0,
        maxAttempts: 3,
        progress: 0,
        requestedAt: '2026-09-04T00:00:00.000Z',
      },
    });
    expect(service.enqueue).toHaveBeenCalledWith({ userId: 'user_1', ...body });

    expect(() =>
      controller.enqueue({ id: 'user_1' } as never, { ...body, unknown: true }),
    ).toThrow(/Unrecognized key/u);
    const enqueueMethod = Reflect.get(
      ChatTurnsController.prototype,
      'enqueue',
    ) as object;
    expect(Reflect.getMetadata(PATH_METADATA, enqueueMethod)).toBe('/');
    expect(Reflect.getMetadata(METHOD_METADATA, enqueueMethod)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, enqueueMethod)).toBe(
      HttpStatus.ACCEPTED,
    );
  });

  it('rejects malformed or oversized input before calling the enqueue service', () => {
    const service = {
      enqueue: jest.fn(),
      getEvents: jest.fn(),
      getStatus: jest.fn(),
    };
    const controller = new ChatTurnsController(
      service as never,
      service as never,
    );
    const validBody = {
      conversationId: 'conversation_1',
      clientRequestId: 'request_1',
      inputHash: `sha256:${'a'.repeat(64)}`,
      inputMessageIds: ['message_1'],
      budgetPolicyVersion: 'chat-budget-v1',
    };

    for (const invalidBody of [
      { ...validBody, conversationId: 'conversation/1' },
      {
        ...validBody,
        inputMessageIds: Array.from({ length: 1001 }, (_, i) => `message_${i}`),
      },
      { ...validBody, clientRequestId: ' ' },
    ]) {
      expect(() =>
        controller.enqueue({ id: 'user_1' } as never, invalidBody),
      ).toThrow();
    }

    expect(service.enqueue).not.toHaveBeenCalled();
  });

  it('maps an idempotent existing result and preserves domain conflicts', async () => {
    const existingResult = {
      kind: 'existing' as const,
      turn: {
        id: 'turn_1',
        userId: 'user_1',
        conversationId: 'conversation_1',
        status: 'SUCCEEDED' as const,
        createdAt: new Date('2026-09-04T00:00:00.000Z'),
        updatedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
      backgroundJob: {
        id: 'job_1',
        status: 'SUCCEEDED' as const,
        attempt: 1,
        maxAttempts: 3,
        progress: 100,
        requestedAt: new Date('2026-09-04T00:00:00.000Z'),
      },
      outboxEvent: {
        id: 'outbox_1',
        payload: { prompt: 'must not leak' },
      },
    };
    const service = {
      enqueue: jest.fn().mockResolvedValue(existingResult),
      getEvents: jest.fn(),
      getStatus: jest.fn(),
    };
    const controller = new ChatTurnsController(
      service as never,
      service as never,
    );
    const body = {
      conversationId: 'conversation_1',
      clientRequestId: 'request_1',
      inputHash: `sha256:${'a'.repeat(64)}`,
      inputMessageIds: ['message_1'],
      budgetPolicyVersion: 'chat-budget-v1',
    };

    await expect(
      controller.enqueue({ id: 'user_1' } as never, body),
    ).resolves.toMatchObject({
      kind: 'existing',
      turn: { id: 'turn_1', status: 'SUCCEEDED' },
      backgroundJob: { id: 'job_1', status: 'SUCCEEDED', progress: 100 },
    });

    const conflict = Object.assign(new Error('request conflict'), {
      statusCode: HttpStatus.CONFLICT,
      code: 'CHAT_TURN_IDEMPOTENCY_CONFLICT',
    });
    service.enqueue.mockRejectedValueOnce(conflict);
    await expect(
      controller.enqueue({ id: 'user_1' } as never, body),
    ).rejects.toBe(conflict);
    expect(service.enqueue).toHaveBeenLastCalledWith({
      userId: 'user_1',
      ...body,
    });
  });
});
