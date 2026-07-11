import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createConversationStateCache,
  createConversationStateCoordinator,
  createConversationStateRuntimeBridge,
  shouldApplyConversationStateRestore,
} from './conversation-state-cache.ts';
import type { StoredConversationState } from './db.ts';

function createFakeTable() {
  const records = new Map<string, StoredConversationState>();
  return {
    records,
    async get(id: string) { return records.get(id); },
    async put(value: StoredConversationState) {
      records.set(value.id, structuredClone(value));
      return value.id;
    },
    async delete(id: string) { records.delete(id); },
    where(field: string) {
      return {
        equals(value: string) {
          return {
            async delete() {
              for (const [key, record] of records) if (record[field] === value) records.delete(key);
            },
            async toArray() {
              return [...records.values()].filter((record) => record[field] === value);
            },
          };
        },
      };
    },
  };
}

const state = {
  conversationId: 'conv_1',
  activeGoal: 'Review calculus',
  activeQuestionId: 'q_1',
  stateVersion: 2,
  expiresAt: '2026-07-12T01:00:00.000Z',
  updatedAt: '2026-07-11T01:00:00.000Z',
};

test('stores only strict sanitized state and equal/newer versions', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table, () => Date.parse('2026-07-11T02:00:00Z'));
  await cache.upsertServerState('user_1', { ...state, summaryBuffer: 'SECRET', token: 'TOKEN' });
  await cache.upsertServerState('user_1', { ...state, stateVersion: 1, activeGoal: 'stale' });
  await cache.upsertServerState('user_1', { ...state, activeGoal: 'equal refresh' });
  const stored = table.records.get('user_1:conv_1');
  assert.deepEqual(stored, {
    id: 'user_1:conv_1', userId: 'user_1', ...state, activeGoal: 'equal refresh',
  });
  assert.doesNotMatch(JSON.stringify(stored), /SECRET|TOKEN|summary|pending|tool|prompt/i);
});

test('fails closed for invalid version and dates', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table);
  for (const invalid of [
    { ...state, stateVersion: 0 },
    { ...state, stateVersion: Number.NaN },
    { ...state, expiresAt: 'invalid' },
    { ...state, updatedAt: 'invalid' },
  ]) assert.equal(await cache.upsertServerState('user_1', invalid), null);
  assert.equal(table.records.size, 0);
});

test('does not restore expired or cross-user/mismatched records', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table, () => Date.parse('2026-07-13T00:00:00Z'));
  table.records.set('user_1:conv_1', { id: 'user_1:conv_1', userId: 'user_1', ...state });
  assert.equal(await cache.read('user_1', 'conv_1'), null);
  assert.equal(table.records.has('user_1:conv_1'), false);
  table.records.set('user_2:conv_1', { id: 'user_2:conv_1', userId: 'user_1', ...state });
  assert.equal(await cache.read('user_2', 'conv_1'), null);
});

test('clears one conversation and all states for a user', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table);
  await cache.upsertServerState('user_1', state);
  await cache.upsertServerState('user_1', { ...state, conversationId: 'conv_2' });
  await cache.clearConversation('user_1', 'conv_1');
  assert.equal(table.records.has('user_1:conv_1'), false);
  await cache.clearUser('user_1');
  assert.equal(table.records.size, 0);
});

test('coordinator caches server state, restores latest, and clears prior identity', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table, () => Date.parse('2026-07-11T02:00:00Z'));
  const coordinator = createConversationStateCoordinator(cache);
  await coordinator.acceptServerResult('user_1', { conversationId: 'conv_1', state });
  assert.equal((await coordinator.restoreLatest('user_1'))?.activeGoal, 'Review calculus');
  await coordinator.handleIdentityChange('user_1', 'user_2');
  assert.equal(table.records.size, 0);
});

test('serializes versioned writes across cache instances so newer state wins', async () => {
  const table = createFakeTable();
  let releaseV2!: () => void;
  let enteredV2!: () => void;
  const entered = new Promise<void>((resolve) => { enteredV2 = resolve; });
  const gate = new Promise<void>((resolve) => { releaseV2 = resolve; });
  const originalPut = table.put;
  table.put = async (value) => {
    if (value.stateVersion === 2) { enteredV2(); await gate; }
    return originalPut(value);
  };
  const cacheA = createConversationStateCache(table);
  const cacheB = createConversationStateCache(table);
  const v2 = cacheA.upsertServerState('user_serial', state);
  await entered;
  const v3 = cacheB.upsertServerState('user_serial', { ...state, stateVersion: 3 });
  releaseV2();
  await Promise.all([v2, v3]);
  assert.equal(table.records.get('user_serial:conv_1')?.stateVersion, 3);
});

test('serializes clear after a pending write so cleared state cannot resurrect', async () => {
  const table = createFakeTable();
  let release!: () => void;
  let entered!: () => void;
  const enteredPut = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const originalPut = table.put;
  table.put = async (value) => { entered(); await gate; return originalPut(value); };
  const cache = createConversationStateCache(table);
  const write = cache.upsertServerState('user_clear', state);
  await enteredPut;
  const clear = cache.clearUser('user_clear');
  release();
  await Promise.all([write, clear]);
  assert.equal(table.records.size, 0);
});

test('fails open on table errors without rejecting public operations', async () => {
  const failing = {
    async get() { throw new Error('raw get'); },
    async put() { throw new Error('raw put'); },
    async delete() { throw new Error('raw delete'); },
    where() { return { equals() { return { async delete() { throw new Error('raw clear'); }, async toArray() { throw new Error('raw list'); } }; } }; },
  };
  const cache = createConversationStateCache(failing);
  assert.equal(await cache.upsertServerState('user_error', state), null);
  assert.equal(await cache.read('user_error', 'conv_1'), null);
  assert.equal(await cache.readLatestForUser('user_error'), null);
  await cache.clearConversation('user_error', 'conv_1');
  await cache.clearUser('user_error');
});

test('runtime bridge coordinates server state, offline restore, identity cleanup and late writes', async () => {
  const table = createFakeTable();
  const cache = createConversationStateCache(table, () => Date.parse('2026-07-11T02:00:00Z'));
  const bridge = createConversationStateRuntimeBridge(cache);
  assert.equal(await bridge.changeIdentity('user_bridge'), null);
  const accepted = await bridge.acceptServerResult('user_bridge', {
    conversationId: 'conv_1', state,
  });
  assert.equal(accepted?.conversationId, 'conv_1');
  assert.equal('activeStudyContext' in (accepted ?? {}), false);
  const offlineBridge = createConversationStateRuntimeBridge(cache);
  assert.equal((await offlineBridge.changeIdentity('user_bridge'))?.conversationId, 'conv_1');
  await offlineBridge.changeIdentity('user_next');
  assert.equal(table.records.size, 0);
});

test('runtime bridge ignores a deferred old-user accept after identity changes', async () => {
  const table = createFakeTable();
  let release!: () => void;
  let entered!: () => void;
  const enteredPut = new Promise<void>((resolve) => { entered = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const originalPut = table.put;
  table.put = async (value) => { entered(); await gate; return originalPut(value); };
  const bridge = createConversationStateRuntimeBridge(
    createConversationStateCache(table, () => Date.parse('2026-07-11T02:00:00Z')),
  );
  await bridge.changeIdentity('user_old');
  const lateAccept = bridge.acceptServerResult('user_old', {
    conversationId: 'conv_1', state,
  });
  await enteredPut;
  const identityChange = bridge.changeIdentity('user_new');
  release();
  assert.equal(await lateAccept, null);
  await identityChange;
  assert.equal(table.records.size, 0);
});

test('reads latest state in one pass without per-row get or full sort', async () => {
  const table = createFakeTable();
  let getCalls = 0;
  let toArrayCalls = 0;
  const originalGet = table.get;
  table.get = async (id) => { getCalls += 1; return originalGet(id); };
  const originalWhere = table.where;
  table.where = (field) => {
    const query = originalWhere(field);
    const originalEquals = query.equals;
    return {
      equals(value: string) {
        const collection = originalEquals(value);
        return {
          ...collection,
          async toArray() { toArrayCalls += 1; return collection.toArray(); },
        };
      },
    };
  };
  table.records.set('user_latest:old', {
    id: 'user_latest:old', userId: 'user_latest', ...state,
    conversationId: 'old', updatedAt: '2026-07-11T01:00:00.000Z',
  });
  table.records.set('user_latest:new', {
    id: 'user_latest:new', userId: 'user_latest', ...state,
    conversationId: 'new', updatedAt: '2026-07-11T03:00:00.000Z',
  });
  table.records.set('user_latest:expired', {
    id: 'user_latest:expired', userId: 'user_latest', ...state,
    conversationId: 'expired', expiresAt: '2026-07-11T02:30:00.000Z',
  });
  table.records.set('user_latest:mismatch', {
    id: 'wrong-key', userId: 'user_latest', ...state, conversationId: 'mismatch',
  });
  const cache = createConversationStateCache(
    table,
    () => Date.parse('2026-07-11T02:45:00.000Z'),
  );
  assert.equal((await cache.readLatestForUser('user_latest'))?.conversationId, 'new');
  assert.equal(toArrayCalls, 1);
  assert.equal(getCalls, 0);
  assert.equal(table.records.has('user_latest:expired'), false);
});

test('restore guard blocks unmounts and identity changes', () => {
  const restored = { conversationId: 'conv_1' };
  assert.equal(shouldApplyConversationStateRestore({
    cancelled: false, expectedUserId: 'user_1', currentUserId: 'user_1', restored,
  }), true);
  assert.equal(shouldApplyConversationStateRestore({
    cancelled: true, expectedUserId: 'user_1', currentUserId: 'user_1', restored,
  }), false);
  assert.equal(shouldApplyConversationStateRestore({
    cancelled: false, expectedUserId: 'user_1', currentUserId: 'user_2', restored,
  }), false);
  assert.equal(shouldApplyConversationStateRestore({
    cancelled: false, expectedUserId: 'user_1', currentUserId: 'user_1', restored: null,
  }), false);
});
