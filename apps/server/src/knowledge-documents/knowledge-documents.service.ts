import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KnowledgeDocumentListQuery } from '@repo/types/api/knowledge';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';

@Injectable()
export class KnowledgeDocumentsService {
  private readonly documentInclude = {
    _count: { select: { chunks: true } },
  } satisfies Prisma.DocumentInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createUploadDocument(
    userId: string,
    file: Express.Multer.File | undefined,
  ) {
    const uploaded = await this.storageService.uploadKnowledgeDocument(userId, {
      file,
    });

    try {
      const document = await this.prisma.document.create({
        data: {
          userId,
          name: uploaded.originalName,
          type: uploaded.type,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          storageKey: uploaded.objectKey,
          status: 'PENDING',
          sourceType: 'UPLOAD',
          contentHash: this.createContentHash(file?.buffer ?? Buffer.alloc(0)),
        },
        include: this.documentInclude,
      });

      return this.toResponse(document);
    } catch (error) {
      await this.safeDeleteObject(uploaded.objectKey);
      throw error;
    }
  }

  async list(userId: string, query: KnowledgeDocumentListQuery) {
    const where: Prisma.DocumentWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.sourceType) where.sourceType = query.sourceType;

    const documents = await this.prisma.document.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: this.documentInclude,
    });
    const items = documents.slice(0, query.limit);
    const nextCursor =
      documents.length > query.limit ? (items.at(-1)?.id ?? null) : null;

    return {
      items: items.map((document) => this.toResponse(document)),
      nextCursor,
    };
  }

  async getById(userId: string, id: string) {
    const document = await this.findOwned(userId, id);
    return this.toResponse(document);
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    const document = await this.findOwned(userId, id);
    await this.safeDeleteObject(document.storageKey);
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }

  private async findOwned(userId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, userId },
      include: this.documentInclude,
    });

    if (!document) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        '资料不存在',
        HttpStatus.NOT_FOUND,
      );
    }

    return document;
  }

  private createContentHash(buffer: Buffer) {
    return `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
  }

  private async safeDeleteObject(objectKey: string) {
    try {
      await this.storageService.deleteObject(objectKey);
    } catch {
      // Storage cleanup is best-effort; database ownership remains authoritative.
    }
  }

  private toResponse(document: KnowledgeDocumentRecord) {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      mimeType: document.mimeType,
      status: document.status,
      sourceType: document.sourceType,
      errorMessage: document.errorMessage,
      contentHash: document.contentHash,
      chunkCount: document._count.chunks,
      processedAt: document.processedAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}

type KnowledgeDocumentRecord = Prisma.DocumentGetPayload<{
  include: { _count: { select: { chunks: true } } };
}>;
