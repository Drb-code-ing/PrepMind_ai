import {
  OutboxHandlerError,
  handleKnowledgeDocumentProcessingRequested,
  outboxHandlers,
  type OutboxEventLike,
} from './outbox.handlers';

describe('outbox handlers', () => {
  it('registers the knowledge requested handler explicitly', () => {
    expect(outboxHandlers['knowledge.document.processing.requested']).toBe(
      handleKnowledgeDocumentProcessingRequested,
    );
  });

  it('accepts a safe knowledge requested payload', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            backgroundJobId: 'job_1',
            force: false,
          },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a knowledge requested payload without required ids', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            force: false,
          },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'OUTBOX_INVALID_PAYLOAD',
    });
  });

  it('ignores extra payload fields without using them', async () => {
    await expect(
      handleKnowledgeDocumentProcessingRequested(
        event({
          payload: {
            userId: 'user_1',
            documentId: 'doc_1',
            backgroundJobId: 'job_1',
            force: true,
            leakedText: 'this field is ignored by the handler',
          },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('exposes a typed handler error class', () => {
    const error = new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Invalid payload',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('OUTBOX_INVALID_PAYLOAD');
  });

  function event(input: { payload: Record<string, unknown> }): OutboxEventLike {
    return {
      id: 'evt_1',
      type: 'knowledge.document.processing.requested',
      payload: input.payload,
    };
  }
});
