import { describe, expect, it } from 'bun:test';

import {
  assertEmbeddingBatchDimensions,
  assertEmbeddingDimensions,
  splitDocument,
  tokenizeApprox,
} from '../src/index';

describe('splitDocument', () => {
  it('keeps a short document as a single chunk with metadata and content', () => {
    const chunks = splitDocument({
      documentId: 'doc_1',
      sourceName: 'notes.md',
      text: '# Green theorem\n\nGreen theorem converts a line integral into a double integral.',
      metadata: { parser: 'markdown-basic' },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      content: 'Green theorem converts a line integral into a double integral.',
      metadata: {
        documentId: 'doc_1',
        sourceName: 'notes.md',
        chunkIndex: 0,
        parser: 'markdown-basic',
        sectionTitle: 'Green theorem',
      },
    });
    expect(chunks[0]).not.toHaveProperty('text');
    expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
  });

  it('splits long text and keeps bounded overlap', () => {
    const text = Array.from(
      { length: 80 },
      (_, index) => `Paragraph ${index} content is used to test chunking.`,
    ).join('\n\n');
    const chunks = splitDocument(
      {
        documentId: 'doc_2',
        sourceName: 'long.txt',
        text,
      },
      { targetTokens: 80, overlapTokens: 12, maxTokens: 120 },
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenCount <= 120)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual(
      chunks.map((_, index) => index),
    );
  });

  it('flushes chunks at section transitions before applying new section metadata', () => {
    const chunks = splitDocument(
      {
        documentId: 'doc_sections',
        sourceName: 'sections.md',
        text: '# A\n\nA first paragraph.\n\nA second paragraph.\n\n# B\n\nB first paragraph.',
      },
      { targetTokens: 100, overlapTokens: 10, maxTokens: 120 },
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toContain('A first paragraph.');
    expect(chunks[0]?.content).not.toContain('B first paragraph.');
    expect(chunks[0]?.metadata.sectionTitle).toBe('A');
    expect(chunks[1]?.content).toBe('B first paragraph.');
    expect(chunks[1]?.metadata.sectionTitle).toBe('B');
  });

  it('detects markdown headings without requiring blank lines after headings', () => {
    const chunks = splitDocument(
      {
        documentId: 'doc_inline_headings',
        sourceName: 'inline-headings.md',
        text: '# A\nA first paragraph.\n\n# B\nB first paragraph.',
      },
      { targetTokens: 100, overlapTokens: 10, maxTokens: 120 },
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      content: 'A first paragraph.',
      metadata: { sectionTitle: 'A' },
    });
    expect(chunks[1]).toMatchObject({
      content: 'B first paragraph.',
      metadata: { sectionTitle: 'B' },
    });
    expect(chunks.map((chunk) => chunk.content).join('\n')).not.toContain('# ');
  });

  it('rejects unsafe overlap that is at least half the target size', () => {
    expect(() =>
      splitDocument(
        {
          documentId: 'doc_overlap',
          sourceName: 'overlap.txt',
          text: 'content',
        },
        { targetTokens: 80, overlapTokens: 40, maxTokens: 120 },
      ),
    ).toThrow('overlapTokens must be less than half of targetTokens');
  });
});

describe('embedding helpers', () => {
  it('estimates token count for chinese and english text', () => {
    expect(tokenizeApprox('\u683c\u6797\u516c\u5f0f Green theorem')).toBeGreaterThanOrEqual(4);
  });

  it('throws when vector dimensions do not match', () => {
    expect(() => assertEmbeddingDimensions([0.1, 0.2], 3)).toThrow(
      'Expected embedding dimension 3 but received 2',
    );
  });

  it('throws when embedding vectors contain non-finite values', () => {
    expect(() => assertEmbeddingDimensions([0.1, Number.NaN], 2)).toThrow(
      'Embedding vector contains a non-finite value at index 1',
    );
  });

  it('throws when embedding batch count does not match', () => {
    expect(() => assertEmbeddingBatchDimensions([[0.1, 0.2]], 2, 2)).toThrow(
      'Expected 2 embeddings but received 1',
    );
  });

  it('throws when embedding batch dimensions do not match', () => {
    expect(() =>
      assertEmbeddingBatchDimensions(
        [
          [0.1, 0.2],
          [0.3],
        ],
        2,
        2,
      ),
    ).toThrow('Expected embedding dimension 2 but received 1');
  });
});
