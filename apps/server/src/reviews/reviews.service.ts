import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scheduleReview } from '@repo/fsrs';
import type {
  CreateReviewCardFromWrongQuestionRequest,
  ReviewLogListQuery,
  ReviewRatingRequest,
  ReviewStatsQuery,
} from '@repo/types/api/review';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromWrongQuestion(
    userId: string,
    input: CreateReviewCardFromWrongQuestionRequest,
  ) {
    await this.ensureWrongQuestionOwned(userId, input.wrongQuestionId);

    const existing = await this.prisma.card.findUnique({
      where: { wrongQuestionId: input.wrongQuestionId },
    });
    if (existing) {
      return {
        card: this.toCardResponse(existing),
        created: false,
      };
    }

    const card = await this.prisma.card.create({
      data: {
        userId,
        wrongQuestionId: input.wrongQuestionId,
      },
    });

    return {
      card: this.toCardResponse(card),
      created: true,
    };
  }

  async getByWrongQuestion(userId: string, wrongQuestionId: string) {
    const card = await this.prisma.card.findFirst({
      where: { userId, wrongQuestionId },
    });

    return {
      card: card ? this.toCardResponse(card) : null,
    };
  }

  async getTodayTasks(userId: string, date?: string) {
    const { dateKey, endOfDay } = this.resolveDateWindow(date);
    const cards = await this.prisma.card.findMany({
      where: {
        userId,
        suspendedAt: null,
        nextReview: {
          lte: endOfDay,
        },
      },
      include: { wrongQuestion: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    return {
      date: dateKey,
      dueCount: cards.length,
      newCount: cards.filter((card) => card.state === 'NEW').length,
      learningCount: cards.filter((card) =>
        ['LEARNING', 'RELEARNING'].includes(card.state),
      ).length,
      reviewCount: cards.filter((card) => card.state === 'REVIEW').length,
      tasks: cards.map((card) => this.toTaskResponse(card)),
    };
  }

  async getStats(userId: string, input: ReviewStatsQuery) {
    const window = this.resolveStatsWindow(input);
    const [logs, dueCards, groupedStates] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where: {
          reviewedAt: {
            gte: window.fromUtc,
            lte: window.toUtc,
          },
          card: { userId },
        },
        select: {
          cardId: true,
          rating: true,
          reviewedAt: true,
        },
        orderBy: { reviewedAt: 'asc' },
      }),
      this.prisma.card.count({
        where: {
          userId,
          suspendedAt: null,
          nextReview: { lte: new Date() },
        },
      }),
      this.prisma.card.groupBy({
        by: ['state'],
        where: {
          userId,
          suspendedAt: null,
        },
        _count: { _all: true },
      }),
    ]);

    const ratingCounts = {
      again: logs.filter((log) => log.rating === 1).length,
      hard: logs.filter((log) => log.rating === 2).length,
      good: logs.filter((log) => log.rating === 3).length,
      easy: logs.filter((log) => log.rating === 4).length,
    };
    const totalReviews = logs.length;
    const masteredReviews = ratingCounts.good + ratingCounts.easy;

    return {
      range: input.range,
      fromDate: window.fromDate,
      toDate: window.toDate,
      totalReviews,
      reviewedCards: new Set(logs.map((log) => log.cardId)).size,
      dueCards,
      accuracyLikeRate:
        totalReviews === 0 ? 0 : roundRatio(masteredReviews / totalReviews),
      streakDays: this.calculateStreakDays(logs, window),
      ratingCounts,
      stateCounts: this.toStateCounts(groupedStates),
      dailyReviews: this.toDailyReviewCounts(logs, window),
    };
  }

  async getLogs(userId: string, input: ReviewLogListQuery) {
    const skip = (input.page - 1) * input.pageSize;
    const where = {
      card: { userId },
    } satisfies Prisma.ReviewLogWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where,
        include: {
          card: {
            include: { wrongQuestion: true },
          },
        },
        orderBy: { reviewedAt: 'desc' },
        skip,
        take: input.pageSize,
      }),
      this.prisma.reviewLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toLogListItemResponse(item)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async submitRating(
    userId: string,
    cardId: string,
    input: ReviewRatingRequest,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.findFirst({
        where: { id: cardId, userId },
      });
      if (!card) {
        throw this.cardNotFound();
      }

      const reviewedAt = input.reviewedAt
        ? new Date(input.reviewedAt)
        : new Date();
      const scheduled = scheduleReview({
        card: {
          difficulty: card.difficulty,
          stability: card.stability,
          retrievability: card.retrievability,
          lastReview: card.lastReview,
          nextReview: card.nextReview,
          reviewCount: card.reviewCount,
          lapses: card.lapses,
          state: card.state,
        },
        rating: input.rating,
        reviewedAt,
      });

      const updatedCard = await tx.card.update({
        where: { id: card.id },
        data: {
          difficulty: scheduled.card.difficulty,
          stability: scheduled.card.stability,
          retrievability: scheduled.card.retrievability,
          lastReview: scheduled.card.lastReview,
          nextReview: scheduled.card.nextReview,
          reviewCount: scheduled.card.reviewCount,
          lapses: scheduled.card.lapses,
          state: scheduled.card.state,
        },
      });
      const log = await tx.reviewLog.create({
        data: {
          cardId: card.id,
          rating: input.rating,
          scheduledDays: scheduled.log.scheduledDays,
          elapsedDays: scheduled.log.elapsedDays,
          reviewDurationMs: input.reviewDurationMs,
          stabilityBefore: scheduled.log.stabilityBefore,
          stabilityAfter: scheduled.log.stabilityAfter,
          difficultyBefore: scheduled.log.difficultyBefore,
          difficultyAfter: scheduled.log.difficultyAfter,
          reviewedAt,
        },
      });

      return {
        card: this.toCardResponse(updatedCard),
        log: this.toLogResponse(log),
      };
    });
  }

  private async ensureWrongQuestionOwned(
    userId: string,
    wrongQuestionId: string,
  ) {
    const existing = await this.prisma.wrongQuestion.findFirst({
      where: { id: wrongQuestionId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError(
        'REVIEW_SOURCE_NOT_FOUND',
        '错题不存在或无权访问',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private resolveStatsWindow(input: ReviewStatsQuery) {
    const rangeDays = input.range === '30d' ? 30 : 7;
    const endDate = input.endDate ?? new Date().toISOString().slice(0, 10);
    const toLocal = new Date(`${endDate}T00:00:00.000Z`);
    toLocal.setUTCDate(toLocal.getUTCDate() + 1);
    toLocal.setUTCMilliseconds(toLocal.getUTCMilliseconds() - 1);

    const fromLocal = new Date(`${endDate}T00:00:00.000Z`);
    fromLocal.setUTCDate(fromLocal.getUTCDate() - rangeDays + 1);

    const offsetMs = input.timezoneOffsetMinutes * 60 * 1000;

    return {
      rangeDays,
      fromDate: this.formatDateKey(fromLocal),
      toDate: endDate,
      fromUtc: new Date(fromLocal.getTime() + offsetMs),
      toUtc: new Date(toLocal.getTime() + offsetMs),
      timezoneOffsetMinutes: input.timezoneOffsetMinutes,
    };
  }

  private toDailyReviewCounts(
    logs: Array<{ reviewedAt: Date }>,
    window: ReviewStatsWindow,
  ) {
    const counts = new Map<string, number>();
    for (let index = 0; index < window.rangeDays; index += 1) {
      const date = new Date(`${window.fromDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      counts.set(this.formatDateKey(date), 0);
    }

    for (const log of logs) {
      const localTime = new Date(
        log.reviewedAt.getTime() - window.timezoneOffsetMinutes * 60 * 1000,
      );
      const key = this.formatDateKey(localTime);
      if (counts.has(key)) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  private calculateStreakDays(
    logs: Array<{ reviewedAt: Date }>,
    window: ReviewStatsWindow,
  ) {
    const reviewedDates = new Set(
      logs.map((log) =>
        this.formatDateKey(
          new Date(
            log.reviewedAt.getTime() - window.timezoneOffsetMinutes * 60 * 1000,
          ),
        ),
      ),
    );
    let streak = 0;
    const cursor = new Date(`${window.toDate}T00:00:00.000Z`);
    for (let index = 0; index < window.rangeDays; index += 1) {
      const key = this.formatDateKey(cursor);
      if (!reviewedDates.has(key)) break;
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }

  private toStateCounts(
    groups: Array<{ state: string; _count: { _all: number } }>,
  ) {
    const counts = {
      NEW: 0,
      LEARNING: 0,
      REVIEW: 0,
      RELEARNING: 0,
    };

    for (const group of groups) {
      if (group.state in counts) {
        counts[group.state as keyof typeof counts] = group._count._all;
      }
    }

    return counts;
  }

  private formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private resolveDateWindow(date?: string) {
    const dateKey = date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new AppError(
        'REVIEW_DATE_INVALID',
        '复习日期格式不正确',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      dateKey,
      endOfDay: new Date(`${dateKey}T23:59:59.999Z`),
    };
  }

  private toTaskResponse(card: ReviewTaskRecord) {
    return {
      cardId: card.id,
      dueAt: card.nextReview.toISOString(),
      state: card.state,
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      source: card.wrongQuestion
        ? ('wrongQuestion' as const)
        : ('question' as const),
      wrongQuestion: card.wrongQuestion
        ? {
            id: card.wrongQuestion.id,
            questionText: card.wrongQuestion.questionText,
            subject: card.wrongQuestion.subject,
            knowledgePoints: card.wrongQuestion.knowledgePoints,
            answer: card.wrongQuestion.answer,
            analysis: card.wrongQuestion.analysis,
            imageUrl: card.wrongQuestion.imageUrl,
            status: card.wrongQuestion.status,
          }
        : undefined,
    };
  }

  private toCardResponse(card: CardRecord) {
    return {
      id: card.id,
      userId: card.userId,
      questionId: card.questionId,
      wrongQuestionId: card.wrongQuestionId,
      difficulty: card.difficulty,
      stability: card.stability,
      retrievability: card.retrievability,
      lastReview: card.lastReview ? card.lastReview.toISOString() : null,
      nextReview: card.nextReview.toISOString(),
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      state: card.state,
      suspendedAt: card.suspendedAt ? card.suspendedAt.toISOString() : null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  private toLogResponse(log: ReviewLogRecord) {
    return {
      id: log.id,
      cardId: log.cardId,
      rating: log.rating as 1 | 2 | 3 | 4,
      scheduledDays: log.scheduledDays,
      elapsedDays: log.elapsedDays,
      reviewDurationMs: log.reviewDurationMs,
      stabilityBefore: log.stabilityBefore,
      stabilityAfter: log.stabilityAfter,
      difficultyBefore: log.difficultyBefore,
      difficultyAfter: log.difficultyAfter,
      reviewedAt: log.reviewedAt.toISOString(),
    };
  }

  private toLogListItemResponse(log: ReviewLogListRecord) {
    return {
      id: log.id,
      cardId: log.cardId,
      rating: log.rating as 1 | 2 | 3 | 4,
      scheduledDays: log.scheduledDays,
      elapsedDays: log.elapsedDays,
      reviewDurationMs: log.reviewDurationMs,
      reviewedAt: log.reviewedAt.toISOString(),
      nextReview: log.card.nextReview.toISOString(),
      currentCardState: log.card.state,
      wrongQuestion: log.card.wrongQuestion
        ? {
            id: log.card.wrongQuestion.id,
            questionText: log.card.wrongQuestion.questionText,
            subject: log.card.wrongQuestion.subject,
            knowledgePoints: log.card.wrongQuestion.knowledgePoints,
            status: log.card.wrongQuestion.status,
          }
        : undefined,
    };
  }

  private cardNotFound() {
    return new AppError(
      'REVIEW_CARD_NOT_FOUND',
      '复习卡片不存在或无权访问',
      HttpStatus.NOT_FOUND,
    );
  }
}

function roundRatio(value: number) {
  return Math.round(value * 100) / 100;
}

type ReviewStatsWindow = {
  rangeDays: number;
  fromDate: string;
  toDate: string;
  fromUtc: Date;
  toUtc: Date;
  timezoneOffsetMinutes: number;
};

type CardRecord = Prisma.CardGetPayload<object>;
type ReviewLogRecord = Prisma.ReviewLogGetPayload<object>;
type ReviewTaskRecord = Prisma.CardGetPayload<{
  include: { wrongQuestion: true };
}>;
type ReviewLogListRecord = Prisma.ReviewLogGetPayload<{
  include: {
    card: {
      include: { wrongQuestion: true };
    };
  };
}>;
