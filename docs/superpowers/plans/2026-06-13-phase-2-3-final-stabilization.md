# Phase 2.3 Final Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Phase 2.3 最后收尾：Dexie mutation queue、WrongQuestion / OCRRecord 乐观写入与失败补偿、历史 base64 图片边界和文档同步。

**Architecture:** 服务端仍是业务数据权威来源，Dexie 只承担本地缓存、乐观更新和失败补偿队列。WrongQuestion / OCRRecord 的可重放 CRUD 操作进入 `mutationQueue`，ChatMessage 继续使用现有幂等快照 sync，不进入通用队列。

**Tech Stack:** Next.js 16, React 19, TypeScript, Dexie, TanStack Query, NestJS REST API, Node built-in test runner.

---

## File Structure

- Modify: `apps/web/src/lib/db.ts`
  - 增加 `LocalSyncStatus`、`PendingOperation`、`MutationQueueItem` 类型。
  - 给 `OcrRecord` 和 `WrongQuestionRecord` 增加本地同步状态字段。
  - Dexie schema 升级到 version 7，新增 `mutationQueue` 表。

- Create: `apps/web/src/lib/mutation-queue.ts`
  - 队列 item 创建、dedupe key、合并规则、重试时间计算、错误文本格式化。
  - 纯函数优先，方便用 Node 测试。

- Create: `apps/web/src/lib/mutation-queue.test.mts`
  - 覆盖 create/update/delete 合并、retry backoff、不可重试上限。

- Create: `apps/web/src/lib/mutation-queue-flush.ts`
  - 按 queue item 调用 WrongQuestion / OCRRecord API。
  - 判断成功、终止失败、可重试失败。
  - 提供 `flushMutationQueue()` 给 React hook 调用。

- Create: `apps/web/src/lib/mutation-queue-flush.test.mts`
  - 用 fake API 覆盖 delete 404 成功、重复创建成功、401 不重试、5xx 退避。

- Create: `apps/web/src/hooks/use-mutation-queue-flush.ts`
  - session 恢复、online、focus 时触发 queue flush。

- Modify: `apps/web/src/components/providers/auth-session-provider.tsx`
  - 接入 `useMutationQueueFlush()`，登录态恢复后自动尝试补偿同步。

- Modify: `apps/web/src/hooks/use-wrong-questions.ts`
  - 导出 `wrongQuestionApi` 或新增轻量 helper，方便 flush 模块复用同一 API mapping。
  - 保持现有 hooks API 不破坏页面调用。

- Modify: `apps/web/src/hooks/use-ocr-records.ts`
  - 导出 `ocrRecordApi` 或新增轻量 helper，方便 flush 模块复用同一 API mapping。

- Modify: `apps/web/src/app/(chat)/chat/page.tsx`
  - 保存错题失败时写 Dexie + queue，并给用户轻提示。
  - 保存成功或进入队列后禁用重复保存入口。

- Modify: `apps/web/src/app/(main)/error-book/page.tsx`
  - 错题更新失败不回滚用户输入，改为本地暂存 + queue。
  - 删除失败进入 queue，列表继续隐藏该记录。
  - 列表过滤 `pendingOperation === 'delete'` 的记录。
  - 显示轻量 `syncStatus` 状态。

- Modify: `apps/web/src/components/providers/ocr-runtime-provider.tsx`
  - OCRRecord 创建失败时写 queue，Dexie 记录标记 `failed`，后续自动 flush。

- Modify: `apps/web/src/lib/server-cache-sync.ts`
  - 合并服务端列表时保留本地 `syncStatus` 失败项，避免未同步记录被服务端空列表清掉。
  - 已同步记录继续严格以服务端列表为权威。

- Modify: `apps/web/src/lib/server-cache-sync.test.mts`
  - 增加 pending / failed 本地项保留测试。

- Docs after implementation:
  - `docs/data-flow.md`
  - `docs/roadmap.md`
  - `DEVLOG.md`
  - `CLAUDE.md`
  - `AGENTS.md`
  - `README.md`
  - `Blog/2026-06-13-phase-2-3-final-stabilization.md`，继续不跟踪。

---

### Task 1: Dexie schema and local sync metadata

**Files:**
- Modify: `apps/web/src/lib/db.ts`

- [ ] **Step 1: Add local sync types and queue table types**

Add these exported types near the existing DB interfaces:

```ts
export type LocalSyncStatus = 'synced' | 'pending' | 'failed';
export type PendingOperation = 'create' | 'update' | 'delete';

export type MutationEntity = 'wrongQuestion' | 'ocrRecord';
export type MutationOperation = 'create' | 'update' | 'delete';
export type MutationStatus = 'pending' | 'syncing' | 'failed';

export interface LocalSyncMetadata {
  syncStatus?: LocalSyncStatus;
  syncError?: string;
  pendingOperation?: PendingOperation;
}

export interface MutationQueueItem {
  id: string;
  userId: string;
  entity: MutationEntity;
  operation: MutationOperation;
  entityId?: string;
  dedupeKey?: string;
  payload: unknown;
  status: MutationStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
}
```

- [ ] **Step 2: Extend local record interfaces**

Change:

```ts
export interface OcrRecord {
```

to:

```ts
export interface OcrRecord extends LocalSyncMetadata {
```

Change:

```ts
export interface WrongQuestionRecord {
```

to:

```ts
export interface WrongQuestionRecord extends LocalSyncMetadata {
```

- [ ] **Step 3: Add the Dexie table property**

Inside `class PrepMindDB extends Dexie`, add:

```ts
mutationQueue!: Table<MutationQueueItem, string>;
```

- [ ] **Step 4: Add Dexie version 7**

After the existing `db.version(6)` block, add:

```ts
db.version(7).stores({
  messages: 'id, userId, [userId+order], role, order, createdAt',
  ocrRecords:
    'id, userId, [userId+createdAt], [userId+pendingOperation], type, groupId, createdAt, syncStatus',
  wrongQuestions:
    'id, userId, [userId+sourceGroupId], [userId+createdAt], [userId+pendingOperation], source, sourceGroupId, subject, category, errorType, status, syncStatus, createdAt, updatedAt',
  mutationQueue:
    '&id, userId, [userId+status], [userId+entity], dedupeKey, nextRetryAt, updatedAt',
});
```

- [ ] **Step 5: Run TypeScript-facing tests that import DB types**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
```

Expected:

```text
exit code 0
```

- [ ] **Step 6: Commit**

```powershell
git add -- apps/web/src/lib/db.ts
git commit -m "feat: add local mutation queue schema"
```

---

### Task 2: Mutation queue pure helpers

**Files:**
- Create: `apps/web/src/lib/mutation-queue.ts`
- Create: `apps/web/src/lib/mutation-queue.test.mts`

- [ ] **Step 1: Write the failing queue helper tests**

Create `apps/web/src/lib/mutation-queue.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMutationQueueItem,
  getNextRetryAt,
  mergeMutationQueueItems,
  shouldAttemptMutation,
} from './mutation-queue.ts';

test('creates a pending queue item with a stable dedupe key', () => {
  const item = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { userNote: 'keep this' } },
    },
    new Date('2026-06-13T00:00:00.000Z'),
  );

  assert.equal(item.status, 'pending');
  assert.equal(item.retryCount, 0);
  assert.equal(item.dedupeKey, 'user_1:wrongQuestion:wrong_1');
  assert.equal(item.createdAt, '2026-06-13T00:00:00.000Z');
});

test('merges repeated update operations by keeping the latest patch', () => {
  const first = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { status: 'resolved' } },
    },
    new Date('2026-06-13T00:00:00.000Z'),
  );
  const second = createMutationQueueItem(
    {
      userId: 'user_1',
      entity: 'wrongQuestion',
      operation: 'update',
      entityId: 'wrong_1',
      payload: { patch: { userNote: 'final note' } },
    },
    new Date('2026-06-13T00:00:01.000Z'),
  );

  const merged = mergeMutationQueueItems(first, second);

  assert.ok(merged);
  assert.equal(merged.operation, 'update');
  assert.deepEqual(merged.payload, {
    patch: { status: 'resolved', userNote: 'final note' },
  });
  assert.equal(merged.updatedAt, '2026-06-13T00:00:01.000Z');
});

test('drops a local-only create when it is deleted before syncing', () => {
  const create = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'create',
    entityId: 'local_1',
    payload: { record: { id: 'local_1' } },
  });
  const remove = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'delete',
    entityId: 'local_1',
    payload: { id: 'local_1' },
  });

  assert.equal(mergeMutationQueueItems(create, remove), null);
});

test('collapses update followed by delete into delete', () => {
  const update = createMutationQueueItem({
    userId: 'user_1',
    entity: 'ocrRecord',
    operation: 'update',
    entityId: 'ocr_1',
    payload: { patch: { syncStatus: 'failed' } },
  });
  const remove = createMutationQueueItem({
    userId: 'user_1',
    entity: 'ocrRecord',
    operation: 'delete',
    entityId: 'ocr_1',
    payload: { id: 'ocr_1' },
  });

  const merged = mergeMutationQueueItems(update, remove);

  assert.ok(merged);
  assert.equal(merged.operation, 'delete');
  assert.deepEqual(merged.payload, { id: 'ocr_1' });
});

test('calculates bounded retry backoff', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');

  assert.equal(getNextRetryAt(0, now), '2026-06-13T00:00:10.000Z');
  assert.equal(getNextRetryAt(1, now), '2026-06-13T00:00:30.000Z');
  assert.equal(getNextRetryAt(2, now), '2026-06-13T00:02:00.000Z');
  assert.equal(getNextRetryAt(3, now), undefined);
});

test('skips future retry items and allows due items', () => {
  const now = new Date('2026-06-13T00:00:00.000Z');
  const future = createMutationQueueItem({
    userId: 'user_1',
    entity: 'wrongQuestion',
    operation: 'update',
    entityId: 'wrong_1',
    payload: { patch: {} },
  });
  const due = { ...future, nextRetryAt: '2026-06-12T23:59:59.000Z' };

  assert.equal(
    shouldAttemptMutation({ ...future, nextRetryAt: '2026-06-13T00:00:01.000Z' }, now),
    false,
  );
  assert.equal(shouldAttemptMutation(due, now), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue.test.mts
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement queue helper**

Create `apps/web/src/lib/mutation-queue.ts`:

```ts
import type {
  MutationEntity,
  MutationOperation,
  MutationQueueItem,
} from './db';

type CreateMutationQueueItemInput = {
  userId: string;
  entity: MutationEntity;
  operation: MutationOperation;
  entityId?: string;
  dedupeKey?: string;
  payload: unknown;
};

const RETRY_DELAYS_MS = [10_000, 30_000, 120_000] as const;

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

  if (existing.operation === 'create' && incoming.operation === 'update') {
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

  if (existing.operation === 'update' && incoming.operation === 'update') {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue.test.mts
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/mutation-queue.ts apps/web/src/lib/mutation-queue.test.mts
git commit -m "feat: add mutation queue helpers"
```

---

### Task 3: Mutation queue flush classification

**Files:**
- Create: `apps/web/src/lib/mutation-queue-flush.ts`
- Create: `apps/web/src/lib/mutation-queue-flush.test.mts`

- [ ] **Step 1: Write failing flush tests**

Create `apps/web/src/lib/mutation-queue-flush.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError } from './api-client.ts';
import type { MutationQueueItem } from './db.ts';
import {
  classifyMutationFlushError,
  flushMutationItem,
} from './mutation-queue-flush.ts';

const baseItem: MutationQueueItem = {
  id: 'queue_1',
  userId: 'user_1',
  entity: 'wrongQuestion',
  operation: 'delete',
  entityId: 'wrong_1',
  dedupeKey: 'user_1:wrongQuestion:wrong_1',
  payload: { id: 'wrong_1' },
  status: 'pending',
  retryCount: 0,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
};

test('treats delete 404 as success', () => {
  const error = new ApiClientError('not found', {
    status: 404,
    code: 'WRONG_QUESTION_NOT_FOUND',
  });

  assert.deepEqual(classifyMutationFlushError(baseItem, error), {
    outcome: 'success',
  });
});

test('treats duplicated wrong question create as success', () => {
  const item = {
    ...baseItem,
    operation: 'create' as const,
    payload: { record: { id: 'wrong_1' } },
  };
  const error = new ApiClientError('duplicated', {
    status: 409,
    code: 'WRONG_QUESTION_DUPLICATED',
  });

  assert.deepEqual(classifyMutationFlushError(item, error), {
    outcome: 'success',
  });
});

test('does not retry auth failures', () => {
  const error = new ApiClientError('unauthorized', {
    status: 401,
    code: 'AUTH_UNAUTHORIZED',
  });

  assert.deepEqual(classifyMutationFlushError(baseItem, error), {
    outcome: 'terminal',
    reason: 'unauthorized',
  });
});

test('retries network and server failures', () => {
  assert.equal(
    classifyMutationFlushError(
      baseItem,
      new ApiClientError('network', { status: 0, code: 'NETWORK_ERROR' }),
    ).outcome,
    'retry',
  );
  assert.equal(
    classifyMutationFlushError(
      baseItem,
      new ApiClientError('server', { status: 503, code: 'SERVICE_UNAVAILABLE' }),
    ).outcome,
    'retry',
  );
});

test('flushes wrong question update through provided API', async () => {
  const calls: unknown[] = [];
  const item: MutationQueueItem = {
    ...baseItem,
    operation: 'update',
    payload: { patch: { userNote: 'saved later' } },
  };

  const result = await flushMutationItem(item, 'access-token', {
    wrongQuestions: {
      create: async () => {
        throw new Error('unexpected create');
      },
      update: async (_token, id, patch) => {
        calls.push({ id, patch });
        return { id, userNote: 'saved later' };
      },
      delete: async () => {
        throw new Error('unexpected delete');
      },
    },
    ocrRecords: {
      create: async () => {
        throw new Error('unexpected ocr create');
      },
      delete: async () => {
        throw new Error('unexpected ocr delete');
      },
    },
  });

  assert.equal(result.outcome, 'success');
  assert.deepEqual(calls, [{ id: 'wrong_1', patch: { userNote: 'saved later' } }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

- [ ] **Step 3: Implement flush classification and item executor**

Create `apps/web/src/lib/mutation-queue-flush.ts` with these exports:

```ts
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import { ApiClientError, apiClient } from './api-client';
import type {
  MutationQueueItem,
  OcrRecord,
  WrongQuestionRecord,
} from './db';
import { db } from './db';
import { createOcrRecordApi } from './ocr-record-api';
import { createWrongQuestionApi, type UpdateLocalWrongQuestionRequest } from './wrong-question-api';
import {
  getMutationErrorMessage,
  getNextRetryAt,
  shouldAttemptMutation,
} from './mutation-queue';

type WrongQuestionCreatePayload = { record: WrongQuestionRecord };
type WrongQuestionUpdatePayload = { patch: UpdateLocalWrongQuestionRequest };
type WrongQuestionDeletePayload = { id: string };
type OcrRecordCreatePayload = { record: OcrRecord; parsedJson: OcrParsedPayload };
type OcrRecordDeletePayload = { id: string };

type MutationApis = {
  wrongQuestions: ReturnType<typeof createWrongQuestionApi>;
  ocrRecords: ReturnType<typeof createOcrRecordApi>;
};

type FlushResult =
  | { outcome: 'success'; record?: WrongQuestionRecord | OcrRecord }
  | { outcome: 'retry'; error: string }
  | { outcome: 'terminal'; reason: string; error: string };

const defaultApis: MutationApis = {
  wrongQuestions: createWrongQuestionApi(apiClient),
  ocrRecords: createOcrRecordApi(apiClient),
};

export async function flushMutationItem(
  item: MutationQueueItem,
  accessToken: string,
  apis: MutationApis = defaultApis,
): Promise<FlushResult> {
  try {
    if (item.entity === 'wrongQuestion') {
      const record = await flushWrongQuestionItem(item, accessToken, apis);
      return { outcome: 'success', record };
    }

    const record = await flushOcrRecordItem(item, accessToken, apis);
    return { outcome: 'success', record };
  } catch (error) {
    const classified = classifyMutationFlushError(item, error);
    if (classified.outcome === 'success') return classified;
    return {
      ...classified,
      error: getMutationErrorMessage(error),
    };
  }
}

export function classifyMutationFlushError(
  item: MutationQueueItem,
  error: unknown,
): { outcome: 'success' } | { outcome: 'retry' } | { outcome: 'terminal'; reason: string } {
  if (error instanceof ApiClientError) {
    if (item.operation === 'delete' && error.status === 404) {
      return { outcome: 'success' };
    }

    if (
      item.entity === 'wrongQuestion' &&
      item.operation === 'create' &&
      error.code === 'WRONG_QUESTION_DUPLICATED'
    ) {
      return { outcome: 'success' };
    }

    if (error.status === 401 || error.status === 403) {
      return { outcome: 'terminal', reason: 'unauthorized' };
    }

    if (error.status === 0 || error.status >= 500) {
      return { outcome: 'retry' };
    }

    return { outcome: 'terminal', reason: error.code };
  }

  return { outcome: 'retry' };
}

export async function flushMutationQueue({
  userId,
  accessToken,
  now = new Date(),
  maxItems = 20,
}: {
  userId: string;
  accessToken: string;
  now?: Date;
  maxItems?: number;
}) {
  const pending = await db.mutationQueue
    .where('userId')
    .equals(userId)
    .toArray();
  const dueItems = pending
    .filter((item) => item.status !== 'syncing' && shouldAttemptMutation(item, now))
    .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
    .slice(0, maxItems);

  for (const item of dueItems) {
    await db.mutationQueue.update(item.id, {
      status: 'syncing',
      updatedAt: new Date().toISOString(),
    });

    const result = await flushMutationItem(item, accessToken);
    if (result.outcome === 'success') {
      await applyFlushSuccess(item, result.record);
      continue;
    }

    const retryCount = item.retryCount + 1;
    const nextRetryAt =
      result.outcome === 'retry' ? getNextRetryAt(retryCount, new Date()) : undefined;

    await db.mutationQueue.update(item.id, {
      status: 'failed',
      retryCount,
      lastError: result.error,
      nextRetryAt,
      updatedAt: new Date().toISOString(),
    });
  }
}
```

Add the private helpers in the same file:

```ts
async function flushWrongQuestionItem(
  item: MutationQueueItem,
  accessToken: string,
  apis: MutationApis,
) {
  if (item.operation === 'create') {
    const payload = item.payload as WrongQuestionCreatePayload;
    return apis.wrongQuestions.create(accessToken, payload.record);
  }
  if (item.operation === 'update') {
    const payload = item.payload as WrongQuestionUpdatePayload;
    return apis.wrongQuestions.update(accessToken, item.entityId ?? '', payload.patch);
  }

  const payload = item.payload as WrongQuestionDeletePayload;
  await apis.wrongQuestions.delete(accessToken, payload.id);
  return undefined;
}

async function flushOcrRecordItem(
  item: MutationQueueItem,
  accessToken: string,
  apis: MutationApis,
) {
  if (item.operation === 'create') {
    const payload = item.payload as OcrRecordCreatePayload;
    return apis.ocrRecords.create(accessToken, payload.record, payload.parsedJson);
  }

  const payload = item.payload as OcrRecordDeletePayload;
  await apis.ocrRecords.delete(accessToken, payload.id);
  return undefined;
}

async function applyFlushSuccess(
  item: MutationQueueItem,
  record?: WrongQuestionRecord | OcrRecord,
) {
  await db.mutationQueue.delete(item.id);

  if (item.entity === 'wrongQuestion') {
    if (item.operation === 'delete') {
      await db.wrongQuestions.delete(item.entityId ?? (item.payload as WrongQuestionDeletePayload).id);
      return;
    }
    if (record) {
      await db.wrongQuestions.put({
        ...(record as WrongQuestionRecord),
        syncStatus: 'synced',
        syncError: undefined,
        pendingOperation: undefined,
      });
    }
    return;
  }

  if (item.operation === 'delete') {
    await db.ocrRecords.delete(item.entityId ?? (item.payload as OcrRecordDeletePayload).id);
    return;
  }

  if (record) {
    await db.ocrRecords.put({
      ...(record as OcrRecord),
      syncStatus: 'synced',
      syncError: undefined,
      pendingOperation: undefined,
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/mutation-queue-flush.ts apps/web/src/lib/mutation-queue-flush.test.mts
git commit -m "feat: add mutation queue flush logic"
```

---

### Task 4: Queue persistence helpers and flush hook

**Files:**
- Modify: `apps/web/src/lib/mutation-queue.ts`
- Create: `apps/web/src/hooks/use-mutation-queue-flush.ts`
- Modify: `apps/web/src/components/providers/auth-session-provider.tsx`

- [ ] **Step 1: Add Dexie enqueue helper**

Append this to `apps/web/src/lib/mutation-queue.ts`:

```ts
import { db } from './db';

export async function enqueueMutationQueueItem(item: MutationQueueItem) {
  if (!item.dedupeKey) {
    await db.mutationQueue.put(item);
    return item;
  }

  const existing = await db.mutationQueue.where('dedupeKey').equals(item.dedupeKey).first();
  if (!existing) {
    await db.mutationQueue.put(item);
    return item;
  }

  const merged = mergeMutationQueueItems(existing, item);
  if (!merged) {
    await db.mutationQueue.delete(existing.id);
    return null;
  }

  await db.mutationQueue.put(merged);
  return merged;
}
```

If this creates duplicate imports, combine the import section so `db` and type imports stay at the top.

- [ ] **Step 2: Create flush hook**

Create `apps/web/src/hooks/use-mutation-queue-flush.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef } from 'react';

import { flushMutationQueue } from '@/lib/mutation-queue-flush';
import { useUserStore } from '@/stores/userStore';

export function useMutationQueueFlush() {
  const accessToken = useUserStore((state) => state.accessToken);
  const currentUser = useUserStore((state) => state.currentUser);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!sessionHydrated || !accessToken || !currentUser?.id || flushingRef.current) return;

    flushingRef.current = true;
    try {
      await flushMutationQueue({
        userId: currentUser.id,
        accessToken,
      });
    } catch (error) {
      console.warn(
        `[MutationQueue flush]: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      flushingRef.current = false;
    }
  }, [accessToken, currentUser?.id, sessionHydrated]);

  useEffect(() => {
    void flush();
  }, [flush]);

  useEffect(() => {
    const onOnline = () => void flush();
    const onFocus = () => void flush();

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [flush]);

  return { flush };
}
```

- [ ] **Step 3: Wire hook into auth provider**

Modify `apps/web/src/components/providers/auth-session-provider.tsx`.

Add import:

```ts
import { useMutationQueueFlush } from '@/hooks/use-mutation-queue-flush';
```

Inside `AuthSessionProvider`, add:

```ts
useMutationQueueFlush();
```

Place it after `const bootstrappedRef = useRef(false);`.

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
bun --filter @repo/web lint
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/mutation-queue.ts apps/web/src/hooks/use-mutation-queue-flush.ts apps/web/src/components/providers/auth-session-provider.tsx
git commit -m "feat: flush local mutation queue"
```

---

### Task 5: Server cache merge keeps unsynced local items

**Files:**
- Modify: `apps/web/src/lib/server-cache-sync.ts`
- Modify: `apps/web/src/lib/server-cache-sync.test.mts`

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/lib/server-cache-sync.test.mts`:

```ts
test('wrong question cache keeps local failed items while following server authority', () => {
  const localFailed: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    id: 'wrong_failed',
    sourceGroupId: 'group_failed',
    questionText: 'local unsynced',
    syncStatus: 'failed',
    pendingOperation: 'create',
  };

  const merged = mergeWrongQuestionsFromServer([], [localFailed]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ['wrong_failed'],
  );
  assert.equal(merged[0].syncStatus, 'failed');
});

test('wrong question cache hides pending delete items from merged cache', () => {
  const pendingDelete: WrongQuestionRecord = {
    ...cachedWrongQuestion,
    syncStatus: 'failed',
    pendingOperation: 'delete',
  };

  assert.deepEqual(mergeWrongQuestionsFromServer([], [pendingDelete]), []);
});

test('ocr cache keeps local failed result records while following server authority', () => {
  const localFailed: OcrRecord = {
    id: 'ocr_failed',
    userId: 'user_1',
    type: 'ocr-result',
    groupId: 'group_failed',
    imageUrl: 'data:image/png;base64,local',
    content: 'local failed sync',
    createdAt: 1,
    syncStatus: 'failed',
    pendingOperation: 'create',
  };

  const merged = mergeOcrRecordsFromServer([], [localFailed]);

  assert.deepEqual(
    merged.map((item) => item.id),
    ['ocr_failed'],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
```

Expected:

```text
AssertionError
```

- [ ] **Step 3: Implement unsynced local preservation**

Modify `apps/web/src/lib/server-cache-sync.ts`:

```ts
function shouldKeepUnsyncedLocalItem(item: { syncStatus?: string; pendingOperation?: string }) {
  return item.syncStatus && item.syncStatus !== 'synced' && item.pendingOperation !== 'delete';
}
```

Change `mergeWrongQuestionsFromServer` to:

```ts
export function mergeWrongQuestionsFromServer(
  serverItems: WrongQuestionRecord[],
  cachedItems: WrongQuestionRecord[],
) {
  const cachedById = new Map(cachedItems.map((item) => [item.id, item]));
  const serverIds = new Set(serverItems.map((item) => item.id));
  const unsyncedLocalItems = cachedItems.filter(
    (item) => shouldKeepUnsyncedLocalItem(item) && !serverIds.has(item.id),
  );

  const mergedServerItems = serverItems.map((item) => ({
    ...item,
    imageUrl: item.imageUrl ?? cachedById.get(item.id)?.imageUrl,
    syncStatus: 'synced' as const,
    syncError: undefined,
    pendingOperation: undefined,
  }));

  return [...unsyncedLocalItems, ...mergedServerItems].sort((a, b) => b.createdAt - a.createdAt);
}
```

Change `mergeOcrRecordsFromServer` so `serverItems.length === 0` does not always return `[]`. Use:

```ts
const unsyncedLocalItems = localItems.filter(shouldKeepUnsyncedLocalItem);
if (serverItems.length === 0) return unsyncedLocalItems;
```

Before returning OCR merged items, append unsynced items not already present by id:

```ts
const merged = [...Array.from(localUserRecordsByGroup.values()), ...serverRecords];
const mergedIds = new Set(merged.map((item) => item.id));
return [
  ...unsyncedLocalItems.filter((item) => !mergedIds.has(item.id)),
  ...merged,
].sort((a, b) => a.createdAt - b.createdAt);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/lib/server-cache-sync.ts apps/web/src/lib/server-cache-sync.test.mts
git commit -m "fix: preserve unsynced local cache items"
```

---

### Task 6: WrongQuestion create fallback from chat page

**Files:**
- Modify: `apps/web/src/app/(chat)/chat/page.tsx`

- [ ] **Step 1: Add imports**

Add:

```ts
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
```

- [ ] **Step 2: Change save failure handling**

In `confirmWrongQuestionSave`, replace the non-duplicate catch path with:

```ts
      const errorMessage = getMutationErrorMessage(error);
      const localRecord: WrongQuestionRecord = {
        ...record,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'create',
      };

      await db.wrongQuestions.put(localRecord);
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId: ownerId,
          entity: 'wrongQuestion',
          operation: 'create',
          entityId: record.id,
          payload: { record },
        }),
      );

      if (sourceGroupId) {
        setSavedWrongGroupIds((prev) => new Set(prev).add(sourceGroupId));
        setSavedWrongQuestionIdsByGroup((prev) => ({
          ...prev,
          [sourceGroupId]: record.id,
        }));
        setSaveWrongErrors((prev) => ({
          ...prev,
          [sourceGroupId]: '网络异常，错题已暂存，稍后自动同步',
        }));
      }
      setPendingWrongQuestion(null);
      return;
```

- [ ] **Step 3: Mark successful local record as synced**

In the success `db.wrongQuestions.put` call, change the object to:

```ts
      await db.wrongQuestions.put({
        ...savedRecord,
        imageUrl: savedRecord.imageUrl ?? record.imageUrl,
        syncStatus: 'synced',
        syncError: undefined,
        pendingOperation: undefined,
      });
```

- [ ] **Step 4: Run focused build check**

Run:

```powershell
bun --filter @repo/web lint
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- "apps/web/src/app/(chat)/chat/page.tsx"
git commit -m "feat: queue failed wrong question saves"
```

---

### Task 7: WrongQuestion update/delete optimistic fallback in error book

**Files:**
- Modify: `apps/web/src/app/(main)/error-book/page.tsx`

- [ ] **Step 1: Add imports**

Add:

```ts
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
```

- [ ] **Step 2: Hide pending delete records**

In `filteredItems`, add this first condition:

```ts
      if (item.pendingOperation === 'delete') return false;
```

- [ ] **Step 3: Replace `updateItem` with queued fallback behavior**

Use this implementation:

```ts
  const updateItem = async (id: string, patch: UpdateLocalWrongQuestionRequest) => {
    const current = items.find((item) => item.id === id);
    if (!current || !userId) return;

    const optimistic: WrongQuestionRecord = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
      syncStatus: 'pending',
      syncError: undefined,
      pendingOperation: 'update',
    };
    await db.wrongQuestions.put(optimistic);
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)));
    setSelected((prev) => (prev?.id === id ? optimistic : prev));

    try {
      const updated = await updateWrongQuestion.mutateAsync({ id, patch });
      const synced: WrongQuestionRecord = {
        ...updated,
        syncStatus: 'synced',
        syncError: undefined,
        pendingOperation: undefined,
      };
      await db.wrongQuestions.put(synced);
      setItems((prev) => prev.map((item) => (item.id === id ? synced : item)));
      setSelected((prev) => (prev?.id === id ? synced : prev));
    } catch (error) {
      const errorMessage = getMutationErrorMessage(error);
      const failed: WrongQuestionRecord = {
        ...optimistic,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'update',
      };
      await db.wrongQuestions.put(failed);
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId,
          entity: 'wrongQuestion',
          operation: 'update',
          entityId: id,
          payload: { patch },
        }),
      );
      setItems((prev) => prev.map((item) => (item.id === id ? failed : item)));
      setSelected((prev) => (prev?.id === id ? failed : prev));
      showNotice('网络异常，修改已暂存，稍后自动同步');
    }
  };
```

- [ ] **Step 4: Replace `deleteItem` with soft optimistic delete**

Use this implementation:

```ts
  const deleteItem = async (id: string) => {
    const current = items.find((item) => item.id === id);
    if (!current || !userId) return;

    setDeletingId(id);
    const deletingRecord: WrongQuestionRecord = {
      ...current,
      syncStatus: 'pending',
      syncError: undefined,
      pendingOperation: 'delete',
      updatedAt: Date.now(),
    };

    await db.wrongQuestions.put(deletingRecord);
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelected(null);
    setPendingDeleteId(null);

    try {
      await deleteWrongQuestion.mutateAsync(id);
      await db.wrongQuestions.delete(id);
      showNotice(getCrudSuccessMessage('错题', 'delete'), 'danger');
    } catch (error) {
      const errorMessage = getMutationErrorMessage(error);
      await db.wrongQuestions.put({
        ...deletingRecord,
        syncStatus: 'failed',
        syncError: errorMessage,
        pendingOperation: 'delete',
      });
      await enqueueMutationQueueItem(
        createMutationQueueItem({
          userId,
          entity: 'wrongQuestion',
          operation: 'delete',
          entityId: id,
          payload: { id },
        }),
      );
      showNotice('网络异常，删除已暂存，稍后自动同步', 'danger');
    } finally {
      setDeletingId(null);
    }
  };
```

- [ ] **Step 5: Remove status rollback in list card toggle**

In the list card `onToggleStatus`, remove the catch rollback block:

```ts
                    } catch {
                      updateLocalItem(item.id, { status: item.status });
                    }
```

Change it to:

```ts
                    } catch {
                      // updateItem keeps the optimistic value and queues a retry.
                    }
```

- [ ] **Step 6: Add sync status badge**

Inside `WrongQuestionCard`, near the status pill, render:

```tsx
          {item.syncStatus === 'failed' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              待同步
            </span>
          )}
```

- [ ] **Step 7: Run focused checks**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected:

```text
exit code 0
```

- [ ] **Step 8: Commit**

```powershell
git add -- "apps/web/src/app/(main)/error-book/page.tsx"
git commit -m "feat: queue wrong question offline mutations"
```

---

### Task 8: OCRRecord create fallback

**Files:**
- Modify: `apps/web/src/components/providers/ocr-runtime-provider.tsx`

- [ ] **Step 1: Add imports**

Add:

```ts
import {
  createMutationQueueItem,
  enqueueMutationQueueItem,
  getMutationErrorMessage,
} from '@/lib/mutation-queue';
```

- [ ] **Step 2: Queue failed OCRRecord creation**

Replace the current OCRRecord sync catch:

```ts
        } catch (error) {
          logBackgroundSyncError('[OCRRecord sync]', error);
        }
```

with:

```ts
        } catch (error) {
          const errorMessage = getMutationErrorMessage(error);
          persistedResultRecord = {
            ...finalResultRecord,
            syncStatus: 'failed',
            syncError: errorMessage,
            pendingOperation: 'create',
          };
          await enqueueMutationQueueItem(
            createMutationQueueItem({
              userId,
              entity: 'ocrRecord',
              operation: 'create',
              entityId: finalResultRecord.id,
              payload: {
                record: finalResultRecord,
                parsedJson: toOcrParsedPayload(parsed),
              },
            }),
          );
          logBackgroundSyncError('[OCRRecord sync]', error);
        }
```

- [ ] **Step 3: Preserve local sync status in final OCR state**

In the `finalOcr` mapping for `message.id === resultMsgId`, include:

```ts
              syncStatus: persistedResultRecord.syncStatus,
              syncError: persistedResultRecord.syncError,
              pendingOperation: persistedResultRecord.pendingOperation,
```

The full returned object should still preserve image fallback:

```ts
            return {
              ...message,
              id: persistedResultRecord.id,
              content: fullContent,
              imageUrl:
                persistedResultRecord.imageUrl ?? uploadedImageUrl ?? message.imageUrl,
              syncStatus: persistedResultRecord.syncStatus,
              syncError: persistedResultRecord.syncError,
              pendingOperation: persistedResultRecord.pendingOperation,
            };
```

- [ ] **Step 4: Run focused checks**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
bun --filter @repo/web lint
```

Expected:

```text
exit code 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- apps/web/src/components/providers/ocr-runtime-provider.tsx
git commit -m "feat: queue failed ocr record sync"
```

---

### Task 9: Docs and final verification

**Files:**
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `Blog/2026-06-13-phase-2-3-final-stabilization.md`

- [ ] **Step 1: Update data-flow docs**

Add the Phase 2.3 final queue flow:

```text
WrongQuestion / OCRRecord 写操作
  -> 乐观更新 TanStack Query / Dexie
  -> 调用 NestJS API
  -> 成功：服务端返回覆盖本地缓存，syncStatus=synced
  -> 失败：写入 Dexie mutationQueue，业务记录标记 syncStatus=failed
  -> session 恢复 / online / focus 时 flushMutationQueue
  -> 成功后清理 mutationQueue，服务端仍是最终权威来源
```

Clarify ChatMessage boundary:

```text
ChatMessage 不进入通用 mutationQueue，继续使用 /chat-messages/sync 的会话快照幂等同步。
```

- [ ] **Step 2: Update roadmap**

Mark Phase 2.3 queue work complete and move Phase 3 prep to next priority:

```text
- [x] Dexie 离线 mutation 队列与乐观更新层。
- [x] 历史 base64 图片保留为本机预览兜底，不自动静默迁移。
```

- [ ] **Step 3: Update DEVLOG**

Under `2026-06-13`, add one concise grouped section:

```text
**Phase 2.3 Final Stabilization**

- 增加 Dexie mutationQueue，本地记录支持 syncStatus / syncError / pendingOperation。
- WrongQuestion 创建、更新、删除支持乐观写入和失败补偿同步。
- OCRRecord 创建失败会保留本地历史并进入补偿队列。
- session 恢复、online、focus 时自动 flush 本地 mutation queue。
- ChatMessage 继续使用现有幂等快照 sync，不进入 CRUD mutation queue。
- 明确历史 base64 图片只作为本机预览兜底，新图片继续走 MinIO URL。
```

Keep all pending work and planning at the bottom.

- [ ] **Step 4: Update AGENTS and CLAUDE**

Add current status:

```text
Phase 2.3 已完成 Dexie mutation queue 与乐观更新收尾。WrongQuestion / OCRRecord 写操作失败时进入本地补偿队列；ChatMessage 保持幂等快照 sync。
```

- [ ] **Step 5: Update README**

In the current progress section, state:

```text
Phase 2.3：业务 API 迁移与本地缓存工程化收尾完成。
```

- [ ] **Step 6: Write local blog**

Create `Blog/2026-06-13-phase-2-3-final-stabilization.md`.

Use this structure:

```markdown
# 2026-06-13：Phase 2.3 收尾，补齐本地缓存和失败补偿

## 今天完成了什么

## 为什么要做 mutation queue

## WrongQuestion / OCRRecord 的边界

## ChatMessage 为什么不进队列

## 历史图片策略

## 下一步：Phase 3
```

Do not stage `Blog/`.

- [ ] **Step 7: Run full verification**

Run:

```powershell
node --experimental-strip-types apps/web/src/lib/mutation-queue.test.mts
node --experimental-strip-types apps/web/src/lib/mutation-queue-flush.test.mts
node --experimental-strip-types apps/web/src/lib/server-cache-sync.test.mts
node --experimental-strip-types apps/web/src/lib/wrong-question-api.test.mts
node --experimental-strip-types apps/web/src/lib/ocr-record-api.test.mts
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/server test
bun --filter @repo/server test:e2e
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
```

Expected:

```text
all commands exit code 0
```

- [ ] **Step 8: Commit docs**

```powershell
git add -- docs/data-flow.md docs/roadmap.md DEVLOG.md CLAUDE.md AGENTS.md README.md
git commit -m "docs: complete phase 2.3 stabilization notes"
```

- [ ] **Step 9: Confirm ignored files**

Run:

```powershell
git status --short
```

Expected:

```text
clean tracked workspace; Blog/ remains ignored
```

---

## Self-Review

Spec coverage:

- Dexie `mutationQueue` schema: Task 1.
- WrongQuestion optimistic create/update/delete: Tasks 6 and 7.
- OCRRecord create fallback: Task 8.
- ChatMessage boundary: Task 9 documentation, no code queueing.
- Queue flush triggers: Task 4.
- Retry/backoff and error classification: Tasks 2 and 3.
- Server cache authority plus unsynced local preservation: Task 5.
- Historical base64 image strategy: Task 9 documentation and existing API stripping remains unchanged.
- Verification and documentation: Task 9.

Red flag scan:

- This plan does not use unresolved marker text or vague “handle errors” steps.
- Every implementation task names exact files and includes concrete code snippets or exact commands.

Type consistency:

- Queue entity names are `wrongQuestion` and `ocrRecord` across DB, queue helper, and flush helper.
- Queue operations are `create`, `update`, and `delete`.
- Local metadata fields are `syncStatus`, `syncError`, and `pendingOperation` across all affected records.
