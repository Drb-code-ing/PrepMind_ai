import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ClearChatMessagesQuery,
  ListChatMessagesQuery,
  SyncChatMessagesRequest,
} from '@repo/types/api/chat-message';

import { AppError } from '../common/errors/app-error';
import {
  ConversationStateCacheService,
  type ConversationStateCache,
} from '../conversation-context/conversation-state-cache.service';
import { PrismaService } from '../database/prisma.service';

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
