import { reviewRatingRequestSchema } from '@repo/types/api/review';
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

  const request = reviewRatingRequestSchema.safeParse(payload.request);
  if (!request.success || !request.data.clientMutationId || !request.data.reviewedAt) {
    throw new Error('Invalid review task rating payload');
  }

  const taskSnapshot = reviewTaskItemSchema.safeParse(payload.taskSnapshot);
  if (!taskSnapshot.success) {
    throw new Error('Invalid review task rating payload');
  }

  return {
    taskId: payload.taskId,
    request: {
      ...request.data,
      clientMutationId: request.data.clientMutationId,
      reviewedAt: request.data.reviewedAt,
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
