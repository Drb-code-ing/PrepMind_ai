import assert from 'node:assert/strict';

import {
  getReviewAgentPriorityMeta,
  getReviewAgentShortTodayText,
} from './review-agent-view.ts';

assert.equal(getReviewAgentPriorityMeta('high').label, '高优先级');
assert.match(getReviewAgentPriorityMeta('low').className, /emerald/);
assert.equal(
  getReviewAgentShortTodayText({
    headline: '使用兜底标题',
    todayFocus: '  优先完成逾期卡片  ',
    weekStrategy: '保持每日复习节奏',
    suggestedBlocks: [],
    signals: [],
  }),
  '优先完成逾期卡片',
);
assert.equal(
  getReviewAgentShortTodayText({
    headline: '使用兜底标题',
    todayFocus: '   ',
    weekStrategy: '保持每日复习节奏',
    suggestedBlocks: [],
    signals: [],
  }),
  '使用兜底标题',
);
