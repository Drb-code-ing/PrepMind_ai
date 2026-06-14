import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';

type MinimalTask = Pick<ReviewTaskItemResponse, 'status'> & { id: string };

export function groupReviewTasksByStatus<T extends MinimalTask>(tasks: T[]) {
  return {
    pending: tasks.filter((task) => task.status === 'PENDING'),
    completed: tasks.filter((task) => task.status === 'COMPLETED'),
    skipped: tasks.filter((task) => task.status === 'SKIPPED'),
  };
}

export function getReviewTaskStatusFeedback(action: 'skip' | 'reopen') {
  if (action === 'skip') {
    return {
      message: '已跳过这张复习卡',
      tone: 'neutral' as const,
    };
  }

  return {
    message: '已恢复到待复习',
    tone: 'success' as const,
  };
}
