import { createHash } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  type BackgroundJob,
  type ChatTurn,
  type OutboxEvent,
} from '@prisma/client';

import { AppError } from '../common/errors/app-error';
import {
  BackgroundJobsService,
  type CreateQueuedBackgroundJobInput,
} from '../background-jobs/background-jobs.service';
import { PrismaService } from '../database/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  CHAT_RESPONSE_JOB,
  CHAT_RESPONSE_QUEUE,
  CHAT_RESPONSE_REQUESTED_EVENT,
  CHAT_RESPONSE_RESOURCE_TYPE,
  chatResponseJobDedupeKey,
  chatResponseJobIdempotencyKey,
  chatResponseRequestedIdempotencyKey,
} from './chat-turn.constants';
import {
  ChatTurnsRepository,
  type CreateChatTurnInput,
} from './chat-turns.repository';

const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 5;
const CHAT_RESPONSE_MAX_ATTEMPTS = 3;

type ChatResponseProjection = {
  turnId: string;
  backgroundJobId: string;
  inputHash: string;
  budgetPolicyVersion: string;
};

export type ChatTurnEnqueueResult = {
  kind: 'created' | 'existing';
  turn: ChatTurn;
  backgroundJob: BackgroundJob;
  outboxEvent: OutboxEvent;
};

/**
 * Owns the only write boundary for a queued chat response. No queue or model
 * call happens here; a committed outbox event is the hand-off to a future
 * dispatcher/worker.
 */
@Injectable()
export class ChatTurnEnqueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatTurns: ChatTurnsRepository,
    private readonly backgroundJobs: BackgroundJobsService,
    private readonly outbox: OutboxService,
  ) {}

  async enqueue(input: CreateChatTurnInput): Promise<ChatTurnEnqueueResult> {
    const runTransaction = () =>
      this.prisma.$transaction(
        async (transaction) => {
          const turnResult =
            await this.chatTurns.createOrGetQueuedInTransaction(
              transaction,
              input,
            );
          const turn = turnResult.turn;
          const jobIdempotencyKey = chatResponseJobIdempotencyKey(turn.id);
          const eventIdempotencyKey = chatResponseRequestedIdempotencyKey(
            turn.id,
          );

          if (turnResult.kind === 'existing') {
            const backgroundJob = await transaction.backgroundJob.findFirst({
              where: {
                userId: input.userId,
                scope: 'ACCOUNT',
                resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
                resourceId: turn.id,
                idempotencyKey: jobIdempotencyKey,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            });
            const outboxEvent = await transaction.outboxEvent.findUnique({
              where: { idempotencyKey: eventIdempotencyKey },
            });
            if (
              !backgroundJob ||
              !outboxEvent ||
              !isPairedChatResponseFacts(turn, backgroundJob, outboxEvent)
            ) {
              throw enqueuePairMissing(turn.id);
            }

            return {
              kind: 'existing',
              turn,
              backgroundJob,
              outboxEvent,
            } as const;
          }

          const projectionWithoutJob = {
            turnId: turn.id,
            inputHash: turn.inputHash,
            budgetPolicyVersion: turn.budgetPolicyVersion,
          };
          const backgroundJobInput: CreateQueuedBackgroundJobInput = {
            userId: input.userId,
            queueName: CHAT_RESPONSE_QUEUE,
            jobName: CHAT_RESPONSE_JOB,
            resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
            resourceId: turn.id,
            idempotencyKey: jobIdempotencyKey,
            dedupeKey: chatResponseJobDedupeKey(turn.id),
            maxAttempts: CHAT_RESPONSE_MAX_ATTEMPTS,
            payloadHash: hashProjection(projectionWithoutJob),
            // The job preview intentionally omits the job id, which does not
            // exist until this insert returns. The outbox carries the complete
            // four-field projection used by the dispatcher.
            payloadPreview: projectionWithoutJob,
          };
          const backgroundJob =
            await this.backgroundJobs.createQueuedJobInTransaction(
              transaction,
              backgroundJobInput,
            );
          const projection: ChatResponseProjection = {
            ...projectionWithoutJob,
            backgroundJobId: backgroundJob.id,
          };
          const outboxEvent = await this.outbox.enqueueInTransaction(
            transaction,
            {
              type: CHAT_RESPONSE_REQUESTED_EVENT,
              aggregateType: 'ChatTurn',
              aggregateId: turn.id,
              idempotencyKey: eventIdempotencyKey,
              payload: projection,
              payloadHash: hashProjection(projection),
              maxAttempts: CHAT_RESPONSE_MAX_ATTEMPTS,
            },
          );

          return {
            kind: 'created',
            turn,
            backgroundJob,
            outboxEvent,
          } as const;
        },
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
          !isRetryableChatEnqueueConflict(error)
        ) {
          throw error;
        }
      }
    }

    throw new Error('Chat enqueue transaction retry loop exhausted');
  }
}

function hashProjection(value: Record<string, string>) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function enqueuePairMissing(turnId: string) {
  return new AppError(
    'CHAT_ENQUEUE_PAIR_MISSING',
    `Chat turn ${turnId} has no durable background job and outbox pair`,
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

function isPairedChatResponseFacts(
  turn: ChatTurn,
  backgroundJob: BackgroundJob,
  outboxEvent: OutboxEvent,
) {
  if (
    backgroundJob.userId !== turn.userId ||
    backgroundJob.scope !== 'ACCOUNT' ||
    backgroundJob.resourceType !== CHAT_RESPONSE_RESOURCE_TYPE ||
    backgroundJob.resourceId !== turn.id ||
    backgroundJob.idempotencyKey !== chatResponseJobIdempotencyKey(turn.id)
  ) {
    return false;
  }
  if (
    outboxEvent.type !== CHAT_RESPONSE_REQUESTED_EVENT ||
    outboxEvent.aggregateType !== 'ChatTurn' ||
    outboxEvent.aggregateId !== turn.id ||
    outboxEvent.idempotencyKey !== chatResponseRequestedIdempotencyKey(turn.id)
  ) {
    return false;
  }

  const payload = outboxEvent.payload;
  return (
    isRecord(payload) &&
    payload.turnId === turn.id &&
    payload.backgroundJobId === backgroundJob.id &&
    payload.inputHash === turn.inputHash &&
    payload.budgetPolicyVersion === turn.budgetPolicyVersion &&
    Object.keys(payload).length === 4
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRetryableChatEnqueueConflict(error: unknown) {
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
