'use client';

import { useCallback, useEffect, useRef } from 'react';

import { flushMutationQueue } from '@/lib/mutation-queue-flush';
import { useUserStore } from '@/stores/userStore';

export function useMutationQueueFlush() {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const currentUserId = currentUser?.id;
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!sessionHydrated || !accessToken || !currentUserId || flushingRef.current) return;

    flushingRef.current = true;
    try {
      await flushMutationQueue({
        userId: currentUserId,
        accessToken,
      });
    } catch (error) {
      console.warn(
        `[MutationQueue flush]: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      flushingRef.current = false;
    }
  }, [accessToken, currentUserId, sessionHydrated]);

  useEffect(() => {
    void flush();
  }, [flush]);

  useEffect(() => {
    const onOnline = () => void flush();
    const onFocus = () => void flush();

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [flush]);

  return { flush };
}
