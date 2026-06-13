export type ScrollMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  threshold: number;
};

export type AutoScrollState = {
  shouldAutoScroll: boolean;
  userScrollIntent: boolean;
};

export type AutoScrollBehavior = 'auto' | 'smooth';

export function getAutoScrollBehavior({
  isGenerating,
  isInitialScroll,
  preferSmoothWhileGenerating,
}: {
  isGenerating: boolean;
  isInitialScroll: boolean;
  preferSmoothWhileGenerating: boolean;
}): AutoScrollBehavior {
  if (isInitialScroll) return 'auto';
  return isGenerating && preferSmoothWhileGenerating ? 'smooth' : 'auto';
}

export function isNearScrollBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
  threshold,
}: ScrollMetrics) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function applyUserIntentToAutoScrollState(): AutoScrollState {
  return {
    shouldAutoScroll: false,
    userScrollIntent: true,
  };
}

export function applyGenerationStartToAutoScrollState(): AutoScrollState {
  return {
    shouldAutoScroll: true,
    userScrollIntent: false,
  };
}

export function applyScrollPositionToAutoScrollState(
  state: AutoScrollState,
  metrics: ScrollMetrics,
): AutoScrollState {
  if (
    isNearScrollBottom({
      scrollHeight: metrics.scrollHeight,
      scrollTop: metrics.scrollTop,
      clientHeight: metrics.clientHeight,
      threshold: metrics.threshold,
    })
  ) {
    return {
      shouldAutoScroll: true,
      userScrollIntent: false,
    };
  }

  if (state.userScrollIntent) {
    return {
      shouldAutoScroll: false,
      userScrollIntent: true,
    };
  }

  return state;
}
