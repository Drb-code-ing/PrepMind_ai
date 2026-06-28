import { PrismaService } from '../database/prisma.service';
import { MemoryAgentService } from './memory-agent.service';

const arrayContaining = <T>(value: T[]) =>
  expect.arrayContaining(value) as unknown as T[];

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

const stringMatching = (value: RegExp) =>
  expect.stringMatching(value) as unknown as string;

const anySelect = () => expect.any(Object) as unknown as Record<string, true>;

describe('MemoryAgentService', () => {
  const now = new Date('2026-06-28T08:00:00.000Z');
  const pendingCandidate = createCandidate({
    id: 'candidate_1',
    status: 'PENDING',
  });
  const acceptedCandidate = createCandidate({
    id: 'candidate_1',
    status: 'ACCEPTED',
    acceptedMemoryId: 'memory_1',
    decidedAt: now,
  });
  const activeMemory = createMemory({ id: 'memory_1' });
  const prisma = {
    userMemoryCandidate: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    userMemory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    chatMessage: {
      findMany: jest.fn(),
    },
    card: {
      findMany: jest.fn(),
    },
    reviewLog: {
      findMany: jest.fn(),
    },
    reviewPreference: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.userMemoryCandidate.findMany.mockResolvedValue([pendingCandidate]);
    prisma.userMemoryCandidate.findFirst.mockResolvedValue(pendingCandidate);
    prisma.userMemoryCandidate.createMany.mockResolvedValue({ count: 1 });
    prisma.userMemoryCandidate.create.mockResolvedValue(pendingCandidate);
    prisma.userMemoryCandidate.updateMany.mockResolvedValue({ count: 1 });
    prisma.userMemoryCandidate.update.mockResolvedValue(acceptedCandidate);
    prisma.userMemory.findMany.mockResolvedValue([activeMemory]);
    prisma.userMemory.findFirst.mockResolvedValue(activeMemory);
    prisma.userMemory.create.mockResolvedValue(activeMemory);
    prisma.userMemory.upsert.mockResolvedValue(activeMemory);
    prisma.userMemory.update.mockResolvedValue(activeMemory);
    prisma.userMemory.deleteMany.mockResolvedValue({ count: 1 });
    prisma.chatMessage.findMany.mockResolvedValue([
      {
        id: 'msg_1',
        conversationId: 'conv_1',
        content: '以后讲题先给我一点提示，不要直接给完整答案',
        createdAt: now,
      },
    ]);
    prisma.card.findMany.mockResolvedValue([
      {
        difficulty: 7,
        stability: 1.2,
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: ['导数应用'],
        },
      },
      {
        difficulty: 6,
        stability: 1.4,
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: ['导数应用'],
        },
      },
      {
        difficulty: 5,
        stability: 2.1,
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: ['导数应用'],
        },
      },
    ]);
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        rating: 1,
        reviewedAt: now,
        card: {
          wrongQuestion: {
            subject: '数学',
            knowledgePoints: ['导数应用'],
          },
        },
      },
      {
        rating: 1,
        reviewedAt: now,
        card: {
          wrongQuestion: {
            subject: '数学',
            knowledgePoints: ['导数应用'],
          },
        },
      },
    ]);
    prisma.reviewPreference.findUnique.mockResolvedValue({
      dailyMinutes: 25,
      preferredReviewTime: '20:30',
      updatedAt: now,
    });
    prisma.$transaction.mockImplementation(
      <T>(callback: (client: typeof prisma) => T | Promise<T>) =>
        callback(prisma),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new MemoryAgentService(prisma as unknown as PrismaService);
  }

  it('generates deduped pending memory candidates from current user signals', async () => {
    prisma.userMemory.findMany.mockResolvedValueOnce([]);

    const result = await createService().generateCandidates('user_1', {
      source: 'profile',
      force: false,
    });

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        role: 'USER',
        createdAt: { gte: new Date('2026-04-29T08:00:00.000Z') },
      },
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', suspendedAt: null },
      select: {
        difficulty: true,
        stability: true,
        wrongQuestion: {
          select: {
            subject: true,
            knowledgePoints: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    expect(prisma.userMemoryCandidate.createMany).toHaveBeenCalledWith({
      data: arrayContaining([
        objectContaining({
          userId: 'user_1',
          status: 'PENDING',
          sourceHash: stringMatching(/^sha256:/),
        }),
      ]),
      skipDuplicates: true,
    });
    expect(result.createdCount).toBeGreaterThan(0);
    expect(result.candidates[0]?.status).toBe('PENDING');
  });

  it('does not create duplicate candidates when source hash already exists', async () => {
    prisma.userMemoryCandidate.createMany.mockResolvedValueOnce({ count: 0 });

    const result = await createService().generateCandidates('user_1', {
      source: 'profile',
      force: false,
    });

    expect(prisma.userMemoryCandidate.createMany).toHaveBeenCalledWith(
      objectContaining({ skipDuplicates: true }),
    );
    expect(result.createdCount).toBe(0);
  });

  it('accepts a pending candidate idempotently and creates one active memory', async () => {
    prisma.userMemoryCandidate.update.mockResolvedValueOnce(acceptedCandidate);
    prisma.userMemory.upsert.mockResolvedValueOnce(activeMemory);
    prisma.userMemoryCandidate.findFirst
      .mockResolvedValueOnce(pendingCandidate)
      .mockResolvedValueOnce(acceptedCandidate);

    const first = await createService().acceptCandidate(
      'user_1',
      'candidate_1',
    );
    const second = await createService().acceptCandidate(
      'user_1',
      'candidate_1',
    );

    expect(prisma.userMemory.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userMemoryCandidate.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidate_1', userId: 'user_1', status: 'PENDING' },
      data: {
        status: 'ACCEPTED',
        decidedAt: now,
      },
    });
    expect(prisma.userMemoryCandidate.update).toHaveBeenCalledWith({
      where: { id: 'candidate_1' },
      data: {
        acceptedMemoryId: 'memory_1',
      },
      select: anySelect(),
    });
    expect(first.memory.id).toBe('memory_1');
    expect(second.memory.id).toBe('memory_1');
  });

  it('does not overwrite an accepted candidate when a concurrent reject loses the claim', async () => {
    prisma.userMemoryCandidate.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.userMemoryCandidate.findFirst.mockResolvedValueOnce(
      acceptedCandidate,
    );

    const result = await createService().rejectCandidate(
      'user_1',
      'candidate_1',
    );

    expect(result.candidate.status).toBe('ACCEPTED');
  });

  it('rejects a pending candidate without creating a memory', async () => {
    prisma.userMemoryCandidate.findFirst.mockResolvedValueOnce(
      createCandidate({
        id: 'candidate_1',
        status: 'REJECTED',
        decidedAt: now,
      }),
    );

    const result = await createService().rejectCandidate(
      'user_1',
      'candidate_1',
    );

    expect(prisma.userMemory.create).not.toHaveBeenCalled();
    expect(prisma.userMemoryCandidate.updateMany).toHaveBeenCalledWith({
      where: { id: 'candidate_1', userId: 'user_1', status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedAt: now,
      },
    });
    expect(result.candidate.status).toBe('REJECTED');
  });

  it('lists, updates, and deletes memories scoped to the current user', async () => {
    await createService().listMemories('user_1', { status: 'ACTIVE' });
    await createService().updateMemory('user_1', 'memory_1', {
      status: 'ARCHIVED',
    });
    await createService().deleteMemory('user_1', 'memory_1');

    expect(prisma.userMemory.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: anySelect(),
    });
    expect(prisma.userMemory.findFirst).toHaveBeenCalledWith({
      where: { id: 'memory_1', userId: 'user_1' },
      select: anySelect(),
    });
    expect(prisma.userMemory.update).toHaveBeenCalledWith({
      where: { id: 'memory_1' },
      data: {
        status: 'ARCHIVED',
        archivedAt: now,
      },
      select: anySelect(),
    });
    expect(prisma.userMemory.deleteMany).toHaveBeenCalledWith({
      where: { id: 'memory_1', userId: 'user_1' },
    });
  });

  it('throws not found for non-owned memories', async () => {
    prisma.userMemory.findFirst.mockResolvedValueOnce(null);

    await expect(
      createService().updateMemory('user_1', 'memory_other', {
        title: '新的标题',
      }),
    ).rejects.toMatchObject({
      code: 'USER_MEMORY_NOT_FOUND',
      statusCode: 404,
    });
  });
});

function createCandidate(
  overrides: Partial<CandidateRecord> = {},
): CandidateRecord {
  const createdAt = new Date('2026-06-28T08:00:00.000Z');
  return {
    id: 'candidate_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先提示或思路，再给完整答案。',
    reason: '用户在聊天中明确表达了讲解方式偏好。',
    evidence: [
      { sourceType: 'chat', sourceId: 'msg_1', summary: '以后讲题先给提示' },
    ],
    confidence: 0.86,
    status: 'PENDING',
    sourceHash: 'sha256:candidate',
    acceptedMemoryId: null,
    createdAt,
    updatedAt: createdAt,
    decidedAt: null,
    ...overrides,
  };
}

function createMemory(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  const createdAt = new Date('2026-06-28T08:00:00.000Z');
  return {
    id: 'memory_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先提示或思路，再给完整答案。',
    status: 'ACTIVE',
    sourceCandidateId: 'candidate_1',
    confidence: 0.86,
    lastUsedAt: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

type CandidateRecord = {
  id: string;
  userId: string;
  type:
    | 'LEARNING_GOAL'
    | 'EXPLANATION_PREFERENCE'
    | 'WEAK_POINT'
    | 'STUDY_HABIT';
  title: string;
  content: string;
  reason: string;
  evidence: unknown;
  confidence: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  sourceHash: string;
  acceptedMemoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
};

type MemoryRecord = {
  id: string;
  userId: string;
  type:
    | 'LEARNING_GOAL'
    | 'EXPLANATION_PREFERENCE'
    | 'WEAK_POINT'
    | 'STUDY_HABIT';
  title: string;
  content: string;
  status: 'ACTIVE' | 'ARCHIVED';
  sourceCandidateId: string | null;
  confidence: number;
  lastUsedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
