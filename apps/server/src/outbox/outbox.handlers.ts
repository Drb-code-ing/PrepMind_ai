import { OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT } from '../operator-audit-exports/operator-audit-export.constants';
import {
  chatResponseCompletedEventPayloadSchema,
  chatResponseFailedEventPayloadSchema,
} from '../chat-turns/chat-response.job';

export type OutboxEventLike = {
  id: string;
  type: string;
  payload: unknown;
  aggregateType?: string | null;
  aggregateId?: string | null;
  payloadHash?: string | null;
};

export type OutboxEventHandler = (event: OutboxEventLike) => Promise<void>;

export const OUTBOX_HANDLERS = Symbol('OUTBOX_HANDLERS');

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
  'chat.response.completed': handleChatResponseCompleted,
  'chat.response.failed': handleChatResponseFailed,
};

export function createOutboxHandlers(
  operatorAuditExportRequestedHandler: OutboxEventHandler,
  chatResponseRequestedHandler?: OutboxEventHandler,
): Record<string, OutboxEventHandler> {
  return {
    ...outboxHandlers,
    [OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT]:
      operatorAuditExportRequestedHandler,
    ...(chatResponseRequestedHandler === undefined
      ? {}
      : { 'chat.response.requested': chatResponseRequestedHandler }),
  };
}

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

/** Terminal chat events are durable notifications for replay/push layers. */
export async function handleChatResponseCompleted(
  event: OutboxEventLike,
): Promise<void> {
  if (
    !chatResponseCompletedEventPayloadSchema.safeParse(event.payload).success
  ) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Chat response completed payload is invalid',
    );
  }
  await Promise.resolve();
}

export async function handleChatResponseFailed(
  event: OutboxEventLike,
): Promise<void> {
  if (!chatResponseFailedEventPayloadSchema.safeParse(event.payload).success) {
    throw new OutboxHandlerError(
      'OUTBOX_INVALID_PAYLOAD',
      'Chat response failed payload is invalid',
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
