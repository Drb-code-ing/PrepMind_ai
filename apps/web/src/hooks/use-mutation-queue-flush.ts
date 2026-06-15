'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { flushMutationQueue } from '@/lib/mutation-queue-flush';
import { useUserStore } from '@/stores/userStore';
import { reviewTaskQueryKeys } from './use-review-tasks';
import { reviewQueryKeys } from './use-reviews';

export function useMutationQueueFlush(options: { auto?: boolean } = {}) {
  const auto = options.auto ?? true;
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const currentUserId = currentUser?.id;
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!sessionHydrated || !accessToken || !currentUserId || flushingRef.current) return;

    flushingRef.current = true;
    try {
      const summary = await flushMutationQueue({
        userId: currentUserId,
        accessToken,
      });
      if (summary.reviewRatingSuccessCount > 0) {
        void queryClient.invalidateQueries({ queryKey: reviewTaskQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all });
      }
      return summary;
    } catch (error) {
      console.warn(
        `[MutationQueue flush]: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      flushingRef.current = false;
    }
  }, [accessToken, currentUserId, queryClient, sessionHydrated]);

  useEffect(() => {
    if (!auto) return;

    void flush();
  }, [auto, flush]);

  useEffect(() => {
    if (!auto) return;

    const onOnline = () => void flush();
    const onFocus = () => void flush();

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [auto, flush]);

  return { flush };
}
