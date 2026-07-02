import { InProcessEventBus } from './event-bus';

describe('InProcessEventBus', () => {
  it('publishes typed events to subscribers and supports unsubscribe', () => {
    const bus = new InProcessEventBus();
    const received: Array<{ type: string; documentId: string }> = [];

    const unsubscribe = bus.subscribe('knowledge.document.processing.succeeded', (event) => {
      received.push({ type: event.type, documentId: event.documentId });
    });

    bus.publish({
      type: 'knowledge.document.processing.succeeded',
      userId: 'user_1',
      documentId: 'doc_1',
      backgroundJobId: 'job_1',
      chunkCount: 2,
      durationMs: 120,
      finishedAt: '2026-06-29T00:00:00.000Z',
    });
    unsubscribe();
    bus.publish({
      type: 'knowledge.document.processing.succeeded',
      userId: 'user_1',
      documentId: 'doc_2',
      backgroundJobId: 'job_2',
      chunkCount: 1,
      durationMs: 80,
      finishedAt: '2026-06-29T00:00:01.000Z',
    });

    expect(received).toEqual([
      {
        type: 'knowledge.document.processing.succeeded',
        documentId: 'doc_1',
      },
    ]);
  });

  it('continues publishing when one subscriber throws', () => {
    const bus = new InProcessEventBus();
    const received: string[] = [];

    bus.subscribe('knowledge.document.processing.failed', () => {
      throw new Error('subscriber failed');
    });
    bus.subscribe('knowledge.document.processing.failed', (event) => {
      received.push(event.documentId);
    });

    const result = bus.publish({
      type: 'knowledge.document.processing.failed',
      userId: 'user_1',
      documentId: 'doc_1',
      backgroundJobId: 'job_1',
      errorCode: 'PARSE_FAILED',
      retryable: false,
      finishedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(received).toEqual(['doc_1']);
    expect(result).toEqual({ delivered: 1, failed: 1 });
  });
});
