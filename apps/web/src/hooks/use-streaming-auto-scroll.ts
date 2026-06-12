'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

import { isNearScrollBottom } from '@/lib/streaming-scroll';

type UseStreamingAutoScrollOptions = {
  contentKey: string;
  enabled: boolean;
  threshold?: number;
};

export function useStreamingAutoScroll<T extends HTMLElement>({
  contentKey,
  enabled,
  threshold = 100,
}: UseStreamingAutoScrollOptions) {
  const scrollRef = useRef<T>(null);
  const shouldAutoScrollRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<number>(0);

  const scrollToBottom = useCallback((options: { force?: boolean } = {}) => {
    if (options.force) {
      shouldAutoScrollRef.current = true;
      userScrollIntentRef.current = false;
    }

    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(timeoutRef.current);

    const run = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    };

    rafRef.current = requestAnimationFrame(() => {
      run();
      timeoutRef.current = window.setTimeout(run, 80);
    });
  }, []);

  const handleUserScrollIntent = useCallback(() => {
    userScrollIntentRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const nearBottom = isNearScrollBottom({
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      threshold,
    });

    if (nearBottom) {
      shouldAutoScrollRef.current = true;
      userScrollIntentRef.current = false;
      return;
    }

    if (userScrollIntentRef.current) {
      shouldAutoScrollRef.current = false;
    }
  }, [threshold]);

  useLayoutEffect(() => {
    if (!enabled || !shouldAutoScrollRef.current) return;
    scrollToBottom();
  }, [contentKey, enabled, scrollToBottom]);

  useLayoutEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return {
    scrollRef,
    handleScroll,
    handleUserScrollIntent,
    scrollToBottom,
  };
}
