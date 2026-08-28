import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type ChatTurn, type ChatTurnErrorCode } from '@prisma/client';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 5;
const INPUT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const CANCELLATION_ERROR_CODES = new Set<ChatTurnErrorCode>([
  'CANCELLED_BY_USER',
  'GENERATION_ABORTED',
]);

export type CreateChatTurnInput = {
  userId: string;
  conversationId: string;
  clientRequestId: string;
  inputHash: string;
  inputMessageIds: string[];
  budgetPolicyVersion: string;
};

export type ChatTurnTransitionResult =
  | { kind: 'not-found' }
  | { kind: 'invalid-state'; turn: ChatTurn }
  | { kind: 'not-queued'; turn: ChatTurn }
  | { kind: 'activated'; turn: ChatTurn }
  | { kind: 'completed'; turn: ChatTurn }
  | { kind: 'already-completed'; turn: ChatTurn }
  | { kind: 'failed'; turn: ChatTurn }
  | { kind: 'already-failed'; turn: ChatTurn }
  | { kind: 'cancelled'; turn: ChatTurn }
  | { kind: 'already-cancelled'; turn: ChatTurn };

export type CreateChatTurnResult =
  | { kind: 'created'; turn: ChatTurn }
  | { kind: 'existing'; turn: ChatTurn };

@Injectable()
export class ChatTurnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetQueued(
    input: CreateChatTurnInput,
  ): Promise<CreateChatTurnResult> {
    validateCreateInput(input);

    const runTransaction = () =>
      this.prisma.$transaction(
        (transaction) =>
          this.createOrGetQueuedInTransaction(transaction, input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await runTransaction();
      } catch (error) {
        if (
          attempt === MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !isRetryableCreateConflict(error)
        ) {
          throw error;
        }
      }
    }

    throw new Error('Chat turn transaction retry loop exhausted');
  }

  /**
   * Creates the turn using a caller-owned transaction. The enqueue workflow
   * uses this variant so the turn, background job, and outbox event share one
   * Serializable commit boundary instead of nesting transactions.
   */
  async createOrGetQueuedInTransaction(
    transaction: Prisma.TransactionClient,
    input: CreateChatTurnInput,
  ): Promise<CreateChatTurnResult> {
    validateCreateInput(input);

    const existing = await transaction.chatTurn.findUnique({
      where: {
        userId_clientRequestId: {
          userId: input.userId,
          clientRequestId: input.clientRequestId,
        },
      },
    });
    if (existing) {
      assertSameRequest(existing, input);
      return { kind: 'existing', turn: existing } as const;
    }

    const conversation = await transaction.conversation.findUnique({
      where: {
        id_userId: {
          id: input.conversationId,
          userId: input.userId,
        },
      },
    });
    if (!conversation) throw conversationNotFound();

    const inputMessages = await transaction.chatMessage.findMany({
      where: {
        id: { in: input.inputMessageIds },
        userId: input.userId,
        conversationId: input.conversationId,
      },
      select: { id: true },
    });
    if (inputMessages.length !== input.inputMessageIds.length) {
      throw inputMessagesNotOwned();
    }

    const turn = await transaction.chatTurn.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId,
        clientRequestId: input.clientRequestId,
        status: 'QUEUED',
        inputHash: input.inputHash,
        inputMessageIds: input.inputMessageIds,
        budgetPolicyVersion: input.budgetPolicyVersion,
      },
    });
    return { kind: 'created', turn } as const;
  }

  findByIdForOwner(userId: string, turnId: string) {
    return this.prisma.chatTurn.findUnique({
      where: { id_userId: { id: turnId, userId } },
    });
  }

  async activateQueuedForOwner(input: {
    userId: string;
    turnId: string;
  }): Promise<ChatTurnTransitionResult> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await findOwnedTurn(transaction, input);
      if (!current) return { kind: 'not-found' } as const;
      if (current.status !== 'QUEUED') {
        return { kind: 'not-queued', turn: current } as const;
      }

      const databaseNow = await readDatabaseClock(transaction);
      const updated = await transaction.chatTurn.updateMany({
        where: {
          id: input.turnId,
          userId: input.userId,
          status: 'QUEUED',
          startedAt: null,
          finishedAt: null,
          responseMessageId: null,
          errorCode: null,
        },
        data: { status: 'ACTIVE', startedAt: databaseNow },
      });
      if (updated.count !== 1) {
        const winner = await findOwnedTurn(transaction, input);
        return winner
          ? ({ kind: 'not-queued', turn: winner } as const)
          : ({ kind: 'not-found' } as const);
      }

      const turn = await findOwnedTurn(transaction, input);
      if (!turn) throw new StateCasLostError();
      return { kind: 'activated', turn } as const;
    });
  }

  async completeActiveForOwner(input: {
    userId: string;
    turnId: string;
    responseMessageId: string;
  }): Promise<ChatTurnTransitionResult> {
    if (!input.responseMessageId.trim()) {
      throw new AppError(
        'CHAT_TURN_RESPONSE_INVALID',
        'responseMessageId is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await findOwnedTurn(transaction, input);
      if (!current) return { kind: 'not-found' } as const;
      if (current.status === 'SUCCEEDED') {
        return current.responseMessageId === input.responseMessageId
          ? ({ kind: 'already-completed', turn: current } as const)
          : ({ kind: 'invalid-state', turn: current } as const);
      }
      if (current.status !== 'ACTIVE') {
        return { kind: 'invalid-state', turn: current } as const;
      }

      const responseMessage = await transaction.chatMessage.findUnique({
        where: {
          id_userId: {
            id: input.responseMessageId,
            userId: input.userId,
          },
        },
      });
      if (!responseMessage) throw responseMessageNotFound();
      if (responseMessage.conversationId !== current.conversationId) {
        throw responseMessageConversationMismatch();
      }
      if (responseMessage.role !== 'ASSISTANT') {
        throw responseMessageInvalidRole();
      }

      const databaseNow = await readDatabaseClock(transaction);
      const updated = await transaction.chatTurn.updateMany({
        where: {
          id: input.turnId,
          userId: input.userId,
          status: 'ACTIVE',
          responseMessageId: null,
          errorCode: null,
          startedAt: { not: null },
          finishedAt: null,
        },
        data: {
          status: 'SUCCEEDED',
          responseMessageId: input.responseMessageId,
          finishedAt: databaseNow,
        },
      });
      if (updated.count !== 1) {
        const winner = await findOwnedTurn(transaction, input);
        return winner
          ? classifyCompletionRace(winner, input.responseMessageId)
          : ({ kind: 'not-found' } as const);
      }

      const turn = await findOwnedTurn(transaction, input);
      if (!turn) throw new StateCasLostError();
      return { kind: 'completed', turn } as const;
    });
  }

  async failActiveForOwner(input: {
    userId: string;
    turnId: string;
    errorCode: ChatTurnErrorCode;
  }): Promise<ChatTurnTransitionResult> {
    assertErrorCode(input.errorCode);

    return this.prisma.$transaction(async (transaction) => {
      const current = await findOwnedTurn(transaction, input);
      if (!current) return { kind: 'not-found' } as const;
      if (current.status === 'FAILED') {
        return current.errorCode === input.errorCode
          ? ({ kind: 'already-failed', turn: current } as const)
          : ({ kind: 'invalid-state', turn: current } as const);
      }
      if (current.status !== 'ACTIVE') {
        return { kind: 'invalid-state', turn: current } as const;
      }

      const databaseNow = await readDatabaseClock(transaction);
      const updated = await transaction.chatTurn.updateMany({
        where: {
          id: input.turnId,
          userId: input.userId,
          status: 'ACTIVE',
          responseMessageId: null,
          errorCode: null,
          startedAt: { not: null },
          finishedAt: null,
        },
        data: {
          status: 'FAILED',
          errorCode: input.errorCode,
          finishedAt: databaseNow,
        },
      });
      if (updated.count !== 1) {
        const winner = await findOwnedTurn(transaction, input);
        return winner
          ? classifyFailureRace(winner, input.errorCode)
          : ({ kind: 'not-found' } as const);
      }

      const turn = await findOwnedTurn(transaction, input);
      if (!turn) throw new StateCasLostError();
      return { kind: 'failed', turn } as const;
    });
  }

  async cancelForOwner(input: {
    userId: string;
    turnId: string;
    errorCode?: ChatTurnErrorCode;
  }): Promise<ChatTurnTransitionResult> {
    const errorCode = input.errorCode ?? 'CANCELLED_BY_USER';
    if (!CANCELLATION_ERROR_CODES.has(errorCode)) {
      throw new AppError(
        'CHAT_TURN_INVALID_CANCEL_CODE',
        'Only cancellation error codes may cancel a chat turn',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const current = await findOwnedTurn(transaction, input);
      if (!current) return { kind: 'not-found' } as const;
      if (current.status === 'CANCELLED') {
        return current.errorCode === errorCode
          ? ({ kind: 'already-cancelled', turn: current } as const)
          : ({ kind: 'invalid-state', turn: current } as const);
      }
      if (current.status !== 'QUEUED' && current.status !== 'ACTIVE') {
        return { kind: 'invalid-state', turn: current } as const;
      }

      const databaseNow = await readDatabaseClock(transaction);
      const updated = await transaction.chatTurn.updateMany({
        where: {
          id: input.turnId,
          userId: input.userId,
          status: current.status,
          responseMessageId: null,
          errorCode: null,
          ...(current.status === 'QUEUED'
            ? { startedAt: null, finishedAt: null }
            : { startedAt: { not: null }, finishedAt: null }),
        },
        data: {
          status: 'CANCELLED',
          errorCode,
          finishedAt: databaseNow,
        },
      });
      if (updated.count !== 1) {
        const winner = await findOwnedTurn(transaction, input);
        return winner
          ? classifyCancellationRace(winner, errorCode)
          : ({ kind: 'not-found' } as const);
      }

      const turn = await findOwnedTurn(transaction, input);
      if (!turn) throw new StateCasLostError();
      return { kind: 'cancelled', turn } as const;
    });
  }
}

async function findOwnedTurn(
  transaction: Prisma.TransactionClient,
  input: { userId: string; turnId: string },
) {
  return transaction.chatTurn.findUnique({
    where: { id_userId: { id: input.turnId, userId: input.userId } },
  });
}

async function readDatabaseClock(transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  const row = rows[0];
  if (!row) throw new Error('Database clock query returned no rows');
  return row.now;
}

function validateCreateInput(input: CreateChatTurnInput) {
  if (!input.userId.trim() || !input.conversationId.trim()) {
    throw new AppError(
      'CHAT_TURN_INVALID_OWNER',
      'userId and conversationId are required',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!input.clientRequestId.trim() || input.clientRequestId.length > 120) {
    throw new AppError(
      'CHAT_TURN_INVALID_REQUEST_ID',
      'clientRequestId is invalid',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (!INPUT_HASH_PATTERN.test(input.inputHash)) {
    throw new AppError(
      'CHAT_TURN_INVALID_INPUT_HASH',
      'inputHash must be a lowercase SHA-256 digest',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    input.inputMessageIds.length < 1 ||
    input.inputMessageIds.length > 1000 ||
    new Set(input.inputMessageIds).size !== input.inputMessageIds.length ||
    input.inputMessageIds.some((id) => !id.trim())
  ) {
    throw new AppError(
      'CHAT_TURN_INVALID_INPUT_MESSAGES',
      'inputMessageIds must contain 1 to 1000 unique message ids',
      HttpStatus.BAD_REQUEST,
    );
  }
  if (
    !input.budgetPolicyVersion.trim() ||
    input.budgetPolicyVersion.length > 80
  ) {
    throw new AppError(
      'CHAT_TURN_INVALID_BUDGET_POLICY',
      'budgetPolicyVersion is invalid',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function assertSameRequest(turn: ChatTurn, input: CreateChatTurnInput) {
  if (
    turn.conversationId !== input.conversationId ||
    turn.inputHash !== input.inputHash ||
    turn.budgetPolicyVersion !== input.budgetPolicyVersion ||
    !sameStringArray(turn.inputMessageIds, input.inputMessageIds)
  ) {
    throw new AppError(
      'CHAT_TURN_IDEMPOTENCY_CONFLICT',
      'clientRequestId is already used by a different chat turn request',
      HttpStatus.CONFLICT,
    );
  }
}

function sameStringArray(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function assertErrorCode(value: ChatTurnErrorCode) {
  if (
    ![
      'CANCELLED_BY_USER',
      'BUDGET_EXHAUSTED',
      'GENERATION_ABORTED',
      'GENERATION_TIMEOUT',
      'PROVIDER_FAILURE',
      'OUTPUT_INVALID',
      'INTERNAL_FAILURE',
    ].includes(value)
  ) {
    throw new AppError(
      'CHAT_TURN_INVALID_ERROR_CODE',
      'errorCode is invalid',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function classifyCompletionRace(turn: ChatTurn, responseMessageId: string) {
  return turn.status === 'SUCCEEDED' &&
    turn.responseMessageId === responseMessageId
    ? ({ kind: 'already-completed', turn } as const)
    : ({ kind: 'invalid-state', turn } as const);
}

function classifyFailureRace(turn: ChatTurn, errorCode: ChatTurnErrorCode) {
  return turn.status === 'FAILED' && turn.errorCode === errorCode
    ? ({ kind: 'already-failed', turn } as const)
    : ({ kind: 'invalid-state', turn } as const);
}

function classifyCancellationRace(
  turn: ChatTurn,
  errorCode: ChatTurnErrorCode,
) {
  return turn.status === 'CANCELLED' && turn.errorCode === errorCode
    ? ({ kind: 'already-cancelled', turn } as const)
    : ({ kind: 'invalid-state', turn } as const);
}

function conversationNotFound() {
  return new AppError(
    'CHAT_CONVERSATION_NOT_FOUND',
    '聊天会话不存在',
    HttpStatus.NOT_FOUND,
  );
}

function inputMessagesNotOwned() {
  return new AppError(
    'CHAT_TURN_INPUT_MESSAGES_NOT_FOUND',
    '聊天输入消息不存在或不属于该会话',
    HttpStatus.CONFLICT,
  );
}

function responseMessageNotFound() {
  return new AppError(
    'CHAT_TURN_RESPONSE_NOT_FOUND',
    '回答消息不存在或不属于该用户',
    HttpStatus.CONFLICT,
  );
}

function responseMessageConversationMismatch() {
  return new AppError(
    'CHAT_TURN_RESPONSE_CONVERSATION_MISMATCH',
    '回答消息不属于该聊天会话',
    HttpStatus.CONFLICT,
  );
}

function responseMessageInvalidRole() {
  return new AppError(
    'CHAT_TURN_RESPONSE_INVALID_ROLE',
    'Chat turn responses must reference an assistant message',
    HttpStatus.CONFLICT,
  );
}

function isRetryableCreateConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    return (
      error.meta?.modelName === 'ChatTurn' &&
      Array.isArray(target) &&
      target.length === 2 &&
      target.includes('userId') &&
      target.includes('clientRequestId')
    );
  }
  return readErrorCode(error) === '40001';
}

function readErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as { code?: unknown };
  return typeof value.code === 'string' ? value.code : undefined;
}

class StateCasLostError extends Error {}
