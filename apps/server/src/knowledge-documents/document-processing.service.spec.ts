import { Readable } from 'node:stream';

import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { ChunkPersistenceService } from './chunk-persistence.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentProcessingService } from './document-processing.service';
import { EmbeddingService } from './embedding.service';

describe('DocumentProcessingService', () => {
  const now = new Date('2026-06-18T10:00:00.000Z');
  const processedAt = new Date('2026-06-18T10:01:00.000Z');
  const documentRow = {
    id: 'doc_1',
    name: 'notes.txt',
    type: 'TXT',
    size: 12,
    mimeType: 'text/plain',
    storageKey: 'users/user_1/knowledge/notes.txt',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:abc',
    processedAt: null,
    userId: 'user_1',
    createdAt: now,
    updatedAt: now,
    _count: { chunks: 0 },
  };

  const prisma = {
    document: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const storage = {
    readKnowledgeDocumentObject: jest.fn(),
  };
  const parser = {
    parse: jest.fn(),
  };
  const embedding = {
    embedChunks: jest.fn(),
  };
  const persistence = {
    replaceDocumentChunks: jest.fn(),
  };
  const config = {
    get: jest.fn((key: keyof ServerEnv) => {
      const values = {
        RAG_CHUNK_TARGET_TOKENS: 100,
        RAG_CHUNK_OVERLAP_TOKENS: 0,
        RAG_CHUNK_MAX_TOKENS: 200,
      };
      return values[key as keyof typeof values];
    }),
  } as unknown as ConfigService<ServerEnv, true>;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(processedAt);
    prisma.document.findFirst.mockResolvedValue(documentRow);
    prisma.document.updateMany.mockResolvedValue({ count: 1 });
    prisma.document.update.mockImplementation((args: DocumentUpdateArgs) => {
      const data = args.data;
      return Promise.resolve({
        ...documentRow,
        ...data,
        updatedAt: processedAt,
        processedAt: data.processedAt ?? null,
        _count: { chunks: data.status === 'DONE' ? 1 : 0 },
      });
    });
    storage.readKnowledgeDocumentObject.mockResolvedValue({
      stream: Readable.from(['# Algebra\nlinear equations are useful.']),
      contentType: 'text/plain',
    });
    parser.parse.mockResolvedValue({
      text: '# Algebra\nlinear equations are useful.',
      metadata: {
        sourceName: 'notes.txt',
        mimeType: 'text/plain',
        parser: 'txt-basic',
      },
    });
    embedding.embedChunks.mockResolvedValue([[0.1, 0.2, 0.3]]);
    persistence.replaceDocumentChunks.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('processes a pending document through claim, parse, chunk, embed, persist, and done response', async () => {
    const result = await createService().processDocument('user_1', 'doc_1', {
      force: false,
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: 'doc_1', userId: 'user_1' },
      include: { _count: { select: { chunks: true } } },
    });
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'doc_1',
        userId: 'user_1',
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    expect(storage.readKnowledgeDocumentObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/notes.txt',
    );
    expect(parser.parse).toHaveBeenCalledWith({
      name: 'notes.txt',
      type: 'TXT',
      mimeType: 'text/plain',
      buffer: Buffer.from('# Algebra\nlinear equations are useful.'),
    });
    expect(embedding.embedChunks).toHaveBeenCalledWith([
      'linear equations are useful.',
    ]);
    expect(persistence.replaceDocumentChunks).toHaveBeenCalledWith({
      documentId: 'doc_1',
      userId: 'user_1',
      chunks: [
        {
          content: 'linear equations are useful.',
          embedding: [0.1, 0.2, 0.3],
          index: 0,
          tokenCount: 5,
          metadata: {
            sourceName: 'notes.txt',
            mimeType: 'text/plain',
            parser: 'txt-basic',
            documentId: 'doc_1',
            chunkIndex: 0,
            sectionTitle: 'Algebra',
          },
        },
      ],
    });
    expect(prisma.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc_1' },
      data: {
        status: 'DONE',
        errorMessage: null,
        processedAt,
      },
      include: { _count: { select: { chunks: true } } },
    });
    expect(result).toEqual({
      id: 'doc_1',
      name: 'notes.txt',
      type: 'TXT',
      size: 12,
      mimeType: 'text/plain',
      status: 'DONE',
      sourceType: 'UPLOAD',
      errorMessage: null,
      contentHash: 'sha256:abc',
      chunkCount: 1,
      processedAt: processedAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: processedAt.toISOString(),
    });
  });

  it('rejects cross-user or missing documents with 404 before claim', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      createService().processDocument('user_2', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
    expect(storage.readKnowledgeDocumentObject).not.toHaveBeenCalled();
  });

  it('rejects a done document without force', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...documentRow,
      status: 'DONE',
      processedAt,
    });

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_ALREADY_DONE',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('allows a done document with force and includes done in claim statuses', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...documentRow,
      status: 'DONE',
      processedAt,
      _count: { chunks: 1 },
    });

    const result = await createService().processDocument('user_1', 'doc_1', {
      force: true,
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'doc_1',
        userId: 'user_1',
        status: { in: ['PENDING', 'FAILED', 'DONE'] },
      },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    expect(result.status).toBe('DONE');
  });

  it('rejects a processing document', async () => {
    prisma.document.findFirst.mockResolvedValue({
      ...documentRow,
      status: 'PROCESSING',
    });

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PROCESSING',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when the conditional claim does not update exactly one row', async () => {
    prisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PROCESSING',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(storage.readKnowledgeDocumentObject).not.toHaveBeenCalled();
  });

  it('marks failed with a generic message and rethrows non-AppError failures after claim', async () => {
    const failure = new Error('provider unavailable');
    embedding.embedChunks.mockRejectedValue(failure);

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toBe(failure);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc_1' },
      data: {
        status: 'FAILED',
        errorMessage: '资料处理失败，请稍后重试',
      },
      include: { _count: { select: { chunks: true } } },
    });
  });

  it('marks failed with AppError message and rethrows storage read failures after claim', async () => {
    const failure = new AppError(
      'KNOWLEDGE_DOCUMENT_READ_FAILED',
      '无法读取资料文件',
      HttpStatus.BAD_GATEWAY,
    );
    storage.readKnowledgeDocumentObject.mockRejectedValue(failure);

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toBe(failure);

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc_1' },
      data: {
        status: 'FAILED',
        errorMessage: '无法读取资料文件',
      },
      include: { _count: { select: { chunks: true } } },
    });
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('rethrows the original failure if marking failed also errors', async () => {
    const failure = new Error('provider unavailable');
    const markFailedError = new Error('database unavailable');
    embedding.embedChunks.mockRejectedValue(failure);
    prisma.document.update.mockRejectedValueOnce(markFailedError);

    await expect(
      createService().processDocument('user_1', 'doc_1', { force: false }),
    ).rejects.toBe(failure);
  });

  function createService() {
    return new DocumentProcessingService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      parser as unknown as DocumentParserService,
      embedding as unknown as EmbeddingService,
      persistence as unknown as ChunkPersistenceService,
      config,
    );
  }
});

type DocumentUpdateArgs = {
  data: {
    status?: string;
    errorMessage?: string | null;
    processedAt?: Date | null;
  };
};
