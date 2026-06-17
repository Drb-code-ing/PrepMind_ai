import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { scheduleReview } from '@repo/fsrs';
import type {
  ReviewTaskListQuery,
  ReviewTaskPlanCapacityStatus,
  ReviewTaskPlanIntensity,
  ReviewTaskPlanQuery,
  ReviewTaskPlanResponse,
  ReviewTaskStatus,
  ReviewTaskTodayQuery,
} from '@repo/types/api/review-task';
import type { ReviewRatingRequest } from '@repo/types/api/review';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';

const taskInclude = {
  card: {
    include: {
      wrongQuestion: true,
    },
  },
} satisfies Prisma.ReviewTaskInclude;

@Injectable()
export class ReviewTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewPreferencesService: ReviewPreferencesService,
  ) {}

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
          (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELLED',
        );

    return {
      date: window.dateKey,
      pendingCount: this.countByStatus(tasks, 'PENDING'),
      completedCount: this.countByStatus(tasks, 'COMPLETED'),
      skippedCount: this.countByStatus(tasks, 'SKIPPED'),
      tasks: visibleTasks.map((task) => this.toTaskResponse(task)),
    };
  }

  async getPlan(
    userId: string,
    input: ReviewTaskPlanQuery,
  ): Promise<ReviewTaskPlanResponse> {
    const startWindow = this.resolveDateWindow(
      input.startDate,
      input.timezoneOffsetMinutes,
    );
    const dates = Array.from({ length: input.days }, (_, index) =>
      this.addDaysToDateKey(startWindow.dateKey, index),
    );
    const endDate = dates[dates.length - 1] ?? startWindow.dateKey;
    const endWindow = this.resolveDateWindow(
      endDate,
      input.timezoneOffsetMinutes,
    );
    const planCounts = new Map(
      dates.map((date) => [
        date,
        {
          dueCount: 0,
          pendingCount: 0,
          completedCount: 0,
          skippedCount: 0,
          cards: [] as ReviewPlanCard[],
        },
      ]),
    );

    const [preferences, overdueCount, cards, tasks] = await Promise.all([
      this.reviewPreferencesService.getByUserId(userId),
      this.prisma.card.count({
        where: {
          userId,
          suspendedAt: null,
          nextReview: { lt: startWindow.startUtc },
        },
      }),
      this.prisma.card.findMany({
        where: {
          userId,
          suspendedAt: null,
          nextReview: {
            gte: startWindow.startUtc,
            lte: endWindow.endUtc,
          },
        },
        select: { nextReview: true, difficulty: true, stability: true },
        orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.reviewTask.findMany({
        where: {
          userId,
          scheduledDate: { gte: startWindow.dateKey, lte: endDate },
          status: { in: ['PENDING', 'COMPLETED', 'SKIPPED'] },
        },
        select: { scheduledDate: true, status: true },
      }),
    ]);

    for (const card of cards) {
      const dateKey = this.toDateKey(
        card.nextReview,
        input.timezoneOffsetMinutes,
      );
      const counts = planCounts.get(dateKey);
      if (counts) {
        counts.dueCount += 1;
        counts.cards.push(card);
      }
    }

    for (const task of tasks) {
      const counts = planCounts.get(task.scheduledDate);
      if (!counts) continue;

      if (task.status === 'PENDING') counts.pendingCount += 1;
      if (task.status === 'COMPLETED') counts.completedCount += 1;
      if (task.status === 'SKIPPED') counts.skippedCount += 1;
    }

    const days = dates.map((date, index) => {
      const counts = planCounts.get(date);
      const dayOverdueCount = index === 0 ? overdueCount : 0;
      const reviewCount = (counts?.dueCount ?? 0) + dayOverdueCount;
      const cardsDueToday = counts?.cards ?? [];
      const difficultCount = cardsDueToday.filter(
        (card) => card.difficulty >= 7,
      ).length;
      const unstableCount = cardsDueToday.filter(
        (card) => card.stability > 0 && card.stability < 1.5,
      ).length;
      const pressureScore = this.calculatePressureScore({
        dueCount: counts?.dueCount ?? 0,
        overdueCount: dayOverdueCount,
        difficultCount,
        unstableCount,
      });
      const estimatedMinutes = Math.max(
        reviewCount * 2,
        Math.ceil(pressureScore * 2),
      );
      const capacityStatus = this.toCapacityStatus(
        estimatedMinutes,
        reviewCount,
        preferences.dailyMinutes,
        preferences.dailyCardLimit,
      );

      return {
        date,
        label: this.toPlanDayLabel(index),
        dueCount: counts?.dueCount ?? 0,
        overdueCount: dayOverdueCount,
        pendingCount: counts?.pendingCount ?? 0,
        completedCount: counts?.completedCount ?? 0,
        skippedCount: counts?.skippedCount ?? 0,
        estimatedMinutes,
        intensity: this.toPlanIntensity(reviewCount),
        pressureScore,
        capacityStatus,
        reasons: this.toPlanReasons({
          overdueCount: dayOverdueCount,
          difficultCount,
          unstableCount,
          capacityStatus,
        }),
      };
    });
    const todayDueCount = days[0]?.dueCount ?? 0;
    const upcomingDueCount = days
      .slice(1)
      .reduce((total, day) => total + day.dueCount, 0);
    const estimatedTotalMinutes = days.reduce(
      (total, day) => total + day.estimatedMinutes,
      0,
    );
    const peakDay = days.reduce<null | { date: string; count: number }>(
      (peak, day) => {
        const count = day.dueCount + day.overdueCount;
        if (count === 0) return peak;
        if (!peak || count > peak.count) return { date: day.date, count };
        return peak;
      },
      null,
    );
    const capacityStatus = this.toSummaryCapacityStatus(
      days.map((day) => day.capacityStatus),
    );

    return {
      startDate: startWindow.dateKey,
      endDate,
      generatedThroughDate: endDate,
      summary: {
        overdueCount,
        todayDueCount,
        upcomingDueCount,
        estimatedTotalMinutes,
        peakDay,
        intensity: this.toPlanIntensity(peakDay?.count ?? 0),
        capacityStatus,
        dailyMinutes: preferences.dailyMinutes,
        dailyCardLimit: preferences.dailyCardLimit,
      },
      days,
      suggestion: this.toPlanSuggestion(
        overdueCount,
        todayDueCount,
        upcomingDueCount,
        peakDay,
      ),
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

  private addDaysToDateKey(dateKey: string, days: number) {
    const year = Number(dateKey.slice(0, 4));
    const month = Number(dateKey.slice(5, 7));
    const day = Number(dateKey.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  private toDateKey(date: Date, timezoneOffsetMinutes: number) {
    const offsetMs = timezoneOffsetMinutes * 60 * 1000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  private toPlanDayLabel(index: number) {
    if (index === 0) return 'Today';
    if (index === 1) return 'Tomorrow';
    return `Day ${index + 1}`;
  }

  private toPlanIntensity(count: number): ReviewTaskPlanIntensity {
    if (count <= 5) return 'light';
    if (count <= 15) return 'normal';
    return 'heavy';
  }

  private calculatePressureScore(input: {
    dueCount: number;
    overdueCount: number;
    difficultCount: number;
    unstableCount: number;
  }) {
    const base = input.dueCount + input.overdueCount;
    const overduePenalty = input.overdueCount * 1.5;
    const difficultPenalty = input.difficultCount * 0.5;
    const unstablePenalty = input.unstableCount * 0.35;

    return this.roundToOne(
      base + overduePenalty + difficultPenalty + unstablePenalty,
    );
  }

  private roundToOne(value: number) {
    return Math.round(value * 10) / 10;
  }

  private toCapacityStatus(
    estimatedMinutes: number,
    reviewCount: number,
    dailyMinutes: number,
    dailyCardLimit: number,
  ): ReviewTaskPlanCapacityStatus {
    if (estimatedMinutes > dailyMinutes || reviewCount > dailyCardLimit) {
      return 'over';
    }
    if (
      estimatedMinutes >= dailyMinutes * 0.8 ||
      reviewCount >= dailyCardLimit * 0.8
    ) {
      return 'near';
    }

    return 'under';
  }

  private toSummaryCapacityStatus(
    statuses: ReviewTaskPlanCapacityStatus[],
  ): ReviewTaskPlanCapacityStatus {
    if (statuses.includes('over')) return 'over';
    if (statuses.includes('near')) return 'near';
    return 'under';
  }

  private toPlanReasons(input: {
    overdueCount: number;
    difficultCount: number;
    unstableCount: number;
    capacityStatus: ReviewTaskPlanCapacityStatus;
  }) {
    const reasons: string[] = [];
    if (input.overdueCount > 0) {
      reasons.push('有逾期复习卡，建议优先处理');
    }
    if (input.difficultCount > 0) {
      reasons.push('高难度卡片较多');
    }
    if (input.unstableCount > 0) {
      reasons.push('低稳定性卡片较多');
    }
    if (input.capacityStatus === 'over') {
      reasons.push('超过你的每日复习容量');
    }

    return reasons;
  }

  private toPlanSuggestion(
    overdueCount: number,
    todayDueCount: number,
    upcomingDueCount: number,
    peakDay: null | { date: string; count: number },
  ) {
    if (overdueCount > 0) {
      return {
        title: '先处理逾期卡',
        description: `有 ${overdueCount} 张卡已逾期，优先回到今日任务清掉压力。`,
        actionLabel: '去今日任务',
        actionHref: '/today',
      };
    }
    if (todayDueCount > 0) {
      return {
        title: '今天保持节奏',
        description: `今天有 ${todayDueCount} 张卡到期，按当前节奏完成即可。`,
        actionLabel: '去今日任务',
        actionHref: '/today',
      };
    }
    if (upcomingDueCount > 0 && peakDay) {
      return {
        title: '提前看一下高峰日',
        description: `${peakDay.date} 预计有 ${peakDay.count} 张卡到期，可以提前回顾相关错题。`,
        actionLabel: '查看错题本',
        actionHref: '/error-book',
      };
    }

    return {
      title: '当前复习压力很轻',
      description: '未来几天暂无明显复习高峰，可以继续整理错题和补齐薄弱点。',
      actionLabel: '查看错题本',
      actionHref: '/error-book',
    };
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
    return new AppError(
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
    if (!this.isPrismaKnownRequestError(error)) {
      return false;
    }
    if (error.code !== 'P2002') return false;

    const target = error.meta?.target;
    if (Array.isArray(target)) return target.includes('clientMutationId');
    return typeof target === 'string' && target.includes('clientMutationId');
  }

  private isPrismaKnownRequestError(
    error: unknown,
  ): error is PrismaKnownRequestErrorLike {
    if (!error || typeof error !== 'object') return false;

    const candidate = error as Partial<PrismaKnownRequestErrorLike>;
    return (
      typeof candidate.code === 'string' &&
      typeof candidate.clientVersion === 'string'
    );
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
type ReviewPlanCard = {
  nextReview: Date;
  difficulty: number;
  stability: number;
};

type PrismaKnownRequestErrorLike = {
  code: string;
  clientVersion: string;
  meta?: {
    target?: unknown;
  };
};
