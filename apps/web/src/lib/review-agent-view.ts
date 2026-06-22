import type {
  PlannerAgentResult,
  ReviewAgentPriority,
} from '@repo/types/api/review-agent';

const priorityMeta: Record<
  ReviewAgentPriority,
  {
    label: string;
    className: string;
  }
> = {
  low: {
    label: '低优先级',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  medium: {
    label: '中优先级',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  high: {
    label: '高优先级',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

export function getReviewAgentPriorityMeta(priority: ReviewAgentPriority) {
  return priorityMeta[priority];
}

export function getReviewAgentShortTodayText(planner: PlannerAgentResult) {
  return planner.todayFocus.trim() || planner.headline;
}
