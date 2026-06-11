import { ChatMessagesService } from './chat-messages.service';
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
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new ChatMessagesService(prisma as unknown as PrismaService);
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
      ],
    });
    expect(result.conversationId).toBe('conv_1');
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
  });
});
