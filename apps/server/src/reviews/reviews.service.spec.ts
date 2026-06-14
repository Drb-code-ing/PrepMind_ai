import { PrismaService } from '../database/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const now = new Date('2026-06-14T08:00:00.000Z');
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
  };
  const wrongQuestion = {
    id: 'wrong_1',
    questionText: 'Compute 2x + 5 = 13.',
    subject: '数学',
    knowledgePoints: ['一元一次方程'],
    answer: 'x = 4',
    analysis: 'Move 5 then divide by 2.',
    imageUrl: null,
    status: 'UNRESOLVED' as const,
  };
  const reviewLog = {
    id: 'log_1',
    cardId: 'card_1',
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
    wrongQuestion: {
      findFirst: jest.fn(),
    },
    card: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reviewLog: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  function createService() {
    return new ReviewsService(prisma as unknown as PrismaService);
  }

  it('creates one review card from an owned wrong question', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue({ id: 'wrong_1' });
    prisma.card.findUnique.mockResolvedValue(null);
    prisma.card.create.mockResolvedValue(card);

    const result = await createService().createFromWrongQuestion('user_1', {
      wrongQuestionId: 'wrong_1',
    });

    expect(prisma.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.card.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        wrongQuestionId: 'wrong_1',
      },
    });
    expect(result).toMatchObject({
      created: true,
      card: { id: 'card_1', wrongQuestionId: 'wrong_1' },
    });
  });

  it('returns the existing card when the wrong question is already in review', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue({ id: 'wrong_1' });
    prisma.card.findUnique.mockResolvedValue(card);

    const result = await createService().createFromWrongQuestion('user_1', {
      wrongQuestionId: 'wrong_1',
    });

    expect(prisma.card.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      created: false,
      card: { id: 'card_1' },
    });
  });

  it('lists today review tasks scoped to the current user', async () => {
    prisma.card.findMany.mockResolvedValue([{ ...card, wrongQuestion }]);

    const result = await createService().getTodayTasks('user_1', '2026-06-14');

    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        suspendedAt: null,
        nextReview: {
          lte: new Date('2026-06-14T23:59:59.999Z'),
        },
      },
      include: { wrongQuestion: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });
    expect(result).toMatchObject({
      date: '2026-06-14',
      dueCount: 1,
      newCount: 1,
      learningCount: 0,
      reviewCount: 0,
      tasks: [
        {
          cardId: 'card_1',
          source: 'wrongQuestion',
          wrongQuestion: { id: 'wrong_1', subject: '数学' },
        },
      ],
    });
  });

  it('summarizes review stats scoped to the current user', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        ...reviewLog,
        id: 'log_1',
        cardId: 'card_1',
        rating: 1,
        reviewedAt: new Date('2026-06-12T08:00:00.000Z'),
      },
      {
        ...reviewLog,
        id: 'log_2',
        cardId: 'card_1',
        rating: 3,
        reviewedAt: new Date('2026-06-13T08:00:00.000Z'),
      },
      {
        ...reviewLog,
        id: 'log_3',
        cardId: 'card_2',
        rating: 4,
        reviewedAt: new Date('2026-06-14T08:00:00.000Z'),
      },
    ]);
    prisma.card.count.mockResolvedValue(1);
    prisma.card.groupBy.mockResolvedValue([
      { state: 'NEW', _count: { _all: 1 } },
      { state: 'REVIEW', _count: { _all: 2 } },
    ]);

    const result = await createService().getStats('user_1', {
      range: '7d',
      endDate: '2026-06-14',
      timezoneOffsetMinutes: -480,
    });

    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        reviewedAt: {
          gte: new Date('2026-06-07T16:00:00.000Z'),
          lte: new Date('2026-06-14T15:59:59.999Z'),
        },
        card: { userId: 'user_1' },
      },
      select: {
        cardId: true,
        rating: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: 'asc' },
    });
    expect(result).toMatchObject({
      range: '7d',
      fromDate: '2026-06-08',
      toDate: '2026-06-14',
      totalReviews: 3,
      reviewedCards: 2,
      dueCards: 1,
      accuracyLikeRate: 0.67,
      streakDays: 3,
      ratingCounts: { again: 1, hard: 0, good: 1, easy: 1 },
      stateCounts: { NEW: 1, LEARNING: 0, REVIEW: 2, RELEARNING: 0 },
    });
    expect(result.dailyReviews).toHaveLength(7);
    expect(result.dailyReviews.at(-1)).toEqual({
      date: '2026-06-14',
      count: 1,
    });
  });

  it('returns zeroed stats when there are no review logs', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([]);
    prisma.card.count.mockResolvedValue(0);
    prisma.card.groupBy.mockResolvedValue([]);

    const result = await createService().getStats('user_1', {
      range: '7d',
      endDate: '2026-06-14',
      timezoneOffsetMinutes: -480,
    });

    expect(result.totalReviews).toBe(0);
    expect(result.reviewedCards).toBe(0);
    expect(result.accuracyLikeRate).toBe(0);
    expect(result.streakDays).toBe(0);
    expect(result.dailyReviews.every((item) => item.count === 0)).toBe(true);
  });

  it('lists recent review logs scoped to the current user', async () => {
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        ...reviewLog,
        card: {
          ...card,
          nextReview: new Date('2026-06-15T08:00:00.000Z'),
          wrongQuestion,
        },
      },
    ]);
    prisma.reviewLog.count.mockResolvedValue(1);

    const result = await createService().getLogs('user_1', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        card: { userId: 'user_1' },
      },
      include: {
        card: {
          include: { wrongQuestion: true },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [
        {
          id: 'log_1',
          cardId: 'card_1',
          rating: 3,
          nextReview: '2026-06-15T08:00:00.000Z',
          currentCardState: 'NEW',
          wrongQuestion: {
            id: 'wrong_1',
            subject: '数学',
          },
        },
      ],
    });
  });

  it('submits a rating by updating the owned card and creating a review log', async () => {
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
    prisma.card.findFirst.mockResolvedValue(card);
    prisma.card.update.mockResolvedValue(updatedCard);
    prisma.reviewLog.create.mockResolvedValue(reviewLog);

    const result = await createService().submitRating('user_1', 'card_1', {
      rating: 3,
      reviewedAt: now.toISOString(),
      reviewDurationMs: 12000,
    });

    expect(prisma.card.findFirst).toHaveBeenCalledWith({
      where: { id: 'card_1', userId: 'user_1' },
    });
    expect(prisma.card.update).toHaveBeenCalledWith({
      where: { id: 'card_1' },
      data: {
        difficulty: 4.85,
        stability: 1,
        retrievability: 0.9,
        lastReview: now,
        nextReview: new Date('2026-06-15T08:00:00.000Z'),
        reviewCount: 1,
        lapses: 0,
        state: 'REVIEW',
      },
    });
    expect(prisma.reviewLog.create).toHaveBeenCalledWith({
      data: {
        cardId: 'card_1',
        rating: 3,
        scheduledDays: 1,
        elapsedDays: 0,
        reviewDurationMs: 12000,
        stabilityBefore: 0,
        stabilityAfter: 1,
        difficultyBefore: 5,
        difficultyAfter: 4.85,
        reviewedAt: now,
      },
    });
    expect(result).toMatchObject({
      card: { id: 'card_1', state: 'REVIEW' },
      log: { id: 'log_1', rating: 3 },
    });
  });
});
