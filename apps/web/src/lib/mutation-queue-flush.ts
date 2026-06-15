import type { OcrParsedPayload } from '@repo/types/api/ocr-record';

import { ApiClientError, apiClient } from './api-client.ts';
import type { MutationQueueItem, OcrRecord, WrongQuestionRecord } from './db.ts';
import { db } from './db.ts';
import {
  getMutationErrorMessage,
  getNextRetryAt,
  shouldAttemptMutation,
} from './mutation-queue.ts';
import { createOcrRecordApi } from './ocr-record-api.ts';
import {
  createWrongQuestionApi,
  type UpdateLocalWrongQuestionRequest,
} from './wrong-question-api.ts';
import { createReviewTaskApi } from './review-task-api.ts';
import { readReviewTaskRatingPayload } from './review-task-offline.ts';

type WrongQuestionCreatePayload = { record: WrongQuestionRecord };
type WrongQuestionUpdatePayload = { patch: UpdateLocalWrongQuestionRequest };
type WrongQuestionDeletePayload = { id: string };
type OcrRecordCreatePayload = { record: OcrRecord; parsedJson: OcrParsedPayload };
type OcrRecordDeletePayload = { id: string };

type MutationApis = {
  wrongQuestions: Pick<
    ReturnType<typeof createWrongQuestionApi>,
    'create' | 'update' | 'delete'
  >;
  ocrRecords: Pick<ReturnType<typeof createOcrRecordApi>, 'create' | 'delete'>;
  reviewTasks: Pick<ReturnType<typeof createReviewTaskApi>, 'submitRating'>;
};

export type FlushMutationQueueSummary = {
  successCount: number;
  retryCount: number;
  terminalCount: number;
  reviewRatingSuccessCount: number;
};

type FlushResult =
  | { outcome: 'success'; record?: unknown }
  | { outcome: 'retry'; error: string }
  | { outcome: 'terminal'; reason: string; error: string };

const defaultApis: MutationApis = {
  wrongQuestions: createWrongQuestionApi(apiClient),
  ocrRecords: createOcrRecordApi(apiClient),
  reviewTasks: createReviewTaskApi(apiClient),
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

    if (item.entity === 'reviewTask') {
      const record = await flushReviewTaskItem(item, accessToken, apis);
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
}): Promise<FlushMutationQueueSummary> {
  const summary: FlushMutationQueueSummary = {
    successCount: 0,
    retryCount: 0,
    terminalCount: 0,
    reviewRatingSuccessCount: 0,
  };
  const pending = await db.mutationQueue.where('userId').equals(userId).toArray();
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
      summary.successCount += 1;
      if (item.entity === 'reviewTask' && item.operation === 'rating') {
        summary.reviewRatingSuccessCount += 1;
      }
      continue;
    }

    const retryCount = item.retryCount + 1;
    const nextRetryAt =
      result.outcome === 'retry' ? getNextRetryAt(retryCount, new Date()) : undefined;

    if (result.outcome === 'retry') {
      summary.retryCount += 1;
    } else {
      summary.terminalCount += 1;
    }

    await db.mutationQueue.update(item.id, {
      status: 'failed',
      retryCount,
      lastError: result.error,
      nextRetryAt,
      updatedAt: new Date().toISOString(),
    });
  }

  return summary;
}

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

  if (item.operation !== 'delete') {
    throw new ApiClientError('Unsupported wrong question mutation operation', {
      status: 400,
      code: 'UNSUPPORTED_WRONG_QUESTION_MUTATION',
    });
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

  if (item.operation !== 'delete') {
    throw new ApiClientError('Unsupported OCR record mutation operation', {
      status: 400,
      code: 'UNSUPPORTED_OCR_RECORD_MUTATION',
    });
  }

  const payload = item.payload as OcrRecordDeletePayload;
  await apis.ocrRecords.delete(accessToken, payload.id);
  return undefined;
}

async function flushReviewTaskItem(
  item: MutationQueueItem,
  accessToken: string,
  apis: MutationApis,
) {
  if (item.operation !== 'rating') {
    throw new ApiClientError('Unsupported review task mutation operation', {
      status: 400,
      code: 'UNSUPPORTED_REVIEW_TASK_MUTATION',
    });
  }

  const payload = readReviewTaskRatingPayload(item.payload);
  return apis.reviewTasks.submitRating(accessToken, payload.taskId, payload.request);
}

async function applyFlushSuccess(item: MutationQueueItem, record?: unknown) {
  await db.mutationQueue.delete(item.id);

  if (item.entity === 'reviewTask') {
    return;
  }

  if (item.entity === 'wrongQuestion') {
    if (item.operation === 'delete') {
      const payload = item.payload as WrongQuestionDeletePayload;
      await db.wrongQuestions.delete(item.entityId ?? payload.id);
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
    const payload = item.payload as OcrRecordDeletePayload;
    await db.ocrRecords.delete(item.entityId ?? payload.id);
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
