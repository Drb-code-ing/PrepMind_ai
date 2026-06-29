import { describe, expect, it } from 'bun:test';

import { analyzeKnowledgeDedup } from '../src/nodes/knowledge-dedup';

const now = '2026-06-29T00:00:00.000Z';

describe('analyzeKnowledgeDedup', () => {
  it('detects exact duplicate documents by content hash', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [
        document('doc_1', '高数讲义.pdf', 'PDF', 'sha256:same'),
        document('doc_2', '高数讲义 copy.pdf', 'PDF', 'sha256:same'),
      ],
    });

    expect(result.items[0]?.kind).toBe('exact_duplicate');
    expect(result.items[0]?.recommendation).toBe('use_existing');
    expect(result.items[0]?.documentIds).toEqual(['doc_1', 'doc_2']);
  });

  it('detects possible revisions by normalized filename and different hash', () => {
    const result = analyzeKnowledgeDedup({
      now,
      targetDocumentId: 'doc_2',
      documents: [
        document('doc_1', '线性代数讲义-v1.pdf', 'PDF', 'sha256:old'),
        document('doc_2', '线性代数讲义-v2.pdf', 'PDF', 'sha256:new'),
      ],
    });

    expect(result.items[0]?.kind).toBe('possible_revision');
    expect(result.items[0]?.documentIds).toEqual(['doc_2', 'doc_1']);
    expect(result.items[0]?.signals).toContain('filenameOverlap');
  });

  it('scopes pair suggestions to the target document when provided', () => {
    const result = analyzeKnowledgeDedup({
      now,
      targetDocumentId: 'doc_target',
      documents: [
        document('doc_a', '概率论讲义-v1.pdf', 'PDF', 'sha256:a'),
        document('doc_b', '概率论讲义-v2.pdf', 'PDF', 'sha256:b'),
        document('doc_target', '大学英语阅读笔记.md', 'MD', 'sha256:c'),
      ],
    });

    expect(result.items.every((item) => item.documentIds.includes('doc_target'))).toBe(
      true,
    );
  });

  it('does not treat yearly exam papers as revisions just because numbers differ', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [
        document('doc_2025', '考研数学真题2025.pdf', 'PDF', 'sha256:2025'),
        document('doc_2026', '考研数学真题2026.pdf', 'PDF', 'sha256:2026'),
      ],
    });

    expect(result.items.some((item) => item.kind === 'possible_revision')).toBe(false);
  });

  it('marks same-topic different documents as complementary', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [
        document('doc_1', '考研数学 极限讲义.pdf', 'PDF', 'sha256:a'),
        document('doc_2', '考研数学 极限练习题.pdf', 'PDF', 'sha256:b'),
      ],
    });

    expect(result.items.some((item) => item.kind === 'complementary')).toBe(true);
  });

  it('returns insufficient signal when there are too few usable documents', () => {
    const result = analyzeKnowledgeDedup({
      now,
      documents: [document('doc_1', '资料.pdf', 'PDF', null)],
    });

    expect(result.items[0]?.kind).toBe('insufficient_signal');
    expect(result.signals).toContain('insufficientSignal');
  });

  it('exports dedup policy from package root and subpath', async () => {
    const rootModule = await import('../src/index');
    const subpathModule = await import('../src/nodes/knowledge-dedup');

    expect(rootModule.analyzeKnowledgeDedup).toBe(analyzeKnowledgeDedup);
    expect(subpathModule.knowledgeDedupNode).toBe(analyzeKnowledgeDedup);
  });
});

function document(
  id: string,
  name: string,
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT',
  contentHash: string | null,
) {
  return {
    id,
    name,
    type,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash,
    chunkCount: 3,
    processedAt: now,
    createdAt: now,
    updatedAt: now,
    chunkSummaries: [],
  };
}
