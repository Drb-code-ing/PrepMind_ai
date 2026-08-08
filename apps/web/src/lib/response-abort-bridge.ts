export type RequestAbortScopeV1 = Readonly<{
  signal: AbortSignal;
  abort: (reason?: unknown) => void;
  dispose: () => void;
}>;

export function createRequestAbortScopeV1(parentSignal: AbortSignal): RequestAbortScopeV1 {
  const controller = new AbortController();
  let disposed = false;
  const onParentAbort = () => controller.abort(parentSignal.reason);
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  if (parentSignal.aborted) onParentAbort();

  return Object.freeze({
    signal: controller.signal,
    abort: (reason?: unknown) => {
      if (!controller.signal.aborted) controller.abort(reason);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      parentSignal.removeEventListener('abort', onParentAbort);
    },
  });
}

export function bindResponseBodyCancellationV1(
  response: Response,
  scope: RequestAbortScopeV1,
): Response {
  if (response.body === null) {
    scope.dispose();
    return response;
  }

  const reader = response.body.getReader();
  let settled = false;
  let cancelPromise: Promise<void> | null = null;
  let onScopeAbort: (() => void) | null = null;
  const settle = () => {
    if (settled) return;
    settled = true;
    if (onScopeAbort !== null) {
      scope.signal.removeEventListener('abort', onScopeAbort);
    }
    scope.dispose();
  };
  const cancelReader = (reason?: unknown) => {
    if (cancelPromise !== null) return cancelPromise;
    cancelPromise = reader.cancel(reason).finally(settle);
    return cancelPromise;
  };
  onScopeAbort = () => {
    void cancelReader(scope.signal.reason).catch(() => undefined);
  };
  scope.signal.addEventListener('abort', onScopeAbort, { once: true });
  if (scope.signal.aborted) onScopeAbort();

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          settle();
          controller.close();
          return;
        }
        controller.enqueue(next.value);
      } catch (error) {
        settle();
        controller.error(error);
      }
    },
    async cancel(reason) {
      scope.abort(reason);
      try {
        await cancelReader(reason);
      } finally {
        settle();
      }
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
