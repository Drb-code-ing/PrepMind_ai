import { db } from './db.ts';
import type {
  MutationEntity,
  MutationOperation,
  MutationQueueItem,
} from './db.ts';

type CreateMutationQueueItemInput = {
  userId: string;
  entity: MutationEntity;
  operation: MutationOperation;
  entityId?: string;
  dedupeKey?: string;
  payload: unknown;
};

type MutationQueueStore = {
  findByDedupeKey: (dedupeKey: string) => Promise<MutationQueueItem | undefined>;
  put: (item: MutationQueueItem) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
};

const RETRY_DELAYS_MS = [10_000, 30_000, 120_000] as const;

export const TERMINAL_RETRY_AT = '9999-12-31T23:59:59.999Z';

const dexieMutationQueueStore: MutationQueueStore = {
  findByDedupeKey: (dedupeKey) => db.mutationQueue.where('dedupeKey').equals(dedupeKey).first(),
  put: (item) => db.mutationQueue.put(item),
  delete: (id) => db.mutationQueue.delete(id),
};

export function createMutationQueueItem(
  input: CreateMutationQueueItemInput,
  now = new Date(),
): MutationQueueItem {
  const timestamp = now.toISOString();
  const dedupeKey =
    input.dedupeKey ?? createMutationDedupeKey(input.userId, input.entity, input.entityId);

  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    entity: input.entity,
    operation: input.operation,
    entityId: input.entityId,
    dedupeKey,
    payload: input.payload,
    status: 'pending',
    retryCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createMutationDedupeKey(
  userId: string,
  entity: MutationEntity,
  entityId?: string,
) {
  return `${userId}:${entity}:${entityId ?? 'new'}`;
}

export function mergeMutationQueueItems(
  existing: MutationQueueItem,
  incoming: MutationQueueItem,
): MutationQueueItem | null {
  if (
    existing.entity === 'reviewTask' &&
    existing.operation === 'rating' &&
    incoming.entity === 'reviewTask' &&
    incoming.operation === 'rating'
  ) {
    return {
      ...incoming,
      id: existing.id,
      status: 'pending',
      retryCount: 0,
      lastError: undefined,
      createdAt: existing.createdAt,
      nextRetryAt: undefined,
    };
  }

  if (existing.operation === 'create' && incoming.operation === 'delete') {
    return null;
  }

  if (incoming.operation === 'delete') {
    return {
      ...existing,
      operation: 'delete',
      payload: incoming.payload,
      status: 'pending',
      retryCount: 0,
      lastError: undefined,
      nextRetryAt: undefined,
      updatedAt: incoming.updatedAt,
    };
  }

  if (
    (existing.operation === 'create' || existing.operation === 'update') &&
    incoming.operation === 'update'
  ) {
    return {
      ...existing,
      payload: mergePayloadObjects(existing.payload, incoming.payload),
      status: 'pending',
      retryCount: 0,
      lastError: undefined,
      nextRetryAt: undefined,
      updatedAt: incoming.updatedAt,
    };
  }

  return {
    ...incoming,
    id: existing.id,
    createdAt: existing.createdAt,
  };
}

export function getNextRetryAt(retryCount: number, now = new Date()) {
  const delay = RETRY_DELAYS_MS[retryCount];
  if (delay === undefined) return undefined;
  return new Date(now.getTime() + delay).toISOString();
}

export function shouldAttemptMutation(item: MutationQueueItem, now = new Date()) {
  if (item.status === 'syncing') return false;
  if (!item.nextRetryAt) return true;
  return Date.parse(item.nextRetryAt) <= now.getTime();
}

export function getMutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '同步失败，请稍后重试';
}

export async function enqueueMutationQueueItem(
  item: MutationQueueItem,
  store: MutationQueueStore = dexieMutationQueueStore,
) {
  if (!item.dedupeKey) {
    await store.put(item);
    return item;
  }

  const existing = await store.findByDedupeKey(item.dedupeKey);
  if (!existing) {
    await store.put(item);
    return item;
  }

  const merged = mergeMutationQueueItems(existing, item);
  if (!merged) {
    await store.delete(existing.id);
    return null;
  }

  await store.put(merged);
  return merged;
}

function mergePayloadObjects(current: unknown, next: unknown) {
  if (isRecord(current) && isRecord(next)) {
    const currentPatch = isRecord(current.patch) ? current.patch : undefined;
    const nextPatch = isRecord(next.patch) ? next.patch : undefined;

    if (currentPatch && nextPatch) {
      return {
        ...current,
        ...next,
        patch: {
          ...currentPatch,
          ...nextPatch,
        },
      };
    }

    const currentRecord = isRecord(current.record) ? current.record : undefined;
    const nextPatchForRecord = isRecord(next.patch) ? next.patch : undefined;

    if (currentRecord && nextPatchForRecord) {
      return {
        ...current,
        record: {
          ...currentRecord,
          ...nextPatchForRecord,
        },
      };
    }

    return { ...current, ...next };
  }

  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
