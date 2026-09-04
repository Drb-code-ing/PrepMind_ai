import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ClearChatMessagesQuery,
  ListChatMessagesQuery,
  PrepareChatMessageItem,
  PrepareChatMessagesRequest,
  SyncChatMessagesRequest,
} from '@repo/types/api/chat-message';

import { AppError } from '../common/errors/app-error';
import {
  ConversationStateCacheService,
  type ConversationStateCache,
} from '../conversation-context/conversation-state-cache.service';
import { PrismaService } from '../database/prisma.service';

const MAX_PREPARE_TRANSACTION_ATTEMPTS = 5;

@Injectable()
export class ChatMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConversationStateCacheService)
    private readonly stateCache: ConversationStateCache,
  ) {}

  async list(userId: string, query: ListChatMessagesQuery) {
    const conversation = await this.findConversation(
      userId,
      query.conversationId,
    );
    if (!conversation) {
      return { conversationId: null, messages: [] };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { userId, conversationId: conversation.id },
      orderBy: { order: 'asc' },
    });

    return {
      conversationId: conversation.id,
      messages: messages.map((message) => this.toResponse(message)),
      state: await this.findState(userId, conversation.id),
    };
  }

  async sync(userId: string, input: SyncChatMessagesRequest) {
    this.assertCompleteSyncSnapshot(input);

    const conversation = await this.prisma.$transaction(async (tx) => {
      const conversation = await this.resolveConversationForSync(
        userId,
        input,
        tx,
      );

      await tx.chatMessage.deleteMany({
        where: { userId, conversationId: conversation.id },
      });

      if (input.messages.length > 0) {
        await tx.chatMessage.createMany({
          data: input.messages.map((message) => ({
            id: message.id,
            userId,
            conversationId: conversation.id,
            role: message.role,
            content: message.content,
            order: message.order,
            metadata: message.metadata as Prisma.InputJsonValue | undefined,
            createdAt: message.createdAt
              ? new Date(message.createdAt)
              : undefined,
          })),
          skipDuplicates: true,
        });
      }

      return conversation;
    });

    const messages = await this.prisma.chatMessage.findMany({
      where: { userId, conversationId: conversation.id },
      orderBy: { order: 'asc' },
    });

    return {
      conversationId: conversation.id,
      messages: messages.map((message) => this.toResponse(message)),
      state: await this.findState(userId, conversation.id),
    };
  }

  async prepareForTurn(userId: string, input: PrepareChatMessagesRequest) {
    const runTransaction = () =>
      this.prisma.$transaction(
        async (transaction) => {
          const conversation = await this.findConversation(
            userId,
            input.conversationId,
            transaction,
          );
          if (!conversation) throw this.conversationNotFound();

          const requestedMessages = [...input.messages].sort(
            (left, right) => left.order - right.order,
          );
          const firstRequestedOrder = requestedMessages[0]?.order;
          const lastRequestedOrder = requestedMessages.at(-1)?.order;
          if (
            firstRequestedOrder === undefined ||
            lastRequestedOrder === undefined
          ) {
            throw this.prepareMessageConflict();
          }
          const latestPersistedMessage =
            await transaction.chatMessage.findFirst({
              where: { userId, conversationId: conversation.id },
              orderBy: { order: 'desc' },
              select: { order: true },
            });
          if (
            latestPersistedMessage !== null &&
            latestPersistedMessage.order > lastRequestedOrder
          ) {
            throw this.prepareMessageConflict();
          }
          const predecessorOrder =
            firstRequestedOrder > 0 ? firstRequestedOrder - 1 : null;
          const requestedOrders = requestedMessages.map(
            (message) => message.order,
          );
          if (predecessorOrder !== null) requestedOrders.push(predecessorOrder);
          const existingMessages = await transaction.chatMessage.findMany({
            where: {
              userId,
              conversationId: conversation.id,
              OR: [
                { id: { in: requestedMessages.map((message) => message.id) } },
                {
                  order: {
                    in: requestedOrders,
                  },
                },
              ],
            },
          });
          const existingById = new Map(
            existingMessages.map((message) => [message.id, message]),
          );
          const existingByOrder = new Map(
            existingMessages.map((message) => [message.order, message]),
          );
          if (
            predecessorOrder !== null &&
            !existingByOrder.has(predecessorOrder)
          ) {
            throw this.prepareMessageConflict();
          }
          const missingMessages = requestedMessages.filter((message) => {
            const byId = existingById.get(message.id);
            const byOrder = existingByOrder.get(message.order);
            if (byId && byOrder && byId.id !== byOrder.id) {
              throw this.prepareMessageConflict();
            }
            if (byId) {
              if (!this.matchesPreparedMessage(byId, message)) {
                throw this.prepareMessageConflict();
              }
              return false;
            }
            if (byOrder) throw this.prepareMessageConflict();
            return true;
          });

          if (missingMessages.length > 0) {
            await transaction.chatMessage.createMany({
              data: missingMessages.map((message) => ({
                id: message.id,
                userId,
                conversationId: conversation.id,
                role: message.role,
                content: message.content,
                order: message.order,
                createdAt: message.createdAt
                  ? new Date(message.createdAt)
                  : undefined,
              })),
              skipDuplicates: true,
            });
          }

          const persistedMessages = await transaction.chatMessage.findMany({
            where: {
              userId,
              conversationId: conversation.id,
              id: { in: requestedMessages.map((message) => message.id) },
            },
            orderBy: { order: 'asc' },
          });
          if (
            persistedMessages.length !== requestedMessages.length ||
            persistedMessages.some(
              (message, index) =>
                !this.matchesPreparedMessage(message, requestedMessages[index]),
            )
          ) {
            throw this.prepareMessageConflict();
          }

          return { conversation, messages: persistedMessages };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    for (
      let attempt = 1;
      attempt <= MAX_PREPARE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        const result = await runTransaction();
        return {
          conversationId: result.conversation.id,
          messages: result.messages.map((message) => this.toResponse(message)),
        };
      } catch (error) {
        if (this.isPrepareUniqueConflict(error)) {
          throw this.prepareMessageConflict();
        }
        if (!this.isRetryablePrepareConflict(error)) throw error;
        if (attempt === MAX_PREPARE_TRANSACTION_ATTEMPTS) {
          throw this.prepareMessageConflict();
        }
      }
    }

    throw this.prepareMessageConflict();
  }

  async clear(
    userId: string,
    conversationId?: ClearChatMessagesQuery['conversationId'],
  ) {
    const conversation = await this.findConversation(userId, conversationId);
    if (!conversation) {
      return { ok: true };
    }

    await this.prisma.conversation.delete({
      where: { id: conversation.id },
    });
    try {
      await this.stateCache.delete(userId, conversation.id);
    } catch {
      // PostgreSQL deletion is authoritative; cache cleanup is best effort.
    }

    return { ok: true };
  }

  private async resolveConversationForSync(
    userId: string,
    input: SyncChatMessagesRequest,
    prisma: Prisma.TransactionClient,
  ) {
    const existing = await this.findConversation(
      userId,
      input.conversationId,
      prisma,
    );
    if (existing) {
      return existing;
    }

    if (input.conversationId) {
      throw this.conversationNotFound();
    }

    return prisma.conversation.create({
      data: {
        userId,
        title: this.getConversationTitle(input),
      },
    });
  }

  private findConversation(
    userId: string,
    conversationId?: string,
    prisma: ConversationReader = this.prisma,
  ) {
    return prisma.conversation.findFirst({
      where: conversationId ? { id: conversationId, userId } : { userId },
      orderBy: conversationId ? undefined : { updatedAt: 'desc' },
    });
  }

  private getConversationTitle(input: SyncChatMessagesRequest) {
    const firstUserMessage =
      input.messages.find((message) => message.role === 'USER') ??
      input.messages[0];
    if (!firstUserMessage) return 'New chat';

    const title = firstUserMessage.content.replace(/\s+/g, ' ').trim();
    return title ? title.slice(0, 40) : 'New chat';
  }

  private assertCompleteSyncSnapshot(input: SyncChatMessagesRequest) {
    if (input.messages.length === 0) return;

    const latestMessage = [...input.messages]
      .sort((a, b) => a.order - b.order)
      .at(-1);
    if (
      !latestMessage ||
      latestMessage.role !== 'ASSISTANT' ||
      !latestMessage.content.trim()
    ) {
      throw new AppError(
        'CHAT_SYNC_INCOMPLETE_ASSISTANT',
        '本次回答没有生成完成，请重试',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private matchesPreparedMessage(
    existing: ChatMessageRecord,
    requested: PrepareChatMessageItem,
  ) {
    return (
      existing.id === requested.id &&
      existing.role === requested.role &&
      existing.content === requested.content &&
      existing.order === requested.order &&
      (requested.createdAt === undefined ||
        existing.createdAt.getTime() ===
          new Date(requested.createdAt).getTime())
    );
  }

  private isRetryablePrepareConflict(error: unknown) {
    const code = this.readErrorCode(error);
    return code === 'P2034' || code === '40001';
  }

  private isPrepareUniqueConflict(error: unknown) {
    return this.readErrorCode(error) === 'P2002';
  }

  private readErrorCode(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      return error.code;
    if (typeof error !== 'object' || error === null) return undefined;
    const value = error as { code?: unknown };
    return typeof value.code === 'string' ? value.code : undefined;
  }

  private prepareMessageConflict() {
    return new AppError(
      'CHAT_PREPARE_MESSAGE_CONFLICT',
      '聊天消息快照与已持久化事实冲突',
      HttpStatus.CONFLICT,
    );
  }

  private toResponse(message: ChatMessageRecord) {
    return {
      id: message.id,
      userId: message.userId,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      order: message.order,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async findState(userId: string, conversationId: string) {
    const state = await this.prisma.conversationState.findFirst({
      where: {
        userId,
        conversationId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!state) return null;

    return {
      conversationId: state.conversationId,
      activeGoal: state.activeGoal,
      activeQuestionId: state.activeQuestionId,
      stateVersion: state.stateVersion,
      expiresAt: state.expiresAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
    };
  }

  private conversationNotFound() {
    return new AppError(
      'CHAT_CONVERSATION_NOT_FOUND',
      '聊天会话不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

type ConversationReader = Pick<
  PrismaService | Prisma.TransactionClient,
  'conversation'
>;
type ChatMessageRecord = Prisma.ChatMessageGetPayload<object>;
