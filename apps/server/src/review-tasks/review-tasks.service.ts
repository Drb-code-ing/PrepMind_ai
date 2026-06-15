import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scheduleReview } from '@repo/fsrs';
import type {
  ReviewTaskListQuery,
  ReviewTaskStatus,
  ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';
import type { ReviewRatingRequest } from '@repo/types/api/review';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const taskInclude = {
  card: {
    include: {
      wrongQuestion: true,
    },
  },
} satisfies Prisma.ReviewTaskInclude;

@Injectable()
export class ReviewTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(userId: string, input: ReviewTaskTodayQuery) {
    const window = this.resolveDateWindow(
      input.date,
      input.timezoneOffsetMinutes,
    );

    await this.generateDueTasks(userId, window);

    const tasks = await this.prisma.reviewTask.findMany({
      where: {
        userId,
        scheduledDate: window.dateKey,
      },
      include: taskInclude,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    });
    const visibleTasks = input.includeCompleted
      ? tasks
      : tasks.filter(
          (task) =>
            task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
        );

    return {
      date: window.dateKey,
      pendingCount: this.countByStatus(tasks, 'PENDING'),
      completedCount: this.countByStatus(tasks, 'COMPLETED'),
      skippedCount: this.countByStatus(tasks, 'SKIPPED'),
      tasks: visibleTasks.map((task) => this.toTaskResponse(task)),
    };
  }

  async list(userId: string, input: ReviewTaskListQuery) {
    const skip = (input.page - 1) * input.pageSize;
    const where = {
      userId,
      scheduledDate: input.date,
      status: input.status,
    } satisfies Prisma.ReviewTaskWhereInput;

    const [items, total] = await Promise.all([
      this.prisma.reviewTask.findMany({
        where,
        include: taskInclude,
        orderBy: [
          { scheduledDate: 'desc' },
          { dueAt: 'asc' },
          { createdAt: 'asc' },
        ],
        skip,
        take: input.pageSize,
      }),
      this.prisma.reviewTask.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toTaskResponse(item)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async submitRating(
    userId: string,
    taskId: string,
    input: ReviewRatingRequest,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.clientMutationId) {
          const existing = await this.findExistingRatingLog(
            input.clientMutationId,
            tx,
          );
          if (existing) {
            return this.returnExistingRatingResult(userId, taskId, existing);
          }
        }

        const task = await tx.reviewTask.findFirst({
          where: { id: taskId, userId },
          include: taskInclude,
        });
        if (!task) {
          throw this.taskNotFound();
        }
        this.ensurePendingTask(task);
        this.ensureCurrentDueTask(task);

        const card = task.card;
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

        const updatedCardResult = await tx.card.updateMany({
          where: {
            id: card.id,
            userId,
            updatedAt: card.updatedAt,
            nextReview: card.nextReview,
          },
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
        if (updatedCardResult.count !== 1) {
          if (input.clientMutationId) {
            const existing = await this.findExistingRatingLog(
              input.clientMutationId,
              tx,
            );
            if (existing) {
              return this.returnExistingRatingResult(userId, taskId, existing);
            }
          }
          throw this.taskNotPending();
        }

        const log = await tx.reviewLog.create({
          data: {
            cardId: card.id,
            clientMutationId: input.clientMutationId ?? null,
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

        const completed = await tx.reviewTask.updateMany({
          where: { id: task.id, userId, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            reviewLogId: log.id,
            completedAt: reviewedAt,
            skippedAt: null,
          },
        });
        if (completed.count !== 1) {
          throw this.taskNotPending();
        }

        await tx.reviewTask.updateMany({
          where: {
            userId,
            cardId: card.id,
            status: { in: ['PENDING', 'SKIPPED'] },
            id: { not: task.id },
          },
          data: { status: 'CANCELLED', skippedAt: null },
        });

        const updatedCard = await tx.card.findFirst({
          where: { id: card.id, userId },
        });
        if (!updatedCard) {
          throw this.taskNotFound();
        }

        const completedTask = await tx.reviewTask.findFirst({
          where: { id: task.id, userId },
          include: taskInclude,
        });
        if (!completedTask) {
          throw this.taskNotFound();
        }

        return {
          task: this.toTaskResponse(completedTask),
          card: this.toCardResponse(updatedCard),
          log: this.toLogResponse(log),
        };
      });
    } catch (error) {
      if (this.isClientMutationIdUniqueConflict(error)) {
        if (input.clientMutationId) {
          const existing = await this.findExistingRatingLog(
            input.clientMutationId,
          );
          if (existing) {
            return this.returnExistingRatingResult(userId, taskId, existing);
          }
        }
        throw this.idempotencyConflict();
      }
      throw error;
    }
  }

  async skip(userId: string, taskId: string, skippedAt = new Date()) {
    return await this.prisma.$transaction(async (tx) => {
      const task = await tx.reviewTask.findFirst({
        where: { id: taskId, userId },
        include: taskInclude,
      });
      if (!task) {
        throw this.taskNotFound();
      }
      if (task.status === 'COMPLETED') {
        throw this.taskAlreadyCompleted();
      }
      if (task.status === 'CANCELLED') {
        throw this.taskNotPending();
      }
      this.ensureCurrentDueTask(task);
      if (task.status === 'SKIPPED') {
        return { task: this.toTaskResponse(task) };
      }

      const skipped = await tx.reviewTask.updateMany({
        where: { id: task.id, userId, status: 'PENDING' },
        data: {
          status: 'SKIPPED',
          skippedAt,
        },
      });
      if (skipped.count !== 1) {
        throw this.taskNotPending();
      }

      const skippedTask = await tx.reviewTask.findFirst({
        where: { id: task.id, userId },
        include: taskInclude,
      });
      if (!skippedTask) {
        throw this.taskNotFound();
      }
      this.ensureCurrentDueTask(skippedTask);

      return { task: this.toTaskResponse(skippedTask) };
    });
  }

  async reopen(userId: string, taskId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const task = await tx.reviewTask.findFirst({
        where: { id: taskId, userId },
        include: taskInclude,
      });
      if (!task) {
        throw this.taskNotFound();
      }
      if (task.status === 'COMPLETED') {
        throw this.taskAlreadyCompleted();
      }
      if (task.status === 'CANCELLED') {
        throw this.taskNotPending();
      }

      this.ensureCurrentDueTask(task);

      if (task.status === 'PENDING') {
        return { task: this.toTaskResponse(task) };
      }

      const reopened = await tx.reviewTask.updateMany({
        where: { id: task.id, userId, status: 'SKIPPED' },
        data: {
          status: 'PENDING',
          skippedAt: null,
        },
      });
      if (reopened.count !== 1) {
        throw this.taskNotPending();
      }

      const reopenedTask = await tx.reviewTask.findFirst({
        where: { id: task.id, userId },
        include: taskInclude,
      });
      if (!reopenedTask) {
        throw this.taskNotFound();
      }
      this.ensureCurrentDueTask(reopenedTask);

      return { task: this.toTaskResponse(reopenedTask) };
    });
  }

  private async generateDueTasks(userId: string, window: ReviewDateWindow) {
    const dueCards = await this.prisma.card.findMany({
      where: {
        userId,
        suspendedAt: null,
        nextReview: { lte: window.endUtc },
      },
      select: { id: true, nextReview: true },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    if (dueCards.length === 0) return;

    await this.prisma.reviewTask.createMany({
      data: dueCards.map((card) => ({
        userId,
        cardId: card.id,
        scheduledDate: window.dateKey,
        dueAt: card.nextReview,
        status: 'PENDING',
        source: 'FSRS',
      })),
      skipDuplicates: true,
    });
  }

  private resolveDateWindow(
    date: string | undefined,
    timezoneOffsetMinutes: number,
  ) {
    const offsetMs = timezoneOffsetMinutes * 60 * 1000;
    const dateKey =
      date ?? new Date(Date.now() - offsetMs).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      throw new AppError(
        'REVIEW_TASK_DATE_INVALID',
        '复习任务日期格式不正确',
        HttpStatus.BAD_REQUEST,
      );
    }

    const startLocal = new Date(`${dateKey}T00:00:00.000Z`);
    const endLocal = new Date(`${dateKey}T23:59:59.999Z`);

    return {
      dateKey,
      startUtc: new Date(startLocal.getTime() + offsetMs),
      endUtc: new Date(endLocal.getTime() + offsetMs),
      timezoneOffsetMinutes,
    };
  }

  private countByStatus(tasks: ReviewTaskWithCard[], status: ReviewTaskStatus) {
    return tasks.filter((task) => task.status === status).length;
  }

  private ensurePendingTask(task: ReviewTaskWithCard) {
    if (task.status === 'PENDING') return;

    throw this.taskNotPending();
  }

  private ensureCurrentDueTask(task: ReviewTaskWithCard) {
    if (task.dueAt.getTime() === task.card.nextReview.getTime()) return;

    throw this.taskNotPending();
  }

  private taskNotPending() {
    throw new AppError(
      'REVIEW_TASK_NOT_PENDING',
      '只能对待复习任务评分',
      HttpStatus.CONFLICT,
    );
  }

  private returnExistingRatingResult(
    userId: string,
    taskId: string,
    existing: ReviewLogWithTask,
  ) {
    if (existing.card.userId !== userId) throw this.idempotencyConflict();
    if (!existing.reviewTask || existing.reviewTask.id !== taskId) {
      throw this.idempotencyConflict();
    }
    if (existing.reviewTask.userId !== userId) {
      throw this.idempotencyConflict();
    }
    if (existing.reviewTask.cardId !== existing.cardId) {
      throw this.idempotencyConflict();
    }

    return {
      task: this.toTaskResponse(existing.reviewTask),
      card: this.toCardResponse(existing.card),
      log: this.toLogResponse(existing),
    };
  }

  private findExistingRatingLog(
    clientMutationId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return client.reviewLog.findUnique({
      where: { clientMutationId },
      include: {
        card: true,
        reviewTask: { include: taskInclude },
      },
    });
  }

  private isClientMutationIdUniqueConflict(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }
    if (error.code !== 'P2002') return false;

    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes('clientMutationId');
    return typeof target === 'string' && target.includes('clientMutationId');
  }

  private idempotencyConflict() {
    return new AppError(
      'REVIEW_RATING_IDEMPOTENCY_CONFLICT',
      '这次复习评分命令已经被其他任务使用，请刷新后重试',
      HttpStatus.CONFLICT,
    );
  }

  private toTaskResponse(task: ReviewTaskWithCard) {
    return {
      id: task.id,
      userId: task.userId,
      cardId: task.cardId,
      reviewLogId: task.reviewLogId,
      scheduledDate: task.scheduledDate,
      dueAt: task.dueAt.toISOString(),
      status: task.status,
      source: task.source,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      skippedAt: task.skippedAt ? task.skippedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      card: this.toCardResponse(task.card),
      wrongQuestion: task.card.wrongQuestion
        ? {
            id: task.card.wrongQuestion.id,
            questionText: task.card.wrongQuestion.questionText,
            subject: task.card.wrongQuestion.subject,
            knowledgePoints: task.card.wrongQuestion.knowledgePoints,
            answer: task.card.wrongQuestion.answer,
            analysis: task.card.wrongQuestion.analysis,
            imageUrl: task.card.wrongQuestion.imageUrl,
            status: task.card.wrongQuestion.status,
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
      clientMutationId: log.clientMutationId,
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

  private taskNotFound() {
    return new AppError(
      'REVIEW_TASK_NOT_FOUND',
      '复习任务不存在或无权访问',
      HttpStatus.NOT_FOUND,
    );
  }

  private taskAlreadyCompleted() {
    return new AppError(
      'REVIEW_TASK_ALREADY_COMPLETED',
      '已完成的复习任务不能修改状态',
      HttpStatus.CONFLICT,
    );
  }
}

type ReviewDateWindow = {
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
  timezoneOffsetMinutes: number;
};

type ReviewTaskWithCard = Prisma.ReviewTaskGetPayload<{
  include: typeof taskInclude;
}>;
type ReviewLogWithTask = Prisma.ReviewLogGetPayload<{
  include: {
    card: true;
    reviewTask: { include: typeof taskInclude };
  };
}>;
type CardRecord = Prisma.CardGetPayload<object>;
type ReviewLogRecord = Prisma.ReviewLogGetPayload<object>;
