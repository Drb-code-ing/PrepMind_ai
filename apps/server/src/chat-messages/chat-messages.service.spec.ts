import { ChatMessagesService } from './chat-messages.service';
import type { ConversationStateCache } from '../conversation-context/conversation-state-cache.service';
import { PrismaService } from '../database/prisma.service';

describe('ChatMessagesService', () => {
  const conversation = {
    id: 'conv_1',
    userId: 'user_1',
    title: 'hi',
    createdAt: new Date('2026-06-11T00:00:00.000Z'),
    updatedAt: new Date('2026-06-11T00:00:00.000Z'),
  };
  const message = {
    id: 'msg_1',
    userId: 'user_1',
    conversationId: 'conv_1',
    role: 'USER' as const,
    content: 'hi',
    order: 0,
    metadata: null,
    createdAt: new Date('2026-06-11T00:00:00.000Z'),
  };
  const prisma = {
    $transaction: jest.fn(),
    conversation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    conversationState: {
      findFirst: jest.fn(),
    },
  };
  const cache: jest.Mocked<ConversationStateCache> = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.conversationState.findFirst.mockResolvedValue(null);
    prisma.chatMessage.findFirst.mockResolvedValue(null);
    cache.delete.mockResolvedValue(undefined);
  });

  function createService() {
    return new ChatMessagesService(prisma as unknown as PrismaService, cache);
  }

  function runTransaction<T>(callback: (transaction: typeof prisma) => T) {
    return callback(prisma);
  }

  it('lists messages scoped to the current user conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany.mockResolvedValue([message]);

    const service = createService();
    const result = await service.list('user_1', { conversationId: 'conv_1' });

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv_1', userId: 'user_1' },
      orderBy: undefined,
    });
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', conversationId: 'conv_1' },
      orderBy: { order: 'asc' },
    });
    expect(result).toMatchObject({
      conversationId: 'conv_1',
      messages: [{ id: 'msg_1', role: 'USER' }],
    });
  });

  it('returns an empty list when the default conversation does not exist', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    const service = createService();
    const result = await service.list('user_1', {});

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      orderBy: { updatedAt: 'desc' },
    });
    expect(result).toEqual({ conversationId: null, messages: [] });
  });

  it('returns only unexpired sanitized state with chat history', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany.mockResolvedValue([message]);
    prisma.conversationState.findFirst.mockResolvedValue({
      id: 'state_1',
      conversationId: 'conv_1',
      userId: 'user_1',
      activeGoal: '复习导数',
      activeQuestionId: null,
      pendingActionProposal: { private: true },
      lastToolNames: ['private-tool'],
      stateVersion: 2,
      expiresAt: new Date('2099-07-12T00:00:00.000Z'),
      createdAt: new Date('2026-07-11T00:00:00.000Z'),
      updatedAt: new Date('2026-07-11T00:00:00.000Z'),
    });

    const result = await createService().list('user_1', {
      conversationId: 'conv_1',
    });

    const stateCalls = prisma.conversationState.findFirst.mock
      .calls as unknown as Array<
      [
        {
          where: {
            userId: string;
            conversationId: string;
            expiresAt: { gt: Date };
          };
        },
      ]
    >;
    const stateQuery = stateCalls[0]?.[0];
    expect(stateQuery).toMatchObject({
      where: {
        userId: 'user_1',
        conversationId: 'conv_1',
      },
    });
    expect(stateQuery.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(result.state).toEqual({
      conversationId: 'conv_1',
      activeGoal: '复习导数',
      activeQuestionId: null,
      stateVersion: 2,
      expiresAt: '2099-07-12T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('private-tool');
  });

  it('creates a default conversation and replaces messages during sync', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue(conversation);
    prisma.chatMessage.findMany.mockResolvedValue([message]);
    const runTransaction = (
      callback: (
        tx: typeof prisma,
      ) => Promise<typeof conversation> | typeof conversation,
    ) => callback(prisma);
    prisma.$transaction.mockImplementation(runTransaction);

    const service = createService();
    const result = await service.sync('user_1', {
      messages: [
        {
          id: 'msg_1',
          role: 'USER',
          content: 'hi',
          order: 0,
          createdAt: '2026-06-11T00:00:00.000Z',
        },
        {
          id: 'msg_2',
          role: 'ASSISTANT',
          content: 'hello',
          order: 1,
          createdAt: '2026-06-11T00:00:01.000Z',
        },
      ],
    });

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: { userId: 'user_1', title: 'hi' },
    });
    expect(prisma.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', conversationId: 'conv_1' },
    });
    expect(prisma.chatMessage.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'msg_1',
          userId: 'user_1',
          conversationId: 'conv_1',
          role: 'USER',
          content: 'hi',
          order: 0,
          createdAt: new Date('2026-06-11T00:00:00.000Z'),
        },
        {
          id: 'msg_2',
          userId: 'user_1',
          conversationId: 'conv_1',
          role: 'ASSISTANT',
          content: 'hello',
          order: 1,
          createdAt: new Date('2026-06-11T00:00:01.000Z'),
        },
      ],
      skipDuplicates: true,
    });
    expect(result.conversationId).toBe('conv_1');
  });

  it('writes chat sync idempotently when the same local snapshot is submitted again', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany.mockResolvedValue([message]);
    const runTransaction = (
      callback: (
        tx: typeof prisma,
      ) => Promise<typeof conversation> | typeof conversation,
    ) => callback(prisma);
    prisma.$transaction.mockImplementation(runTransaction);

    const service = createService();
    await service.sync('user_1', {
      conversationId: 'conv_1',
      messages: [
        {
          id: 'msg_1',
          role: 'USER',
          content: 'hi',
          order: 0,
          createdAt: '2026-06-11T00:00:00.000Z',
        },
        {
          id: 'msg_2',
          role: 'ASSISTANT',
          content: 'hello',
          order: 1,
          createdAt: '2026-06-11T00:00:01.000Z',
        },
      ],
    });

    expect(prisma.chatMessage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      }),
    );
  });

  it('rejects syncing a completed snapshot whose latest message is still user-only', async () => {
    const service = createService();

    await expect(
      service.sync('user_1', {
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'why no answer',
            order: 0,
            createdAt: '2026-06-11T00:00:00.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_SYNC_INCOMPLETE_ASSISTANT',
      statusCode: 400,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects syncing a completed snapshot with a blank assistant tail', async () => {
    const service = createService();

    await expect(
      service.sync('user_1', {
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'why no answer',
            order: 0,
            createdAt: '2026-06-11T00:00:00.000Z',
          },
          {
            id: 'msg_2',
            role: 'ASSISTANT',
            content: '   ',
            order: 1,
            createdAt: '2026-06-11T00:00:01.000Z',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_SYNC_INCOMPLETE_ASSISTANT',
      statusCode: 400,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects syncing into an unowned conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    const service = createService();

    await expect(
      service.sync('user_2', {
        conversationId: 'conv_1',
        messages: [],
      }),
    ).rejects.toMatchObject({ code: 'CHAT_CONVERSATION_NOT_FOUND' });
  });

  it('prepares a user-tail snapshot by appending only missing owner-bound messages', async () => {
    const assistant = {
      ...message,
      role: 'ASSISTANT' as const,
      content: 'Earlier answer',
    };
    const userTail = {
      ...message,
      id: 'msg_2',
      role: 'USER' as const,
      content: 'Follow-up question',
      order: 1,
      createdAt: new Date('2026-06-11T00:00:01.000Z'),
    };
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([assistant])
      .mockResolvedValueOnce([assistant, userTail]);
    prisma.$transaction.mockImplementation(runTransaction);

    const result = await createService().prepareForTurn('user_1', {
      conversationId: 'conv_1',
      messages: [
        {
          id: 'msg_1',
          role: 'ASSISTANT',
          content: 'Earlier answer',
          order: 0,
          createdAt: '2026-06-11T00:00:00.000Z',
        },
        {
          id: 'msg_2',
          role: 'USER',
          content: 'Follow-up question',
          order: 1,
          createdAt: '2026-06-11T00:00:01.000Z',
        },
      ],
    });

    expect(prisma.chatMessage.deleteMany).not.toHaveBeenCalled();
    expect(prisma.chatMessage.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'msg_2',
          userId: 'user_1',
          conversationId: 'conv_1',
          role: 'USER',
          content: 'Follow-up question',
          order: 1,
          createdAt: new Date('2026-06-11T00:00:01.000Z'),
        },
      ],
      skipDuplicates: true,
    });
    expect(result).toMatchObject({
      conversationId: 'conv_1',
      messages: [
        { id: 'msg_1', role: 'ASSISTANT', order: 0 },
        { id: 'msg_2', role: 'USER', order: 1 },
      ],
    });
  });

  it('reuses an identical prepared snapshot without rewriting messages', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([message])
      .mockResolvedValueOnce([message]);
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'hi',
            order: 0,
            createdAt: '2026-06-11T00:00:00.000Z',
          },
        ],
      }),
    ).resolves.toMatchObject({
      conversationId: 'conv_1',
      messages: [{ id: 'msg_1', content: 'hi' }],
    });
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
    expect(prisma.chatMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('accepts a bounded non-zero window only after its durable predecessor', async () => {
    const predecessor = { ...message, id: 'msg_499', order: 499 };
    const userTail = { ...message, id: 'msg_500', order: 500 };
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findFirst.mockResolvedValue(predecessor);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([predecessor])
      .mockResolvedValueOnce([userTail]);
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [{ id: 'msg_500', role: 'USER', content: 'hi', order: 500 }],
      }),
    ).resolves.toMatchObject({ messages: [{ id: 'msg_500', order: 500 }] });
    expect(prisma.chatMessage.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-zero window that would create a durable order gap', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findFirst.mockResolvedValue({ order: 100 });
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [{ id: 'msg_500', role: 'USER', content: 'hi', order: 500 }],
      }),
    ).rejects.toMatchObject({ code: 'CHAT_PREPARE_MESSAGE_CONFLICT' });
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
  });

  it('rejects a stale user tail when a newer durable message already exists', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findFirst.mockResolvedValue({ order: 2 });
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [{ id: 'msg_1', role: 'USER', content: 'hi', order: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'CHAT_PREPARE_MESSAGE_CONFLICT' });
    expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
  });

  it('fails closed when a prepared message id or order conflicts with durable facts', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany.mockResolvedValueOnce([
      { ...message, content: 'different durable content' },
    ]);
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'hi',
            order: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_PREPARE_MESSAGE_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
  });

  it('fails closed when turn preparation targets another owner conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(runTransaction);

    await expect(
      createService().prepareForTurn('user_2', {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'hi',
            order: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'CHAT_CONVERSATION_NOT_FOUND' });
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv_1', userId: 'user_2' },
      orderBy: undefined,
    });
    expect(prisma.chatMessage.createMany).not.toHaveBeenCalled();
  });

  it('retries a serializable prepare conflict before returning the canonical snapshot', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([message])
      .mockResolvedValueOnce([message]);
    prisma.$transaction
      .mockRejectedValueOnce({ code: '40001' })
      .mockImplementationOnce(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'hi',
            order: 0,
          },
        ],
      }),
    ).resolves.toMatchObject({ messages: [{ id: 'msg_1' }] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('retries Prisma P2034 serialization conflicts', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([message])
      .mockResolvedValueOnce([message]);
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(runTransaction);

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [{ id: 'msg_1', role: 'USER', content: 'hi', order: 0 }],
      }),
    ).resolves.toMatchObject({ messages: [{ id: 'msg_1' }] });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('maps a deterministic unique conflict without retrying the same transaction', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      createService().prepareForTurn('user_1', {
        conversationId: 'conv_1',
        messages: [
          {
            id: 'msg_1',
            role: 'USER',
            content: 'hi',
            order: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_PREPARE_MESSAGE_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('clears the owned conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(conversation);
    prisma.conversation.delete.mockResolvedValue(conversation);

    const service = createService();
    await expect(service.clear('user_1', 'conv_1')).resolves.toEqual({
      ok: true,
    });

    expect(prisma.conversation.delete).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
    });
    expect(cache.delete.mock.calls).toContainEqual(['user_1', 'conv_1']);
  });
});
