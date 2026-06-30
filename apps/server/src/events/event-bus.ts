export type ServerEvent =
  | {
      type: 'knowledge.document.processing.requested';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      contentHash: string | null;
      storageKey: string;
      requestedAt: string;
    }
  | {
      type: 'knowledge.document.processing.succeeded';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      chunkCount: number;
      durationMs: number;
      finishedAt: string;
    }
  | {
      type: 'knowledge.document.processing.failed';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      errorCode: string;
      retryable: boolean;
      finishedAt: string;
    }
  | {
      type: 'knowledge.document.processing.stale_skipped';
      userId: string;
      documentId: string;
      backgroundJobId: string;
      reason: 'document_missing' | 'snapshot_changed' | 'status_not_processing' | 'job_not_active';
      skippedAt: string;
    };

type Handler<T extends ServerEvent> = (event: T) => void;

export class InProcessEventBus {
  private readonly handlers = new Map<ServerEvent['type'], Set<Handler<ServerEvent>>>();

  publish(event: ServerEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(event);
    }
  }

  subscribe<T extends ServerEvent['type']>(
    type: T,
    handler: Handler<Extract<ServerEvent, { type: T }>>,
  ): () => void {
    const handlers = this.handlers.get(type) ?? new Set<Handler<ServerEvent>>();
    handlers.add(handler as Handler<ServerEvent>);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler as Handler<ServerEvent>);
    };
  }
}
