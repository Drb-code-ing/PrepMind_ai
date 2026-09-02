import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  chatStreamEventsResponseSchema,
  chatTurnStatusResponseSchema,
  type ChatStreamEventsQuery,
  type ChatStreamEventsResponse,
  type ChatTurnStatusResponse,
} from '@repo/types/api/chat-stream';

import { ChatStreamStore } from './chat-stream.store';
import { ChatTurnsRepository } from './chat-turns.repository';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const backgroundJobSelect = {
  id: true,
  status: true,
  attempt: true,
  maxAttempts: true,
  progress: true,
  errorCode: true,
  requestedAt: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.BackgroundJobSelect;

const responseMessageSelect = {
  id: true,
  role: true,
  content: true,
  order: true,
  conversationId: true,
  createdAt: true,
} satisfies Prisma.ChatMessageSelect;

@Injectable()
export class ChatTurnsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatTurns: ChatTurnsRepository,
    private readonly streams: ChatStreamStore,
  ) {}

  async getStatus(
    userId: string,
    turnId: string,
  ): Promise<ChatTurnStatusResponse> {
    const turn = await this.chatTurns.findByIdForOwner(userId, turnId);
    if (!turn) throw new NotFoundException('Chat turn not found');

    const [backgroundJob, response] = await Promise.all([
      this.prisma.backgroundJob.findFirst({
        where: {
          userId,
          scope: 'ACCOUNT',
          resourceType: 'CHAT_RESPONSE',
          resourceId: turn.id,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: backgroundJobSelect,
      }),
      turn.responseMessageId
        ? this.prisma.chatMessage.findUnique({
            where: {
              id_userId: {
                id: turn.responseMessageId,
                userId,
              },
            },
            select: responseMessageSelect,
          })
        : null,
    ]);

    if (
      turn.responseMessageId &&
      (!response ||
        response.role !== 'ASSISTANT' ||
        response.conversationId !== turn.conversationId)
    ) {
      throw new AppError(
        'CHAT_TURN_RESPONSE_INVALID',
        'Chat turn response is inconsistent',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const safeResponse = response
      ? {
          id: response.id,
          role: 'ASSISTANT' as const,
          content: response.content,
          order: response.order,
          createdAt: response.createdAt.toISOString(),
        }
      : null;

    return chatTurnStatusResponseSchema.parse({
      turn: {
        id: turn.id,
        conversationId: turn.conversationId,
        status: turn.status,
        responseMessageId: turn.responseMessageId,
        errorCode: turn.errorCode,
        startedAt: turn.startedAt?.toISOString() ?? null,
        finishedAt: turn.finishedAt?.toISOString() ?? null,
        createdAt: turn.createdAt.toISOString(),
        updatedAt: turn.updatedAt.toISOString(),
      },
      backgroundJob: backgroundJob
        ? {
            id: backgroundJob.id,
            status: backgroundJob.status,
            attempt: backgroundJob.attempt,
            maxAttempts: backgroundJob.maxAttempts,
            progress: backgroundJob.progress,
            errorCode: backgroundJob.errorCode,
            requestedAt: backgroundJob.requestedAt.toISOString(),
            startedAt: backgroundJob.startedAt?.toISOString() ?? null,
            finishedAt: backgroundJob.finishedAt?.toISOString() ?? null,
          }
        : null,
      response: safeResponse,
    });
  }

  async getEvents(
    userId: string,
    turnId: string,
    query: ChatStreamEventsQuery,
  ): Promise<ChatStreamEventsResponse> {
    const turn = await this.chatTurns.findByIdForOwner(userId, turnId);
    if (!turn) throw new NotFoundException('Chat turn not found');

    const result = await this.streams.read(userId, turn.id, query);
    return chatStreamEventsResponseSchema.parse({
      events: result.events,
      nextCursor: result.nextCursor,
      cursorState: result.cursorState,
      transport:
        result.disposition === 'unavailable' ? 'unavailable' : 'available',
      hasMore: result.hasMore,
      terminal:
        turn.status === 'SUCCEEDED' ||
        turn.status === 'FAILED' ||
        turn.status === 'CANCELLED',
    });
  }
}
