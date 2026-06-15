import Dexie, { type Table } from 'dexie';
import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

export type LocalSyncStatus = 'synced' | 'pending' | 'failed';
export type PendingOperation = 'create' | 'update' | 'delete';
export type MutationEntity = 'wrongQuestion' | 'ocrRecord' | 'reviewTask';
export type MutationOperation = 'create' | 'update' | 'delete' | 'rating';
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

export interface StoredMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  order: number;
  createdAt: number;
}

export interface OcrRecord extends LocalSyncMetadata {
  id: string;
  userId: string;
  type: 'user' | 'ocr-loading' | 'ocr-result';
  groupId?: string;
  content: string;
  parsedJson?: OcrParsedPayload | null;
  imageUrl?: string;
  createdAt: number;
}

export type WrongQuestionSource = 'ocr' | 'manual' | 'chat';
export type WrongQuestionStatus = 'unresolved' | 'resolved';

export interface WrongQuestionRecord extends LocalSyncMetadata {
  id: string;
  userId: string;
  source: WrongQuestionSource;
  sourceRecordId?: string;
  sourceGroupId?: string;
  imageUrl?: string;
  questionText: string;
  subject: string;
  category: string;
  knowledgePoints: string[];
  analysis: string;
  answer: string;
  errorType: string;
  userNote: string;
  rawContent: string;
  status: WrongQuestionStatus;
  createdAt: number;
  updatedAt: number;
}

class PrepMindDB extends Dexie {
  messages!: Table<StoredMessage, string>;
  ocrRecords!: Table<OcrRecord, string>;
  wrongQuestions!: Table<WrongQuestionRecord, string>;
  mutationQueue!: Table<MutationQueueItem, string>;
}

export const db = new PrepMindDB('prepmind-db');

function readLegacyOwnerId() {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem('prepmind-user');
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      state?: { currentUser?: { id?: unknown } | null };
    };
    const id = parsed.state?.currentUser?.id;
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

db.version(1).stores({
  messages: 'id, role',
  ocrRecords: 'id, type, createdAt',
});

db.version(2).stores({
  messages: 'id, role, order',
  ocrRecords: 'id, type, createdAt',
});

db.version(3)
  .stores({
    messages: 'id, role, order, createdAt',
    ocrRecords: 'id, type, createdAt',
  })
  .upgrade(async (tx) => {
    // Populate createdAt for existing messages that lack it
    const baseTime = Date.now();
    await tx
      .table('messages')
      .toCollection()
      .modify((msg) => {
        if (!msg.createdAt) {
          msg.createdAt = baseTime - 1000 * (msg.order || 0);
        }
      });
  });

db.version(4).stores({
  messages: 'id, role, order, createdAt',
  ocrRecords: 'id, type, groupId, createdAt',
  wrongQuestions: 'id, source, subject, category, errorType, status, createdAt, updatedAt',
});

db.version(5).stores({
  messages: 'id, role, order, createdAt',
  ocrRecords: 'id, type, groupId, createdAt',
  wrongQuestions:
    'id, source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt',
});

db.version(6)
  .stores({
    messages: 'id, userId, [userId+order], role, order, createdAt',
    ocrRecords: 'id, userId, [userId+createdAt], type, groupId, createdAt',
    wrongQuestions:
      'id, userId, [userId+sourceGroupId], [userId+createdAt], source, sourceGroupId, subject, category, errorType, status, createdAt, updatedAt',
  })
  .upgrade(async (tx) => {
    const legacyOwnerId = readLegacyOwnerId();
    if (!legacyOwnerId) return;

    await Promise.all(
      ['messages', 'ocrRecords', 'wrongQuestions'].map((tableName) =>
        tx
          .table(tableName)
          .toCollection()
          .modify((record) => {
            if (!record.userId) {
              record.userId = legacyOwnerId;
            }
          }),
      ),
    );
  });

db.version(7).stores({
  messages: 'id, userId, [userId+order], role, order, createdAt',
  ocrRecords:
    'id, userId, [userId+createdAt], [userId+pendingOperation], type, groupId, createdAt, syncStatus',
  wrongQuestions:
    'id, userId, [userId+sourceGroupId], [userId+createdAt], [userId+pendingOperation], source, sourceGroupId, subject, category, errorType, status, syncStatus, createdAt, updatedAt',
  mutationQueue:
    '&id, userId, [userId+status], [userId+entity], dedupeKey, nextRetryAt, updatedAt',
});

db.version(8).stores({
  messages: 'id, userId, [userId+order], role, order, createdAt',
  ocrRecords:
    'id, userId, [userId+createdAt], [userId+pendingOperation], type, groupId, createdAt, syncStatus',
  wrongQuestions:
    'id, userId, [userId+sourceGroupId], [userId+createdAt], [userId+pendingOperation], source, sourceGroupId, subject, category, errorType, status, syncStatus, createdAt, updatedAt',
  mutationQueue:
    '&id, userId, [userId+status], [userId+entity], [userId+entity+operation], dedupeKey, nextRetryAt, updatedAt',
});
