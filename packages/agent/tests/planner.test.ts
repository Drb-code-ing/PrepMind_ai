import { describe, expect, it } from 'bun:test';

import { planStudy } from '../src/nodes/planner';
import { planStudy as rootPlanStudy, plannerNode } from '../src/index';

import type {
  PlannerAgentInput,
  ReviewAgentPriority,
  ReviewAgentResult,
} from '@repo/types/api/review-agent';
import type {
  ReviewTaskPlanCapacityStatus,
  ReviewTaskPlanIntensity,
  ReviewTaskPlanResponse,
} from '@repo/types/api/review-task';

describe('planStudy', () => {
  it('prioritizes overdue high-risk review work when capacity is over', () => {
    const result = planStudy(
      createPlannerInput({
        reviewPriority: 'high',
        overdueCount: 5,
        todayDueCount: 12,
        upcomingDueCount: 18,
        capacityStatus: 'over',
        intensity: 'heavy',
        dailyMinutes: 25,
        peakDay: { date: '2026-06-24', count: 16 },
      }),
    );

    const totalMinutes = result.suggestedBlocks.reduce(
      (sum, block) => sum + block.minutes,
      0,
    );

    expect(result.headline).toContain('逾期');
    expect(result.capacityNotice).toBeDefined();
    expect(result.suggestedBlocks[0]?.targetHref).toBe('/today');
    expect(totalMinutes).toBeLessThanOrEqual(25);
    expect(result.signals).toContain('capacityOver');
  });

  it('uses a light wrong-question organization plan when there is no due pressure', () => {
    const result = planStudy(
      createPlannerInput({
        reviewPriority: 'low',
        overdueCount: 0,
        todayDueCount: 0,
        upcomingDueCount: 0,
        capacityStatus: 'under',
        intensity: 'light',
        dailyMinutes: 30,
        peakDay: null,
      }),
    );

    expect(result.capacityNotice).toBeUndefined();
    expect(result.suggestedBlocks[0]?.targetHref).toBe('/error-book');
    expect(result.signals).toContain('lightPlan');
  });

  it('describes future capacity pressure without saying there are zero due cards today', () => {
    const result = planStudy(
      createPlannerInput({
        reviewPriority: 'medium',
        overdueCount: 0,
        todayDueCount: 0,
        upcomingDueCount: 24,
        capacityStatus: 'over',
        intensity: 'heavy',
        dailyMinutes: 20,
        peakDay: { date: '2026-06-25', count: 18 },
      }),
    );
    const visibleCopy = [
      result.headline,
      result.todayFocus,
      result.suggestedBlocks[0]?.title,
      result.suggestedBlocks[0]?.reason,
    ].join('\n');

    expect(result.suggestedBlocks[0]?.targetHref).toBe('/today');
    expect(visibleCopy).not.toContain('0 张到期');
    expect(visibleCopy).toMatch(/未来|后续|高峰/);
    expect(result.weekStrategy).toContain('2026-06-25');
    expect(result.signals).toContain('capacityOver');
  });

  it('keeps every suggested block positive and within a very small daily budget', () => {
    const result = planStudy(
      createPlannerInput({
        reviewPriority: 'high',
        overdueCount: 0,
        todayDueCount: 3,
        upcomingDueCount: 8,
        capacityStatus: 'over',
        intensity: 'heavy',
        dailyMinutes: 5,
        peakDay: { date: '2026-06-26', count: 8 },
      }),
    );
    const totalMinutes = result.suggestedBlocks.reduce(
      (sum, block) => sum + block.minutes,
      0,
    );

    expect(result.suggestedBlocks.length).toBeGreaterThan(1);
    expect(totalMinutes).toBeLessThanOrEqual(5);
    expect(result.suggestedBlocks.every((block) => block.minutes > 0)).toBe(true);
  });

  it('exports planner policy from the package root', () => {
    expect(rootPlanStudy).toBe(planStudy);
    expect(plannerNode).toBe(planStudy);
  });
});

function createPlannerInput(options: {
  reviewPriority: ReviewAgentPriority;
  overdueCount: number;
  todayDueCount: number;
  upcomingDueCount: number;
  capacityStatus: ReviewTaskPlanCapacityStatus;
  intensity: ReviewTaskPlanIntensity;
  dailyMinutes: number;
  peakDay: ReviewTaskPlanResponse['summary']['peakDay'];
}): PlannerAgentInput {
  const review: ReviewAgentResult = {
    priority: options.reviewPriority,
    summary: '复习分析摘要',
    weakPoints:
      options.reviewPriority === 'low'
        ? []
        : [
            {
              label: '函数单调性',
              reason: '近期 Again 较多',
              priority: 'high',
              confidence: 0.86,
            },
          ],
    actions: [
      {
        title: options.reviewPriority === 'low' ? '整理错题本' : '完成今日复习',
        description: '按当前复习压力选择入口',
        targetHref: options.reviewPriority === 'low' ? '/error-book' : '/today',
      },
    ],
    signals: options.reviewPriority === 'low' ? ['lowPressure'] : ['overdue'],
  };

  return {
    review,
    plan: {
      startDate: '2026-06-22',
      endDate: '2026-06-28',
      generatedThroughDate: '2026-06-28',
      summary: {
        overdueCount: options.overdueCount,
        todayDueCount: options.todayDueCount,
        upcomingDueCount: options.upcomingDueCount,
        estimatedTotalMinutes:
          (options.overdueCount + options.todayDueCount + options.upcomingDueCount) * 3,
        peakDay: options.peakDay,
        intensity: options.intensity,
        capacityStatus: options.capacityStatus,
        dailyMinutes: options.dailyMinutes,
        dailyCardLimit: 40,
      },
      days: [],
      suggestion: {
        title: '计划建议',
        description: '按容量安排复习',
        actionLabel: '查看计划',
        actionHref: '/plan',
      },
    },
    preference: {
      dailyMinutes: options.dailyMinutes,
      dailyCardLimit: 40,
      preferredReviewTime: '20:30',
      reminderEnabled: true,
      reminderLeadMinutes: 15,
      weekendMode: 'same',
      planWindowDays: 7,
      updatedAt: '2026-06-22T08:00:00.000Z',
    },
  };
}
