import type { ConversationContextPrepareRequest } from '@repo/types/api/conversation-context';

import { PrismaService } from '../database/prisma.service';
import { ConversationContextService } from './conversation-context.service';
import type { ConversationStateCache } from './conversation-state-cache.service';

describe('ConversationContextService', () => {
  const now = new Date('2026-07-11T00:00:00.000Z');
  const request: ConversationContextPrepareRequest = {
    conversationId: 'conv_1',
    maxInputTokens: 2500,
  };
  const stateRecord = {
    id: 'state_1',
    conversationId: 'conv_1',
    userId: 'user_1',
    activeGoal: '复习导数',
    activeQuestionId: 'question_1',
    pendingActionProposal: { private: true },
    lastToolNames: ['private-tool'],
    stateVersion: 1,
    expiresAt: new Date('2026-07-12T00:00:00.000Z'),
    createdAt: now,
    updatedAt: now,
  };
  const prisma = {
    conversation: { findFirst: jest.fn() },
    conversationState: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    conversationSummary: { findFirst: jest.fn() },
    chatMessage: { count: jest.fn() },
  };
  const cache: jest.Mocked<ConversationStateCache> = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv_1' });
    prisma.conversationState.findFirst.mockResolvedValue(stateRecord);
    prisma.conversationSummary.findFirst.mockResolvedValue(null);
    prisma.chatMessage.count.mockResolvedValue(2);
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.delete.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  function createService() {
    return new ConversationContextService(
      prisma as unknown as PrismaService,
      cache,
    );
  }

  it('returns 404 before reading state for an unowned conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);

    await expect(
      createService().prepare('user_2', request),
    ).rejects.toMatchObject({
      code: 'CHAT_CONVERSATION_NOT_FOUND',
      statusCode: 404,
    });
    expect(cache.get.mock.calls).toHaveLength(0);
    expect(prisma.conversationState.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to PostgreSQL when Redis throws without leaking the raw error', async () => {
    cache.get.mockRejectedValue(new Error('raw redis credential text'));

    const result = await createService().prepare('user_1', request);

    expect(result.state?.stateVersion).toBe(1);
    expect(result.state).toEqual({
      conversationId: 'conv_1',
      activeGoal: '复习导数',
      activeQuestionId: 'question_1',
      stateVersion: 1,
      expiresAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('raw redis credential text');
  });

  it('returns an existing unexpired cached state without changing the version', async () => {
    cache.get.mockResolvedValue({
      conversationId: 'conv_1',
      activeGoal: '复习导数',
      activeQuestionId: 'question_1',
      stateVersion: 1,
      expiresAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });

    const result = await createService().prepare('user_1', request);

    expect(result.state?.stateVersion).toBe(1);
    expect(prisma.conversationState.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversationState.update).not.toHaveBeenCalled();
  });

  it('increments stateVersion only when a sanitized patch changes state', async () => {
    prisma.conversationState.update.mockResolvedValue({
      ...stateRecord,
      activeGoal: '复习积分',
      stateVersion: 2,
      expiresAt: new Date('2026-07-12T00:00:00.000Z'),
    });

    const changed = await createService().prepare('user_1', {
      ...request,
      statePatch: { activeGoal: '复习积分' },
    });

    expect(prisma.conversationState.update).toHaveBeenCalledWith({
      where: { id: 'state_1' },
      data: {
        activeGoal: '复习积分',
        stateVersion: { increment: 1 },
        expiresAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    });
    expect(changed.state?.stateVersion).toBe(2);

    jest.clearAllMocks();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv_1' });
    prisma.conversationState.findFirst.mockResolvedValue(stateRecord);
    prisma.conversationSummary.findFirst.mockResolvedValue(null);
    prisma.chatMessage.count.mockResolvedValue(2);
    cache.set.mockResolvedValue(undefined);

    const unchanged = await createService().prepare('user_1', {
      ...request,
      statePatch: { activeGoal: '复习导数' },
    });
    expect(unchanged.state?.stateVersion).toBe(1);
    expect(prisma.conversationState.update).not.toHaveBeenCalled();
  });

  it('creates a sanitized state with a 24 hour expiry', async () => {
    prisma.conversationState.findFirst.mockResolvedValue(null);
    prisma.conversationState.create.mockResolvedValue({
      ...stateRecord,
      activeGoal: '复习导数',
      activeQuestionId: null,
    });

    await createService().prepare('user_1', {
      ...request,
      statePatch: { activeGoal: '复习导数' },
    });

    expect(prisma.conversationState.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv_1',
        userId: 'user_1',
        activeGoal: '复习导数',
        activeQuestionId: null,
        stateVersion: 1,
        expiresAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    });
  });

  it('distinguishes an omitted field from an explicit null clear', async () => {
    prisma.conversationState.update.mockResolvedValue({
      ...stateRecord,
      activeGoal: null,
      stateVersion: 2,
    });

    await createService().prepare('user_1', {
      ...request,
      statePatch: { activeGoal: null },
    });

    const updateCalls = prisma.conversationState.update.mock
      .calls as unknown as Array<
      [
        {
          data: {
            activeGoal?: string | null;
            activeQuestionId?: string | null;
            stateVersion: { increment: number };
          };
        },
      ]
    >;
    const update = updateCalls[0]?.[0];
    expect(update.data).toMatchObject({
      activeGoal: null,
      stateVersion: { increment: 1 },
    });
    expect(update.data).not.toHaveProperty('activeQuestionId');
  });

  it('re-reads once when a concurrent first create wins the unique constraint', async () => {
    prisma.conversationState.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stateRecord);
    prisma.conversationState.create.mockRejectedValue({ code: 'P2002' });
    prisma.conversationState.update.mockResolvedValue({
      ...stateRecord,
      activeGoal: '复习积分',
      stateVersion: 2,
    });

    const result = await createService().prepare('user_1', {
      ...request,
      statePatch: { activeGoal: '复习积分' },
    });

    expect(prisma.conversationState.findFirst.mock.calls).toHaveLength(2);
    expect(result.state?.stateVersion).toBe(2);
  });
});
