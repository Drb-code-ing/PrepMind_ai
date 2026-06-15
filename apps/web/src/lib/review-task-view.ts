import type { ReviewRating } from '@repo/types/api/review';
import type { ReviewTaskItemResponse } from '@repo/types/api/review-task';

type MinimalTask = Pick<ReviewTaskItemResponse, 'status'> & { id: string };

export type PendingReviewTaskRating = { rating: ReviewRating };
export type LocalPendingRatingFields = {
  localStatus: 'LOCAL_RATING_PENDING';
  pendingRatingLabel: string;
};

const reviewRatingLabels: Record<ReviewRating, string> = {
  1: '忘了',
  2: '吃力',
  3: '掌握',
  4: '轻松',
};

export function groupReviewTasksByStatus<T extends MinimalTask>(tasks: T[]) {
  return {
    pending: tasks.filter((task) => task.status === 'PENDING'),
    completed: tasks.filter((task) => task.status === 'COMPLETED'),
    skipped: tasks.filter((task) => task.status === 'SKIPPED'),
  };
}

export function getReviewRatingLabel(rating: ReviewRating) {
  return reviewRatingLabels[rating];
}

export function mergeLocalPendingRatings<T extends MinimalTask>(
  tasks: T[],
  pendingByTaskId: Record<string, PendingReviewTaskRating | undefined>,
): Array<T & Partial<LocalPendingRatingFields>> {
  return tasks.map((task) => {
    const pending = pendingByTaskId[task.id];
    if (task.status !== 'PENDING' || !pending) {
      return task;
    }

    return {
      ...task,
      localStatus: 'LOCAL_RATING_PENDING',
      pendingRatingLabel: getReviewRatingLabel(pending.rating),
    };
  });
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
