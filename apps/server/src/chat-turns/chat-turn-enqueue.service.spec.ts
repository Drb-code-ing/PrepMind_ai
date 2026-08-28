import {
  Prisma,
  type BackgroundJob,
  type ChatTurn,
  type OutboxEvent,
} from '@prisma/client';

import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  CHAT_RESPONSE_REQUESTED_EVENT,
  CHAT_RESPONSE_RESOURCE_TYPE,
} from './chat-turn.constants';
import {
  ChatTurnEnqueueService,
  type ChatTurnEnqueueResult,
} from './chat-turn-enqueue.service';
import {
  ChatTurnsRepository,
  type CreateChatTurnInput,
} from './chat-turns.repository';

const USER_ID = 'user_1';
const OTHER_USER_ID = 'user_2';
const CONVERSATION_ID = 'conversation_1';
const INPUT_MESSAGE_ID = 'message_input';
const OTHER_INPUT_MESSAGE_ID = 'message_input_other';
const INPUT_HASH = `sha256:${'a'.repeat(64)}`;
const OTHER_INPUT_HASH = `sha256:${'b'.repeat(64)}`;
const NOW = new Date('2026-08-28T09:00:00.000Z');

describe('ChatTurnEnqueueService', () => {
  it('creates turn, background job, and outbox event in order in one Serializable transaction', async () => {
    const harness = createHarness();
    const result = await harness.service.enqueue(createInput());

    expect(result.kind).toBe('created');
    expect(harness.events).toEqual(['turn', 'job', 'outbox']);
    expect(harness.state.turns).toHaveLength(1);
    expect(harness.state.jobs).toHaveLength(1);
    expect(harness.state.outbox).toHaveLength(1);
    expect(harness.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const job = harness.state.jobs[0];
    const event = harness.state.outbox[0];
    expect(job).toMatchObject({
      status: 'QUEUED',
      scope: 'ACCOUNT',
      resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
      resourceId: harness.state.turns[0]?.id,
    });
    expect(event).toMatchObject({
      type: CHAT_RESPONSE_REQUESTED_EVENT,
      aggregateType: 'ChatTurn',
      aggregateId: harness.state.turns[0]?.id,
      idempotencyKey: `chat.response.requested:${harness.state.turns[0]?.id}`,
    });
    expect(event.payload).toEqual({
      turnId: harness.state.turns[0]?.id,
      backgroundJobId: job?.id,
      inputHash: INPUT_HASH,
      budgetPolicyVersion: 'chat-budget-v1',
    });
    expect(JSON.stringify(event.payload)).not.toContain('question body');
    expect(JSON.stringify(event.payload)).not.toContain('provider-secret');
  });

  it('rolls back the turn when background job creation fails', async () => {
    const harness = createHarness();
    harness.transaction.backgroundJob.create.mockRejectedValueOnce(
      new Error('job write failed'),
    );

    await expect(harness.service.enqueue(createInput())).rejects.toThrow(
      'job write failed',
    );
    expect(harness.state.turns).toHaveLength(0);
    expect(harness.state.jobs).toHaveLength(0);
    expect(harness.state.outbox).toHaveLength(0);
    expect(harness.events).toEqual(['turn']);
    expect(harness.transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rolls back turn and job when outbox creation fails', async () => {
    const harness = createHarness();
    harness.transaction.outboxEvent.create.mockRejectedValueOnce(
      new Error('outbox write failed'),
    );

    await expect(harness.service.enqueue(createInput())).rejects.toThrow(
      'outbox write failed',
    );
    expect(harness.state.turns).toHaveLength(0);
    expect(harness.state.jobs).toHaveLength(0);
    expect(harness.state.outbox).toHaveLength(0);
  });

  it('returns the existing paired facts for a duplicate request without creating more work', async () => {
    const harness = createHarness();
    const first = await harness.service.enqueue(createInput());
    const second = await harness.service.enqueue(createInput());

    expect(first.kind).toBe('created');
    expect(second).toEqual({
      kind: 'existing',
      turn: first.turn,
      backgroundJob: first.backgroundJob,
      outboxEvent: first.outboxEvent,
    });
    expect(harness.state.turns).toHaveLength(1);
    expect(harness.state.jobs).toHaveLength(1);
    expect(harness.state.outbox).toHaveLength(1);
    expect(harness.transaction.chatTurn.create).toHaveBeenCalledTimes(1);
    expect(harness.transaction.backgroundJob.create).toHaveBeenCalledTimes(1);
    expect(harness.transaction.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a different request under the same owner key without writing new facts', async () => {
    const harness = createHarness();
    await harness.service.enqueue(createInput());

    await expect(
      harness.service.enqueue(createInput({ inputHash: OTHER_INPUT_HASH })),
    ).rejects.toMatchObject({
      code: 'CHAT_TURN_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(harness.state.turns).toHaveLength(1);
    expect(harness.state.jobs).toHaveLength(1);
    expect(harness.state.outbox).toHaveLength(1);
  });

  it('allows the same client key for a different owner', async () => {
    const harness = createHarness();
    const first = await harness.service.enqueue(createInput());
    const second = await harness.service.enqueue(
      createInput({
        userId: OTHER_USER_ID,
        inputMessageIds: [OTHER_INPUT_MESSAGE_ID],
        inputHash: OTHER_INPUT_HASH,
      }),
    );

    expect(first.kind).toBe('created');
    expect(second.kind).toBe('created');
    expect(harness.state.turns.map((turn) => turn.userId)).toEqual([
      USER_ID,
      OTHER_USER_ID,
    ]);
    expect(harness.state.jobs).toHaveLength(2);
    expect(harness.state.outbox).toHaveLength(2);
  });

  it('retries serialization conflicts with a fresh transaction', async () => {
    const harness = createHarness();
    const serializationConflict = new Prisma.PrismaClientKnownRequestError(
      'serialization conflict',
      { code: 'P2034', clientVersion: 'test' },
    );
    harness.prisma.$transaction
      .mockRejectedValueOnce(serializationConflict)
      .mockImplementationOnce(async (callback: TransactionCallback) =>
        callback(harness.transaction),
      );

    const result = await harness.service.enqueue(createInput());

    expect(result.kind).toBe('created');
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(harness.state.turns).toHaveLength(1);
  });

  it('fails closed if a previously committed turn has no durable pair', async () => {
    const harness = createHarness();
    const first = await harness.service.enqueue(createInput());
    if (first.kind !== 'created') throw new Error('expected created result');
    harness.state.jobs.length = 0;

    await expect(harness.service.enqueue(createInput())).rejects.toMatchObject({
      code: 'CHAT_ENQUEUE_PAIR_MISSING',
      statusCode: 503,
    });
    expect(harness.state.turns).toHaveLength(1);
    expect(harness.state.outbox).toHaveLength(1);
  });
});

type Harness = ReturnType<typeof createHarness>;
type TransactionCallback = (transaction: never) => Promise<unknown>;

function createInput(
  overrides: Partial<CreateChatTurnInput> = {},
): CreateChatTurnInput {
  return {
    userId: USER_ID,
    conversationId: CONVERSATION_ID,
    clientRequestId: 'client-request-1',
    inputHash: INPUT_HASH,
    inputMessageIds: [INPUT_MESSAGE_ID],
    budgetPolicyVersion: 'chat-budget-v1',
    ...overrides,
  };
}

function createHarness() {
  const state: {
    turns: ChatTurn[];
    jobs: BackgroundJob[];
    outbox: OutboxEvent[];
  } = { turns: [], jobs: [], outbox: [] };
  const events: string[] = [];

  const transaction = {
    chatTurn: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(
          state.turns.find(
            (turn) =>
              turn.userId === where.userId_clientRequestId?.userId &&
              turn.clientRequestId ===
                where.userId_clientRequestId?.clientRequestId,
          ) ?? null,
        ),
      ),
      create: jest.fn(({ data }: any) => {
        events.push('turn');
        const turn = makeTurn(data);
        state.turns.push(turn);
        return Promise.resolve(turn);
      }),
    },
    conversation: {
      findUnique: jest.fn(() => Promise.resolve({ id: CONVERSATION_ID })),
    },
    chatMessage: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(where.id.in.map((id: string) => ({ id }))),
      ),
    },
    backgroundJob: {
      create: jest.fn(({ data }: any) => {
        events.push('job');
        const job = makeJob(data);
        state.jobs.push(job);
        return Promise.resolve(job);
      }),
      findFirst: jest.fn(({ where }: any) =>
        Promise.resolve(
          state.jobs.find(
            (job) =>
              job.userId === where.userId &&
              job.scope === where.scope &&
              job.resourceType === where.resourceType &&
              job.resourceId === where.resourceId &&
              job.idempotencyKey === where.idempotencyKey,
          ) ?? null,
        ),
      ),
    },
    outboxEvent: {
      create: jest.fn(({ data }: any) => {
        events.push('outbox');
        const event = makeOutbox(data);
        state.outbox.push(event);
        return Promise.resolve(event);
      }),
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(
          state.outbox.find(
            (event) => event.idempotencyKey === where.idempotencyKey,
          ) ?? null,
        ),
      ),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (callback: any) => {
      const turnCount = state.turns.length;
      const jobCount = state.jobs.length;
      const outboxCount = state.outbox.length;
      try {
        return await callback(transaction);
      } catch (error) {
        state.turns.length = turnCount;
        state.jobs.length = jobCount;
        state.outbox.length = outboxCount;
        throw error;
      }
    }),
  };

  const service = new ChatTurnEnqueueService(
    prisma as never,
    new ChatTurnsRepository(prisma as never),
    new BackgroundJobsService(prisma as never),
    new OutboxService(prisma as never),
  );

  return { service, prisma, transaction, state, events };
}

function makeTurn(data: Record<string, unknown>) {
  return {
    id: `turn_${String(data.userId)}_${Date.now()}_${Math.random()}`,
    userId: data.userId,
    conversationId: data.conversationId,
    clientRequestId: data.clientRequestId,
    status: 'QUEUED',
    inputHash: data.inputHash,
    inputMessageIds: data.inputMessageIds,
    budgetPolicyVersion: data.budgetPolicyVersion,
    responseMessageId: null,
    errorCode: null,
    startedAt: null,
    finishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as ChatTurn;
}

function makeJob(data: Record<string, unknown>) {
  return {
    id: `job_${String(data.resourceId)}`,
    userId: data.userId,
    scope: data.scope,
    queueName: data.queueName,
    jobName: data.jobName,
    bullJobId: null,
    status: data.status,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    idempotencyKey: data.idempotencyKey,
    dedupeKey: data.dedupeKey,
    attempt: 0,
    maxAttempts: data.maxAttempts,
    progress: 0,
    payloadHash: data.payloadHash,
    payloadPreview: data.payloadPreview,
    resultSummary: null,
    errorCode: null,
    errorMessage: null,
    requestedAt: NOW,
    startedAt: null,
    finishedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as BackgroundJob;
}

function makeOutbox(data: Record<string, unknown>) {
  return {
    id: `outbox_${String(data.aggregateId)}`,
    type: data.type,
    status: 'PENDING',
    aggregateType: data.aggregateType,
    aggregateId: data.aggregateId,
    idempotencyKey: data.idempotencyKey,
    payload: data.payload,
    payloadHash: data.payloadHash,
    attempts: 0,
    maxAttempts: data.maxAttempts,
    nextRunAt: NOW,
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: null,
    lastError: null,
    processedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as OutboxEvent;
}
