import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindResponseBodyCancellationV1,
  createRequestAbortScopeV1,
} from './response-abort-bridge.ts';

test('response body cancellation aborts the request scope before cancelling the source', async () => {
  const parent = new AbortController();
  const scope = createRequestAbortScopeV1(parent.signal);
  let sourceSawAbort = false;
  const source = new ReadableStream<Uint8Array>({
    pull() {
      return new Promise(() => undefined);
    },
    cancel() {
      sourceSawAbort = scope.signal.aborted;
    },
  });
  const response = bindResponseBodyCancellationV1(new Response(source), scope);

  await response.body?.cancel('browser_cancelled');

  assert.equal(scope.signal.aborted, true);
  assert.equal(scope.signal.reason, 'browser_cancelled');
  assert.equal(sourceSawAbort, true);
});

test('parent abort is forwarded and cancels the source reader', async () => {
  const parent = new AbortController();
  const scope = createRequestAbortScopeV1(parent.signal);
  let sourceCancelled = false;
  const response = bindResponseBodyCancellationV1(
    new Response(
      new ReadableStream<Uint8Array>({
        pull() {
          return new Promise(() => undefined);
        },
        cancel() {
          sourceCancelled = true;
        },
      }),
      { headers: { 'x-test': 'kept' } },
    ),
    scope,
  );
  parent.abort('request_disconnected');
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(scope.signal.aborted, true);
  assert.equal(sourceCancelled, true);
  assert.equal(response.headers.get('x-test'), 'kept');
});

test('a normally consumed response preserves bytes and headers', async () => {
  const scope = createRequestAbortScopeV1(new AbortController().signal);
  const response = bindResponseBodyCancellationV1(
    new Response(new TextEncoder().encode('ok'), { headers: { 'x-test': 'kept' } }),
    scope,
  );

  assert.equal(await response.text(), 'ok');
  assert.equal(response.headers.get('x-test'), 'kept');
  assert.equal(scope.signal.aborted, false);
});
