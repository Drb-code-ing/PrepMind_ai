'use client';

import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import type { ReviewRating } from '@repo/types/api/review';

import { db } from '@/lib/db';
import { readReviewTaskRatingPayload } from '@/lib/review-task-offline';

export type ReviewTaskPendingRating = {
  rating: ReviewRating;
  reviewedAt: string;
  clientMutationId: string;
};

type PendingRatingsState = {
  pendingByTaskId: Record<string, ReviewTaskPendingRating>;
  pendingCount: number;
};

type PendingRatingsSnapshot = PendingRatingsState & {
  ownerId: string;
};

const emptyPendingRatings: PendingRatingsState = {
  pendingByTaskId: {},
  pendingCount: 0,
};

export function useReviewTaskPendingRatings(userId: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<PendingRatingsSnapshot | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const subscription = liveQuery(async () => {
      const items = await db.mutationQueue
        .where('[userId+entity+operation]')
        .equals([userId, 'reviewTask', 'rating'])
        .toArray();
      const pendingByTaskId: Record<string, ReviewTaskPendingRating> = {};

      for (const item of items) {
        try {
          const payload = readReviewTaskRatingPayload(item.payload);
          pendingByTaskId[payload.taskId] = {
            rating: payload.request.rating,
            reviewedAt: payload.request.reviewedAt,
            clientMutationId: payload.request.clientMutationId,
          };
        } catch (error) {
          console.warn(
            `[ReviewTask pending ratings]: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        }
      }

      return {
        ownerId: userId,
        pendingByTaskId,
        pendingCount: Object.keys(pendingByTaskId).length,
      };
    }).subscribe({
      next: setSnapshot,
      error: (error) => {
        console.warn(
          `[ReviewTask pending ratings]: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        setSnapshot(null);
      },
    });

    return () => subscription.unsubscribe();
  }, [userId]);

  if (!userId || snapshot?.ownerId !== userId) {
    return emptyPendingRatings;
  }

  return {
    pendingByTaskId: snapshot.pendingByTaskId,
    pendingCount: snapshot.pendingCount,
  };
}
