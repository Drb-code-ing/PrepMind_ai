export type OutboxEventLike = {
  id: string;
  type: string;
  payload: unknown;
};

export type OutboxEventHandler = (event: OutboxEventLike) => Promise<void>;

export class OutboxHandlerError extends Error {
  constructor(
    readonly code:
      | 'OUTBOX_INVALID_PAYLOAD'
      | 'OUTBOX_HANDLER_NOT_FOUND'
      | 'OUTBOX_HANDLER_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'OutboxHandlerError';
  }
}

export const outboxHandlers: Record<string, OutboxEventHandler> = {
  'knowledge.document.processing.requested':
    handleKnowledgeDocumentProcessingRequested,
};

export async function handleKnowledgeDocumentProcessingRequested(
  event: OutboxEventLike,
): Promise<void> {
  const payload = event.payload;
  if (!isRecord(payload)) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Outbox event payload must be an object',
    );
  }

  assertString(payload.userId, 'userId');
  assertString(payload.documentId, 'documentId');
  assertString(payload.backgroundJobId, 'backgroundJobId');
  if (typeof payload.force !== 'boolean') {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Outbox event payload force must be boolean',
    );
  }

  await Promise.resolve();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      `Outbox event payload ${field} must be a non-empty string`,
    );
  }
}
