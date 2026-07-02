import type { BackgroundJobSummaryResponse } from '@repo/types/api/background-job';

export type BackgroundJobSummaryView = {
  tone: 'info' | 'danger' | 'muted';
  title: string;
  description: string;
};

export function getBackgroundJobSummaryView(
  summary: BackgroundJobSummaryResponse | undefined,
): BackgroundJobSummaryView | null {
  if (!summary || summary.totalRecentCount === 0) {
    return null;
  }

  if (summary.activeCount > 0) {
    return {
      tone: 'info',
      title: '后台处理中',
      description: `还有 ${summary.activeCount} 个后台任务正在排队或处理中，资料状态会自动刷新。`,
    };
  }

  if (summary.failedCount > 0) {
    return {
      tone: 'danger',
      title: '最近有任务失败',
      description: `最近 ${summary.failedCount} 个后台任务失败，可检查资料状态后重试。`,
    };
  }

  if (summary.staleSkippedCount > 0) {
    return {
      tone: 'muted',
      title: '旧任务已跳过',
      description: `有 ${summary.staleSkippedCount} 个旧后台任务被跳过，通常是资料已替换或状态已变化。`,
    };
  }

  return null;
}
