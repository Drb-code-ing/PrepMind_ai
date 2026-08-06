import assert from 'node:assert/strict';
import test from 'node:test';

import type { FinalResponseStreamEventV1 } from '@repo/agent/realtime-chat';

import { createFinalResponseDataStreamAdapterV1 } from './final-response-data-stream-adapter.ts';

test('maps only text, local citations, and failure copy into the AI SDK text channel', async () => {
  const written: string[] = [];
  const adapter = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '---\n\n### 参考资料\n\n1. 资料 1',
    writeText: (text) => written.push(text),
  });

  await adapter.emit(
    event(0, { event: 'response_started', mode: 'mock', modelRef: 'mock-local-v1' }),
  );
  await adapter.emit(event(1, { event: 'text_delta', text: '答案正文' }));
  await adapter.emit(
    event(2, {
      event: 'citations',
      citations: [{ citationId: 'cit_1', sourceLabel: '资料 1' }],
    }),
  );
  await adapter.emit(
    event(3, {
      event: 'response_completed',
      finishReason: 'stop',
      usageRef: {
        modelCallId: 'model_call_1',
        attribution: 'direct',
        attempted: true,
        cached: false,
      },
      traceTerminal: 'completed',
    }),
  );

  assert.deepEqual(written, ['答案正文', '\n\n---\n\n### 参考资料\n\n1. 资料 1']);
  assert.equal(adapter.isTerminal(), true);
});

test('fails closed on out-of-order or post-terminal events', async () => {
  const adapter = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '',
    writeText: () => undefined,
  });
  await assert.rejects(
    adapter.emit(event(1, { event: 'text_delta', text: 'out of order' })),
    /SEQUENCE_INVALID/u,
  );

  const terminalAdapter = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '',
    writeText: () => undefined,
  });
  await terminalAdapter.emit(
    event(0, { event: 'response_started', mode: 'mock', modelRef: 'mock-local-v1' }),
  );
  await terminalAdapter.emit(
    event(1, {
      event: 'response_failed',
      phase: 'before_first_token',
      errorCode: 'provider_unavailable',
      retryable: false,
      userMessage: '回答暂时不可用，可稍后重试。',
      traceTerminal: 'failed_trace_unavailable',
    }),
  );
  await assert.rejects(
    terminalAdapter.emit(event(2, { event: 'text_delta', text: 'late' })),
    /SEQUENCE_INVALID/u,
  );
});

test('requires response_started first and keeps local citation delivery in lockstep', async () => {
  const withoutStart = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '',
    writeText: () => undefined,
  });
  await assert.rejects(
    withoutStart.emit(event(0, { event: 'text_delta', text: 'invalid first event' })),
    /STATE_INVALID/u,
  );

  const missingCitationEvent = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '### 参考资料\n\n1. 资料 1',
    writeText: () => undefined,
  });
  await missingCitationEvent.emit(
    event(0, { event: 'response_started', mode: 'mock', modelRef: 'mock-local-v1' }),
  );
  await assert.rejects(
    missingCitationEvent.emit(
      event(1, {
        event: 'response_completed',
        finishReason: 'stop',
        usageRef: {
          modelCallId: 'model_call_1',
          attribution: 'direct',
          attempted: true,
          cached: false,
        },
        traceTerminal: 'completed',
      }),
    ),
    /STATE_INVALID/u,
  );

  const unexpectedCitationEvent = createFinalResponseDataStreamAdapterV1({
    citationMarkdown: '',
    writeText: () => undefined,
  });
  await unexpectedCitationEvent.emit(
    event(0, { event: 'response_started', mode: 'mock', modelRef: 'mock-local-v1' }),
  );
  await assert.rejects(
    unexpectedCitationEvent.emit(
      event(1, {
        event: 'citations',
        citations: [{ citationId: 'cit_1', sourceLabel: '资料 1' }],
      }),
    ),
    /CITATION_INVALID/u,
  );
});

function event(
  sequence: number,
  payload: FinalResponseStreamEventPayload,
): FinalResponseStreamEventV1 {
  return {
    schemaVersion: 'final-response-stream-event-v1',
    runId: 'run_1',
    responseId: 'response_1',
    sequence,
    ...payload,
  } as FinalResponseStreamEventV1;
}

type FinalResponseStreamEventPayload<
  Event extends FinalResponseStreamEventV1 = FinalResponseStreamEventV1,
> = Event extends FinalResponseStreamEventV1
  ? Omit<Event, 'schemaVersion' | 'runId' | 'responseId' | 'sequence'>
  : never;
