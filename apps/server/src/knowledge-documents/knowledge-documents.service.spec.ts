import { HttpStatus } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

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
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const storage = {
    uploadKnowledgeDocument: jest.fn(),
    deleteObject: jest.fn(),
  };

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

    expect(prisma.document.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        name: 'calculus.pdf',
        type: 'PDF',
        size: 3,
        mimeType: 'application/pdf',
        storageKey: 'users/user_1/knowledge/doc.pdf',
        status: 'PENDING',
        sourceType: 'UPLOAD',
        contentHash: expect.stringMatching(/^sha256:/),
      },
      include: { _count: { select: { chunks: true } } },
    });
    expect(result.status).toBe('PENDING');
    expect(result.chunkCount).toBe(0);
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
    expect(storage.deleteObject).toHaveBeenCalledWith('users/user_1/knowledge/orphan.pdf');
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

    await expect(createService().getById('user_2', 'doc_1')).rejects.toMatchObject({
      code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('deletes owned document and its storage object', async () => {
    prisma.document.findFirst.mockResolvedValue(documentRow);
    prisma.document.delete.mockResolvedValue(documentRow);

    const result = await createService().delete('user_1', 'doc_1');

    expect(storage.deleteObject).toHaveBeenCalledWith('users/user_1/knowledge/doc.pdf');
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc_1' } });
    expect(result).toEqual({ ok: true });
  });
});
