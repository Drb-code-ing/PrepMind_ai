import assert from 'node:assert/strict';
import { test } from 'node:test';

import type {
  ReviewTaskPlanDayResponse,
  ReviewTaskPlanResponse,
} from '@repo/types/api/review-task';

import {
  buildPlanBarOption,
  getPlanCapacityStatusLabel,
  getPlanIntensityClassName,
  getPlanIntensityLabel,
  getPlanReasonChips,
  getPlanWindowLabel,
  shouldShowPlanEmptyState,
} from './review-plan-view.ts';

test('maps plan intensity labels and badge classes', () => {
  assert.equal(getPlanIntensityLabel('light'), '轻松');
  assert.equal(getPlanIntensityLabel('normal'), '正常');
  assert.equal(getPlanIntensityLabel('heavy'), '偏重');

  const lightClassName = getPlanIntensityClassName('light');
  const normalClassName = getPlanIntensityClassName('normal');
  const heavyClassName = getPlanIntensityClassName('heavy');

  assert.ok(lightClassName.includes('bg-'));
  assert.ok(lightClassName.includes('text-'));
  assert.ok(lightClassName.includes('ring-'));
  assert.notEqual(lightClassName, normalClassName);
  assert.notEqual(normalClassName, heavyClassName);
});

test('detects plan empty state only when all counts are zero', () => {
  assert.equal(shouldShowPlanEmptyState(createPlanResponse()), true);
  assert.equal(
    shouldShowPlanEmptyState(
      createPlanResponse({
        summary: {
          overdueCount: 0,
          todayDueCount: 1,
          upcomingDueCount: 0,
          estimatedTotalMinutes: 6,
          peakDay: { date: '2026-06-16', count: 1 },
          intensity: 'light',
          capacityStatus: 'under',
          dailyMinutes: 30,
          dailyCardLimit: 30,
        },
      }),
    ),
    false,
  );
  assert.equal(
    shouldShowPlanEmptyState(
      createPlanResponse({
        days: [createPlanDay({ dueCount: 0, overdueCount: 1 })],
      }),
    ),
    false,
  );
});

test('builds plan bar option with labels, totals, colors, and tooltip content', () => {
  const option = buildPlanBarOption([
    createPlanDay({
      label: '今天',
      dueCount: 2,
      overdueCount: 1,
      intensity: 'normal',
      pressureScore: 42,
      capacityStatus: 'near',
      estimatedMinutes: 18,
    }),
    createPlanDay({
      label: '明天',
      dueCount: 0,
      overdueCount: 4,
      intensity: 'heavy',
      pressureScore: 88,
      capacityStatus: 'over',
      estimatedMinutes: 34,
    }),
  ]);

  assert.deepEqual(option.xAxis.data, ['今天', '明天']);
  assert.deepEqual(
    option.series[0].data.map((item) => item.value),
    [42, 88],
  );
  assert.notEqual(
    option.series[0].data[0].itemStyle.color,
    option.series[0].data[1].itemStyle.color,
  );
  assert.equal(typeof option.tooltip.formatter, 'function');

  const tooltipText = option.tooltip.formatter({ dataIndex: 0 });
  assert.equal(option.series[0].name, '复习压力');
  assert.equal(
    tooltipText,
    [
      '今天 · 正常',
      '压力分 42',
      '容量 接近上限',
      '应复习 2',
      '逾期 1',
      '待完成 0',
      '已完成 0',
      '已跳过 0',
      '预计 18 分钟',
    ].join('<br/>'),
  );
});

test('maps capacity labels and filters reason chips', () => {
  assert.equal(getPlanCapacityStatusLabel('under'), '容量充足');
  assert.equal(getPlanCapacityStatusLabel('near'), '接近上限');
  assert.equal(getPlanCapacityStatusLabel('over'), '超过容量');

  assert.deepEqual(getPlanReasonChips([' 逾期积压 ', '', '  ', '卡片过多']), [
    '逾期积压',
    '卡片过多',
  ]);
});

test('builds dynamic plan window labels', () => {
  assert.equal(getPlanWindowLabel(7), '未来 7 天');
  assert.equal(getPlanWindowLabel(14), '未来 14 天');
});

test('builds a stable empty chart option for no days', () => {
  const option = buildPlanBarOption([]);

  assert.deepEqual(option.xAxis.data, []);
  assert.deepEqual(option.series[0].data, []);
});

function createPlanResponse(input: Partial<ReviewTaskPlanResponse> = {}): ReviewTaskPlanResponse {
  return {
    startDate: '2026-06-16',
    endDate: '2026-06-22',
    generatedThroughDate: '2026-06-16',
    summary: {
      overdueCount: 0,
      todayDueCount: 0,
      upcomingDueCount: 0,
      estimatedTotalMinutes: 0,
      peakDay: null,
      intensity: 'light',
      capacityStatus: 'under',
      dailyMinutes: 30,
      dailyCardLimit: 30,
    },
    days: [createPlanDay()],
    suggestion: {
      title: '暂无复习压力',
      description: '未来计划很轻松。',
      actionLabel: '返回今日任务',
      actionHref: '/today',
    },
    ...input,
  };
}

function createPlanDay(input: Partial<ReviewTaskPlanDayResponse> = {}): ReviewTaskPlanDayResponse {
  return {
    date: '2026-06-16',
    label: '今天',
    dueCount: 0,
    overdueCount: 0,
    pendingCount: 0,
    completedCount: 0,
    skippedCount: 0,
    estimatedMinutes: 0,
    intensity: 'light',
    pressureScore: 0,
    capacityStatus: 'under',
    reasons: [],
    ...input,
  };
}
