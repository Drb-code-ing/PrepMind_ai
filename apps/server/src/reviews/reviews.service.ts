import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scheduleReview } from '@repo/fsrs';
import type {
  CreateReviewCardFromWrongQuestionRequest,
  ReviewRatingRequest,
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

  private cardNotFound() {
    return new AppError(
      'REVIEW_CARD_NOT_FOUND',
      '复习卡片不存在或无权访问',
      HttpStatus.NOT_FOUND,
    );
  }
}

type CardRecord = Prisma.CardGetPayload<object>;
type ReviewLogRecord = Prisma.ReviewLogGetPayload<object>;
type ReviewTaskRecord = Prisma.CardGetPayload<{
  include: { wrongQuestion: true };
}>;
