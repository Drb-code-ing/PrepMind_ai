import { conversationStateSchema, type ConversationStateResponse } from '@repo/types/api/conversation-context';

import type { StoredConversationState } from './db.ts';

type ConversationStateTable = {
  get: (id: string) => Promise<StoredConversationState | undefined>;
  put: (value: StoredConversationState) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  where: (field: 'userId') => {
    equals: (value: string) => {
      delete: () => Promise<unknown>;
      toArray: () => Promise<StoredConversationState[]>;
    };
  };
};

const userOperationQueues = new Map<string, Promise<void>>();

function serializeUserOperation<T>(userId: string, operation: () => Promise<T>) {
  const previous = userOperationQueues.get(userId) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  userOperationQueues.set(userId, settled);
  void settled.finally(() => {
    if (userOperationQueues.get(userId) === settled) userOperationQueues.delete(userId);
  });
  return result;
}

function key(userId: string, conversationId: string) {
  return `${userId}:${conversationId}`;
}

function sanitizeServerState(value: unknown): ConversationStateResponse | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const parsed = conversationStateSchema.safeParse({
    conversationId: record.conversationId,
    activeGoal: record.activeGoal,
    activeQuestionId: record.activeQuestionId,
    stateVersion: record.stateVersion,
    expiresAt: record.expiresAt,
    updatedAt: record.updatedAt,
  });
  return parsed.success ? parsed.data : null;
}

function validateStoredState(
  value: StoredConversationState | undefined,
  userId: string,
  conversationId: string,
) {
  if (!value) return null;
  if (value.id !== key(userId, conversationId)) return null;
  if (value.userId !== userId || value.conversationId !== conversationId) return null;
  const state = sanitizeServerState(value);
  return state ? { ...value, ...state } : null;
}

export function createConversationStateCache(
  table: ConversationStateTable,
  now: () => number = Date.now,
) {
  const readUnsafe = async (userId: string, conversationId: string) => {
    const id = key(userId, conversationId);
    const stored = validateStoredState(await table.get(id), userId, conversationId);
    if (!stored) return null;
    if (Date.parse(stored.expiresAt) <= now()) {
      await table.delete(id).catch(() => undefined);
      return null;
    }
    return stored;
  };

  return {
    async upsertServerState(userId: string, value: unknown) {
      const state = sanitizeServerState(value);
      if (!userId || !state) return null;
      return serializeUserOperation(userId, async () => {
        try {
          const id = key(userId, state.conversationId);
          const local = validateStoredState(await table.get(id), userId, state.conversationId);
          if (local && local.stateVersion > state.stateVersion) return local;
          const stored: StoredConversationState = { id, userId, ...state };
          await table.put(stored);
          return stored;
        } catch {
          return null;
        }
      });
    },
    read(userId: string, conversationId: string) {
      return serializeUserOperation(userId, () => readUnsafe(userId, conversationId).catch(() => null));
    },
    async readLatestForUser(userId: string) {
      return serializeUserOperation(userId, async () => {
        try {
          const records = await table.where('userId').equals(userId).toArray();
          let latest: StoredConversationState | null = null;
          const expiredIds: string[] = [];
          for (const record of records) {
            const restored = validateStoredState(record, userId, record.conversationId);
            if (!restored) continue;
            if (Date.parse(restored.expiresAt) <= now()) {
              expiredIds.push(restored.id);
              continue;
            }
            if (!latest || Date.parse(restored.updatedAt) > Date.parse(latest.updatedAt)) {
              latest = restored;
            }
          }
          for (const id of expiredIds) await table.delete(id).catch(() => undefined);
          return latest;
        } catch {
          return null;
        }
      });
    },
    clearConversation(userId: string, conversationId: string) {
      return serializeUserOperation(userId, async () => {
        await table.delete(key(userId, conversationId)).catch(() => undefined);
      });
    },
    clearUser(userId: string) {
      return serializeUserOperation(userId, async () => {
        await table.where('userId').equals(userId).delete().catch(() => undefined);
      });
    },
  };
}

export function createConversationStateRuntimeBridge(cache: ConversationStateCache) {
  const coordinator = createConversationStateCoordinator(cache);
  let currentUserId: string | null = null;
  let identityVersion = 0;
  return {
    async changeIdentity(nextUserId: string | null) {
      const previousUserId = currentUserId;
      currentUserId = nextUserId;
      identityVersion += 1;
      const version = identityVersion;
      const restored = await coordinator.handleIdentityChange(previousUserId, nextUserId);
      return version === identityVersion && currentUserId === nextUserId ? restored : null;
    },
    async acceptServerResult(
      userId: string,
      result: { conversationId: string | null; state?: ConversationStateResponse | null },
    ) {
      if (!userId || userId !== currentUserId) return null;
      const version = identityVersion;
      const stored = await coordinator.acceptServerResult(userId, result);
      if (version !== identityVersion || currentUserId !== userId || !stored) return null;
      return { conversationId: stored.conversationId, state: stored };
    },
    clearConversation: coordinator.clearConversation,
  };
}

export function shouldApplyConversationStateRestore(input: {
  cancelled: boolean;
  expectedUserId: string | null;
  currentUserId: string | null;
  restored: StoredConversationState | null;
}) {
  return Boolean(
    !input.cancelled &&
      input.restored &&
      input.expectedUserId &&
      input.expectedUserId === input.currentUserId,
  );
}

type ConversationStateCache = ReturnType<typeof createConversationStateCache>;

export function createConversationStateCoordinator(cache: ConversationStateCache) {
  return {
    async acceptServerResult(
      userId: string,
      result: { conversationId: string | null; state?: ConversationStateResponse | null },
    ) {
      if (!result.conversationId || !result.state) return null;
      return cache.upsertServerState(userId, result.state);
    },
    restoreLatest(userId: string) {
      return cache.readLatestForUser(userId);
    },
    async handleIdentityChange(previousUserId: string | null, nextUserId: string | null) {
      if (previousUserId && previousUserId !== nextUserId) await cache.clearUser(previousUserId);
      return nextUserId ? cache.readLatestForUser(nextUserId) : null;
    },
    clearConversation: cache.clearConversation,
  };
}
