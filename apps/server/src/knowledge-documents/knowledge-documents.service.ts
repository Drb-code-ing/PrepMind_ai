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
    const contentHash = this.createContentHash(file?.buffer ?? Buffer.alloc(0));
    const uploaded = await this.storageService.uploadKnowledgeDocument(userId, {
      file,
    });

    try {
      const duplicate = await this.findDuplicateUpload(userId, contentHash);
      if (duplicate) {
        await this.safeDeleteObject(uploaded.objectKey);
        return this.toResponse(duplicate);
      }

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
          contentHash,
        },
        include: this.documentInclude,
      });

      return this.toResponse(document);
    } catch (error) {
      await this.safeDeleteObject(uploaded.objectKey);
      if (this.isContentHashUniqueConflict(error)) {
        const duplicate = await this.findDuplicateUpload(userId, contentHash);
        if (duplicate) {
          return this.toResponse(duplicate);
        }
      }
      throw error;
    }
  }

  async replaceUploadDocument(
    userId: string,
    id: string,
    file: Express.Multer.File | undefined,
  ) {
    const existing = await this.findOwned(userId, id);
    if (existing.status === 'PROCESSING') {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中，请稍后再更新',
        HttpStatus.CONFLICT,
      );
    }

    const contentHash = this.createContentHash(file?.buffer ?? Buffer.alloc(0));
    const uploaded = await this.storageService.uploadKnowledgeDocument(userId, {
      file,
    });

    try {
      const duplicate = await this.findDuplicateUpload(userId, contentHash, id);
      if (duplicate) {
        throw new AppError(
          'KNOWLEDGE_DOCUMENT_DUPLICATE',
          '这份资料内容已经存在，请直接使用已有资料',
          HttpStatus.CONFLICT,
        );
      }

      const document = await this.prisma.$transaction(async (transaction) => {
        const result = await transaction.document.updateMany({
          where: {
            id,
            userId,
            status: existing.status,
            updatedAt: existing.updatedAt,
            storageKey: existing.storageKey,
            contentHash: existing.contentHash,
          },
          data: {
            name: uploaded.originalName,
            type: uploaded.type,
            size: uploaded.size,
            mimeType: uploaded.mimeType,
            storageKey: uploaded.objectKey,
            status: 'PENDING',
            errorMessage: null,
            processedAt: null,
            contentHash,
          },
        });

        if (result.count !== 1) {
          throw new AppError(
            'KNOWLEDGE_DOCUMENT_PROCESSING',
            'Knowledge document changed while replacing upload',
            HttpStatus.CONFLICT,
          );
        }

        await transaction.chunk.deleteMany({
          where: { documentId: id, userId },
        });

        return transaction.document.findFirst({
          where: { id, userId },
          include: this.documentInclude,
        });
      });

      if (!document) {
        throw new AppError(
          'KNOWLEDGE_DOCUMENT_NOT_FOUND',
          'Knowledge document not found',
          HttpStatus.NOT_FOUND,
        );
      }

      await this.safeDeleteObject(existing.storageKey);
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

  private async findDuplicateUpload(
    userId: string,
    contentHash: string,
    excludedDocumentId?: string,
  ) {
    return this.prisma.document.findFirst({
      where: {
        userId,
        contentHash,
        sourceType: 'UPLOAD',
        ...(excludedDocumentId ? { NOT: { id: excludedDocumentId } } : {}),
      },
      include: this.documentInclude,
    });
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

  private isContentHashUniqueConflict(error: unknown) {
    if (!error || typeof error !== 'object') return false;

    const candidate = error as {
      code?: unknown;
      clientVersion?: unknown;
      meta?: { target?: unknown };
    };
    if (candidate.code !== 'P2002' || typeof candidate.clientVersion !== 'string') {
      return false;
    }

    const target = candidate.meta?.target;
    if (Array.isArray(target)) {
      return target.some(
        (item) =>
          typeof item === 'string' &&
          (item.includes('contentHash') || item.includes('content_hash')),
      );
    }

    return (
      typeof target === 'string' &&
      (target.includes('contentHash') || target.includes('content_hash'))
    );
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
