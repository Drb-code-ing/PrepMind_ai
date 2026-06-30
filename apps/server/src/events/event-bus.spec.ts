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
});
