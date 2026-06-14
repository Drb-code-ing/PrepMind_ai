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
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    reviewLog: {
      create: jest.fn(),
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
