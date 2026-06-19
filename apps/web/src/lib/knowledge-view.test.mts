import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  KnowledgeDocumentStatus,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';

import {
  formatKnowledgeDateTime,
  formatKnowledgeFileSize,
  getKnowledgeDocumentAction,
  getKnowledgeDocumentStatusMeta,
  getKnowledgeSearchHitSummary,
} from './knowledge-view.ts';

describe('formatKnowledgeFileSize', () => {
  it('formats bytes, kilobytes, and megabytes for knowledge documents', () => {
    assert.equal(formatKnowledgeFileSize(0), '0 B');
    assert.equal(formatKnowledgeFileSize(512), '512 B');
    assert.equal(formatKnowledgeFileSize(2048), '2 KB');
    assert.equal(formatKnowledgeFileSize(2_621_440), '2.5 MB');
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
      label: '重新处理',
      force: true,
      disabled: false,
    });
    assert.deepEqual(getKnowledgeDocumentAction('FAILED'), {
      label: '重新处理',
      force: true,
      disabled: false,
    });
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
