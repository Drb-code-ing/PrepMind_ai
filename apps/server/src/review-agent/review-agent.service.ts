import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { planStudy } from '@repo/agent/planner';
import { analyzeReview } from '@repo/agent/review';
import type {
  ReviewAgentInput,
  ReviewAgentSuggestionQuery,
  ReviewAgentSuggestionResponse,
  ReviewAgentWeakPointInput,
} from '@repo/types/api/review-agent';

import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';
import { ReviewTasksService } from '../review-tasks/review-tasks.service';

const RECENT_REVIEW_DAYS = 14;

const cardSignalSelect = {
  nextReview: true,
  difficulty: true,
  stability: true,
  wrongQuestion: {
    select: {
      subject: true,
      knowledgePoints: true,
      deckItems: {
        select: {
          deck: {
            select: {
              name: true,
              subjectGroup: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CardSelect;

const reviewLogSignalSelect = {
  rating: true,
  card: {
    select: {
      wrongQuestion: {
        select: {
          subject: true,
          knowledgePoints: true,
        },
      },
    },
  },
} satisfies Prisma.ReviewLogSelect;

@Injectable()
export class ReviewAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviewTasksService: ReviewTasksService,
    private readonly reviewPreferencesService: ReviewPreferencesService,
  ) {}

  async getSuggestions(
    userId: string,
    input: ReviewAgentSuggestionQuery,
  ): Promise<ReviewAgentSuggestionResponse> {
    const now = new Date();
    const [plan, preference, reviewInput] = await Promise.all([
      this.reviewTasksService.getPlan(userId, input),
      this.reviewPreferencesService.getByUserId(userId),
      this.buildReviewInput(userId, input, now),
    ]);
    const review = analyzeReview(reviewInput);
    const planner = planStudy({ review, plan, preference });

    return {
      generatedAt: now.toISOString(),
      review,
      planner,
      planSummary: plan.summary,
    };
  }

  private async buildReviewInput(
    userId: string,
    input: ReviewAgentSuggestionQuery,
    now: Date,
  ): Promise<ReviewAgentInput> {
    const recentSince = new Date(
      now.getTime() - RECENT_REVIEW_DAYS * 24 * 60 * 60 * 1000,
    );
    const [cards, recentLogs] = await Promise.all([
      this.prisma.card.findMany({
        where: { userId, suspendedAt: null },
        select: cardSignalSelect,
        orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.reviewLog.findMany({
        where: {
          reviewedAt: { gte: recentSince },
          card: { userId },
        },
        select: reviewLogSignalSelect,
        orderBy: { reviewedAt: 'desc' },
        take: 200,
      }),
    ]);

    return {
      now: now.toISOString(),
      weakKnowledgePoints: this.buildWeakKnowledgePoints(cards, recentLogs),
      cardSummary: this.buildCardSummary(cards, input, now),
      recentReviewSummary: this.buildRecentReviewSummary(recentLogs),
    };
  }

  private buildWeakKnowledgePoints(
    cards: readonly CardSignal[],
    recentLogs: readonly ReviewLogSignal[],
  ): ReviewAgentWeakPointInput[] {
    const aggregates = new Map<string, WeakPointAggregate>();

    for (const card of cards) {
      const wrongQuestion = card.wrongQuestion;
      if (!wrongQuestion) continue;

      for (const label of this.normalizeKnowledgeLabels(
        wrongQuestion.knowledgePoints,
      )) {
        const aggregate = this.getWeakPointAggregate(aggregates, label);
        aggregate.wrongCount += 1;
        aggregate.difficultyTotal += card.difficulty;
        aggregate.stabilityTotal += card.stability;
        aggregate.cardCount += 1;
        aggregate.subject ??=
          card.wrongQuestion?.deckItems[0]?.deck.subjectGroup.displayName ??
          wrongQuestion.subject;
        aggregate.deckName ??= card.wrongQuestion?.deckItems[0]?.deck.name;
      }
    }

    for (const log of recentLogs) {
      if (log.rating !== 1) continue;

      const wrongQuestion = log.card.wrongQuestion;
      if (!wrongQuestion) continue;

      for (const label of this.normalizeKnowledgeLabels(
        wrongQuestion.knowledgePoints,
      )) {
        const aggregate = this.getWeakPointAggregate(aggregates, label);
        aggregate.recentAgainCount += 1;
        aggregate.subject ??= wrongQuestion.subject;
      }
    }

    return Array.from(aggregates.values())
      .map((aggregate) => ({
        label: aggregate.label,
        subject: aggregate.subject,
        deckName: aggregate.deckName,
        wrongCount: aggregate.wrongCount,
        recentAgainCount: aggregate.recentAgainCount,
        averageDifficulty: this.roundToOne(
          aggregate.cardCount > 0
            ? aggregate.difficultyTotal / aggregate.cardCount
            : 0,
        ),
        averageStability: this.roundToOne(
          aggregate.cardCount > 0
            ? aggregate.stabilityTotal / aggregate.cardCount
            : 0,
        ),
      }))
      .sort(
        (left, right) =>
          right.recentAgainCount - left.recentAgainCount ||
          right.wrongCount - left.wrongCount ||
          right.averageDifficulty - left.averageDifficulty ||
          left.label.localeCompare(right.label, 'zh-Hans-CN'),
      );
  }

  private buildCardSummary(
    cards: readonly CardSignal[],
    input: ReviewAgentSuggestionQuery,
    now: Date,
  ): ReviewAgentInput['cardSummary'] {
    const todayStart = this.resolveLocalTodayStartUtc(
      now,
      input.timezoneOffsetMinutes,
    );

    return {
      dueCount: cards.filter((card) => card.nextReview <= now).length,
      overdueCount: cards.filter((card) => card.nextReview < todayStart).length,
      highDifficultyCount: cards.filter((card) => card.difficulty >= 7).length,
      lowStabilityCount: cards.filter(
        (card) => card.stability > 0 && card.stability < 1.5,
      ).length,
    };
  }

  private buildRecentReviewSummary(
    recentLogs: readonly ReviewLogSignal[],
  ): ReviewAgentInput['recentReviewSummary'] {
    return {
      totalReviews: recentLogs.length,
      againCount: recentLogs.filter((log) => log.rating === 1).length,
      hardCount: recentLogs.filter((log) => log.rating === 2).length,
      goodCount: recentLogs.filter((log) => log.rating === 3).length,
      easyCount: recentLogs.filter((log) => log.rating === 4).length,
    };
  }

  private getWeakPointAggregate(
    aggregates: Map<string, WeakPointAggregate>,
    label: string,
  ) {
    const existing = aggregates.get(label);
    if (existing) return existing;

    const aggregate: WeakPointAggregate = {
      label,
      wrongCount: 0,
      recentAgainCount: 0,
      difficultyTotal: 0,
      stabilityTotal: 0,
      cardCount: 0,
    };
    aggregates.set(label, aggregate);
    return aggregate;
  }

  private normalizeKnowledgeLabels(labels: readonly string[]) {
    return [
      ...new Set(
        labels
          .map((label) => label.trim())
          .filter((label): label is string => label.length > 0),
      ),
    ];
  }

  private resolveLocalTodayStartUtc(
    now: Date,
    timezoneOffsetMinutes: number,
  ) {
    const offsetMs = timezoneOffsetMinutes * 60 * 1000;
    const dateKey = new Date(now.getTime() - offsetMs)
      .toISOString()
      .slice(0, 10);

    return new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + offsetMs);
  }

  private roundToOne(value: number) {
    return Math.round(value * 10) / 10;
  }
}

type CardSignal = Prisma.CardGetPayload<{
  select: typeof cardSignalSelect;
}>;

type ReviewLogSignal = Prisma.ReviewLogGetPayload<{
  select: typeof reviewLogSignalSelect;
}>;

type WeakPointAggregate = {
  label: string;
  subject?: string;
  deckName?: string;
  wrongCount: number;
  recentAgainCount: number;
  difficultyTotal: number;
  stabilityTotal: number;
  cardCount: number;
};
