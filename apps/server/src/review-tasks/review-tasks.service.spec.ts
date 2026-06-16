import { PrismaService } from '../database/prisma.service';
import { ReviewTasksService } from './review-tasks.service';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

const createPrismaKnownRequestError = (code: string, target: string[]) => ({
  code,
  clientVersion: 'test',
  meta: { target },
});

describe('ReviewTasksService', () => {
  const now = new Date('2026-06-14T08:00:00.000Z');
  const mutationId = '11111111-1111-4111-8111-111111111111';
  const otherMutationId = '22222222-2222-4222-8222-222222222222';
  const card = {
    id: 'card_1',
    userId: 'user_1',
    questionId: null,
    wrongQuestionId: 'wrong_1',
    difficulty: 5,
    stability: 0,
    retrievability: 1,
    lastReview: null,
    nextReview: now,
    reviewCount: 0,
    lapses: 0,
    state: 'NEW' as const,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
    wrongQuestion: {
      id: 'wrong_1',
      questionText: 'Compute 2 + 2.',
      subject: '数学',
      knowledgePoints: ['加法'],
      answer: '4',
      analysis: '2 + 2 = 4.',
      imageUrl: null,
      status: 'UNRESOLVED' as const,
    },
  };
  const task = {
    id: 'task_1',
    userId: 'user_1',
    cardId: 'card_1',
    reviewLogId: null,
    scheduledDate: '2026-06-14',
    dueAt: now,
    status: 'PENDING' as const,
    source: 'FSRS' as const,
    completedAt: null,
    skippedAt: null,
    createdAt: now,
    updatedAt: now,
    card,
  };
  const reviewLog = {
    id: 'log_1',
    cardId: 'card_1',
    clientMutationId: null,
    rating: 3,
    scheduledDays: 1,
    elapsedDays: 0,
    reviewDurationMs: 12000,
    stabilityBefore: 0,
    stabilityAfter: 1,
    difficultyBefore: 5,
    difficultyAfter: 4.85,
    reviewedAt: now,
  };
  const prisma = {
    $transaction: jest.fn(),
    card: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    reviewTask: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    reviewLog: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new ReviewTasksService(prisma as unknown as PrismaService);
  }

  it('generates today tasks idempotently for due cards', async () => {
    prisma.card.findMany.mockResolvedValue([card]);
    prisma.reviewTask.createMany.mockResolvedValue({ count: 1 });
    prisma.reviewTask.findMany.mockResolvedValue([task]);

    const result = await createService().getToday('user_1', {
      date: '2026-06-14',
      timezoneOffsetMinutes: -480,
      includeCompleted: true,
    });

    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        suspendedAt: null,
        nextReview: { lte: new Date('2026-06-14T15:59:59.999Z') },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });
    expect(prisma.reviewTask.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user_1',
          cardId: 'card_1',
          scheduledDate: '2026-06-14',
          dueAt: now,
          status: 'PENDING',
          source: 'FSRS',
        },
      ],
      skipDuplicates: true,
    });
    expect(result.pendingCount).toBe(1);
    expect(result.tasks[0]?.wrongQuestion?.subject).toBe('数学');
  });

  it('hides terminal tasks from today tasks by default', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    prisma.reviewTask.findMany.mockResolvedValue([
      task,
      { ...task, id: 'task_2', status: 'SKIPPED', skippedAt: now },
      {
        ...task,
        id: 'task_3',
        status: 'COMPLETED',
        reviewLogId: 'log_1',
        completedAt: now,
      },
      { ...task, id: 'task_4', status: 'CANCELLED' },
    ]);

    const result = await createService().getToday('user_1', {
      date: '2026-06-14',
      timezoneOffsetMinutes: -480,
      includeCompleted: false,
    });

    expect(result.pendingCount).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.tasks.map((item) => item.status)).toEqual([
      'PENDING',
      'SKIPPED',
    ]);
  });

  it('lists tasks with status and date filters for the current user', async () => {
    prisma.reviewTask.findMany.mockResolvedValue([
      { ...task, status: 'SKIPPED' },
    ]);
    prisma.reviewTask.count.mockResolvedValue(1);

    const result = await createService().list('user_1', {
      page: 2,
      pageSize: 10,
      status: 'SKIPPED',
      date: '2026-06-14',
    });

    expect(prisma.reviewTask.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        scheduledDate: '2026-06-14',
        status: 'SKIPPED',
      },
      include: { card: { include: { wrongQuestion: true } } },
      orderBy: [
        { scheduledDate: 'desc' },
        { dueAt: 'asc' },
        { createdAt: 'asc' },
      ],
      skip: 10,
      take: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.status).toBe('SKIPPED');
  });

  it('previews a 7-day plan from card.nextReview without creating future tasks', async () => {
    prisma.card.findMany.mockResolvedValue([
      {
        ...card,
        id: 'card_overdue',
        nextReview: new Date('2026-06-15T15:00:00.000Z'),
      },
      {
        ...card,
        id: 'card_today_1',
        nextReview: new Date('2026-06-15T16:30:00.000Z'),
      },
      {
        ...card,
        id: 'card_today_2',
        nextReview: new Date('2026-06-16T10:00:00.000Z'),
      },
      {
        ...card,
        id: 'card_upcoming_1',
        nextReview: new Date('2026-06-17T01:00:00.000Z'),
      },
      {
        ...card,
        id: 'card_upcoming_2',
        nextReview: new Date('2026-06-22T15:00:00.000Z'),
      },
    ]);
    prisma.reviewTask.findMany.mockResolvedValue([]);

    const result = await createService().getPlan('user_1', {
      startDate: '2026-06-16',
      days: 7,
      timezoneOffsetMinutes: -480,
    });

    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        suspendedAt: null,
        nextReview: { lte: new Date('2026-06-22T15:59:59.999Z') },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prisma.reviewTask.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        scheduledDate: { gte: '2026-06-16', lte: '2026-06-22' },
        status: { in: ['PENDING', 'COMPLETED', 'SKIPPED'] },
      },
      select: { scheduledDate: true, status: true },
    });
    expect(prisma.reviewTask.createMany).not.toHaveBeenCalled();
    expect(result.startDate).toBe('2026-06-16');
    expect(result.endDate).toBe('2026-06-22');
    expect(result.summary).toMatchObject({
      overdueCount: 1,
      todayDueCount: 2,
      upcomingDueCount: 2,
      estimatedTotalMinutes: 10,
      peakDay: { date: '2026-06-16', count: 3 },
      intensity: 'light',
    });
    expect(result.days.map((day) => day.dueCount)).toEqual([
      2, 1, 0, 0, 0, 0, 1,
    ]);
    expect(result.days[0]).toMatchObject({
      overdueCount: 1,
      estimatedMinutes: 6,
      intensity: 'light',
    });
    expect(result.suggestion).toMatchObject({
      title: '先处理逾期卡',
      actionHref: '/today',
    });
  });

  it('returns an empty light plan with no peak day and error-book suggestion', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-16T04:00:00.000Z'));
    prisma.card.findMany.mockResolvedValue([]);
    prisma.reviewTask.findMany.mockResolvedValue([]);

    const result = await createService().getPlan('user_1', {
      days: 7,
      timezoneOffsetMinutes: -480,
    });

    expect(result.startDate).toBe('2026-06-16');
    expect(result.endDate).toBe('2026-06-22');
    expect(result.summary).toMatchObject({
      overdueCount: 0,
      todayDueCount: 0,
      upcomingDueCount: 0,
      estimatedTotalMinutes: 0,
      peakDay: null,
      intensity: 'light',
    });
    expect(result.days).toHaveLength(7);
    expect(result.days.every((day) => day.estimatedMinutes === 0)).toBe(true);
    expect(result.suggestion).toMatchObject({
      title: '当前复习压力很轻',
      actionHref: '/error-book',
    });
    expect(prisma.reviewTask.createMany).not.toHaveBeenCalled();
  });

  it('excludes suspended cards via the Prisma card query', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    prisma.reviewTask.findMany.mockResolvedValue([]);

    await createService().getPlan('user_1', {
      startDate: '2026-06-16',
      days: 3,
      timezoneOffsetMinutes: 0,
    });

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          userId: 'user_1',
          suspendedAt: null,
          nextReview: { lte: new Date('2026-06-18T23:59:59.999Z') },
        }),
      }),
    );
  });

  it('counts existing ReviewTask rows by scheduledDate and status', async () => {
    prisma.card.findMany.mockResolvedValue([]);
    prisma.reviewTask.findMany.mockResolvedValue([
      { scheduledDate: '2026-06-16', status: 'PENDING' },
      { scheduledDate: '2026-06-16', status: 'COMPLETED' },
      { scheduledDate: '2026-06-17', status: 'SKIPPED' },
      { scheduledDate: '2026-06-17', status: 'SKIPPED' },
    ]);

    const result = await createService().getPlan('user_1', {
      startDate: '2026-06-16',
      days: 2,
      timezoneOffsetMinutes: 0,
    });

    expect(result.days[0]).toMatchObject({
      date: '2026-06-16',
      pendingCount: 1,
      completedCount: 1,
      skippedCount: 0,
    });
    expect(result.days[1]).toMatchObject({
      date: '2026-06-17',
      pendingCount: 0,
      completedCount: 0,
      skippedCount: 2,
    });
  });

  it('submits rating by completing the task and writing a review log', async () => {
    const updatedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: updatedCard,
    };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.card.findFirst.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(reviewLog);
    prisma.reviewTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
    });

    expect(prisma.reviewTask.findFirst).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        reviewLogId: 'log_1',
        completedAt: now,
        skippedAt: null,
      },
    });
    expect(prisma.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'card_1',
        userId: 'user_1',
        updatedAt: card.updatedAt,
        nextReview: card.nextReview,
      },
      data: objectContaining({
        difficulty: 4.85,
        stability: 1,
        retrievability: 0.9,
        lastReview: now,
        reviewCount: 1,
        state: 'REVIEW',
      }),
    });
    expect(prisma.card.findFirst).toHaveBeenCalledWith({
      where: { id: 'card_1', userId: 'user_1' },
    });
    expect(result.task.status).toBe('COMPLETED');
    expect(result.card.state).toBe('REVIEW');
    expect(result.log.rating).toBe(3);
  });

  it('claims the card before creating the log or updating review tasks when rating succeeds', async () => {
    const updatedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: updatedCard,
    };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.card.findFirst.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(reviewLog);
    prisma.reviewTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
    });

    const cardClaimOrder = prisma.card.updateMany.mock.invocationCallOrder[0];
    const logCreateOrder = prisma.reviewLog.create.mock.invocationCallOrder[0];
    const taskUpdateOrders =
      prisma.reviewTask.updateMany.mock.invocationCallOrder;

    expect(cardClaimOrder).toBeLessThan(logCreateOrder);
    for (const taskUpdateOrder of taskUpdateOrders) {
      expect(cardClaimOrder).toBeLessThan(taskUpdateOrder);
    }
  });

  it('cancels other pending and skipped tasks for the same card after a successful rating', async () => {
    const updatedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: updatedCard,
    };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask);
    prisma.reviewLog.create.mockResolvedValue(reviewLog);
    prisma.reviewTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.card.findFirst.mockResolvedValue(updatedCard);

    await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
    });

    expect(prisma.reviewTask.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 'user_1',
        cardId: 'card_1',
        status: { in: ['PENDING', 'SKIPPED'] },
        id: { not: 'task_1' },
      },
      data: { status: 'CANCELLED', skippedAt: null },
    });
  });

  it('writes and echoes clientMutationId on first rating submit', async () => {
    const updatedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const logWithMutation = {
      ...reviewLog,
      clientMutationId: mutationId,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: updatedCard,
    };
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(completedTask);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.card.findFirst.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(logWithMutation);
    prisma.reviewTask.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
      clientMutationId: mutationId,
    });

    expect(prisma.reviewLog.findUnique).toHaveBeenCalledWith({
      where: { clientMutationId: mutationId },
      include: {
        card: true,
        reviewTask: { include: { card: { include: { wrongQuestion: true } } } },
      },
    });
    expect(prisma.reviewLog.create).toHaveBeenCalledWith({
      data: objectContaining({
        cardId: 'card_1',
        clientMutationId: mutationId,
      }),
    });
    expect(result.log.clientMutationId).toBe(mutationId);
  });

  it('returns the existing rating result for a repeated clientMutationId without mutating again', async () => {
    const reviewedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: reviewedCard,
    };
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card: reviewedCard,
      reviewTask: completedTask,
    });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
      clientMutationId: mutationId,
    });

    expect(result.task.status).toBe('COMPLETED');
    expect(result.card.reviewCount).toBe(1);
    expect(result.log.clientMutationId).toBe(mutationId);
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.card.updateMany).not.toHaveBeenCalled();
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('returns the existing rating result when a same clientMutationId race hits P2002', async () => {
    const reviewedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: reviewedCard,
    };
    prisma.$transaction.mockRejectedValueOnce(
      createPrismaKnownRequestError('P2002', ['clientMutationId']),
    );
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card: reviewedCard,
      reviewTask: completedTask,
    });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
      clientMutationId: mutationId,
    });

    expect(result.task.status).toBe('COMPLETED');
    expect(result.card.reviewCount).toBe(1);
    expect(result.log.clientMutationId).toBe(mutationId);
    expect(prisma.reviewLog.findUnique).toHaveBeenCalledWith({
      where: { clientMutationId: mutationId },
      include: {
        card: true,
        reviewTask: { include: { card: { include: { wrongQuestion: true } } } },
      },
    });
  });

  it('returns an existing rating result when the same mutation loses the card claim race', async () => {
    const reviewedCard = {
      ...card,
      difficulty: 4.85,
      stability: 1,
      retrievability: 0.9,
      lastReview: now,
      nextReview: new Date('2026-06-15T08:00:00.000Z'),
      reviewCount: 1,
      state: 'REVIEW' as const,
    };
    const completedTask = {
      ...task,
      status: 'COMPLETED' as const,
      reviewLogId: 'log_1',
      completedAt: now,
      card: reviewedCard,
    };
    prisma.reviewLog.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...reviewLog,
        clientMutationId: mutationId,
        card: reviewedCard,
        reviewTask: completedTask,
      });
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.updateMany.mockResolvedValue({ count: 0 });
    prisma.reviewLog.create.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
    });
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 1 });

    const result = await createService().submitRating('user_1', 'task_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
      clientMutationId: mutationId,
    });

    expect(result.task.status).toBe('COMPLETED');
    expect(result.card.reviewCount).toBe(1);
    expect(result.log.clientMutationId).toBe(mutationId);
    expect(prisma.reviewLog.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
  });

  it('rejects reusing the same clientMutationId for a different task', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card,
      reviewTask: {
        ...task,
        id: 'task_2',
      },
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('keeps REVIEW_TASK_NOT_PENDING for a completed task with a different clientMutationId', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue({
      ...task,
      status: 'COMPLETED',
      reviewLogId: 'log_1',
      completedAt: now,
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: otherMutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewLog.findUnique).toHaveBeenCalledWith({
      where: { clientMutationId: otherMutationId },
      include: {
        card: true,
        reviewTask: { include: { card: { include: { wrongQuestion: true } } } },
      },
    });
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('rejects stale pending tasks whose due snapshot no longer matches the card', async () => {
    const staleTask = {
      ...task,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(staleTask);

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.card.updateMany).not.toHaveBeenCalled();
  });

  it("rejects another user's matching clientMutationId without exposing the result", async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card: {
        ...card,
        userId: 'user_2',
      },
      reviewTask: task,
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('rejects replay when the stored task user differs from the requester', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card,
      reviewTask: {
        ...task,
        userId: 'user_2',
      },
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('rejects replay when the stored task points at a different card than the log', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue({
      ...reviewLog,
      clientMutationId: mutationId,
      card,
      reviewTask: {
        ...task,
        cardId: 'card_2',
      },
    });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.reviewTask.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
  });

  it('returns idempotency conflict when clientMutationId unique conflict cannot be replayed', async () => {
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewLog.create.mockRejectedValue(
      createPrismaKnownRequestError('P2002', ['clientMutationId']),
    );

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      statusCode: 409,
    });
    expect(prisma.reviewLog.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rethrows unique conflicts that do not target clientMutationId', async () => {
    const error = createPrismaKnownRequestError('P2002', ['cardId']);
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewLog.create.mockRejectedValue(error);

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toBe(error);
  });

  it('rethrows non-Prisma errors without treating them as idempotency conflicts', async () => {
    const error = {
      code: 'P2002',
      meta: { target: ['clientMutationId'] },
    };
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewLog.create.mockRejectedValue(error);

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        clientMutationId: mutationId,
      }),
    ).rejects.toBe(error);
  });

  it('rejects after the card claim when the conditional task completion loses a race', async () => {
    const logWithMutation = {
      ...reviewLog,
      clientMutationId: mutationId,
    };
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.card.updateMany.mockResolvedValue({ count: 1 });
    prisma.reviewLog.create.mockResolvedValue(logWithMutation);
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        reviewDurationMs: 12000,
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'card_1',
        userId: 'user_1',
        updatedAt: card.updatedAt,
        nextReview: card.nextReview,
      },
      data: objectContaining({
        difficulty: 4.85,
        stability: 1,
        retrievability: 0.9,
        lastReview: now,
        reviewCount: 1,
        state: 'REVIEW',
      }),
    });
    expect(prisma.reviewLog.create).toHaveBeenCalledWith({
      data: objectContaining({
        cardId: 'card_1',
        clientMutationId: mutationId,
      }),
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'PENDING' },
      data: {
        status: 'COMPLETED',
        reviewLogId: 'log_1',
        completedAt: now,
        skippedAt: null,
      },
    });
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when the card optimistic update loses a race before log or task writes', async () => {
    const logWithMutation = {
      ...reviewLog,
      clientMutationId: mutationId,
    };
    prisma.reviewLog.findUnique.mockResolvedValue(null);
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.reviewLog.create.mockResolvedValue(logWithMutation);
    prisma.reviewTask.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.card.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().submitRating('user_1', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
        reviewDurationMs: 12000,
        clientMutationId: mutationId,
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.card.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'card_1',
        userId: 'user_1',
        updatedAt: card.updatedAt,
        nextReview: card.nextReview,
      },
      data: objectContaining({
        difficulty: 4.85,
        stability: 1,
        retrievability: 0.9,
        lastReview: now,
        reviewCount: 1,
        state: 'REVIEW',
      }),
    });
    expect(prisma.card.findFirst).not.toHaveBeenCalled();
    expect(prisma.reviewTask.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.reviewLog.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
  });

  it('rejects skipping a stale skipped task without treating it as an idempotent skip', async () => {
    const staleSkippedTask = {
      ...task,
      status: 'SKIPPED' as const,
      skippedAt: now,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewTask.findFirst.mockResolvedValue(staleSkippedTask);

    await expect(
      createService().skip('user_1', 'task_1', now),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('skips a pending task in a transaction and verifies the claimed task is current', async () => {
    const skippedTask = { ...task, status: 'SKIPPED' as const, skippedAt: now };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(skippedTask);
    prisma.reviewTask.updateMany.mockResolvedValueOnce({ count: 1 });

    const skipped = await createService().skip('user_1', 'task_1', now);

    expect(skipped.task.status).toBe('SKIPPED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.reviewTask.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'task_1', userId: 'user_1', status: 'PENDING' },
      data: { status: 'SKIPPED', skippedAt: now },
    });
    expect(prisma.reviewTask.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('reopens a skipped task in a transaction and verifies the claimed task is current', async () => {
    const skippedTask = { ...task, status: 'SKIPPED' as const, skippedAt: now };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(skippedTask)
      .mockResolvedValueOnce(task);
    prisma.reviewTask.updateMany.mockResolvedValueOnce({ count: 1 });

    const reopened = await createService().reopen('user_1', 'task_1');

    expect(reopened.task.status).toBe('PENDING');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.reviewTask.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'task_1', userId: 'user_1', status: 'SKIPPED' },
      data: { status: 'PENDING', skippedAt: null },
    });
    expect(prisma.reviewTask.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 'task_1', userId: 'user_1' },
      include: { card: { include: { wrongQuestion: true } } },
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects skipping when the conditional pending claim loses a race', async () => {
    prisma.reviewTask.findFirst.mockResolvedValue(task);
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().skip('user_1', 'task_1', now),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'PENDING' },
      data: { status: 'SKIPPED', skippedAt: now },
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects reopening when the conditional skipped claim loses a race', async () => {
    const skippedTask = { ...task, status: 'SKIPPED' as const, skippedAt: now };
    prisma.reviewTask.findFirst.mockResolvedValue(skippedTask);
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().reopen('user_1', 'task_1'),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'SKIPPED' },
      data: { status: 'PENDING', skippedAt: null },
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects skipping when the claimed task becomes stale after the conditional update', async () => {
    const skippedStaleTask = {
      ...task,
      status: 'SKIPPED' as const,
      skippedAt: now,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(skippedStaleTask);
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      createService().skip('user_1', 'task_1', now),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'PENDING' },
      data: { status: 'SKIPPED', skippedAt: now },
    });
    expect(prisma.reviewTask.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rejects reopening when the claimed task becomes stale after the conditional update', async () => {
    const skippedTask = { ...task, status: 'SKIPPED' as const, skippedAt: now };
    const reopenedStaleTask = {
      ...task,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewTask.findFirst
      .mockResolvedValueOnce(skippedTask)
      .mockResolvedValueOnce(reopenedStaleTask);
    prisma.reviewTask.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      createService().reopen('user_1', 'task_1'),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task_1', userId: 'user_1', status: 'SKIPPED' },
      data: { status: 'PENDING', skippedAt: null },
    });
    expect(prisma.reviewTask.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rejects reopening a stale pending task without pretending it is already open', async () => {
    const stalePendingTask = {
      ...task,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewTask.findFirst.mockResolvedValue(stalePendingTask);

    await expect(
      createService().reopen('user_1', 'task_1'),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects reopening a skipped stale task after the card advances', async () => {
    const staleSkippedTask = {
      ...task,
      status: 'SKIPPED' as const,
      skippedAt: now,
      card: {
        ...card,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
      },
    };
    prisma.reviewTask.findFirst.mockResolvedValue(staleSkippedTask);
    prisma.reviewTask.update.mockResolvedValue({ ...task, status: 'PENDING' });

    await expect(
      createService().reopen('user_1', 'task_1'),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects skipping a cancelled task', async () => {
    prisma.reviewTask.findFirst.mockResolvedValue({
      ...task,
      status: 'CANCELLED',
    });

    await expect(
      createService().skip('user_1', 'task_1', now),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects reopening a cancelled task', async () => {
    prisma.reviewTask.findFirst.mockResolvedValue({
      ...task,
      status: 'CANCELLED',
    });

    await expect(
      createService().reopen('user_1', 'task_1'),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_PENDING',
      statusCode: 409,
    });
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
  });

  it('rejects rating a task owned by another user', async () => {
    prisma.reviewTask.findFirst.mockResolvedValue(null);

    await expect(
      createService().submitRating('user_2', 'task_1', {
        rating: 3,
        reviewedAt: now.toISOString(),
      }),
    ).rejects.toMatchObject({
      code: 'REVIEW_TASK_NOT_FOUND',
      statusCode: 404,
    });
  });
});
