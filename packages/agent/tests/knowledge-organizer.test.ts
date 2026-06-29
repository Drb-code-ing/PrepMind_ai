import { describe, expect, it } from 'bun:test';

import { organizeKnowledgeDocuments } from '../src/nodes/knowledge-organizer';

const now = '2026-06-29T00:00:00.000Z';

describe('organizeKnowledgeDocuments', () => {
  it('groups same subject documents into a collection', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [
        document('doc_1', '高等数学 导数讲义.pdf', ['导数、极限、函数']),
        document('doc_2', '高等数学 导数练习.pdf', ['导数应用题']),
      ],
    });

    expect(result.collections[0]?.name).toBe('数学资料');
    expect(result.collections[0]?.documentIds).toEqual(['doc_1', 'doc_2']);
    expect(result.tags[0]?.labels).toContain('数学');
  });

  it('returns document tags even when there is no collection', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [document('doc_1', '大学英语 阅读笔记.md', ['reading comprehension'])],
    });

    expect(result.collections).toEqual([]);
    expect(result.tags[0]?.labels).toContain('英语');
    expect(result.tags[0]?.labels).toContain('笔记');
  });

  it('returns insufficient summary when there are no documents', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [],
    });

    expect(result.collections).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(result.signals).toContain('insufficientSignal');
  });

  it('does not invent tags for unknown documents without useful signals', () => {
    const result = organizeKnowledgeDocuments({
      now,
      documents: [document('doc_1', 'random.pdf', [])],
    });

    expect(result.tags).toEqual([]);
    expect(result.signals).toContain('insufficientSignal');
  });

  it('exports organizer policy from package root and subpath', async () => {
    const rootModule = await import('../src/index');
    const subpathModule = await import('../src/nodes/knowledge-organizer');

    expect(rootModule.organizeKnowledgeDocuments).toBe(organizeKnowledgeDocuments);
    expect(subpathModule.knowledgeOrganizerNode).toBe(organizeKnowledgeDocuments);
  });
});

function document(id: string, name: string, chunkSummaries: string[]) {
  return {
    id,
    name,
    type: 'PDF' as const,
    size: 1024,
    status: 'DONE' as const,
    sourceType: 'UPLOAD' as const,
    contentHash: `sha256:${id}`,
    chunkCount: chunkSummaries.length,
    processedAt: now,
    createdAt: now,
    updatedAt: now,
    chunkSummaries,
  };
}
