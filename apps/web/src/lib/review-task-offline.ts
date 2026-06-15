import {
  reviewTaskItemSchema,
  type ReviewTaskItemResponse,
} from '@repo/types/api/review-task';

import { ApiClientError } from './api-client.ts';
import type { MutationQueueItem } from './db.ts';
import { createMutationQueueItem } from './mutation-queue.ts';

export type ReviewTaskRatingPayload = {
  taskId: string;
  request: {
    rating: 1 | 2 | 3 | 4;
    reviewedAt: string;
    reviewDurationMs?: number;
    clientMutationId: string;
  };
  taskSnapshot: ReviewTaskItemResponse;
};

type CreateReviewTaskRatingQueueItemInput = {
  userId: string;
  task: ReviewTaskItemResponse;
  request: ReviewTaskRatingPayload['request'];
  now?: Date;
};

export function createReviewTaskRatingQueueItem({
  userId,
  task,
  request,
  now,
}: CreateReviewTaskRatingQueueItemInput): MutationQueueItem {
  return createMutationQueueItem(
    {
      userId,
      entity: 'reviewTask',
      operation: 'rating',
      entityId: task.id,
      dedupeKey: `${userId}:reviewTask:${task.id}:rating`,
      payload: {
        taskId: task.id,
        request,
        taskSnapshot: task,
      } satisfies ReviewTaskRatingPayload,
    },
    now,
  );
}

export function readReviewTaskRatingPayload(payload: unknown): ReviewTaskRatingPayload {
  if (!isRecord(payload) || typeof payload.taskId !== 'string' || !payload.taskId) {
    throw new Error('Invalid review task rating payload');
  }

  const request = payload.request;
  if (!isRecord(request) || !isReviewTaskRatingRequest(request)) {
    throw new Error('Invalid review task rating payload');
  }

  const taskSnapshot = reviewTaskItemSchema.safeParse(payload.taskSnapshot);
  if (!taskSnapshot.success) {
    throw new Error('Invalid review task rating payload');
  }

  return {
    taskId: payload.taskId,
    request,
    taskSnapshot: taskSnapshot.data,
  };
}

export function isRetryableReviewTaskRatingError(error: unknown) {
  if (!(error instanceof ApiClientError)) {
    return true;
  }

  if (error.status === 0 || error.status >= 500) {
    return true;
  }

  return false;
}

function isReviewTaskRatingRequest(
  request: Record<string, unknown>,
): request is ReviewTaskRatingPayload['request'] {
  if (![1, 2, 3, 4].includes(request.rating as number)) {
    return false;
  }

  if (typeof request.reviewedAt !== 'string' || Number.isNaN(Date.parse(request.reviewedAt))) {
    return false;
  }

  if (typeof request.clientMutationId !== 'string' || !request.clientMutationId) {
    return false;
  }

  return (
    request.reviewDurationMs === undefined ||
    (typeof request.reviewDurationMs === 'number' &&
      Number.isInteger(request.reviewDurationMs) &&
      request.reviewDurationMs >= 0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
