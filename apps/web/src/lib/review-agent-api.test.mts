import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

import { createApiClient } from './api-client.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_MODULE_NOT_FOUND' &&
        specifier.startsWith('.')
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { createReviewAgentApi } = await import('./review-agent-api.ts');

const requests: CapturedRequest[] = [];
const reviewAgentApi = createReviewAgentApi(createTestClient(requests, createSuggestionPayload()));

const result = await reviewAgentApi.getSuggestions('token_1', {
  days: 7,
  startDate: '2026-06-22',
  timezoneOffsetMinutes: -480,
});

assert.equal(
  requests[0].input,
  'http://localhost:3001/review-agent/suggestions?days=7&startDate=2026-06-22&timezoneOffsetMinutes=-480',
);
assert.equal(requests[0].method, 'GET');
assert.equal(requests[0].authorization, 'Bearer token_1');
assert.equal(result.review.priority, 'high');
assert.equal(result.planner.headline, '先稳住逾期复习');
assert.equal(result.planSummary.capacityStatus, 'over');

function createTestClient(requests: CapturedRequest[], data: unknown) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
      });

      return new Response(
        JSON.stringify({
          success: true,
          data,
          requestId: 'req_1',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });
}

function createSuggestionPayload() {
  return {
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
      headline: '先稳住逾期复习',
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
  };
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
};
