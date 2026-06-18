import { describe, expect, it } from 'bun:test';

import {
  assertEmbeddingDimensions,
  splitDocument,
  tokenizeApprox,
} from '../src/index';

describe('splitDocument', () => {
  it('keeps a short document as a single chunk with metadata', () => {
    const chunks = splitDocument({
      documentId: 'doc_1',
      sourceName: 'notes.md',
      text: '# 格林公式\n\n格林公式可以把闭曲线积分转化为二重积分。',
      metadata: { parser: 'markdown-basic' },
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      index: 0,
      metadata: {
        documentId: 'doc_1',
        sourceName: 'notes.md',
        chunkIndex: 0,
        parser: 'markdown-basic',
        sectionTitle: '格林公式',
      },
    });
    expect(chunks[0]?.tokenCount).toBeGreaterThan(0);
  });

  it('splits long text and keeps bounded overlap', () => {
    const text = Array.from({ length: 80 }, (_, index) => `第${index}段内容用于测试分块。`)
      .join('\n\n');
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
});

describe('embedding helpers', () => {
  it('estimates token count for chinese and english text', () => {
    expect(tokenizeApprox('格林公式 Green theorem')).toBeGreaterThanOrEqual(4);
  });

  it('throws when vector dimensions do not match', () => {
    expect(() => assertEmbeddingDimensions([0.1, 0.2], 3)).toThrow(
      'Expected embedding dimension 3 but received 2',
    );
  });
});
