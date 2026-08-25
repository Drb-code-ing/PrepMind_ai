import { Prisma, type ChatMessage, type ChatTurn } from '@prisma/client';

import {
  type CreateChatTurnInput,
  ChatTurnsRepository,
} from './chat-turns.repository';

const USER_ID = 'user_1';
const OTHER_USER_ID = 'user_2';
const CONVERSATION_ID = 'conversation_1';
const OTHER_CONVERSATION_ID = 'conversation_2';
const INPUT_MESSAGE_ID = 'message_input';
const RESPONSE_MESSAGE_ID = 'message_response';
const INPUT_HASH = `sha256:${'a'.repeat(64)}`;
const DATABASE_NOW = new Date('2026-08-25T09:00:00.000Z');

describe('ChatTurnsRepository', () => {
  it('creates an owner-scoped queued turn and returns the same turn for an idempotent request', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);

    const first = await repository.createOrGetQueued(createInput());
    const second = await repository.createOrGetQueued(createInput());

    expect(first.kind).toBe('created');
    expect(second).toEqual({ kind: 'existing', turn: first.turn });
    expect(harness.state.turns).toHaveLength(1);
    expect(harness.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(harness.transaction.backgroundJob).toBeUndefined();
    expect(harness.transaction.outboxEvent).toBeUndefined();
  });

  it('rejects a different input under the same owner idempotency key without overwriting the turn', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    await repository.createOrGetQueued(createInput());

    await expect(
      repository.createOrGetQueued(
        createInput({ inputHash: `sha256:${'b'.repeat(64)}` }),
      ),
    ).rejects.toMatchObject({
      code: 'CHAT_TURN_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(harness.state.turns[0]?.inputHash).toBe(INPUT_HASH);
  });

  it('allows the same client request id for a different owner', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);

    const first = await repository.createOrGetQueued(createInput());
    const second = await repository.createOrGetQueued(
      createInput({
        userId: OTHER_USER_ID,
        inputMessageIds: [`${OTHER_USER_ID}_${INPUT_MESSAGE_ID}`],
      }),
    );

    expect(first.kind).toBe('created');
    expect(second.kind).toBe('created');
    expect(harness.state.turns).toHaveLength(2);
    expect(harness.state.turns.map((turn) => turn.userId)).toEqual([
      USER_ID,
      OTHER_USER_ID,
    ]);
  });

  it('retries the owner idempotency unique conflict and returns the committed turn', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError(
      'unique conflict',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          modelName: 'ChatTurn',
          target: ['userId', 'clientRequestId'],
        },
      },
    );
    harness.transaction.chatTurn.create.mockImplementationOnce(
      ({ data }: { data: Partial<ChatTurn> }) => {
        const turn = makeTurn(data);
        harness.state.turns.push(turn);
        return Promise.reject(uniqueConflict);
      },
    );

    const result = await repository.createOrGetQueued(createInput());

    expect(result.kind).toBe('existing');
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(harness.state.turns).toHaveLength(1);
  });

  it('does not expose another owner turn through find or state transitions', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    const created = await repository.createOrGetQueued(createInput());

    expect(
      await repository.findByIdForOwner(OTHER_USER_ID, created.turn.id),
    ).toBeNull();
    expect(
      await repository.activateQueuedForOwner({
        userId: OTHER_USER_ID,
        turnId: created.turn.id,
      }),
    ).toEqual({ kind: 'not-found' });
    expect(harness.state.turns[0]?.status).toBe('QUEUED');
  });

  it('allows only one queued claimant when the CAS loses a race', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    const created = await repository.createOrGetQueued(createInput());
    harness.transaction.chatTurn.updateMany.mockImplementationOnce(() =>
      Promise.resolve({ count: 0 }),
    );

    const result = await repository.activateQueuedForOwner({
      userId: USER_ID,
      turnId: created.turn.id,
    });

    expect(result).toMatchObject({ kind: 'not-queued' });
    expect(harness.state.turns[0]?.status).toBe('QUEUED');
    expect(harness.state.turns[0]?.startedAt).toBeNull();
  });

  it('enforces the active to succeeded path and makes duplicate completion idempotent', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    const created = await repository.createOrGetQueued(createInput());
    const activated = await repository.activateQueuedForOwner({
      userId: USER_ID,
      turnId: created.turn.id,
    });
    expect(activated.kind).toBe('activated');

    const completed = await repository.completeActiveForOwner({
      userId: USER_ID,
      turnId: created.turn.id,
      responseMessageId: RESPONSE_MESSAGE_ID,
    });
    const repeated = await repository.completeActiveForOwner({
      userId: USER_ID,
      turnId: created.turn.id,
      responseMessageId: RESPONSE_MESSAGE_ID,
    });

    expect(completed.kind).toBe('completed');
    if (completed.kind !== 'completed') throw new Error('expected completion');
    expect(repeated).toEqual({
      kind: 'already-completed',
      turn: completed.turn,
    });
    expect(harness.state.turns[0]).toMatchObject({
      status: 'SUCCEEDED',
      responseMessageId: RESPONSE_MESSAGE_ID,
      errorCode: null,
      finishedAt: DATABASE_NOW,
    });
  });

  it('rejects a response message from another owner or conversation', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);
    const created = await repository.createOrGetQueued(createInput());
    await repository.activateQueuedForOwner({
      userId: USER_ID,
      turnId: created.turn.id,
    });

    harness.state.messages.push(
      makeMessage({
        id: 'other-owner-response',
        userId: OTHER_USER_ID,
        conversationId: CONVERSATION_ID,
      }),
      makeMessage({
        id: 'other-conversation-response',
        conversationId: OTHER_CONVERSATION_ID,
      }),
    );

    await expect(
      repository.completeActiveForOwner({
        userId: USER_ID,
        turnId: created.turn.id,
        responseMessageId: 'other-owner-response',
      }),
    ).rejects.toMatchObject({ code: 'CHAT_TURN_RESPONSE_NOT_FOUND' });
    await expect(
      repository.completeActiveForOwner({
        userId: USER_ID,
        turnId: created.turn.id,
        responseMessageId: 'other-conversation-response',
      }),
    ).rejects.toMatchObject({
      code: 'CHAT_TURN_RESPONSE_CONVERSATION_MISMATCH',
    });
    expect(harness.state.turns[0]?.status).toBe('ACTIVE');
  });

  it('records failure and cancellation once, while rejecting terminal rewrites', async () => {
    const failureHarness = createHarness();
    const failureRepository = new ChatTurnsRepository(failureHarness.prisma);
    const failed = await enqueueAndActivate(failureRepository);
    const failure = await failureRepository.failActiveForOwner({
      userId: USER_ID,
      turnId: failed.id,
      errorCode: 'PROVIDER_FAILURE',
    });
    const repeatedFailure = await failureRepository.failActiveForOwner({
      userId: USER_ID,
      turnId: failed.id,
      errorCode: 'PROVIDER_FAILURE',
    });
    const rewrite = await failureRepository.cancelForOwner({
      userId: USER_ID,
      turnId: failed.id,
    });
    expect(failure.kind).toBe('failed');
    expect(repeatedFailure.kind).toBe('already-failed');
    expect(rewrite.kind).toBe('invalid-state');

    const cancelHarness = createHarness();
    const cancelRepository = new ChatTurnsRepository(cancelHarness.prisma);
    const queued = await cancelRepository.createOrGetQueued(createInput());
    const cancelled = await cancelRepository.cancelForOwner({
      userId: USER_ID,
      turnId: queued.turn.id,
    });
    const repeatedCancel = await cancelRepository.cancelForOwner({
      userId: USER_ID,
      turnId: queued.turn.id,
    });
    expect(cancelled.kind).toBe('cancelled');
    expect(repeatedCancel.kind).toBe('already-cancelled');
    expect(cancelHarness.state.turns[0]).toMatchObject({
      status: 'CANCELLED',
      startedAt: null,
      finishedAt: DATABASE_NOW,
      errorCode: 'CANCELLED_BY_USER',
    });
  });

  it('fails closed on malformed input hashes and non-cancellation cancel codes', async () => {
    const harness = createHarness();
    const repository = new ChatTurnsRepository(harness.prisma);

    await expect(
      repository.createOrGetQueued(createInput({ inputHash: 'not-a-hash' })),
    ).rejects.toMatchObject({ code: 'CHAT_TURN_INVALID_INPUT_HASH' });
    await expect(
      repository.cancelForOwner({
        userId: USER_ID,
        turnId: 'turn_missing',
        errorCode: 'PROVIDER_FAILURE',
      }),
    ).rejects.toMatchObject({ code: 'CHAT_TURN_INVALID_CANCEL_CODE' });
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });
});

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
    messages: ChatMessage[];
  } = {
    turns: [],
    messages: [
      makeMessage({ id: INPUT_MESSAGE_ID }),
      makeMessage({
        id: `${OTHER_USER_ID}_${INPUT_MESSAGE_ID}`,
        userId: OTHER_USER_ID,
      }),
      makeMessage({ id: RESPONSE_MESSAGE_ID, role: 'ASSISTANT', order: 2 }),
    ],
  };
  const conversations = [
    { id: CONVERSATION_ID, userId: USER_ID },
    { id: CONVERSATION_ID, userId: OTHER_USER_ID },
  ];
  const transaction = {
    $queryRaw: jest.fn(() => Promise.resolve([{ now: DATABASE_NOW }])),
    conversation: {
      findUnique: jest.fn(
        ({ where }: { where: { id_userId: { id: string; userId: string } } }) =>
          Promise.resolve(
            conversations.find(
              (candidate) =>
                candidate.id === where.id_userId.id &&
                candidate.userId === where.id_userId.userId,
            ) ?? null,
          ),
      ),
    },
    chatMessage: {
      findMany: jest.fn(
        ({
          where,
        }: {
          where: {
            id: { in: string[] };
            userId: string;
            conversationId: string;
          };
        }) =>
          Promise.resolve(
            state.messages
              .filter(
                (message) =>
                  where.id.in.includes(message.id) &&
                  message.userId === where.userId &&
                  message.conversationId === where.conversationId,
              )
              .map(({ id }) => ({ id })),
          ),
      ),
      findUnique: jest.fn(
        ({ where }: { where: { id_userId: { id: string; userId: string } } }) =>
          Promise.resolve(
            state.messages.find(
              (message) =>
                message.id === where.id_userId.id &&
                message.userId === where.id_userId.userId,
            ) ?? null,
          ),
      ),
    },
    chatTurn: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            id_userId?: { id: string; userId: string };
            userId_clientRequestId?: {
              userId: string;
              clientRequestId: string;
            };
          };
        }) => {
          if (where.id_userId) {
            return Promise.resolve(
              state.turns.find(
                (turn) =>
                  turn.id === where.id_userId?.id &&
                  turn.userId === where.id_userId?.userId,
              ) ?? null,
            );
          }
          const key = where.userId_clientRequestId;
          return Promise.resolve(
            state.turns.find(
              (turn) =>
                turn.userId === key?.userId &&
                turn.clientRequestId === key?.clientRequestId,
            ) ?? null,
          );
        },
      ),
      create: jest.fn(({ data }: { data: Partial<ChatTurn> }) => {
        const turn = makeTurn(data);
        state.turns.push(turn);
        return Promise.resolve(turn);
      }),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<ChatTurn>;
        }) => {
          const turn = state.turns.find((candidate) =>
            matchesWhere(candidate, where),
          );
          if (!turn) return Promise.resolve({ count: 0 });
          Object.assign(turn, data, { updatedAt: DATABASE_NOW });
          return Promise.resolve({ count: 1 });
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(
      (callback: (value: typeof transaction) => Promise<unknown>) =>
        Promise.resolve(callback(transaction)),
    ),
    chatTurn: {
      findUnique: transaction.chatTurn.findUnique,
    },
  } as never;
  return { state, transaction, prisma };
}

function matchesWhere(turn: ChatTurn, where: Record<string, unknown>) {
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'startedAt' || key === 'finishedAt') {
      if (
        typeof expected === 'object' &&
        expected !== null &&
        'not' in expected
      ) {
        if (turn[key] === null) return false;
      } else if (turn[key] !== expected) {
        return false;
      }
      continue;
    }
    if (
      key === 'id' ||
      key === 'userId' ||
      key === 'status' ||
      key === 'responseMessageId' ||
      key === 'errorCode'
    ) {
      if (turn[key] !== expected) return false;
    }
  }
  return true;
}

function makeTurn(data: Partial<ChatTurn>): ChatTurn {
  return {
    id: data.id ?? `turn_${Math.random().toString(16).slice(2)}`,
    userId: data.userId ?? USER_ID,
    conversationId: data.conversationId ?? CONVERSATION_ID,
    clientRequestId: data.clientRequestId ?? 'client-request-1',
    status: data.status ?? 'QUEUED',
    inputHash: data.inputHash ?? INPUT_HASH,
    inputMessageIds: data.inputMessageIds ?? [INPUT_MESSAGE_ID],
    budgetPolicyVersion: data.budgetPolicyVersion ?? 'chat-budget-v1',
    responseMessageId: data.responseMessageId ?? null,
    errorCode: data.errorCode ?? null,
    startedAt: data.startedAt ?? null,
    finishedAt: data.finishedAt ?? null,
    createdAt: data.createdAt ?? DATABASE_NOW,
    updatedAt: data.updatedAt ?? DATABASE_NOW,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: overrides.id ?? INPUT_MESSAGE_ID,
    userId: overrides.userId ?? USER_ID,
    conversationId: overrides.conversationId ?? CONVERSATION_ID,
    role: overrides.role ?? 'USER',
    content: overrides.content ?? 'input',
    order: overrides.order ?? 1,
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? DATABASE_NOW,
  };
}

async function enqueueAndActivate(repository: ChatTurnsRepository) {
  const queued = await repository.createOrGetQueued(createInput());
  await repository.activateQueuedForOwner({
    userId: USER_ID,
    turnId: queued.turn.id,
  });
  return queued.turn;
}
