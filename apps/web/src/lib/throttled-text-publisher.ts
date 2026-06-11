type TimerId = unknown;

type ThrottledTextPublisherOptions = {
  waitMs: number;
  publish: (value: string) => void;
  setTimer?: (callback: () => void, waitMs: number) => TimerId;
  clearTimer?: (timerId: TimerId) => void;
};

const defaultClearTimer = (timerId: TimerId) => {
  clearTimeout(timerId as ReturnType<typeof setTimeout>);
};

export function createThrottledTextPublisher({
  waitMs,
  publish,
  setTimer = setTimeout,
  clearTimer = defaultClearTimer,
}: ThrottledTextPublisherOptions) {
  let latest = '';
  let hasValue = false;
  let timerId: TimerId | null = null;

  const clearPendingTimer = () => {
    if (timerId === null) return;
    clearTimer(timerId);
    timerId = null;
  };

  const publishLatest = () => {
    if (!hasValue) return;
    publish(latest);
  };

  return {
    push(value: string) {
      latest = value;
      hasValue = true;

      if (timerId !== null) return;

      timerId = setTimer(() => {
        timerId = null;
        publishLatest();
      }, waitMs);
    },

    flush() {
      clearPendingTimer();
      publishLatest();
    },

    cancel() {
      clearPendingTimer();
    },
  };
}
