export type ScrollMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  threshold: number;
};

export function isNearScrollBottom({
  scrollHeight,
  scrollTop,
  clientHeight,
  threshold,
}: ScrollMetrics) {
  return scrollHeight - scrollTop - clientHeight < threshold;
}
