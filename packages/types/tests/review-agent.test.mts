import assert from 'node:assert/strict';

import {
  reviewAgentPrioritySchema,
  reviewAgentSuggestionQuerySchema,
  reviewAgentSuggestionResponseSchema,
} from '../src/api/review-agent.ts';

testQueryDefaults();
testInvalidDaysRejected();
testValidSuggestionResponse();

function testQueryDefaults() {
  const parsed = reviewAgentSuggestionQuerySchema.parse({});

  assert.equal(parsed.days, 7);
  assert.equal(parsed.timezoneOffsetMinutes, 0);
  assert.equal(parsed.startDate, undefined);
}

function testInvalidDaysRejected() {
  assert.throws(() => reviewAgentSuggestionQuerySchema.parse({ days: 15 }));
  assert.throws(() =>
    reviewAgentSuggestionQuerySchema.parse({ startDate: '2026-02-30' }),
  );
}

function testValidSuggestionResponse() {
  assert.equal(reviewAgentPrioritySchema.parse('high'), 'high');

  const parsed = reviewAgentSuggestionResponseSchema.parse({
    generatedAt: '2026-06-22T00:00:00.000Z',
    review: {
      priority: 'high',
      summary: '逾期和低稳定度卡片较多，今天先清理高风险专题。',
      weakPoints: [
        {
          label: '格林公式',
          reason: '最近 Again 次数较高，且平均稳定度偏低。',
          priority: 'high',
          confidence: 0.88,
        },
      ],
      actions: [
        {
          title: '复盘格林公式专题',
          description: '先看错题，再完成到期复习卡。',
          targetHref: '/error-book',
        },
      ],
      signals: ['overdue', 'recentAgain', 'lowStability'],
    },
    planner: {
      headline: '今天先稳住逾期复习',
      todayFocus: '优先处理逾期卡片，再复盘格林公式。',
      weekStrategy: '未来几天保持每日 20 分钟复习。',
      capacityNotice: '预计超过当前每日容量，建议缩小今日目标。',
      suggestedBlocks: [
        {
          title: '清理逾期复习',
          minutes: 20,
          reason: '逾期卡片会拉高遗忘风险。',
          targetHref: '/today',
        },
      ],
      signals: ['capacityOver'],
    },
    planSummary: {
      overdueCount: 5,
      todayDueCount: 3,
      upcomingDueCount: 8,
      estimatedTotalMinutes: 42,
      peakDay: {
        date: '2026-06-25',
        count: 9,
      },
      intensity: 'heavy',
      capacityStatus: 'over',
      dailyMinutes: 30,
      dailyCardLimit: 12,
    },
  });

  assert.equal(parsed.review.weakPoints[0]?.label, '格林公式');
  assert.equal(parsed.planner.suggestedBlocks[0]?.targetHref, '/today');
}
