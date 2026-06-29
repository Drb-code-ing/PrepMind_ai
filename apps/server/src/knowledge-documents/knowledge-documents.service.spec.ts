import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

type DocumentCreateArgs = {
  data: {
    userId: string;
    name: string;
    type: string;
    size: number;
    mimeType: string;
    storageKey: string;
    status: string;
    sourceType: string;
    contentHash: string;
  };
  include: { _count: { select: { chunks: boolean } } };
};

type DocumentUpdateArgs = {
  where: { id: string };
  data: {
    name: string;
    type: string;
    size: number;
    mimeType: string;
    storageKey: string;
    status: string;
    errorMessage: string | null;
    processedAt: Date | null;
    contentHash: string;
  };
  include: { _count: { select: { chunks: boolean } } };
};

type DocumentUpdateManyArgs = {
  where: {
    id: string;
    userId: string;
    status: string;
    updatedAt: Date;
    storageKey: string;
    contentHash: string | null;
  };
  data: DocumentUpdateArgs['data'];
};

type DocumentFindFirstArgs = {
  where: { id: string; userId: string };
  include: { _count: { select: { chunks: boolean } } };
};

type DeleteManyArgs = {
  where: { documentId: string; userId: string };
};

type DocumentTransactionClient = {
  chunk: { deleteMany: (args: DeleteManyArgs) => Promise<unknown> };
  document: {
    update: (args: DocumentUpdateArgs) => Promise<unknown>;
    updateMany: (args: DocumentUpdateManyArgs) => Promise<{ count: number }>;
    findFirst: (args: DocumentFindFirstArgs) => Promise<unknown>;
  };
};

describe('KnowledgeDocumentsService', () => {
  const now = new Date('2026-06-18T10:00:00.000Z');
  const documentRow = {
    id: 'doc_1',
    name: 'calculus.pdf',
    type: 'PDF',
    size: 3,
    mimeType: 'application/pdf',
    storageKey: 'users/user_1/knowledge/doc.pdf',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'sha256:49f68a5c8493ec2c0bf489821c21fc3b',
    processedAt: null,
    userId: 'user_1',
    createdAt: now,
    updatedAt: now,
    _count: { chunks: 0 },
  };
  const prisma = {
    document: {
      create: jest.fn<Promise<typeof documentRow>, [DocumentCreateArgs]>(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      update: jest.fn<Promise<typeof documentRow>, [DocumentUpdateArgs]>(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [DocumentUpdateManyArgs]
      >(),
      delete: jest.fn(),
    },
    chunk: {
      deleteMany: jest.fn<Promise<unknown>, [DeleteManyArgs]>(),
    },
    $transaction: jest.fn<
      Promise<unknown>,
      [
        (
          callback: (
            transaction: DocumentTransactionClient,
          ) => Promise<unknown>,
        ) => Promise<unknown>,
      ]
    >(),
  };
  const storage = {
    uploadKnowledgeDocument: jest.fn(),
    deleteObject: jest.fn(),
  };
  const createPrismaKnownRequestError = (code: string, target: string[]) => ({
    code,
    clientVersion: 'test',
    meta: { target },
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createService() {
    return new KnowledgeDocumentsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  }

  it('uploads a document and creates a pending row', async () => {
    const file = {
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
      size: 3,
      originalname: 'calculus.pdf',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/doc.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus.pdf',
    });
    prisma.document.create.mockResolvedValue(documentRow);

    const result = await createService().createUploadDocument('user_1', file);

    const createCall = prisma.document.create.mock.calls[0]?.[0];
    expect(createCall).toBeDefined();
    if (!createCall) {
      throw new Error('Expected document.create to be called');
    }
    expect(createCall.data.contentHash).toMatch(/^sha256:/);
    expect(createCall).toEqual({
      data: {
        userId: 'user_1',
        name: 'calculus.pdf',
        type: 'PDF',
        size: 3,
        mimeType: 'application/pdf',
        storageKey: 'users/user_1/knowledge/doc.pdf',
        status: 'PENDING',
        sourceType: 'UPLOAD',
        contentHash: createCall.data.contentHash,
      },
      include: { _count: { select: { chunks: true } } },
    });
    expect(result.status).toBe('PENDING');
    expect(result.chunkCount).toBe(0);
  });

  it('returns an existing same-content document instead of creating a duplicate upload', async () => {
    const file = {
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
      size: 3,
      originalname: 'calculus-copy.pdf',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/copy.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus-copy.pdf',
    });
    prisma.document.findFirst
      .mockResolvedValueOnce(documentRow)
      .mockResolvedValueOnce(null);

    const result = await createService().createUploadDocument('user_1', file);

    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/copy.pdf',
    );
    expect(result.id).toBe(documentRow.id);
  });

  it('returns an existing document when concurrent duplicate upload hits the unique constraint', async () => {
    const file = {
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
      size: 3,
      originalname: 'calculus-copy.pdf',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/concurrent-copy.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus-copy.pdf',
    });
    prisma.document.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(documentRow);
    prisma.document.create.mockRejectedValue(
      createPrismaKnownRequestError('P2002', [
        'Document_userId_sourceType_contentHash_upload_unique',
      ]),
    );

    const result = await createService().createUploadDocument('user_1', file);

    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/concurrent-copy.pdf',
    );
    expect(result.id).toBe(documentRow.id);
  });

  it('replaces an owned document file and resets processing state', async () => {
    const replacementFile = {
      buffer: Buffer.from('updated-notes'),
      mimetype: 'text/plain',
      size: 13,
      originalname: 'updated-notes.txt',
    } as Express.Multer.File;
    const replacedRow = {
      ...documentRow,
      name: 'updated-notes.txt',
      type: 'TXT',
      size: 13,
      mimeType: 'text/plain',
      storageKey: 'users/user_1/knowledge/updated.txt',
      status: 'PENDING',
      contentHash: 'sha256:updated',
      processedAt: null,
      _count: { chunks: 0 },
    };
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/updated.txt',
      mimeType: 'text/plain',
      type: 'TXT',
      size: 13,
      originalName: 'updated-notes.txt',
    });
    prisma.document.findFirst
      .mockResolvedValueOnce(documentRow)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(replacedRow);
    const transactionClient: DocumentTransactionClient = {
      chunk: { deleteMany: prisma.chunk.deleteMany },
      document: {
        update: prisma.document.update,
        updateMany: prisma.document.updateMany,
        findFirst: prisma.document.findFirst,
      },
    };
    prisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 1 });

    const result = await createService().replaceUploadDocument(
      'user_1',
      'doc_1',
      replacementFile,
    );

    expect(prisma.chunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc_1', userId: 'user_1' },
    });
    const updateCall = prisma.document.updateMany.mock.calls[0]?.[0];
    expect(updateCall).toBeDefined();
    if (!updateCall) {
      throw new Error('Expected document.updateMany to be called');
    }
    expect(updateCall.data.contentHash).toMatch(/^sha256:/);
    expect(updateCall).toEqual({
      where: {
        id: 'doc_1',
        userId: 'user_1',
        status: 'PENDING',
        updatedAt: now,
        storageKey: 'users/user_1/knowledge/doc.pdf',
        contentHash: 'sha256:49f68a5c8493ec2c0bf489821c21fc3b',
      },
      data: {
        name: 'updated-notes.txt',
        type: 'TXT',
        size: 13,
        mimeType: 'text/plain',
        storageKey: 'users/user_1/knowledge/updated.txt',
        status: 'PENDING',
        errorMessage: null,
        processedAt: null,
        contentHash: updateCall.data.contentHash,
      },
    });
    expect(prisma.document.findFirst).toHaveBeenLastCalledWith({
      where: { id: 'doc_1', userId: 'user_1' },
      include: { _count: { select: { chunks: true } } },
    });
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/doc.pdf',
    );
    expect(result.name).toBe('updated-notes.txt');
    expect(result.status).toBe('PENDING');
    expect(result.chunkCount).toBe(0);
  });

  it('rejects replacement when the document changes before the transactional update', async () => {
    const replacementFile = {
      buffer: Buffer.from('updated-notes'),
      mimetype: 'text/plain',
      size: 13,
      originalname: 'updated-notes.txt',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/racing-update.txt',
      mimeType: 'text/plain',
      type: 'TXT',
      size: 13,
      originalName: 'updated-notes.txt',
    });
    prisma.document.findFirst
      .mockResolvedValueOnce(documentRow)
      .mockResolvedValueOnce(null);
    const transactionClient: DocumentTransactionClient = {
      chunk: { deleteMany: prisma.chunk.deleteMany },
      document: {
        update: prisma.document.update,
        updateMany: prisma.document.updateMany,
        findFirst: prisma.document.findFirst,
      },
    };
    prisma.$transaction.mockImplementation((callback) =>
      callback(transactionClient),
    );
    prisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createService().replaceUploadDocument('user_1', 'doc_1', replacementFile),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_PROCESSING',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'doc_1',
        userId: 'user_1',
        status: 'PENDING',
        updatedAt: now,
        storageKey: 'users/user_1/knowledge/doc.pdf',
        contentHash: 'sha256:49f68a5c8493ec2c0bf489821c21fc3b',
      },
      data: objectContaining({
        name: 'updated-notes.txt',
        status: 'PENDING',
        storageKey: 'users/user_1/knowledge/racing-update.txt',
      }),
    });
    expect(prisma.chunk.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/racing-update.txt',
    );
    expect(storage.deleteObject).not.toHaveBeenCalledWith(
      'users/user_1/knowledge/doc.pdf',
    );
  });

  it('rejects replacing a document with content that already exists on another card', async () => {
    const duplicateRow = {
      ...documentRow,
      id: 'doc_2',
      name: 'duplicate.txt',
      storageKey: 'users/user_1/knowledge/duplicate.txt',
      contentHash:
        'sha256:93a71c16a2f47f5b46db1e78fda04de0f37b148158c894d8ce18e41dcc04ee9e',
    };
    const replacementFile = {
      buffer: Buffer.from('duplicate-content'),
      mimetype: 'text/plain',
      size: 17,
      originalname: 'duplicate-content.txt',
    } as Express.Multer.File;
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/replacement.txt',
      mimeType: 'text/plain',
      type: 'TXT',
      size: 17,
      originalName: 'duplicate-content.txt',
    });
    prisma.document.findFirst
      .mockResolvedValueOnce(documentRow)
      .mockResolvedValueOnce(duplicateRow);

    await expect(
      createService().replaceUploadDocument('user_1', 'doc_1', replacementFile),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_DUPLICATE',
      statusCode: HttpStatus.CONFLICT,
    });

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.chunk.deleteMany).not.toHaveBeenCalled();
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/replacement.txt',
    );
  });

  it('deletes uploaded object when database create fails', async () => {
    storage.uploadKnowledgeDocument.mockResolvedValue({
      objectKey: 'users/user_1/knowledge/orphan.pdf',
      mimeType: 'application/pdf',
      type: 'PDF',
      size: 3,
      originalName: 'calculus.pdf',
    });
    prisma.document.create.mockRejectedValue(new Error('database down'));

    await expect(
      createService().createUploadDocument('user_1', {
        buffer: Buffer.from('pdf'),
        mimetype: 'application/pdf',
        size: 3,
        originalname: 'calculus.pdf',
      } as Express.Multer.File),
    ).rejects.toThrow('database down');
    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/orphan.pdf',
    );
  });

  it('lists only current user documents with optional filters', async () => {
    prisma.document.findMany.mockResolvedValue([documentRow]);

    const result = await createService().list('user_1', {
      status: 'PENDING',
      sourceType: 'UPLOAD',
      limit: 20,
    });

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', status: 'PENDING', sourceType: 'UPLOAD' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      include: { _count: { select: { chunks: true } } },
    });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('throws not found for cross-user detail access', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(
      createService().getById('user_2', 'doc_1'),
    ).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('deletes owned document and its storage object', async () => {
    prisma.document.findFirst.mockResolvedValue(documentRow);
    prisma.document.delete.mockResolvedValue(documentRow);

    const result = await createService().delete('user_1', 'doc_1');

    expect(storage.deleteObject).toHaveBeenCalledWith(
      'users/user_1/knowledge/doc.pdf',
    );
    expect(prisma.document.delete).toHaveBeenCalledWith({
      where: { id: 'doc_1' },
    });
    expect(result).toEqual({ ok: true });
  });
});
