import { NotFoundException } from '@nestjs/common';
import type { ChatTurn } from '@prisma/client';

import { ChatTurnsQueryService } from './chat-turns.query.service';

describe('ChatTurnsQueryService', () => {
  it('returns only owner-bound durable turn, job, and assistant fields', async () => {
    const turn = makeTurn({
      status: 'SUCCEEDED',
      responseMessageId: 'response_1',
    });
    const repository = {
      findByIdForOwner: jest.fn().mockResolvedValue(turn),
    };
    const prisma = {
      backgroundJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          status: 'SUCCEEDED',
          attempt: 1,
          maxAttempts: 3,
          progress: 100,
          errorCode: null,
          requestedAt: new Date('2026-09-02T00:00:00.000Z'),
          startedAt: new Date('2026-09-02T00:00:01.000Z'),
          finishedAt: new Date('2026-09-02T00:00:02.000Z'),
        }),
      },
      chatMessage: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'response_1',
          role: 'ASSISTANT',
          content: 'safe answer',
          order: 2,
          conversationId: turn.conversationId,
          createdAt: new Date('2026-09-02T00:00:02.000Z'),
        }),
      },
    };
    const streams = { read: jest.fn() };
    const service = new ChatTurnsQueryService(
      prisma as never,
      repository as never,
      streams as never,
    );

    await expect(service.getStatus('user_1', turn.id)).resolves.toMatchObject({
      turn: {
        id: turn.id,
        status: 'SUCCEEDED',
        responseMessageId: 'response_1',
      },
      backgroundJob: { id: 'job_1', progress: 100 },
      response: { id: 'response_1', content: 'safe answer' },
    });
    expect(prisma.chatMessage.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_userId: { id: 'response_1', userId: 'user_1' } },
      }),
    );
  });

  it('does not reveal a turn belonging to another user', async () => {
    const repository = { findByIdForOwner: jest.fn().mockResolvedValue(null) };
    const service = new ChatTurnsQueryService(
      {} as never,
      repository as never,
      {} as never,
    );

    await expect(
      service.getStatus('other_user', 'turn_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findByIdForOwner).toHaveBeenCalledWith(
      'other_user',
      'turn_1',
    );
  });

  it('returns the durable terminal flag even when Redis replay is unavailable', async () => {
    const turn = makeTurn({
      status: 'SUCCEEDED',
      responseMessageId: 'response_1',
    });
    const repository = {
      findByIdForOwner: jest.fn().mockResolvedValue(turn),
    };
    const streams = {
      read: jest.fn().mockResolvedValue({
        disposition: 'unavailable',
        events: [],
        nextCursor: null,
        hasMore: false,
        cursorState: 'initial',
      }),
    };
    const service = new ChatTurnsQueryService(
      {} as never,
      repository as never,
      streams as never,
    );

    await expect(
      service.getEvents('user_1', turn.id, { limit: 10 }),
    ).resolves.toEqual({
      events: [],
      nextCursor: null,
      cursorState: 'initial',
      transport: 'unavailable',
      hasMore: false,
      terminal: true,
    });
  });

  function makeTurn(overrides: Partial<ChatTurn> = {}) {
    return {
      id: 'turn_1',
      userId: 'user_1',
      conversationId: 'conversation_1',
      clientRequestId: 'request_1',
      status: 'QUEUED',
      inputHash: `sha256:${'a'.repeat(64)}`,
      inputMessageIds: ['message_1'],
      budgetPolicyVersion: 'chat-budget-v1',
      responseMessageId: null,
      errorCode: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
      ...overrides,
    };
  }
});
