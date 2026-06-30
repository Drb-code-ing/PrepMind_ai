import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { splitDocument } from '@repo/rag';
import type {
  KnowledgeDocumentMimeType,
  KnowledgeDocumentResponse,
} from '@repo/types/api/knowledge';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../uploads/storage.service';
import {
  ChunkPersistenceService,
  type PersistableChunk,
} from './chunk-persistence.service';
import { DocumentParserService } from './document-parser.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class DocumentProcessingService {
  private readonly documentInclude = {
    _count: { select: { chunks: true } },
  } satisfies Prisma.DocumentInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly parserService: DocumentParserService,
    private readonly embeddingService: EmbeddingService,
    private readonly chunkPersistenceService: ChunkPersistenceService,
    private readonly configService: ConfigService<ServerEnv, true>,
  ) {}

  async processDocument(
    userId: string,
    documentId: string,
    options: { force: boolean },
  ) {
    const document = await this.claimDocumentForProcessing(
      userId,
      documentId,
      options,
    );

    try {
      return await this.runProcessingPipeline({
        userId,
        documentId,
        expectedDocument: this.processingSnapshot(document),
      });
    } catch (error) {
      try {
        await this.markFailed(document, error);
      } catch {
        // Preserve the parser/storage/embedding error that explains the processing failure.
      }
      throw error;
    }
  }

  async claimDocumentForProcessing(
    userId: string,
    documentId: string,
    options: { force: boolean },
  ) {
    const document = await this.findOwned(userId, documentId);
    this.assertProcessable(document.status, options.force);
    await this.claimDocument(document, options.force);

    return document;
  }

  async runProcessingPipeline(input: {
    userId: string;
    documentId: string;
    expectedDocument: { storageKey: string; contentHash: string | null };
  }) {
    const document = await this.findOwned(input.userId, input.documentId);
    const expectedDocument = input.expectedDocument;

    await this.chunkPersistenceService.clearDocumentChunks(
      input.documentId,
      input.userId,
      expectedDocument,
    );

    const object = await this.storageService.readKnowledgeDocumentObject(
      expectedDocument.storageKey,
    );
    const buffer = await streamToBuffer(object.stream);
    const parsed = await this.parserService.parse({
      name: document.name,
      type: document.type,
      mimeType: document.mimeType as KnowledgeDocumentMimeType,
      buffer,
    });
    const chunks = splitDocument(
      {
        documentId: input.documentId,
        sourceName: document.name,
        text: parsed.text,
        metadata: parsed.metadata,
      },
      {
        targetTokens: this.configService.get('RAG_CHUNK_TARGET_TOKENS', {
          infer: true,
        }),
        overlapTokens: this.configService.get('RAG_CHUNK_OVERLAP_TOKENS', {
          infer: true,
        }),
        maxTokens: this.configService.get('RAG_CHUNK_MAX_TOKENS', {
          infer: true,
        }),
      },
    );
    if (chunks.length === 0) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_EMPTY_TEXT',
        '资料中没有可解析的文本',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const vectors = await this.embeddingService.embedChunks(
      chunks.map((chunk) => chunk.content),
    );

    await this.chunkPersistenceService.replaceDocumentChunks({
      documentId: input.documentId,
      userId: input.userId,
      expectedDocument,
      chunks: chunks.map<PersistableChunk>((chunk, index) => ({
        content: chunk.content,
        embedding: vectors[index] ?? [],
        metadata: chunk.metadata,
        index: chunk.index,
        tokenCount: chunk.tokenCount,
      })),
    });

    const done = await this.markDone({
      ...document,
      id: input.documentId,
      userId: input.userId,
      storageKey: expectedDocument.storageKey,
      contentHash: expectedDocument.contentHash,
    });

    return this.toResponse(done);
  }

  async markFailedForSnapshot(input: {
    userId: string;
    documentId: string;
    expectedDocument: { storageKey: string; contentHash: string | null };
    error: unknown;
  }) {
    const errorMessage =
      input.error instanceof AppError
        ? input.error.message
        : '资料处理失败，请稍后重试';

    await this.prisma.document.updateMany({
      where: {
        id: input.documentId,
        userId: input.userId,
        status: 'PROCESSING',
        storageKey: input.expectedDocument.storageKey,
        contentHash: input.expectedDocument.contentHash,
      },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }

  private async findOwned(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
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

  private assertProcessable(
    status: KnowledgeDocumentRecord['status'],
    force: boolean,
  ) {
    if (status === 'PROCESSING') {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    }

    if (status === 'DONE' && !force) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_ALREADY_DONE',
        '资料已经处理完成',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async claimDocument(
    document: KnowledgeDocumentRecord,
    force: boolean,
  ) {
    const statuses = force
      ? (['PENDING', 'FAILED', 'DONE'] as const)
      : (['PENDING', 'FAILED'] as const);
    const result = await this.prisma.document.updateMany({
      where: {
        id: document.id,
        userId: document.userId,
        status: { in: [...statuses] },
        storageKey: document.storageKey,
        contentHash: document.contentHash,
      },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    if (result.count !== 1) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        '资料正在处理中',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async markDone(document: KnowledgeDocumentRecord) {
    const result = await this.prisma.document.updateMany({
      where: this.processingSnapshotWhere(document),
      data: {
        status: 'DONE',
        errorMessage: null,
        processedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_PROCESSING',
        'Knowledge document changed while processing',
        HttpStatus.CONFLICT,
      );
    }

    return this.findOwned(document.userId, document.id);
  }

  private async markFailed(document: KnowledgeDocumentRecord, error: unknown) {
    const errorMessage =
      error instanceof AppError ? error.message : '资料处理失败，请稍后重试';

    await this.prisma.document.updateMany({
      where: this.processingSnapshotWhere(document),
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }

  private processingSnapshotWhere(document: KnowledgeDocumentRecord) {
    return {
      id: document.id,
      userId: document.userId,
      status: 'PROCESSING' as const,
      storageKey: document.storageKey,
      contentHash: document.contentHash,
    };
  }

  private processingSnapshot(document: KnowledgeDocumentRecord) {
    return {
      storageKey: document.storageKey,
      contentHash: document.contentHash,
    };
  }

  toResponse(document: KnowledgeDocumentRecord): KnowledgeDocumentResponse {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      mimeType: document.mimeType as KnowledgeDocumentMimeType,
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

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      continue;
    }

    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

type KnowledgeDocumentRecord = Prisma.DocumentGetPayload<{
  include: { _count: { select: { chunks: true } } };
}>;
