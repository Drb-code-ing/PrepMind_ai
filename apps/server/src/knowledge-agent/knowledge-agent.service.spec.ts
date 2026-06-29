import { PrismaService } from '../database/prisma.service';
import { KnowledgeAgentService } from './knowledge-agent.service';

describe('KnowledgeAgentService', () => {
  const now = new Date('2026-06-29T08:00:00.000Z');
  const prisma = {
    document: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    chunk: {
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.document.findFirst.mockResolvedValue(createDocument('doc_1'));
    prisma.document.findMany.mockResolvedValue([
      createDocument('doc_1', {
        name: '高等数学 导数讲义.pdf',
        contentHash: 'sha256:a',
        chunks: [
          {
            content: '导数 极限 函数'.repeat(30),
            index: 0,
          },
        ],
        chunkCount: 5,
      }),
      createDocument('doc_2', {
        name: '高等数学 导数练习.pdf',
        contentHash: 'sha256:b',
        chunks: [{ content: '导数应用题', index: 0 }],
        chunkCount: 1,
      }),
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new KnowledgeAgentService(prisma as unknown as PrismaService);
  }

  it('builds read-only suggestions from current user documents and capped chunk summaries', async () => {
    const result = await createService().getSuggestions('user_1', { limit: 20 });

    expect(prisma.document.findFirst).not.toHaveBeenCalled();
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        status: true,
        sourceType: true,
        contentHash: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
        chunks: {
          where: { userId: 'user_1' },
          select: { content: true, index: true },
          orderBy: { index: 'asc' },
          take: 3,
        },
        _count: { select: { chunks: { where: { userId: 'user_1' } } } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.organizer.collections[0]?.name).toBe('数学资料');
    expect(result.organizer.tags[0]?.labels).toContain('数学');
    expect(result.dedup.items.some((item) => item.kind === 'complementary')).toBe(
      true,
    );
    expect(result.dedup.items[0]?.reason.length).toBeGreaterThan(0);
  });

  it('scopes targeted suggestions to an owned target document', async () => {
    prisma.document.findFirst.mockResolvedValueOnce(createDocument('doc_2'));

    const result = await createService().getSuggestions('user_1', {
      documentId: 'doc_2',
      limit: 20,
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc_2', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1' },
        take: 20,
      }),
    );
    for (const item of result.dedup.items) {
      expect(item.documentIds).toContain('doc_2');
    }
  });

  it('keeps the target document in policy input when it is outside the recent limit', async () => {
    prisma.document.findFirst
      .mockResolvedValueOnce({ id: 'doc_old' })
      .mockResolvedValueOnce(
        createDocument('doc_old', {
          name: '高等数学 导数讲义.pdf',
          contentHash: 'sha256:old',
          chunks: [{ content: '导数 极限', index: 0 }],
        }),
      );
    prisma.document.findMany.mockResolvedValueOnce([
      createDocument('doc_recent', {
        name: '高等数学 导数练习.pdf',
        contentHash: 'sha256:recent',
        chunks: [{ content: '导数应用题', index: 0 }],
      }),
    ]);

    const result = await createService().getSuggestions('user_1', {
      documentId: 'doc_old',
      limit: 1,
    });

    expect(prisma.document.findFirst).toHaveBeenNthCalledWith(2, {
      where: { id: 'doc_old', userId: 'user_1' },
      select: {
        id: true,
        name: true,
        type: true,
        size: true,
        status: true,
        sourceType: true,
        contentHash: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
        chunks: {
          where: { userId: 'user_1' },
          select: { content: true, index: true },
          orderBy: { index: 'asc' },
          take: 3,
        },
        _count: { select: { chunks: { where: { userId: 'user_1' } } } },
      },
    });
    for (const item of result.dedup.items) {
      expect(item.documentIds).toContain('doc_old');
    }
  });

  it('throws not found for a missing or non-owned target document', async () => {
    prisma.document.findFirst.mockResolvedValueOnce(null);

    await expect(
      createService().getSuggestions('user_1', {
        documentId: 'doc_other',
        limit: 20,
      }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });

    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });

  it('does not write documents or chunks while generating advice', async () => {
    await createService().getSuggestions('user_1', { limit: 20 });

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(prisma.document.delete).not.toHaveBeenCalled();
    expect(prisma.document.deleteMany).not.toHaveBeenCalled();
    expect(prisma.chunk.create).not.toHaveBeenCalled();
    expect(prisma.chunk.createMany).not.toHaveBeenCalled();
    expect(prisma.chunk.update).not.toHaveBeenCalled();
    expect(prisma.chunk.updateMany).not.toHaveBeenCalled();
    expect(prisma.chunk.delete).not.toHaveBeenCalled();
    expect(prisma.chunk.deleteMany).not.toHaveBeenCalled();
  });
});

function createDocument(
  id: string,
  overrides: Partial<DocumentRecord> & { chunkCount?: number } = {},
): DocumentRecord {
  const createdAt = new Date('2026-06-28T00:00:00.000Z');
  const chunkCount = overrides.chunkCount ?? overrides.chunks?.length ?? 1;
  return {
    id,
    name: '高等数学 导数讲义.pdf',
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: 'sha256:a',
    processedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    chunks: [{ content: '导数 极限 函数', index: 0 }],
    _count: { chunks: chunkCount },
    ...overrides,
  };
}

type DocumentRecord = {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  sourceType: 'UPLOAD' | 'NOTE' | 'WRONG_QUESTION' | 'OCR' | 'CHAT';
  contentHash: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chunks: { content: string; index: number }[];
  _count: { chunks: number };
};
