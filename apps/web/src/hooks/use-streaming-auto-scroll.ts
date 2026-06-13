'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

import {
  applyGenerationStartToAutoScrollState,
  applyScrollPositionToAutoScrollState,
  applyUserIntentToAutoScrollState,
  getAutoScrollBehavior,
  type AutoScrollBehavior,
} from '@/lib/streaming-scroll';

type UseStreamingAutoScrollOptions = {
  contentKey: string;
  enabled: boolean;
  isGenerating?: boolean;
  preferSmoothWhileGenerating?: boolean;
  threshold?: number;
};

export function useStreamingAutoScroll<T extends HTMLElement>({
  contentKey,
  enabled,
  isGenerating = false,
  preferSmoothWhileGenerating = true,
  threshold = 24,
}: UseStreamingAutoScrollOptions) {
  const scrollRef = useRef<T>(null);
  const shouldAutoScrollRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const hasInitializedScrollRef = useRef(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<number>(0);

  const scrollToBottom = useCallback((options: {
    force?: boolean;
    behavior?: AutoScrollBehavior;
  } = {}) => {
    if (options.force) {
      const next = applyGenerationStartToAutoScrollState();
      shouldAutoScrollRef.current = next.shouldAutoScroll;
      userScrollIntentRef.current = next.userScrollIntent;
    }

    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(timeoutRef.current);

    const isInitialScrollCycle = !hasInitializedScrollRef.current;
    const run = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior:
          options.behavior ??
          getAutoScrollBehavior({
            isGenerating,
            isInitialScroll: isInitialScrollCycle,
            preferSmoothWhileGenerating,
          }),
      });
    };

    if (isInitialScrollCycle) {
      run();
    }
    hasInitializedScrollRef.current = true;

    rafRef.current = requestAnimationFrame(() => {
      run();
      timeoutRef.current = window.setTimeout(run, 80);
    });
  }, [isGenerating, preferSmoothWhileGenerating]);

  const handleUserScrollIntent = useCallback(() => {
    const next = applyUserIntentToAutoScrollState();
    shouldAutoScrollRef.current = next.shouldAutoScroll;
    userScrollIntentRef.current = next.userScrollIntent;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const next = applyScrollPositionToAutoScrollState(
      {
        shouldAutoScroll: shouldAutoScrollRef.current,
        userScrollIntent: userScrollIntentRef.current,
      },
      {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
        threshold,
      },
    );
    shouldAutoScrollRef.current = next.shouldAutoScroll;
    userScrollIntentRef.current = next.userScrollIntent;
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
