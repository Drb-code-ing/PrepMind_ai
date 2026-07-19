import { createModelAgentRuntime } from '@repo/ai';
import type { ModelAgentRuntime, StructuredModelExecutor } from '@repo/ai';

import { AgentTracesService } from '../agent-traces/agent-traces.service';
import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from '../review-preferences/review-preferences.service';
import { ReviewTasksService } from '../review-tasks/review-tasks.service';
import { ReviewAgentService } from './review-agent.service';
import type { ReviewPlannerProductAcceptanceAdmission } from './review-planner-product-acceptance-admission';
import type { ReviewPlannerModelRuntimeBundle } from './review-planner-model-runtime.factory';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;
const arrayContaining = <T>(value: readonly T[]) =>
  expect.arrayContaining(value) as unknown as T[];

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
  const agentTracesService = {
    createTrace: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    reviewTasksService.getPlan.mockResolvedValue(plan);
    reviewPreferencesService.getByUserId.mockResolvedValue(preference);
    agentTracesService.createTrace.mockResolvedValue(undefined);
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

  function createService(
    runtimes: ReviewPlannerModelRuntimeBundle = disabledRuntimes(),
    admission: ReviewPlannerProductAcceptanceAdmission | null = null,
  ) {
    return new ReviewAgentService(
      prisma as unknown as PrismaService,
      reviewTasksService as unknown as ReviewTasksService,
      reviewPreferencesService as unknown as ReviewPreferencesService,
      runtimes,
      admission,
      agentTracesService as unknown as AgentTracesService,
    );
  }

  it('builds read-only review and planner suggestions from plan, preferences, cards, and logs', async () => {
    const result = await createService().getSuggestions('user_1', query);

    expect(reviewTasksService.getPlan).toHaveBeenCalledWith('user_1', query);
    expect(reviewPreferencesService.getByUserId).toHaveBeenCalledWith('user_1');
    expect(reviewTasksService.getToday).not.toHaveBeenCalled();
    expect(prisma.card.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', suspendedAt: null },
      select: {
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
      },
      orderBy: [{ nextReview: 'asc' }, { createdAt: 'asc' }],
    });
    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith({
      where: {
        reviewedAt: { gte: new Date('2026-06-08T08:30:00.000Z') },
        card: { userId: 'user_1' },
      },
      select: {
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
      },
      orderBy: { reviewedAt: 'desc' },
      take: 200,
    });
    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.review.weakPoints[0]?.label).toBe('格林公式');
    expect(result.planner.suggestedBlocks.length).toBeGreaterThan(0);
    expect(result.planSummary).toEqual(plan.summary);
  });

  it('ignores whitespace-only knowledge points from cards and recent logs', async () => {
    prisma.card.findMany.mockResolvedValueOnce([
      {
        difficulty: 3,
        stability: 5,
        nextReview: new Date('2026-06-29T08:00:00.000Z'),
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: ['   ', '\t'],
          deckItems: [],
        },
      },
    ]);
    prisma.reviewLog.findMany.mockResolvedValueOnce([
      {
        rating: 1,
        reviewedAt: new Date('2026-06-21T10:00:00.000Z'),
        card: {
          wrongQuestion: {
            subject: '数学',
            knowledgePoints: ['  ', '\n'],
          },
        },
      },
    ]);

    const result = await createService().getSuggestions('user_1', query);
    const labels = result.review.weakPoints.map((point) => point.label);

    expect(labels).not.toContain('');
    expect(labels.map((label) => label.trim())).not.toContain('');
  });

  it('keeps low-stability high-risk weak points visible to ReviewAgent beyond the first 20 sorted points', async () => {
    prisma.card.findMany.mockResolvedValueOnce([
      ...Array.from({ length: 20 }, (_, index) => ({
        difficulty: 3,
        stability: 5,
        nextReview: new Date('2026-06-29T08:00:00.000Z'),
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: [`普通知识点${index + 1}`],
          deckItems: [],
        },
      })),
      {
        difficulty: 1,
        stability: 1.2,
        nextReview: new Date('2026-06-29T08:00:00.000Z'),
        wrongQuestion: {
          subject: '数学',
          knowledgePoints: ['低稳定性专题'],
          deckItems: [],
        },
      },
    ]);
    prisma.reviewLog.findMany.mockResolvedValueOnce([]);

    const result = await createService().getSuggestions('user_1', query);

    expect(result.review.priority).toBe('high');
    expect(result.review.signals).toContain('highWeakPoint');
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

  it('keeps all fact reads owner-scoped and applies candidates only for the requested owner', async () => {
    const executor: StructuredModelExecutor = ({ systemPrompt }) =>
      Promise.resolve({
        object: systemPrompt.includes('review focus')
          ? { focusIndexes: [0] }
          : { blockOrder: [0] },
        usage: { inputTokens: 20, outputTokens: 6 },
      });
    const runtime = liveRuntime(executor);

    await createService(enabledRuntimes(runtime)).getSuggestions(
      'user_a',
      query,
    );

    expect(prisma.card.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: { userId: 'user_a', suspendedAt: null },
      }),
    );
    expect(prisma.reviewLog.findMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({ card: { userId: 'user_a' } }),
      }),
    );
    expect(agentTracesService.createTrace).toHaveBeenCalledWith(
      'user_a',
      objectContaining({
        steps: arrayContaining([
          objectContaining({ node: 'deterministic_review' }),
          objectContaining({ node: 'review_candidate' }),
          objectContaining({ node: 'deterministic_planner' }),
          objectContaining({ node: 'planner_candidate' }),
        ]),
      }),
    );
  });

  it('returns deterministic suggestions when an attempted candidate fails strict schema validation', async () => {
    const executor: StructuredModelExecutor = () =>
      Promise.resolve({
        object: { unexpected: 'provider text is never returned' },
        usage: { inputTokens: 20, outputTokens: 6 },
      });

    const result = await createService(
      enabledRuntimes(liveRuntime(executor)),
    ).getSuggestions('user_1', query);

    expect(result.review.weakPoints).not.toHaveLength(0);
    expect(result.modelObservations).toMatchObject({
      review: {
        attempted: true,
        disposition: 'fallback_schema_invalid',
        provenance: 'live_candidate',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /provider text|prompt|api.?key|base.?url/i,
    );
  });

  it('claims the review acceptance capability immediately before its only runtime call', async () => {
    const events: string[] = [];
    const executor: StructuredModelExecutor = () => {
      events.push('runtime:review');
      return Promise.resolve({
        object: { focusIndexes: [0] },
        usage: { inputTokens: 20, outputTokens: 6 },
      });
    };
    const admission = {
      claim: jest.fn((component: 'review' | 'planner') => {
        events.push(`claim:${component}`);
        return component === 'review';
      }),
    } satisfies ReviewPlannerProductAcceptanceAdmission;

    const result = await createService(
      componentRuntimes('review', liveRuntime(executor)),
      admission,
    ).getSuggestions('user_1', query, 'temporary-capability');

    expect(events).toEqual(['claim:review', 'runtime:review']);
    expect(admission.claim).toHaveBeenCalledWith(
      'review',
      'temporary-capability',
    );
    expect(result.modelObservations).toMatchObject({
      review: { attempted: true, disposition: 'candidate_applied' },
      planner: { attempted: false, provenance: 'local_deterministic' },
    });
  });

  it('uses deterministic observations and makes zero runtime calls when a claim fails', async () => {
    const executor = jest.fn<ReturnType<StructuredModelExecutor>, []>();
    const admission = {
      claim: jest.fn(() => false),
    } satisfies ReviewPlannerProductAcceptanceAdmission;

    const result = await createService(
      componentRuntimes('review', liveRuntime(executor)),
      admission,
    ).getSuggestions('user_1', query, 'wrong-capability');

    expect(executor).not.toHaveBeenCalled();
    expect(admission.claim).toHaveBeenCalledTimes(1);
    expect(result.modelObservations).toMatchObject({
      review: { attempted: false, provenance: 'local_deterministic' },
      planner: { attempted: false, provenance: 'local_deterministic' },
    });
  });

  it('isolates planner acceptance from the review candidate', async () => {
    const events: string[] = [];
    const executor: StructuredModelExecutor = () => {
      events.push('runtime:planner');
      return Promise.resolve({
        object: { blockOrder: [0, 1] },
        usage: { inputTokens: 20, outputTokens: 6 },
      });
    };
    const admission = {
      claim: jest.fn((component: 'review' | 'planner') => {
        events.push(`claim:${component}`);
        return component === 'planner';
      }),
    } satisfies ReviewPlannerProductAcceptanceAdmission;

    const result = await createService(
      componentRuntimes('planner', liveRuntime(executor)),
      admission,
    ).getSuggestions('user_1', query, 'temporary-capability');

    expect(events).toEqual(['claim:planner', 'runtime:planner']);
    expect(admission.claim).toHaveBeenCalledWith(
      'planner',
      'temporary-capability',
    );
    expect(result.modelObservations).toMatchObject({
      review: { attempted: false, provenance: 'local_deterministic' },
      planner: { attempted: true, disposition: 'candidate_applied' },
    });
  });

  it('does not block suggestions when trace persistence rejects', async () => {
    agentTracesService.createTrace.mockRejectedValueOnce(
      new Error('trace storage unavailable'),
    );

    const result = await createService().getSuggestions('user_1', query);
    expect(typeof result.review.summary).toBe('string');
    expect(typeof result.planner.headline).toBe('string');
  });
});

function disabledRuntimes(): ReviewPlannerModelRuntimeBundle {
  return {
    config: {
      reviewEnabled: false,
      plannerEnabled: false,
      reviewTimeoutMs: 4500,
      plannerTimeoutMs: 4500,
      mode: 'mock',
      provider: 'mock',
      model: 'disabled-review-planner',
    },
    reviewRuntime: {} as ModelAgentRuntime,
    plannerRuntime: {} as ModelAgentRuntime,
  };
}

function enabledRuntimes(
  runtime: ModelAgentRuntime,
): ReviewPlannerModelRuntimeBundle {
  return {
    config: {
      reviewEnabled: true,
      plannerEnabled: true,
      reviewTimeoutMs: 4500,
      plannerTimeoutMs: 4500,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    },
    reviewRuntime: runtime,
    plannerRuntime: runtime,
  };
}

function componentRuntimes(
  component: 'review' | 'planner',
  runtime: ModelAgentRuntime,
): ReviewPlannerModelRuntimeBundle {
  const enabled = enabledRuntimes(runtime);
  return {
    ...enabled,
    config: {
      ...enabled.config,
      reviewEnabled: component === 'review',
      plannerEnabled: component === 'planner',
    },
  };
}

function liveRuntime(executor: StructuredModelExecutor): ModelAgentRuntime {
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    liveCallsEnabled: true,
    timeoutMs: 4500,
    executor,
  });
}
