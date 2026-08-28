import type { BackgroundJob, ChatTurn } from '@prisma/client';
import type { Job } from 'bullmq';

import {
  CHAT_RESPONSE_JOB,
  CHAT_RESPONSE_QUEUE,
  CHAT_RESPONSE_REQUESTED_EVENT,
  CHAT_RESPONSE_RESOURCE_TYPE,
} from '../chat-turns/chat-turn.constants';
import { createHash } from 'node:crypto';
import { ChatResponseRequestedHandler } from './chat-response-requested.handler';
import { OutboxHandlerError } from './outbox.handlers';

describe('ChatResponseRequestedHandler', () => {
  const payload = {
    turnId: 'turn_1',
    backgroundJobId: 'job_1',
    inputHash: `sha256:${'a'.repeat(64)}`,
    budgetPolicyVersion: 'chat-budget-v1',
  } as const;
  const turn = {
    id: payload.turnId,
    userId: 'user_1',
    inputHash: payload.inputHash,
    budgetPolicyVersion: payload.budgetPolicyVersion,
    status: 'QUEUED',
  } as ChatTurn;
  const backgroundJob = {
    id: payload.backgroundJobId,
    userId: turn.userId,
    scope: 'ACCOUNT',
    queueName: CHAT_RESPONSE_QUEUE,
    jobName: CHAT_RESPONSE_JOB,
    resourceType: CHAT_RESPONSE_RESOURCE_TYPE,
    resourceId: turn.id,
    status: 'QUEUED',
    maxAttempts: 3,
    bullJobId: null,
  } as BackgroundJob;

  it('adds a deterministic Bull job and persists its link', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    queue.add.mockResolvedValue(bullJob(payload));
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await createHandler(prisma, queue).handle(event());

    expect(queue.add).toHaveBeenCalledWith(
      CHAT_RESPONSE_JOB,
      payload,
      expect.objectContaining({ jobId: payload.backgroundJobId, attempts: 3 }),
    );
    const updateMock = prisma.backgroundJob.updateMany as unknown as {
      mock: {
        calls: Array<
          [
            {
              where?: Record<string, unknown>;
              data?: Record<string, unknown>;
            },
          ]
        >;
      };
    };
    const updateArgs = updateMock.mock.calls[0]?.[0];
    expect(updateArgs?.where).toMatchObject({
      id: payload.backgroundJobId,
      userId: turn.userId,
      bullJobId: null,
    });
    expect(updateArgs?.data).toEqual({ bullJobId: payload.backgroundJobId });
  });

  it('treats an existing matching Bull job as idempotent', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    queue.getJob.mockResolvedValue(bullJob(payload));
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await createHandler(prisma, queue).handle(event());

    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.updateMany).toHaveBeenCalled();
  });

  it('accepts the enqueue service canonical payload hash', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    queue.add.mockResolvedValue(bullJob(payload));
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await createHandler(prisma, queue).handle(
      event({ payloadHash: canonicalPayloadHash() }),
    );

    expect(queue.add).toHaveBeenCalled();
  });

  it('recovers an add race when Bull reports an existing job', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    queue.add.mockRejectedValue(new Error('job already exists'));
    queue.getJob.mockResolvedValue(bullJob(payload));
    prisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });

    await createHandler(prisma, queue).handle(event());

    expect(queue.getJob).toHaveBeenCalledWith(payload.backgroundJobId);
    expect(prisma.backgroundJob.updateMany).toHaveBeenCalled();
  });

  it('acknowledges a requested event after the worker has durably claimed it', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'ACTIVE',
      startedAt: new Date('2026-08-28T00:00:01.000Z'),
    });
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'ACTIVE',
      bullJobId: payload.backgroundJobId,
    });
    queue.getJob.mockResolvedValue(bullJob(payload));

    await createHandler(prisma, queue).handle(event());

    expect(queue.add).not.toHaveBeenCalled();
    expect(queue.getJob).toHaveBeenCalledWith(payload.backgroundJobId);
  });

  it('fails closed when an active claim has no Bull record to verify', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'ACTIVE',
      startedAt: new Date('2026-08-28T00:00:01.000Z'),
    });
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'ACTIVE',
      bullJobId: payload.backgroundJobId,
    });
    await expect(
      createHandler(prisma, queue).handle(event()),
    ).rejects.toMatchObject({ code: 'OUTBOX_HANDLER_FAILED' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('fails closed for an active claim with a mismatched Bull id', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'ACTIVE',
      startedAt: new Date('2026-08-28T00:00:01.000Z'),
    });
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'ACTIVE',
      bullJobId: 'other-bull-job',
    });

    await expect(
      createHandler(prisma, queue).handle(event()),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    expect(queue.getJob).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a forged or incomplete payload before database access', async () => {
    const queue = createQueue();
    const prisma = createPrisma();

    await expect(
      createHandler(prisma, queue).handle(
        event({ payload: { ...payload, leakedPrompt: 'secret' } }),
      ),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    expect(prisma.chatTurn.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a turn and job whose ownership or routing facts disagree', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({ ...turn, userId: 'other' });

    await expect(createHandler(prisma, queue).handle(event())).rejects.toThrow(
      OutboxHandlerError,
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('does not enqueue a terminal turn', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'CANCELLED',
    });
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'CANCELLED',
    });

    await createHandler(prisma, queue).handle(event());

    expect(queue.getJob).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reconciles a terminal turn with a still-queued background job', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'CANCELLED',
      errorCode: 'CANCELLED_BY_USER',
      finishedAt: new Date('2026-08-28T00:00:02.000Z'),
    });

    await createHandler(prisma, queue).handle(event());

    expect(queue.add).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest's asymmetric matcher is typed as any in this assertion API.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({
          id: payload.backgroundJobId,
          status: { in: ['QUEUED', 'ACTIVE'] },
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          status: 'CANCELLED',
          errorCode: 'CANCELLED_BY_USER',
        }),
      }),
    );
  });

  it('rejects a terminal background job paired with a live turn', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'FAILED',
    });

    await expect(
      createHandler(prisma, queue).handle(event()),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects incompatible terminal Turn and BackgroundJob states', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    prisma.chatTurn.findUnique.mockResolvedValue({
      ...turn,
      status: 'SUCCEEDED',
      responseMessageId: 'response_1',
    });
    prisma.backgroundJob.findUnique.mockResolvedValue({
      ...backgroundJob,
      status: 'FAILED',
    });

    await expect(
      createHandler(prisma, queue).handle(event()),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('propagates a queue add failure when no matching race winner exists', async () => {
    const queue = createQueue();
    const prisma = createPrisma();
    const error = new Error('redis unavailable');
    queue.add.mockRejectedValue(error);
    queue.getJob.mockResolvedValue(null);

    await expect(createHandler(prisma, queue).handle(event())).rejects.toBe(
      error,
    );
    expect(prisma.backgroundJob.updateMany).not.toHaveBeenCalled();
  });

  function event(overrides: Record<string, unknown> = {}) {
    return {
      id: 'evt_1',
      type: CHAT_RESPONSE_REQUESTED_EVENT,
      aggregateType: 'ChatTurn',
      aggregateId: payload.turnId,
      payload,
      payloadHash: null,
      ...overrides,
    };
  }

  function createHandler(
    prisma: ReturnType<typeof createPrisma>,
    queue: ReturnType<typeof createQueue>,
  ) {
    return new ChatResponseRequestedHandler(prisma as never, queue as never);
  }

  function createPrisma() {
    return {
      chatTurn: { findUnique: jest.fn().mockResolvedValue(turn) },
      backgroundJob: {
        findUnique: jest.fn().mockResolvedValue(backgroundJob),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
  }

  function createQueue() {
    return {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn(),
    };
  }

  function bullJob(data: typeof payload) {
    return {
      id: data.backgroundJobId,
      name: CHAT_RESPONSE_JOB,
      data,
    } as unknown as Job<unknown>;
  }

  function canonicalPayloadHash() {
    return `sha256:${createHash('sha256')
      .update(
        JSON.stringify({
          turnId: payload.turnId,
          inputHash: payload.inputHash,
          budgetPolicyVersion: payload.budgetPolicyVersion,
          backgroundJobId: payload.backgroundJobId,
        }),
      )
      .digest('hex')}`;
  }
});
