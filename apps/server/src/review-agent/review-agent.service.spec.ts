import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';
import { ReviewTasksService } from '../review-tasks/review-tasks.service';
import { ReviewAgentService } from './review-agent.service';

describe('ReviewAgentService', () => {
  const now = new Date('2026-06-22T08:30:00.000Z');
  const query = {
    startDate: '2026-06-22',
    days: 7,
    timezoneOffsetMinutes: -480,
  };
  const plan = {
    startDate: '2026-06-22',
    endDate: '2026-06-28',
    generatedThroughDate: '2026-06-28',
    summary: {
      overdueCount: 1,
      todayDueCount: 2,
      upcomingDueCount: 3,
      estimatedTotalMinutes: 24,
      peakDay: { date: '2026-06-23', count: 3 },
      intensity: 'normal' as const,
      capacityStatus: 'near' as const,
      dailyMinutes: 30,
      dailyCardLimit: 12,
    },
    days: [],
    suggestion: {
      title: '先处理今日复习',
      description: '今日有复习压力。',
      actionLabel: '去今日任务',
      actionHref: '/today',
    },
  };
  const preference = {
    dailyMinutes: 30,
    dailyCardLimit: 12,
    preferredReviewTime: '20:30',
    reminderEnabled: true,
    reminderLeadMinutes: 30,
    weekendMode: 'same' as const,
    planWindowDays: 7 as const,
    updatedAt: now.toISOString(),
  };
  const prisma = {
    card: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewTask: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewPreference: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    wrongQuestion: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    wrongQuestionDeck: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    wrongQuestionDeckItem: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const reviewTasksService = {
    getPlan: jest.fn(),
    getToday: jest.fn(),
  };
  const reviewPreferencesService = {
    getByUserId: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    reviewTasksService.getPlan.mockResolvedValue(plan);
    reviewPreferencesService.getByUserId.mockResolvedValue(preference);
    prisma.card.findMany.mockResolvedValue([
      {
        id: 'card_1',
        userId: 'user_1',
        wrongQuestionId: 'wrong_1',
        difficulty: 8,
        stability: 1.2,
        nextReview: new Date('2026-06-22T07:00:00.000Z'),
        suspendedAt: null,
        wrongQuestion: {
          id: 'wrong_1',
          subject: '数学',
          knowledgePoints: ['格林公式'],
          deckItems: [
            {
              deck: {
                name: '曲线积分',
                subjectGroup: { displayName: '高等数学', subject: '数学' },
              },
            },
          ],
        },
      },
      {
        id: 'card_2',
        userId: 'user_1',
        wrongQuestionId: 'wrong_2',
        difficulty: 6,
        stability: 2.4,
        nextReview: new Date('2026-06-21T23:00:00.000Z'),
        suspendedAt: null,
        wrongQuestion: {
          id: 'wrong_2',
          subject: '数学',
          knowledgePoints: ['格林公式', '曲面积分'],
          deckItems: [
            {
              deck: {
                name: '曲线积分',
                subjectGroup: { displayName: '高等数学', subject: '数学' },
              },
            },
          ],
        },
      },
    ]);
    prisma.reviewLog.findMany.mockResolvedValue([
      {
        id: 'log_1',
        cardId: 'card_1',
        rating: 1,
        reviewedAt: new Date('2026-06-21T10:00:00.000Z'),
        card: {
          wrongQuestion: {
            id: 'wrong_1',
            subject: '数学',
            knowledgePoints: ['格林公式'],
          },
        },
      },
      {
        id: 'log_2',
        cardId: 'card_2',
        rating: 3,
        reviewedAt: new Date('2026-06-20T10:00:00.000Z'),
        card: {
          wrongQuestion: {
            id: 'wrong_2',
            subject: '数学',
            knowledgePoints: ['格林公式', '曲面积分'],
          },
        },
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new ReviewAgentService(
      prisma as unknown as PrismaService,
      reviewTasksService as unknown as ReviewTasksService,
      reviewPreferencesService as unknown as ReviewPreferencesService,
    );
  }

  it('builds read-only review and planner suggestions from plan, preferences, cards, and logs', async () => {
    const result = await createService().getSuggestions('user_1', query);

    expect(reviewTasksService.getPlan).toHaveBeenCalledWith('user_1', query);
    expect(reviewPreferencesService.getByUserId).toHaveBeenCalledWith('user_1');
    expect(reviewTasksService.getToday).not.toHaveBeenCalled();
    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', suspendedAt: null },
      include: {
        wrongQuestion: {
          include: {
            deckItems: {
              include: {
                deck: {
                  include: {
                    subjectGroup: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        reviewedAt: { gte: new Date('2026-06-08T08:30:00.000Z') },
        card: { userId: 'user_1' },
      },
      include: {
        card: {
          include: {
            wrongQuestion: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 200,
    });
    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.review.weakPoints[0]?.label).toBe('格林公式');
    expect(result.planner.suggestedBlocks.length).toBeGreaterThan(0);
    expect(result.planSummary).toEqual(plan.summary);
  });

  it('does not write review tasks, cards, logs, preferences, wrong questions, or organizer data', async () => {
    await createService().getSuggestions('user_1', query);

    expect(prisma.reviewTask.create).not.toHaveBeenCalled();
    expect(prisma.reviewTask.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewTask.update).not.toHaveBeenCalled();
    expect(prisma.reviewTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.card.create).not.toHaveBeenCalled();
    expect(prisma.card.createMany).not.toHaveBeenCalled();
    expect(prisma.card.update).not.toHaveBeenCalled();
    expect(prisma.card.updateMany).not.toHaveBeenCalled();
    expect(prisma.reviewLog.create).not.toHaveBeenCalled();
    expect(prisma.reviewLog.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewLog.update).not.toHaveBeenCalled();
    expect(prisma.reviewLog.updateMany).not.toHaveBeenCalled();
    expect(prisma.reviewPreference.create).not.toHaveBeenCalled();
    expect(prisma.reviewPreference.createMany).not.toHaveBeenCalled();
    expect(prisma.reviewPreference.update).not.toHaveBeenCalled();
    expect(prisma.reviewPreference.updateMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestion.create).not.toHaveBeenCalled();
    expect(prisma.wrongQuestion.createMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestion.update).not.toHaveBeenCalled();
    expect(prisma.wrongQuestion.updateMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.createMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.update).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.updateMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.create).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.createMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.update).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.updateMany).not.toHaveBeenCalled();
  });
});
