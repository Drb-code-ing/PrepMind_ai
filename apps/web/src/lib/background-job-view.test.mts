import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BackgroundJobSummaryResponse } from '@repo/types/api/background-job';

import { getBackgroundJobSummaryView } from './background-job-view.ts';

describe('getBackgroundJobSummaryView', () => {
  it('prioritizes active background jobs', () => {
    assert.deepEqual(
      getBackgroundJobSummaryView(createSummary({ activeCount: 2, totalRecentCount: 4 })),
      {
        tone: 'info',
        title: '后台处理中',
        description: '还有 2 个后台任务正在排队或处理中，资料状态会自动刷新。',
      },
    );
  });

  it('shows failed jobs when no active work remains', () => {
    assert.deepEqual(
      getBackgroundJobSummaryView(createSummary({ failedCount: 1, totalRecentCount: 3 })),
      {
        tone: 'danger',
        title: '最近有任务失败',
        description: '最近 1 个后台任务失败，可检查资料状态后重试。',
      },
    );
  });

  it('shows stale skipped jobs as a low severity notice', () => {
    assert.deepEqual(
      getBackgroundJobSummaryView(createSummary({ staleSkippedCount: 1, totalRecentCount: 2 })),
      {
        tone: 'muted',
        title: '旧任务已跳过',
        description: '有 1 个旧后台任务被跳过，通常是资料已替换或状态已变化。',
      },
    );
  });

  it('stays quiet when recent jobs are healthy or absent', () => {
    assert.equal(
      getBackgroundJobSummaryView(createSummary({ succeededCount: 3, totalRecentCount: 3 })),
      null,
    );
    assert.equal(getBackgroundJobSummaryView(createSummary()), null);
    assert.equal(getBackgroundJobSummaryView(undefined), null);
  });
});

function createSummary(
  input: Partial<BackgroundJobSummaryResponse> = {},
): BackgroundJobSummaryResponse {
  return {
    activeCount: 0,
    failedCount: 0,
    staleSkippedCount: 0,
    succeededCount: 0,
    totalRecentCount: 0,
    latestJob: null,
    ...input,
  };
}
