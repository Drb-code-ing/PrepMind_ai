import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  KnowledgeDocumentProcessResponse,
  KnowledgeDocumentResponse,
  KnowledgeDocumentStatus,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';
import type { BackgroundJobResponse } from '@repo/types/api/background-job';

import {
  KNOWLEDGE_PAGE_SEARCH_MIN_SCORE,
  formatKnowledgeDateTime,
  formatKnowledgeFileSize,
  getKnowledgeBackgroundJobStatusMeta,
  getKnowledgeDocumentAction,
  getKnowledgeDocumentStatusMeta,
  getKnowledgeProcessSuccessMessage,
  getKnowledgeSearchHitSummary,
  groupLatestKnowledgeJobsByDocumentId,
  shouldCloseKnowledgeDocumentMenuOnPointerDown,
} from './knowledge-view.ts';

describe('formatKnowledgeFileSize', () => {
  it('formats bytes, kilobytes, and megabytes for knowledge documents', () => {
    assert.equal(formatKnowledgeFileSize(0), '0 B');
    assert.equal(formatKnowledgeFileSize(512), '512 B');
    assert.equal(formatKnowledgeFileSize(2048), '2 KB');
    assert.equal(formatKnowledgeFileSize(2_621_440), '2.5 MB');
  });
});

describe('KNOWLEDGE_PAGE_SEARCH_MIN_SCORE', () => {
  it('keeps manual knowledge search preview more forgiving than Chat RAG injection', () => {
    assert.equal(KNOWLEDGE_PAGE_SEARCH_MIN_SCORE, 0.4);
  });
});

describe('getKnowledgeDocumentStatusMeta', () => {
  it('returns stable labels for each document processing status', () => {
    const expected: Array<[KnowledgeDocumentStatus, string]> = [
      ['PENDING', '待处理'],
      ['PROCESSING', '处理中'],
      ['DONE', '已入库'],
      ['FAILED', '处理失败'],
    ];

    for (const [status, label] of expected) {
      assert.equal(getKnowledgeDocumentStatusMeta(status).label, label);
      assert.equal(typeof getKnowledgeDocumentStatusMeta(status).className, 'string');
    }
  });
});

describe('getKnowledgeDocumentAction', () => {
  it('returns the correct process action for each document status', () => {
    assert.deepEqual(getKnowledgeDocumentAction('PENDING'), {
      label: '开始处理',
      force: false,
      disabled: false,
    });
    assert.deepEqual(getKnowledgeDocumentAction('PROCESSING'), {
      label: '处理中',
      force: false,
      disabled: true,
    });
    assert.deepEqual(getKnowledgeDocumentAction('DONE'), {
      label: '已入库',
      force: false,
      disabled: true,
    });
    assert.deepEqual(getKnowledgeDocumentAction('FAILED'), {
      label: '重新处理',
      force: true,
      disabled: false,
    });
  });
});

describe('getKnowledgeBackgroundJobStatusMeta', () => {
  it('returns compact labels for visible processing job statuses', () => {
    assert.equal(getKnowledgeBackgroundJobStatusMeta('QUEUED')?.label, '排队中');
    assert.equal(getKnowledgeBackgroundJobStatusMeta('ACTIVE')?.label, '处理中');
    assert.equal(getKnowledgeBackgroundJobStatusMeta('FAILED')?.label, '处理失败');
    assert.equal(getKnowledgeBackgroundJobStatusMeta('STALE_SKIPPED')?.label, '旧任务已跳过');
    assert.equal(getKnowledgeBackgroundJobStatusMeta('SUCCEEDED'), null);
  });
});

describe('getKnowledgeProcessSuccessMessage', () => {
  it('describes queued processing without claiming completion', () => {
    assert.equal(
      getKnowledgeProcessSuccessMessage(
        createDocument({ name: 'notes.md' }),
        createProcessResponse({
          status: 'PROCESSING',
          processing: {
            mode: 'queue',
            backgroundJobId: 'job_1',
            status: 'QUEUED',
            queuedAt: '2026-06-29T00:00:00.000Z',
          },
        }),
      ),
      '《notes.md》已进入后台处理队列。',
    );
  });

  it('describes inline completion with the chunk count', () => {
    assert.equal(
      getKnowledgeProcessSuccessMessage(
        createDocument({ name: 'notes.md' }),
        createProcessResponse({ status: 'DONE', chunkCount: 3 }),
      ),
      '《notes.md》处理完成，当前 3 个片段。',
    );
  });
});

describe('groupLatestKnowledgeJobsByDocumentId', () => {
  it('keeps the newest job for each knowledge document', () => {
    const grouped = groupLatestKnowledgeJobsByDocumentId([
      createBackgroundJob({
        id: 'older',
        resourceId: 'doc_1',
        updatedAt: '2026-06-29T00:00:00.000Z',
      }),
      createBackgroundJob({
        id: 'newer',
        resourceId: 'doc_1',
        updatedAt: '2026-06-29T00:00:02.000Z',
      }),
    ]);

    assert.equal(grouped.get('doc_1')?.id, 'newer');
  });
});

describe('shouldCloseKnowledgeDocumentMenuOnPointerDown', () => {
  it('closes only when an open document menu receives an outside pointer down', () => {
    assert.equal(
      shouldCloseKnowledgeDocumentMenuOnPointerDown({
        menuOpen: true,
        pointerDownInsideMenuRoot: false,
      }),
      true,
    );
    assert.equal(
      shouldCloseKnowledgeDocumentMenuOnPointerDown({
        menuOpen: true,
        pointerDownInsideMenuRoot: true,
      }),
      false,
    );
    assert.equal(
      shouldCloseKnowledgeDocumentMenuOnPointerDown({
        menuOpen: false,
        pointerDownInsideMenuRoot: false,
      }),
      false,
    );
  });
});

describe('getKnowledgeSearchHitSummary', () => {
  it('summarizes the document name, chunk index, and rounded score', () => {
    const hit: KnowledgeSearchHit = {
      chunkId: 'chunk_1',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Green theorem reference',
      score: 0.856,
      metadata: { chunkIndex: 3 },
    };

    assert.equal(
      getKnowledgeSearchHitSummary(hit),
      '《calculus.md》 · 片段 3 · 相似度 0.86',
    );
  });

  it('uses a placeholder when the chunk index is missing', () => {
    const hit: KnowledgeSearchHit = {
      chunkId: 'chunk_2',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Another reference',
      score: 0.8,
      metadata: {},
    };

    assert.equal(
      getKnowledgeSearchHitSummary(hit),
      '《calculus.md》 · 片段 ? · 相似度 0.80',
    );
  });
});

describe('formatKnowledgeDateTime', () => {
  it('formats missing and present timestamps for document metadata', () => {
    assert.equal(formatKnowledgeDateTime(null), '未处理');
    assert.match(formatKnowledgeDateTime('2026-06-19T08:30:00.000Z'), /\d{2}\/\d{2}/);
  });
});

function createDocument(input: Partial<KnowledgeDocumentResponse> = {}): KnowledgeDocumentResponse {
  return {
    id: 'doc_1',
    name: 'calculus.md',
    type: 'MD',
    size: 1024,
    mimeType: 'text/markdown',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'hash_1',
    chunkCount: 0,
    processedAt: null,
    createdAt: '2026-06-19T08:00:00.000Z',
    updatedAt: '2026-06-19T08:00:00.000Z',
    ...input,
  };
}

function createProcessResponse(
  input: Partial<KnowledgeDocumentProcessResponse> = {},
): KnowledgeDocumentProcessResponse {
  return {
    ...createDocument(),
    ...input,
  };
}

function createBackgroundJob(input: Partial<BackgroundJobResponse> = {}): BackgroundJobResponse {
  return {
    id: 'job_1',
    queueName: 'knowledge-document-processing',
    jobName: 'process-document',
    status: 'ACTIVE',
    resourceType: 'KNOWLEDGE_DOCUMENT',
    resourceId: 'doc_1',
    attempt: 1,
    maxAttempts: 3,
    progress: 0,
    payloadPreview: { documentId: 'doc_1' },
    resultSummary: null,
    errorCode: null,
    errorMessage: null,
    requestedAt: '2026-06-29T00:00:00.000Z',
    startedAt: '2026-06-29T00:00:01.000Z',
    finishedAt: null,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:01.000Z',
    ...input,
  };
}
