import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ConversationContextPrepareRequest,
  ConversationStateResponse,
} from '@repo/types/api/conversation-context';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import type { ConversationStateCache } from './conversation-state-cache.service';
import { ConversationStateCacheService } from './conversation-state-cache.service';
import { ConversationSummaryService } from './conversation-summary.service';

const STATE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ConversationContextService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConversationStateCacheService)
    private readonly cache: ConversationStateCache,
    private readonly summaryService: ConversationSummaryService,
  ) {}

  async prepare(userId: string, input: ConversationContextPrepareRequest) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: input.conversationId, userId },
      select: { id: true },
    });
    if (!conversation) throw this.conversationNotFound();

    const state = await this.resolveState(userId, input);
    const summary = await this.summaryService.prepare(
      userId,
      input.conversationId,
      input.maxInputTokens,
    );

    return {
      conversationId: input.conversationId,
      summaryBuffer: summary.summaryBuffer,
      coveredThroughOrder: summary.coveredThroughOrder,
      summaryVersion: summary.summaryVersion,
      summaryStatus: summary.summaryStatus,
      state,
      debug: {
        uncoveredMessageCount: summary.uncoveredMessageCount,
        triggerReason: summary.triggerReason,
        modelMode: summary.modelMode,
        errorCode: summary.errorCode,
      },
    };
  }

  private async resolveState(
    userId: string,
    input: ConversationContextPrepareRequest,
    uniqueRetry = 0,
  ): Promise<ConversationStateResponse | null> {
    if (!input.statePatch) {
      const cached = await this.safeCacheGet(userId, input.conversationId);
      if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
        return cached;
      }
    }

    const existing = await this.prisma.conversationState.findFirst({
      where: { conversationId: input.conversationId, userId },
    });

    if (!input.statePatch) {
      if (!existing || existing.expiresAt.getTime() <= Date.now()) {
        await this.safeCacheDelete(userId, input.conversationId);
        return null;
      }
      const state = this.toState(existing);
      await this.safeCacheSet(userId, state);
      return state;
    }

    const activeGoal = Object.hasOwn(input.statePatch, 'activeGoal')
      ? (input.statePatch.activeGoal ?? null)
      : (existing?.activeGoal ?? null);
    const activeQuestionId = Object.hasOwn(input.statePatch, 'activeQuestionId')
      ? (input.statePatch.activeQuestionId ?? null)
      : (existing?.activeQuestionId ?? null);
    const expiresAt = new Date(Date.now() + STATE_TTL_MS);
    let persisted: ConversationStateRecord;

    if (!existing) {
      try {
        persisted = await this.prisma.conversationState.create({
          data: {
            conversationId: input.conversationId,
            userId,
            activeGoal,
            activeQuestionId,
            stateVersion: 1,
            expiresAt,
          },
        });
      } catch (error) {
        if (uniqueRetry === 0 && this.isUniqueConstraintError(error)) {
          return this.resolveState(userId, input, 1);
        }
        throw error;
      }
    } else {
      const changed =
        existing.expiresAt.getTime() <= Date.now() ||
        existing.activeGoal !== activeGoal ||
        existing.activeQuestionId !== activeQuestionId;
      persisted = changed
        ? await this.prisma.conversationState.update({
            where: { id: existing.id },
            data: {
              ...(Object.hasOwn(input.statePatch, 'activeGoal')
                ? { activeGoal }
                : {}),
              ...(Object.hasOwn(input.statePatch, 'activeQuestionId')
                ? { activeQuestionId }
                : {}),
              stateVersion: { increment: 1 },
              expiresAt,
            },
          })
        : existing;
    }

    const state = this.toState(persisted);
    await this.safeCacheSet(userId, state);
    return state;
  }

  private toState(record: ConversationStateRecord): ConversationStateResponse {
    return {
      conversationId: record.conversationId,
      activeGoal: record.activeGoal,
      activeQuestionId: record.activeQuestionId,
      stateVersion: record.stateVersion,
      expiresAt: record.expiresAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private async safeCacheGet(userId: string, conversationId: string) {
    try {
      return await this.cache.get(userId, conversationId);
    } catch {
      return null;
    }
  }

  private async safeCacheSet(userId: string, state: ConversationStateResponse) {
    try {
      await this.cache.set(userId, state);
    } catch {
      return;
    }
  }

  private async safeCacheDelete(userId: string, conversationId: string) {
    try {
      await this.cache.delete(userId, conversationId);
    } catch {
      return;
    }
  }

  private conversationNotFound() {
    return new AppError(
      'CHAT_CONVERSATION_NOT_FOUND',
      '聊天会话不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}

type ConversationStateRecord = Prisma.ConversationStateGetPayload<object>;
