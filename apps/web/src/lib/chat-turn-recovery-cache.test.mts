import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createChatTurnRecoveryCache,
  createChatTurnRecoveryRecord,
} from './chat-turn-recovery-cache.ts';
import type { StoredChatTurnRecovery } from './db.ts';

test('stores owner-bound handoff metadata and preserves a newer replay checkpoint', async () => {
  let now = 1_000;
  const table = createTable();
  const cache = createChatTurnRecoveryCache(table, () => now);
  const record = recoveryRecord(() => now);
  await cache.begin(record);
  now = 2_000;
  const checkpoint = await cache.checkpoint(record.id, 'user_1', {
    status: 'ACTIVE',
    transport: 'available',
    cursor: '100-1',
    lastSequence: 3,
    previewText: 'partial answer',
  });

  const restarted = await cache.begin(recoveryRecord(() => 3_000));

  assert.equal(checkpoint?.lastSequence, 3);
  assert.equal(restarted.cursor, '100-1');
  assert.equal(restarted.previewText, 'partial answer');
  assert.equal(restarted.status, 'ACTIVE');
});

test('rejects stale checkpoints and prevents a completed recovery from being resurrected', async () => {
  let now = 1_000;
  const table = createTable();
  const cache = createChatTurnRecoveryCache(table, () => now);
  const record = await cache.begin(recoveryRecord(() => now));
  now = 2_000;
  await cache.checkpoint(record.id, 'user_1', {
    status: 'ACTIVE',
    transport: 'available',
    cursor: '100-2',
    lastSequence: 4,
    previewText: 'newer',
  });
  const stale = await cache.checkpoint(record.id, 'user_1', {
    status: 'ACTIVE',
    transport: 'available',
    cursor: '100-1',
    lastSequence: 2,
    previewText: 'stale',
  });
  await cache.remove(record.id, 'user_1');
  const afterRemoval = await cache.checkpoint(record.id, 'user_1', {
    status: 'ACTIVE',
    transport: 'available',
    cursor: '100-3',
    lastSequence: 5,
    previewText: 'must not return',
  });

  assert.equal(stale?.previewText, 'newer');
  assert.equal(afterRemoval, null);
  assert.equal(table.records.size, 0);
});

test('loads only the latest live recovery for one owner and removes expired records', async () => {
  const now = 10_000;
  const table = createTable();
  const cache = createChatTurnRecoveryCache(table, () => now);
  const latest = recoveryRecord(() => now);
  const expired = {
    ...recoveryRecord(() => 1_000, {
      turnId: 'turn_old',
      conversationId: 'conv_old',
      backgroundJobId: 'job_old',
    }),
    updatedAt: 1_000,
    expiresAt: 2_000,
  };
  const foreign = recoveryRecord(() => now + 1, {
    userId: 'user_2',
    turnId: 'turn_foreign',
  });
  table.records.set(latest.id, latest);
  table.records.set(expired.id, expired);
  table.records.set(foreign.id, foreign);

  const restored = await cache.readLatestForUser('user_1');

  assert.equal(restored?.id, latest.id);
  assert.equal(table.records.has(expired.id), false);
  assert.equal(table.records.has(foreign.id), true);
});

test('selects the recovery for the restored conversation without deleting another conversation', async () => {
  const table = createTable();
  const cache = createChatTurnRecoveryCache(table, () => 4_000);
  const currentConversation = recoveryRecord(() => 2_000, {
    turnId: 'turn_current',
    conversationId: 'conv_current',
    backgroundJobId: 'job_current',
  });
  const newerOtherConversation = recoveryRecord(() => 3_000, {
    turnId: 'turn_other',
    conversationId: 'conv_other',
    backgroundJobId: 'job_other',
  });
  table.records.set(currentConversation.id, currentConversation);
  table.records.set(newerOtherConversation.id, newerOtherConversation);

  const restored = await cache.readLatestForUser('user_1', 'conv_current');

  assert.equal(restored?.id, currentConversation.id);
  assert.equal(table.records.has(newerOtherConversation.id), true);
});

function recoveryRecord(
  now: () => number,
  overrides: Partial<{
    userId: string;
    turnId: string;
    conversationId: string;
    backgroundJobId: string;
  }> = {},
) {
  return createChatTurnRecoveryRecord(
    {
      userId: overrides.userId ?? 'user_1',
      handoff: {
        type: 'prepmind-chat-turn-handoff-v1',
        turnId: overrides.turnId ?? 'turn_1',
        conversationId: overrides.conversationId ?? 'conv_1',
        status: 'QUEUED',
        backgroundJobId: overrides.backgroundJobId ?? 'job_1',
      },
      placeholderMessageId: 'placeholder_1',
      createdAt: now(),
    },
    now,
  );
}

function createTable() {
  const records = new Map<string, StoredChatTurnRecovery>();
  return {
    records,
    async get(id: string) {
      return records.get(id);
    },
    async put(value: StoredChatTurnRecovery) {
      records.set(value.id, structuredClone(value));
    },
    async delete(id: string) {
      records.delete(id);
    },
    where(field: 'userId') {
      assert.equal(field, 'userId');
      return {
        equals(userId: string) {
          return {
            async delete() {
              for (const [id, record] of records) {
                if (record.userId === userId) records.delete(id);
              }
            },
            async toArray() {
              return [...records.values()].filter((record) => record.userId === userId);
            },
          };
        },
      };
    },
  };
}
