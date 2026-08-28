import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { BackgroundJob, ChatTurn } from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import { createHash } from 'node:crypto';

import {
  CHAT_RESPONSE_JOB,
  CHAT_RESPONSE_QUEUE,
  CHAT_RESPONSE_REQUESTED_EVENT,
  CHAT_RESPONSE_RESOURCE_TYPE,
} from '../chat-turns/chat-turn.constants';
import {
  chatResponseJobPayloadSchema,
  type ChatResponseJobPayload,
} from '../chat-turns/chat-response.job';
import { PrismaService } from '../database/prisma.service';
import { OutboxHandlerError, type OutboxEventHandler } from './outbox.handlers';

const CHAT_RESPONSE_BACKOFF_MS = 5_000;

/**
 * Bridges the durable outbox record to BullMQ. The deterministic Bull job id
 * and the database link make the operation idempotent across a crash between
 * queue.add() and the outbox success transition.
 */
@Injectable()
export class ChatResponseRequestedHandler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CHAT_RESPONSE_QUEUE)
    private readonly queue: Queue<ChatResponseJobPayload>,
  ) {}

  readonly handle: OutboxEventHandler = async (event) => {
    const payload = parsePayload(event.payload);
    if (event.type !== CHAT_RESPONSE_REQUESTED_EVENT) {
      throw invalidPayload('Chat response event type is invalid');
    }

    const [turn, backgroundJob] = await Promise.all([
      this.prisma.chatTurn.findUnique({ where: { id: payload.turnId } }),
      this.prisma.backgroundJob.findUnique({
        where: { id: payload.backgroundJobId },
      }),
    ]);
    const linked = assertLinkedFacts(turn, backgroundJob, payload, event);

    // A terminal turn is authoritative, but its paired BackgroundJob must be
    // reconciled before the requested event can be acknowledged. A terminal
    // job with a non-terminal turn is not safe to ignore: doing so would leave
    // the turn permanently queued/active with no executable work.
    if (isTerminalTurn(linked.turn.status)) {
      await this.reconcileTerminalJob(linked.turn, linked.backgroundJob);
      return;
    }
    if (isTerminalJob(linked.backgroundJob.status)) {
      throw invalidPayload(
        'Chat response BackgroundJob is terminal while ChatTurn is active',
      );
    }
    if (!isRunnableTurn(linked.turn.status)) {
      throw invalidPayload('Chat response delivery states are invalid');
    }
    if (linked.backgroundJob.status === 'ACTIVE') {
      if (
        linked.turn.status !== 'ACTIVE' ||
        linked.backgroundJob.bullJobId !== linked.backgroundJob.id
      ) {
        throw invalidPayload(
          'Chat response active delivery states are invalid',
        );
      }
      // The requested event may be retried after the worker has already
      // claimed the Bull job but before the dispatcher acknowledged the
      // outbox row. Verify the existing Bull record. If it has disappeared,
      // fail closed rather than resetting an active claim while another worker
      // may still be running; a recovery sweeper can make that decision with a
      // lease, which this baseline deliberately does not invent.
      const activeJob = await this.queue.getJob(linked.backgroundJob.id);
      if (!activeJob) {
        throw transientDeliveryFailure(
          'Claimed chat response Bull job is missing',
        );
      }
      assertExistingBullJob(activeJob, payload);
      return;
    }
    if (linked.backgroundJob.status !== 'QUEUED') {
      throw invalidPayload('Chat response delivery states are invalid');
    }

    const bullJobId = await this.ensureBullJob(payload, linked.backgroundJob);
    await this.linkBullJob(linked.backgroundJob, linked.turn, bullJobId);
  };

  private async ensureBullJob(
    payload: ChatResponseJobPayload,
    backgroundJob: BackgroundJob,
  ) {
    const existing = await this.queue.getJob(backgroundJob.id);
    if (existing) {
      assertExistingBullJob(existing, payload);
      return String(existing.id);
    }

    try {
      const bullJob = await this.queue.add(CHAT_RESPONSE_JOB, payload, {
        jobId: backgroundJob.id,
        attempts: backgroundJob.maxAttempts,
        backoff: { type: 'exponential', delay: CHAT_RESPONSE_BACKOFF_MS },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800, count: 3_000 },
      });
      assertBullJobId(bullJob, payload);
      return String(bullJob.id);
    } catch (error) {
      // A second dispatcher may have won the add race. Re-read before
      // surfacing a transient Redis error to the outbox retry state machine.
      const raced = await this.queue.getJob(backgroundJob.id);
      if (!raced) throw error;
      assertExistingBullJob(raced, payload);
      return String(raced.id);
    }
  }

  private async linkBullJob(
    backgroundJob: BackgroundJob,
    turn: ChatTurn,
    bullJobId: string,
  ) {
    if (backgroundJob.bullJobId && backgroundJob.bullJobId !== bullJobId) {
      throw invalidPayload('Chat response Bull job link is inconsistent');
    }
    if (backgroundJob.bullJobId === bullJobId) return;

    const updated = await this.prisma.backgroundJob.updateMany({
      where: {
        id: backgroundJob.id,
        userId: turn.userId,
        scope: 'ACCOUNT',
        resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
        resourceId: turn.id,
        bullJobId: null,
      },
      data: { bullJobId },
    });
    if (updated.count === 1) return;

    const current = await this.prisma.backgroundJob.findUnique({
      where: { id: backgroundJob.id },
    });
    if (!current || current.bullJobId !== bullJobId) {
      throw invalidPayload(
        'Chat response Bull job link could not be committed',
      );
    }
  }

  private async reconcileTerminalJob(
    turn: ChatTurn,
    backgroundJob: BackgroundJob,
  ) {
    if (isTerminalJob(backgroundJob.status)) {
      if (!compatibleTerminalStates(turn.status, backgroundJob.status)) {
        throw invalidPayload(
          'Chat response terminal Turn and BackgroundJob states disagree',
        );
      }
      return;
    }

    const data = terminalJobUpdate(turn);
    const updated = await this.prisma.backgroundJob.updateMany({
      where: {
        id: backgroundJob.id,
        userId: turn.userId,
        scope: 'ACCOUNT',
        status: { in: ['QUEUED', 'ACTIVE'] },
      },
      data,
    });
    if (updated.count === 1) return;

    const current = await this.prisma.backgroundJob.findUnique({
      where: { id: backgroundJob.id },
    });
    if (!current || !compatibleTerminalStates(turn.status, current.status)) {
      throw invalidPayload(
        'Chat response terminal BackgroundJob reconciliation was lost',
      );
    }
  }
}

function parsePayload(value: unknown): ChatResponseJobPayload {
  const parsed = chatResponseJobPayloadSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidPayload('Chat response outbox payload is invalid');
  }
  return parsed.data;
}

function assertLinkedFacts(
  turn: ChatTurn | null,
  backgroundJob: BackgroundJob | null,
  payload: ChatResponseJobPayload,
  event: {
    type: string;
    aggregateType?: string | null;
    aggregateId?: string | null;
    payloadHash?: string | null;
  },
): { turn: ChatTurn; backgroundJob: BackgroundJob } {
  if (!turn || !backgroundJob) {
    throw invalidPayload('Chat response delivery facts are missing');
  }
  if (
    event.aggregateType !== 'ChatTurn' ||
    event.aggregateId !== turn.id ||
    turn.inputHash !== payload.inputHash ||
    turn.budgetPolicyVersion !== payload.budgetPolicyVersion ||
    backgroundJob.userId !== turn.userId ||
    backgroundJob.scope !== 'ACCOUNT' ||
    backgroundJob.queueName !== CHAT_RESPONSE_QUEUE ||
    backgroundJob.jobName !== CHAT_RESPONSE_JOB ||
    backgroundJob.resourceType !== CHAT_RESPONSE_RESOURCE_TYPE ||
    backgroundJob.resourceId !== turn.id ||
    (event.payloadHash !== undefined &&
      event.payloadHash !== null &&
      event.payloadHash !== hashProjection(payload))
  ) {
    throw invalidPayload('Chat response delivery facts are inconsistent');
  }

  return { turn, backgroundJob };
}

function assertExistingBullJob(
  job: Job<unknown>,
  payload: ChatResponseJobPayload,
) {
  assertBullJobId(job, payload);
  if (job.name !== CHAT_RESPONSE_JOB) {
    throw invalidPayload('Existing Bull job name is inconsistent');
  }
  const parsed = chatResponseJobPayloadSchema.safeParse(job.data);
  if (!parsed.success || !samePayload(parsed.data, payload)) {
    throw invalidPayload('Existing Bull job payload is inconsistent');
  }
}

function assertBullJobId(
  job: Pick<Job<unknown>, 'id'>,
  payload: ChatResponseJobPayload,
) {
  if (String(job.id) !== payload.backgroundJobId) {
    throw invalidPayload('Bull job id is inconsistent with the durable job');
  }
}

function samePayload(
  left: ChatResponseJobPayload,
  right: ChatResponseJobPayload,
) {
  return (
    left.turnId === right.turnId &&
    left.backgroundJobId === right.backgroundJobId &&
    left.inputHash === right.inputHash &&
    left.budgetPolicyVersion === right.budgetPolicyVersion
  );
}

function hashProjection(payload: ChatResponseJobPayload) {
  // Keep the order identical to ChatTurnEnqueueService's projection hash.
  const canonical = {
    turnId: payload.turnId,
    inputHash: payload.inputHash,
    budgetPolicyVersion: payload.budgetPolicyVersion,
    backgroundJobId: payload.backgroundJobId,
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`;
}

function isTerminalTurn(status: ChatTurn['status']) {
  return (
    status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED'
  );
}

function isTerminalJob(status: BackgroundJob['status']) {
  return (
    status === 'SUCCEEDED' ||
    status === 'FAILED' ||
    status === 'CANCELLED' ||
    status === 'STALE_SKIPPED'
  );
}

function isRunnableTurn(status: ChatTurn['status']) {
  return status === 'QUEUED' || status === 'ACTIVE';
}

function compatibleTerminalStates(
  turnStatus: ChatTurn['status'],
  jobStatus: BackgroundJob['status'],
) {
  return (
    (turnStatus === 'SUCCEEDED' && jobStatus === 'SUCCEEDED') ||
    (turnStatus === 'FAILED' && jobStatus === 'FAILED') ||
    (turnStatus === 'CANCELLED' && jobStatus === 'CANCELLED')
  );
}

function terminalJobUpdate(turn: ChatTurn) {
  if (turn.status === 'SUCCEEDED') {
    if (!turn.responseMessageId) {
      throw invalidPayload(
        'Succeeded ChatTurn is missing its response message reference',
      );
    }
    return {
      status: 'SUCCEEDED' as const,
      progress: 100,
      resultSummary: {
        turnId: turn.id,
        responseMessageId: turn.responseMessageId,
        reconciled: true,
      },
      errorCode: null,
      errorMessage: null,
      finishedAt: turn.finishedAt ?? new Date(),
    };
  }

  return {
    status:
      turn.status === 'CANCELLED'
        ? ('CANCELLED' as const)
        : ('FAILED' as const),
    errorCode: turn.errorCode,
    errorMessage:
      turn.status === 'CANCELLED'
        ? 'Chat turn was cancelled before queue delivery'
        : 'Chat turn reached a failed terminal state before queue delivery',
    finishedAt: turn.finishedAt ?? new Date(),
  };
}

function invalidPayload(message: string) {
  return new OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', message);
}

function transientDeliveryFailure(message: string) {
  return new OutboxHandlerError('OUTBOX_HANDLER_FAILED', message);
}
